/**
 * repertoire_query: draft prose -> published conventional phrasing.
 *
 * Hybrid retrieval over the journal corpus (psychometrika, bjmsp, jebs,
 * jem; 6,985 papers, 231,625 chunks):
 *   1. Voyage embeds the query (voyage-context-4, input_type=query)
 *   2. dense leg: Vectorize ANN, facet filters in-index
 *   3. sparse leg: D1 FTS5 bm25() over chunks_fts, facets via chunk_id
 *   4. RRF fusion (k=60)
 *   5. optional voyage rerank-3 stage (default on)
 *   6. hydrate from chunks join papers join chunks_fts; the passage is the
 *      stored chunk text ([formula] transform applied)
 *
 * Env: VOYAGE_API_KEY, CLOUDFLARE_API_TOKEN. CF_ACCOUNT_ID and
 * D1_REPERTOIRE_ID carry lab defaults.
 */

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const VOYAGE_KEY = process.env.VOYAGE_API_KEY;
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "931e2de500772326b331964159d3bd2d";
const D1_ID = process.env.D1_REPERTOIRE_ID ?? "36c30d13-6ddd-4f7a-9b9b-d3d971e6f800";
const LEG_K = 50; // per-leg fetch: recall is decided here
const RERANK_POOL = 20; // fusion pool handed to the reranker
const RRF_K = 60; // Cormack et al. 2009, the vendor default everywhere
const MAX_PASSAGE = 4000; // atomic tables can be huge; protect the context

export type RepertoireOpts = {
  topK?: number;
  maxPerPaper?: number;
  year?: number;
  doi?: string; // slash form, 10.x/...
  journal?: string;
  section?: string;
  rerank?: boolean; // default true
};

const q = (s: string) => s.replace(/'/g, "''");

async function d1(sql: string): Promise<any[]> {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${D1_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
    },
  );
  const j = await r.json();
  if (!j.success) throw new Error(`d1: ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  return j.result[0].results;
}

async function embedQuery(text: string): Promise<number[]> {
  const r = await fetch("https://api.voyageai.com/v1/contextualizedembeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${VOYAGE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: [[text]], model: "voyage-context-4", input_type: "query", output_dimension: 1024 }),
  });
  if (!r.ok) throw new Error(`voyage embed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).data[0].data[0].embedding;
}

async function denseLeg(vector: number[], filter: Record<string, unknown>): Promise<{ key: string }[]> {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/repertoire/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        vector,
        topK: LEG_K,
        returnMetadata: "indexed",
        ...(Object.keys(filter).length ? { filter } : {}),
      }),
    },
  );
  const j = await r.json();
  if (!j.success) throw new Error(`vectorize: ${JSON.stringify(j.errors ?? j).slice(0, 300)}`);
  // id form: <doi_id>#cNNN, doi_id uses ':' for '/'
  return (j.result.matches ?? []).map((m: any) => {
    const id = String(m.id);
    const i = id.indexOf("#");
    return { key: `${id.slice(0, i).replace(":", "/")}#${Number(id.slice(i + 2))}` };
  });
}

// FTS5 treats space-separated barewords as a phrase; OR the terms for the
// classic bag-of-words bm25 behavior. Operators must be UPPERCASE in D1's
// FTS5 build: lowercase or is silently searched as a literal term (2026-10-17
// lesson: "a" or "b" returned the AND). Regex-extracted alnum tokens only,
// so the MATCH string is injection-safe by construction.
function bm25LegSql(opts: RepertoireOpts, query: string): string | null {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g)?.slice(0, 32) ?? [];
  if (!terms.length) return null;
  const match = terms.map((t) => `"${t}"`).join(" OR ");
  const conds: string[] = [];
  if (opts.doi) conds.push(`c2.doi='${q(opts.doi)}'`);
  if (opts.journal) conds.push(`p.journal='${q(opts.journal)}'`);
  if (opts.year) conds.push(`p.year=${Number(opts.year)}`);
  if (opts.section) conds.push(`c2.section='${q(opts.section)}'`);
  const facet = conds.length
    ? ` and f.chunk_id in (select c2.chunk_id from chunks c2 join papers p on p.doi=c2.doi where ${conds.join(" and ")})`
    : "";
  return (
    `select f.chunk_id, c.doi, c.chunk_no from chunks_fts f join chunks c on c.chunk_id=f.chunk_id ` +
    `where chunks_fts match '${match}'${facet} order by rank limit ${LEG_K}`
  );
}

export async function repertoireQuery(query: string, opts: RepertoireOpts = {}): Promise<unknown> {
  if (!CF_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN missing");
  if (!VOYAGE_KEY) throw new Error("VOYAGE_API_KEY missing");
  const topK = opts.topK ?? 8;
  const rerank = opts.rerank ?? true;

  const filter: Record<string, unknown> = {};
  if (opts.year) filter.year = opts.year;
  if (opts.doi) filter.doi = opts.doi;
  if (opts.journal) filter.journal = opts.journal;
  if (opts.section) filter.section = opts.section;

  const bm25Sql = bm25LegSql(opts, query);
  const [vector, bm25Rows] = await Promise.all([embedQuery(query), bm25Sql ? d1(bm25Sql) : Promise.resolve([])]);
  const [dense, sparse] = await Promise.all([denseLeg(vector, filter), Promise.resolve(bm25Rows)]);

  // RRF over rank-only keys "doi#chunk_no"
  const rrf = new Map<string, number>();
  dense.forEach((m, i) => rrf.set(m.key, (rrf.get(m.key) ?? 0) + 1 / (RRF_K + i + 1)));
  sparse.forEach((r: any, i: number) => {
    const key = `${r.doi}#${r.chunk_no}`;
    rrf.set(key, (rrf.get(key) ?? 0) + 1 / (RRF_K + i + 1));
  });
  let fused = [...rrf.entries()].map(([key, score]) => {
    const i = key.lastIndexOf("#");
    return { doi: key.slice(0, i), chunkNo: Number(key.slice(i + 1)), score };
  });
  fused.sort((a, b) => b.score - a.score);
  if (opts.maxPerPaper && opts.maxPerPaper > 0) {
    const seen = new Map<string, number>();
    fused = fused.filter((h) => {
      const n = (seen.get(h.doi) ?? 0) + 1;
      seen.set(h.doi, n);
      return n <= opts.maxPerPaper!;
    });
  }
  const pool = fused.slice(0, rerank ? RERANK_POOL : topK);
  if (!pool.length) return { results: [], legs: { dense: dense.length, bm25: sparse.length }, reranked: false };

  const where = pool.map((h) => `(c.doi='${q(h.doi)}' and c.chunk_no=${h.chunkNo})`).join(" or ");
  const rows = await d1(
    `select c.chunk_id, c.doi, c.chunk_no, c.heading, c.section, p.title, p.journal, p.year, f.text ` +
      `from chunks c left join papers p on p.doi=c.doi join chunks_fts f on f.chunk_id=c.chunk_id where ${where}`,
  );
  const byKey = new Map(rows.map((r: any) => [`${r.doi}#${r.chunk_no}`, r]));
  let results = pool
    .map((h) => {
      const r: any = byKey.get(`${h.doi}#${h.chunkNo}`);
      if (!r) return null;
      const passage = r.text.length > MAX_PASSAGE ? r.text.slice(0, MAX_PASSAGE) + "\n[...truncated]" : r.text;
      return {
        score: h.score,
        doi: r.doi,
        title: r.title,
        journal: r.journal,
        year: r.year,
        section: r.section,
        heading: r.heading,
        chunk_no: r.chunk_no,
        passage,
      };
    })
    .filter(Boolean) as any[];

  if (rerank && results.length) {
    const r = await fetch("https://api.voyageai.com/v1/rerank", {
      method: "POST",
      headers: { Authorization: `Bearer ${VOYAGE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, documents: results.map((x) => x.passage), model: "rerank-3", top_k: topK }),
    });
    if (!r.ok) throw new Error(`voyage rerank ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const ranked = (await r.json()).data as { index: number; relevance_score: number }[];
    results = ranked.map((x) => ({ ...results[x.index], score: x.relevance_score }));
  } else {
    results = results.slice(0, topK);
  }

  return { results, legs: { dense: dense.length, bm25: sparse.length }, reranked: rerank };
}
