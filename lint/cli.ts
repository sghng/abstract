/**
 * lint/cli.ts -- the abstract lint command.
 *
 *   abstract lint <file.typ> [--threshold p, default 0.75] [--explain id,id,...]
 *
 * Lints every paragraph block of a Typst manuscript against the edits.yaml
 * rule set (one Jev call per block) and prints each flagged block: its
 * file:line, its violation count, an excerpt, then one line per violated
 * rule with its probability. --explain prints the full YAML entry for the
 * given ids (no file, no API call). Exit codes: 0 clean, 1 violations,
 * 2 usage or hard error.
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scan } from "./scan.ts";
import { lintBlocks, loadRules, makeClient } from "./jev.ts";

const LINT_DIR = resolve(fileURLToPath(import.meta.url), "..");
const HARNESS_DIR = resolve(LINT_DIR, "..");
const EDITS = resolve(LINT_DIR, "edits.yaml");

function usage(message?: string): never {
  if (message) console.error(`abstract lint: ${message}`);
  console.error(
    "usage: abstract lint <file.typ> [--threshold p] [--explain id,id,...]",
  );
  process.exit(2);
}

/** The raw YAML slice for one entry, verbatim. */
function explain(ids: number[]): void {
  const lines = readFileSync(EDITS, "utf8").split("\n");
  for (const id of ids) {
    const start = lines.findIndex((l) => l === `${id}:`);
    if (start === -1) usage(`no entry ${id} in edits.yaml`);
    let end = lines.length;
    for (let j = start + 1; j < lines.length; j++)
      if (/^\d+:$/.test(lines[j])) {
        end = j;
        break;
      }
    console.log(lines.slice(start, end).join("\n").trimEnd() + "\n");
  }
}

/** Block text on one line, for excerpts. */
function oneline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function lint(args: string[]): Promise<void> {
  let file: string | undefined;
  let threshold = 0.75;
  let explainIds: number[] | undefined;

  const ids = (value: string): number[] => {
    const out = value.split(",").map((s) => s.trim());
    if (!out.length || out.some((s) => !/^\d+$/.test(s)))
      usage(`--explain wants comma-separated entry ids, got "${value}"`);
    return out.map(Number);
  };
  const probability = (value: string): number => {
    const p = Number(value);
    if (!(p >= 0 && p <= 1))
      usage(`--threshold wants a probability in [0, 1], got "${value}"`);
    return p;
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--threshold") threshold = probability(args[++i] ?? usage());
    else if (a.startsWith("--threshold=")) threshold = probability(a.slice(12));
    else if (a === "--explain") explainIds = ids(args[++i] ?? usage());
    else if (a.startsWith("--explain=")) explainIds = ids(a.slice(10));
    else if (a.startsWith("--")) usage(`unknown flag ${a}`);
    else if (!file) file = a;
    else usage(`unexpected argument ${a}`);
  }

  if (explainIds) explain(explainIds);
  if (!file) {
    if (!explainIds) usage("a .typ file is required");
    return;
  }

  const src = resolve(file);
  if (!src.endsWith(".typ")) usage(`not a .typ file: ${file}`);
  if (!existsSync(src)) usage(`not found: ${file}`);

  const rules = loadRules(EDITS);
  const blocks = scan(readFileSync(src, "utf8"));
  if (!blocks.length) usage(`no paragraph blocks found in ${file}`);

  const client = makeClient(HARNESS_DIR);
  const shown = relative(process.cwd(), src) || src;
  process.stderr.write(
    `linting ${blocks.length} blocks against ${rules.length} rules (${client.defaultModel})\n`,
  );
  let reports;
  try {
    reports = await lintBlocks(
      client,
      blocks,
      rules,
      threshold,
      (done, total) => process.stderr.write(`\r${done}/${total}`),
    );
  } catch (e) {
    process.stderr.write("\n");
    usage(e instanceof Error ? e.message : String(e));
  }
  process.stderr.write("\n");

  let flagged = 0;
  for (const { block, hits } of reports) {
    if (!hits.length) continue;
    flagged++;
    const excerpt = oneline(block.text).slice(0, 120);
    console.log(`${shown}:${block.start}  ${hits.length} violation(s)`);
    console.log(`  ${excerpt}${excerpt.length >= 120 ? "..." : ""}`);
    for (const { rule, p } of hits)
      console.log(
        `  ${String(rule.id).padStart(3)}  ${p.toFixed(2)}  ${oneline(rule.text)}`,
      );
    console.log();
  }
  console.log(
    `${shown}: ${blocks.length} blocks, ${flagged} flagged (threshold ${threshold})`,
  );
  if (flagged) process.exitCode = 1;
}
