/**
 * Springer: the friendliest publisher; the content PDF is a plain
 * HTTP download under the campus IP.
 */
import { FetchError } from "../errors.ts";
import { isPdf } from "../extract.ts";

const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";

export async function fetchSpringer(doi: string): Promise<Buffer> {
  const r = await fetch(`https://link.springer.com/content/pdf/${doi}.pdf`, {
    redirect: "follow",
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(60_000),
  });
  if (r.status === 404) throw new FetchError("publisher_missing", `Springer 404 for ${doi}`);
  if (!r.ok) throw new FetchError("fetch_failed", `Springer HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (!isPdf(buf)) throw new FetchError("fetch_failed", `Springer returned ${r.headers.get("content-type")}`);
  return buf;
}
