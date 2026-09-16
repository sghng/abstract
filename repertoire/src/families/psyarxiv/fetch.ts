#!/usr/bin/env bun
// PsyArXiv Quantitative Methods bulk fetcher. Resumable; plain HTTP only.
// Writes ONLY to repertoire/raw-new/ and repertoire/.cache/bulk/psyarxiv/ (this dir).
//
// Phases:
//   inventory  OSF provider listing preferred (subjects embedded in records);
//              Crossref prefix cursor pagination as fallback when listing 502s
//   details    per-guid OSF detail fetches (crossref route), cached in details/
//   downloads  https://osf.io/download/<guid>/ for QM-matched preprints; %PDF magic required
//
// Resume: rerun this script; existing artifacts (details/, candidates, manifest,
// valid raw-new pdfs) are skipped. Stop (exit 0, resumable) when infra fail rate
// >30% over last 50, when OSF+Crossref both hard-fail, or at the 12h cap.

import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync,
  readSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";

const BASE = import.meta.dir;               // repertoire/.cache/bulk/psyarxiv
const REPO = `${BASE}/../../..`;            // repertoire/
const RAW = `${REPO}/raw-new`;
const DET = `${BASE}/details`;

const UA = "abstract-repertoire-bulk/1.0";
const QM_ID = "5b4e7426c6983001430b6c41";  // provider-taxonomy Quantitative Methods node
const CAP_MS = 12 * 3600 * 1000;
const T0 = Date.now();

const F = {
  inventory: `${BASE}/inventory.json`,
  candidates: `${BASE}/candidates.jsonl`,
  listingCursor: `${BASE}/listing-cursor.json`,
  crossrefState: `${BASE}/crossref-state.json`,
  qm: `${BASE}/qm.jsonl`,
  papers: `${BASE}/papers.jsonl`,
  manifest: `${BASE}/manifest.jsonl`,
  failures: `${BASE}/failures.jsonl`,
  status: `${BASE}/STATUS.json`,
  lock: `${BASE}/run.lock`,
};

const TERMINAL_KINDS = new Set([
  "non-pdf-primary", "download-gone", "withdrawn", "unpublished", "detail-gone",
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = () => new Date().toISOString();
const log = (...a: unknown[]) => console.log(iso(), ...a);

// ---------------- io helpers ----------------

function readJsonLines(p: string): any[] {
  if (!existsSync(p)) return [];
  const out: any[] = [];
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* torn tail line from a kill */ }
  }
  return out;
}

function appendJsonl(p: string, obj: unknown): void {
  appendFileSync(p, JSON.stringify(obj) + "\n");
}

function atomicWrite(p: string, data: string | Uint8Array): void {
  const tmp = `${p}.tmp-${process.pid}`;
  writeFileSync(tmp, data as any);
  renameSync(tmp, p);
}

function validPdf(p: string): boolean {
  try {
    const fd = openSync(p, "r");
    const b = Buffer.alloc(5);
    const n = readSync(fd, b, 0, 5, 0);
    closeSync(fd);
    return n === 5 && b.toString("latin1") === "%PDF-" && statSync(p).size > 0;
  } catch { return false; }
}

// doi -> doi_id: 10.31234/osf.io/crkd7 -> 10.31234:osf.io.crkd7
const doiIdOf = (doi: string) =>
  doi.toLowerCase().replace(/^([^/]+)\//, "$1:").replace(/\//g, ".");

function baseGuid(doi: string): string | null {
  const m = /^10\.31234\/osf\.io\/([a-z0-9]+?)(?:_v\d+)?$/i.exec(doi.trim().toLowerCase());
  return m ? m[1] : null;
}

// ---------------- status / stop logic ----------------

let gPhase = "init";
let gCandidates = 0;
let gQm = 0;
let gDone = 0;
let gLast = "";
let gStopped = false;
let consecutiveInfraFails = 0;

class Roll {
  w: boolean[] = [];
  push(ok: boolean) {
    this.w.push(ok);
    if (this.w.length > 50) this.w.shift();
  }
  get full() { return this.w.length >= 50; }
  get rate() { return this.w.length ? this.w.filter((x) => !x).length / this.w.length : 0; }
}
const roll = new Roll();

function writeStatus(extra: Record<string, unknown> = {}): void {
  atomicWrite(F.status, JSON.stringify({
    phase: gPhase,
    candidates: gCandidates,
    qm_matched: gQm,
    done: gDone,
    last: gLast,
    fail_rate: +roll.rate.toFixed(3),
    at: iso(),
    ...extra,
  }, null, 2));
}

function noteInfraFail() {
  consecutiveInfraFails++;
  if (consecutiveInfraFails >= 50) {
    log("50 consecutive infra failures -> circuit breaker stop");
    gStopped = true;
  }
}
function noteOk() { consecutiveInfraFails = 0; }

function shouldStop(): boolean {
  if (gStopped) return true;
  if (Date.now() - T0 > CAP_MS) { log("12h cap reached -> stop"); gStopped = true; return true; }
  if (roll.full && roll.rate > 0.3) {
    log(`fail rate ${(roll.rate * 100).toFixed(0)}% over last ${roll.w.length} -> stop`);
    gStopped = true; return true;
  }
  return false;
}

function fail(kind: string, note: string, obj: Record<string, unknown> = {}): void {
  appendJsonl(F.failures, { at: iso(), phase: gPhase, kind, note, ...obj });
}

// ---------------- fetch plumbing ----------------

interface Res { res: Response; body?: Buffer }

// Retries: initial try + 3 retries (backoff 5s/15s/45s); 429 -> 30s; 5xx/abort/throw retryable.
// 2xx..4xx (non-429) returned as definitive. readBody=true keeps the timeout armed
// through body consumption and returns the buffer.
async function fetchRetry(
  url: string,
  opts: { timeoutMs?: number; retries?: number; readBody?: boolean } = {},
): Promise<Res> {
  const retries = opts.retries ?? 3;
  const timeoutMs = opts.timeoutMs ?? 45_000;
  let delay = 5_000;
  let lastErr = "unknown";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(delay);
    delay = Math.min(delay * 3, 45_000);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA }, redirect: "follow", signal: ac.signal,
      });
      if (res.status === 429) {
        clearTimeout(timer);
        await res.body?.cancel().catch(() => {});
        lastErr = "http-429";
        await sleep(30_000);
        continue;
      }
      if (res.status >= 500) {
        clearTimeout(timer);
        await res.body?.cancel().catch(() => {});
        lastErr = `http-${res.status}`;
        continue;
      }
      if (opts.readBody) {
        const body = Buffer.from(await res.arrayBuffer());
        clearTimeout(timer);
        return { res, body };
      }
      clearTimeout(timer);
      return { res };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e instanceof Error ? `${e.name}:${e.message}`.slice(0, 200) : String(e).slice(0, 200);
    }
  }
  throw new Error(lastErr);
}

async function getJson(url: string, timeoutMs = 45_000): Promise<any> {
  const { res } = await fetchRetry(url, { timeoutMs });
  if (!res.ok) throw new Error(`http-${res.status}`);
  return res.json();
}

// ---------------- QM matching ----------------

function isQM(subjects: any): boolean {
  if (!Array.isArray(subjects)) return false;
  for (const path of subjects) {
    if (!Array.isArray(path)) continue;
    for (const node of path) {
      if (node?.id === QM_ID) return true;
      if (typeof node?.text === "string" && node.text.toLowerCase().includes("quantitative methods")) return true;
    }
  }
  return false;
}

// ---------------- candidate bookkeeping ----------------

const candSet = new Set<string>();
function addCandidate(guid: string, source: string): void {
  if (!guid || candSet.has(guid)) return;
  candSet.add(guid);
  appendJsonl(F.candidates, { guid, source });
}

// ================= PHASE: inventory (OSF listing preferred) =================

async function listingHealthy(maxProbes = 12): Promise<boolean> {
  const urls = [
    "https://api.osf.io/v2/providers/preprints/psyarxiv/preprints/?page[size]=100",
    "https://api.osf.io/v2/preprints/?filter[provider.id]=psyarxiv&page[size]=100",
  ];
  for (let i = 0; i < maxProbes; i++) {
    const url = urls[i % 2];
    try {
      const { res } = await fetchRetry(url, { timeoutMs: 75_000, retries: 0 });
      await res.body?.cancel().catch(() => {});
      if (res.ok) { log(`listing healthy (probe ${i + 1}): ${url}`); return true; }
      log(`listing probe ${i + 1}: http ${res.status}`);
    } catch (e) { log(`listing probe ${i + 1}: ${e instanceof Error ? e.message : e}`); }
    roll.push(false);
    if (i < maxProbes - 1) await sleep(30_000);
  }
  return false;
}

// Returns {subjects: boolean} on success, {early: true} if it died before making
// a real start (caller falls back to Crossref), {partial: true} if it died
// mid-way (run stops, resumable via listing-cursor.json).
async function osfListingInventory(): Promise<{ subjects: boolean } | { early: boolean } | { partial: boolean }> {
  let url: string | null =
    "https://api.osf.io/v2/providers/preprints/psyarxiv/preprints/?page[size]=500";
  let page = 0;
  let subjectsSeen = false;
  let total: number | null = null;

  if (existsSync(F.listingCursor)) {
    try {
      const c = JSON.parse(readFileSync(F.listingCursor, "utf8"));
      if (c.next) { url = c.next; page = c.page ?? 0; subjectsSeen = !!c.subjects; total = c.total ?? null; log(`resuming listing at page ${page}`); }
    } catch { /* ignore corrupt checkpoint */ }
  }

  let pageFailStreak = 0;
  while (url) {
    if (shouldStop()) return { partial: true };
    let j: any;
    try {
      const { res } = await fetchRetry(url, { timeoutMs: 75_000 });
      if (!res.ok) throw new Error(`http-${res.status}`);
      j = await res.json();
      roll.push(true); noteOk();
    } catch (e) {
      roll.push(false); noteInfraFail();
      pageFailStreak++;
      log(`listing page ${page} failed (${e instanceof Error ? e.message : e}) streak=${pageFailStreak}`);
      if (pageFailStreak >= 10 || gStopped) return page < 3 ? { early: true } : { partial: true };
      await sleep(60_000);
      continue; // retry same url (fetchRetry already burned its internal retries)
    }
    pageFailStreak = 0;

    const items: any[] = Array.isArray(j?.data) ? j.data : [];
    total = j?.meta?.pagination?.total ?? total;
    for (const it of items) {
      const guid = String(it?.id ?? "").replace(/_v\d+$/, "");
      if (!guid) continue;
      const attrs = it?.attributes ?? {};
      if (Array.isArray(attrs.subjects)) subjectsSeen = true;
      atomicWrite(`${DET}/${guid}.json`, JSON.stringify({ data: it }));
      addCandidate(guid, "osf-listing");
      if (isQM(attrs.subjects)) gQm++;
      gLast = guid;
    }
    page++;
    url = j?.links?.next ?? null;
    atomicWrite(F.listingCursor, JSON.stringify({ next: url, page, subjects: subjectsSeen, total }));
    writeStatus();
    log(`listing page ${page} done: +${items.length} items (total ${total ?? "?"}, subjects=${subjectsSeen})`);
    await sleep(1100);
  }
  return { subjects: subjectsSeen };
}

// Returns true when the candidate inventory was completed.
async function crossrefInventory(): Promise<boolean> {
  log("inventory via Crossref prefix cursor pagination");
  let useFilter = true;
  try {
    const a = await getJson("https://api.crossref.org/prefixes/10.31234/works?rows=0&filter=from-pub-date:2016-01-01", 30_000);
    const b = await getJson("https://api.crossref.org/prefixes/10.31234/works?rows=0", 30_000);
    const ta = a?.message?.["total-results"], tb = b?.message?.["total-results"];
    log(`crossref totals: from-pub-date=${ta} unfiltered=${tb}`);
    useFilter = typeof ta === "number" && ta === tb; // only trust the filter if it drops nothing
  } catch (e) { useFilter = false; log(`crossref totals probe failed, dropping filter: ${e}`); }

  // select= probe (keeps pages small); drop select on any non-OK.
  let select = "select=DOI,issued,posted,title";
  {
    try {
      const { res } = await fetchRetry(
        `https://api.crossref.org/prefixes/10.31234/works?rows=1&cursor=*&${select}`,
        { timeoutMs: 30_000 },
      );
      await res.body?.cancel().catch(() => {});
      if (!res.ok) { select = ""; log("crossref select= not accepted, dropping"); }
    } catch { select = ""; }
  }

  let state: { cursor: string; best: Record<string, [number, string, string]> } =
    existsSync(F.crossrefState)
      ? JSON.parse(readFileSync(F.crossrefState, "utf8"))
      : { cursor: "*", best: {} };
  if (!state.best) state.best = {};
  let cursor: string = state.cursor || "*";
  if (state.cursor === "") { log("crossref pagination already complete (state)"); }

  let fails = 0;
  let pages = 0;
  while (state.cursor !== "") {
    if (shouldStop()) return false;
    const url =
      `https://api.crossref.org/prefixes/10.31234/works?rows=1000&cursor=${encodeURIComponent(cursor)}` +
      (select ? `&${select}` : "") +
      (useFilter ? "&filter=from-pub-date:2016-01-01" : "");
    let j: any;
    try {
      j = await getJson(url, 60_000);
      roll.push(true); noteOk();
    } catch (e) {
      roll.push(false); noteInfraFail();
      fails++;
      log(`crossref page ${pages} failed (${e instanceof Error ? e.message : e}) fails=${fails}`);
      if (fails >= 10 || gStopped) return false;
      await sleep(30_000);
      continue;
    }
    fails = 0;
    pages++;
    const items: any[] = j?.message?.items ?? [];
    for (const it of items) {
      const doi = String(it?.DOI ?? "").toLowerCase();
      const guid = baseGuid(doi);
      if (!guid) continue;
      const m = /_v(\d+)$/.exec(doi);
      const vn = m ? Number(m[1]) : Number.MAX_SAFE_INTEGER; // unversioned == latest
      const issued = String(it?.issued?.["date-parts"]?.[0]?.[0] ?? it?.posted?.["date-parts"]?.[0]?.[0] ?? "");
      const title = Array.isArray(it?.title) ? String(it.title[0] ?? "") : "";
      const prev = state.best[guid];
      if (!prev || vn > prev[0] || (vn === prev[0] && issued > prev[1])) state.best[guid] = [vn, issued, title];
    }
    const next = j?.message?.["next-cursor"] ?? "";
    cursor = items.length ? next : "";
    state.cursor = items.length ? next : "";
    atomicWrite(F.crossrefState, JSON.stringify(state));
    log(`crossref page ${pages}: +${items.length} rows, uniques so far ${Object.keys(state.best).length}`);
    if (!items.length || !next) break;
    await sleep(1100);
  }

  for (const guid of Object.keys(state.best)) addCandidate(guid, "crossref");
  writeFileSync(F.inventory, JSON.stringify({
    source: "crossref", done: true, count: candSet.size, at: iso(),
  }, null, 2));
  log(`crossref inventory complete: ${candSet.size} unique preprint guids`);
  return true;
}

// ================= PHASE: per-guid details =================

async function detailPhase(): Promise<void> {
  gPhase = "details";
  const uniq = [...new Set(readJsonLines(F.candidates).map((c) => c.guid).filter(Boolean))];
  const todo = uniq.filter((g) => !existsSync(`${DET}/${g}.json`));
  gCandidates = uniq.length;
  log(`details: ${uniq.length} candidates, ${todo.length} to fetch`);
  if (!todo.length) return;

  let i = 0;
  let n = 0;
  let workers = 4;
  const tStart = Date.now();

  const workerBody = async () => {
    while (!shouldStop()) {
      const k = i++;
      if (k >= todo.length) return;
      const guid = todo[k];
      gLast = guid;
      const tReq = Date.now();
      try {
        const { res } = await fetchRetry(`https://api.osf.io/v2/preprints/${guid}/`, { timeoutMs: 45_000 });
        if (res.ok) {
          const text = await res.text();
          atomicWrite(`${DET}/${guid}.json`, text);
          roll.push(true); noteOk();
          try { if (isQM(JSON.parse(text)?.data?.attributes?.subjects)) gQm++; } catch { /* keep file, skip count */ }
        } else {
          await res.body?.cancel().catch(() => {});
          roll.push(true); noteOk(); // definitive answer; not infra
          fail("detail-gone", `http-${res.status}`, { guid });
        }
      } catch (e) {
        roll.push(false); noteInfraFail();
        fail("detail-fetch", e instanceof Error ? e.message : String(e), { guid });
      }
      n++;
      if (n % 25 === 0) writeStatus();
      const elapsed = Date.now() - tReq;
      if (elapsed < 1000) await sleep(1000 - elapsed); // <= 1 req/s per worker
    }
  };

  const running: Promise<void>[] = Array.from({ length: workers }, () => workerBody());
  // Adaptive concurrency: modest target (the API throttles per-IP since ~18:00 today),
  // cap 6 workers, only while healthy. 429 churn self-limits via fetchRetry sleeps.
  const supervisor = (async () => {
    while (!gStopped) {
      await sleep(60_000);
      if (gStopped || i >= todo.length) break;
      const rate = n / ((Date.now() - tStart) / 1000);
      if (rate < 1.5 && workers < 6 && consecutiveInfraFails === 0) {
        workers += 2;
        running.push(workerBody(), workerBody());
        log(`details throughput ${rate.toFixed(2)}/s -> raised to ${workers} workers`);
      }
    }
  })();
  await Promise.all([...running, supervisor]);
}

// ================= PHASE: downloads =================

interface QmRow {
  guid: string; doi: string; doi_id: string; title: string; year: number | null;
  is_published: boolean; withdrawn: boolean;
}

function collectQm(): QmRow[] {
  const rows: QmRow[] = [];
  for (const f of readdirSync(DET)) {
    if (!f.endsWith(".json")) continue;
    let j: any;
    try { j = JSON.parse(readFileSync(`${DET}/${f}`, "utf8")); } catch { continue; }
    const a = j?.data?.attributes ?? {};
    if (!isQM(a.subjects)) continue;
    const guid = String(j?.data?.id ?? f.replace(/\.json$/, "")).replace(/_v\d+$/, "");
    // preprint_doi is sometimes version-locked (_vN); we download the base guid
    // (latest version), so normalize the DOI to the base form for doi_id/files.
    const doiRaw = String(j?.data?.links?.preprint_doi ?? `https://doi.org/10.31234/osf.io/${guid}`);
    const doi = doiRaw.replace(/^https?:\/\/doi\.org\//i, "").toLowerCase().replace(/_v\d+$/, "");
    rows.push({
      guid,
      doi,
      doi_id: doiIdOf(doi),
      title: typeof a.title === "string" ? a.title : "",
      year: Number(String(a.date_published ?? a.date_created ?? "").slice(0, 4)) || null,
      is_published: a.is_published !== false,
      withdrawn: !!a.date_withdrawn,
    });
  }
  rows.sort((x, y) => (x.guid < y.guid ? -1 : 1));
  return rows;
}

async function downloadPhase(): Promise<void> {
  gPhase = "downloads";
  // drop stale tmp files from a killed run
  for (const f of readdirSync(RAW)) if (f.startsWith(".tmp-")) { try { unlinkSync(`${RAW}/${f}`); } catch { /* ok */ } }

  const qm = collectQm();
  atomicWrite(F.qm, qm.map((q) => JSON.stringify(q)).join("\n") + (qm.length ? "\n" : ""));
  gQm = qm.length;
  log(`downloads: ${qm.length} QM-matched preprints`);

  const manifestIds = new Set(readJsonLines(F.manifest).map((r) => r.doi_id).filter(Boolean));
  const paperIds = new Set(readJsonLines(F.papers).map((r) => r.doi_id).filter(Boolean));
  const terminal = new Set<string>();
  for (const r of readJsonLines(F.failures)) {
    if (TERMINAL_KINDS.has(r.kind) && r.doi_id) terminal.add(r.doi_id);
  }
  gDone = manifestIds.size;

  let i = 0;
  let n = 0;
  const worker = async () => {
    while (!shouldStop()) {
      const k = i++;
      if (k >= qm.length) return;
      n++;
      const q = qm[k];
      gLast = q.guid;
      try {
        if (manifestIds.has(q.doi_id)) continue;
        const fp = `${RAW}/${q.doi_id}.pdf`;
        if (existsSync(fp) && validPdf(fp)) {
          // file survived but manifest row lost (killed between rename and append)
          const buf = readFileSync(fp);
          appendJsonl(F.manifest, {
            doi: q.doi, doi_id: q.doi_id, journal: "psyarxiv", year: q.year, format: "pdf",
            file: `raw-new/${q.doi_id}.pdf`, bytes: buf.length,
            sha256: createHash("sha256").update(buf).digest("hex"), fetched_at: iso(),
          });
          if (!paperIds.has(q.doi_id)) {
            appendJsonl(F.papers, {
              doi: q.doi, doi_id: q.doi_id, title: q.title, year: q.year, journal: "psyarxiv",
              article_url: `https://psyarxiv.com/${q.guid}/`, pdf_url: `https://osf.io/download/${q.guid}/`,
            });
            paperIds.add(q.doi_id);
          }
          manifestIds.add(q.doi_id); gDone = manifestIds.size;
          continue;
        }
        if (terminal.has(q.doi_id)) continue;
        if (q.withdrawn) {
          terminal.add(q.doi_id);
          fail("withdrawn", "date_withdrawn set", { guid: q.guid, doi: q.doi, doi_id: q.doi_id, title: q.title, year: q.year });
          continue;
        }
        if (!q.is_published) {
          terminal.add(q.doi_id);
          fail("unpublished", "is_published false", { guid: q.guid, doi: q.doi, doi_id: q.doi_id, title: q.title, year: q.year });
          continue;
        }

        const { res, body } = await fetchRetry(`https://osf.io/download/${q.guid}/`, { timeoutMs: 60_000, readBody: true });
        if (!res.ok) {
          let cf = false;
          if (res.status === 403) {
            const sniff = body.subarray(0, 2048).toString("latin1");
            cf = /challenge-platform|just a moment|cf-browser-verification/i.test(sniff);
          }
          if (cf) {
            roll.push(false); noteInfraFail();
            fail("cf-challenge", "cloudflare interstitial on download", { guid: q.guid, doi_id: q.doi_id });
          } else {
            roll.push(true); noteOk();
            terminal.add(q.doi_id);
            fail("download-gone", `http-${res.status}`, { guid: q.guid, doi: q.doi, doi_id: q.doi_id, title: q.title, year: q.year });
          }
          continue;
        }
        const magic = body.subarray(0, 5).toString("latin1");
        if (magic !== "%PDF-") {
          roll.push(true); noteOk();
          terminal.add(q.doi_id);
          fail("non-pdf-primary", `magic=${JSON.stringify(body.subarray(0, 16).toString("latin1"))} ct=${res.headers.get("content-type") ?? ""}`, {
            guid: q.guid, doi: q.doi, doi_id: q.doi_id, title: q.title, year: q.year, bytes: body.length,
          });
          continue;
        }
        const tmp = `${RAW}/.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
        writeFileSync(tmp, body);
        renameSync(tmp, fp);
        appendJsonl(F.manifest, {
          doi: q.doi, doi_id: q.doi_id, journal: "psyarxiv", year: q.year, format: "pdf",
          file: `raw-new/${q.doi_id}.pdf`, bytes: body.length,
          sha256: createHash("sha256").update(body).digest("hex"), fetched_at: iso(),
        });
        appendJsonl(F.papers, {
          doi: q.doi, doi_id: q.doi_id, title: q.title, year: q.year, journal: "psyarxiv",
          article_url: `https://psyarxiv.com/${q.guid}/`, pdf_url: `https://osf.io/download/${q.guid}/`,
        });
        manifestIds.add(q.doi_id); paperIds.add(q.doi_id);
        gDone = manifestIds.size;
        roll.push(true); noteOk();
      } catch (e) {
        roll.push(false); noteInfraFail();
        fail("download-fetch", e instanceof Error ? e.message : String(e), { guid: q.guid, doi: q.doi, doi_id: q.doi_id });
      }
      if (n % 25 === 0) writeStatus();
      await sleep(1100); // 3 workers -> <= ~1.5-2 dl/s
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  writeStatus();
}

// ================= probe mode (--probe, no writes) =================

async function probe(): Promise<void> {
  log("PROBE listing...");
  try {
    const { res } = await fetchRetry(
      "https://api.osf.io/v2/providers/preprints/psyarxiv/preprints/?page[size]=2",
      { timeoutMs: 75_000, retries: 1 },
    );
    const j = res.ok ? await res.json() : null;
    log(`  listing: http ${res.status}${j ? ` items=${j.data?.length} total=${j.meta?.pagination?.total}` : ""}`);
  } catch (e) { log(`  listing: FAIL ${e instanceof Error ? e.message : e}`); }
  log("PROBE crossref...");
  try {
    const j = await getJson("https://api.crossref.org/prefixes/10.31234/works?rows=1", 30_000);
    log(`  crossref: total=${j?.message?.["total-results"]}`);
  } catch (e) { log(`  crossref: FAIL ${e instanceof Error ? e.message : e}`); }
  log("PROBE detail (crkd7)...");
  try {
    const j = await getJson("https://api.osf.io/v2/preprints/crkd7/", 45_000);
    log(`  detail: subjects=${JSON.stringify(j?.data?.attributes?.subjects?.[1] ?? [])}`);
  } catch (e) { log(`  detail: FAIL ${e instanceof Error ? e.message : e}`); }
  log("PROBE download (crkd7, discarded)...");
  try {
    const { res, body } = await fetchRetry("https://osf.io/download/crkd7/", { timeoutMs: 60_000, readBody: true, retries: 1 });
    log(`  download: http ${res.status} magic=${JSON.stringify(body.subarray(0, 5).toString("latin1"))} bytes=${body.length}`);
  } catch (e) { log(`  download: FAIL ${e instanceof Error ? e.message : e}`); }
}

// ================= main =================

function summaryLine(): string {
  const qmCount = existsSync(F.qm) ? readJsonLines(F.qm).length : gQm;
  const manifestCount = readJsonLines(F.manifest).length;
  const fails = readJsonLines(F.failures);
  const nonPdf = fails.filter((f) => f.kind === "non-pdf-primary").length;
  const terminalIds = new Set(fails.filter((f) => TERMINAL_KINDS.has(f.kind) && f.doi_id).map((f) => f.doi_id));
  const manifestIds = new Set(readJsonLines(F.manifest).map((r) => r.doi_id));
  let settled = 0;
  for (const id of terminalIds) if (manifestIds.has(id)) settled++; // terminal-after-success, rare
  const remaining = Math.max(0, qmCount - new Set([...manifestIds, ...terminalIds]).size);
  return [
    `SUMMARY candidates=${gCandidates || candSet.size} qm_matched=${qmCount} pdf_saved=${manifestCount}`,
    `non_pdf_skipped=${nonPdf} failures=${fails.length} remaining=${remaining}`,
  ].join(" ");
}

async function main(): Promise<void> {
  mkdirSync(DET, { recursive: true });
  mkdirSync(RAW, { recursive: true });

  if (process.argv.includes("--probe")) { await probe(); return; }

  if (existsSync(F.lock)) {
    const pid = Number(readFileSync(F.lock, "utf8").trim());
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch (e: any) { alive = e?.code === "EPERM"; }
    if (alive && pid !== process.pid) {
      console.error(`another fetch.ts is running (pid ${pid}); refusing to start`);
      process.exit(1);
    }
  }
  writeFileSync(F.lock, String(process.pid));
  process.on("SIGTERM", () => { writeStatus({ note: "sigterm" }); try { unlinkSync(F.lock); } catch { /* ok */ } process.exit(0); });

  for (const c of readJsonLines(F.candidates)) if (c.guid) candSet.add(c.guid);
  gCandidates = candSet.size;

  let inv: any = existsSync(F.inventory) ? JSON.parse(readFileSync(F.inventory, "utf8")) : null;

  // --listing-fill: inventory may already be complete (crossref), but details are
  // expensive per-request; if the provider listing has recovered, one pass fills
  // details/ for the whole corpus at ~1 request per 500 preprints.
  if (process.argv.includes("--listing-fill") && inv?.done && !(inv.details_via_listing)) {
    gPhase = "inventory";
    writeStatus({ note: "listing-fill attempt" });
    log("listing-fill: probing provider listing");
    if (await listingHealthy(3)) {
      const r = await osfListingInventory();
      if ("subjects" in r) {
        inv = {
          source: inv.source ?? "crossref", details_via_listing: true, subjects: r.subjects,
          done: true, count: candSet.size, at: iso(),
        };
        atomicWrite(F.inventory, JSON.stringify(inv, null, 2));
        log("listing-fill: complete");
      } else {
        log("listing-fill: listing still unreliable, continuing without it");
      }
    } else {
      log("listing-fill: listing still down");
    }
  }

  if (!inv?.done || candSet.size === 0) {
    gPhase = "inventory";
    writeStatus();
    let have = false;
    if (await listingHealthy()) {
      const r = await osfListingInventory();
      if ("subjects" in r) {
        inv = { source: "osf-listing", subjects: r.subjects, done: true, count: candSet.size, at: iso() };
        atomicWrite(F.inventory, JSON.stringify(inv, null, 2));
        have = true;
      } else if ("partial" in r) {
        log("listing pagination died mid-way; resumable via listing-cursor.json");
      } else {
        log("listing died early; falling back to Crossref");
      }
    } else {
      log("listing unhealthy after >10 min of probes; falling back to Crossref");
    }
    if (!have) {
      if (await crossrefInventory()) {
        inv = JSON.parse(readFileSync(F.inventory, "utf8"));
      } else {
        log("OSF listing AND Crossref both failing -> stop (resumable)");
        writeStatus({ note: "inventory: both sources down" });
        log(summaryLine());
        process.exit(0);
      }
    }
    writeStatus();
  }
  log(`inventory: source=${inv.source} candidates=${candSet.size}`);

  // Details sweep: fills candidates the listing pass may have missed (pagination
  // jitter, deletions). Self-skips instantly when details/ is already complete.
  await detailPhase();
  if (gStopped) {
    writeStatus({ note: `stopped during details; ${summaryLine()}` });
    log(summaryLine());
    process.exit(0);
  }

  await downloadPhase();
  gPhase = gStopped ? "stopped-resumable" : "complete";
  writeStatus({ note: gStopped ? "stopped, resumable" : "all done" });
  log(summaryLine());
  try { unlinkSync(F.lock); } catch { /* ok */ }
}

main().catch((e) => {
  log(`FATAL ${e instanceof Error ? e.stack ?? e.message : e}`);
  writeStatus({ note: `fatal: ${String(e).slice(0, 200)}` });
  try { unlinkSync(F.lock); } catch { /* ok */ }
  process.exit(1);
});
