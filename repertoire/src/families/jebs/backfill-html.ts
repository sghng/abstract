#!/usr/bin/env bun
/**
 * JEBS HTML backfill (SAGE): full-text HTML for papers with NO "xml" row in
 * the family manifest AND year >= 2007 -- the xml-absent modern stratum.
 *
 * Spike findings (spike-jebs/html-spike.ts + html-spike2.ts, 2026-09-15,
 * warm sage-profile2, institutional IP): SAGE renders full text inline on
 * the landing page /doi/<doi> from 2007 on (2026 control: sec=26 refs=104;
 * 2007/2015 probes: sec=20-34) and the RAW in-page fetch returns the same
 * structure pre-hydration (374KB raw vs 741KB rendered, identical markers),
 * so in-page fetch is primary; page-nav response body is the fallback.
 * PRE-2007 = NOT VIABLE: 1976/1977/1990/1999/2000/2002/2004/2005/2006 all
 * serve abstract-only shells (sec=0, no body sections, ~2-2.9k words incl.
 * chrome) on both /doi/ and /doi/full/; PDF is the only full text there.
 * Those papers are excluded by the year gate, not fetched.
 *
 * Validation (spike markers, script-stripped): bytes > 40KB AND
 * (<section id="sec-" count >= 3 OR id="bib" count >= 10). role="paragraph"
 * alone is NOT proof: front-matter items (Reviewer Acknowledgments 2025:
 * roleP=165, sec=0, bib=0) inflate it. Shell on both paths = definitive
 * miss (front matter, withdrawn, etc.); 404 both paths = absent.
 *
 * Conventions match jebs/fetch.ts (SAGE challengeState with block-page
 * detection, settle windows, 9s post-clearance hold, warm() to the 2015
 * control) plus the Wiley backfill armor: block page -> clean stop
 * stopped_reason=blocked-page (SAGE: "More than 500 downloads in a
 * session" ~3h block, see OPS-LOG); challenge handoff 5 min x 2 strikes
 * -> stop; AbortController 120s + 140s evaluate race; 4-5s jittered pace;
 * 11.5h cap; resume via manifest replay + valid-on-disk adoption.
 *
 * Outputs: raw-new/<doi_id>.html + manifest row {format:"html"} in the
 * family manifest.jsonl, failures.jsonl, STATUS.json backfill* keys
 * (merged over the completed fetch's keys).
 *
 * Usage: bun repertoire/.cache/bulk/jebs/backfill-html.ts
 *   [--papers <file>] [--out <dir>] [--profile <dir>] [--limit N]
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
const BULK = `${REPD}/.cache/bulk/jebs`;
const PAPERS_FILE = argOf("--papers") ?? `${BULK}/papers.jsonl`;
const OUT_DIR = argOf("--out"); // smoke mode: state + raw-new under this dir
const STATE = OUT_DIR ?? BULK;
const RAW = OUT_DIR ? `${OUT_DIR}/raw-new` : `${REPD}/raw-new`;
const PROFILE = argOf("--profile") ?? `${REPD}/.cache/spike-jebs/sage-profile2`;
const BASE = "https://journals.sagepub.com";
const CONTROL = "10.3102/1076998614548485"; // 2015 known-good (fetch.ts control)
const JOURNAL = "jebs";

// spike-proven: full-text HTML exists from 2007 on; below it SAGE serves
// abstract-only shells (see header). Year gate skips the dead strata.
const HTML_FROM_YEAR = 2007;

const HTML_FLOOR = 40_960;
const HARD_CAP_MS = 11.5 * 3600_000;
const START = Date.now();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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

const eligible = papers.filter(
  (p) => !realXml.has(p.doi_id) && !realHtml.has(p.doi_id) && p.year >= HTML_FROM_YEAR,
);
const skippedPre2007 = papers.filter((p) => !realXml.has(p.doi_id) && !realHtml.has(p.doi_id) && p.year < HTML_FROM_YEAR).length;
const targets = eligible.filter((p) => !manifestKeys.has(`${p.doi_id}|html`));
if (LIMIT > 0) targets.splice(LIMIT);

let done = 0;
let htmlSaved = 0;
let lastDoi = "";
let stopReason: string | null = null;

function writeStatus(phase: string) {
  // merge over the completed fetch's STATUS keys; never lose that summary
  let base: any = {};
  try {
    base = JSON.parse(fs.readFileSync(`${BULK}/STATUS.json`, "utf8"));
  } catch {}
  fs.writeFileSync(
    `${STATE}/STATUS.json`,
    JSON.stringify(
      {
        ...base,
        journal: JOURNAL,
        phase,
        backfillTotal: targets.length,
        backfillDone: done,
        backfillRemaining: targets.length - done,
        backfillHtmlSaved: htmlSaved,
        backfillFailures: failTotal,
        backfillLast: lastDoi,
        ...(stopReason ? { stopped_reason: stopReason } : {}),
        backfillUpdatedAt: nowIso(),
        elapsed_min: Math.round((Date.now() - START) / 60000),
        updated_at: nowIso(),
      },
      null,
      2,
    ),
  );
}

function appendLine(f: string, obj: any) {
  fs.appendFileSync(f, JSON.stringify(obj) + "\n");
}

/** Structural validation per spike markers; script bodies stripped first. */
function htmlStats(body: Buffer): { bytes: number; sections: number; refs: number; paras: number } {
  const s = body.toString("latin1").replace(/<script[\s\S]*?<\/script>/g, "");
  return {
    bytes: body.length,
    sections: (s.match(/<section id="sec-/g) ?? []).length,
    refs: (s.match(/id="bib/g) ?? []).length,
    paras: (s.match(/<div role="paragraph"/g) ?? []).length,
  };
}

function validHtml(body: Buffer): boolean {
  if (body.length <= HTML_FLOOR) return false;
  const st = htmlStats(body);
  return st.sections >= 3 || st.refs >= 10;
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
  appendLine(`${STATE}/failures.jsonl`, { doi: p.doi, doi_id: p.doi_id, year: p.year, format: "html", error, at: nowIso() });
}

// ---------- browser ----------

fs.mkdirSync(RAW, { recursive: true });

const LAUNCH = {
  channel: "chrome" as const,
  headless: false,
  args: ["--window-position=500,60", "--disable-blink-features=AutomationControlled"],
};

let ctx = await chromium.launchPersistentContext(PROFILE, LAUNCH);
let page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(90_000);

/** fetch.ts's SAGE-aware state probe: challenge, block page, clear, loading. */
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
    if (last === "clear" || last === "block") return last;
    await sleep(2500);
  }
  return last;
}

/** challenge handoff: 5 min x 2 strikes, then clean stop (owner away). */
let challengeStrikes = 0;
async function handleChallenge(label: string): Promise<"clear" | "block" | "gave-up"> {
  for (let i = 1; i <= 2; i++) {
    console.log(`[human] ACTION NEEDED (${label}, round ${i}/2): solve the challenge in the SAGE window; waiting 5 min`);
    writeStatus("backfill-challenge");
    const st = await settle(5 * 60_000);
    if (st === "clear") {
      challengeStrikes = 0;
      await sleep(9000); // SAGE re-gates if you rush (fetch.ts, proven)
      return "clear";
    }
    if (st === "block") return "block";
  }
  challengeStrikes = 2;
  return "gave-up";
}

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

/** Navigate the working page to the control article; true when clear. */
async function navWorking(label: string): Promise<string> {
  try {
    await page.goto(`${BASE}/doi/${CONTROL}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  } catch (e) {
    console.log(`[nav] goto failed (${label}): ${String(e).slice(0, 90)}`);
  }
  return settle(60_000);
}

// ---------- capture path 1: in-page fetch (spike route; raw HTML carries full text) ----------

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
          const to = setTimeout(() => ac.abort(), 120_000);
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

// ---------- capture path 2: page navigation (response body = raw server HTML) ----------

async function pageNavCapture(url: string, label: string): Promise<FetchResult> {
  try {
    await page.goto(url, { waitUntil: "commit", timeout: 90_000 }).catch(() => {});
    const st = await settle(60_000);
    if (st === "challenge" || st === "block") {
      // handled by caller via classify; body capture still attempted below
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

const CHALLENGE_TEXT = /just a moment|attention required|challenge-platform|cf-chl/i;
const BLOCK_TEXT = /has been blocked|block reason|more than 500 (pdf or )?(full-text )?downloads/i;

type Verdict =
  | "ok"
  | "shell"
  | "notfound"
  | "forbidden"
  | "challenged"
  | "ratelimited"
  | "blockpage"
  | "noresp"
  | "http";

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

// ---------- capture with retries + recovery ----------

let consecutiveFailed = 0;

async function recover(): Promise<boolean> {
  console.log(`[recover] re-warming working page after ${consecutiveFailed} consecutive failed attempts`);
  if (!(await ensureBrowser())) return false;
  let st = await navWorking("recovery");
  if (st === "challenge") {
    const h = await handleChallenge("recovery");
    if (h === "gave-up" || h === "block") return false;
    st = await navWorking("post-clearance");
  }
  if (st === "block") return false;
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

/** One capture pass: in-page fetch primary, page-nav fallback on miss. */
async function tryCapture(p: any, url: string, ref: string): Promise<Outcome> {
  const first = await inPageFetch(url, ref);
  await pace();
  const v1 = classifyHtml(first);
  if (v1 === "ok") return { ok: true, body: first.body, via: "in-page" };
  if (v1 === "blockpage")
    return { fatal: true, stopCode: "blocked-page", error: `block-page:${first.status}` };
  if (v1 === "challenged") {
    const h = await handleChallenge(p.doi);
    if (h === "gave-up") return { fatal: true, stopCode: "challenge", error: "challenge-unresolved" };
    if (h === "block") return { fatal: true, stopCode: "blocked-page", error: "block-page-during-challenge" };
    const retry = await inPageFetch(url, ref);
    await pace();
    const vr = classifyHtml(retry);
    if (vr === "ok") return { ok: true, body: retry.body, via: "in-page-postclear" };
    return { error: `postclear-${vr}:${retry.status ?? ""}` };
  }

  // definitive misses and route refusals -> try page-nav (response body)
  if (v1 === "shell" || v1 === "notfound" || v1 === "forbidden" || v1 === "noresp") {
    const second = await pageNavCapture(url, p.doi);
    await pace();
    const v2 = classifyHtml(second);
    if (v2 === "ok") return { ok: true, body: second.body, via: "page-nav" };
    if (v2 === "blockpage")
      return { fatal: true, stopCode: "blocked-page", error: `block-page:${second.status}` };
    if (v2 === "notfound" && v1 === "notfound") return { absent: true, error: "html-absent:404" };
    // shell on both paths is page content, not a transient error: definitive miss
    if (v2 === "shell" && v1 === "shell") {
      const st = htmlStats(second.body ?? Buffer.alloc(0));
      return { absent: true, error: `html-absent:shell(${second.body?.length ?? 0}B,sec=${st.sections},bib=${st.refs})` };
    }
    return { error: `${v1}->${v2}:${second.status ?? second.error ?? ""}` };
  }
  return { error: `${v1}:${first.status ?? first.error ?? ""}` };
}

async function fetchHtml(p: any): Promise<Outcome> {
  const url = `${BASE}/doi/${p.doi}`;
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
        if (challengeStrikes >= 2) return { fatal: true, stopCode: "challenge", error: "challenge-unresolved" };
        return { fatal: true, stopCode: "blocked-page", error: `blocked:${lastErr}` };
      }
      const r2 = await tryCapture(p, url, ref);
      consecutiveFailed = 0;
      if (r2.ok || r2.absent || r2.fatal) return r2;
      return { error: r2.error ?? "still-failing after recovery" };
    }
  }
  return { error: `retries-exhausted:${lastErr}` };
}

// ---------- warmup ----------

console.log(
  `[start] ${targets.length} html-backfill targets (${papers.length} papers scanned; ` +
    `${skippedPre2007} pre-${HTML_FROM_YEAR} xml-absent SKIPPED: spike-proven abstract-only shells; profile ${PROFILE})`,
);
writeStatus("backfill-running");

if (targets.length) {
  await page.goto(`${BASE}/doi/${CONTROL}`, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => {});
  const st = await settle(10 * 60_000);
  if (st !== "clear") {
    if (st === "block") {
      console.log("STOP: warmup shows SAGE block page (~3h); relaunch after it ends, resume handles the rest");
      stopReason = "blocked-page";
    } else {
      console.log("STOP: warmup challenge unresolved after 10 min; resumable, nothing fetched");
      stopReason = "warmup-challenge";
    }
    writeStatus("backfill-done");
    await ctx.close().catch(() => {});
    process.exit(0);
  }
  await sleep(9000); // SAGE re-gates if you rush (proven)
  console.log("[warmup] clearance ok; working page ready");
}

// ---------- main loop ----------

for (const p of targets) {
  if (stopReason) break;
  if (Date.now() - START > HARD_CAP_MS) {
    stopReason = "time-cap";
    console.log("STOP: 11.5h hard cap approached; resumable");
    break;
  }

  let note: string;
  if (validHtmlFile(p.doi_id)) {
    backfillManifest(p);
    htmlSaved++;
    note = "html=valid(adopted)";
  } else {
    const r = await fetchHtml(p);
    if (r.ok && r.body) {
      const st = htmlStats(r.body);
      saveAtomic(`${p.doi_id}.html`, r.body);
      addManifest(p, `${p.doi_id}.html`, r.body.length, createHash("sha256").update(r.body).digest("hex"));
      htmlSaved++;
      note = `html=ok(${kb(st.bytes)},sec=${st.sections},bib=${st.refs},${r.via})`;
    } else if (r.absent) {
      recordFailure(p, r.error ?? "html-absent");
      note = `html=ABSENT(${(r.error ?? "").slice(0, 36)})`;
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
  if (done % 10 === 0) writeStatus("backfill-running");
}

// ---------- finish ----------

writeStatus("backfill-done");
console.log(
  `BACKFILL DONE done=${done}/${targets.length} html=${htmlSaved} failures=${failTotal}` +
    `${stopReason ? ` stopped=${stopReason}` : ""}`,
);
await ctx.close().catch(() => {});
process.exit(0);
