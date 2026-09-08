#!/usr/bin/env bun
/**
 * repertoire psy-lean: aggressive in-place slimming of Cambridge article
 * HTML. Rebuilds each file as a minimal document: citation_ and dc.
 * metas + div.abstract + div.body + div.back (references), all other page
 * chrome dropped. Attributes are pruned to a whitelist (class, href,
 * data-src, ...), which halves the bytes: publisher markup carries ~50%
 * attribute weight (data-mathjax-*, aria-*, base64 placeholder src).
 *
 * Assumes clean-html has run. Validate by re-running psy2md and diffing
 * md/ (must be byte-identical). Usage: bun src/psy-lean.ts [--dry]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const ROOT = new URL("..", import.meta.url).pathname;
const HTML_DIR = `${ROOT}/html`;
const DRY = process.argv.includes("--dry");

const KEEP_META = /^(citation_|dc\.|description$)/;
const KEEP_ATTR = new Set([
  "class",
  "href",
  "data-src",
  "alt",
  "colspan",
  "rowspan",
  "content",
  "name",
  "property",
  "charset",
]);

function lean(html: string): string {
  const $ = cheerio.load(html);
  const metas: string[] = [];
  $("head meta").each((_, el) => {
    const name = $(el).attr("name") ?? $(el).attr("property") ?? "";
    if (KEEP_META.test(name)) {
      // reference metas embed TeX with newlines; prettier wraps them into
      // runs of blank lines. Normalize all whitespace in content.
      const content = $(el).attr("content");
      if (content) $(el).attr("content", content.replace(/\s+/g, " ").trim());
      metas.push($.html(el));
    }
  });
  const parts = ["div.abstract", "div.body", "div.back"]
    .map((sel) => $(sel).first())
    .filter((el) => el.length);
  if (!parts.length) throw new Error("no content divs");
  for (const el of parts) {
    el.find("*").each((_, node) => {
      for (const attr of Object.keys(node.attribs ?? {})) {
        if (attr === "src" && !node.attribs.src.startsWith("data:")) continue;
        if (!KEEP_ATTR.has(attr)) $(node).removeAttr(attr);
      }
    });
  }
  return (
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
    metas.join("") +
    "</head><body>" +
    parts.map((el) => $.html(el)).join("") +
    "</body></html>"
  );
}

const main = async () => {
  // Cambridge psychometrika files only: 10.1007:s11336-* and 10.1017:psy.*
  const files = (await readdir(HTML_DIR)).filter((f) =>
    /^(10\.1007:s11336|10\.1017:psy)/.test(f),
  );
  let before = 0;
  let after = 0;
  let failed = 0;
  for (const f of files) {
    const path = `${HTML_DIR}/${f}`;
    const html = await readFile(path, "utf8");
    try {
      const out = lean(html);
      before += html.length;
      after += out.length;
      if (!DRY) await writeFile(path, out);
    } catch (e: any) {
      failed++;
      console.log(`${f} SKIPPED: ${e.message}`);
    }
  }
  const mb = (n: number) => (n / 1e6).toFixed(0);
  console.log(
    `${files.length} files, ${mb(before)}MB -> ${mb(after)}MB, ${failed} skipped${DRY ? " (dry)" : ""}`,
  );
};

await main();
