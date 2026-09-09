#!/usr/bin/env bun
/**
 * repertoire clean-html: strip non-content from downloaded article HTML.
 * Pipeline stage raw/ -> html/: reads pristine raw HTML, writes the
 * cleaned working copy (script/style/svg/noscript/comments out, roughly
 * 2/3 of the bytes: ad/tracking JS and icon sprites). Content selectors
 * (div.body, div.abstract, citation_* metas) are untouched.
 *
 * Usage: bun src/clean-html.ts [--in dir] [--out dir] [--dry]
 *   defaults: --in raw --out html
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const IN_DIR = arg("in", `${ROOT}/raw`);
const OUT_DIR = arg("out", `${ROOT}/html`);
const DRY = process.argv.includes("--dry");

// paired tags; script/style content can contain '<' so match lazily to the
// first closing tag (publisher HTML never nests the same tag inside itself)
const PAIRED = /<(script|style|svg|noscript)\b[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;

const main = async () => {
  const files = (await readdir(IN_DIR)).filter((f) => f.endsWith(".html"));
  if (!DRY) await mkdir(OUT_DIR, { recursive: true });
  let before = 0;
  let after = 0;
  let changed = 0;
  for (const f of files) {
    const html = await readFile(`${IN_DIR}/${f}`, "utf8");
    const cleaned = html.replace(PAIRED, "").replace(COMMENTS, "");
    before += html.length;
    after += cleaned.length;
    if (cleaned !== html) {
      changed++;
      if (!DRY) await writeFile(`${OUT_DIR}/${f}`, cleaned);
    } else if (!DRY && IN_DIR !== OUT_DIR) {
      await writeFile(`${OUT_DIR}/${f}`, cleaned);
    }
  }
  const mb = (n: number) => (n / 1e6).toFixed(0);
  console.log(
    `${files.length} files, ${changed} cleaned, ${mb(before)}MB -> ${mb(after)}MB${DRY ? " (dry)" : ""}`,
  );
};

await main();
