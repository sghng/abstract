#!/usr/bin/env bun
/**
 * repertoire psy2md: Cambridge article HTML -> Markdown corpus files.
 *
 * Strategy: structural surgery with cheerio on div.body, then turndown for
 * generic markup (headings, lists, emphasis, links).
 *
 *   span.tex-math        -> its text (publisher LaTeX, $..$ already present)
 *   div.fig-ada          -> ![caption](figNN)  + assets row
 *   div.table-wrap-ada   -> ![caption](tabNN)  + assets row
 *   all other img        -> dropped (equation glyphs, badges)
 *
 * Writes md/{doi_id}.md and .cache/assets-{doi_id}.sql; use --apply to push
 * asset rows to D1.
 */
import { readdir, writeFile, mkdir } from "node:fs/promises";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const HTML_DIR = arg("html-dir", `${ROOT}/html`);
const MD_DIR = arg("md-dir", `${ROOT}/md`);
const SQL_PATH = arg("sql", `${ROOT}/.cache/assets.sql`);
const APPLY = process.argv.includes("--apply");

interface Asset {
  handle: string;
  doi: string;
  kind: "figure" | "table";
  url: string | null;
  caption: string;
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
// drop anchors' href when it is an internal fragment (#sec1, #bib5)
turndown.addRule("internalLinks", {
  filter: (node) =>
    node.nodeName === "A" && (node.getAttribute("href") ?? "").startsWith("#"),
  replacement: (content) => content,
});

function convert(html: string, doi: string, doiId: string): { md: string; assets: Asset[] } {
  const $ = cheerio.load(html);
  let body = $("div.body").first();
  if (!body.length) throw new Error("no div.body");
  // prepend the abstract (lives OUTSIDE div.body in div.abstract, both eras)
  const abstract = $("div.abstract").first();
  if (abstract.length) {
    const wrapped = $("<div></div>");
    wrapped.append("<h2>Abstract</h2>");
    wrapped.append(abstract.clone());
    wrapped.append(body.clone());
    body = wrapped as any;
  }
  const assets: Asset[] = [];

  // strip junk
  body.find("script, style, svg, noscript").remove();

  // equations: each span.alternatives pairs a tex-math span with a fallback
  // img. Replace with a token; the TeX is restored AFTER turndown so its
  // backslashes/underscores are not markdown-escaped.
  const maths: string[] = [];
  const cleanTex = (raw: string) =>
    raw
      .replace(/\s+/g, " ")
      .trim()
      // Springer-era tex-math wraps the formula in a full document preamble
      .replace(/^\\documentclass.*?\\begin\{document\}\s*/, "")
      .replace(/\s*\\end\{document\}\s*$/, "");
  body.find("span.alternatives").each((_, el) => {
    const tex = cleanTex($(el).find("span.tex-math").first().text());
    maths.push(tex);
    $(el).replaceWith(tex ? ` @@MATH${maths.length - 1}@@ ` : " ");
  });
  body.find("span.tex-math").each((_, el) => {
    const tex = cleanTex($(el).text());
    maths.push(tex);
    $(el).replaceWith(` @@MATH${maths.length - 1}@@ `);
  });
  body.find("span.mathjax-tex-wrapper, span.alternatives, img").remove();

  // figures and tables -> asset tokens
  let figNo = 0;
  let tabNo = 0;
  body.find("div.fig-ada, div.table-wrap-ada").each((_, el) => {
    const $el = $(el);
    const isTable = $el.hasClass("table-wrap-ada");
    const no = isTable ? ++tabNo : ++figNo;
    const kind = isTable ? "table" : "figure";
    const handle = `${isTable ? "tab" : "fig"}${String(no).padStart(2, "0")}`;
    const caption = $el
      .find("div.caption")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const url = $el.find("img[data-src]").attr("data-src") ?? null;
    assets.push({ handle, doi, kind, url, caption });
    $el.replaceWith(`<p>@@ASSET:${handle}@@</p>`);
  });
  // any remaining images are glyphs/badges
  body.find("img").remove();
  // orphan caption divs (already consumed)
  body.find("div.caption").remove();

  let md = turndown.turndown($.html(body));

  // replace tokens with image-style references
  for (const a of assets) {
    const cap = a.caption.replace(/[[\]]/g, "");
    md = md.replace(`@@ASSET:${a.handle}@@`, `![${cap}](${a.handle})`);
  }
  // restore protected math (verbatim, no markdown escaping)
  md = md.replace(/@@MATH(\d+)@@/g, (_, i) => maths[Number(i)]);
  // tidy whitespace
  md = md.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim() + "\n";
  return { md, assets };
}

const esc = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);

const main = async () => {
  const files = (await readdir(HTML_DIR)).filter((f) => f.endsWith(".html"));
  console.log(`converting ${files.length} html files`);
  const allSql: string[] = [];
  let figTotal = 0;
  let tabTotal = 0;
  for (const [i, f] of files.entries()) {
    const doiId = f.replace(/\.html$/, "");
    const doi = doiId.replace(":", "/");
    try {
      const html = await Bun.file(`${HTML_DIR}/${f}`).text();
      const { md, assets } = convert(html, doi, doiId);
      await mkdir(MD_DIR, { recursive: true });
      await writeFile(`${MD_DIR}/${doiId}.md`, md);
      for (const a of assets) {
        allSql.push(
          `insert or replace into assets (doi, handle, kind, url, caption) values ` +
            `(${esc(a.doi)}, ${esc(a.handle)}, ${esc(a.kind)}, ${esc(a.url)}, ${esc(a.caption)});`,
        );
      }
      figTotal += assets.filter((a) => a.kind === "figure").length;
      tabTotal += assets.filter((a) => a.kind === "table").length;
      if ((i + 1) % 50 === 0) console.log(`[${i + 1}/${files.length}]`);
    } catch (e: any) {
      console.log(`${doiId} FAILED: ${e.message}`);
    }
  }
  const sqlPath = SQL_PATH;
  await writeFile(sqlPath, allSql.join("\n") + "\n");
  console.log(`${figTotal} figures, ${tabTotal} tables; ${allSql.length} asset rows -> ${sqlPath}`);
  if (APPLY) {
    const proc = Bun.spawn(
      ["npx", "wrangler", "d1", "execute", "repertoire", "--remote", "--file", sqlPath],
      { stdout: "pipe", stderr: "pipe" },
    );
    console.log((await proc.exited) === 0 ? "assets pushed to D1" : "D1 push FAILED");
  }
};

await main();
