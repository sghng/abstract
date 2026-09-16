#!/usr/bin/env bun
/**
 * repertoire docx2md: psyarxiv .docx -> corpus Markdown. Graduated
 * 2026-09-16 from spike P3b (state: .cache/spike-parse/docx/, eval
 * P=.996 R=.941 on 628 hand-labeled heading candidates).
 *
 * INPUT CONTRACT (census 16 + smoke 40, 2016-2026):
 *   raw-new/<doi_id>.docx from the psyarxiv manifest (697 rows: 691 zip,
 *   6 OLE2 .doc misnamed .docx). Section marking: ~12% real Word heading
 *   styles (incl. German LibreOffice berschrift* styleIds -- pandoc maps
 *   them via w:name "heading N"), the rest bold pseudo-headings (three
 *   flavors: size-tiered, flat+centered-top, bold+ALL-CAPS); ~10% are
 *   not article-shaped (pointer docs, supplements, blog posts).
 *
 * PIPELINE: OLE2 magic -> textutil -convert docx hop (temp) -> ONE
 *   pandoc call with the sibling docx-heal.lua (heading V1+ promotion,
 *   native-header cleanup, # title injection, References strip
 *   header-to-header, equation-table lift to $$..$$) -> md post-pass.
 *   The MARKDOWN writer (not gfm) is load-bearing: OMML lands natively
 *   as $..$/$$..$$ (0 fences / 0 $`x`$ across 56 spike conversions);
 *   gfm was spike P3's entire math problem. The post-pass rewrites the
 *   writer's `$`<!-- -->`{=html}` math-adjacency separators to a space
 *   (-raw_attribute instead SILENTLY corrupts $x$0 adjacency on
 *   re-read). Residuals (title-block emails/ORCIDs, grid tables,
 *   question-headings): see spike NOTES.md.
 *
 * GATE: content docs need structure -- bytes < 1.5KB -> skip fragment;
 *   zero ## sections -> skip no-sections (pointer/affiliation/blog/
 *   flat docs, ~10%: recorded, not lost). Convention: skipped.jsonl
 *   rows {doi_id, reason, category, title}.
 *
 * Usage:  bun src/families/psyarxiv/docx2md.ts <doi_id>       md->stdout, report->stderr
 *         bun src/families/psyarxiv/docx2md.ts --batch [--out <dir>] [doi_id...]
 *                                                          (default: every manifest
 *                                                          docx row; writes .md +
 *                                                          report.jsonl + skipped.jsonl)
 * Import: convert / DocxReport
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const HERE = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const ROOT = fs.realpathSync(`${HERE}/../../../..`) + "/repertoire";
const PANDOC = "/opt/homebrew/bin/pandoc";
const LUA = `${HERE}/docx-heal.lua`;
const MANIFEST = `${ROOT}/.cache/bulk/psyarxiv/manifest.jsonl`;
const FLAGS = [
  "-f", "docx",
  "-t", "markdown+tex_math_dollars-raw_html-fenced_divs-bracketed_spans-simple_tables-multiline_tables-smart",
  "--wrap=none", "--markdown-headings=atx", "--lua-filter", LUA,
];
// textutil hops lose bold on some left-aligned headings (whole-para
// italics remain); the filter's emph fallback is hop-only
const FLAGS_HOP = [...FLAGS, "--metadata=heal-emph:1"];
const OLE2 = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
const MIN_BYTES = 1500; // hjygt pointer doc converts to 99B; real articles are >9KB

export interface DocxReport {
  doi_id: string;
  status: "ok" | "skip" | "fail";
  kind: "docx" | "doc-hop" | "";
  title: string | null;
  h2: number;
  h3: number;
  abstract: boolean;
  math_inline: number;
  math_display: number;
  math_fences: number; // ```math; must be 0 (markdown writer)
  backtick_math: number; // $`x`$; must be 0
  html_sep_normalized: number;
  refs_stripped: boolean;
  skip: { reason: string; category: string } | null;
  in_bytes: number;
  out_bytes: number;
  err?: string;
}
export interface DocxResult {
  md: string; // "" on fail/skip
  report: DocxReport;
  skipped: { doi_id: string; reason: string; category: string; title: string } | null;
}

type Row = { doi: string; doi_id: string; format: string; file: string; year: number };

let ROWS: Row[] | null = null;
function manifestRows(): Row[] {
  if (!ROWS) {
    ROWS = fs.readFileSync(MANIFEST, "utf8").trim().split("\n").map(JSON.parse)
      .filter((r: Row) => r.format === "docx");
  }
  return ROWS;
}
function rowFor(doiId: string): Row {
  const r = manifestRows().find((x) => x.doi_id === doiId);
  if (!r) throw new Error(`no docx manifest row for ${doiId}`);
  return r;
}

/** OLE2 .doc misnamed .docx -> real docx via macOS textutil (6/697) */
function textutilHop(src: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "psyarxiv-hop-"));
  const dst = path.join(dir, "hop.docx");
  const t = spawnSync("textutil", ["-convert", "docx", "-output", dst, src], { timeout: 60_000 });
  if (t.status !== 0) throw new Error(`textutil: ${(t.stderr ?? "").toString().slice(0, 120)}`);
  return dst; // caller unlinks dir
}

/** writer math-adjacency separators; plain space re-reads math-safe */
function normalize(md: string): { md: string; seps: number } {
  let seps = 0;
  const out = md
    .replace(/\$`<!-- -->`\{=html\}/g, () => { seps++; return "$ "; })
    .replace(/`<!-- -->`\{=html\}/g, () => { seps++; return " "; });
  return { md: out.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "") + "\n", seps };
}

function stats(md: string) {
  const h2 = (md.match(/^## /gm) ?? []).length;
  const h3 = (md.match(/^### /gm) ?? []).length;
  const title = md.match(/^# (.+)$/m)?.[1]?.trim() ?? null;
  return {
    h2, h3, title,
    abstract: /^## Abstract\b/m.test(md),
    math_display: Math.floor((md.match(/\$\$/g) ?? []).length / 2),
    math_inline: (md.match(/(^|[^$])\$(?!\$)[^$\n]+\$(?!\$)/g) ?? []).length,
    math_fences: (md.match(/^```math/gm) ?? []).length,
    backtick_math: (md.match(/\$`/g) ?? []).length,
    refs_stripped: !/^#{2,3} .*references?\s*$/im.test(md),
  };
}

export function convert(doiId: string): DocxResult {
  const row = rowFor(doiId);
  const report: DocxReport = {
    doi_id: doiId, status: "fail", kind: "docx", title: null, h2: 0, h3: 0,
    abstract: false, math_inline: 0, math_display: 0, math_fences: 0,
    backtick_math: 0, html_sep_normalized: 0, refs_stripped: true,
    skip: null, in_bytes: 0, out_bytes: 0,
  };
  const src = `${ROOT}/${row.file}`;
  let inPath = src;
  let hopDir: string | null = null;
  try {
    report.in_bytes = fs.statSync(src).size;
    if (fs.readFileSync(src).subarray(0, 4).equals(OLE2)) {
      inPath = textutilHop(src);
      hopDir = path.dirname(inPath);
      report.kind = "doc-hop";
    }
    const tmpOut = `${inPath}.md`;
    const p = spawnSync(PANDOC, [...(hopDir ? FLAGS_HOP : FLAGS), inPath, "-o", tmpOut], { timeout: 120_000, maxBuffer: 1 << 26 });
    if (p.status !== 0) throw new Error(`pandoc: ${(p.stderr ?? "").toString().split("\n").slice(0, 2).join(" | ").slice(0, 160)}`);
    const { md, seps } = normalize(fs.readFileSync(tmpOut, "utf8"));
    fs.rmSync(tmpOut, { force: true });
    const st = stats(md);
    Object.assign(report, st, { html_sep_normalized: seps, out_bytes: Buffer.byteLength(md) });
    // gates: fragment bytes / zero-structure docs are recorded, not written
    if (report.out_bytes < MIN_BYTES) {
      report.status = "skip";
      report.skip = { reason: `converted output ${report.out_bytes}B < ${MIN_BYTES}B`, category: "fragment" };
    } else if (st.h2 === 0) {
      report.status = "skip";
      report.skip = { reason: "no ## sections (not article-shaped)", category: "no-sections" };
    } else {
      report.status = "ok";
    }
    const skipped = report.skip
      ? { doi_id: doiId, reason: report.skip.reason, category: report.skip.category, title: st.title ?? "" }
      : null;
    return { md: report.status === "ok" ? md : "", report, skipped };
  } catch (e: any) {
    report.err = String(e.message ?? e).slice(0, 200);
    return { md: "", report, skipped: null };
  } finally {
    if (hopDir) fs.rmSync(hopDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const safe = (id: string) => id.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (args[0] === "--batch") {
    const outIdx = args.indexOf("--out");
    const outDir = outIdx > 0 ? args[outIdx + 1] : null;
    if (!outDir) {
      console.error("usage: bun src/families/psyarxiv/docx2md.ts --batch [--out <dir>] [doi_id...]");
      process.exit(2);
    }
    fs.mkdirSync(outDir, { recursive: true });
    const want = args.filter((a, i) => a !== "--batch" && a !== "--out" && i !== outIdx + 1 && !a.startsWith("--"));
    const rows = want.length ? want.map((id) => rowFor(id)) : manifestRows();
    const reportFile = `${outDir}/report.jsonl`;
    const skippedFile = `${outDir}/skipped.jsonl`;
    fs.writeFileSync(reportFile, "");
    fs.writeFileSync(skippedFile, "");
    let ok = 0, skips = 0, fails = 0;
    for (const r of rows) {
      const { md, report, skipped } = convert(r.doi_id);
      if (report.status === "ok") {
        fs.writeFileSync(`${outDir}/${safe(r.doi_id)}.md`, md);
        ok++;
      } else if (report.status === "skip") skips++;
      else fails++;
      fs.appendFileSync(reportFile, JSON.stringify(report) + "\n");
      if (skipped) fs.appendFileSync(skippedFile, JSON.stringify(skipped) + "\n");
      console.log(
        `${report.status.padEnd(4)} ${r.doi_id} h=${report.h2}/${report.h3} math=${report.math_display}d/${report.math_inline}i` +
          `${report.skip ? ` SKIP[${report.skip.category}]` : ""}${report.err ? ` ERR ${report.err.slice(0, 60)}` : ""}`,
      );
    }
    console.log(`\n${rows.length} items: ${ok} ok, ${skips} skipped, ${fails} fails -> ${outDir}`);
  } else if (args[0] && !args[0].startsWith("--")) {
    const { md, report } = convert(args[0]);
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(md);
    if (report.status === "fail") process.exit(1);
  } else {
    console.error("usage: bun src/families/psyarxiv/docx2md.ts <doi_id> | --batch [--out <dir>] [doi_id...]");
    process.exit(2);
  }
}
