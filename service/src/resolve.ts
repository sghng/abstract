/**
 * DOI resolution: Crossref, OpenAlex, and Unpaywall merged and cached,
 * plus the publisher route table. OA locations are checked first so the
 * fetch engine can skip the browser entirely whenever a legal free copy
 * exists.
 */

export type Route = "open-access" | "wiley" | "elsevier" | "cambridge" | "springer" | "unknown";

export type ResolvedPaper = {
  doi: string;
  title?: string;
  journal?: string;
  publisher?: string;
  year?: string;
  type?: string;
  oa_status?: string;
  oa_pdf?: string;
  route: Route;
  resolved_at: string;
};

const ROUTES: Array<[RegExp, Route]> = [
  [/^10\.1111\//, "wiley"],
  [/^10\.1016\//, "elsevier"],
  [/^10\.1017\//, "cambridge"],
  [/^10\.1007\//, "springer"],
];

const UA = "abstract-mcp/0.1 (https://sgh.ng; contact via tailnet)";
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: ResolvedPaper }>();

export function normalizeDoi(input: string): string {
  let d = input.trim();
  try {
    if (/^https?:\/\//i.test(d)) d = new URL(d).pathname.replace(/^\/+/, "");
  } catch {
    /* not a URL; treat as bare DOI */
  }
  d = d.replace(/^(doi:|https?:\/\/(dx\.)?doi\.org\/)/i, "");
  d = decodeURIComponent(d);
  return d.toLowerCase();
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.json();
}

export async function resolvePaper(doiRaw: string): Promise<ResolvedPaper> {
  const doi = normalizeDoi(doiRaw);
  if (!/^10\.\d{4,9}\/./.test(doi)) {
    throw new Error(`not a DOI: ${doiRaw}`);
  }
  const hit = cache.get(doi);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const email = process.env.ABSTRACT_UPEMAIL ?? "lab@example.edu";
  const [cr, oa, up] = await Promise.allSettled([
    getJson(`https://api.crossref.org/works/${doi}`),
    getJson(`https://api.openalex.org/works/doi:${doi}`),
    getJson(`https://api.unpaywall.org/v2/${doi}?email=${encodeURIComponent(email)}`),
  ]);

  const crm = cr.status === "fulfilled" ? cr.value?.message ?? {} : {};
  const oam = oa.status === "fulfilled" ? oa.value ?? {} : {};
  const upm = up.status === "fulfilled" ? up.value ?? {} : {};
  const issued = crm.issued?.["date-parts"]?.[0] ?? oam.publication_year;

  const oaStatus =
    oam.open_access?.oa_status ?? (upm.is_oa === true ? (upm.oa_status ?? "gold") : upm.is_oa === false ? "closed" : undefined);
  const oaPdf =
    oam.best_oa_location?.pdf_url ??
    upm.best_oa_location?.url_for_pdf ??
    upm.best_oa_location?.url ??
    undefined;

  const value: ResolvedPaper = {
    doi,
    title: crm.title?.[0] ?? oam.title ?? upm.title,
    journal: (crm["container-title"] ?? [])[0] ?? oam.primary_location?.source?.display_name,
    publisher: crm.publisher,
    year: issued ? String(issued[0] ?? issued) : undefined,
    type: crm.type ?? oam.type,
    oa_status: oaStatus,
    oa_pdf: oaPdf,
    route: oaPdf ? "open-access" : ROUTES.find(([re]) => re.test(doi))?.[1] ?? "unknown",
    resolved_at: new Date().toISOString(),
  };
  if (cr.status === "rejected" && oa.status === "rejected" && up.status === "rejected") {
    // All three refused; a 404 from Crossref specifically means the DOI
    // is not registered (the reserved-but-unpublished case).
    const reason = String((cr as PromiseRejectedResult).reason ?? "");
    if (/HTTP 404/.test(reason)) {
      const err = new Error("DOI is not registered (reserved or typo)") as Error & { code?: string };
      err.code = "doi_not_registered";
      throw err;
    }
  }
  cache.set(doi, { at: Date.now(), value });
  return value;
}
