// probe: validate hasFullText + citation_pdf_url extraction on cached pages
// backfile landings from the spike (read-only), 2012+ raws from the old pipeline
import { readdir } from "node:fs/promises";

function hasFullText(html: string): boolean {
  if (html.length <= 50_000) return false;
  for (const m of html.matchAll(/<div\b[^>]*\bclass="([^"]*)"/g)) {
    if (m[1].split(/\s+/).includes("body")) return true;
  }
  return false;
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

const spike = "/Users/OWNER/dev/agent/abstract/repertoire/.cache/spike-psy/landings/";
for (const f of (await readdir(spike)).filter((f) => f.endsWith(".html"))) {
  const html = await Bun.file(spike + f).text();
  const pdfUrl = html.match(/<meta\s+name="citation_pdf_url"\s+content="([^"]+)"/i)?.[1];
  console.log(
    "backfile",
    f.replace(".html", ""),
    "len",
    html.length,
    "fulltext",
    hasFullText(html),
    "pdf_url",
    pdfUrl ? decodeEntities(pdfUrl).slice(0, 80) : "MISSING",
  );
}

const raw = "/Users/OWNER/dev/agent/abstract/repertoire/raw/";
const raws = (await readdir(raw)).filter((f) => f.endsWith(".html"));
let ft = 0;
let noft = 0;
let missingUrl = 0;
for (const f of raws) {
  const html = await Bun.file(raw + f).text();
  if (hasFullText(html)) ft++;
  else {
    noft++;
    if (noft <= 5) console.log("no-fulltext (old raw):", f, html.length);
  }
  if (!/citation_pdf_url/i.test(html)) missingUrl++;
}
console.log(`old raws: ${raws.length}, fulltext ${ft}, no-fulltext ${noft}, missing citation_pdf_url ${missingUrl}`);
