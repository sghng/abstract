/**
 * The fetch engine. Dispatch is OA-first (a legal free copy needs no
 * browser and no risk), then the publisher route table. Everything
 * goes through the serial queue; paper_fetch is submit-and-poll so no
 * MCP call ever blocks on a browser.
 */
import { resolvePaper, normalizeDoi } from "./resolve.ts";
import { doiToId, readMeta, writeMeta, artPath } from "./store.ts";
import { enqueue } from "./queue.ts";
import { audit } from "./audit.ts";
import { pdfPages, pdfToText, isPdf } from "./extract.ts";
import { fetchWiley } from "./routes/wiley.ts";
import { fetchElsevier } from "./routes/elsevier.ts";
import { fetchCambridge } from "./routes/cambridge.ts";
import { fetchSpringer } from "./routes/springer.ts";
import { writeFileSync } from "node:fs";

const inflight = new Map<string, number>();

export type FetchState = {
  state: "ok" | "started" | "queued" | "failed";
  artifact: string;
  doi: string;
  title?: string;
  pages?: number;
  route?: string;
  error?: { code: string; message: string };
};

export function fetchPaper(doiRaw: string, force = false): FetchState {
  const doi = normalizeDoi(doiRaw);
  const id = doiToId(doi);
  if (!force) {
    const meta = readMeta(id);
    if (meta?.complete) {
      return { state: "ok", artifact: id, doi, title: meta.title, pages: meta.pages, route: meta.route };
    }
    if (meta?.error) {
      if (meta.error.code === "challenge_needs_human") {
        const minsLeft = 30 - (Date.now() - Date.parse(meta.error.at)) / 60_000;
        if (minsLeft > 0) {
          return {
            state: "failed",
            artifact: id,
            doi,
            error: {
              code: "challenge_needs_human",
              message: `publisher cooldown, ${Math.ceil(minsLeft)} min left; retry after it lifts (${meta.error.message})`,
            },
          };
        }
      }
      return { state: "failed", artifact: id, doi, error: meta.error };
    }
  }
  if (inflight.has(doi)) {
    return { state: "queued", artifact: id, doi };
  }
  inflight.set(doi, Date.now());
  enqueue(() => fetchOne(doi, id)).finally(() => inflight.delete(doi));
  return { state: "started", artifact: id, doi };
}

async function fetchOne(doi: string, id: string): Promise<void> {
  const started = Date.now();
  try {
    const meta = await resolvePaper(doi);
    let buf: Buffer;
    let route = meta.route;
    if (route === "open-access" && meta.oa_pdf) {
      const r = await fetch(meta.oa_pdf, {
        headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0" },
        signal: AbortSignal.timeout(60_000),
      });
      buf = Buffer.from(await r.arrayBuffer());
      if (!isPdf(buf)) {
        // OA pointer lied; fall through to the publisher route
        route = publisherRoute(doi);
        buf = await byRoute(route, doi);
      }
    } else {
      route = publisherRoute(doi);
      buf = await byRoute(route, doi);
    }
    writeFileSync(artPath(id, "pdf"), buf);
    pdfToText(artPath(id, "pdf"), artPath(id, "txt"));
    const pages = pdfPages(artPath(id, "pdf"));
    writeMeta(id, {
      doi,
      title: meta.title,
      journal: meta.journal,
      route,
      pages,
      bytes: buf.length,
      fetched_at: new Date().toISOString(),
      complete: true,
    });
    audit({ doi, route, outcome: "ok", bytes: buf.length, pages, ms: Date.now() - started });
  } catch (e) {
    const code = (e as { code?: string }).code ?? (/not a DOI/.test(String(e)) ? "doi_not_registered" : "fetch_failed");
    const message = e instanceof Error ? e.message : String(e);
    writeMeta(id, { doi, error: { code, message, at: new Date().toISOString() } });
    audit({ doi, route: "n/a", outcome: "failed", code, ms: Date.now() - started });
  }
}

function publisherRoute(doi: string): string {
  if (/^10\.1111\//.test(doi)) return "wiley";
  if (/^10\.1016\//.test(doi)) return "elsevier";
  if (/^10\.1017\//.test(doi)) return "cambridge";
  if (/^10\.1007\//.test(doi)) return "springer";
  throw new Error(`no route for ${doi}`);
}

function byRoute(route: string, doi: string): Promise<Buffer> {
  switch (route) {
    case "wiley":
      return fetchWiley(doi);
    case "elsevier":
      return fetchElsevier(doi);
    case "cambridge":
      return fetchCambridge(doi);
    case "springer":
      return fetchSpringer(doi);
    default:
      throw new Error(`no route implemented for ${route}`);
  }
}
