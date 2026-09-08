#!/usr/bin/env bun
/**
 * repertoire jem-clean-html: Wiley-specific in-place slimming of article
 * HTML. Self-contained (no shared pass): strips script/style/svg/noscript
 * and HTML comments (ad/tracking JS, icon sprites), plus Wiley UI chrome:
 * <button> (Open in figure viewer / PowerPoint, citation widgets), <form>
 * (search/login widgets), <iframe> (ad/widget embeds). Also strips
 * render-chrome anchors that Wiley's CMS injects at serve time (PROVEN
 * absent from the Wiley XML source of the same articles -- zero
 * information loss): Google Scholar getFTRLinkout, OpenURL/EBSCO
 * servlet/linkout (nests an <img> button), Cloudflare cdn-cgi email
 * obfuscation. Content selectors (article__body, citation_* metas) are
 * untouched. Validate by re-running jem2md and diffing md/.
 *
 * Usage: bun jem/clean-html.ts [--dry]
 */
import { readdir, readFile, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const HTML_DIR = `${ROOT}/jem/html`;
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
    const path = `${HTML_DIR}/${f}`;
    const html = await readFile(path, "utf8");
    const cleaned = html
      .replace(PAIRED, "")
      .replace(COMMENTS, "")
      .replace(LINKOUT, "");
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
