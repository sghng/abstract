#!/usr/bin/env bun
/**
 * tex-extract: arXiv e-print payload -> convertible LaTeX source.
 * Stage before conversion (pandoc -f latex): payload-kind detect +
 * streamed extraction (gunzip|tar, tex-family members only), main-file
 * detection, \input/\include expansion, bibliography strip, and the
 * preprocess ladder (levels 0-3) proven in spike P1 (.cache/spike-parse,
 * VERDICT.md 2026-09-16). Journal-agnostic, per-item pure: no network,
 * no D1, raw objects only ever read.
 *
 * Ladder levels (escalate on pandoc -f latex parse failure):
 *   0 as-is; 1 strip comments; 2 + drop delimited \def / \algdef;
 *   3 + definition-blind (drop all \def/\newcommand/... blocks).
 *
 * Usage:  bun src/tex-extract.ts <doi_id> [--keep]
 * Import: extract / detectMain / expandInputs / bibStrip / preprocess
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const PANDOC = process.env.PANDOC ?? "/opt/homebrew/bin/pandoc";

export type PayloadKind = "tar" | "single-tex" | "other";
export interface TexFile {
  rel: string; // member-relative name (./ and ../ normalized away)
  abs: string; // extracted path
}
export interface ExtractResult {
  kind: PayloadKind;
  members: string[]; // all tar member names (raw); [doiId + ".tex"] for single-file
  texMembers: string[]; // .tex/.ltx member names
  files: TexFile[]; // extracted tex-family members (tex/ltx/sty/cls)
  dir: string; // extraction dir (caller removes unless keep)
  err?: string;
}
export interface MainResult {
  main: TexFile | null;
  docclassFiles: number;
  note?: string; // "no-documentclass" | "no tex member"
}
export interface ExpandResult {
  text: string;
  inlined: number;
  unresolved: string[]; // unique unresolved \input/\include targets
}
export interface BibResult {
  text: string;
  envStripped: number; // thebibliography environments (incl. truncated tail)
  cmdStripped: number; // \bibliography{}/\bibliographystyle lines
  manualRefsCut: boolean; // hand-typed \section{References} section cut
  truncatedTail: boolean; // \begin{thebibliography} without \end: cut to EOF
  sectionRedefsDropped: number; // \renewcommand\section{...} blocks
}

function sh(
  cmd: string[],
  opts: { timeout?: number; maxBuffer?: number } = {},
) {
  const r = spawnSync(cmd[0], cmd.slice(1), {
    timeout: opts.timeout ?? 300_000,
    maxBuffer: opts.maxBuffer ?? 1 << 26,
    encoding: "buffer",
  });
  return {
    code: r.status,
    stdout: r.stdout ?? Buffer.alloc(0),
    stderr: (r.stderr ?? Buffer.alloc(0)).toString("utf8").slice(0, 400),
  };
}
function normPath(p: string, baseDir: string): string {
  const joined = p.startsWith("/") ? p : `${baseDir}/${p}`;
  const parts: string[] = [];
  for (const seg of joined.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}
// consume one balanced {..}/[..] group starting at i (src[i] is the opener); escape-aware
function consumeGroup(
  src: string,
  i: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  return i;
}

// ---------- extract ----------
// Streamed gunzip|tar: nothing gunzipped in memory. arXiv e-prints are
// usually a gzipped tar, sometimes a gzipped single .tex; raw objects that
// are neither gzip nor tar are treated as single-file payloads.
export function extract(
  doiId: string,
  opts: { dir?: string } = {},
): ExtractResult {
  const raw = `${process.env.RAW_DIR ?? `${ROOT}/raw-new`}/${doiId}.tex`;
  if (doiId.includes("'") || !fs.existsSync(raw)) {
    return {
      kind: "other",
      members: [],
      texMembers: [],
      files: [],
      dir: opts.dir ?? "",
      err: `raw object missing: ${raw}`,
    };
  }
  const dir =
    opts.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), "tex-extract-"));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const single = (err?: string): ExtractResult => ({
    kind: "single-tex",
    members: [`${doiId}.tex`],
    texMembers: [`${doiId}.tex`],
    files: [{ rel: "main.tex", abs: `${dir}/main.tex` }],
    dir,
    err,
  });
  const tarFile = `${dir}/payload.tar`;
  const gz = sh(["sh", "-c", `gunzip -c '${raw}' > '${tarFile}'`]);
  if (gz.code !== 0) {
    // not gzip: maybe an uncompressed tar, else assume plain single .tex
    const head1 = fs.readFileSync(raw).subarray(0, 512);
    if (!head1.subarray(257, 262).toString("latin1").startsWith("ustar")) {
      fs.copyFileSync(raw, `${dir}/main.tex`);
      return single();
    }
    fs.copyFileSync(raw, tarFile);
  }
  const head = fs.readFileSync(tarFile).subarray(0, 512);
  const magic = head.subarray(257, 263).toString("latin1");
  const nameOk = /^[\w .\-\/]+?\0/.test(
    head.subarray(0, 100).toString("latin1"),
  );
  const sizeStr = head
    .subarray(124, 136)
    .toString("latin1")
    .replace(/\0.*$/, "")
    .trim();
  const isTar =
    magic.startsWith("ustar") ||
    (nameOk && (sizeStr === "" || /^[0-7]{1,11}$/.test(sizeStr)));
  if (!isTar) {
    fs.renameSync(tarFile, `${dir}/main.tex`);
    return single();
  }
  const tf = sh(["tar", "-tf", tarFile]);
  if (tf.code !== 0) {
    fs.renameSync(tarFile, `${dir}/main.tex`);
    return single();
  }
  const names = tf.stdout.toString("utf8").split("\n").filter(Boolean);
  const escaping = names.filter(
    (n) => n.startsWith("/") || n.split("/").includes(".."),
  );
  if (escaping.length) {
    fs.rmSync(tarFile, { force: true });
    return {
      kind: "other",
      members: names,
      texMembers: [],
      files: [],
      dir,
      err: `escaping member names: ${escaping[0]}`,
    };
  }
  const texish = names.filter(
    (n) => /\.(tex|ltx|sty|cls)$/i.test(n) && !n.endsWith("/"),
  );
  let txErr = "";
  if (texish.length) {
    const tx = sh(["tar", "-xf", tarFile, "-C", dir, "--", ...texish]);
    if (tx.code !== 0) txErr = `tar -xf: ${tx.stderr.slice(0, 120)}`;
  }
  fs.rmSync(tarFile, { force: true });
  const files: TexFile[] = texish
    .filter((n) => fs.existsSync(`${dir}/${n}`))
    .map((n) => ({ rel: normPath(n, ""), abs: `${dir}/${n}` }));
  return {
    kind: "tar",
    members: names,
    texMembers: names.filter(
      (n) => /\.(tex|ltx)$/i.test(n) && !n.endsWith("/"),
    ),
    files,
    dir,
    err: txErr || undefined,
  };
}

// ---------- main-file detection ----------
// \documentclass scan over .tex/.ltx members; ties and no-documentclass
// payloads fall back to the largest file.
export function detectMain(files: TexFile[]): MainResult {
  const texFiles = files.filter((f) => /\.(tex|ltx)$/i.test(f.rel));
  if (!texFiles.length)
    return { main: null, docclassFiles: 0, note: "no tex member" };
  const withDoc = texFiles.filter((f) =>
    fs.readFileSync(f.abs).includes("\\documentclass"),
  );
  const pool = withDoc.length ? withDoc : texFiles;
  let main: TexFile | null = null;
  let bestSize = -1;
  for (const f of pool) {
    const size = fs.statSync(f.abs).size;
    if (size > bestSize) {
      bestSize = size;
      main = f;
    }
  }
  return {
    main,
    docclassFiles: withDoc.length,
    note: withDoc.length ? undefined : "no-documentclass",
  };
}

// ---------- input expansion ----------
// Inline \input{x}/\include{x} (braced or bare, with/without extension).
// The \b boundary is load-bearing: without it \includegraphics matches as
// \include + "g" and silently beheads the command. For single-file payloads
// skip this (nothing to expand) and feed the raw text to bibStrip; pandoc
// parses either form.
export function expandInputs(
  source: string,
  members: Map<string, string>,
  opts: { baseRel?: string } = {},
): ExpandResult {
  const fileIndex = members;
  const unresolved: string[] = [];
  let inlined = 0;
  const seen = new Set<string>();
  const baseRel = opts.baseRel ?? "";
  const readRel = (name: string): string | null => {
    const abs = fileIndex.get(name);
    if (!abs) return null;
    let raw = fs.readFileSync(abs, "utf8");
    const ei = raw.indexOf("\\endinput");
    if (ei >= 0) raw = raw.slice(0, ei);
    return raw;
  };
  const clean = (s: string) =>
    s
      .replace(/\\documentclass[^\n]*\n?/g, "")
      .replace(/\\begin\{document\}/g, "")
      .replace(/\\end\{document\}/g, "");
  const resolve = (target: string, fromDir: string): string | null => {
    for (const c of [target, `${target}.tex`, `${target}.ltx`]) {
      const k = normPath(c, fromDir);
      if (fileIndex.has(k)) return k;
    }
    return null;
  };
  const expandFrom = (relName: string, depth: number, src: string): string => {
    if (depth > 20) return "";
    return clean(src).replace(
      /\\(?:input|include)\b\s*(?:\{([^}]*)\}|([^\s{\n%\\]))/g,
      (m, braced, bare) => {
        const target = braced ?? bare;
        if (!target) return m;
        const fromDir = relName.includes("/")
          ? relName.slice(0, relName.lastIndexOf("/"))
          : "";
        const hit = resolve(target, fromDir);
        if (!hit) {
          unresolved.push(target);
          return "";
        }
        if (seen.has(hit)) return "";
        seen.add(hit);
        inlined++;
        const inner = readRel(hit);
        if (inner === null) return "";
        return expandFrom(hit, depth + 1, inner);
      },
    );
  };
  seen.add(baseRel);
  const text = expandFrom(baseRel, 0, source);
  return { text, inlined, unresolved: [...new Set(unresolved)] };
}

// ---------- bib strip ----------
// Full correctness set from the spike: section-redefs first (pandoc expands
// \renewcommand\section{\@startsection...} and destroys native headings),
// then thebibliography envs, \bibliography commands, hand-typed References
// sections, and bare harvard bib envs. Author bios / acknowledgments are
// NOT touched here (acks are kept by mandate).
export function bibStrip(source: string): BibResult {
  // \renewcommand\section{...} blocks (brace-balanced, escape-aware)
  const redefRe = /\\renewcommand\s*\{?\\(?:sub)*section\}?/g;
  const cuts: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = redefRe.exec(source))) {
    let j = m.index + m[0].length;
    while (j < source.length && /\s/.test(source[j])) j++;
    if (source[j] === "{") {
      const end = consumeGroup(source, j, "{", "}");
      cuts.push([m.index, end]);
      redefRe.lastIndex = end;
    }
  }
  let text = source;
  for (let k = cuts.length - 1; k >= 0; k--)
    text = text.slice(0, cuts[k][0]) + text.slice(cuts[k][1]);
  const sectionRedefsDropped = cuts.length;

  let envStripped = 0;
  let truncatedTail = false;
  text = text.replace(
    /\\begin\{thebibliography\}[\s\S]*?\\end\{thebibliography\}/g,
    () => {
      envStripped++;
      return "";
    },
  );
  if (!envStripped) {
    const i = text.indexOf("\\begin{thebibliography}");
    if (i >= 0) {
      text = text.slice(0, i);
      envStripped = 1;
      truncatedTail = true;
    }
  }
  let cmdStripped = 0;
  text = text.replace(
    /^[ \t]*\\(?:bibliography|bibliographystyle)\s*(?:\{[^}]*\}|[^\s{%]+)[ \t]*$/gm,
    () => {
      cmdStripped++;
      return "";
    },
  );
  // hand-typed references sections (\section{References} / \section*{References}
  // followed by a typed list, no thebibliography): cut to next section/appendix
  let manualRefsCut = false;
  const m2 =
    /\\section\*?\s*\{\s*References\s*\}|\\section\*?\s+References\b[^\n{]*(?:\\par)?/.exec(
      text,
    );
  if (m2) {
    const rest = text.slice(m2.index + m2[0].length);
    const nextSec = rest.search(
      /\\(?:section|appendix|end\{document\})(?![a-zA-Z])/,
    );
    text = text.slice(0, m2.index) + (nextSec >= 0 ? rest.slice(nextSec) : "");
    manualRefsCut = true;
  }
  text = text.replace(/\\begin\{harvard\}[\s\S]*?\\end\{harvard\}/g, "");
  return {
    text,
    envStripped,
    cmdStripped,
    manualRefsCut,
    truncatedTail,
    sectionRedefsDropped,
  };
}

// ---------- preprocess ladder ----------
// Level 1: strip comments (joins \cs%-newline, protects verbatim envs).
export function stripComments(source: string): string {
  let t = source.replace(/(\\[a-zA-Z]+)%[ \t]*\n/g, "$1 ");
  const verb: string[] = [];
  t = t.replace(
    /\\begin\{(verbatim\*?|lstlisting|alltt|Verbatim\*?|minted)\}([\s\S]*?)\\end\{\1\}/g,
    (mm) => {
      verb.push(mm);
      return `@@VERB${verb.length - 1}@@`;
    },
  );
  t = t
    .split("\n")
    .map((ln) => {
      let out = "";
      let i = 0;
      while (i < ln.length) {
        if (ln[i] === "\\") {
          out += ln.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (ln[i] === "%") break;
        out += ln[i++];
      }
      return out;
    })
    .join("\n");
  return t.replace(/@@VERB(\d+)@@/g, (_, i) => verb[+i]);
}
// drop each match of cmdRe plus its argument groups:
//   def-family (\def\x#1{..}): skip param text to first { on the line, one group
//   others (\newcommand/\algdef/...): consecutive ws-separated {..}/[..] groups
function dropCommandWithArgs(
  src: string,
  cmdRe: RegExp,
  isDef: boolean,
): string {
  const re = new RegExp(
    cmdRe.source,
    cmdRe.flags.includes("g") ? cmdRe.flags : cmdRe.flags + "g",
  );
  let out = "";
  let pos = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    if (isDef) {
      // the body is the first {...} after the parameter text; it may sit on a
      // later line (\def\x#1\n{..}), so prefer the brace and only fall back to
      // the newline when the brace is absent or implausibly far
      const br = src.indexOf("{", i);
      if (br >= 0 && br - i < 2000) {
        i = consumeGroup(src, br, "{", "}");
      } else {
        const nl = src.indexOf("\n", i);
        i = nl < 0 ? src.length : nl + 1;
      }
    } else {
      for (;;) {
        let j = i;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === "{") {
          i = consumeGroup(src, j, "{", "}");
          continue;
        }
        if (src[j] === "[") {
          i = consumeGroup(src, j, "[", "]");
          continue;
        }
        if (j > i) {
          i = j;
          continue;
        }
        break;
      }
    }
    out += src.slice(pos, m.index);
    pos = i;
    re.lastIndex = pos;
  }
  return out + src.slice(pos);
}
// delimited \def (\def\x#1\under#2{..}): pandoc cannot parse the param text.
// The char class excludes braces: param text cannot contain them, and a
// greedy class eats plain \def\x#1{\Frac... bodies (spike regression).
const DEF_DELIM = /\\(?:gdef|edef|xdef|def)\s*\\?[a-zA-Z@]+\s*#[^#{}\n]*\\/g;
function dropDelimitedDefs(src: string): string {
  let t = dropCommandWithArgs(src, /\\algdef\b/g, false);
  const re = new RegExp(DEF_DELIM.source, "g");
  const cuts: [number, number][] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    let i = t.indexOf("{", m.index + m[0].length);
    const nl = t.indexOf("\n", m.index);
    if (i < 0 || (nl >= 0 && nl < i)) i = Math.min(nl + 1, t.length);
    else i = consumeGroup(t, i, "{", "}");
    cuts.push([m.index, i]);
  }
  for (let k = cuts.length - 1; k >= 0; k--)
    t = t.slice(0, cuts[k][0]) + t.slice(cuts[k][1]);
  return t;
}
function definitionBlind(src: string): string {
  // \def-family only: the isDef pass skips the parameter text (\foo#1) and
  // consumes the balanced body, prefixes included.
  let t = dropCommandWithArgs(
    src,
    /\\(?:(?:long|global|outer|protected)\s*\\)*(?:gdef|edef|xdef|def)\b/g,
    true,
  );
  // \newcommand-family and environments: consume EVERY trailing argument
  // group. The old code ran newenvironment through the isDef pass, which ate
  // only the {name} group and left both bodies (the "#1" class: 58% of the
  // 2026-09-18 tex failures).
  t = dropCommandWithArgs(
    t,
    /\\(?:newcommand|renewcommand|providecommand|DeclareRobustCommand|newenvironment|renewenvironment|provideenvironment|newtheorem|DeclareMathOperator|algdef)\b/g,
    false,
  );
  return t.replace(/\\let\b[^\n]*\n?/g, "");
}
// r4, last resort: unresolved \input/\include targets (their content is not in
// the tarball, so the command has to go), leftover parameter tokens, and any
// def-family remnant the blind pass could not see.
function salvage(src: string): string {
  let t = src
    .replace(
      /\\(?:input|include|includeonly|subfile|import|subimport|inputfrom)\s*(?:\{[^{}]*\}\s*){1,2}/g,
      "",
    )
    .replace(/\\(?:input|subfile|include)\b/g, "");
  t = definitionBlind(t);
  return t.replace(/#\s*[0-9]/g, "");
}
export const LADDER_LEVELS = ["r0", "r1", "r2", "r3", "r4"] as const;
export function preprocess(source: string, level: 0 | 1 | 2 | 3 | 4): string {
  if (level <= 0) return source;
  let t = stripComments(source);
  if (level >= 2) t = dropDelimitedDefs(t);
  if (level >= 3) t = definitionBlind(t);
  if (level >= 4) t = salvage(t);
  return t;
}
// lowest ladder level that pandoc -f latex accepts, via probe conversion
export function ladderProbe(
  text: string,
  dir: string,
): { level: number; name: string; errHead?: string } {
  const inFile = `${dir}/probe-in.tex`;
  let errHead: string | undefined;
  for (let level = 0; level < LADDER_LEVELS.length; level++) {
    fs.writeFileSync(inFile, preprocess(text, level as 0 | 1 | 2 | 3 | 4));
    const r = spawnSync(
      PANDOC,
      [
        "-f",
        "latex",
        "-t",
        "markdown",
        "--wrap=none",
        "-o",
        `${dir}/probe-out.md`,
        inFile,
      ],
      { timeout: 60_000, maxBuffer: 1 << 24 },
    );
    if (r.status === 0) return { level, name: LADDER_LEVELS[level] };
    errHead = (r.stderr ?? Buffer.alloc(0))
      .toString("utf8")
      .split("\n")
      .slice(0, 2)
      .join(" | ")
      .slice(0, 160);
  }
  return { level: -1, name: "ladder-exhausted", errHead };
}

// ---------- CLI ----------
if (import.meta.main) {
  const doiId = process.argv[2];
  const keep = process.argv.includes("--keep");
  if (!doiId || doiId.startsWith("--")) {
    console.error("usage: bun src/tex-extract.ts <doi_id> [--keep]");
    process.exit(2);
  }
  const ex = extract(doiId);
  console.log(`doi_id:  ${doiId}`);
  console.log(`kind:    ${ex.kind}${ex.err ? ` (err: ${ex.err})` : ""}`);
  console.log(
    `members: ${ex.members.length} total, ${ex.texMembers.length} .tex`,
  );
  const main = detectMain(ex.files);
  if (!main.main) {
    console.log(`main:    NONE (${main.note})`);
    process.exit(1);
  }
  console.log(
    `main:    ${main.main.rel}${main.note ? ` (${main.note}: largest fallback)` : ` (documentclass in ${main.docclassFiles} file${main.docclassFiles === 1 ? "" : "s"})`}`,
  );
  const members = new Map(ex.files.map((f) => [f.rel, f.abs]));
  const source = fs.readFileSync(main.main.abs, "utf8");
  let text = source;
  let expand: ExpandResult | null = null;
  if (ex.kind === "tar") {
    expand = expandInputs(source, members, { baseRel: main.main.rel });
    text = expand.text;
    console.log(
      `inputs:  ${expand.inlined} inlined, ${expand.unresolved.length} unresolved${expand.unresolved.length ? ` [${expand.unresolved.slice(0, 5).join(", ")}]` : ""}`,
    );
  } else {
    console.log("inputs:  single-file payload, none");
  }
  const bib = bibStrip(text);
  const anyBib =
    bib.envStripped ||
    bib.cmdStripped ||
    bib.manualRefsCut ||
    bib.sectionRedefsDropped;
  console.log(
    `bib:     ${anyBib ? "stripped" : "none found"} (env ${bib.envStripped}${bib.truncatedTail ? "!" : ""}, cmd ${bib.cmdStripped}, manual ${bib.manualRefsCut ? "y" : "n"}, section-redefs ${bib.sectionRedefsDropped})`,
  );
  const gfx = (
    bib.text.match(/\\includegraphics\*?\s*(?:\[[^\]]*\])?\s*\{/g) || []
  ).length;
  console.log(`graphics: ${gfx} \\includegraphics`);
  const probe = ladderProbe(bib.text, ex.dir);
  console.log(
    `ladder:  ${probe.name}${probe.level < 0 ? ` (${probe.errHead})` : probe.level === 0 ? " (converts as-is)" : ` (escalation needed)`}`,
  );
  if (keep) {
    fs.writeFileSync(`${ex.dir}/expanded.tex`, bib.text);
    console.log(`dir:     ${ex.dir} (kept; expanded.tex written)`);
  } else {
    fs.rmSync(ex.dir, { recursive: true, force: true });
  }
}
