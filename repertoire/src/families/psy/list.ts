#!/usr/bin/env bun
/**
 * psy bulk listing: all Psychometrika issues 1936-2025 from Cambridge Core.
 *
 * Writes (all under repertoire/.cache/bulk/psy/ unless noted):
 *   issue-cache/all-issues.html, issue-cache/issue-<ID>.html  (page cache)
 *   papers.jsonl   filtered rows (pdf_url filled later by fetch.ts)
 *   STATUS.json    progress while listing
 *   repertoire/.cache/papers-psychometrika.json  copy of the rows
 *
 * NEVER touches .cache/papers.json. Cache-first: rerun resumes.
 */
import { mkdir, writeFile } from "node:fs/promises";

const JOURNAL = "psychometrika";
const BASE = "https://www.cambridge.org";
const YEAR_MIN = 1936;
const YEAR_MAX = 2025;
const HERE = new URL("./", import.meta.url).pathname; // .../repertoire/.cache/bulk/psy/
const CACHE = `${HERE}issue-cache/`;
const UA = "Mozilla/5.0 (repertoire corpus builder)";

const FRONT_MATTER =
  /^(issue information|cover|erratum|corrigendum|correction|obituary|in memoriam|front matter|back matter|list of reviewers|editorial acknowledgement|book reviews?)$/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = () => 1200 + Math.random() * 300; // 1.2-1.5s

async function fetchPage(url: string, cacheFile: string): Promise<string> {
  const f = Bun.file(cacheFile);
  if (await f.exists()) return f.text();
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429) {
        console.log(`429 on ${url}; pausing 30s`);
        await sleep(30_000);
        lastErr = "http 429";
        continue;
      }
      if (!res.ok) throw new Error(`http ${res.status}`);
      const html = await res.text();
      await writeFile(cacheFile, html);
      await sleep(jitter());
      return html;
    } catch (e: any) {
      lastErr = e.message;
      await sleep(5_000 * (attempt + 1));
    }
  }
  throw new Error(`GET ${url} failed after retries: ${lastErr}`);
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

/** all-issues page: blocks headed "YYYY - Volume NN" containing issue links. */
function parseAllIssues(html: string): { year: number; issueUrl: string }[] {
  const out: { year: number; issueUrl: string }[] = [];
  const parts = html.split(/aria-label="Toggle visibility for (\d{4}) - Volume \d+"/);
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const year = Number(parts[i]);
    if (year < YEAR_MIN || year > YEAR_MAX) continue;
    const block = parts[i + 1];
    for (const m of block.matchAll(/href="(\/core\/journals\/psychometrika\/issue\/[-A-Z0-9]+)"/g)) {
      out.push({ year, issueUrl: BASE + m[1] });
    }
  }
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.issueUrl) ? false : seen.add(r.issueUrl)));
}

export interface PaperRow {
  doi: string;
  doi_id: string;
  title: string;
  year: number;
  journal: string;
  issue_url: string;
  article_url: string;
  pdf_url: string | null;
}

/** issue page: article blocks with part-link href/title and a data-doi. */
function parseIssue(html: string, year: number, issueUrl: string): PaperRow[] {
  const rows: PaperRow[] = [];
  const linkRe =
    /<a class="part-link" href="(\/core\/journals\/psychometrika\/article\/[a-z0-9-]+\/[A-Z0-9]+)">([\s\S]*?)<\/a>/g;
  const matches = [...html.matchAll(linkRe)];
  for (let k = 0; k < matches.length; k++) {
    const [, href, rawTitle] = matches[k];
    const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    const start = matches[k].index! + matches[k][0].length;
    const end = k + 1 < matches.length ? matches[k + 1].index! : html.length;
    const block = html.slice(start, end);
    const doi = block.match(/data-doi="(10\.\d{4,}\/[^"]+)"/i)?.[1];
    if (!doi) continue; // no DOI declared: skip
    rows.push({
      doi: doi.toLowerCase(),
      doi_id: doi.toLowerCase().replace("/", ":"),
      title,
      year,
      journal: JOURNAL,
      issue_url: issueUrl,
      article_url: BASE + href,
      pdf_url: null,
    });
  }
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.doi) ? false : seen.add(r.doi)));
}

async function writeStatus(partial: object) {
  await writeFile(
    `${HERE}STATUS.json`,
    JSON.stringify({ ...partial, at: new Date().toISOString() }, null, 2),
  );
}

const main = async () => {
  await mkdir(CACHE, { recursive: true });
  await writeStatus({ phase: "listing", done: 0, total: 0, last: "all-issues", fail_rate: 0, excluded: 0 });

  const allIssues = await fetchPage(`${BASE}/core/journals/${JOURNAL}/all-issues`, `${CACHE}all-issues.html`);
  const issues = parseAllIssues(allIssues);
  console.log(`issues ${YEAR_MIN}-${YEAR_MAX}: ${issues.length}`);

  const papers: PaperRow[] = [];
  let excluded = 0;
  for (const [i, { year, issueUrl }] of issues.entries()) {
    const id = issueUrl.split("/").pop()!;
    let html: string;
    try {
      html = await fetchPage(issueUrl, `${CACHE}issue-${id}.html`);
    } catch (e: any) {
      console.log(`ISSUE FETCH FAIL ${year} ${id}: ${e.message}`);
      continue;
    }
    const rows = parseIssue(html, year, issueUrl);
    for (const r of rows) {
      if (FRONT_MATTER.test(r.title)) {
        excluded++;
        continue;
      }
      papers.push(r);
    }
    if ((i + 1) % 25 === 0 || i + 1 === issues.length) {
      console.log(`[${i + 1}/${issues.length}] ${year} ${id}: +${rows.length} (excluded so far: ${excluded})`);
      await writeStatus({
        phase: "listing",
        done: i + 1,
        total: issues.length,
        last: `${year}/${id}`,
        fail_rate: 0,
        excluded,
      });
    }
  }

  // global dedupe by doi, keep first
  const seen = new Set<string>();
  const unique = papers.filter((r) => (seen.has(r.doi) ? false : seen.add(r.doi)));
  console.log(`total unique articles (after filter): ${unique.length}; excluded front matter: ${excluded}`);

  const jsonl = unique.map((r) => JSON.stringify(r)).join("\n") + "\n";
  await writeFile(`${HERE}papers.jsonl`, jsonl);
  // named copy for the pipeline; NEVER .cache/papers.json (known destruction bug)
  await writeFile(`${HERE}../../papers-psychometrika.json`, JSON.stringify(unique, null, 2));
  await writeStatus({ phase: "listing-done", done: issues.length, total: issues.length, last: "", fail_rate: 0, excluded });
  console.log("listing complete");
};

await main();
