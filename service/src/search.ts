/**
 * Literature discovery: Semantic Scholar and OpenAlex searched in
 * parallel, merged by DOI, ranked by reciprocal rank fusion. S2 brings
 * relevance ranking and the citation graph; OpenAlex brings coverage
 * (social science especially) and complementary recall. Both legs run
 * every query because field reports showed each finding papers the
 * other missed. Results are DOI-first so they feed paper_resolve and
 * paper_fetch directly.
 */
import { normalizeDoi } from "./resolve.ts";

export type SearchHit = {
  doi: string;
  title: string;
  year?: number;
  venue?: string;
  citations?: number;
  oa: boolean;
  oa_pdf?: string;
  found_by: string[];
};

export type SearchOpts = {
  limit?: number;
  year_from?: number;
  year_to?: number;
  min_citations?: number;
};

const UA = "abstract-mcp/0.1 (https://sgh.ng; contact via tailnet)";
const TTL_MS = 30 * 60 * 1000;

type Fused = { query: string; merged_from: string[]; hits: SearchHit[] };
const cache = new Map<string, { at: number; value: Fused }>();

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json", ...headers },
      signal: AbortSignal.timeout(15_000),
    });
    if (r.ok) return r.json();
    // transient throttle (S2 keys get 1 req/s) or upstream error: breathe, retry
    if ((r.status === 429 || r.status >= 500) && attempt < 2) {
      await new Promise((res) => setTimeout(res, 1500));
      continue;
    }
    throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  }
  throw new Error(`unreachable ${new URL(url).host}`);
}

function yearRange(o: SearchOpts): string {
  return `${o.year_from ?? 1900}-${o.year_to ?? new Date().getFullYear()}`;
}

async function searchS2(q: string, o: SearchOpts): Promise<SearchHit[]> {
  const params = new URLSearchParams({
    query: q,
    limit: String(Math.min(o.limit ?? 10, 20)),
    fields: "title,year,venue,citationCount,externalIds,openAccessPdf",
  });
  if (o.year_from || o.year_to) params.set("year", yearRange(o));
  const headers = process.env.S2_API_KEY ? { "x-api-key": process.env.S2_API_KEY } : {};
  const j = await getJson(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, headers);
  return (j.data ?? [])
    .map((p: any): SearchHit | null => {
      if (!p.externalIds?.DOI) return null;
      return {
        doi: normalizeDoi(p.externalIds.DOI),
        title: p.title,
        year: p.year,
        venue: p.venue || undefined,
        citations: p.citationCount,
        oa: Boolean(p.openAccessPdf?.url),
        oa_pdf: p.openAccessPdf?.url,
        found_by: ["semantic_scholar"],
      };
    })
    .filter((h: SearchHit | null): h is SearchHit => h !== null);
}

async function searchOpenAlex(q: string, o: SearchOpts): Promise<SearchHit[]> {
  const params = new URLSearchParams({
    search: q,
    per_page: String(Math.min(o.limit ?? 10, 20)),
    select: "doi,display_name,publication_year,cited_by_count,open_access,primary_location,best_oa_location",
  });
  if (o.year_from || o.year_to) params.set("filter", `publication_year:${yearRange(o)}`);
  if (process.env.OPENALEX_API_KEY) params.set("api_key", process.env.OPENALEX_API_KEY);
  const j = await getJson(`https://api.openalex.org/works?${params}`);
  return (j.results ?? [])
    .map((w: any): SearchHit | null => {
      if (!w.doi) return null;
      // oa_url can be a landing page; only report it when it is pdf-shaped
      const oaPdf = w.best_oa_location?.pdf_url ?? (String(w.open_access?.oa_url ?? "").includes(".pdf") ? w.open_access.oa_url : undefined);
      return {
        doi: normalizeDoi(w.doi),
        title: w.display_name,
        year: w.publication_year,
        venue: w.primary_location?.source?.display_name,
        citations: w.cited_by_count,
        oa: Boolean(w.open_access?.is_oa),
        oa_pdf: oaPdf,
        found_by: ["openalex"],
      };
    })
    .filter((h: SearchHit | null): h is SearchHit => h !== null);
}

async function fuse(q: string, o: SearchOpts): Promise<Fused> {
  const legNames = ["semantic_scholar", "openalex"];
  const results = await Promise.allSettled([searchS2(q, o), searchOpenAlex(q, o)]);
  const ok = results.filter((r) => r.status === "fulfilled");
  if (ok.length === 0) {
    const why = results.map((r, i) => `${legNames[i]}: ${r.status === "rejected" ? String(r.reason).slice(0, 120) : "ok"}`).join("; ");
    throw new Error(`search backends unavailable: ${why}`);
  }
  // reciprocal rank fusion, k=60; a paper both legs rank well beats
  // a paper one leg ranks first
  const byDoi = new Map<string, SearchHit & { score: number }>();
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") return;
    r.value.forEach((h, rank) => {
      const cur = byDoi.get(h.doi);
      if (!cur) {
        byDoi.set(h.doi, { ...h, score: 1 / (60 + rank + 1) });
      } else {
        cur.score += 1 / (60 + rank + 1);
        cur.found_by.push(h.found_by[0]);
        cur.citations = Math.max(cur.citations ?? 0, h.citations ?? 0);
        cur.oa = cur.oa || h.oa;
        cur.oa_pdf = cur.oa_pdf ?? h.oa_pdf;
        cur.venue = cur.venue ?? h.venue;
        cur.year = cur.year ?? h.year;
      }
    });
  });
  let hits = [...byDoi.values()];
  if (o.min_citations) hits = hits.filter((h) => (h.citations ?? 0) >= o.min_citations!);
  hits.sort((a, b) => b.score - a.score);
  return {
    query: q,
    merged_from: results.map((r, i) => (r.status === "fulfilled" ? legNames[i] : null)).filter(Boolean) as string[],
    hits: hits.slice(0, o.limit ?? 10).map(({ score, ...h }) => h),
  };
}

export async function searchPapers(q: string, opts: SearchOpts = {}): Promise<Fused> {
  const key = JSON.stringify([q, opts]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await fuse(q, opts);
  cache.set(key, { at: Date.now(), value });
  return value;
}
