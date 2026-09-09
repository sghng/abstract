#!/usr/bin/env bun
/**
 * JEM (Wiley) HTML -> Markdown. Parallel of psy2md.ts for the Wiley schema.
 *
 * Markup (raw server HTML, not the MathJax-mutated DOM):
 *   body root     div.article__body
 *   abstract      section with h2.abstractlang_en (inside the article flow)
 *   sections      h2.article-section__title / h3.article-section__sub-title
 *   math 2022+    <math> with <annotation encoding="application/x-tex">$...$;
 *                 display math annotated as $$...\begin{equation}...\end{equation}$$
 *   math 2020-21  <img class="section_image" src=".../<asset>-math-NNNN.png">
 *                 (no TeX on the page -> placeholder tokens for img2latex)
 *   figures       div.figure > img.figure__image + figcaption.figure__caption
 *   tables        real <table> in div.article-table-content-wrapper, caption
 *                 in header.article-table-caption -> GFM pipe tables when the
 *                 grid is simple, raw HTML when colspans appear
 *
 * Output: md/{doi_id}.md; assets appended to .cache/jem-assets.ndjson.
 * Math becomes @@MATH<n>@@ tokens, restored after turndown (turndown would
 * escape LaTeX backslashes).
 */
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import * as fs from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const HTML = arg("html-dir", `${ROOT}/jem/html`);
const MD = arg("md-dir", `${ROOT}/jem/md`);
const ASSETS_ND = arg("ndjson", `${ROOT}/.cache/jem-assets.ndjson`);
// XML shadows HTML: html converts only papers with no xml on disk
const XML_IDS = new Set(
  fs.readdirSync(`${ROOT}/jem/xml`).map((f) => f.replace(/\.xml$/, "")),
);
const FRONT_MATTER =
  /^(issue information|cover|erratum|corrigendum|correction|obituary|in memoriam|book review|front matter|back matter|list of reviewers|editorial)/i;

function convert(doi: string, doiId: string, html: string): { md: string; assets: object[] } {
  const $ = cheerio.load(html);
  const assets: object[] = [];
  const tokens: string[] = [];
  const token = (s: string) => {
    tokens.push(s);
    return `@@MATH${tokens.length - 1}@@`;
  };

  const body = $("div.article__body").first();
  if (!body.length) throw new Error("no div.article__body");
  const root = $("<div></div>");
  root.append(body.children().clone());

  // equations: <math> with tex annotation -> token; image math -> placeholder token
  root.find("math").each((_, el) => {
    const ann = $(el).find('annotation[encoding="application/x-tex"]').first().text().trim();
    if (!ann) {
      $(el).remove();
      return;
    }
    let tex = ann;
    // unwrap $$\begin{equation}X\end{equation}$$ -> $$X$$
    const m = tex.match(/^\$\$\\begin\{equation\}([\s\S]*)\\end\{equation\}\$\$$/);
    if (m) tex = `$$${m[1].trim()}$$`;
    $(el).replaceWith(token(tex));
  });
  let eqSeq = 0;
  root.find("img.section_image").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    const m = src.match(/([a-z]+\d+-math-\d+)\.png/);
    if (!m) {
      $(el).remove();
      return;
    }
    const assetId = `eq${String(++eqSeq).padStart(4, "0")}`;
    assets.push({ doi, doi_id: doiId, asset_id: assetId, kind: "equation", url: `https://onlinelibrary.wiley.com${src}`, caption: null });
    $(el).replaceWith(token(`@@${assetId}@@`));
  });
  // drop the image-fallback spans that shadow math elements
  root.find("span.fallback__mathEquation").remove();

  // figures -> ![caption](fig01) -- doc-order handle; url mapping in assets
  let figSeq = 0;
  root.find("figure.figure").each((_, el) => {
    const img = $(el).find("img.figure__image").first();
    const src = img.attr("data-lg-src") ?? img.attr("src") ?? "";
    const m = src.match(/([a-z]+\d+-fig-\d+)/);
    const caption = $(el)
      .find("figcaption")
      .first()
      .text()
      .replace(/Open in figure viewer|PowerPoint/g, "")
      .replace(/@@MATH(\d+)@@/g, (_, i) => tokens[Number(i)])
      .replace(/\s+/g, " ")
      .trim();
    if (!m) {
      $(el).remove();
      return;
    }
    const assetId = `fig${String(++figSeq).padStart(2, "0")}`;
    assets.push({ doi, doi_id: doiId, asset_id: assetId, kind: "figure", url: `https://onlinelibrary.wiley.com${src}`, caption });
    $(el).replaceWith(`<p>![${caption.replace(/[\[\]]/g, "")}](${assetId})</p>`);
  });

  // tables -> pipe table (simple grids) or raw HTML (colspan/rowspan)
  let tabNo = 0;
  root.find("div.article-table-content-wrapper").each((_, el) => {
    const wrap = $(el).parent();
    const caption = wrap.find("header.article-table-caption").first().text().replace(/\s+/g, " ").trim();
    const table = $(el).find("table").first();
    const complex = table.find("[colspan], [rowspan]").length > 0;
    tabNo++;
    const assetId = `tab${String(tabNo).padStart(2, "0")}`;
    assets.push({ doi, doi_id: doiId, asset_id: assetId, kind: "table", url: null, caption });
    let md: string;
    if (complex) {
      // raw HTML tables are layout, not prose, and a single line can exceed
      // 100K chars -- keep caption + asset ref, same convention as Cambridge
      md = `\n\n![${caption.replace(/[\[\]]/g, "")}](${assetId})\n\n`;
    } else {
      const rows: string[][] = [];
      table.find("tr").each((_, tr) => {
        const cells: string[] = [];
        $(tr)
          .find("th, td")
          .each((_, c) => cells.push($(c).text().replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")));
        if (cells.length) rows.push(cells);
      });
      const width = Math.max(...rows.map((r) => r.length), 1);
      const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
      const head = rows[0] ?? [];
      md =
        `**${caption}**\n\n` +
        `| ${pad(head).join(" | ")} |\n| ${Array(width).fill("---").join(" | ")} |\n` +
        rows.slice(1).map((r) => `| ${pad(r).join(" | ")} |`).join("\n");
    }
    // token-protect: raw text in the DOM loses newlines to HTML whitespace
    // collapse; restore after turndown like equations
    $(el).parent().replaceWith(`<p>${token(`\n\n${md}\n\n`)}</p>`);
  });

  // unwrap internal fragment links (citations, cross-refs), keep text
  root.find("a[href^='#']").each((_, el) => $(el).replaceWith($(el).text()));
  // drop nav/aside/script/style and reference-list link chrome
  root.find("script, style, nav, aside, .article-footer, .loa-wrapper").remove();

  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  let md = td.turndown($.html(root));
  // restore tokens repeatedly: tables embed cell-level math tokens
  while (/@@MATH\d+@@/.test(md))
    md = md.replace(/@@MATH(\d+)@@/g, (_, i) => tokens[Number(i)]);
  md = md.replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { md, assets };
}

fs.mkdirSync(MD, { recursive: true });
const out = fs.openSync(ASSETS_ND, "w");
let done = 0;
const failures: string[] = [];
for (const f of fs.readdirSync(HTML).filter((f) => f.endsWith(".html"))) {
  const doi_id = f.replace(/\.html$/, "");
  if (XML_IDS.has(doi_id)) continue; // xml shadows html
  const html = fs.readFileSync(`${HTML}/${f}`, "utf8");
  const title =
    html.match(/<meta name="citation_title" content="([^"]*)"/)?.[1] ??
    html.match(/<title>([^<]*)<\/title>/)?.[1] ??
    "";
  if (FRONT_MATTER.test(title)) continue; // front-matter pages, not articles
  try {
    const { md, assets } = convert(doi_id.replace(":", "/"), doi_id, html);
    fs.writeFileSync(`${MD}/${doi_id}.md`, md);
    for (const a of assets) fs.writeSync(out, JSON.stringify(a) + "\n");
    done++;
  } catch (e) {
    failures.push(`${doi_id}: ${String(e).slice(0, 100)}`);
  }
}
fs.closeSync(out);
console.log(`converted ${done}, failures ${failures.length}`);
failures.forEach((f) => console.log("  FAIL", f));
