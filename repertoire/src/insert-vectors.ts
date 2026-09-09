#!/usr/bin/env bun
/**
 * repertoire insert-vectors: push .cache/vectors/*.ndjson into Vectorize.
 *
 * Concatenates per-paper checkpoints into batches of 1000 vectors and calls
 * `wrangler vectorize insert`. Tracks completed batches in
 * .cache/insert-state.txt so the run is resumable.
 *
 * --fresh-index: delete and recreate the index first (full rebuilds; md
 * changed, so old vectors are stale). Metadata indexes must exist before
 * the first insert, per Vectorize rules.
 */
import { readdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const VEC_DIR = `${ROOT}/.cache/vectors`;
const BATCH_DIR = `${ROOT}/.cache/batches`;
const STATE = `${ROOT}/.cache/insert-state.txt`;
const BATCH = 1000;

if (process.argv.includes("--fresh-index")) {
  console.log("recreating index repertoire (dimensions 1024, cosine)");
  await run(
    "npx",
    ["wrangler", "vectorize", "index", "delete", "repertoire", "--force", "--yes"],
    { cwd: ROOT },
  ).catch((e) => console.log("delete skipped:", String(e).split("\n")[0]));
  await run(
    "npx",
    [
      "wrangler", "vectorize", "index", "create", "repertoire",
      "--dimensions", "1024", "--metric", "cosine",
      "--metadata-indexing", `(doi:string,journal:string,year:numeric,section:string)`,
    ],
    { cwd: ROOT },
  );
  await writeFile(STATE, "");
}

const doneBatches = new Set(
  (await Bun.file(STATE).exists() ? await readFile(STATE, "utf8") : "").split("\n").filter(Boolean),
);

// build batch files once (deterministic order)
const files = (await readdir(VEC_DIR)).filter((f) => f.endsWith(".ndjson")).sort();
let batchIdx = 0;
let lines: string[] = [];
const batches: string[] = [];
await Bun.write(`${BATCH_DIR}/.keep`, "");
for (const f of files) {
  const content = await readFile(`${VEC_DIR}/${f}`, "utf8");
  for (const line of content.split("\n")) {
    if (!line) continue;
    lines.push(line);
    if (lines.length === BATCH) {
      const name = `batch-${String(batchIdx++).padStart(4, "0")}.ndjson`;
      await writeFile(`${BATCH_DIR}/${name}`, lines.join("\n") + "\n");
      batches.push(name);
      lines = [];
    }
  }
}
if (lines.length) {
  const name = `batch-${String(batchIdx++).padStart(4, "0")}.ndjson`;
  await writeFile(`${BATCH_DIR}/${name}`, lines.join("\n") + "\n");
  batches.push(name);
}
console.log(`${files.length} papers -> ${batches.length} batches`);

for (const [i, name] of batches.entries()) {
  if (doneBatches.has(name)) continue;
  const proc = Bun.spawn(
    ["wrangler", "vectorize", "insert", "repertoire", "--file", `${BATCH_DIR}/${name}`],
    { stdout: "pipe", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) throw new Error(`insert ${name} failed: ${await new Response(proc.stderr).text()}`);
  await appendFile(STATE, name + "\n");
  if ((i + 1) % 5 === 0 || i === batches.length - 1) console.log(`[${i + 1}/${batches.length}]`);
}
console.log("all batches inserted");
