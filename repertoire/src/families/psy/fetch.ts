#!/usr/bin/env bun
/**
 * psy bulk fetch: PDF for every listed paper (1936-2025), plus whole-page
 * HTML where Cambridge serves full text (2012+ era). Sequential, polite:
 * 1.2-1.5s jittered sleep between EVERY request, 60s timeouts, 3 retries.
 *
 * Writes:
 *   repertoire/raw-new/<doi_id>.pdf | .html   (tmp+rename)
 *   repertoire/.cache/bulk/psy/manifest.jsonl   one line per artifact
 *   repertoire/.cache/bulk/psy/failures.jsonl   one line per failure
 *   repertoire/.cache/bulk/psy/pdf-urls.jsonl   discovered citation_pdf_url
 *   repertoire/.cache/bulk/psy/decided.jsonl    html-absent decisions (resume)
 *   repertoire/.cache/bulk/psy/STATUS.json      every ~25 items
 *   rewrites papers.jsonl (+ papers-psychometrika.json copy) with pdf_url
 *
 * Resumable: skips papers whose artifacts already exist (magic-checked),
 * dedupes manifest lines. No terminal failure state: record and move on.
 * Stops (exit 0): fail rate >30% over last 50, 5 consecutive 429/403, 6h.
 */
import { appendFile, mkdir, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const HERE = new URL("./", import.meta.url).pathname; // .../repertoire/.cache/bulk/psy/
const REPO = `${HERE}../../../`; // repertoire/
const RAW = `${REPO}raw-new/`;
const UA = "Mozilla/5.0 (repertoire corpus builder)";
const HTML_YEAR_MIN = 2012;
const START = Date.now();
const MAX_MS = 6 * 3600_000;

interface PaperRow {
  doi: string;
  doi_id: string;
  title: string;
  year: number;
  journal: string;
  issue_url: string;
  article_url: string;
  pdf_url: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 1200 + Math.random() * 300;
let firstRequest = true;
async function politePause() {
  if (firstRequest) {
    firstRequest = false;
    return;
  }
  await sleep(jitter());
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}

/** fetch text with retries; throws on final failure. Counts bans. */
async function fetchText(url: string): Promise<{ status: number; body: string }> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    await politePause();
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429 || res.status === 403) {
        banCount++;
        if (banCount >= 5) throw new Error(`BAN-STOP consecutive 429/403 reached ${banCount}`);
        console.log(`${res.status} on ${url}; pause 30s (consecutive bans: ${banCount})`);
        await sleep(30_000);
        lastErr = `http ${res.status}`;
        continue;
      }
      if (!res.ok) throw new Error(`http ${res.status}`);
      banCount = 0;
      return { status: res.status, body: await res.text() };
    } catch (e: any) {
      if (String(e.message).startsWith("BAN-STOP")) throw e;
      lastErr = e.message;
      await sleep(5_000 * (attempt + 1));
    }
  }
  throw new Error(`GET ${url} failed after retries: ${lastErr}`);
}

/** fetch binary with retries; validates %PDF magic and >=10KB. */
async function fetchPdf(url: string): Promise<Buffer> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    await politePause();
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429 || res.status === 403) {
        banCount++;
        if (banCount >= 5) throw new Error(`BAN-STOP consecutive 429/403 reached ${banCount}`);
        console.log(`${res.status} on pdf; pause 30s (consecutive bans: ${banCount})`);
        await sleep(30_000);
        lastErr = `http ${res.status}`;
        continue;
      }
      if (!res.ok) throw new Error(`http ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      banCount = 0;
      if (buf.length < 10_000) throw new Error(`pdf too small (${buf.length} B)`);
      if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("not %PDF magic");
      return buf;
    } catch (e: any) {
      if (String(e.message).startsWith("BAN-STOP")) throw e;
      lastErr = e.message;
      // validation failures are deterministic: do not burn retries
      if (/too small|magic/.test(lastErr)) break;
      await sleep(5_000 * (attempt + 1));
    }
  }
  throw new Error(`PDF ${url} failed: ${lastErr}`);
}

/** full-text marker: a div whose class list contains token "body", page >50KB. */
function hasFullText(html: string): boolean {
  if (html.length <= 50_000) return false;
  for (const m of html.matchAll(/<div\b[^>]*\bclass="([^"]*)"/g)) {
    if (m[1].split(/\s+/).includes("body")) return true;
  }
  return false;
}

function sha256(buf: Buffer): string {
  const h = new Bun.CryptoHasher("sha256");
  h.update(buf);
  return h.digest("hex");
}

async function manifestLine(p: PaperRow, format: "pdf" | "html", name: string, buf: Buffer) {
  const key = `${p.doi_id}|${format}`;
  if (manifestKeys.has(key)) return;
  manifestKeys.add(key);
  await appendFile(
    `${HERE}manifest.jsonl`,
    JSON.stringify({
      doi: p.doi,
      doi_id: p.doi_id,
      journal: "psychometrika",
      year: p.year,
      format,
      file: `raw-new/${name}`,
      bytes: buf.length,
      sha256: sha256(buf),
      fetched_at: new Date().toISOString(),
    }) + "\n",
  );
}

async function failureLine(p: PaperRow, stage: string, error: string) {
  await appendFile(`${HERE}failures.jsonl`, JSON.stringify({ doi: p.doi, stage, error: String(error).slice(0, 300), at: new Date().toISOString() }) + "\n");
}

// ---------- state load ----------
let banCount = 0;
const papers: PaperRow[] = (await Bun.file(`${HERE}papers.jsonl`).text())
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));

const manifestKeys = new Set<string>();
if (existsSync(`${HERE}manifest.jsonl`)) {
  for (const l of (await Bun.file(`${HERE}manifest.jsonl`).text()).trim().split("\n")) {
    if (!l) continue;
    try {
      const j = JSON.parse(l);
      manifestKeys.add(`${j.doi_id}|${j.format}`);
    } catch {}
  }
}

const pdfUrlMap = new Map<string, string>();
if (existsSync(`${HERE}pdf-urls.jsonl`)) {
  for (const l of (await Bun.file(`${HERE}pdf-urls.jsonl`).text()).trim().split("\n")) {
    if (!l) continue;
    try {
      const j = JSON.parse(l);
      if (j.pdf_url) pdfUrlMap.set(j.doi, j.pdf_url);
    } catch {}
  }
}

const decidedHtml = new Map<string, boolean>();
if (existsSync(`${HERE}decided.jsonl`)) {
  for (const l of (await Bun.file(`${HERE}decided.jsonl`).text()).trim().split("\n")) {
    if (!l) continue;
    try {
      const j = JSON.parse(l);
      decidedHtml.set(j.doi, j.html);
    } catch {}
  }
}

await mkdir(RAW, { recursive: true });
const rawFiles = new Set(await readdir(RAW));
async function validPdfPresent(doiId: string): Promise<boolean> {
  const name = `${doiId}.pdf`;
  if (!rawFiles.has(name)) return false;
  const buf = Buffer.from(await Bun.file(`${RAW}${name}`).slice(0, 5).arrayBuffer());
  return buf.toString("latin1") === "%PDF-";
}

// backfill manifest lines for artifacts on disk lacking one (crash between
// rename and append); drop stale tmp files
{
  const rowByDoiId = new Map(papers.map((p) => [p.doi_id, p]));
  for (const name of [...rawFiles]) {
    if (name.startsWith(".tmp-")) {
      await unlink(`${RAW}${name}`).catch(() => {});
      rawFiles.delete(name);
      continue;
    }
    const m = name.match(/^(.+)\.(pdf|html)$/);
    if (!m) continue;
    const key = `${m[1]}|${m[2]}`;
    if (manifestKeys.has(key)) continue;
    const row = rowByDoiId.get(m[1]);
    if (!row) continue;
    const buf = Buffer.from(await Bun.file(`${RAW}${name}`).arrayBuffer());
    let mtime = new Date();
    try {
      mtime = (await stat(`${RAW}${name}`)).mtime;
    } catch {}
    manifestKeys.add(key);
    await appendFile(
      `${HERE}manifest.jsonl`,
      JSON.stringify({
        doi: row.doi,
        doi_id: row.doi_id,
        journal: "psychometrika",
        year: row.year,
        format: m[2],
        file: `raw-new/${name}`,
        bytes: buf.length,
        sha256: sha256(buf),
        fetched_at: mtime.toISOString(),
      }) + "\n",
    );
  }
}

// ---------- counters ----------
let excluded = 0;
if (existsSync(`${HERE}STATUS.json`)) {
  try {
    excluded = JSON.parse(await Bun.file(`${HERE}STATUS.json`).text()).excluded ?? 0;
  } catch {}
}
let pdfSaved = 0;
let htmlSaved = 0;
let htmlAbsent = 0;
let skippedDone = 0;
let failures = 0;
const outcomes: boolean[] = []; // this run, per paper attempted
let lastDoi = "";
let stopped = "";

async function rewritePapers() {
  const rows = papers.map((r) => ({ ...r, pdf_url: pdfUrlMap.get(r.doi) ?? r.pdf_url ?? null }));
  await writeFile(`${HERE}papers.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  await writeFile(`${HERE}../../papers-psychometrika.json`, JSON.stringify(rows, null, 2));
}

async function writeStatus(phase: string) {
  const done = papers.filter((p) => rawFiles.has(`${p.doi_id}.pdf`)).length;
  const recent = outcomes.slice(-50);
  const failRate = recent.length ? recent.filter((o) => !o).length / recent.length : 0;
  await writeFile(
    `${HERE}STATUS.json`,
    JSON.stringify(
      {
        phase,
        done,
        total: papers.length,
        last: lastDoi,
        fail_rate: Number(failRate.toFixed(3)),
        excluded,
        pdf_saved: pdfSaved,
        html_saved: htmlSaved,
        html_absent: htmlAbsent,
        skipped_done: skippedDone,
        failures,
        stopped_reason: stopped || null,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

async function saveBuffer(name: string, buf: Buffer) {
  const tmp = `${RAW}.tmp-${name}`;
  await writeFile(tmp, buf);
  await rename(tmp, `${RAW}${name}`);
  rawFiles.add(name);
}

// ---------- main loop ----------
console.log(`papers: ${papers.length}; manifest keys: ${manifestKeys.size}; pdf-urls known: ${pdfUrlMap.size}`);
let processed = 0;
stopLoop: for (const p of papers) {
  if (Date.now() - START > MAX_MS) {
    stopped = "6h elapsed";
    break;
  }
  lastDoi = p.doi;
  processed++;

  const pdfOk = await validPdfPresent(p.doi_id);
  const htmlName = `${p.doi_id}.html`;
  const htmlOk = rawFiles.has(htmlName);
  const needHtml = p.year >= HTML_YEAR_MIN && !htmlOk && decidedHtml.get(p.doi) !== false;

  if (pdfOk && !needHtml) {
    skippedDone++;
    if (processed % 25 === 0) await checkpoint("fetch");
    continue;
  }

  let paperFailed = false;
  let landing = "";
  try {
    const r = await fetchText(p.article_url);
    landing = r.body;
    if (/Just a moment/i.test(landing.slice(0, 4000))) throw new Error("challenge page");
    if (landing.length < 5_000) throw new Error(`suspect landing (${landing.length} B)`);
  } catch (e: any) {
    if (String(e.message).startsWith("BAN-STOP")) {
      stopped = "5 consecutive 429/403";
      await failureLine(p, "landing", e.message);
      failures++;
      outcomes.push(false);
      break stopLoop;
    }
    await failureLine(p, "landing", e.message);
    failures++;
    paperFailed = true;
  }

  if (landing) {
    // record pdf url
    const m = landing.match(/<meta\s+name="citation_pdf_url"\s+content="([^"]+)"/i);
    const pdfUrl = m ? decodeEntities(m[1]) : null;
    if (pdfUrl) {
      if (pdfUrlMap.get(p.doi) !== pdfUrl) {
        pdfUrlMap.set(p.doi, pdfUrl);
        await appendFile(`${HERE}pdf-urls.jsonl`, JSON.stringify({ doi: p.doi, pdf_url: pdfUrl }) + "\n");
      }
    }

    // html full text (2012+): save the whole landing document
    if (needHtml) {
      if (hasFullText(landing)) {
        try {
          const htmlBuf = Buffer.from(landing, "utf8");
          await saveBuffer(htmlName, htmlBuf);
          await manifestLine(p, "html", htmlName, htmlBuf);
          htmlSaved++;
        } catch (e: any) {
          await failureLine(p, "html", e.message);
          failures++;
          paperFailed = true;
        }
      } else {
        htmlAbsent++;
        if (!decidedHtml.has(p.doi)) {
          decidedHtml.set(p.doi, false);
          await appendFile(`${HERE}decided.jsonl`, JSON.stringify({ doi: p.doi, html: false }) + "\n");
        }
      }
    }

    // pdf
    if (!pdfOk) {
      const url = pdfUrl ?? pdfUrlMap.get(p.doi) ?? null;
      if (!url) {
        await failureLine(p, "pdf-url", "citation_pdf_url not found on landing");
        failures++;
        paperFailed = true;
      } else {
        const abs = url.startsWith("http") ? url : `https://www.cambridge.org${url}`;
        try {
          const buf = await fetchPdf(abs);
          await saveBuffer(`${p.doi_id}.pdf`, buf);
          await manifestLine(p, "pdf", `${p.doi_id}.pdf`, buf);
          pdfSaved++;
        } catch (e: any) {
          if (String(e.message).startsWith("BAN-STOP")) {
            stopped = "5 consecutive 429/403";
            await failureLine(p, "pdf", e.message);
            failures++;
            outcomes.push(false);
            break stopLoop;
          }
          await failureLine(p, "pdf", e.message);
          failures++;
          paperFailed = true;
        }
      }
    }
  }

  outcomes.push(!paperFailed);

  // stop: fail rate >30% over last 50
  const recent = outcomes.slice(-50);
  if (recent.length >= 50 && recent.filter((o) => !o).length / recent.length > 0.3) {
    stopped = "fail rate >30% over last 50";
    break;
  }

  if (processed % 25 === 0) await checkpoint("fetch");
}

await checkpoint(stopped ? "fetch-stopped" : "fetch-done");
console.log(`done. processed ${processed}/${papers.length}; pdf +${pdfSaved}; html +${htmlSaved}; failures ${failures}${stopped ? `; stopped: ${stopped}` : ""}`);
process.exit(0);

async function checkpoint(phase: string) {
  await rewritePapers();
  await writeStatus(phase);
  const recent = outcomes.slice(-50);
  console.log(
    `[${phase}] processed ${processed}/${papers.length} pdf +${pdfSaved} html +${htmlSaved} absent ${htmlAbsent} skip ${skippedDone} fail ${failures} rate ${recent.length ? (recent.filter((o) => !o).length / recent.length).toFixed(2) : "0"}`,
  );
}
