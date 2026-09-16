#!/usr/bin/env bun
/**
 * JEM bulk fetcher (1996-2026, Wiley onlinelibrary.wiley.com).
 *
 * Per paper (oldest first):
 *   - XML: in-page fetch /doi/full-xml/<doi>; accept iff 200 + >20KB +
 *     contains "<article". Small/metadata bodies = xml-absent (skip, not a
 *     failure). Recorded in xml-absent.jsonl so resume never re-probes.
 *   - PDF: in-page fetch /doi/pdfdirect/<doi>; accept iff %PDF magic + >20KB.
 *
 * One persistent real-Chrome context (profile .cache/cf-profile), warmed on a
 * known article; every route fetch goes through page.evaluate(fetch) with
 * credentials include (Chrome's own network stack passes CF; the request API
 * does not for pdf routes). 3.5-4.5s jittered sleep after every attempt.
 *
 * Recovery: on 403/empty retry up to 3x with growing sleep; 5 consecutive
 * failed fetches -> re-navigate working page to the warmup article and retry
 * once; challenge on re-nav -> ACTION NEEDED, wait 5 min; two consecutive
 * unresolved challenges -> STOP (exit 0, resumable).
 *
 * Outputs (all under .cache/bulk/jem + raw-new):
 *   raw-new/<doi_id>.xml|.pdf, manifest.jsonl, failures.jsonl,
 *   xml-absent.jsonl, STATUS.json (every 25 items).
 *
 * Usage: bun repertoire/.cache/bulk/jem/fetch.ts
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import { createHash } from "node:crypto";

const REPO = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
const REPD = `${REPO}/repertoire`;
const BULK = `${REPD}/.cache/bulk/jem`;
const RAW = `${REPD}/raw-new`;
const PROFILE = `${REPD}/.cache/cf-profile`;
const BASE = "https://onlinelibrary.wiley.com";
const WARMUP = "10.1111/jedm.12264";

const HARD_CAP_MS = 11.5 * 3600_000;
const START = Date.now();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const doiId = (doi: string) => doi.toLowerCase().replace(/\//g, ":");
const nowIso = () => new Date().toISOString();
const pace = () => sleep(3500 + Math.random() * 1000);
const mb = (n: number) => `${(n / 1024).toFixed(0)}KB`;

// ---------- state ----------

function readJsonl(f: string): any[] {
  try {
    return fs
      .readFileSync(f, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

const papers = readJsonl(`${BULK}/papers.jsonl`);
if (!papers.length) throw new Error("papers.jsonl empty; run list.ts first");

const manifestKeys = new Set<string>();
for (const m of readJsonl(`${BULK}/manifest.jsonl`)) manifestKeys.add(`${m.doi_id}|${m.format}`);
const absentXml = new Set<string>(readJsonl(`${BULK}/xml-absent.jsonl`).map((r) => r.doi_id));
let failTotal = readJsonl(`${BULK}/failures.jsonl`).length;
let okTotal = manifestKeys.size;

let done = 0;
let pdfSaved = 0;
let xmlSaved = 0;
let xmlAbsentCount = 0;
let lastDoi = "";
let stopReason: string | null = null;

function writeStatus(phase: string) {
  fs.writeFileSync(
    `${BULK}/STATUS.json`,
    JSON.stringify(
      {
        phase,
        done,
        total: papers.length,
        last: lastDoi,
        pdf_saved: pdfSaved,
        xml_saved: xmlSaved,
        xml_absent: xmlAbsentCount,
        failures: failTotal,
        fail_rate: failTotal + okTotal ? failTotal / (failTotal + okTotal) : 0,
        elapsed_min: Math.round((Date.now() - START) / 60000),
        updated_at: nowIso(),
        ...(stopReason ? { stopped_reason: stopReason } : {}),
      },
      null,
      2,
    ),
  );
}

function appendLine(f: string, obj: any) {
  fs.appendFileSync(f, JSON.stringify(obj) + "\n");
}

function validXmlFile(id: string): boolean {
  try {
    const f = `${RAW}/${id}.xml`;
    const st = fs.statSync(f);
    if (st.size <= 20000) return false;
    // whole-body search: "<article" can sit deep in wiley-component XML
    return fs.readFileSync(f).toString("latin1").includes("<article");
  } catch {
    return false;
  }
}

function validPdfFile(id: string): boolean {
  try {
    const st = fs.statSync(`${RAW}/${id}.pdf`);
    if (st.size <= 20000) return false;
    const fd = fs.openSync(`${RAW}/${id}.pdf`, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf.toString("latin1") === "%PDF";
  } catch {
    return false;
  }
}

function saveAtomic(name: string, body: Buffer) {
  const tmp = `${RAW}/.${name}.tmp`;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, `${RAW}/${name}`);
}

function addManifest(p: any, format: "xml" | "pdf", name: string, bytes: number, sha: string) {
  const key = `${p.doi_id}|${format}`;
  if (manifestKeys.has(key)) return;
  manifestKeys.add(key);
  okTotal++;
  appendLine(`${BULK}/manifest.jsonl`, {
    doi: p.doi,
    doi_id: p.doi_id,
    journal: "jem",
    year: p.year,
    format,
    file: `raw-new/${name}`,
    bytes,
    sha256: sha,
    fetched_at: nowIso(),
  });
}

function backfillManifest(p: any, format: "xml" | "pdf") {
  const name = `${p.doi_id}.${format}`;
  const f = `${RAW}/${name}`;
  if (manifestKeys.has(`${p.doi_id}|${format}`)) return;
  try {
    const body = fs.readFileSync(f);
    addManifest(p, format, name, body.length, createHash("sha256").update(body).digest("hex"));
  } catch {}
}

function recordFailure(p: any, route: string, error: string) {
  failTotal++;
  appendLine(`${BULK}/failures.jsonl`, { doi: p.doi, route, error, at: nowIso() });
}

// ---------- browser ----------

fs.mkdirSync(RAW, { recursive: true });

const LAUNCH = {
  channel: "chrome" as const,
  headless: false,
  args: ["--window-position=100,60", "--disable-blink-features=AutomationControlled"],
  viewport: { width: 1366, height: 900 },
};

let ctx = await chromium.launchPersistentContext(PROFILE, LAUNCH);
let page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(90_000);

async function challenged(): Promise<boolean> {
  const t = await page.title().catch(() => "");
  return /just a moment|attention required/i.test(t);
}

async function waitClearance(label: string, waitMs: number): Promise<boolean> {
  if (!(await challenged())) return true;
  console.log(`[human] ACTION NEEDED (${label}): solve the challenge in the Wiley window`);
  const deadline = Date.now() + waitMs;
  let lastLog = 0;
  while (Date.now() < deadline) {
    await sleep(2500);
    if (!(await challenged())) return true;
    if (Date.now() - lastLog > 20000) {
      console.log(`[human] still waiting for the challenge to clear (${label}) ...`);
      lastLog = Date.now();
    }
  }
  return !(await challenged());
}

/** Navigate the working page to the known-good article; handle challenges. */
async function navWorking(label: string): Promise<boolean> {
  try {
    await page.goto(`${BASE}/doi/full/${WARMUP}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
  } catch (e) {
    console.log(`[nav] goto failed (${label}): ${String(e).slice(0, 90)}`);
  }
  return !(await challenged());
}

let challengeStrikes = 0;

async function ensureBrowser(): Promise<boolean> {
  const alive = await page.title().then(
    () => true,
    () => false,
  );
  if (alive) return true;
  console.log("[browser] page/context dead; relaunching persistent context");
  try {
    await ctx.close();
  } catch {}
  try {
    ctx = await chromium.launchPersistentContext(PROFILE, LAUNCH);
    page = ctx.pages()[0] ?? (await ctx.newPage());
    page.setDefaultTimeout(90_000);
  } catch (e) {
    console.log(`[browser] relaunch failed: ${String(e).slice(0, 90)}`);
    return false;
  }
  return true;
}

// ---------- in-page fetch ----------

interface FetchResult {
  status?: number;
  body?: Buffer;
  head?: string;
  error?: string;
}

async function inPageFetch(url: string): Promise<FetchResult> {
  try {
    const res: any = await Promise.race([
      page.evaluate(async (u: string) => {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 90_000);
        try {
          const r = await fetch(u, { credentials: "include", signal: ac.signal });
          const status = r.status;
          if (!r.ok) {
            let head = "";
            try {
              head = (await r.text()).slice(0, 2048);
            } catch {}
            return { status, b64: "", head };
          }
          const buf = await r.arrayBuffer();
          let bin = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i += 0x8000) {
            bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          }
          return { status, b64: btoa(bin), head: "" };
        } finally {
          clearTimeout(to);
        }
      }, url),
      sleep(100_000).then(() => {
        throw new Error("evaluate-timeout");
      }),
    ]);
    return {
      status: res.status,
      body: res.b64 ? Buffer.from(res.b64, "base64") : Buffer.alloc(0),
      head: res.head ?? "",
    };
  } catch (e) {
    return { error: String(e).slice(0, 120) };
  }
}

type Verdict = "ok" | "absent" | "blocked" | "fail" | "error";

function classify(kind: "xml" | "pdf", r: FetchResult): Verdict {
  if (r.error) return "error";
  const { status = 0, body = Buffer.alloc(0), head = "" } = r;
  if (/just a moment|attention required/i.test(head)) return "blocked";
  if (status === 403 || status === 429) return "blocked";
  if (kind === "xml") {
    if (status === 200) {
      // whole-body search: in wiley-component XML "<article" can sit very
      // deep (observed at byte 60k+ of a 73KB file)
      if (body.length > 20000 && body.toString("latin1").includes("<article"))
        return "ok";
      return "absent"; // stub / metadata-only / no body: xml does not exist
    }
    if (status === 404) return "absent";
    return "error";
  }
  if (status === 200) {
    if (body.subarray(0, 4).toString("latin1") === "%PDF" && body.length > 20000) return "ok";
    return "error"; // 200 but not a usable pdf (transient interstitial possible)
  }
  if (status === 404) return "fail";
  return "error";
}

// ---------- route fetch with retries + recovery ----------

let consecutiveFailed = 0;

async function recover(): Promise<boolean> {
  console.log(`[recover] re-navigating working page after ${consecutiveFailed} consecutive failed fetches`);
  if (!(await ensureBrowser())) return false;
  const nav = await navWorking("recovery");
  if (!nav) {
    const ok = await waitClearance("recovery", 5 * 60_000);
    if (!ok) {
      challengeStrikes++;
      console.log(`[recover] challenge UNRESOLVED (strike ${challengeStrikes}/2)`);
      return false;
    }
    challengeStrikes = 0;
    await navWorking("post-clearance");
  } else {
    challengeStrikes = 0;
  }
  consecutiveFailed = 0;
  writeStatus("running");
  return true;
}

interface RouteOutcome {
  body?: Buffer;
  ok: boolean;
  absent?: boolean;
  fatal?: boolean;
  error?: string;
  reason?: string;
}

const absentReason = (r: FetchResult): string =>
  r.error ? r.error.slice(0, 40) : `${r.status}:${r.body?.length ?? 0}B`;

async function fetchRoute(p: any, kind: "xml" | "pdf"): Promise<RouteOutcome> {
  const url = `${BASE}/doi/${kind === "xml" ? "full-xml" : "pdfdirect"}/${p.doi}`;
  const retrySleeps = [5000, 10000, 20000];
  let lastErr = "";
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await sleep(retrySleeps[attempt - 1]);
    const r = await inPageFetch(url);
    const v = classify(kind, r);
    await pace(); // jittered sleep after EVERY route fetch attempt
    if (v === "ok") {
      consecutiveFailed = 0;
      return { ok: true, body: r.body };
    }
    if (v === "absent") {
      consecutiveFailed = 0;
      return { ok: false, absent: true, reason: absentReason(r) };
    }
    lastErr =
      r.error ??
      `${kind} status=${r.status} bytes=${r.body?.length ?? 0}${v === "fail" ? " not-pdf" : ""}`;
    if (v === "fail") {
      // definitive for pdfs (404 / 200-not-pdf): no retry
      consecutiveFailed = 0;
      return { ok: false, error: lastErr };
    }
    // blocked or error -> retryable
    consecutiveFailed++;
    console.log(
      `  ${kind} attempt ${attempt + 1}: ${lastErr} (consecutive-fail ${consecutiveFailed})`,
    );
    if (consecutiveFailed >= 5) {
      const rec = await recover();
      if (!rec) {
        if (challengeStrikes >= 2) return { ok: false, fatal: true, error: "challenge-unresolved" };
        return { ok: false, error: `blocked:${lastErr}` };
      }
      const r2 = await inPageFetch(url);
      const v2 = classify(kind, r2);
      await pace();
      if (v2 === "ok") {
        consecutiveFailed = 0;
        return { ok: true, body: r2.body };
      }
      consecutiveFailed = 0;
      if (v2 === "absent") return { ok: false, absent: true, reason: absentReason(r2) };
      return { ok: false, error: r2.error ?? `${kind} status=${r2.status} after recovery` };
    }
  }
  return { ok: false, error: `retries-exhausted:${lastErr}` };
}

// ---------- warmup ----------

console.log(`[warmup] ${papers.length} papers; navigating to ${WARMUP}`);
await page.goto(`${BASE}/doi/full/${WARMUP}`, {
  waitUntil: "domcontentloaded",
  timeout: 90_000,
}).catch(() => {});
if (!(await waitClearance("warmup", 10 * 60_000))) {
  console.log("STOP: warmup challenge unresolved after 10 min; resumable, nothing fetched");
  stopReason = "warmup-challenge";
  writeStatus("done");
  await ctx.close().catch(() => {});
  process.exit(0);
}
// Never trust a pre-clearance state; re-navigate and keep this page as the worker.
await navWorking("warmup-final");
if (await challenged()) {
  if (!(await waitClearance("warmup-final", 5 * 60_000))) {
    console.log("STOP: warmup-final challenge unresolved; resumable, nothing fetched");
    stopReason = "warmup-challenge";
    writeStatus("done");
    await ctx.close().catch(() => {});
    process.exit(0);
  }
  await navWorking("warmup-final-2");
}
console.log("[warmup] clearance ok; working page ready");

// ---------- main loop ----------

writeStatus("running");

for (const p of papers) {
  if (stopReason) break;
  if (Date.now() - START > HARD_CAP_MS) {
    stopReason = "time-cap";
    console.log("STOP: 12h hard cap approached; resumable");
    break;
  }

  // --- XML ---
  let xmlNote: string;
  if (validXmlFile(p.doi_id)) {
    backfillManifest(p, "xml");
    xmlSaved++;
    xmlNote = "xml=valid";
  } else if (absentXml.has(p.doi_id)) {
    xmlAbsentCount++;
    xmlNote = "xml=absent";
  } else {
    const r = await fetchRoute(p, "xml");
    if (r.ok && r.body) {
      saveAtomic(`${p.doi_id}.xml`, r.body);
      addManifest(p, "xml", `${p.doi_id}.xml`, r.body.length, createHash("sha256").update(r.body).digest("hex"));
      xmlSaved++;
      xmlNote = `xml=ok(${mb(r.body.length)})`;
    } else if (r.absent) {
      absentXml.add(p.doi_id);
      appendLine(`${BULK}/xml-absent.jsonl`, {
        doi: p.doi,
        doi_id: p.doi_id,
        at: nowIso(),
        reason: r.reason ?? "",
      });
      xmlAbsentCount++;
      xmlNote = `xml=absent(${r.reason ?? "?"})`;
    } else if (r.fatal) {
      stopReason = "challenge";
      break;
    } else {
      recordFailure(p, "xml", r.error ?? "unknown");
      xmlNote = `xml=FAIL(${(r.error ?? "").slice(0, 40)})`;
    }
  }

  // --- PDF ---
  let pdfNote: string;
  if (validPdfFile(p.doi_id)) {
    backfillManifest(p, "pdf");
    pdfSaved++;
    pdfNote = "pdf=valid";
  } else {
    const r = await fetchRoute(p, "pdf");
    if (r.ok && r.body) {
      saveAtomic(`${p.doi_id}.pdf`, r.body);
      addManifest(p, "pdf", `${p.doi_id}.pdf`, r.body.length, createHash("sha256").update(r.body).digest("hex"));
      pdfSaved++;
      pdfNote = `pdf=ok(${mb(r.body.length)})`;
    } else if (r.absent) {
      recordFailure(p, "pdf", "absent");
      pdfNote = "pdf=absent";
    } else if (r.fatal) {
      stopReason = "challenge";
      break;
    } else {
      recordFailure(p, "pdf", r.error ?? "unknown");
      pdfNote = `pdf=FAIL(${(r.error ?? "").slice(0, 40)})`;
    }
  }

  done++;
  lastDoi = p.doi;
  console.log(`[${String(done).padStart(4)}/${papers.length}] ${p.year} ${p.doi} ${xmlNote} ${pdfNote}`);
  if (done % 25 === 0) writeStatus("running");
}

// ---------- finish ----------

writeStatus("done");
console.log(
  `DONE done=${done}/${papers.length} pdf=${pdfSaved} xml=${xmlSaved} xml-absent=${xmlAbsentCount} failures=${failTotal}` +
    `${stopReason ? ` stopped=${stopReason}` : ""}`,
);
await ctx.close().catch(() => {});
process.exit(0);
