#!/usr/bin/env bun
/**
 * repertoire query: draft prose -> published conventions.
 *
 *   bun src/query.ts "your draft sentence or paragraph here"
 *   bun src/query.ts --file draft.md --top-k 8 --year 2024
 *   bun src/query.ts "..." --doi 10.1017/psy.2025.10034   # within one paper
 *
 * Flow: Voyage embeds the query (voyage-context-4, input_type=query) ->
 * Cloudflare TS SDK queries Vectorize `repertoire` with optional metadata
 * filters -> results printed with score, paper, heading, and the passage
 * itself (chunk text rides in vector metadata).
 *
 * Env (root .env): VOYAGE_API_KEY, CF_API_TOKEN (Vectorize read), and
 * optionally CF_ACCOUNT_ID (defaults to the known account).
 */
import Cloudflare from "cloudflare";

const ROOT = new URL("..", import.meta.url).pathname;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "931e2de500772326b331964159d3bd2d";
const MODEL = "voyage-context-4";

// ---- args ----
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const topK = Number(opt("top-k") ?? 8);
const distinct = args.includes("--distinct"); // at most one hit per paper
const section = opt("section"); // hard filter: only chunks from this section
const prefer = opt("prefer"); // soft boost: matching chunks score higher
const year = opt("year") ? Number(opt("year")) : undefined;
const doiFilter = opt("doi");
const journal = opt("journal");
const file = opt("file");
const queryText = file
  ? await Bun.file(file).text()
  : args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--top-k" && args[i - 1] !== "--year" && args[i - 1] !== "--doi" && args[i - 1] !== "--journal").join(" ");
if (!queryText.trim()) {
  console.error('usage: bun src/query.ts "draft text" [--top-k 8] [--distinct] [--section abstract] [--prefer discussion] [--year 2024] [--doi 10.x/...]');
  process.exit(1);
}

const { VOYAGE_API_KEY, CF_API_TOKEN } = process.env;
if (!VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY missing (root .env)");
if (!CF_API_TOKEN)
  throw new Error(
    "CF_API_TOKEN missing. Create one at dash.cloudflare.com -> My Profile -> API Tokens " +
      "with Vectorize read permission, add to root .env.",
  );

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

// ---- 2. query Vectorize via TS SDK ----
const cf = new Cloudflare({ apiToken: CF_API_TOKEN });
const filter: Record<string, unknown> = {};
if (year) filter.year = year;
if (doiFilter) filter.doi = doiFilter;
if (journal) filter.journal = journal;
if (section) filter.section = section;
const result = await cf.vectorize.indexes.query("repertoire", {
  account_id: ACCOUNT_ID,
  vector,
  topK: distinct || prefer ? topK * 5 : topK,
  returnMetadata: "all",
  ...(Object.keys(filter).length ? { filter } : {}),
});
let matches = result.matches ?? [];
if (prefer) {
  // soft boost: +0.03 for section match, then re-sort (score range ~0.3-0.6)
  for (const m of matches)
    if ((m.metadata as any)?.section === prefer) m.score = (m.score ?? 0) + 0.03;
  matches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
if (distinct) {
  const seen = new Set<string>();
  matches = matches.filter((m) => {
    const doi = (m.metadata as any)?.doi;
    if (seen.has(doi)) return false;
    seen.add(doi);
    return true;
  });
}
matches = matches.slice(0, topK);

// ---- 3. present ----
const papers: { doi: string; title: string }[] = JSON.parse(
  await Bun.file(`${ROOT}/.cache/papers.json`).text(),
);
const titleByDoi = new Map(papers.map((p) => [p.doi, p.title]));

for (const [i, m] of matches.entries()) {
  const meta = (m.metadata ?? {}) as any;
  const title = titleByDoi.get(meta.doi) ?? meta.doi;
  console.log(`\n=== [${i + 1}] score ${m.score?.toFixed(4)} | ${title} (${meta.year})`);
  console.log(`    ${meta.doi} chunk ${meta.chunk_no}${meta.heading ? ` | ${meta.heading}` : ""}`);
  console.log(meta.text?.replace(/^/gm, "    "));
}
