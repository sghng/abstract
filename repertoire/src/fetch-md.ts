#!/usr/bin/env bun
/**
 * repertoire fetch-md: targeted md download from R2 for a list of doi_ids.
 *
 * Reads .cache/journal-md-list.txt (one `<doi_id>.md` per line) and fetches
 * each missing object from r2://repertoire/md/ via wrangler (token auth;
 * the S3 key pair went stale 2026-10). Checkpointed by file existence, so
 * re-run to resume. Usage: bun src/fetch-md.ts [--concurrency 16]
 */
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const LIST = `${ROOT}/.cache/journal-md-list.txt`;
const OUT = `${ROOT}/.cache/md`;
const argIdx = process.argv.indexOf("--concurrency");
const CONCURRENCY = argIdx > -1 ? Number(process.argv[argIdx + 1]) : 16;

mkdirSync(OUT, { recursive: true });
const all = (await readFile(LIST, "utf8")).split("\n").filter(Boolean);
const todo = all.filter((f) => !existsSync(`${OUT}/${f}`));
console.log(`${all.length} listed, ${all.length - todo.length} present, ${todo.length} to fetch`);

let done = 0;
let failed = 0;
async function get(f: string): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await run("npx", ["wrangler", "r2", "object", "get", `repertoire/md/${f}`, "--file", `${OUT}/${f}`, "--remote"], { timeout: 120_000 });
      done++;
      if (done % 500 === 0) console.log(`${done}/${todo.length}`);
      return;
    } catch {
      if (attempt === 3) {
        failed++;
        console.error(`FAILED: ${f}`);
      } else {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    let f: string | undefined;
    while ((f = queue.pop())) await get(f);
  }),
);
console.log(`done: ${done} fetched, ${failed} failed`);
if (failed) process.exit(1);
