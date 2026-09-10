#!/usr/bin/env bun
/**
 * repertoire pipeline: one entry point for the end-to-end corpus build.
 * Built for RARE runs (annual batches): every stage is checkpointed in
 * .cache/pipeline-<journal>.json; --from/--to select a range; a stage
 * failing its command stops the run loudly.
 *
 * Stage sequences (exactly the chains proven byte-identical on the
 * 2025-09 rebuild; see docs/repertoire.md):
 *
 *   psychometrika: fetch-raw -> clean -> lean -> format -> convert ->
 *     merge-tables -> img2latex -> md-format -> chunk -> embed ->
 *     insert -> upload -> smoke
 *   jem: pull-raw (one-time, recent era) -> clean -> lean -> format ->
 *     convert-html -> clean-xml -> convert-xml -> img2latex ->
 *     md-format -> chunk -> embed -> insert -> upload -> smoke
 *
 * --validate runs the html cleaning chain into scratch dirs and gates
 * the md against the live corpus (must be byte-identical); use after any
 * cleaning-rule change.
 *
 * Usage: bun src/pipeline.ts --journal jem|psychometrika
 *          [--from stage] [--to stage] [--validate]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const JOURNAL = arg("journal");
const FROM = arg("from") ?? "fetch-raw";
const TO = arg("to") ?? "smoke";
const VALIDATE = process.argv.includes("--validate");

if (!JOURNAL || !["jem", "psychometrika"].includes(JOURNAL)) {
  console.error("usage: bun src/pipeline.ts --journal jem|psychometrika [--from s] [--to s] [--validate]");
  process.exit(2);
}

type Stage = { name: string; cmd: () => Promise<any>; validate?: () => Promise<any> };

const sh = (cmd: string, args: string[]) => run(cmd, args, { cwd: ROOT, timeout: 6 * 3600_000 });

const psyStages: Stage[] = [
  {
    name: "fetch-raw",
    cmd: () => sh("bun", ["psychometrika/fetch-raw.ts"]),
  },
  {
    name: "clean",
    cmd: () => sh("bun", ["src/clean-html.ts", "--in", "raw", "--out", "html", "--prefix", "10.10"]),
  },
  {
    name: "lean",
    cmd: () => sh("bun", ["psychometrika/lean.ts"]),
  },
  {
    name: "format",
    cmd: () => sh("npx", ["prettier", "--parser", "html", "--write", "html/10.10*.html"]),
  },
  {
    name: "convert",
    cmd: () => sh("bun", ["psychometrika/html2md.ts"]),
  },
  {
    name: "merge-tables",
    cmd: () =>
      sh("../.venv/bin/python", ["psychometrika/merge-tables.py"], ).catch((e) => {
        throw e;
      }),
  },
  {
    name: "img2latex",
    cmd: () => sh("bun", ["src/img2latex.ts"]),
  },
  {
    name: "md-format",
    cmd: () => sh("npx", ["prettier", "--write", "md/*.md"]),
  },
  {
    name: "chunk",
    cmd: () => sh("bun", ["src/chunk.ts"]),
  },
  {
    name: "embed",
    cmd: () => sh("bun", ["src/embed.ts"]),
  },
  {
    name: "insert",
    cmd: () => sh("bun", ["src/insert-vectors.ts", "--fresh-index"]),
  },
  {
    name: "upload",
    cmd: () => sh("bun", ["src/upload-derived.ts"]),
  },
  {
    name: "smoke",
    cmd: () => sh("bun", ["src/query.ts", "--smoke"]),
  },
];

const jemStages: Stage[] = [
  {
    name: "pull-raw",
    cmd: () => sh("bun", ["jem/pull-raw.ts"]),
  },
  {
    name: "clean",
    cmd: () => sh("bun", ["jem/clean-html.ts", "--in", "raw", "--out", "jem/html", "--prefix", "10.1111"]),
  },
  {
    name: "lean",
    cmd: () => sh("bun", ["jem/lean.ts"]),
  },
  {
    name: "format",
    cmd: () => sh("npx", ["prettier", "--parser", "html", "--write", "jem/html/*.html"]),
  },
  {
    name: "convert-html",
    cmd: () => sh("bun", ["jem/jem2md.ts"]),
  },
  {
    name: "clean-xml",
    cmd: () => sh("bun", ["src/clean-xml.ts"]),
  },
  {
    name: "convert-xml",
    cmd: () => sh("bun", ["jem/jemxml2md.ts", "--xml-dir", "xml-clean"]),
  },
  {
    name: "img2latex",
    cmd: () => sh("bun", ["src/img2latex.ts", "--journal", "jem"]),
  },
  {
    name: "md-format",
    cmd: () => sh("npx", ["prettier", "--write", "jem/md/*.md"]),
  },
  {
    name: "chunk",
    cmd: () => sh("bun", ["src/chunk.ts"]),
  },
  {
    name: "embed",
    cmd: () => sh("bun", ["src/embed.ts"]),
  },
  {
    name: "insert",
    cmd: () => sh("bun", ["src/insert-vectors.ts", "--fresh-index"]),
  },
  {
    name: "upload",
    cmd: () => sh("bun", ["src/upload-derived.ts"]),
  },
  {
    name: "smoke",
    cmd: () => sh("bun", ["src/query.ts", "--smoke"]),
  },
];

const validatePsy = async () => {
  // full redo of the html chain into scratch dirs; md must be identical
  await sh("rm", ["-rf", ".cache/html-rebuild", ".cache/md-rebuild"]);
  await sh("bun", ["src/clean-html.ts", "--in", "raw", "--out", ".cache/html-rebuild", "--prefix", "10.10"]);
  await sh("bun", ["psychometrika/lean.ts", "--in", ".cache/html-rebuild"]);
  await sh("npx", ["prettier", "--parser", "html", "--write", ".cache/html-rebuild/10.10*.html"]);
  await sh("bun", [
    "psychometrika/html2md.ts",
    "--html-dir", ".cache/html-rebuild",
    "--md-dir", ".cache/md-rebuild",
    "--sql", ".cache/assets-validate.sql",
  ]);
  await sh("bun", ["src/gate-diff.ts", "md", ".cache/md-rebuild"]);
};

const main = async () => {
  if (VALIDATE) {
    if (JOURNAL === "psychometrika") return validatePsy();
    console.error("--validate not wired for jem yet (chain proven manually 2025-09)");
    process.exit(2);
  }

  const stages = JOURNAL === "jem" ? jemStages : psyStages;
  const statePath = `${ROOT}/.cache/pipeline-${JOURNAL}.json`;
  const state: Record<string, string> = JSON.parse(
    (await readFile(statePath).catch(() => "{}")) as any,
  );

  const lo = stages.findIndex((s) => s.name === FROM);
  const hi = stages.findIndex((s) => s.name === TO);
  if (lo < 0 || hi < 0 || lo > hi) {
    console.error(`unknown stage range ${FROM}..${TO}`);
    console.error(stages.map((s) => s.name).join(" -> "));
    process.exit(2);
  }

  for (const s of stages.slice(lo, hi + 1)) {
    const t0 = Date.now();
    console.log(`[${JOURNAL}] ${s.name} ...`);
    await s.cmd();
    state[s.name] = new Date().toISOString();
    await writeFile(statePath, JSON.stringify(state, null, 2));
    console.log(`[${JOURNAL}] ${s.name} done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`pipeline complete: ${JOURNAL} ${FROM}..${TO}`);
};

main();
