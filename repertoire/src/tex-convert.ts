#!/usr/bin/env bun
/**
 * tex-convert: arXiv e-print -> corpus markdown (parse layer, on top of
 * tex-extract). Per item: extract -> detectMain -> expandInputs ->
 * bibStrip -> \paragraph demotion (bold lead-in, contract ruling
 * 2026-09-16) -> title/abstract extraction -> pandoc with preprocess
 * ladder escalation (r0-r3) -> post-pass (heading shift so \section
 * lands at ##, trailing-References sweep, metrics, stub gate).
 *
 * Writer flags from spike P1: `-f latex -t markdown --wrap=none`.
 * `--markdown-headings=atx` verified byte-identical on 3 samples
 * (already the writer default) -- omitted.
 *
 * LaTeXML escalator: HOOK ONLY (glue untested at scale). convert()
 * emits a structured escalate record (reasons + command template) when
 * the ladder is exhausted or residual raw-tex density exceeds
 * RESIDUAL_ESCALATE_PER_KB. Executing it is a later stage:
 *   latexmlc --quiet --noparse --nocomments --dest=<dir>/<id>.html <dir>/expanded.tex
 *   pandoc -f html -t markdown --wrap=none <dir>/<id>.html -o <dir>/<id>.md
 *   then strip ltx_* classes/fences and ltx_ERROR spans (spike state:
 *   .cache/spike-parse/tex/latexml/). ~30x slower than pandoc; expected
 *   <2% of items (ladder-exhausted) plus high-residual rescues.
 *
 * Usage:  bun src/tex-convert.ts <doi_id>              md->stdout, report->stderr
 *         bun src/tex-convert.ts --batch <ids> --out <dir>   120k-scale entry
 * Import: convert / ConvertReport
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";
import { extract, detectMain, expandInputs, bibStrip, preprocess } from "./tex-extract.ts";

const PANDOC = "/opt/homebrew/bin/pandoc";
const PANDOC_TO_MD = ["-f", "latex", "-t", "markdown", "--wrap=none"];
const PANDOC_TO_PLAIN = ["-f", "latex", "-t", "plain", "--wrap=none"];
const RESIDUAL_ESCALATE_PER_KB = 1.5; // corrected metric (newline-tolerant $ strip): clean <=0.8, macro-degraded rescues ~1.6; P1's 3.0 was calibrated on its under-stripped counter
const STUB_BYTES = 1024;
const ESCALATE_TEMPLATE =
  "latexmlc --quiet --noparse --nocomments --dest=<dir>/<id>.html <dir>/expanded.tex && " +
  "pandoc -f html -t markdown --wrap=none <dir>/<id>.html -o <dir>/<id>.md";

export interface ConvertReport {
  doi_id: string;
  status: "ok" | "stub" | "fail";
  kind: string;
  members: number;
  tex_members: number;
  main: string | null;
  main_note: string | null;
  docclass_files: number;
  inputs_inlined: number;
  inputs_unresolved: string[];
  bib: { env: number; cmd: number; manual: boolean; truncated: boolean; section_redefs: number };
  ladder: string; // r0..r3 | ladder-exhausted | "" on early fail
  pandoc_err?: string;
  title: { how: "title" | "centerline" | "center-env" | "none"; text: string | null };
  abstract_env: boolean;
  paragraphs_demoted: number;
  refs_swept: boolean;
  headings_out: number;
  sections_src: number;
  chapters_src: number;
  headings_vs_sections: number;
  math_display_out: number;
  math_inline_out: number;
  math_src_env: number;
  math_src_inline: number;
  residual_bs: number;
  residual_per_kb: number;
  in_bytes: number;
  out_bytes: number;
  out_in_ratio: number;
  refs_absent: boolean;
  escalate: { reasons: string[]; cmd: string } | null;
  err?: string;
}
export interface ConvertResult {
  md: string; // "" on fail; stub md still returned (caller checks status)
  report: ConvertReport;
}

// ---------- small helpers (local; tex-extract keeps its own) ----------
function consumeGroup(src: string, i: number, open: string, close: string): number {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") { i += 2; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i + 1; }
    i++;
  }
  return i;
}
// Bun 1.4.2 spawnSync{input} feeds empty stdin (P3 trap): pandoc always
// reads a temp file here. Returns {ok, errHead}.
function pandocRun(inFile: string, outFile: string, toPlain = false): { ok: boolean; errHead?: string } {
  const r = spawnSync(PANDOC, [...(toPlain ? PANDOC_TO_PLAIN : PANDOC_TO_MD), "-o", outFile, inFile], {
    timeout: 60_000,
    maxBuffer: 1 << 24,
  });
  if (r.status === 0) return { ok: true };
  const errHead = ((r.stderr ?? Buffer.alloc(0)).toString("utf8").split("\n").slice(0, 2).join(" | ").slice(0, 160))
    || `pandoc exit ${r.status}${r.signal ? ` (${r.signal})` : ""}`;
  return { ok: false, errHead };
}

// ---------- source-level post-bibStrip transforms ----------
// \paragraph/\subparagraph -> \textbf{Lead.} (contract: bold lead-in,
// not a heading; applied pre-conversion so pandoc never emits h4/h5)
function demoteParagraphs(source: string): { text: string; demoted: number } {
  const re = /\\(?:sub)?paragraph\s*\{/g;
  let out = "";
  let pos = 0;
  let demoted = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const br = source.indexOf("{", m.index + m[0].length - 1);
    const end = consumeGroup(source, br, "{", "}");
    let lead = source.slice(br + 1, end - 1).replace(/\\label\s*\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    if (!lead) continue;
    if (!/[.!?:;]$/.test(lead)) lead += ".";
    out += source.slice(pos, m.index) + `\\textbf{${lead}} `;
    pos = end;
    demoted++;
    re.lastIndex = pos;
  }
  return { text: out + source.slice(pos), demoted };
}
function plain(fragment: string, dir: string): string {
  const inFile = `${dir}/frag.tex`;
  const outFile = `${dir}/frag.txt`;
  fs.writeFileSync(inFile, fragment);
  if (!pandocRun(inFile, outFile, true).ok) return fragment.replace(/\\[a-zA-Z]+\s*/g, "").replace(/\s+/g, " ").trim();
  return fs.readFileSync(outFile, "utf8").replace(/\s+/g, " ").trim();
}
// # title glue: \title{} (thanks/labels dropped) > \centerline{\LARGE\bf T}
// (first 8KB) > first \textbf{} of a leading center env. The matched
// construct is removed from the body source so it cannot duplicate.
function extractTitle(source: string, dir: string): { title: string | null; how: ConvertReport["title"]["how"]; text: string } {
  const m1 = /\\title\s*\{/.exec(source);
  if (m1) {
    const br = source.indexOf("{", m1.index);
    const end = consumeGroup(source, br, "{", "}");
    const inner = source.slice(br + 1, end - 1)
      .replace(/\\thanks\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
      .replace(/\\label\s*\{[^}]*\}/g, "")
      .replace(/\\\\/g, " ");
    const t = plain(inner, dir);
    if (t) return { title: t, how: "title", text: source.slice(0, m1.index) + source.slice(end) };
  }
  // style-provided title commands (\icmltitle, \aistatstitle, ...):
  // any \*title{...} except running/short variants
  const m1b = /\\(?:[a-zA-Z]+)?title\s*\{/g;
  let mb: RegExpExecArray | null;
  while ((mb = m1b.exec(source))) {
    const name = source.slice(mb.index + 1, mb.index + mb[0].length - 1).trim();
    if (/^(runningtitle|shorttitle)$/i.test(name)) continue;
    const br = source.indexOf("{", mb.index);
    const end = consumeGroup(source, br, "{", "}");
    const inner = source.slice(br + 1, end - 1)
      .replace(/\\thanks\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, "")
      .replace(/\\label\s*\{[^}]*\}/g, "")
      .replace(/\\\\/g, " ");
    const t = plain(inner, dir);
    if (t && t.length > 3) return { title: t, how: "title", text: source.slice(0, mb.index) + source.slice(end) };
  }
  const m2 = /\\centerline\s*\{/g;
  let mm: RegExpExecArray | null;
  while ((mm = m2.exec(source)) && mm.index < 8000) {
    const br = source.indexOf("{", mm.index);
    const end = consumeGroup(source, br, "{", "}");
    const inner = source.slice(br + 1, end - 1);
    if (!/\\(?:bf|bfseries|LARGE|Large|large|Huge|huge|sc)\b/.test(inner)) continue;
    // single pass, space-preserving: two sequential strips once glued
    // \LARGE onto the following word (\LARGE\bf X -> \LARGEX -> dropped)
    const t = plain(inner.replace(/\\(?:bf|bfseries|it|itshape|rm|rmfamily|tt|ttfamily|sc|scshape|normalfont|Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b\s*/g, " "), dir);
    if (t && t.length > 3) return { title: t, how: "centerline", text: source.slice(0, mm.index) + source.slice(end) };
  }
  // leading center envs: \textbf{...} or a font/bold brace group
  // ({\bf T}, {\Large \bf T}, {\large\bf T}) -- first 24KB, up to 4 envs
  const cRe = /\\begin\{center\}/g;
  let mc: RegExpExecArray | null;
  let tried = 0;
  while ((mc = cRe.exec(source)) && mc.index < 24000 && tried < 4) {
    tried++;
    const ce = source.indexOf("\\end{center}", mc.index);
    if (ce < 0) break;
    const block = source.slice(mc.index, ce);
    const blockEnd = ce + "\\end{center}".length;
    const strip1 = (s: string) => s
      .replace(/\\(?:bf|bfseries|it|itshape|rm|rmfamily|tt|ttfamily|sc|scshape|normalfont|Huge|huge|LARGE|Large|large|normalsize|small|footnotesize|scriptsize|tiny)\b\s*/g, " ")
      .replace(/\\par\b\s*/g, " ")
      .replace(/\\\\/g, " ")
      .replace(/\\label\s*\{[^}]*\}/g, "");
    // \textbf{...}
    const tb = /\\textbf\s*\{/.exec(block);
    if (tb) {
      const br = block.indexOf("{", tb.index);
      const end = consumeGroup(block, br, "{", "}");
      const t = plain(strip1(block.slice(br + 1, end - 1)), dir);
      if (t && t.length > 3) return { title: t, how: "center-env", text: source.slice(0, mc.index) + source.slice(blockEnd) };
    }
    // font/bold brace group: {\bf T}, {\Large \bf T}, ...
    const fg = /\{\s*\\(?:bf|bfseries|Large|LARGE|large|Huge|huge|sc)[a-zA-Z]*(?:\s|\})/.exec(block);
    if (fg) {
      const br = block.indexOf(fg[0]);
      const end = consumeGroup(block, br, "{", "}");
      const t = plain(strip1(block.slice(br + 1, end - 1)), dir);
      if (t && t.length > 3) return { title: t, how: "center-env", text: source.slice(0, mc.index) + source.slice(blockEnd) };
    }
  }
  return { title: null, how: "none", text: source };
}
function extractAbstract(source: string): { abs: string | null; text: string } {
  const i = source.indexOf("\\begin{abstract}");
  if (i < 0) return { abs: null, text: source };
  const j = source.indexOf("\\end{abstract}", i);
  if (j < 0) return { abs: null, text: source }; // unterminated: leave in body
  return { abs: source.slice(i + "\\begin{abstract}".length, j), text: source.slice(0, i) + source.slice(j + "\\end{abstract}".length) };
}

// ---------- md post-pass ----------
// pandoc emits \section as h1 when the body has no class context: shift so
// the shallowest body heading lands at ## (contract: ## sections, ###
// subsections; deeper = #### subsubsections).
function shiftHeadings(md: string): string {
  const levels = [...md.matchAll(/^#{1,6}(?= \S)/gm)].map((m) => m[0].length);
  if (!levels.length) return md;
  const shift = Math.max(0, 2 - Math.min(...levels));
  if (!shift) return md;
  return md.replace(/^(#{1,6})(?= \S)/gm, (h) => "#".repeat(Math.min(6, h.length + shift)));
}
// belt and braces: cut a TRAILING References heading section if the
// source-level bibStrip missed a manual one. Only fires when the heading
// is the last heading in the document.
function sweepReferences(md: string): { text: string; swept: boolean } {
  const lines = md.split("\n");
  let lastRef = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,4}\s*References?\b/.test(lines[i])) lastRef = i;
  }
  if (lastRef < 0) return { text: md, swept: false };
  for (let i = lastRef + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) return { text: md, swept: false };
  }
  return { text: lines.slice(0, lastRef).join("\n").replace(/\n+$/, "\n"), swept: true };
}
function stripMathSpans(s: string): string {
  // single-$ spans are newline-tolerant (pandoc emits multi-line inline
  // math); [^$] keeps the match from crossing into the next span
  return s.replace(/\$\$[\s\S]+?\$\$/g, "").replace(/\$[^$]+\$/g, "");
}
function mathCounts(md: string): { display: number; inline: number } {
  const display = (md.match(/\$\$[\s\S]+?\$\$/g) || []).length;
  const noDisp = md.replace(/\$\$[\s\S]+?\$\$/g, "");
  let inline = 0;
  let inMath = false;
  for (let i = 0; i < noDisp.length; i++) {
    if (noDisp[i] === "\\") { i++; continue; }
    if (noDisp[i] === "$") {
      if (!inMath) { inline++; inMath = true; } else { inMath = false; }
    }
  }
  return { display, inline };
}
function srcMathCounts(src: string): { env: number; inline: number } {
  const env = (src.match(/\\begin\{(?:equation|align|eqnarray|gather|multline|displaymath|math|alignat|flalign|eqalign|split|IEEEeqnarray\*?|dmath\*?)\*?\}/g) || []).length
    + (src.match(/\\\[/g) || []).length;
  let dollars = 0;
  const paren = (src.match(/\\\(/g) || []).length;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "\\") { i++; continue; }
    if (src[i] === "$") { if (src[i + 1] === "$") { i++; continue; } dollars++; }
  }
  return { env, inline: paren + Math.floor(dollars / 2) };
}
const refsAbsent = (md: string) =>
  !/^#{1,6}\s*(references|bibliography|literature)\b/im.test(md) && !md.includes("\\begin{thebibliography}");

// ---------- convert ----------
export function convert(doiId: string): ConvertResult {
  const fail = (err: string, partial: Partial<ConvertReport> = {}): ConvertResult => ({
    md: "",
    report: {
      doi_id: doiId, status: "fail", kind: "other", members: 0, tex_members: 0,
      main: null, main_note: null, docclass_files: 0, inputs_inlined: 0, inputs_unresolved: [],
      bib: { env: 0, cmd: 0, manual: false, truncated: false, section_redefs: 0 },
      ladder: "", title: { how: "none", text: null }, abstract_env: false, paragraphs_demoted: 0,
      refs_swept: false, headings_out: 0, sections_src: 0, chapters_src: 0, headings_vs_sections: 0,
      math_display_out: 0, math_inline_out: 0, math_src_env: 0, math_src_inline: 0,
      residual_bs: 0, residual_per_kb: 0, in_bytes: 0, out_bytes: 0, out_in_ratio: 0,
      refs_absent: true, escalate: null, err, ...partial,
    } as ConvertReport,
  });

  const ex = extract(doiId);
  if (ex.err && ex.kind === "other" && !ex.files.length) {
    fs.rmSync(ex.dir, { recursive: true, force: true });
    return fail(ex.err, { kind: ex.kind, members: ex.members.length });
  }
  const dir = ex.dir;
  const base: Partial<ConvertReport> = {
    kind: ex.kind, members: ex.members.length, tex_members: ex.texMembers.length,
  };
  const main = detectMain(ex.files);
  base.main = main.main?.rel ?? null;
  base.main_note = main.note ?? null;
  base.docclass_files = main.docclassFiles;
  if (!main.main) {
    fs.rmSync(dir, { recursive: true, force: true });
    return fail(`no main file (${main.note})`, base);
  }

  const members = new Map(ex.files.map((f) => [f.rel, f.abs]));
  let text = fs.readFileSync(main.main.abs, "utf8");
  if (ex.kind === "tar") {
    const xp = expandInputs(text, members, { baseRel: main.main.rel });
    text = xp.text;
    base.inputs_inlined = xp.inlined;
    base.inputs_unresolved = xp.unresolved;
  }
  const bib = bibStrip(text);
  base.bib = { env: bib.envStripped, cmd: bib.cmdStripped, manual: bib.manualRefsCut, truncated: bib.truncatedTail, section_redefs: bib.sectionRedefsDropped };
  const srcMath = srcMathCounts(bib.text);
  base.math_src_env = srcMath.env;
  base.math_src_inline = srcMath.inline;
  base.sections_src = (bib.text.match(/\\(?:section|subsection)\*?\s*[{\[]/g) || []).length;
  base.chapters_src = (bib.text.match(/\\chapter\*?\s*[{\[]/g) || []).length;
  base.in_bytes = Buffer.byteLength(bib.text);

  // title + abstract out of the body, paragraphs demoted to bold lead-ins
  const t = extractTitle(bib.text, dir);
  base.title = { how: t.how, text: t.title };
  const a = extractAbstract(t.text);
  base.abstract_env = a.abs !== null;
  const demoted = demoteParagraphs(a.text);
  base.paragraphs_demoted = demoted.demoted;
  const bodySrc = demoted.text;

  // ladder + convert body
  let bodyMd: string | null = null;
  let ladder = "ladder-exhausted";
  let errHead: string | undefined;
  const inFile = `${dir}/body.tex`;
  const outFile = `${dir}/body.md`;
  for (let level = 0; level <= 3; level++) {
    fs.writeFileSync(inFile, preprocess(bodySrc, level as 0 | 1 | 2 | 3));
    const r = pandocRun(inFile, outFile);
    if (r.ok) { bodyMd = fs.readFileSync(outFile, "utf8"); ladder = `r${level}`; break; }
    errHead = r.errHead;
  }
  base.ladder = ladder;
  if (bodyMd === null) {
    base.pandoc_err = errHead;
    fs.rmSync(dir, { recursive: true, force: true });
    return fail(`pandoc ladder exhausted: ${errHead ?? ""}`, base);
  }

  // assemble: # title, ## Abstract, body with shifted headings
  let md = "";
  if (t.title) md += `# ${t.title}\n\n`;
  if (a.abs !== null) {
    const absFile = `${dir}/abs.tex`;
    const absOut = `${dir}/abs.md`;
    fs.writeFileSync(absFile, a.abs);
    const absMd = pandocRun(absFile, absOut).ok ? fs.readFileSync(absOut, "utf8").trim() : "";
    if (absMd) md += `## Abstract\n\n${absMd}\n\n`;
    else base.abstract_env = false;
  }
  md += shiftHeadings(bodyMd.trim()) + "\n";
  const swept = sweepReferences(md);
  md = swept.text;
  base.refs_swept = swept.swept;

  // metrics + gates
  const outBytes = Buffer.byteLength(md);
  const mo = mathCounts(md);
  const noMath = stripMathSpans(md);
  const residual = (noMath.match(/\\[a-zA-Z]+/g) || []).length;
  const residualPerKb = +(residual / Math.max(1, outBytes / 1024)).toFixed(1);
  const headingsOut = (md.match(/^#{1,6} .+$/gm) || []).length;
  const noStructure = headingsOut === 0 && t.title === null && a.abs === null; // e.g. HTML junk in a .tex payload
  const report: ConvertReport = {
    ...(base as ConvertReport),
    doi_id: doiId,
    status: outBytes < STUB_BYTES || noStructure ? "stub" : "ok",
    headings_out: headingsOut,
    headings_vs_sections: +(headingsOut / Math.max(1, (base.sections_src ?? 0) + (base.chapters_src ?? 0))).toFixed(2),
    math_display_out: mo.display,
    math_inline_out: mo.inline,
    residual_bs: residual,
    residual_per_kb: residualPerKb,
    out_bytes: outBytes,
    out_in_ratio: +(outBytes / Math.max(1, base.in_bytes ?? 1)).toFixed(2),
    refs_absent: refsAbsent(md),
    escalate: null,
  };
  const reasons: string[] = [];
  if (ladder === "ladder-exhausted") reasons.push("ladder-exhausted");
  if (residualPerKb > RESIDUAL_ESCALATE_PER_KB) reasons.push("residual-density");
  if (reasons.length) report.escalate = { reasons, cmd: ESCALATE_TEMPLATE };
  fs.rmSync(dir, { recursive: true, force: true });
  return { md, report };
}

// ---------- CLI ----------
if (import.meta.main) {
  const args = process.argv.slice(2);
  const safe = (id: string) => id.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (args[0] === "--batch") {
    const idsFile = args[1];
    const outDirIdx = args.indexOf("--out");
    const outDir = outDirIdx > 0 ? args[outDirIdx + 1] : null;
    if (!idsFile || !outDir) {
      console.error("usage: bun src/tex-convert.ts --batch <ids-file> --out <dir>");
      process.exit(2);
    }
    fs.mkdirSync(outDir, { recursive: true });
    const ids = fs.readFileSync(idsFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
    const reportFile = `${outDir}/report.jsonl`;
    fs.writeFileSync(reportFile, "");
    let ok = 0, stubs = 0, fails = 0, escalations = 0;
    for (const id of ids) {
      const { md, report } = convert(id);
      if (report.status === "ok") {
        fs.writeFileSync(`${outDir}/${safe(id)}.md`, md);
        ok++;
      } else if (report.status === "stub") stubs++;
      else fails++;
      if (report.escalate) escalations++;
      fs.appendFileSync(reportFile, JSON.stringify(report) + "\n");
      console.log(`${report.status.padEnd(4)} ${id} ladder=${report.ladder} h=${report.headings_out}/${(report.sections_src ?? 0) + (report.chapters_src ?? 0)} math=${report.math_display_out}d/${report.math_inline_out}i resid=${report.residual_per_kb}/KB${report.escalate ? ` ESCALATE[${report.escalate.reasons}]` : ""}`);
    }
    console.log(`\n${ids.length} items: ${ok} ok, ${stubs} stubs, ${fails} fails, ${escalations} escalated -> ${outDir}`);
  } else if (args[0] && !args[0].startsWith("--")) {
    const { md, report } = convert(args[0]);
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(md);
    if (report.status === "fail") process.exit(1);
  } else {
    console.error("usage: bun src/tex-convert.ts <doi_id> | --batch <ids-file> --out <dir>");
    process.exit(2);
  }
}
