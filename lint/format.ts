/**
 * format.ts -- the shared lint report renderer: the CLI and the tuning
 * tool print the exact same output. Hits are "R53  p=.78  <rule text>"
 * (rule id zero-padded, p the probability the paragraph violates the
 * rule), blocks in document order, p descending within a block.
 */
import { existsSync, readFileSync } from "node:fs";
import type { BlockReport } from "./jev.ts";

/** Rule id as it appears in agent-facing output: R53. */
export const rid = (id: number): string => "R" + String(id).padStart(2, "0");

/** Block or rule text on one line, for excerpts and hit lines. */
export function oneline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Render a full lint run. header is the file path (file route) or "prose"
 * (prose route). Returns the text and the flagged-block count.
 */
export function renderLint(
  reports: BlockReport[],
  header: string,
  threshold: number,
): { text: string; flagged: number } {
  const out: string[] = [];
  let flagged = 0;
  for (const { block, hits } of reports) {
    if (!hits.length) continue;
    flagged++;
    const excerpt = oneline(block.text).slice(0, 120);
    const lines =
      block.end === block.start
        ? String(block.start)
        : `${block.start}-${block.end}`;
    const at = header === "prose" ? "prose:" : `${header}:${lines}`;
    out.push(`${at}  ${hits.length} violation(s)`);
    out.push(`  ${excerpt}${excerpt.length >= 120 ? "..." : ""}`);
    for (const { rule, p } of hits)
      out.push(`  ${rid(rule.id)}  p=${p.toFixed(2)}  ${oneline(rule.text)}`);
    out.push("");
  }
  const blocks = reports.length === 1 ? "1 block" : `${reports.length} blocks`;
  out.push(`${header}: ${blocks}, ${flagged} flagged (threshold ${threshold})`);
  return { text: out.join("\n"), flagged };
}

/** The raw YAML slice for one rules.yaml entry, verbatim; null if absent.
 *  Assumes top-level "N:" keys (rules.yaml's only shape: entries at column
 *  0, indented fields). */
export function explainRule(editsPath: string, id: number): string | null {
  if (!existsSync(editsPath)) return null;
  const lines = readFileSync(editsPath, "utf8").split("\n");
  const start = lines.findIndex((l) => l === `${id}:`);
  if (start === -1) return null;
  let end = lines.length;
  for (let j = start + 1; j < lines.length; j++)
    if (/^\d+:$/.test(lines[j])) {
      end = j;
      break;
    }
  return lines.slice(start, end).join("\n").trimEnd();
}
