#!/usr/bin/env bun
/**
 * Parse work queue (production run 2026-09-18): one row per paper, the
 * best source format per the route table in docs/repertoire/parse.md, the
 * R2 key to stage, and the route that converts it. Emits
 * .cache/bulk/parse/<route>.queue.jsonl + none.tsv (skip ledger) and a
 * census. Routes: tex (pandoc ladder), pdf (docling wrap), ocr (olmOCR,
 * scan slice), html, xml, docx.
 *
 * Route priority per family (from the route table, cluster test 2026-09-18):
 *   arxiv     tex > pdf ; neither = metadata-only skip
 *   psy       html > pdf(era: <1961 ocr, 1961-2011 pdf, 2012+ none) ; xml aux only
 *   jem       xml > pdf ; html is abstract-only (rides pdf twin)
 *   bjmsp     xml > pdf ; html abstract-only
 *   jebs      html > xml > pdf (jebs2md's own precedence: html MathML
 *             converts to TeX and its figure urls resolve)
 *   psyarxiv  docx > pdf
 *   jem pdf with year <= 2004 routes ocr (publisher text layers garbled
 *   in the 1996-2004 capture; bake-off 2026-09-18).
 */
import * as fs from "node:fs";
const BULK = new URL("../.cache/bulk/", import.meta.url).pathname.replace(
  /\/$/,
  "",
);
const OUT = `${BULK}/parse`;
fs.mkdirSync(OUT, { recursive: true });

type Row = {
  doi_id: string;
  fam: string;
  year: number;
  route: string;
  fmt: string;
  key: string;
  bytes: number | null;
  reason?: string;
};

function pick(
  fam: string,
  F: Set<string>,
  year: number,
): { route: string; fmt: string; reason?: string } {
  switch (fam) {
    case "arxiv":
      if (F.has("tex")) return { route: "tex", fmt: "tex" };
      if (F.has("pdf")) return { route: "pdf", fmt: "pdf" };
      return { route: "none", fmt: "", reason: "metadata-only" };
    case "psychometrika":
      if (F.has("html")) return { route: "html", fmt: "html" };
      if (F.has("pdf")) {
        if (year < 1961) return { route: "ocr", fmt: "pdf" };
        if (year <= 2011) return { route: "pdf", fmt: "pdf" };
        return {
          route: "none",
          fmt: "",
          reason: "table-source doctrine (pdf 2012+, no html)",
        };
      }
      return {
        route: "none",
        fmt: "",
        reason: F.has("xml") ? "aux-only xml" : "no md-format source",
      };
    case "jem":
      if (F.has("xml")) return { route: "xml", fmt: "xml" };
      if (F.has("pdf"))
        return year <= 2004
          ? { route: "ocr", fmt: "pdf" }
          : { route: "pdf", fmt: "pdf" };
      return {
        route: "none",
        fmt: "",
        reason: "abstract-only html, no pdf twin",
      };
    case "bjmsp":
      if (F.has("xml")) return { route: "xml", fmt: "xml" };
      if (F.has("pdf")) return { route: "pdf", fmt: "pdf" };
      return {
        route: "none",
        fmt: "",
        reason: "abstract-only html, no pdf twin",
      };
    case "jebs":
      if (F.has("html")) return { route: "html", fmt: "html" };
      if (F.has("xml")) return { route: "xml", fmt: "xml" };
      if (F.has("pdf")) return { route: "pdf", fmt: "pdf" };
      return { route: "none", fmt: "", reason: "no source" };
    case "psyarxiv":
      if (F.has("docx")) return { route: "docx", fmt: "docx" };
      if (F.has("pdf")) return { route: "pdf", fmt: "pdf" };
      return { route: "none", fmt: "", reason: "no source" };
    default:
      return { route: "none", fmt: "", reason: `unknown family ${fam}` };
  }
}

const DIRS: [string, string][] = [
  ["arxiv", "arxiv"],
  ["psy", "psychometrika"],
  ["jem", "jem"],
  ["bjmsp", "bjmsp"],
  ["jebs", "jebs"],
  ["psyarxiv", "psyarxiv"],
];
const byPaper = new Map<
  string,
  { fam: string; year: number; F: Map<string, { bytes: number | null }> }
>();
// universe = papers.jsonl per family; manifest rows attach artifacts
for (const [dir, fam] of DIRS) {
  const up = `${BULK}/${dir}/papers.jsonl`;
  if (fs.existsSync(up)) {
    for (const l of fs.readFileSync(up, "utf8").split("\n")) {
      if (!l.trim()) continue;
      const m = JSON.parse(l) as { doi_id: string; year: number | null };
      byPaper.set(m.doi_id, { fam, year: m.year ?? 0, F: new Map() });
    }
  }
  const p = `${BULK}/${dir}/manifest.jsonl`;
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split("\n")) {
    if (!l.trim()) continue;
    const m = JSON.parse(l) as {
      doi_id: string;
      format: string;
      year: number;
      bytes?: number;
    };
    let e = byPaper.get(m.doi_id);
    if (!e) {
      e = { fam, year: m.year, F: new Map() };
      byPaper.set(m.doi_id, e);
    }
    e.F.set(m.format, { bytes: m.bytes ?? null });
  }
}

const rows: Row[] = [];
for (const [doi_id, e] of byPaper) {
  const { route, fmt, reason } = pick(e.fam, new Set(e.F.keys()), e.year);
  const src = route === "none" ? null : e.F.get(fmt)!;
  rows.push({
    doi_id,
    fam: e.fam,
    year: e.year,
    route,
    fmt,
    key: fmt ? `raw/${doi_id}.${fmt}` : "",
    bytes: src?.bytes ?? null,
    reason,
  });
}

const routes = ["tex", "pdf", "ocr", "html", "xml", "docx"];
const census: Record<string, { papers: number; gb: number }> = {};
for (const r of [...routes, "none"]) {
  const sub = rows.filter((x) => x.route === r);
  const gb = sub.reduce((s, x) => s + (x.bytes ?? 0), 0) / 1e9;
  census[r] = { papers: sub.length, gb: +gb.toFixed(1) };
  const fname = r === "none" ? "none.tsv" : `${r}.queue.jsonl`;
  const body =
    r === "none"
      ? [
          "doi_id\tfam\tyear\treason",
          ...sub.map((x) => `${x.doi_id}\t${x.fam}\t${x.year}\t${x.reason}`),
        ].join("\n") + "\n"
      : sub.map((x) => JSON.stringify(x)).join("\n") + "\n";
  fs.writeFileSync(`${OUT}/${fname}`, body);
}
console.log(JSON.stringify({ papers: rows.length, ...census }, null, 1));
