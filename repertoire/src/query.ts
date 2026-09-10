#!/usr/bin/env bun
/**
 * repertoire query: draft prose -> published conventions.
 *
 *   bun src/query.ts "your draft sentence or paragraph here"
 *   bun src/query.ts --file draft.md --top-k 8 --year 2024
 *   bun src/query.ts "..." --doi 10.1017/psy.2025.10034    # within one paper
 *   bun src/query.ts "..." --max-per-paper 1               # all hits distinct papers
 *
 * CONTRACT (reference implementation; see docs/repertoire.md):
 *   1. Voyage embeds the query (voyage-context-4, input_type=query)
 *   2. Vectorize query with filter facets (doi/journal/year/section --
 *      filtering happens during ANN traversal) + over-fetch when
 *      max-per-paper caps results
 *   3. One D1 call: chunks JOIN papers WHERE (doi, chunk_no) IN hits
 *      -> heading, section, line span, title, journal, year
 *   4. Passages read from the R2 md by line span (dedupe by doi; local
 *      cache keyed by doi is safe -- md objects are immutable)
 *   5. Bundle {score, doi, title, journal, year, section, heading,
 *      chunk_no, line_start, line_end, passage}
 *
 * Env (root .env): VOYAGE_API_KEY, CF_API_TOKEN, CF_ACCOUNT_ID optional.
 */
import Cloudflare from "cloudflare";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "931e2de500772326b331964159d3bd2d";
const MODEL = "voyage-context-4";
const CACHE_DIR = `${ROOT}/.cache/mdcache`;

// ---- args ----
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flagNames = ["top-k", "year", "doi", "journal", "section", "prefer", "file", "max-per-paper"];
const topK = Number(opt("top-k") ?? 8);
const maxPerPaper = args.includes("--distinct") ? 1 : Number(opt("max-per-paper") ?? 0); // 0 = unlimited
const section = opt("section");
const prefer = opt("prefer"); // soft boost: matching sections score higher
const year = opt("year") ? Number(opt("year")) : undefined;
const doiFilter = opt("doi");
const journal = opt("journal");
const file = opt("file");
const SMOKE = args.includes("--smoke");
const queryText = file
  ? await Bun.file(file).text()
  : SMOKE
    ? "the reliability of the test scores was estimated using coefficient alpha"
    : args.filter((a, i) => !a.startsWith("--") && !flagNames.includes(args[i - 1])).join(" ");
if (!queryText.trim()) {
  console.error(
    'usage: bun src/query.ts "draft text" [--top-k 8] [--max-per-paper 0] [--section abstract] [--prefer discussion] [--year 2024] [--doi 10.x/...]',
  );
  process.exit(1);
}

const { VOYAGE_API_KEY, CF_API_TOKEN } = process.env;
if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY missing (root .env)");
if (!CF_API_TOKEN) throw new Error("CF_API_TOKEN missing (root .env)");

// ---- 1. embed the query ----
const vres = await fetch("https://api.voyageai.com/v1/contextualizedembeddings", {
  method: "POST",
  headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    inputs: [[queryText]],
    model: MODEL,
    input_type: "query",
    output_dimension: 1024,
  }),
});
if (!vres.ok) throw new Error(`voyage ${vres.status}: ${(await vres.text()).slice(0, 200)}`);
const vector = (await vres.json()).data[0].data[0].embedding as number[];

// ---- 2. vectorize query (filter during traversal) ----
const cf = new Cloudflare({ apiToken: CF_API_TOKEN });
const filter: Record<string, unknown> = {};
if (year) filter.year = year;
if (doiFilter) filter.doi = doiFilter;
if (journal) filter.journal = journal;
if (section) filter.section = section;
const overfetch = Math.max(topK, maxPerPaper > 0 ? topK * 5 : topK);
const result = await cf.vectorize.indexes.query("repertoire", {
  account_id: ACCOUNT_ID,
  vector,
  topK: prefer ? Math.max(overfetch, topK * 3) : overfetch,
  returnMetadata: "indexed",
  ...(Object.keys(filter).length ? { filter } : {}),
});
let matches = result.matches ?? [];
if (prefer) {
  // soft boost: +0.03 for section match, then re-sort (score range ~0.3-0.6)
  for (const m of matches)
    if ((m.metadata as any)?.section === prefer) m.score = (m.score ?? 0) + 0.03;
  matches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
if (maxPerPaper > 0) {
  const seen = new Map<string, number>();
  matches = matches.filter((m) => {
    const doi = String(m.id).slice(0, m.id.indexOf("#"));
    const n = (seen.get(doi) ?? 0) + 1;
    seen.set(doi, n);
    return n <= maxPerPaper;
  });
}
matches = matches.slice(0, topK);
if (!matches.length) {
  console.log("no matches");
  if (SMOKE) process.exit(1);
  process.exit(0);
}

// ---- 3. one D1 call: chunks join papers ----
// id format: <doi_id>#cNNN (doi_id uses ':' for '/')
const hits = matches.map((m) => {
  const id = String(m.id);
  const i = id.indexOf("#");
  return { doi: id.slice(0, i).replace(":", "/"), doiId: id.slice(0, i), chunkNo: Number(id.slice(i + 2)), score: m.score ?? 0 };
});
const byDoi = new Map<string, number[]>();
for (const h of hits) byDoi.set(h.doi, [...(byDoi.get(h.doi) ?? []), h.chunkNo]);
const where = [...byDoi.entries()]
  .map(([doi, nos]) => `(c.doi='${doi}' and c.chunk_no in (${nos.join(",")}))`)
  .join(" or ");
const d1res = await run(
  "npx",
  [
    "wrangler", "d1", "execute", "repertoire", "--remote", "--json",
    "--command",
    `select c.doi, c.chunk_no, c.heading, c.section, c.line_start, c.line_end, p.title, p.journal, p.year ` +
      `from chunks c left join papers p on p.doi = c.doi where ${where}`,
  ],
  { timeout: 60_000 },
);
const rows: any[] = JSON.parse(d1res.stdout)[0].results;
const rowBy = new Map(rows.map((r) => [`${r.doi}#${r.chunk_no}`, r]));

// ---- 4. passages from R2 md (dedupe by doi; cache forever) ----
await mkdir(CACHE_DIR, { recursive: true });
async function mdFor(doiId: string): Promise<string> {
  const local = `${CACHE_DIR}/${doiId}.md`;
  if (!(await Bun.file(local).exists())) {
    await run(
      "npx",
      ["wrangler", "r2", "object", "get", `repertoire-docs/${doiId}.md`, "--file", local, "--remote"],
      { timeout: 60_000 },
    );
  }
  return Bun.file(local).text();
}
const mdCache = new Map<string, string[]>();
for (const doiId of new Set(hits.map((h) => h.doiId))) {
  mdCache.set(doiId, (await mdFor(doiId)).split("\n"));
}

// ---- 5. bundle + present ----
for (const [i, h] of hits.entries()) {
  const r = rowBy.get(`${h.doi}#${h.chunkNo}`);
  const lines = mdCache.get(h.doiId.replace("/", ":")) ?? mdCache.get(h.doiId)!;
  const passage = r ? lines.slice(r.line_start - 1, r.line_end).join("\n") : "(chunk row missing in D1)";
  if (SMOKE && i === 0) {
    if (!r) throw new Error("SMOKE FAILED: top hit has no D1 chunk row");
    if (!passage.trim()) throw new Error("SMOKE FAILED: empty passage");
    if (r.line_end > lines.length) throw new Error("SMOKE FAILED: line span beyond md length");
  }
  console.log(`\n=== [${i + 1}] score ${h.score.toFixed(4)} | ${r?.title ?? h.doi} (${r?.year ?? "?"})`);
  console.log(
    `    ${r?.journal ?? "?"} | ${h.doi} chunk ${h.chunkNo}${r?.heading ? ` | ${r.heading}` : ""} | lines ${r?.line_start}-${r?.line_end}`,
  );
  console.log(passage.replace(/^/gm, "    "));
}

if (SMOKE) {
  console.log(`\nSMOKE PASSED: ${hits.length} matches, passages joined from R2 md`);
  process.exit(0);
}
