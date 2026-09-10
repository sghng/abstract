#!/usr/bin/env bun
/**
 * repertoire jemxml2md: Wiley-namespaced XML -> Markdown. XML shadows HTML:
 * run after jem2md; overwrites jem/md/{doi_id}.md for every paper with XML.
 *
 * Tag policy (empirical, see docs/repertoire.md):
 *   STRUCTURE  section/title -> headings by depth; p; list/listItem;
 *              abstractGroup (header) -> "## Abstract"; bibliography -> refs;
 *              appendix/noteGroup rendered in place
 *   STYLING    i -> _x_, b -> **x**; sub/sup/sc/span -> bare text
 *   NAVIGATION link -> bare text (citation xrefs; pointers discarded)
 *   CONTENT    figure/tabular/displayedItem/inlineGraphic/math-without-TeX
 *              -> asset placeholders, rows appended to
 *              .cache/jem-xml-assets.ndjson (id {doi_id}-fig-NNNN etc.)
 *   MATH       annotation[encoding="application/x-tex"] verbatim (Wiley's
 *              annotations include the $..$ delimiters); math without
 *              annotation (12 files) -> @@EQIMG via wiley:location PNG
 *   DROP       copyright/legalStatement/publisherInfo boilerplate
 *
 * Tables: CALS tgroup; any entry span -> caption + asset ref (never raw
 * HTML), else pipe table (parity with jem2md).
 *
 * Usage: bun jem/jemxml2md.ts [--only <doi_id>]
 */
import { readdirSync, readFileSync, writeFileSync, openSync, closeSync, writeSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import * as cheerio from "cheerio";

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const XML_DIR = arg("xml-dir", `${ROOT}/jem/xml`);
const MD_DIR = arg("md-dir", `${ROOT}/jem/md`);
const ASSETS_ND = arg("ndjson", `${ROOT}/.cache/jem-xml-assets.ndjson`);
const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

type Asset = { doi: string; doi_id: string; asset_id: string; kind: string; url: string | null; caption: string | null };
type Ctx = { doi: string; doiId: string; assets: Asset[]; eqSeq: number; figSeq: number; tabSeq: number; tokens: Map<string, string>; tokSeq: number };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
/** Wiley caption boilerplate, not content */
const BOILER = /\s*[Cc]olo?ur figure can be viewed at wileyonlinelibrary\.com\s*/g;
const cleanCap = (s: string) => norm(s.replace(BOILER, " "));
const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** graphic/... relative asset href -> stored url (resolver tries patterns at download time) */
const graphicUrl = (ctx: Ctx, href: string) =>
  href.startsWith("http") || href.startsWith("urn:") ? null : `https://onlinelibrary.wiley.com/doi/${ctx.doi}/${href}`;

/** block content nested inside a <p>: token-protect so norm() cannot
 * collapse its newlines; restored after the paragraph is assembled */
const blockToken = (ctx: Ctx, body: string): string => {
  const t = `@@BLK${++ctx.tokSeq}@@`;
  ctx.tokens.set(t, body);
  return t;
};

/** inline rendering of mixed content -> markdown string */
const inline = ($: cheerio.CheerioAPI, node: any, ctx: Ctx): string => {
  if (!node) return "";
  let out = "";
  for (const el of node.children ?? []) {
    if (el.type === "text") {
      out += el.data;
      continue;
    }
    if (el.type !== "tag") continue;
    const $el = $(el);
    const inner = () => inline($, el, ctx);
    switch (el.tagName) {
      case "i": {
        const t = inner();
        // whole-paragraph italics are layout styling, not emphasis
        out += t.length > 300 ? t : `_${t}_`;
        break;
      }
      case "b": {
        const t = inner();
        out += t.length > 300 ? t : `**${t}**`;
        break;
      }
      case "sub":
      case "sup":
      case "sc":
      case "span":
      case "link":
      case "url":
      case "linkSpan":
        out += inner();
        break;
      case "inlineGraphic": {
        // 2005-era inline equation GIF
        ctx.eqSeq++;
        const id = `eq${pad(ctx.eqSeq, 4)}`;
        ctx.assets.push({ doi: ctx.doi, doi_id: ctx.doiId, asset_id: id, kind: "equation", url: graphicUrl(ctx, $el.attr("location") ?? $el.attr("href") ?? ""), caption: null });
        out += `@@${id}@@`;
        break;
      }
      case "math": {
        const tex = $el.find('annotation[encoding="application/x-tex"]').first().text().trim();
        if (tex) {
          out += tex; // annotations include their own $..$ delimiters
        } else {
          // MathML without TeX (12 files): image placeholder for img2latex
          ctx.eqSeq++;
          const id = `eq${pad(ctx.eqSeq, 4)}`;
          ctx.assets.push({ doi: ctx.doi, doi_id: ctx.doiId, asset_id: id, kind: "equation", url: graphicUrl(ctx, $el.attr("wiley:location") ?? ""), caption: null });
          out += `@@${id}@@`;
        }
        break;
      }
      case "br":
        out += " ";
        break;
      case "displayedItem":
        out += blockToken(ctx, displayed($, el, ctx));
        break;
      case "list":
      case "listPaired": {
        // lists nested inside <p> (2005 era): inline them as (1) ...; (2) ...
        const items = $el
          .children("listItem, listItemPair")
          .toArray()
          .map((li) => {
            const $li = $(li);
            const lbl = norm($li.children("label").first().text());
            const body = $li
              .children()
              .toArray()
              .filter((c) => c.tagName !== "label")
              .map((c) => inline($, c, ctx))
              .join(" ");
            return (lbl ? `(${lbl}) ` : "") + body;
          });
        out += items.join("; ");
        break;
      }
      default:
        out += inner(); // unknown inline: keep text, drop wrapper
    }
  }
  return out;
};

/** display equation block -> $$..$$ or placeholder, plus (label) line */
const displayed = ($: cheerio.CheerioAPI, el: any, ctx: Ctx): string => {
  const $el = $(el);
  const label = norm($el.children("label").first().text());
  const math = $el.find("math").first();
  let body: string;
  if (math.length) {
    const tex = math.find('annotation[encoding="application/x-tex"]').first().text().trim();
    if (tex) {
      body = tex.replace(/^\$+|\$+$/g, "").trim();
      body = `$$\n${body}\n$$`;
    } else {
      ctx.eqSeq++;
      const id = `eq${pad(ctx.eqSeq, 4)}`;
      ctx.assets.push({ doi: ctx.doi, doi_id: ctx.doiId, asset_id: id, kind: "equation", url: graphicUrl(ctx, math.attr("wiley:location") ?? ""), caption: null });
      body = `@@${id}@@`;
    }
  } else {
    // 2005 era: mediaResourceGroup GIF
    ctx.eqSeq++;
    const id = `eq${pad(ctx.eqSeq, 4)}`;
    const mr = $el.find("mediaResource[href]").toArray().map((m) => $(m).attr("href") ?? "").find((h) => h.includes("graphic/")) ?? "";
    ctx.assets.push({ doi: ctx.doi, doi_id: ctx.doiId, asset_id: id, kind: "equation", url: graphicUrl(ctx, mr), caption: null });
    body = `@@${id}@@`;
  }
  return `\n\n${body}${label ? `\n\n(${label})` : ""}\n\n`;
};

const figure = ($: cheerio.CheerioAPI, el: any, ctx: Ctx): string => {
  const $el = $(el);
  const label = norm($el.children("label").first().text());
  const caption = cleanCap(inline($, $el.children("caption").get(0), ctx)).replace(/[\[\]]/g, "");
  const id = `fig${pad(++ctx.figSeq, 2)}`;
  const mr = $el
    .find("mediaResource[href]")
    .toArray()
    .map((m) => $(m).attr("href") ?? "")
    .find((h) => h.includes("graphic/")) ?? "";
  ctx.assets.push({ doi: ctx.doi, doi_id: ctx.doiId, asset_id: id, kind: "figure", url: graphicUrl(ctx, mr), caption });
  return `\n\n![${caption ? `Figure ${label} ${caption}` : `Figure ${label}`}](${id})\n\n`;
};

const tabular = ($: cheerio.CheerioAPI, el: any, ctx: Ctx): string => {
  const $el = $(el);
  const label = norm($el.children("label").first().text());
  const caption = cleanCap(inline($, $el.children("titleGroup").first().find('title[type="main"]').get(0), ctx));
  const id = `tab${pad(++ctx.tabSeq, 2)}`;
  const cap = `Table ${label}${caption ? ` ${caption}` : ""}`.replace(/[\[\]]/g, "");
  ctx.assets.push({ doi: ctx.doi, doi_id: ctx.doiId, asset_id: id, kind: "table", url: null, caption: cap });
  const entries = $el.find("table entry").toArray();
  const complex = entries.some((e) => {
    const a = e.attribs ?? {};
    return a.spanname || a.namest || a.morerows;
  });
  if (complex) {
    return `\n\n![${cap}](${id})\n\n`;
  }
  // simple grid -> pipe table
  const rows: string[][] = [];
  for (const scope of ["thead row", "tbody row"]) {
    for (const r of $el.find(scope).toArray()) {
      const cells = $(r)
        .find("entry")
        .toArray()
        .map((c) => norm(inline($, c, ctx)).replace(/\|/g, "\\|"));
      if (cells.length) rows.push(cells);
    }
  }
  if (!rows.length) return `\n\n![${cap}](${id})\n\n`;
  const width = Math.max(...rows.map((r) => r.length));
  const padRow = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const pipe =
    `| ${padRow(rows[0]).join(" | ")} |\n| ${Array(width).fill("---").join(" | ")} |\n` +
    rows.slice(1).map((r) => `| ${padRow(r).join(" | ")} |`).join("\n");
  return `\n\n**${cap}**\n\n${pipe}\n\n`;
};

/** block-level walk of a container (section, abstract, appendix, note) */
const blocks = ($: cheerio.CheerioAPI, node: any, ctx: Ctx, depth: number): string => {
  if (!node) return "";
  let out = "";
  for (const el of node.children ?? []) {
    if (el.type !== "tag") continue;
    const $el = $(el);
    switch (el.tagName) {
      case "title":
        out += `\n\n${"#".repeat(Math.min(depth + 1, 6))} ${norm(inline($, el, ctx))}\n\n`;
        break;
      case "p":
        out += `\n\n${norm(inline($, el, ctx))}\n\n`;
        break;
      case "section":
        out += blocks($, el, ctx, depth + 1);
        break;
      case "displayedItem":
        out += displayed($, el, ctx);
        break;
      case "figure":
        out += figure($, el, ctx);
        break;
      case "tabular":
      case "tabularFixed":
        out += tabular($, el, ctx);
        break;
      case "list":
      case "listPaired":
        out +=
          "\n\n" +
          $el
            .children("listItem, listItemPair")
            .toArray()
            .map((li) => {
              const $li = $(li);
              const body = $li
                .children()
                .toArray()
                .filter((c) => c.tagName !== "label")
                .map((c) => norm(inline($, c, ctx)))
                .join(" ");
              return `- ${body}`;
            })
            .join("\n") +
          "\n\n";
        break;
      case "noteGroup":
        out += blocks($, el, ctx, depth);
        break;
      case "note":
        out += `\n\n${norm(inline($, el, ctx))}\n\n`;
        break;
      case "appendix":
        out += blocks($, el, ctx, depth);
        break;
      case "blockFixed": // fixed-position figure/table wrapper
        out += blocks($, el, ctx, depth);
        break;
      case "mathStatement":
      case "lineatedText":
      case "computerCode":
        out += `\n\n${norm(inline($, el, ctx))}\n\n`;
        break;
      case "bibliography":
        break; // handled separately at top level
      default:
        out += `\n\n${norm(inline($, el, ctx))}\n\n`;
    }
  }
  return out;
};

function convert(doi: string, doiId: string, xml: string): { md: string; assets: Asset[] } {
  const $ = cheerio.load(xml, { xml: true });
  const ctx: Ctx = { doi, doiId, assets: [], eqSeq: 0, figSeq: 0, tabSeq: 0, tokens: new Map(), tokSeq: 0 };
  let md = "";

  // abstract from header (parity with html article__body which includes it)
  const abs = $("abstractGroup abstract").first();
  if (abs.length) {
    abs.children("title").remove(); // we supply the heading
    const absBody = blocks($, abs.get(0), ctx, 0);
    md += `## Abstract\n\n${absBody.replace(/^\n+|\n+$/g, "")}\n\n`;
  }

  const body = $("body").first();
  if (!body.length) throw new Error("no <body>");
  md += blocks($, body.get(0), ctx, 0);

  // bibliography
  const bib = $("bibliography").first();
  if (bib.length) {
    md += `\n\n## References\n\n`;
    for (const b of bib.find("bib").toArray()) {
      const text = norm(inline($, b, ctx));
      if (text) md += `- ${text}\n`;
    }
  }

  // restore block tokens, then collapse 3+ newlines, trim
  for (const [t, body] of ctx.tokens) md = md.split(t).join(body);
  md = md.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "") + "\n";
  return { md, assets: ctx.assets };
}

const main = () => {
  mkdirSync(MD_DIR, { recursive: true });
  // JEM converter: only Wiley DOIs, whatever dir the xml lives in
  const files = readdirSync(XML_DIR).filter((f) => f.startsWith("10.1111") && f.endsWith(".xml"));
  const out = openSync(ASSETS_ND, "w");
  let converted = 0;
  let failures = 0;
  for (const f of files) {
    const doiId = f.replace(/\.xml$/, "");
    if (ONLY && doiId !== ONLY) continue;
    const doi = doiId.replace(":", "/");
    try {
      const { md, assets } = convert(doi, doiId, readFileSync(`${XML_DIR}/${f}`, "utf8"));
      writeFileSync(`${MD_DIR}/${doiId}.md`, md);
      for (const a of assets) writeSync(out, JSON.stringify(a) + "\n");
      converted++;
    } catch (e: any) {
      console.log(`${f}: ${e.message}`);
      failures++;
    }
  }
  closeSync(out);
  if (existsSync(ASSETS_ND) && ONLY) unlinkSync(ASSETS_ND); // probe mode leaves no state
  console.log(`converted ${converted}, failures ${failures}`);
};

main();
