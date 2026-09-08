#!/usr/bin/env bun
/**
 * repertoire clean-html: strip non-content from downloaded article HTML,
 * in place. Removes script, style, svg, noscript and HTML comments (roughly
 * 2/3 of the bytes: ad/tracking JS and icon sprites). Content selectors
 * (div.body, div.abstract, citation_* metas) are untouched.
 *
 * Usage: bun src/clean-html.ts [--dry]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const HTML_DIR = `${ROOT}/html`;
const DRY = process.argv.includes("--dry");

// paired tags; script/style content can contain '<' so match lazily to the
// first closing tag (publisher HTML never nests the same tag inside itself)
const PAIRED = /<(script|style|svg|noscript)\b[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

const main = async () => {
  const files = (await readdir(HTML_DIR)).filter((f) => f.endsWith(".html"));
  let before = 0;
  let after = 0;
  let changed = 0;
  for (const f of files) {
    const path = `${HTML_DIR}/${f}`;
    const html = await readFile(path, "utf8");
    const cleaned = html.replace(PAIRED, "").replace(COMMENTS, "");
    before += html.length;
    after += cleaned.length;
    if (cleaned !== html) {
      changed++;
      if (!DRY) await writeFile(path, cleaned);
    }
  }
  const mb = (n: number) => (n / 1e6).toFixed(0);
  console.log(
    `${files.length} files, ${changed} cleaned, ${mb(before)}MB -> ${mb(after)}MB${DRY ? " (dry)" : ""}`,
  );
};

await main();
