#!/usr/bin/env bun
/**
 * pdf-wrap: docling md (legacy/pdf2md.py) -> corpus markdown.
 * Journal-agnostic normalization stage per spike P2 verdict
 * (.cache/spike-parse/pdf/): the converter is fine; its output needs
 * a wrap. Per item:
 *   ligature/PUA watch + soft-hyphen strip -> chrome filters (every
 *   rule counted, none silent) -> # title promotion (docling emits
 *   every section as ##, title included) -> front-matter author
 *   block drop (incl. scrambled psyarxiv title blocks) ->
 *   References/bios cut (training-data mandate) -> numbered-heading
 *   hierarchy repair (2.1 -> ###) -> asset-key normalization
 *   (<doi_id>-figNN.ext -> <doi_id>:figNN.ext; rsplit(':',1) keys) ->
 *   min-content/zero-structure stub gate.
 *
 * Era quality (P2) is upstream of this stage: scans and math-corrupt
 * jebs carry damage no md wrap can repair; they surface via report
 * counters, and the OCR roadmap owns their recovery.
 *
 * Usage:  bun src/pdf-wrap.ts <doi_id> [--in <md>]     md->stdout, report->stderr
 *         bun src/pdf-wrap.ts --batch <jsonl> --out <dir>
 *           rows: {doi_id, in, journal, year, ...}; writes <safe>.md +
 *           report.jsonl (skip/fail recorded, not written)
 * Import: wrap / WrapReport
 */
import * as fs from "node:fs";

const STUB_BYTES = 1024; // tex-convert parity

export interface WrapMeta {
  journal?: string;
  year?: number;
  format?: string;
}
export interface WrapReport {
  doi_id: string;
  status: "ok" | "skip" | "fail";
  journal?: string;
  year?: number;
  format?: string;
  in_bytes: number;
  out_bytes: number;
  out_in_ratio: number;
  title: { text: string | null; how: "heading" | "none" };
  headings_out: number; // ## and deeper (the # title is separate)
  h3_out: number;
  hierarchy_repairs: number;
  abstract_heading: boolean;
  refs: { cut: boolean; residual_headings: number };
  rules: Record<string, number>; // chrome hit counts; 0s stay visible
  lig: { pua_mapped: number; pua_unmapped: number; uni_mapped: number; joins: number };
  softhyphens: number;
  asset_keys: number;
  err?: string;
}
export interface WrapResult {
  md: string; // "" on fail; skip md still returned (caller checks status)
  report: WrapReport;
}

// ---------- text repairs (ligatures, soft hyphens) ----------
// PUA slots E000-E004: where several 2000s-era fonts dump their
// ligature glyphs when the ToUnicode map is missing. Unmapped PUA
// stays in place, counted -- never silently dropped.
const PUA_LIG: Record<string, string> = {
  "\uE000": "ff", "\uE001": "fi", "\uE002": "fl", "\uE003": "ffi", "\uE004": "ffl",
};
const UNI_LIG: Record<string, string> = {
  "\uFB00": "ff", "\uFB01": "fi", "\uFB02": "fl", "\uFB03": "ffi", "\uFB04": "ffl",
};
// ff-dropped-by-OCR repair: 'e ect' -> 'effect' (82x in one psyarxiv
// file, spike P2). Join accepted only when stem+suffix is a known
// ff-word; fi/fl space-drops never observed -- no speculative map.
const FF_STEMS = new Set([
  "effect", "effective", "affect", "effort", "offer", "offset", "differ", "difference",
  "different", "suffer", "sufficient", "coefficient", "efficient", "efficiency",
  "confidence", "affinity", "office", "official", "staff", "stuff", "difficult",
  "difficulty", "afford", "coffee", "tariff", "suffix", "shuffle", "scuffle",
  "ruffle", "waffle", "baffle", "baffling", "stifle", "little", "bottle", "battle",
  "settle", "subtle", "cattle", "kettle", "brittle", "middle", "riddle", "puzzle",
  "huddle", "muddle", "puddle", "tumble", "humble", "juggle", "nibble",
]);
const FF_SUFFIXES = [
  "s", "es", "ed", "d", "ing", "ly", "er", "ers", "ion", "ions", "ent", "ents",
  "ence", "ences", "ity", "ies", "ive", "ively", "antly", "ently", "age", "ages",
  "y", "al",
];
const ffWord = (w: string): boolean => {
  if (FF_STEMS.has(w)) return true;
  for (const suf of FF_SUFFIXES) {
    if (w.endsWith(suf) && FF_STEMS.has(w.slice(0, -suf.length))) return true;
  }
  return false;
};
function repairLigatures(text: string): { text: string; lig: WrapReport["lig"] } {
  const lig: WrapReport["lig"] = { pua_mapped: 0, pua_unmapped: 0, uni_mapped: 0, joins: 0 };
  text = text.replace(/[\uE000-\uF8FF]/g, (c) => {
    if (PUA_LIG[c]) { lig.pua_mapped++; return PUA_LIG[c]; }
    lig.pua_unmapped++; return c;
  });
  text = text.replace(/[\uFB00-\uFB04]/g, (c) => {
    lig.uni_mapped++; return UNI_LIG[c];
  });
  text = text.replace(/\b([a-z]{1,4}) ([a-z]{1,10})\b/g, (m, a: string, b: string) => {
    if (!ffWord(a + "ff" + b)) return m;
    lig.joins++;
    return a + "ff" + b;
  });
  return { text, lig };
}
// U+00AD kept literally by docling on jebs ('Rela\u00ADtive',
// 'compo\u00AD nts'); drop it and any line-break space it absorbed.
function stripSoftHyphens(text: string): { text: string; count: number } {
  let count = 0;
  const out = text
    .replace(/\u00AD\s*(?=[a-zA-Z])/g, () => { count++; return ""; })
    .replace(/\u00AD/g, () => { count++; return ""; });
  return { text: out, count };
}

// ---------- block model ----------
interface Block {
  lines: string[]; // blank-line-separated run
  kind: "heading" | "para" | "list" | "table";
  dead: boolean; // dropped by a rule
}
const isHeading = (l: string) => /^#{1,6} /.test(l);
const headingText = (b: Block) => b.lines[0].replace(/^#{1,6} /, "").trim();
const isTableLine = (l: string) => l.startsWith("|");
const isListLine = (l: string) => /^[-*+] /.test(l) || /^\d+\. /.test(l);
function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (!cur.length) return;
    const kind: Block["kind"] = isHeading(cur[0])
      ? "heading"
      : isTableLine(cur[0])
        ? "table"
        : isListLine(cur[0])
          ? "list"
          : "para";
    blocks.push({ lines: cur, kind, dead: false });
    cur = [];
  };
  for (const line of md.split("\n")) {
    if (!line.trim()) { flush(); continue; }
    // headings and tables own their line; other lines glue into paragraphs.
    // Table rows accumulate into one block (blank-line-free GFM stays intact).
    if (cur.length) {
      if (isHeading(line) || isHeading(cur[0]) || isTableLine(line) !== isTableLine(cur[0])) flush();
    }
    cur.push(line);
  }
  flush();
  return blocks;
}
const blockText = (b: Block) => b.lines.join("\n").trim();
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------- chrome tests ----------
const SECTION_LEXICON = /^(abstract|introduction|background|related work|theory|method s?s?|methods|methodology|materials|procedure|participants|data|analys[ie]s|results|findings|discussion|conclusion|conclusions|limitations|summary|overview|preliminaries|study|studies|experiment|experiments|design|measures|measures? and procedure|acknowledg(e)?ments?|references?|bibliography|appendix|appendices|supplementary|keywords?|key words|the present (study|research)|literature review)\b/i;
const BANNER_RE = /^(preprint|not peer[- ]reviewed|preprint \(not peer[- ]reviewed\))\s*$/i;
const AFFIL_RE = /\b(university|institute|school|department|division|laborator(y|ies)|college|centre|center|academy|hospital|clinic)\b/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const ORCID_RE = /orcid/i;
// name-shaped: 2-5 capitalized/all-caps tokens, no lowercase glue words
const NAME_RE = /^[A-Z][A-Za-z'’.-]*(?:\s+(?:[A-Z]\.|AND|&|[A-Z][A-Za-z'’.-]*)){1,4}\.?$/;
const PAIR_RE = /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,2}\s+(?:and|&)\s+[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){0,2}[.,]?$/;
const PAREN_AFFIL_RE = /\([^)]*\b(?:university|institute|college|school|department|laboratory|centre|center|academy)\b[^)]*\)/i;
// front-matter author/affiliation line: short, no sentence end, every word
// opens uppercase (prose almost always carries a lowercase function word)
function authorIsh(t: string): boolean {
  const s = norm(t).replace(/^[#*]+\s*/, "");
  if (!s) return false;
  if (s === "AND" || s === "&") return true;
  if (/^\d+[ ,*]/.test(s) && AFFIL_RE.test(s)) return true; // '2 Department of ..., MIT'
  if (PAREN_AFFIL_RE.test(s)) return true; // 'Emma Bridger (University of Leicester)'
  if ((EMAIL_RE.test(s) || ORCID_RE.test(s)) && s.split(" ").length <= 14 && !/[.!?]$/.test(s)) return true;
  if (PAIR_RE.test(s)) return true; // 'Viviana Amati and Felix Schönenberger'
  const words = s.split(" ");
  if (words.length > 12 || words.length < 2 || /[.!?]$/.test(s)) return false;
  if (AFFIL_RE.test(s)) return true; // 'maastricht university, the netherlands'
  const capsFirst = words.every((w) => {
    const m = w.match(/[A-Za-z]/);
    return !m || m[0] === m[0].toUpperCase();
  });
  if (!capsFirst) return false;
  if (NAME_RE.test(s)) return true; // 'LEONARD S. FELDT', 'Jon Rasbash Harvey Goldstein'
  if (/[,&]|\b\d+\b/.test(s)) return true; // 'Kartik Chandra 1,* , Joshua B. Tenenbaum 2 ...'
  if (/^[A-Z][A-Z\s.,&*'()-]+$/.test(s)) return true; // 'ETH ZURICH' (>= 2 words by the guard above)
  return false;
}
const titleIsh = (t: string): boolean => {
  const s = norm(t).replace(/[*_ ]+$/, "");
  if (s.length < 12) return false;
  if (BANNER_RE.test(s) || SECTION_LEXICON.test(s)) return false;
  if (/^\d+([.)]|\.\d)/.test(s)) return false; // numbered section
  const words = s.split(" ");
  if (words.length < 3) return false;
  // titles carry glue (of/for/the/a question); bare name lists do not
  const glue = /\b(of|for|the|a|an|and|in|on|to|with|within|across|from|as|how|why|what|when|is|are|using|by|between|toward|under|over|does?|can)\b/i.test(s);
  const question = /\?/.test(s);
  const capsRatio = s.replace(/[^A-Za-z]/g, "").length > 0 &&
    (s.match(/[A-Z]/g) || []).length / Math.max(1, s.replace(/[^A-Za-z]/g, "").length) > 0.6;
  return glue || question || (capsRatio && words.length >= 5);
};
const REF_HEADING_RE = /^(references?|bibliography|literature cited|citations|sources)\b\s*\d*$/i;
const BIO_HEADING_RE = /^(authors?|author biograph(y|ies)|biograph(y|ies)|about the authors?)\b/i;
const DATES_RE = /^(manuscript )?received\b|^(final version|final manuscript)\s+received|^revision\s+received|^accepted\b|^published (online|date)\b|^first published\b/i;
const FUNDING_RE = /\b(received funding|was funded by|funding from|funding was provided|financially supported by)\b/i;
const CORRESPONDENCE_SPAN_RE =
  /(?:Requests for reprints(?:\s+(?:and\s+)?correspondence(?:\s+concerning\s+this\s+article)?)?\s+(?:should be\s+)?(?:sent|addressed)\s+to|Correspondence (?:should be made to|concerning))\b[\s\S]*?(?:E-?mail:\s*\S+@\S+|[.](?=\s+[A-Z]))/;

// ---------- wrap ----------
export function wrap(doiId: string, mdIn: string, meta: WrapMeta = {}): WrapResult {
  const inBytes = Buffer.byteLength(mdIn);
  const rules: Record<string, number> = {
    banner: 0, line_number: 0, running_head: 0, journal_banner: 0,
    author_block: 0, email_line: 0, correspondence: 0, funding_note: 0,
    copyright_line: 0, manuscript_dates: 0,
  };
  const fail = (err: string): WrapResult => ({
    md: "",
    report: {
      doi_id: doiId, status: "fail", journal: meta.journal, year: meta.year,
      format: meta.format ?? "pdf", in_bytes: inBytes, out_bytes: 0, out_in_ratio: 0,
      title: { text: null, how: "none" }, headings_out: 0, h3_out: 0,
      hierarchy_repairs: 0, abstract_heading: false, refs: { cut: false, residual_headings: 0 },
      rules, lig: { pua_mapped: 0, pua_unmapped: 0, uni_mapped: 0, joins: 0 },
      softhyphens: 0, asset_keys: 0, err,
    },
  });
  try {
    // text repairs first (the title may carry the damage)
    const lig0 = repairLigatures(mdIn);
    const sh = stripSoftHyphens(lig0.text);
    const blocks = parseBlocks(sh.text);

    // -- pass A: region-agnostic chrome (whole-block drops) --
    for (const b of blocks) {
      const t = blockText(b);
      const s = norm(t);
      if (b.kind === "heading" && BANNER_RE.test(headingText(b))) { b.dead = true; rules.banner++; continue; }
      if (b.kind !== "table" && /^\d{1,4}$/.test(s)) { b.dead = true; rules.line_number++; continue; } // margin line numbers / page numbers
      if (/volume\s+\d+,\s*(number|no\.?)\s+\d+/i.test(s)) { b.dead = true; rules.journal_banner++; continue; }
      // running journal-title heading ('## psychometrika'): every corpus
      // heading opens uppercase, so an all-lowercase heading is chrome
      if (b.kind === "heading" && /^[a-z][a-z\s]{0,24}$/.test(headingText(b).trim())) { b.dead = true; rules.journal_banner++; continue; }
      if (/^[©(]\s*[Cc]?\)?\s*\d{4}\b/.test(s) && s.split(" ").length <= 12) { b.dead = true; rules.copyright_line++; continue; } // '©2019 The ...'
      if (DATES_RE.test(s) && s.split(" ").length <= 14 && b.kind !== "list") { b.dead = true; rules.manuscript_dates++; continue; }
      if (b.kind === "para" && FUNDING_RE.test(s)) { b.dead = true; rules.funding_note++; continue; }
    }

    // -- correspondence spans (may be welded into prose; never drop the host) --
    for (const b of blocks) {
      if (b.dead || b.kind !== "para") continue;
      const t = blockText(b);
      if (!/Requests for reprints|Correspondence (should|concerning)/.test(t)) continue;
      const after = norm(t.replace(CORRESPONDENCE_SPAN_RE, " "));
      if (after.split(" ").length < 3) b.dead = true;
      else b.lines = [after];
      rules.correspondence++;
    }

    // -- email/ORCID lines (standalone; correspondence already handled) --
    for (const b of blocks) {
      if (b.dead || b.kind !== "para") continue;
      const s = norm(blockText(b));
      if ((EMAIL_RE.test(s) || ORCID_RE.test(s)) && s.split(" ").length <= 14 && !/[.!?]$/.test(s)) { b.dead = true; rules.email_line++; }
    }

    // -- title: first plausible heading among the first 12 --
    let title: string | null = null;
    let titleBlock = -1;
    let seen = 0;
    for (let i = 0; i < blocks.length && seen < 12; i++) {
      const b = blocks[i];
      if (b.dead || b.kind !== "heading") continue;
      seen++;
      const h = headingText(b);
      if (!titleIsh(h)) continue;
      title = norm(h).replace(/[*_ ]+$/, "").replace(/\s+/g, " ");
      titleBlock = i;
      b.dead = true;
      break;
    }

    // -- running heads: later headings repeating the title --
    if (title) {
      const key = title.toLowerCase().replace(/\s+/g, " ");
      for (const b of blocks) {
        if (b.dead || b.kind !== "heading") continue;
        if (norm(headingText(b)).toLowerCase().replace(/\s+/g, " ") === key) {
          b.dead = true;
          rules.running_head++;
        }
      }
    }

    // -- front-matter author/affiliation block: contiguous walk from the
    // title forward (docling scrambles psyarxiv title blocks into the
    // body; the walk handles both in-order and scrambled). Stops at the
    // first block that is not author-shaped, so body prose is safe. --
    const CONTACT_RE = /^(correspondence|requests for reprints)\b|\b(university|institute|e-?mail|orcid)\b/i;
    const oneColTable = (b: Block) => {
      const cells = b.lines.filter((l) => isTableLine(l) && !/^\|\s*-+\s*\|$/.test(l.trim()));
      return cells.length > 0
        && cells.every((l) => (l.match(/\|/g) || []).length === 2)
        && CONTACT_RE.test(cells.slice(1).join(" ")); // header '| 0 |' excluded
    };
    if (titleBlock >= 0) {
      // title-block table usually sits just before the title heading
      for (let i = 0; i < titleBlock; i++) {
        const b = blocks[i];
        if (!b.dead && b.kind === "table" && oneColTable(b)) { b.dead = true; rules.author_block++; }
      }
      let dropped = 0;
      for (let i = titleBlock + 1; i < blocks.length && dropped < 12; i++) {
        const b = blocks[i];
        if (b.dead) continue; // pass-A chrome between title and the block
        if (b.kind === "table" && oneColTable(b)) { b.dead = true; rules.author_block++; dropped++; continue; }
        if (b.kind !== "heading" && b.kind !== "para") break;
        if (!authorIsh(b.kind === "heading" ? headingText(b) : blockText(b))) break;
        b.dead = true;
        rules.author_block++;
        dropped++;
      }
    }

    // -- References/bios cut (mandate): last refs-family heading in the
    // back half; everything after it is backmatter. Belt: a trailing
    // bios section survives a missing refs heading. --
    let refsCut = false;
    let lastRef = -1;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.dead && b.kind === "heading" && REF_HEADING_RE.test(headingText(b))) lastRef = i;
    }
    if (lastRef >= 0 && lastRef >= blocks.length * 0.25) {
      for (let i = lastRef; i < blocks.length; i++) blocks[i].dead = true;
      refsCut = true;
    }
    let residualRefs = 0;
    for (const b of blocks) {
      if (!b.dead && b.kind === "heading" && REF_HEADING_RE.test(headingText(b))) residualRefs++;
    }
    if (!refsCut) {
      let lastBio = -1;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (!b.dead && b.kind === "heading" && BIO_HEADING_RE.test(headingText(b))) lastBio = i;
      }
      if (lastBio >= 0 && lastBio >= blocks.length * 0.5) {
        for (let i = lastBio; i < blocks.length; i++) blocks[i].dead = true;
      }
    }

    // -- hierarchy repair: docling flattens everything to ##; dotted
    // numbers (2.1, 3.2.1) recover their depth; no skipped levels --
    let hierarchyRepairs = 0;
    let prevLevel = 1; // the # title sits above
    const outLines: string[] = [];
    for (const b of blocks) {
      if (b.dead) continue;
      if (b.kind === "heading") {
        const h = headingText(b);
        const dotted = /^(\d+(?:\.\d+)+)\b/.exec(h);
        let level = 2;
        if (dotted) level = 2 + dotted[1].split(".").length - 1;
        const clamped = Math.min(level, prevLevel + 1, 4);
        if (clamped !== 2) hierarchyRepairs++;
        prevLevel = clamped;
        outLines.push("#".repeat(clamped) + " " + h, "");
      } else {
        outLines.push(blockText(b), "");
      }
    }
    let md = title ? `# ${title}\n\n` : "";
    md += outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    md = md.replace(/\n{3,}/g, "\n\n");

    // -- asset-key normalization: ../assets/<id>-figNN.ext -> <id>:figNN.ext --
    let assetKeys = 0;
    md = md.replace(/\.\.\/assets\/([^\s)\]]+?)-(fig|tab|eq)(\d+)\.([A-Za-z0-9]+)/g, (m, id: string, kind: string, num: string, ext: string) => {
      assetKeys++;
      return `${id}:${kind}${num}.${ext}`;
    });

    // -- metrics + gate --
    const outBytes = Buffer.byteLength(md);
    const headingsOut = (md.match(/^#{2,6} .+$/gm) || []).length;
    const h3Out = (md.match(/^#{3,6} .+$/gm) || []).length;
    const abstractHeading = /^## Abstract\b/m.test(md);
    const status: WrapReport["status"] =
      outBytes < STUB_BYTES || headingsOut === 0 ? "skip" : "ok";
    const report: WrapReport = {
      doi_id: doiId, status, journal: meta.journal, year: meta.year,
      format: meta.format ?? "pdf",
      in_bytes: inBytes, out_bytes: outBytes,
      out_in_ratio: +(outBytes / Math.max(1, inBytes)).toFixed(2),
      title: { text: title, how: title ? "heading" : "none" },
      headings_out: headingsOut, h3_out: h3Out,
      hierarchy_repairs: hierarchyRepairs,
      abstract_heading: abstractHeading,
      refs: { cut: refsCut, residual_headings: residualRefs },
      rules,
      lig: lig0.lig,
      softhyphens: sh.count,
      asset_keys: assetKeys,
    };
    return { md, report };
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ---------- CLI ----------
if (import.meta.main) {
  const args = process.argv.slice(2);
  const safe = (id: string) => id.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (args[0] === "--batch") {
    const rowsFile = args[1];
    const outIdx = args.indexOf("--out");
    const outDir = outIdx > 0 ? args[outIdx + 1] : null;
    if (!rowsFile || !outDir) {
      console.error("usage: bun src/pdf-wrap.ts --batch <rows-jsonl> --out <dir>");
      process.exit(2);
    }
    fs.mkdirSync(outDir, { recursive: true });
    const rows = fs.readFileSync(rowsFile, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    const reportFile = `${outDir}/report.jsonl`;
    fs.writeFileSync(reportFile, "");
    const ruleTotals: Record<string, number> = {};
    let ok = 0, skips = 0, fails = 0, titles = 0, refsCut = 0, ligJoins = 0, pua = 0, shy = 0, keys = 0;
    for (const row of rows) {
      let res: WrapResult;
      try {
        res = wrap(row.doi_id, fs.readFileSync(row.in, "utf8"), row);
      } catch (e) {
        res = { md: "", report: { doi_id: row.doi_id, status: "fail", format: row.format ?? "pdf", in_bytes: 0, out_bytes: 0, out_in_ratio: 0, title: { text: null, how: "none" }, headings_out: 0, h3_out: 0, hierarchy_repairs: 0, abstract_heading: false, refs: { cut: false, residual_headings: 0 }, rules: {}, lig: { pua_mapped: 0, pua_unmapped: 0, uni_mapped: 0, joins: 0 }, softhyphens: 0, asset_keys: 0, err: String(e) } };
      }
      const r = res.report;
      if (r.status === "ok") {
        fs.writeFileSync(`${outDir}/${safe(row.doi_id)}.md`, res.md);
        ok++;
      } else if (r.status === "skip") skips++;
      else fails++;
      if (r.title.text) titles++;
      if (r.refs.cut) refsCut++;
      ligJoins += r.lig.joins + r.lig.pua_mapped + r.lig.uni_mapped;
      pua += r.lig.pua_mapped + r.lig.pua_unmapped;
      shy += r.softhyphens;
      keys += r.asset_keys;
      for (const [k, v] of Object.entries(r.rules)) ruleTotals[k] = (ruleTotals[k] ?? 0) + v;
      fs.appendFileSync(reportFile, JSON.stringify(r) + "\n");
      console.log(`${r.status.padEnd(4)} ${row.doi_id} title=${r.title.text ? "y" : "n"} refs_cut=${r.refs.cut} h=${r.headings_out} rules=${JSON.stringify(r.rules)} lig=${r.lig.joins}j/${r.lig.pua_mapped}pua shy=${r.softhyphens} keys=${r.asset_keys}`);
    }
    console.log(`\n${rows.length} items: ${ok} ok, ${skips} skip, ${fails} fail | titles ${titles}/${rows.length} | refs cut ${refsCut}/${rows.length} | lig joins ${ligJoins} (pua ${pua}) | softhyphens ${shy} | asset keys ${keys}`);
    console.log(`rule hits: ${JSON.stringify(ruleTotals)}`);
  } else if (args[0] && !args[0].startsWith("--")) {
    const doiId = args[0];
    const inIdx = args.indexOf("--in");
    const mdIn = inIdx > 0
      ? fs.readFileSync(args[inIdx + 1], "utf8")
      : fs.readFileSync(0, "utf8");
    const { md, report } = wrap(doiId, mdIn, { format: "pdf" });
    process.stderr.write(JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(md);
    if (report.status === "fail") process.exit(1);
  } else {
    console.error("usage: bun src/pdf-wrap.ts <doi_id> [--in <md>] | --batch <rows-jsonl> --out <dir>");
    process.exit(2);
  }
}
