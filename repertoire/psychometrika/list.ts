#!/usr/bin/env bun
/**
 * repertoire psy-list: scrape Cambridge Core for Psychometrika 2012-2025.
 *
 * Stage 1 of the pipeline. Writes:
 *   .cache/all-issues.html, .cache/issue-<id>.html  (page cache)
 *   .cache/papers.json                              (parsed rows)
 *   inserts.sql                                     (D1 batch)
 *
 * Idempotent: uses the page cache when present; pass --fresh to refetch.
 */
import { mkdir, writeFile } from "node:fs/promises";

const JOURNAL = "psychometrika";
const BASE = "https://www.cambridge.org";
const YEAR_MIN = 2012;
const YEAR_MAX = 2025;
const CACHE = new URL("../.cache/", import.meta.url).pathname;
const FRESH = process.argv.includes("--fresh");
const SLEEP_MS = 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url: string, cacheFile: string): Promise<string> {
  if (!FRESH) {
    const f = Bun.file(cacheFile);
    if (await f.exists()) return f.text();
  }
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (repertoire corpus builder)" },
  });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const html = await res.text();
  await writeFile(cacheFile, html);
  await sleep(SLEEP_MS);
  return html;
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
  // split on volume headers, keeping the year with each block
  const parts = html.split(/aria-label="Toggle visibility for (\d{4}) - Volume \d+"/);
  // parts: [pre, year1, block1, year2, block2, ...]
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const year = Number(parts[i]);
    if (year < YEAR_MIN || year > YEAR_MAX) continue;
    const block = parts[i + 1];
    for (const m of block.matchAll(
      /href="(\/core\/journals\/psychometrika\/issue\/[A-Z0-9]+)"/g,
    )) {
      out.push({ year, issueUrl: BASE + m[1] });
    }
  }
  // dedupe preserving order
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
    // DOI lives in a data-doi attribute after the title, before the next article
    const start = matches[k].index! + matches[k][0].length;
    const end = k + 1 < matches.length ? matches[k + 1].index! : html.length;
    const block = html.slice(start, end);
    const doi = block.match(/data-doi="(10\.\d{4,}\/[^"]+)"/i)?.[1];
    if (!doi) continue; // no DOI declared: skip (book reviews etc. sometimes lack one)
    rows.push({
      doi: doi.toLowerCase(),
      doi_id: doi.toLowerCase().replace("/", ":"),
      title,
      year,
      journal: JOURNAL,
      issue_url: issueUrl,
      article_url: BASE + href,
    });
  }
  // dedupe by doi
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.doi) ? false : seen.add(r.doi)));
}

function sqlEscape(s: string | null): string {
  if (s === null) return "null";
  return `'${s.replace(/'/g, "''")}'`;
}

const main = async () => {
  await mkdir(CACHE, { recursive: true });
  const allIssues = await fetchPage(
    `${BASE}/core/journals/${JOURNAL}/all-issues`,
    `${CACHE}all-issues.html`,
  );
  const issues = parseAllIssues(allIssues);
  console.log(`issues ${YEAR_MIN}-${YEAR_MAX}: ${issues.length}`);

  const papers: PaperRow[] = [];
  for (const [i, { year, issueUrl }] of issues.entries()) {
    const id = issueUrl.split("/").pop()!;
    const html = await fetchPage(issueUrl, `${CACHE}issue-${id}.html`);
    const rows = parseIssue(html, year, issueUrl);
    papers.push(...rows);
    console.log(`[${i + 1}/${issues.length}] ${year} ${id}: ${rows.length} articles`);
  }

  // global dedupe by doi
  const seen = new Set<string>();
  const unique = papers.filter((r) => (seen.has(r.doi) ? false : seen.add(r.doi)));
  console.log(`total unique articles: ${unique.length}`);

  await writeFile(`${CACHE}papers.json`, JSON.stringify(unique, null, 2));

  const values = unique
    .map(
      (r) =>
        `(${sqlEscape(r.doi)}, ${sqlEscape(r.doi_id)}, ${sqlEscape(r.title)}, ${r.year}, ` +
        `${sqlEscape(r.journal)}, ${sqlEscape(r.issue_url)}, ${sqlEscape(r.article_url)}, 'listed')`,
    )
    .join(",\n");
  const sql =
    "insert or ignore into papers (doi, doi_id, title, year, journal, issue_url, article_url, state) values\n" +
    values +
    ";\n";
  await writeFile(new URL("../inserts.sql", import.meta.url).pathname, sql);
  console.log("wrote inserts.sql; apply with: wrangler d1 execute repertoire --remote --file repertoire/inserts.sql");
};

await main();
