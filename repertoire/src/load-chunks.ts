#!/usr/bin/env bun
/**
 * Load .cache/chunks/*.json into D1: `chunks` (pointers: heading, section,
 * line span, chunk_id) plus `chunks_fts` (the BM25 leg: text + chunk_id).
 * chunk_id is FNV-1a-63 of doi#chunk_no, stable across rebuilds, so the
 * two tables agree by construction and --doi increments need no counter.
 *
 * --fresh (the default without --doi): delete both tables, recreate
 * chunks_fts, reload. --doi <doi_id> does an idempotent delete+insert of
 * one paper for increment runs.
 *
 * One INSERT per line, ~1K papers' worth of statements per --file.
 * FTS text is capped at FTS_CAP chars: a rare oversized atomic table
 * (176K chars observed) trips D1's SQLITE_TOOBIG statement limit, its
 * bm25 signal is junk at that length anyway, and the query tool
 * truncates passages for serving regardless.
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
const BATCH = 1_000;
const FTS_CAP = 16_000;

const argIdx = process.argv.indexOf("--doi");
const only = argIdx > -1 ? process.argv[argIdx + 1] : null;
const fresh = !only || process.argv.includes("--fresh");

type Chunk = { chunk_no: number; heading: string; section: string; line_start: number; line_end: number; text: string };
const q = (s: string | null | undefined) => (s ?? "").replace(/'/g, "''");
// strip control chars that would break the SQL file
const clean = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, " ");

// stable 63-bit id: FNV-1a over doi#chunk_no
function chunkId(doi: string, chunkNo: number): string {
  let h = 0xcbf29ce484222325n;
  const s = `${doi}#${chunkNo}`;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return BigInt.asIntN(63, h).toString();
}

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
  if (only) {
    stmts.push(`delete from chunks_fts where chunk_id in (select chunk_id from chunks where doi='${q(doi)}');`);
    stmts.push(`delete from chunks where doi='${q(doi)}';`);
  }
  for (const c of chunks) {
    const id = chunkId(doi, c.chunk_no);
    stmts.push(
      `insert into chunks (doi, chunk_no, heading, section, line_start, line_end, chunk_id) values ` +
        `('${q(doi)}', ${c.chunk_no}, '${q(c.heading)}', '${q(c.section)}', ${c.line_start}, ${c.line_end}, ${id});`,
    );
    stmts.push(`insert into chunks_fts (text, chunk_id) values ('${q(clean(c.text.slice(0, FTS_CAP)))}', ${id});`);
    rows++;
    if (stmts.length >= BATCH * 2) await flushBatch();
  }
}
await flushBatch();

if (fresh) {
  await run("npx", [
    "wrangler", "d1", "execute", "repertoire", "--remote", "--command",
    // drop+create beats delete for an FTS table (row-by-row index churn)
    "drop table if exists chunks_fts; delete from chunks; " +
      "create virtual table chunks_fts using fts5(text, chunk_id unindexed);",
  ], { timeout: 300_000 });
  console.log("cleared chunks, recreated chunks_fts");
}

for (const name of batchFiles) {
  await run("npx", ["wrangler", "d1", "execute", "repertoire", "--remote", "--file", `${SQL_DIR}/${name}`], { timeout: 300_000 });
  if (batchFiles.indexOf(name) % 10 === 9) console.log(`loaded ${batchFiles.indexOf(name) + 1}/${batchFiles.length}`);
}
await rm(SQL_DIR, { recursive: true, force: true });
console.log(`done: ${rows} chunk rows${only ? ` for ${only}` : ""}`);
