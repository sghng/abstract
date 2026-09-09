#!/usr/bin/env bun
/**
 * repertoire jem-lean: aggressive in-place slimming of Wiley article HTML.
 * Rebuilds each file as a minimal document: citation_ and dc. metas +
 * div.article__body (the only nodes jem2md reads). All other page chrome
 * dropped. Attributes pruned to a whitelist. Optionally prettier-formats
 * the result (--pretty): HTML prettier is whitespace-safe (css display
 * sensitivity), unlike XML.
 *
 * Assumes jem/clean-html.ts has run. In-place slimming of the working dir
 * (regenerable from raw/ for the recent era). Validate by re-running
 * jem2md and diffing md/ (must be byte-identical).
 * Usage: bun jem/lean.ts [--in dir] [--dry]  (default dir: jem/html)
 * Prettify separately: npx prettier --parser html --write jem/html (then
 * re-validate MD); kept out of this script to batch npx startup.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import * as cheerio from "cheerio";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const HTML_DIR = arg("in", `${ROOT}/jem/html`);
const DRY = process.argv.includes("--dry");

const KEEP_META = /^(citation_|dc\.|description$)/;
const KEEP_ATTR = new Set([
  "class",
  "href",
  "src",
  "data-src",
  "alt",
  "id",
  "colspan",
  "rowspan",
  "encoding", // <annotation encoding="application/x-tex">
  "content",
  "name",
  "property",
  "scheme",
]);

const main = async () => {
  const files = (await readdir(HTML_DIR)).filter((f) => f.endsWith(".html"));
  let before = 0;
  let after = 0;
  let failed = 0;
  for (const f of files) {
    const path = `${HTML_DIR}/${f}`;
    const html = await readFile(path, "utf8");
    before += html.length;
    const $ = cheerio.load(html);
    const body = $("div.article__body").first();
    if (!body.length) {
      failed++;
      console.log(`no article__body: ${f}`);
      continue;
    }
    // prune attributes everywhere inside the kept nodes
    const prune = (_: number, el: any) => {
      for (const attr of Object.keys(el.attribs ?? {})) {
        if (!KEEP_ATTR.has(attr)) $(el).removeAttr(attr);
      }
    };
    body.find("*").each(prune);
    body.each(prune);
    const metas = $("meta")
      .filter((_, el) => KEEP_META.test($(el).attr("name") ?? ""))
      .toArray()
      .map((el) => {
        for (const attr of Object.keys(el.attribs ?? {})) {
          if (!KEEP_ATTR.has(attr)) $(el).removeAttr(attr);
        }
        return $.html(el);
      })
      .join("\n");
    const out = `<!DOCTYPE html>\n<html>\n<head>\n${metas}\n</head>\n<body>\n${$.html(body)}\n</body>\n</html>\n`;
    after += out.length;
    if (!DRY) await writeFile(path, out);
  }
  const mb = (n: number) => (n / 1e6).toFixed(0);
  console.log(
    `${files.length} files, ${failed} failures, ${mb(before)}MB -> ${mb(after)}MB${DRY ? " (dry)" : ""}`,
  );
};

await main();
