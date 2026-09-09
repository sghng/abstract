#!/usr/bin/env bun
/**
 * Full-corpus MD gate: compare a reference md corpus against a new one and
 * classify every changed line. A cleaning/formatting stage passes when all
 * changes are expected classes; anything else fails loudly (doctrine:
 * byte-identical or better, verified over the WHOLE corpus).
 *
 * Comparison is a line MULTISET diff (count_old(l) vs count_new(l)), so
 * diff-alignment artifacts never enter: a line that survives anywhere is
 * unchanged. Classification of the residue, in order:
 *   whitespace      paired lines equal after trim
 *   asset-rename    ![cap](doi_id-figNN) <-> ![cap](figNN), same caption
 *   ref-layout      leftover lines are only asset refs/blanks, and no
 *                   removed caption is missing from additions (reshuffle)
 *   splice-revert   GFM rows / bold table caption / -tabNN.html attachment
 *                   removed, tab refs added (merge-tables re-run pending;
 *                   needs --allow-splice-revert)
 *   unexpected      anything else -> exit 1, samples printed
 *
 * Usage: bun src/gate-diff.ts <refDir> <newDir> [--allow-splice-revert]
 */
import { readdir } from "node:fs/promises";

const [, , refDirArg, newDirArg, ...flags] = process.argv;
if (!refDirArg || !newDirArg) {
  console.error("usage: bun src/gate-diff.ts <refDir> <newDir> [--allow-splice-revert]");
  process.exit(2);
}
const ALLOW_REVERT = flags.includes("--allow-splice-revert");
const refDir = refDirArg.replace(/\/$/, "");
const newDir = newDirArg.replace(/\/$/, "");

const isRef = (l: string) => /^!\[.*\]\(10\.[0-9]+:[^)]*-(fig|tab|eq)[0-9]+\)\s*$/.test(l.trim());
const isNewRef = (l: string) => /^!\[.*\]\((fig|tab|eq)[0-9]+\)\s*$/.test(l.trim());
const isGfm = (l: string) => l.trim().startsWith("|");
const captionOf = (l: string) => l.match(/^!\[(.*)\]\(.*\)\s*$/)?.[1];

let files = 0;
let changed = 0;
const classes: Record<string, number> = {};
const samples: Record<string, string[]> = {};
const bump = (cls: string, file: string) => {
  classes[cls] = (classes[cls] ?? 0) + 1;
  (samples[cls] ??= []).push(file);
};

/** multiset residue: lines of a not covered by b (by count) */
function residue(a: string[], b: string[]) {
  const counts = new Map<string, number>();
  for (const l of b) counts.set(l, (counts.get(l) ?? 0) + 1);
  const out: string[] = [];
  for (const l of a) {
    const c = counts.get(l) ?? 0;
    if (c > 0) counts.set(l, c - 1);
    else out.push(l);
  }
  return out;
}

const newFiles = (await readdir(newDir)).filter((f) => f.endsWith(".md")).sort();
for (const f of newFiles) {
  files++;
  const oldText = await Bun.file(`${refDir}/${f}`).text().catch(() => null);
  if (oldText === null) {
    bump("ref-missing", f);
    continue;
  }
  const oldLines = oldText.split("\n");
  const newLines = (await Bun.file(`${newDir}/${f}`).text()).split("\n");
  let removed = residue(oldLines, newLines);
  let added = residue(newLines, oldLines);
  if (!removed.length && !added.length) continue; // identical
  changed++;

  // 1. whitespace-only pairs (equal after trim)
  for (let i = 0; i < removed.length; i++) {
    const j = added.findIndex((a) => a.trim() === removed[i].trim() && a !== removed[i]);
    if (j >= 0) {
      bump("whitespace", f);
      removed.splice(i--, 1);
      added.splice(j, 1);
    }
  }

  // 2. pure renames: old long-ref line <-> new short-ref line, same caption
  //    AND same handle number
  for (let i = 0; i < removed.length; i++) {
    const r = removed[i];
    if (!isRef(r)) continue;
    const cap = captionOf(r);
    const short = r.match(/-(fig|tab|eq)[0-9]+\)/)![0].slice(1, -1);
    const j = added.findIndex(
      (a) => isNewRef(a) && captionOf(a) === cap && a.includes(`(${short})`),
    );
    if (j >= 0) {
      bump("asset-rename", f);
      removed.splice(i--, 1);
      added.splice(j, 1);
    }
  }

  // 3. ref-layout: leftovers are only asset refs and blank lines, and no
  //    removed caption is missing from the additions (pure reshuffle)
  const solidR = removed.filter((l) => l.trim() !== "");
  const solidA = added.filter((l) => l.trim() !== "");
  if (
    solidR.length > 0 &&
    solidA.length > 0 &&
    solidR.every((l) => isRef(l) || isNewRef(l)) &&
    solidA.every((l) => isRef(l) || isNewRef(l)) &&
    solidR.every((l) => !captionOf(l) || solidA.some((a) => captionOf(a) === captionOf(l)))
  ) {
    bump("ref-layout", f);
    continue;
  }

  // 4. splice-revert: leftover removals are table content, additions tab refs
  if (
    ALLOW_REVERT &&
    added.length > 0 &&
    added.every((a) => a.trim() === "" || (isNewRef(a) && /\(tab[0-9]+\)/.test(a))) &&
    removed.some((l) => isGfm(l) || /^\*\*Table/.test(l.trim()) || /-tab[0-9]+\.html\)/.test(l))
  ) {
    bump("splice-revert", f);
    continue;
  }

  if (removed.length || added.length) {
    bump("unexpected", f);
    if ((classes["unexpected"] ?? 0) <= 3) {
      console.log(`UNEXPECTED in ${f}:`);
      for (const r of removed.slice(0, 6)) console.log("  <", JSON.stringify(r.slice(0, 120)));
      for (const a of added.slice(0, 6)) console.log("  >", JSON.stringify(a.slice(0, 120)));
    }
  }
}

console.log(`files ${files}, changed ${changed}`);
for (const [cls, n] of Object.entries(classes)) {
  console.log(`${cls}: ${n}${samples[cls] ? "  e.g. " + samples[cls].slice(0, 3).join(", ") : ""}`);
}
if (classes["unexpected"]) {
  console.log("GATE FAILED");
  process.exit(1);
}
console.log("GATE PASSED");
