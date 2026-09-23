/**
 * lint/cli.ts -- the abstract lint command.
 *
 *   abstract lint <file.typ> [--threshold p, default 0.75] [--explain id,id,...]
 *   abstract lint -            (stdin: one plain prose passage)
 *
 * Lints every paragraph block of a Typst manuscript against the rules.yaml
 * rule set (one Jev call per block) and prints each flagged block: its
 * file:line, its violation count, an excerpt, then one line per violated
 * rule as "R53  p=.78  <rule text>". The prose route lints the whole stdin
 * as a single block with no section. --explain prints the full YAML entry
 * for the given ids (no file, no API call). Exit codes: 0 clean, 1
 * violations, 2 usage or hard error.
 *
 * The tuning tool (config/plugin/harness.ts) runs the same core with the
 * same renderer; flags live here because they are for testing and
 * debugging, not for agents.
 */
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scanFile, scanText } from "./scan.ts";
import { lintBlocks, loadRules, makeClient } from "./jev.ts";
import { explainRule, renderLint } from "./format.ts";
import type { Block } from "./scan.ts";

const LINT_DIR = resolve(fileURLToPath(import.meta.url), "..");
const HARNESS_DIR = resolve(LINT_DIR, "..");
const EDITS = resolve(LINT_DIR, "rules.yaml");

function usage(message?: string): never {
  if (message) console.error(`abstract lint: ${message}`);
  console.error(
    "usage: abstract lint <file.typ> [--threshold p] [--explain id,id,...]",
  );
  console.error("       abstract lint -   (stdin: one plain prose passage)");
  process.exit(2);
}

/** The raw YAML slice for one entry, verbatim. */
function explain(ids: number[]): void {
  for (const id of ids) {
    const entry = explainRule(EDITS, id);
    if (!entry) usage(`no entry ${id} in rules.yaml`);
    console.log(entry + "\n");
  }
}

export async function lint(args: string[]): Promise<void> {
  let file: string | undefined;
  let threshold = 0.75;
  let explainIds: number[] | undefined;

  const ids = (value: string): number[] => {
    const out = value.split(",").map((s) => s.trim().replace(/^R/i, ""));
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
    if (!explainIds) usage("a .typ file or - (prose on stdin) is required");
    return;
  }

  let blocks: Block[];
  let header: string;
  if (file === "-") {
    const prose = await Bun.stdin.text();
    if (!prose.trim()) usage("empty prose on stdin");
    // One literal block: the passage verbatim minus shell noise at the
    // ends, no document around it.
    blocks = [{ text: prose.trim(), start: 1, end: 1 }];
    header = "prose";
  } else {
    const src = resolve(file);
    if (!src.endsWith(".typ")) usage(`not a .typ file: ${file}`);
    if (!existsSync(src)) usage(`not found: ${file}`);
    blocks = scanFile(src);
    header = relative(process.cwd(), src) || src;
  }
  if (!blocks.length) usage(`no paragraph blocks found in ${file}`);

  const rules = loadRules(EDITS);
  const client = makeClient(HARNESS_DIR);
  process.stderr.write(
    `linting ${blocks.length} block${blocks.length === 1 ? "" : "s"} against ${rules.length} rules (${client.defaultModel})\n`,
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

  const { text, flagged } = renderLint(reports, header, threshold);
  console.log(text);
  if (flagged) process.exitCode = 1;
}
