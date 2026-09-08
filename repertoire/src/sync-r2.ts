#!/usr/bin/env bun
/**
 * Sync raw HTML / MD / XML to R2 buckets repertoire-html / -md / -xml.
 * Scans both the flat (psychometrika) and jem/ data dirs; R2 keys stay
 * bare filenames (DOI prefixes never collide across journals).
 * Checkpointed via .cache/r2-sync-state.txt; resumable. wrangler per-object
 * put, 4 workers. Usage: bun src/sync-r2.ts [html|md|xml]
 */
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const KIND = process.argv[2] ?? "html";
const DIRS = [`${ROOT}/${KIND}`, `${ROOT}/jem/${KIND}`];
const BUCKET = `repertoire-${KIND}`;
const STATE = `${ROOT}/.cache/r2-sync-${KIND}.txt`;

const done = new Set(
  fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8").split("\n") : [],
);
const files: { dir: string; f: string }[] = [];
for (const dir of DIRS) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith(`.${KIND}`) && !done.has(f)) files.push({ dir, f });
  }
}
console.log(`${files.length} files to sync -> r2://${BUCKET}`);

async function put(dir: string, f: string): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await run("npx", ["wrangler", "r2", "object", "put", `${BUCKET}/${f}`, "--file", `${dir}/${f}`, "--remote"], { timeout: 300_000 });
      fs.appendFileSync(STATE, f + "\n");
      return;
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
}

let n = 0;
const queue = [...files];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const { dir, f } = queue.shift()!;
      await put(dir, f);
      if (++n % 20 === 0) console.log(`${n}/${files.length}`);
    }
  }),
);
console.log(`synced ${n}`);
