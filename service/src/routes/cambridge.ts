/**
 * Cambridge Core: no browser needed. The landing HTML exposes the
 * PDF service link; both the landing and the PDF serve plain HTTP
 * clients on campus IP.
 */
import { FetchError } from "../errors.ts";
import { isPdf } from "../extract.ts";

const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";

export async function fetchCambridge(doi: string): Promise<Buffer> {
  const land = await fetch(`https://doi.org/${doi}`, {
    redirect: "follow",
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(45_000),
  });
  if (land.status === 404) throw new FetchError("publisher_missing", `Cambridge 404 for ${doi}`);
  if (!land.ok) throw new FetchError("fetch_failed", `landing HTTP ${land.status}`);
  const html = await land.text();
  const m = html.match(/href="([^"]*\/core\/services\/aop-cambridge-core\/content\/view\/[^"]+\.pdf[^"]*)"/);
  if (!m) throw new FetchError("fetch_failed", "no pdf href on the Cambridge landing page");
  const pdfUrl = new URL(m[1].replace(/&amp;/g, "&"), land.url).href;
  const r = await fetch(pdfUrl, { headers: { "user-agent": UA } });
  const buf = Buffer.from(await r.arrayBuffer());
  if (!isPdf(buf)) throw new FetchError("fetch_failed", `pdf fetch returned ${r.headers.get("content-type")}`);
  return buf;
}
