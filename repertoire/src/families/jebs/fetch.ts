#!/usr/bin/env bun
/**
 * JEBS bulk fetcher (SAGE, real Chrome, persistent sage-profile2).
 * PDF for every paper 1976-2026 via /doi/pdf/<DOI>; JATS XML for 2007+ via
 * /doi/full-xml/<DOI>, validated per paper. Resumable: skips anything
 * already in manifest.jsonl or present+valid in raw-new/. Writes
 * manifest.jsonl, failures.jsonl, STATUS.json. 12h cap. No cloud writes.
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, "");
const REPO = fs.realpathSync(`${OUT}/../../../..`);
const RAW = `${REPO}/repertoire/raw-new`;
const PROFILE = `${REPO}/repertoire/.cache/spike-jebs/sage-profile2`;
const BASE = "https://journals.sagepub.com";
const CONTROL = "10.3102/1076998614548485"; // known-good 2015
const CAP_MS = 12 * 3600_000;
const START = Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const jitter = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

type Paper = { doi: string; doi_id: string; title: string; year: number; journal: string; volume: string };
const papers: Paper[] = fs
  .readFileSync(`${OUT}/papers.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l) as Paper)
  .sort((a, b) => a.year - b.year || a.doi.localeCompare(b.doi));
fs.mkdirSync(RAW, { recursive: true });

// ---------- resume ----------
const done = new Set<string>(); // "<doi_id>:<format>"
const manifestPath = `${OUT}/manifest.jsonl`;
const failPath = `${OUT}/failures.jsonl`;
const append = (p: string, obj: unknown) => fs.appendFileSync(p, JSON.stringify(obj) + "\n");
function manifestLine(p: Paper, format: "pdf" | "xml", name: string, b: Buffer) {
  append(manifestPath, {
    doi: p.doi, doi_id: p.doi_id, journal: "jebs", year: p.year, format,
    file: `raw-new/${name}`, bytes: b.length, sha256: sha256(b), fetched_at: now(),
  });
}
function validExisting(p: string, format: "pdf" | "xml"): boolean {
  try {
    const b = fs.readFileSync(p);
    if (b.length <= 20_480) return false;
    return format === "pdf" ? b.subarray(0, 5).toString("latin1") === "%PDF-" : b.subarray(0, 4096).toString("latin1").includes("<article");
  } catch { return false; }
}
{
  const byId = new Map(papers.map((p) => [p.doi_id, p]));
  if (fs.existsSync(manifestPath)) {
    for (const l of fs.readFileSync(manifestPath, "utf8").trim().split("\n").filter(Boolean)) {
      const m = JSON.parse(l) as { doi_id: string; format: string };
      done.add(`${m.doi_id}:${m.format}`);
    }
  }
  let adopted = 0;
  for (const f of fs.readdirSync(RAW)) {
    const m = f.match(/^(10\.3102:[^/]+)\.(pdf|xml)$/);
    if (!m) continue;
    const p = byId.get(m[1]);
    if (!p) continue;
    if (done.has(`${m[1]}:${m[2]}`)) continue;
    if (validExisting(`${RAW}/${f}`, m[2] as "pdf" | "xml")) {
      manifestLine(p, m[2] as "pdf" | "xml", f, fs.readFileSync(`${RAW}/${f}`));
      done.add(`${m[1]}:${m[2]}`);
      adopted++;
    } else {
      fs.rmSync(`${RAW}/${f}`); // partial write from a crash; refetch
    }
  }
  console.log(`[resume] manifest ${done.size} entries; adopted ${adopted} orphan files`);
}

// ---------- status ----------
const S = {
  journal: "jebs", phase: "starting", stoppedReason: "" as string,
  startedAt: now(), updatedAt: now(), listed: papers.length,
  papersDone: 0, papersRemaining: 0, pdfSaved: 0, pdfFailed: 0,
  xmlSaved: 0, xmlAbsent: 0, xmlError: 0, consecFail: 0,
  rewarms: 0, challenges: 0, unresolvedChallenges: 0, lastDoi: "",
  recycles: 0, blockWaits: 0,
};
const writeStatus = () => {
  S.updatedAt = now();
  S.papersRemaining = papers.length - S.papersDone;
  fs.writeFileSync(`${OUT}/STATUS.json`, JSON.stringify(S, null, 1) + "\n");
};

// ---------- browser ----------
const LAUNCH = {
  headless: false, channel: "chrome",
  args: ["--window-position=500,60", "--disable-blink-features=AutomationControlled"],
} as const;
let ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>>;
let page: Awaited<ReturnType<typeof ctx.newPage>>;
let relaunches = 0;
async function launchCtx() {
  ctx = await chromium.launchPersistentContext(PROFILE, { ...LAUNCH });
  page = await ctx.newPage();
}
async function ensureLive(): Promise<boolean> {
  try { await page.title(); return true; } catch { /* closed */ }
  while (relaunches < 20) {
    relaunches++;
    console.log(`[browser] context lost; relaunch ${relaunches}`);
    try { await ctx.close(); } catch { /* already gone */ }
    try {
      await launchCtx();
      if (await warm(10 * 60_000, "relaunch")) return true;
    } catch (e) { console.log(`[browser] relaunch threw: ${String(e).slice(0, 120)}`); }
    await sleep(30_000);
  }
  S.phase = "stopped"; S.stoppedReason = "browser lost, relaunch budget exhausted";
  writeStatus();
  process.exit(0); // resumable
}

async function challengeState(): Promise<string> {
  const t = await page.title().catch(() => "");
  if (/just a moment|attention required|client challenge/i.test(t)) return "challenge";
  const flags = await page
    .evaluate(() => {
      const txt = document.body?.innerText ?? "";
      return {
        ch: !!document.querySelector("#challenge-running, #challenge-error-text, iframe[src*='challenges.cloudflare.com']"),
        block: /has been blocked|block reason/i.test(txt.slice(0, 4000)),
      };
    })
    .catch(() => ({ ch: false, block: false }));
  if (flags.block) return "block";
  return flags.ch ? "challenge" : t ? "clear" : "loading";
}

async function settle(waitMs: number): Promise<string> {
  const t0 = Date.now();
  let last = "loading";
  while (Date.now() - t0 < waitMs) {
    last = await challengeState();
    if (last === "clear") return last;
    if (last === "block") return last; // will not clear by waiting
    if ((Date.now() - t0) % 60_000 < 3_000) console.log(`[wait] still ${last} after ${Math.round((Date.now() - t0) / 1000)}s`);
    await sleep(2500);
  }
  return last;
}

/** Navigate to the control DOI and wait for a clear page. */
async function warm(windowMs: number, why: string): Promise<boolean> {
  if (!(await ensureLive())) return false;
  console.log(`[warm] ${why}: goto control ${CONTROL}`);
  await page.goto(`${BASE}/doi/${CONTROL}`, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((e) => console.log(`[warm] goto: ${String(e).slice(0, 80)}`));
  const st = await settle(windowMs);
  if (st !== "clear") { console.log(`[warm] NOT clear after ${Math.round(windowMs / 1000)}s (${st})`); return false; }
  await sleep(9000); // SAGE re-gates if you rush (proven)
  console.log(`[warm] clear`);
  return true;
}

/** Challenge mid-run: ask the human, wait 5 min x2. False = give up. */
async function handleChallenge(): Promise<boolean> {
  S.challenges++;
  for (let i = 1; i <= 2; i++) {
    console.log(`[human] ACTION NEEDED: solve the challenge in the SAGE window (round ${i}/2)`);
    writeStatus();
    if (await warm(5 * 60_000, `challenge round ${i}`)) {
      S.consecFail = 0;
      writeStatus();
      return true;
    }
  }
  S.unresolvedChallenges = 2;
  return false;
}

// ---------- capture ----------
type FetchRes = { status: number; ct: string; b64: string; err?: string };
async function fetchB64(url: string): Promise<FetchRes> {
  try {
    return await page.evaluate(async (u: string) => {
      try {
        const r = await fetch(u, { credentials: "include" });
        const ct = r.headers.get("content-type") ?? "";
        const bytes = new Uint8Array(await r.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { status: r.status, ct, b64: btoa(bin) };
      } catch (e) { return { status: 0, ct: "", b64: "", err: String(e).slice(0, 120) }; }
    }, url);
  } catch (e) {
    return { status: -1, ct: "", b64: "", err: String(e).slice(0, 120) };
  }
}
const isChallenge = (r: FetchRes, b: Buffer): boolean => {
  if (r.status === -1 && /closed|destroyed|Target/i.test(r.err ?? "")) return false;
  if (r.status !== 403 && r.status !== 503) return false;
  const s = b.toString("latin1", 0, Math.min(b.length, 8192)).toLowerCase();
  return s.includes("just a moment") || s.includes("challenge-platform") || s.includes("cf-chl") || s.includes("attention required");
};
type Attempt<T> = { kind: "ok"; res: T } | { kind: "challenge" } | { kind: "fail"; status: number; err?: string; bytes: number };
async function attempt(
  url: string,
  validate: (b: Buffer, r: FetchRes) => boolean,
): Promise<Attempt<Buffer>> {
  let last: { status: number; err?: string; bytes: number } = { status: 0, bytes: 0 };
  let snippet = "";
  for (let t = 1; t <= 3; t++) {
    if (!(await ensureLive())) return { kind: "fail", ...last, err: last.err ?? "browser-lost" };
    const r = await fetchB64(url);
    const b = r.b64 ? Buffer.from(r.b64, "base64") : Buffer.alloc(0);
    if (isChallenge(r, b)) return { kind: "challenge" };
    if (r.status === 200 && validate(b, r)) return { kind: "ok", res: b };
    last = { status: r.status, err: r.err, bytes: b.length };
    snippet = b.subarray(0, 300).toString("latin1").replace(/\s+/g, " ").slice(0, 160);
    console.log(`    try${t}: status=${r.status} bytes=${b.length} ct=${r.ct.slice(0, 40)}${r.err ? ` err=${r.err}` : ""}`);
    await sleep(r.status === 429 ? 60_000 : 8_000 * t); // growing
  }
  return { kind: "fail", ...last, snippet } as Attempt<Buffer> & { snippet?: string };
}

// ---------- main ----------
await launchCtx();
console.log(`[launch] real Chrome, profile sage-profile2; ${papers.length} papers listed`);
writeStatus();
if (!(await warm(10 * 60_000, "startup"))) {
  S.phase = "stopped"; S.stoppedReason = "startup challenge unresolved";
  if (!(await handleChallenge())) {
    writeStatus(); await ctx.close(); process.exit(0);
  }
}
S.phase = "fetching"; writeStatus();

let idx = 0;
for (const p of papers) {
  if (Date.now() - START > CAP_MS) { S.phase = "stopped"; S.stoppedReason = "12h cap"; break; }
  idx++;
  S.lastDoi = p.doi;
  const pdfDone = done.has(`${p.doi_id}:pdf`);
  const xmlDone = p.year < 2007 || done.has(`${p.doi_id}:xml`);
  if (pdfDone && xmlDone) { S.papersDone++; continue; }

  // ---- PDF ----
  if (!pdfDone) {
    for (let ch = 0; ch < 3; ch++) {
      const a = await attempt(`${BASE}/doi/pdf/${p.doi}`, (b) => {
        if (b.subarray(0, 5).toString("latin1") !== "%PDF-") return false;
        return p.year < 2000 ? b.length > 4096 : b.length > 20_480; // old SAGE PDFs run small
      });
      if (a.kind === "ok") {
        fs.writeFileSync(`${RAW}/${p.doi_id}.pdf`, a.res);
        manifestLine(p, "pdf", `${p.doi_id}.pdf`, a.res);
        done.add(`${p.doi_id}:pdf`); S.pdfSaved++; S.consecFail = 0;
        break;
      }
      if (a.kind === "challenge") {
        if (!(await handleChallenge())) { S.phase = "stopped"; S.stoppedReason = "challenge unresolved x2 (pdf)"; break; }
        continue; // cleared: retry this paper's pdf
      }
      S.pdfFailed++; S.consecFail++;
      append(failPath, { doi: p.doi, doi_id: p.doi_id, year: p.year, format: "pdf", status: a.status, bytes: a.bytes, err: a.err ?? "", snippet: (a as { snippet?: string }).snippet ?? "", at: now() });
      console.log(`  PDF FAILED ${p.doi}`);
      break;
    }
    if (S.phase === "stopped") break;
  }
  await sleep(jitter(4000, 5000));

  // ---- XML (2007+) ----
  let xmlNote = "";
  if (p.year >= 2007 && !done.has(`${p.doi_id}:xml`)) {
    for (let ch = 0; ch < 3; ch++) {
      const a = await attempt(`${BASE}/doi/full-xml/${p.doi}`, (b) => {
        if (!b.subarray(0, 4096).toString("latin1").includes("<article")) return false;
        return p.year < 2000 ? b.length > 4096 : b.length > 20_480; // old JATS runs small too
      });
      if (a.kind === "ok") {
        fs.writeFileSync(`${RAW}/${p.doi_id}.xml`, a.res);
        manifestLine(p, "xml", `${p.doi_id}.xml`, a.res);
        done.add(`${p.doi_id}:xml`); S.xmlSaved++;
        xmlNote = ` xml=ok(${(a.res.length / 1024).toFixed(0)}KB)`;
        break;
      }
      if (a.kind === "challenge") {
        if (!(await handleChallenge())) { S.phase = "stopped"; S.stoppedReason = "challenge unresolved x2 (xml)"; break; }
        continue; // cleared: retry this paper's xml
      }
      // absent / stub / error: skip silently, count in STATUS
      if (a.status === 0 || a.status === -1) S.xmlError++; else S.xmlAbsent++;
      xmlNote = ` xml=absent(status=${a.status},${a.bytes}B)`;
      break;
    }
    if (S.phase === "stopped") break;
  }
  S.papersDone++;
  console.log(`[${idx}/${papers.length}] ${p.year} ${p.doi_id} pdf=${done.has(`${p.doi_id}:pdf`) ? "ok" : "FAIL"}${xmlNote}`);

  if (S.consecFail >= 5) {
    S.rewarms++; writeStatus();
    console.log(`[rewarm] 5 consecutive failures; re-warming working page`);
    if (!(await warm(5 * 60_000, "5-consecutive-failures"))) {
      if (!(await handleChallenge())) { S.phase = "stopped"; S.stoppedReason = "challenge unresolved x2 (rewarm)"; break; }
    }
    S.consecFail = 0;
  }
  if (S.papersDone % 25 === 0) writeStatus();
}

if (S.phase !== "stopped") { S.phase = "complete"; S.stoppedReason = "all papers attempted"; }
writeStatus();
console.log(`[done] ${S.stoppedReason}: pdf=${S.pdfSaved} xml=${S.xmlSaved} pdfFail=${S.pdfFailed} xmlAbsent=${S.xmlAbsent} remaining=${papers.length - S.papersDone}`);
try { await ctx.close(); } catch { /* already gone */ }
process.exit(0);
