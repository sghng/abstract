#!/usr/bin/env bun
/**
 * repertoire jebs2md: SAGE (jebs) article HTML + JATS XML -> corpus
 * Markdown. Graduated 2026-09-16 from spike P3; xml sub-route added
 * 2026-09-16 (P3 follow-up).
 *
 * FORMAT PRECEDENCE: the manifest may hold both html and xml rows for a
 * doi; html WINS (its MathML converts to TeX via pandoc and its figure
 * imgs carry resolvable /cms/ urls), xml converts only unshadowed dois.
 * Format is taken from the manifest row (fetch fleet's source of truth);
 * the extension corroborates but is not consulted.
 *
 * HTML DOM contract (uniform platform 2011-2026):
 *   article > div(body root, sibling of div.core-nav-wrapper/.core-collateral)
 *     section#abstracts          h2 Abstract + prose divs (research articles;
 *                                reviews/editorials have none)
 *     section#bodymatter         div.core-container > [div prose | section#sec-N
 *                                (h2/h3/h4 + div prose + div.display-formula +
 *                                 figure.graphic + figure.table)]
 *     section#backmatter         section#footnotes|#appendix|#data-availability|
 *                                #bibliography|.core-biographies|.core-orcid|
 *                                .core-supplementary-materials (#orcid sits in
 *                                bodymatter in 2020-21 files -- strips run
 *                                globally)
 *   math: PURE MathML, zero TeX on the platform. span[role=math] >
 *         math[display=inline]; div.display-formula > div.equation >
 *         math[display=block] + div.label "(N)". Rendered by pandoc
 *         (MathML -> TeX); cleanTex then strips renderer spacing noise.
 *   figs figure.graphic > img(/cms/...) + figcaption > div.caption(+div.notes)
 *        or bare figcaption text (era variance inside single files)
 *   tabs figure.table > figcaption (span.heading) + div.table-wrap > table;
 *        complex (colspan/rowspan) -> asset ref, simple -> GFM pipes
 *
 * XML DOM contract (JATS, 2007-2026; census .cache/spike-parse/structure/
 * jebs-xml/census.jsonl): article-meta > title-group > article-title +
 *   abstract (p's) + article-categories subj-group subject (Book Review =
 *   skip); body > sec (title, p, nested sec); inline-formula/disp-formula >
 *   alternatives > mml:math (93% of files: MathML -> TeX via pandoc after
 *   prefix-strip; graphic alternative dropped); fig > label + caption > p +
 *   graphic(.tif); table-wrap > label + caption + alternatives >
 *   graphic(.tif) + table; back > ref-list (STRIPPED) | bio (STRIPPED) |
 *   fn-group | ack | app. XML-referenced image bytes are NOT on disk
 *   (fetch fleet saved xml only): every xml asset row gets a companion
 *   row in the download list (--downloads) for the later fetch pass,
 *   img2latex's resumable mapping+list pattern; url stays null until
 *   that pass resolves it.
 *
 * Bibliography/bios/ORCID stripped at the source construct (training
 * mandate 2026-09-16); in-prose citations stay. # <title> per contract
 * ruling. Assets -> ndjson rows (figNN/tabNN/eqNNNN handles, download
 * derives <doi_id>:<handle>.<ext> keys). Skips (book reviews,
 * front-matter titles) recorded via --skipped, never silently dropped.
 *
 * Pipeline (both routes): cheerio surgery to a clean html fragment, then
 * pandoc
 *   -f html-smart -t markdown+tex_math_dollars-raw_html-fenced_divs
 *      -bracketed_spans-simple_tables-multiline_tables-smart
 *   --wrap=none --markdown-headings=atx
 * (via temp file: Bun 1.4.2 spawnSync{input} feeds empty stdin), then a
 * conservative unescape outside math + cleanTex inside it.
 *
 * Usage: bun src/families/jebs/jebs2md.ts
 *   [--manifest <file>] [--md-dir <dir>] [--ndjson <file>]
 *   [--downloads <file>] [--skipped <file>] [--only <doi_id>]
 */
import * as cheerio from "cheerio";
import * as fs from "node:fs";

const OUT = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const REPO = fs.realpathSync(`${OUT}/../../../..`);
const ROOT = process.env.REP_ROOT ?? `${REPO}/repertoire`;
const PANDOC =
  process.env.PANDOC ??
  (fs.existsSync("/opt/homebrew/bin/pandoc") ? "/opt/homebrew/bin/pandoc" : "pandoc");
const BASE = "https://journals.sagepub.com";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const MANIFEST = arg("manifest", `${ROOT}/.cache/bulk/jebs/manifest.jsonl`);
const MD_DIR = arg("md-dir", `${ROOT}/md/jebs`);
const ASSETS_ND = arg("ndjson", `${ROOT}/.cache/jebs-assets.ndjson`);
const DOWNLOADS = arg("downloads", `${ROOT}/.cache/jebs-xml-downloads.jsonl`);
const SKIPPED = arg("skipped", `${ROOT}/.cache/jebs-skipped.jsonl`);
const ONLY = process.argv.includes("--only") ? arg("only", "") : null;

type Asset = {
  doi: string;
  doi_id: string;
  asset_id: string;
  kind: string;
  url: string | null;
  caption: string;
};
type Download = {
  doi: string;
  doi_id: string;
  asset_id: string;
  kind: string;
  href: string;
};
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
/** Front-matter titles, parity with jem2md/jemxml2md */
const FRONT_MATTER =
  /^(issue information|cover|erratum|corrigendum|correction|obituary|in memoriam|book review|front matter|back matter|list of reviewers|editorial)/i;

/** pandoc html -> markdown on a fragment (temp file: spawnSync stdin bug) */
const TMP = `${ROOT}/.cache/jebs2md-tmp.html`;
const pandoc = (html: string): string => {
  fs.writeFileSync(TMP, html);
  const p = Bun.spawnSync(
    [
      PANDOC,
      "-f",
      "html-smart",
      "-t",
      "markdown+tex_math_dollars-raw_html-fenced_divs-bracketed_spans-simple_tables-multiline_tables-smart",
      "--wrap=none",
      "--markdown-headings=atx",
      TMP,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (p.exitCode !== 0)
    throw new Error(`pandoc: ${p.stderr.toString().slice(0, 200)}`);
  return p.stdout.toString();
};

/** MathML-rendered TeX cleanup: SAGE source has no TeX, so every lone
 * `\ ` is an mspace artifact (lookbehind keeps `\\` row breaks intact);
 * \middle|/\lbrack/\rbrack are stretchy-fence renderings the corpus style
 * writes plain. mtable rows (\begin{array}) are content. */
const cleanTex = (t: string) =>
  t
    .replace(/(?<!\\)\\ +/g, " ")
    .replace(/\\middle\|/g, "|")
    .replace(/\\lbrack/g, "[")
    .replace(/\\rbrack/g, "]");

/** conservative unescape of pandoc's backslash escapes OUTSIDE math/code;
 * cleanTex INSIDE math spans (single-$ spans may hold multi-line arrays) */
const post = (md: string): string =>
  md
    .split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$|`[^`\n]*`)/g)
    .map((part, i) =>
      i % 2 === 1 ? cleanTex(part) : part.replace(/\\([#&%|^~"()\[\]])/g, "$1"),
    )
    .join("");

/** serialize fragment -> pandoc -> post-process -> restore asset tokens */
const finish = (
  $: cheerio.CheerioAPI,
  root: any,
  tokens: Map<string, string>,
): string => {
  const fragment = root
    .contents()
    .toArray()
    .map((n: any) => (n.type === "text" ? (n.data ?? "") : $.html(n)))
    .join("");
  let md = post(pandoc(fragment));
  for (const [t, body] of tokens) md = md.split(t).join(body);
  return (
    md
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "") + "\n"
  );
};

function convertHtml(
  doi: string,
  doiId: string,
  html: string,
): { md: string; assets: Asset[]; downloads: Download[] } {
  const $ = cheerio.load(html);
  const assets: Asset[] = [];
  const article = $("article").first();
  if (!article.length) throw new Error("no <article>");
  const bodyRoot = article
    .children("div")
    .not(".core-nav-wrapper, .core-collateral")
    .filter((_, d) => $(d).find("#bodymatter").length > 0)
    .first();
  if (!bodyRoot.length) throw new Error("no body root (no #bodymatter)");

  const title =
    norm(article.find("header h1").first().text()) ||
    $('meta[name="citation_title"]').attr("content") ||
    "";

  const root = $("<div></div>");
  root.append(`<h1>${title.replace(/[<>]/g, "")}</h1>`);
  const abstracts = bodyRoot.find("#abstracts").first();
  if (abstracts.length) {
    const clone = abstracts.clone();
    clone.find("h2").first().remove();
    root.append("<h2>Abstract</h2>").append(clone.children());
  }
  root.append(bodyRoot.find("#bodymatter").first().children().clone());
  const back = bodyRoot.find("#backmatter > div.core-container").first();
  if (back.length) root.append(back.children().clone());

  // STRIP per mandate, globally (era variance: #orcid sits in bodymatter in
  // 2020-21 files): bibliography list, bios, ORCID, supplementary links
  root
    .find(
      "#bibliography, [role=doc-bibliography], .core-biographies, .core-orcid, .core-supplementary-materials",
    )
    .remove();

  // asset refs are token-protected from pandoc (it escapes image syntax it
  // cannot resolve); restored after conversion
  const tokens = new Map<string, string>();
  const tok = (body: string) => {
    const t = `@@ASSET${tokens.size}@@`;
    tokens.set(t, body);
    return t;
  };

  let figSeq = 0;
  let tabSeq = 0;
  root.find("figure.graphic").each((_, el) => {
    const $el = $(el);
    const capDiv = $el.find("figcaption .caption").first();
    const caption = norm(
      capDiv.length ? capDiv.text() : $el.find("figcaption").first().text(),
    );
    const notes = norm($el.find("figcaption .notes").first().text());
    const src = $el.find("img").first().attr("src") ?? "";
    const id = `fig${String(++figSeq).padStart(2, "0")}`;
    assets.push({
      doi,
      doi_id: doiId,
      asset_id: id,
      kind: "figure",
      url: src ? BASE + src : null,
      caption: notes ? `${caption} ${notes}` : caption,
    });
    $el.replaceWith(
      `<p>${tok(`![${caption.replace(/[[\]]/g, "")}](${id})`)}</p>`,
    );
  });

  root.find("figure.table").each((_, el) => {
    const $el = $(el);
    const caption = norm($el.find("figcaption").first().text());
    const table = $el.find("table").first();
    const cap = caption.replace(/[[\]]/g, "");
    if (table.find("[colspan], [rowspan]").length > 0 || !table.length) {
      const id = `tab${String(++tabSeq).padStart(2, "0")}`;
      assets.push({
        doi,
        doi_id: doiId,
        asset_id: id,
        kind: "table",
        url: null,
        caption,
      });
      $el.replaceWith(`<p>${tok(`![${cap}](${id})`)}</p>`);
    } else {
      // NB: cheerio replaceWith(descendant) drops the node -- marker, then
      // insert the table after it while still attached
      const n = ++tabSeq;
      $el.replaceWith(`<p data-tabmark="${n}">${tok(`**${cap}**`)}</p>`);
      root.find(`p[data-tabmark="${n}"]`).first().after(table.clone());
    }
  });

  // display formulas: unwrap div.equation/div.inner, label -> its own <p>
  root.find("div.display-formula").each((_, el) => {
    const $el = $(el);
    const label = norm($el.find("div.label").first().text());
    $el.find("div.label").remove();
    const math = $el.find("math").first();
    if (math.length) {
      math.attr("display", "block");
      $el.empty().append(math);
    }
    if (label)
      $el.append(`<p>${label.startsWith("(") ? label : `(${label})`}</p>`);
  });

  // inline math: unwrap span[role=math] so pandoc emits bare $..$
  root
    .find("span[role=math]")
    .each((_, el) =>
      $(el).replaceWith(
        $(el).children().length ? $(el).children() : $(el).text(),
      ),
    );
  // spans carry only styling hooks; strip attrs so pandoc emits plain text
  root.find("span").each((_, el) => {
    if (el.attribs)
      for (const k of Object.keys(el.attribs)) $(el).removeAttr(k);
  });
  // internal fragment links (citations, section nav) -> bare text
  root.find('a[href^="#"]').each((_, el) => $(el).replaceWith($(el).text()));
  root
    .find("script, style, svg, .core-xlink-crossref, .external-links, button")
    .remove();

  // prose divs -> <p>: a div whose children are all inline-level
  const BLOCK = new Set([
    "div",
    "section",
    "figure",
    "table",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "blockquote",
    "pre",
  ]);
  const divToP = () => {
    root.find("div").each((_, el) => {
      const kids = $(el).contents().toArray();
      const hasBlock = kids.some(
        (k: any) => k.type === "tag" && BLOCK.has(k.tagName),
      );
      if (!hasBlock && norm($(el).text()))
        $(el).replaceWith(`<p>${$.html($(el).contents())}</p>`);
    });
  };
  divToP();

  // unwrap remaining structural wrappers; serialize contents (a wrapping
  // div would come back as raw html from pandoc)
  const unwrap = (sel: string) =>
    root.find(sel).each((_, el) => $(el).replaceWith($(el).contents()));
  unwrap("div.core-container");
  unwrap("section");
  unwrap("div");
  divToP();

  return {
    md: finish($, root, tokens),
    assets,
    downloads: [],
    skip: null as string | null,
  };
}

// ---------------------------------------------------------------- xml route

/** xml sub-route state */
type XmlCtx = {
  $: cheerio.CheerioAPI; // xml tree (mml: prefixes already stripped)
  h: cheerio.CheerioAPI; // html fragment under construction
  root: any;
  tokens: Map<string, string>;
  assets: Asset[];
  downloads: Download[];
  eqSeq: number;
  figSeq: number;
  tabSeq: number;
};

const tokOf = (ctx: XmlCtx, body: string) => {
  const t = `@@ASSET${ctx.tokens.size}@@`;
  ctx.tokens.set(t, body);
  return t;
};

/** asset without image bytes on disk: row + download-list entry (only when
 * an image href exists -- some complex tables have no graphic alternative) */
const xmlAsset = (
  ctx: XmlCtx,
  doi: string,
  doiId: string,
  kind: "figure" | "table" | "equation",
  href: string,
  caption: string,
) => {
  const prefix = kind === "equation" ? "eq" : kind === "table" ? "tab" : "fig";
  const seq =
    kind === "equation"
      ? ++ctx.eqSeq
      : kind === "table"
        ? ++ctx.tabSeq
        : ++ctx.figSeq;
  const id = `${prefix}${String(seq).padStart(kind === "equation" ? 4 : 2, "0")}`;
  ctx.assets.push({
    doi,
    doi_id: doiId,
    asset_id: id,
    kind,
    url: null,
    caption,
  });
  if (href)
    ctx.downloads.push({ doi, doi_id: doiId, asset_id: id, kind, href });
  return id;
};

/** transfer an xml node into the html fragment (serialize + reparse;
 * mml: prefixes were stripped tree-wide, so math arrives as <math>) */
const send = (ctx: XmlCtx, xmlNode: any, wrap?: string) => {
  const html = ctx.$(xmlNode).length ? ctx.$.html(xmlNode) : String(xmlNode);
  if (wrap) ctx.root.append(`<${wrap}>${html}</${wrap}>`);
  else ctx.root.append(html);
};

/** walk a body/back container (sec, app, body, back, fn-group, ack) */
const walkBlock = (
  ctx: XmlCtx,
  el: any,
  depth: number,
  doi: string,
  doiId: string,
) => {
  const { $, root } = ctx;
  const kids = (el.children ?? []).filter((c: any) => c.type === "tag");
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i];
    const $c = $(child);
    switch (child.name) {
      case "sec":
      case "app":
      case "app-group": {
        const title = norm($c.children("title").first().text());
        root.append(
          `<h${Math.min(depth + 2, 6)}>${title.replace(/[<>]/g, "")}</h${Math.min(depth + 2, 6)}>\n\n`,
        );
        walkBlock(ctx, child, depth + 1, doi, doiId);
        break;
      }
      case "title":
        break; // consumed by the sec case
      case "p": {
        // code listings arrive as RUNS of sibling <p>s, each holding one
        // <monospace> line (R/BUGS appendix blocks): group and fence them
        const codeLine = (e: any) => {
          const tags = (e.children ?? []).filter((c: any) => c.type === "tag");
          return (
            e.name === "p" && tags.length === 1 && tags[0].name === "monospace"
          );
        };
        if (codeLine(child)) {
          const lines: string[] = [norm($c.text())];
          let j = i + 1;
          while (j < kids.length && codeLine(kids[j])) {
            lines.push(norm($(kids[j]).text()));
            j++;
          }
          const esc = lines
            .join("\n")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          root.append(`<pre><code>${esc}</code></pre>\n\n`);
          i = j - 1;
          break;
        }
        send(ctx, child, "p");
        root.append("\n\n");
        break;
      }
      case "list": {
        send(ctx, child); // list/list-item -> pandoc bullets
        root.append("\n\n");
        break;
      }
      case "disp-formula": {
        const label = norm($c.children("label").first().text());
        const math = $c.find("math").first();
        if (math.length) {
          math.attr("display", "block");
          root.append(`<p>${$.html(math)}</p>\n\n`);
        } else {
          const href =
            $c.find("graphic, inline-graphic").first().attr("xlink:href") ??
            $c.find("graphic, inline-graphic").first().attr("href") ??
            "";
          const id = href
            ? xmlAsset(ctx, doi, doiId, "equation", href, "")
            : null;
          if (id) root.append(`<p>${tokOf(ctx, `@@${id}@@`)}</p>\n\n`);
        }
        if (label) root.append(`<p>(${label.replace(/[()]/g, "")})</p>\n\n`);
        break;
      }
      case "fig": {
        const label = norm($c.children("label").first().text());
        const caption = norm($c.find("caption").first().text());
        const href = $c.find("graphic").first().attr("xlink:href") ?? "";
        const id = xmlAsset(
          ctx,
          doi,
          doiId,
          "figure",
          href,
          `${label} ${caption}`.trim(),
        );
        root.append(
          `<p>${tokOf(ctx, `![${`${label} ${caption}`.replace(/[[\]]/g, "")}](${id})`)}</p>\n\n`,
        );
        break;
      }
      case "table-wrap": {
        const label = norm($c.children("label").first().text());
        const caption = norm($c.find("caption").first().text());
        const cap = `${label} ${caption}`.trim();
        const table = $c.find("alternatives > table, table").first();
        const href = $c.find("graphic").first().attr("xlink:href") ?? "";
        if (!table.length || table.find("[colspan], [rowspan]").length > 0) {
          const id = xmlAsset(ctx, doi, doiId, "table", href, cap);
          root.append(
            `<p>${tokOf(ctx, `![${cap.replace(/[[\]]/g, "")}](${id})`)}</p>\n\n`,
          );
        } else {
          ++ctx.tabSeq;
          root.append(
            `<p>${tokOf(ctx, `**${cap.replace(/[[\]]/g, "")}**`)}</p>\n\n`,
          );
          root.append(ctx.$.html(table.get(0)));
          root.append("\n\n");
        }
        break;
      }
      default:
        // unknown block: keep text if any (faithful-prose fallback)
        if (norm($c.text())) {
          send(ctx, child, "p");
          root.append("\n\n");
        }
    }
  }
};

/** review/front-matter detection for the xml route */
const xmlSkipReason = ($: cheerio.CheerioAPI): string | null => {
  const subjects = $("article-categories subj-group subject")
    .toArray()
    .map((e: any) => $(e).text().trim());
  if (subjects.some((s) => /^book reviews?$/i.test(s))) return "book-review";
  const title = $("article-meta title-group article-title")
    .first()
    .text()
    .trim();
  if (FRONT_MATTER.test(title)) return "front-matter";
  return null;
};

function convertXml(
  doi: string,
  doiId: string,
  xml: string,
): {
  md: string;
  assets: Asset[];
  downloads: Download[];
  skip: string | null;
  title: string;
} {
  const $ = cheerio.load(xml, { xml: true });
  const assets: Asset[] = [];
  const downloads: Download[] = [];

  // strip mml: prefixes tree-wide (pandoc's html reader wants <math>)
  $("*").each((_, el: any) => {
    if (el.name?.startsWith("mml:")) {
      el.name = el.name.slice(4);
      if (el.attribs) {
        delete el.attribs["xmlns:mml"];
        delete el.attribs["xmlns"];
      }
    }
  });

  const title = norm(
    $("article-meta title-group article-title").first().text(),
  );
  const skip = xmlSkipReason($);
  if (skip) return { md: "", assets, downloads, skip, title };

  const h = cheerio.load("<div id=jebsxml></div>");
  const root = h("#jebsxml");
  const ctx: XmlCtx = {
    $,
    h,
    root,
    tokens: new Map(),
    assets,
    downloads,
    eqSeq: 0,
    figSeq: 0,
    tabSeq: 0,
  };

  root.append(`<h1>${title.replace(/[<>]/g, "")}</h1>\n\n`);

  const abs = $("article-meta > abstract").first();
  if (abs.length) {
    root.append("<h2>Abstract</h2>\n\n");
    abs.find("p").each((_, p: any) => {
      send(ctx, p, "p");
      root.append("\n\n");
    });
  }

  const body = $("body").first();
  if (!body.length) throw new Error("no <body>");
  walkBlock(ctx, body.get(0), 0, doi, doiId);

  // back: strip ref-list + bio (mandate); keep fn-group/ack/app as sections.
  // fn-group may sit directly under back OR inside a <notes> wrapper.
  const renderBackContainer = (container: any) => {
    for (const child of container.children ?? []) {
      if (child.type !== "tag") continue;
      const name = child.name;
      if (name === "ref-list" || name === "bio" || name === "author-notes")
        continue;
      if (name === "notes") {
        renderBackContainer(child);
      } else if (name === "fn-group") {
        root.append(
          `<h2>${norm($(child).children("title").first().text()) || "Footnotes"}</h2>\n\n`,
        );
        $(child)
          .find("fn")
          .each((_, fn: any) => {
            const lbl = norm($(fn).children("label").first().text());
            $(fn)
              .find("p")
              .each((_, p: any) => {
                let text = norm($(p).text());
                // mandate: ORCID/e-mail footnotes never enter (author chrome)
                if (
                  /^ORCID\s/i.test(text) ||
                  /https?:\/\/orcid\.org\//.test(text)
                )
                  return;
                text = text.replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "");
                if (!text) return;
                root.append(
                  `<p>${lbl ? `${lbl} ` : ""}${text.replace(/[<>]/g, "")}</p>\n\n`,
                );
              });
          });
      } else if (name === "ack") {
        root.append(
          `<h2>${norm($(child).children("title").first().text()) || "Acknowledgments"}</h2>\n\n`,
        );
        $(child)
          .find("p")
          .each((_, p: any) => {
            send(ctx, p, "p");
            root.append("\n\n");
          });
      } else {
        walkBlock(ctx, child, 0, doi, doiId);
      }
    }
  };
  const back = $("back").first();
  if (back.length) renderBackContainer(back.get(0));

  // inline formulae already carry <math>; unwrap their wrappers so the
  // html parser sees inline math, and drop citation xref wrappers
  root
    .find("inline-formula")
    .each((_, el: any) =>
      h(el).replaceWith(
        h(el).children().length ? h(el).children() : h(el).text(),
      ),
    );
  root
    .find("xref, ext-link")
    .each((_, el: any) => h(el).replaceWith(h(el).text()));

  // monospace = code, on the fragment side (element construction on the
  // xml-loaded instance corrupts serialization there): multi-line chunks
  // (R/BUGS blocks live inside <p>) -> pre/code -- the html parser closes
  // the surrounding <p> at <pre>; inline identifiers -> <code>
  root.find("monospace").each((_, el: any) => {
    const $el = h(el);
    const text = $el.text();
    if (text.includes("\n")) {
      $el.replaceWith(h("<pre></pre>").append(h("<code></code>").text(text)));
    } else {
      $el.replaceWith(h("<code></code>").text(text));
    }
  });

  return {
    md: finish(h, root, ctx.tokens),
    assets,
    downloads,
    skip: null,
    title,
  };
}

const main = () => {
  fs.mkdirSync(MD_DIR, { recursive: true });
  const all = fs
    .readFileSync(MANIFEST, "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse)
    .filter(
      (r: any) =>
        (r.format === "html" || r.format === "xml") &&
        (!ONLY || r.doi_id === ONLY),
    );
  // FORMAT PRECEDENCE: html > xml per doi (html MathML converts to TeX and
  // its figure urls resolve; xml image bytes are not on disk)
  const pick = new Map<string, any>();
  let shadowed = 0;
  for (const r of all) {
    const cur = pick.get(r.doi_id);
    if (!cur) pick.set(r.doi_id, r);
    else if (cur.format === "xml" && r.format === "html") pick.set(r.doi_id, r);
    else shadowed++;
  }
  const out = fs.openSync(ASSETS_ND, "w");
  const dl = fs.openSync(DOWNLOADS, "w");
  const skp = fs.openSync(SKIPPED, "w");
  let converted = 0;
  let failures = 0;
  let skips = 0;
  let dlRows = 0;
  for (const r of pick.values()) {
    try {
      const src = fs.readFileSync(
        r.file.startsWith("/") ? r.file : `${ROOT}/${r.file}`,
        "utf8",
      );
      const res =
        r.format === "html"
          ? convertHtml(r.doi, r.doi_id, src)
          : convertXml(r.doi, r.doi_id, src);
      if (res.skip) {
        fs.writeSync(
          skp,
          JSON.stringify({
            doi_id: r.doi_id,
            format: r.format,
            reason: res.skip,
            title: res.title,
          }) + "\n",
        );
        skips++;
        continue;
      }
      fs.writeFileSync(`${MD_DIR}/${r.doi_id}.md`, res.md);
      for (const a of res.assets) fs.writeSync(out, JSON.stringify(a) + "\n");
      for (const d of res.downloads) {
        fs.writeSync(dl, JSON.stringify(d) + "\n");
        dlRows++;
      }
      converted++;
    } catch (e: any) {
      console.log(`${r.doi_id}: ${e.message}`);
      failures++;
    }
  }
  fs.closeSync(out);
  fs.closeSync(dl);
  fs.closeSync(skp);
  if (ONLY) {
    // probe leaves no state
    for (const f of [ASSETS_ND, DOWNLOADS, SKIPPED])
      if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  try {
    fs.unlinkSync(TMP);
  } catch {}
  console.log(
    `jebs2md: converted ${converted}, skipped ${skips} (-> ${SKIPPED}), failures ${failures}; xml shadowed by html: ${shadowed}; download-list rows ${dlRows} (-> ${DOWNLOADS})`,
  );
};

main();
