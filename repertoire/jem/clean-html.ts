#!/usr/bin/env bun
/**
 * repertoire jem-clean-html: Wiley-specific in-place slimming of article
 * HTML. Self-contained (no shared pass): strips script/style/svg/noscript
 * and HTML comments, plus Wiley UI chrome: <button> (figure viewer,
 * citation widgets), <form> (search/login), <iframe> (ads), and
 * render-chrome anchors Wiley injects at serve time (Google Scholar
 * getFTRLinkout, OpenURL/EBSCO linkout, cdn-cgi email obfuscation -- all
 * proven absent from the article XML source, so removal loses nothing).
 * Content selectors (article__body, citation_* metas) are untouched.
 * Validate by re-running jem2md and diffing md/.
 *
 * Usage: bun jem/clean-html.ts [--in dir] [--out dir] [--dry]
 *   defaults: --in jem/html (in place)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const HTML_DIR = arg("in", `${ROOT}/jem/html`);
const OUT_DIR = arg("out", HTML_DIR);
const DRY = process.argv.includes("--dry");

const PAIRED = /<(script|style|svg|noscript|button|form|iframe)\b[\s\S]*?<\/\1\s*>/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
// render-chrome anchors (an <a> never nests another <a>); each pattern
// proven absent from the article XML source, so removal loses nothing
const LINKOUT =
  /<a\b[^>]*href="[^"]*(?:getFTRLinkout|servlet\/linkout|cdn-cgi\/l\/email-protection)[^"]*"[^>]*>[\s\S]*?<\/a\s*>/gi;

const main = async () => {
  const files = (await readdir(HTML_DIR)).filter((f) => f.endsWith(".html"));
  let before = 0;
  let after = 0;
  let changed = 0;
  for (const f of files) {
    const html = await readFile(`${HTML_DIR}/${f}`, "utf8");
    const cleaned = html
      .replace(PAIRED, "")
      .replace(COMMENTS, "")
      .replace(LINKOUT, "");
    before += html.length;
    after += cleaned.length;
    if (cleaned !== html) {
      changed++;
      if (!DRY) await writeFile(`${OUT_DIR}/${f}`, cleaned);
    } else if (!DRY && OUT_DIR !== HTML_DIR) {
      await writeFile(`${OUT_DIR}/${f}`, cleaned);
    }
  }
  const mb = (n: number) => (n / 1e6).toFixed(0);
  console.log(
    `${files.length} files, ${changed} cleaned, ${mb(before)}MB -> ${mb(after)}MB${DRY ? " (dry)" : ""}`,
  );
};

await main();
