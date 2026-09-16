#!/usr/bin/env bun
/**
 * BJMSP HTML backfill: full-text HTML for papers with NO "xml" row in the
 * family manifest (hedge for absent/failed JATS; primary full-text source
 * for pre-2005 eras). EPUB is deliberately skipped: derivative of the same
 * full text, no incremental value over html+xml+pdf.
 *
 * Targets: papers.jsonl rows lacking doi_id|xml in BULK/manifest.jsonl
 * (manifest is truth; failures.jsonl ignored), minus rows already having
 * doi_id|html (resume). Computed at start, so this can run right after the
 * main fetch finishes.
 *
 * Capture routes (spike-bjmsp, 2026-09-15; exact spike code paths):
 *   - year >= 2000: in-page fetch of /doi/full/<doi> (2008 spike: ok,
 *     ~1.1MB). Falls back to page-nav on 403/404/no-response/shell.
 *   - year < 2000: page navigation (goto, challenge handling, second goto,
 *     response body capture) -- spike route for 1999/1985/1965 (~120KB).
 *     Falls back to in-page fetch on nav failure.
 *
 * Validation is structural, not size-alone (spike findings): bytes > 40KB
 * AND (count of "article-section" markers > 4 OR a references block in the
 * first 400KB). Spike shells/interstitials score 0 sections at 48KB, so the
 * floor alone would admit them; the markers reject.
 *
 * Conventions match fetch.ts (this dir): block-page text -> clean stop
 * stopped_reason=blocked-page; challenge -> human handoff, 5 min waits,
 * two unresolved strikes -> stop; in-page fetch AbortController 120s with
 * 140s evaluate race (a stalled connection cannot wedge the run); 4-5s
 * jittered pace after every attempt; resume via manifest replay plus
 * valid-on-disk manifest adoption; 11.5h hard cap.
 *
 * Outputs: raw-new/<doi_id>.html + manifest row {format:"html"} (family
 * manifest.jsonl), failures.jsonl, STATUS.json backfill keys every 25.
 *
 * Usage: bun repertoire/.cache/bulk/bjmsp/backfill-html.ts
 *   [--papers <file>] [--out <dir>] [--profile <dir>] [--limit N]
 *   (smoke: alternate papers/outputs/profile so real state stays clean;
 *   target selection always reads the real family manifest)
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import { createHash } from "node:crypto";

const argv = process.argv.slice(2);
const argOf = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const LIMIT = Number(argOf("--limit") ?? 0) || 0;

const REPO = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
const REPD = `${REPO}/repertoire`;
const BULK = `${REPD}/.cache/bulk/bjmsp`;
const PAPERS_FILE = argOf("--papers") ?? `${BULK}/papers.jsonl`;
const OUT_DIR = argOf("--out"); // smoke mode: state + raw-new under this dir
const STATE = OUT_DIR ?? BULK;
const RAW = OUT_DIR ? `${OUT_DIR}/raw-new` : `${REPD}/raw-new`;
const PROFILE = argOf("--profile") ?? `${REPD}/.cache/cf-profile-bjmsp`;
const BASE = "https://bpspsychub.onlinelibrary.wiley.com";
const WARMUP = "10.1111/bmsp.70065"; // 2025 spike control on this zone
const JOURNAL = "bjmsp";

// era routing: in-page fetch first from this year on; page-nav first below
// (spike: 1999 in-page err -> page-nav ok; 2008 in-page ok)
const INPAGE_FROM_YEAR = 2000;

const HTML_FLOOR = 40_960; // >40KB sanity floor; structural markers decide
const BLOCK_TEXT = /has been blocked|block reason/i;
const CHALLENGE_TEXT = /just a moment|attention required/i;

const HARD_CAP_MS = 11.5 * 3600_000;
const START = Date.now();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const doiId = (doi: string) => doi.toLowerCase().replace(/\//g, ":");
const nowIso = () => new Date().toISOString();
const pace = () => sleep(4000 + Math.random() * 1000);
const kb = (n: number) => `${(n / 1024).toFixed(0)}KB`;

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
if (!papers.length) throw new Error(`papers file empty (${PAPERS_FILE})`);

// target truth is ALWAYS the real family manifest, even in smoke mode
const realManifest = readJsonl(`${BULK}/manifest.jsonl`);
const realXml = new Set(realManifest.filter((m) => m.format === "xml").map((m) => m.doi_id));
const realHtml = new Set(realManifest.filter((m) => m.format === "html").map((m) => m.doi_id));

const manifestKeys = new Set<string>();
for (const m of readJsonl(`${STATE}/manifest.jsonl`)) manifestKeys.add(`${m.doi_id}|${m.format}`);
let failTotal = readJsonl(`${STATE}/failures.jsonl`).length;

const targets = papers.filter(
  (p) => !realXml.has(p.doi_id) && !realHtml.has(p.doi_id) && !manifestKeys.has(`${p.doi_id}|html`),
);
if (LIMIT > 0) targets.splice(LIMIT);

let done = 0;
let htmlSaved = 0;
let lastDoi = "";
let stopReason: string | null = null;

function writeStatus(phase: string) {
  fs.writeFileSync(
    `${STATE}/STATUS.json`,
    JSON.stringify(
      {
        phase,
        backfillTotal: targets.length,
        backfillDone: done,
        backfillRemaining: targets.length - done,
        backfillHtmlSaved: htmlSaved,
        backfillFailures: failTotal,
        backfillLast: lastDoi,
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

/** Structural validation per spike findings; floor is sanity, not proof. */
function htmlStats(body: Buffer): { bytes: number; sections: number; refs: boolean } {
  const s = body.toString("latin1");
  return {
    bytes: body.length,
    sections: (s.match(/article-section/g) ?? []).length,
    refs: /id="bib\d|"reference-list"|References<\/h[23]/i.test(s.slice(0, 400_000)),
  };
}

function validHtml(body: Buffer): boolean {
  if (body.length <= HTML_FLOOR) return false;
  const st = htmlStats(body);
  return st.sections > 4 || st.refs;
}

function validHtmlFile(id: string): boolean {
  try {
    return validHtml(fs.readFileSync(`${RAW}/${id}.html`));
  } catch {
    return false;
  }
}

function saveAtomic(name: string, body: Buffer) {
  const tmp = `${RAW}/.${name}.tmp`;
  fs.writeFileSync(tmp, body);
  fs.renameSync(tmp, `${RAW}/${name}`);
}

function addManifest(p: any, name: string, bytes: number, sha: string) {
  const key = `${p.doi_id}|html`;
  if (manifestKeys.has(key)) return;
  manifestKeys.add(key);
  appendLine(`${STATE}/manifest.jsonl`, {
    doi: p.doi,
    doi_id: p.doi_id,
    journal: JOURNAL,
    year: p.year,
    format: "html",
    file: `raw-new/${name}`,
    bytes,
    sha256: sha,
    fetched_at: nowIso(),
  });
}

/** adopt a valid html already on disk (resume after a crash mid-save) */
function backfillManifest(p: any) {
  const name = `${p.doi_id}.html`;
  if (manifestKeys.has(`${p.doi_id}|html`)) return;
  try {
    const body = fs.readFileSync(`${RAW}/${name}`);
    if (validHtml(body))
      addManifest(p, name, body.length, createHash("sha256").update(body).digest("hex"));
  } catch {}
}

function recordFailure(p: any, error: string) {
  failTotal++;
  appendLine(`${STATE}/failures.jsonl`, { doi: p.doi, route: "html", error, at: nowIso() });
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

// ---------- capture path 1: in-page fetch (spike fetchB64 + fetch.ts timeout armor) ----------

interface FetchResult {
  status?: number;
  body?: Buffer;
  head?: string;
  error?: string;
}

async function inPageFetch(url: string, referer: string): Promise<FetchResult> {
  try {
    const res: any = await Promise.race([
      page.evaluate(
        async ([u, ref]: [string, string]) => {
          const ac = new AbortController();
          const to = setTimeout(() => ac.abort(), 120_000); // stalled connections must abort in-page
          try {
            const r = await fetch(u, {
              credentials: "include",
              headers: { referer: ref },
              signal: ac.signal,
            });
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
        },
        [url, referer],
      ),
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

// ---------- capture path 2: page navigation (spike: goto, challenge check, goto + response body) ----------

async function pageNavCapture(url: string, label: string): Promise<FetchResult> {
  try {
    await page.goto(url, { waitUntil: "commit", timeout: 90_000 }).catch(() => {});
    if (await challenged()) {
      const ok = await waitClearance(label, 5 * 60_000);
      if (!ok) {
        challengeStrikes++;
        console.log(`[nav] challenge UNRESOLVED on ${label} (strike ${challengeStrikes}/2)`);
        return { error: "challenge-unresolved" };
      }
      challengeStrikes = 0;
    }
    const resp = await page.goto(url, { waitUntil: "commit", timeout: 90_000 }).catch(() => null);
    const body = Buffer.from(
      (await Promise.race([resp?.body(), sleep(120_000).then(() => null)])) ?? new Uint8Array(),
    );
    return {
      status: resp?.status() ?? 0,
      body,
      head: body.subarray(0, 2048).toString("latin1"),
    };
  } catch (e) {
    return { error: `nav:${String(e).slice(0, 100)}` };
  }
}

// ---------- classification ----------

type Verdict =
  | "ok"
  | "shell" // 200 but no article-body/section structure
  | "notfound" // 404
  | "forbidden" // 403 (old-era route on this platform)
  | "challenged" // cf interstitial
  | "ratelimited" // 429
  | "blockpage" // wiley/sage block text: fatal
  | "noresp" // no response / transport error
  | "http"; // other status, retryable

function classifyHtml(r: FetchResult): Verdict {
  if (r.error) return "noresp";
  const { status = 0, body = Buffer.alloc(0), head = "" } = r;
  const headZone = (head + body.subarray(0, 65536).toString("latin1")).slice(0, 65536);
  if (CHALLENGE_TEXT.test(head) || CHALLENGE_TEXT.test(headZone)) return "challenged";
  if (BLOCK_TEXT.test(head) || BLOCK_TEXT.test(headZone)) return "blockpage";
  if (status === 403) return "forbidden";
  if (status === 429) return "ratelimited";
  if (status === 404) return "notfound";
  if (status === 200) return validHtml(body) ? "ok" : "shell";
  if (status === 0) return "noresp";
  return "http";
}

// ---------- capture with retries + recovery (fetch.ts structure) ----------

let consecutiveFailed = 0;

async function recover(): Promise<boolean> {
  console.log(`[recover] re-navigating working page after ${consecutiveFailed} consecutive failed attempts`);
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
  writeStatus("backfill-running");
  return true;
}

interface Outcome {
  body?: Buffer;
  via?: string;
  ok?: boolean;
  absent?: boolean;
  fatal?: boolean;
  stopCode?: string;
  error?: string;
}

/** One capture pass: era-routed primary, cross-fallback on miss. */
async function tryCapture(p: any, url: string, ref: string): Promise<Outcome> {
  const useInPageFirst = p.year >= INPAGE_FROM_YEAR;
  const first = useInPageFirst ? await inPageFetch(url, ref) : await pageNavCapture(url, p.doi);
  await pace();
  const v1 = classifyHtml(first);
  if (v1 === "ok") return { ok: true, body: first.body, via: useInPageFirst ? "in-page" : "page-nav" };
  if (v1 === "blockpage")
    return { fatal: true, stopCode: "blocked-page", error: `block-page:${first.status}` };

  // definitive misses and old-era route refusals -> try the other path (spike fallback)
  if (v1 === "shell" || v1 === "notfound" || v1 === "forbidden" || v1 === "noresp") {
    const second = useInPageFirst ? await pageNavCapture(url, p.doi) : await inPageFetch(url, ref);
    await pace();
    const v2 = classifyHtml(second);
    if (v2 === "ok")
      return { ok: true, body: second.body, via: useInPageFirst ? "page-nav" : "in-page" };
    if (v2 === "blockpage")
      return { fatal: true, stopCode: "blocked-page", error: `block-page:${second.status}` };
    if (v2 === "notfound" && v1 === "notfound") return { absent: true, error: "html-absent:404" };
    // shell on both paths is page content, not a transient error (spike
    // treated shells as verdicts): definitive miss, no retries
    if (v2 === "shell" && v1 === "shell")
      return { absent: true, error: `html-absent:shell(${second.body?.length ?? 0}B,sec=${htmlStats(second.body ?? Buffer.alloc(0)).sections})` };
    return { error: `${v1}->${v2}:${second.status ?? second.error ?? ""}` };
  }
  return { error: `${v1}:${first.status ?? first.error ?? ""}` };
}

async function fetchHtml(p: any): Promise<Outcome> {
  const url = `${BASE}/doi/full/${p.doi}`;
  const ref = `${BASE}/doi/${p.doi}`;
  const retrySleeps = [5000, 10000, 20000];
  let lastErr = "";
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await sleep(retrySleeps[attempt - 1]);
    const r = await tryCapture(p, url, ref);
    if (r.ok || r.absent || r.fatal) {
      consecutiveFailed = 0;
      return r;
    }
    lastErr = r.error ?? "unknown";
    consecutiveFailed++;
    console.log(`  html attempt ${attempt + 1}: ${lastErr} (consecutive-fail ${consecutiveFailed})`);
    if (consecutiveFailed >= 5) {
      const rec = await recover();
      if (!rec) {
        if (challengeStrikes >= 2)
          return { fatal: true, stopCode: "challenge", error: "challenge-unresolved" };
        return { error: `blocked:${lastErr}` };
      }
      const r2 = await tryCapture(p, url, ref);
      consecutiveFailed = 0;
      if (r2.ok || r2.absent || r2.fatal) return r2;
      return { error: r2.error ?? `still-failing after recovery` };
    }
  }
  return { error: `retries-exhausted:${lastErr}` };
}

// ---------- warmup (fetch.ts pattern) ----------

console.log(
  `[start] ${targets.length} html-backfill targets (${papers.length} papers scanned; profile ${PROFILE})`,
);
writeStatus("backfill-running");

if (targets.length) {
  await page.goto(`${BASE}/doi/full/${WARMUP}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  }).catch(() => {});
  if (!(await waitClearance("warmup", 10 * 60_000))) {
    console.log("STOP: warmup challenge unresolved after 10 min; resumable, nothing fetched");
    stopReason = "warmup-challenge";
    writeStatus("backfill-done");
    await ctx.close().catch(() => {});
    process.exit(0);
  }
  await navWorking("warmup-final");
  if (await challenged()) {
    if (!(await waitClearance("warmup-final", 5 * 60_000))) {
      console.log("STOP: warmup-final challenge unresolved; resumable, nothing fetched");
      stopReason = "warmup-challenge";
      writeStatus("backfill-done");
      await ctx.close().catch(() => {});
      process.exit(0);
    }
    await navWorking("warmup-final-2");
  }
  console.log("[warmup] clearance ok; working page ready");
}

// ---------- main loop ----------

for (const p of targets) {
  if (stopReason) break;
  if (Date.now() - START > HARD_CAP_MS) {
    stopReason = "time-cap";
    console.log("STOP: 12h hard cap approached; resumable");
    break;
  }

  let note: string;
  if (validHtmlFile(p.doi_id)) {
    backfillManifest(p);
    htmlSaved++;
    note = "html=valid";
  } else {
    const r = await fetchHtml(p);
    if (r.ok && r.body) {
      const st = htmlStats(r.body);
      saveAtomic(`${p.doi_id}.html`, r.body);
      addManifest(p, `${p.doi_id}.html`, r.body.length, createHash("sha256").update(r.body).digest("hex"));
      htmlSaved++;
      note = `html=ok(${kb(st.bytes)},sec=${st.sections},refs=${st.refs},${r.via})`;
    } else if (r.absent) {
      recordFailure(p, r.error ?? "html-absent");
      note = `html=ABSENT(${(r.error ?? "").slice(0, 30)})`;
    } else if (r.fatal) {
      stopReason = r.stopCode ?? "challenge";
      recordFailure(p, r.error ?? "fatal");
      console.log(`STOP: ${stopReason}`);
      break;
    } else {
      recordFailure(p, r.error ?? "unknown");
      note = `html=FAIL(${(r.error ?? "").slice(0, 40)})`;
    }
  }

  done++;
  lastDoi = p.doi;
  console.log(`[${String(done).padStart(4)}/${targets.length}] ${p.year} ${p.doi} ${note}`);
  if (done % 25 === 0) writeStatus("backfill-running");
}

// ---------- finish ----------

writeStatus("backfill-done");
console.log(
  `BACKFILL DONE done=${done}/${targets.length} html=${htmlSaved} failures=${failTotal}` +
    `${stopReason ? ` stopped=${stopReason}` : ""}`,
);
await ctx.close().catch(() => {});
process.exit(0);
