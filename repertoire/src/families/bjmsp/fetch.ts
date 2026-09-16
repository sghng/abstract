#!/usr/bin/env bun
/**
 * BJMSP bulk fetcher (1965-2026, Wiley partner zone
 * bpspsychub.onlinelibrary.wiley.com).
 *
 * Era map (spike-bjmsp, 2026-09-15):
 *   - PDF: all years via /doi/pdfdirect/<doi>; accept iff %PDF magic and
 *     year-aware size floor (pre-2000 scans can be small): >4KB pre-2000,
 *     >20KB from 2000 on.
 *   - XML: /doi/full-xml/<doi> for 2005+ only; earlier years never probed,
 *     recorded xml-absent up front (spike: 2008 jats, 1999 err).
 *
 * Runs on the CLONED profile .cache/cf-profile-bjmsp (the original
 * cf-profile belongs to the JEM run); cf_clearance covers both Wiley zones.
 *
 * Block-page awareness: bodies containing Wiley/SAGE block text
 * ("has been blocked", "block reason") stop the run cleanly
 * (stopped_reason=blocked-page) instead of grinding; relaunch resumes.
 *
 * Every route fetch goes through page.evaluate(fetch) with credentials
 * include and an in-page AbortController timeout (120s) so a stalled
 * connection cannot wedge the run; 4-5s jittered pace after every attempt.
 *
 * Recovery: 403/empty retry up to 3x; 5 consecutive failed fetches ->
 * re-navigate working page to the warmup article; challenge on re-nav ->
 * ACTION NEEDED, wait 5 min; two consecutive unresolved challenges -> STOP.
 *
 * Outputs (under .cache/bulk/bjmsp + raw-new):
 *   raw-new/<doi_id>.xml|.pdf, manifest.jsonl, failures.jsonl,
 *   xml-absent.jsonl, STATUS.json (every 25 items).
 *
 * Usage: bun repertoire/.cache/bulk/bjmsp/fetch.ts
 *   [--papers <file>] [--out <dir>]   (smoke: alternate inputs/outputs)
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import { createHash } from "node:crypto";

const argv = process.argv.slice(2);
const argOf = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};

const REPO = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
const REPD = `${REPO}/repertoire`;
const BULK = `${REPD}/.cache/bulk/bjmsp`;
const PAPERS_FILE = argOf("--papers") ?? `${BULK}/papers.jsonl`;
const OUT_DIR = argOf("--out"); // smoke mode: state + raw-new under this dir
const STATE = OUT_DIR ?? BULK;
const RAW = OUT_DIR ? `${OUT_DIR}/raw-new` : `${REPD}/raw-new`;
const PROFILE = `${REPD}/.cache/cf-profile-bjmsp`;
const BASE = "https://bpspsychub.onlinelibrary.wiley.com";
const WARMUP = "10.1111/bmsp.70065"; // 2025 spike control on this zone

const XML_FROM_YEAR = 2005; // spike: 2008 jats present, 1999 err; Wiley-wide 2005 pattern
const PDF_FLOOR_OLD = 4096; // pre-2000 scans can be small; magic byte still required
const PDF_FLOOR_NEW = 20480;
const BLOCK_TEXT = /has been blocked|block reason/i;

const HARD_CAP_MS = 11.5 * 3600_000;
const START = Date.now();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const doiId = (doi: string) => doi.toLowerCase().replace(/\//g, ":");
const nowIso = () => new Date().toISOString();
const pace = () => sleep(4000 + Math.random() * 1000);
const mb = (n: number) => `${(n / 1024).toFixed(0)}KB`;
const pdfFloor = (year: number) => (year > 0 && year < 2000 ? PDF_FLOOR_OLD : PDF_FLOOR_NEW);

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

const papers = readJsonl(PAPERS_FILE);
if (!papers.length) throw new Error(`papers file empty (${PAPERS_FILE}); run list.ts first`);

const manifestKeys = new Set<string>();
for (const m of readJsonl(`${STATE}/manifest.jsonl`)) manifestKeys.add(`${m.doi_id}|${m.format}`);
const absentXml = new Set<string>(readJsonl(`${STATE}/xml-absent.jsonl`).map((r) => r.doi_id));
let failTotal = readJsonl(`${STATE}/failures.jsonl`).length;
let okTotal = manifestKeys.size;

let done = 0;
let pdfSaved = 0;
let xmlSaved = 0;
let xmlAbsentCount = 0;
let lastDoi = "";
let stopReason: string | null = null;

function writeStatus(phase: string) {
  fs.writeFileSync(
    `${STATE}/STATUS.json`,
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
    const st = fs.statSync(`${RAW}/${id}.xml`);
    if (st.size <= 20000) return false;
    const fd = fs.openSync(`${RAW}/${id}.xml`, "r");
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, 8192, 0);
    fs.closeSync(fd);
    return buf.subarray(0, n).toString("latin1").includes("<article");
  } catch {
    return false;
  }
}

function validPdfFile(id: string, year: number): boolean {
  try {
    const st = fs.statSync(`${RAW}/${id}.pdf`);
    if (st.size <= pdfFloor(year)) return false;
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
  appendLine(`${STATE}/manifest.jsonl`, {
    doi: p.doi,
    doi_id: p.doi_id,
    journal: "bjmsp",
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
  appendLine(`${STATE}/failures.jsonl`, { doi: p.doi, route, error, at: nowIso() });
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
  console.log(`[human] ACTION NEEDED (${label}): solve the challenge in the BJMSP window`);
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
        const to = setTimeout(() => ac.abort(), 120_000); // stalled connections must abort in-page
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
        } catch (e) {
          return { status: 0, b64: "", head: "", err: String(e).slice(0, 120) };
        } finally {
          clearTimeout(to);
        }
      }, url),
      sleep(140_000).then(() => {
        throw new Error("evaluate-timeout");
      }),
    ]);
    if (res.err) return { error: `in-page:${res.err}` };
    return {
      status: res.status,
      body: res.b64 ? Buffer.from(res.b64, "base64") : Buffer.alloc(0),
      head: res.head ?? "",
    };
  } catch (e) {
    return { error: String(e).slice(0, 120) };
  }
}

type Verdict = "ok" | "absent" | "blocked" | "blockpage" | "fail" | "error";

function classify(kind: "xml" | "pdf", year: number, r: FetchResult): Verdict {
  if (r.error) return "error";
  const { status = 0, body = Buffer.alloc(0), head = "" } = r;
  if (/just a moment|attention required/i.test(head)) return "blocked";
  // Wiley/SAGE block page: fatal, not a transient challenge
  if (BLOCK_TEXT.test(head)) return "blockpage";
  if (body.length && BLOCK_TEXT.test(body.subarray(0, 65536).toString("latin1"))) return "blockpage";
  if (status === 403 || status === 429) return "blocked";
  if (kind === "xml") {
    if (status === 200) {
      if (body.length > 20000 && body.subarray(0, 65536).toString("latin1").includes("<article"))
        return "ok";
      return "absent"; // stub / metadata-only / no body: xml does not exist
    }
    if (status === 404) return "absent";
    return "error";
  }
  if (status === 200) {
    if (body.subarray(0, 4).toString("latin1") === "%PDF" && body.length > pdfFloor(year))
      return "ok";
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
  stopCode?: string;
  error?: string;
}

async function fetchRoute(p: any, kind: "xml" | "pdf"): Promise<RouteOutcome> {
  const url = `${BASE}/doi/${kind === "xml" ? "full-xml" : "pdfdirect"}/${p.doi}`;
  const retrySleeps = [5000, 10000, 20000];
  let lastErr = "";
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await sleep(retrySleeps[attempt - 1]);
    const r = await inPageFetch(url);
    const v = classify(kind, p.year, r);
    await pace(); // jittered sleep after EVERY route fetch attempt
    if (v === "ok") {
      consecutiveFailed = 0;
      return { ok: true, body: r.body };
    }
    if (v === "absent") {
      consecutiveFailed = 0;
      return { ok: false, absent: true };
    }
    if (v === "blockpage") {
      consecutiveFailed = 0;
      return { ok: false, fatal: true, stopCode: "blocked-page", error: `block-page:${lastErrOf(r, kind)}` };
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
        if (challengeStrikes >= 2)
          return { ok: false, fatal: true, stopCode: "challenge", error: "challenge-unresolved" };
        return { ok: false, error: `blocked:${lastErr}` };
      }
      const r2 = await inPageFetch(url);
      const v2 = classify(kind, p.year, r2);
      await pace();
      if (v2 === "ok") {
        consecutiveFailed = 0;
        return { ok: true, body: r2.body };
      }
      consecutiveFailed = 0;
      if (v2 === "absent") return { ok: false, absent: true };
      if (v2 === "blockpage")
        return { ok: false, fatal: true, stopCode: "blocked-page", error: "block-page:after-recovery" };
      return { ok: false, error: r2.error ?? `${kind} status=${r2.status} after recovery` };
    }
  }
  return { ok: false, error: `retries-exhausted:${lastErr}` };
}

function lastErrOf(r: FetchResult, kind: string): string {
  return r.error ?? `${kind} status=${r.status} bytes=${r.body?.length ?? 0}`;
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

  // --- XML (2005+ only; earlier years are xml-absent by era map) ---
  let xmlNote: string;
  if (p.year < XML_FROM_YEAR) {
    if (!absentXml.has(p.doi_id)) {
      absentXml.add(p.doi_id);
      appendLine(`${STATE}/xml-absent.jsonl`, {
        doi: p.doi,
        doi_id: p.doi_id,
        era: "pre-2005",
        at: nowIso(),
      });
    }
    xmlAbsentCount++;
    xmlNote = "xml=absent(era)";
  } else if (validXmlFile(p.doi_id)) {
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
      appendLine(`${STATE}/xml-absent.jsonl`, { doi: p.doi, doi_id: p.doi_id, at: nowIso() });
      xmlAbsentCount++;
      xmlNote = "xml=absent";
    } else if (r.fatal) {
      stopReason = r.stopCode ?? "challenge";
      recordFailure(p, "xml", r.error ?? "fatal");
      break;
    } else {
      recordFailure(p, "xml", r.error ?? "unknown");
      xmlNote = `xml=FAIL(${(r.error ?? "").slice(0, 40)})`;
    }
  }

  // --- PDF (all years, year-aware size floor) ---
  let pdfNote: string;
  if (validPdfFile(p.doi_id, p.year)) {
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
      stopReason = r.stopCode ?? "challenge";
      recordFailure(p, "pdf", r.error ?? "fatal");
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
