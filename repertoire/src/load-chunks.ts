#!/usr/bin/env bun
/**
 * Load .cache/chunks/*.json into D1 `chunks` (pointers: heading, section,
 * line span -- no passage text; passages are read from the R2 md by the
 * query client). Full rebuild by default; --doi <doi_id> does an
 * idempotent delete+insert of one paper for increment runs.
 *
 * One INSERT per line (SQLITE_TOOBIG lesson), ~10K statements per --file.
 *
 * Run: bun src/load-chunks.ts [--doi 10.1111:jedm.12045]
 */
import { readdir, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const CHUNK_DIR = `${ROOT}/.cache/chunks`;
const SQL_DIR = `${ROOT}/.cache/chunk-sql`;
const BATCH = 10_000;

const argIdx = process.argv.indexOf("--doi");
const only = argIdx > -1 ? process.argv[argIdx + 1] : null;

type Chunk = { chunk_no: number; heading: string; section: string; line_start: number; line_end: number };
const q = (s: string | null | undefined) => (s ?? "").replace(/'/g, "''");

await mkdir(SQL_DIR, { recursive: true });
const files = (await readdir(CHUNK_DIR)).filter((f) => f.endsWith(".json")).sort();
let stmts: string[] = [];
let batch = 0;
let rows = 0;
const batchFiles: string[] = [];

async function flushBatch() {
  if (!stmts.length) return;
  const name = `chunks-${String(batch++).padStart(3, "0")}.sql`;
  await writeFile(`${SQL_DIR}/${name}`, stmts.join("\n") + "\n");
  batchFiles.push(name);
  stmts = [];
}

for (const f of files) {
  if (only && f !== `${only}.json`) continue;
  const doiId = f.slice(0, -5);
  const doi = doiId.replace(":", "/");
  const chunks: Chunk[] = JSON.parse(await readFile(`${CHUNK_DIR}/${f}`, "utf8"));
  if (only) stmts.push(`delete from chunks where doi='${q(doi)}';`);
  for (const c of chunks) {
    stmts.push(
      `insert into chunks (doi, chunk_no, heading, section, line_start, line_end) values ` +
        `('${q(doi)}', ${c.chunk_no}, '${q(c.heading)}', '${q(c.section)}', ${c.line_start}, ${c.line_end});`,
    );
    rows++;
  }
  if (stmts.length >= BATCH) await flushBatch();
}
await flushBatch();

for (const name of batchFiles) {
  await run("npx", ["wrangler", "d1", "execute", "repertoire", "--remote", "--file", `${SQL_DIR}/${name}`], { timeout: 300_000 });
  console.log(`loaded ${name}`);
}
await rm(SQL_DIR, { recursive: true, force: true });
console.log(`done: ${rows} chunk rows${only ? ` for ${only}` : ""}`);
