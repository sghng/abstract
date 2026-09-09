#!/usr/bin/env bun
/**
 * Upload all pristine sources to repertoire-docs under raw/. Sources:
 *   raw/        (psy + jem pristine HTML)      -> raw/<doi_id>.html
 *   xml/        (psy OA JATS, pristine)        -> raw/<doi_id>.xml
 *   jem/xml/    (jem XML, pristine)            -> raw/<doi_id>.xml
 *   pdf/        (psy publisher PDFs)           -> raw/<doi_id>.pdf
 * Checkpointed via .cache/r2-raw-state.txt; resumable; 4 workers.
 * Raw objects are never rewritten by later stages.
 *
 * Run: bun src/upload-raw.ts
 */
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const BUCKET = "repertoire-docs";
const STATE = `${ROOT}/.cache/r2-raw-state.txt`;

const SOURCES: { dir: string; prefix: string }[] = [
  { dir: `${ROOT}/raw`, prefix: "raw/" }, // .html (psy + jem)
  { dir: `${ROOT}/xml`, prefix: "raw/" }, // .xml (psy OA)
  { dir: `${ROOT}/jem/xml`, prefix: "raw/" }, // .xml (jem)
  { dir: `${ROOT}/pdf`, prefix: "raw/" }, // .pdf (psy)
];

const done = new Set(
  fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8").split("\n") : [],
);
const files: { path: string; key: string }[] = [];
for (const { dir, prefix } of SOURCES) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const key = `${prefix}${f}`;
    if (!done.has(key) && /\.(html|xml|pdf)$/.test(f)) files.push({ path: `${dir}/${f}`, key });
  }
}
console.log(`${files.length} objects to upload -> r2://${BUCKET}/raw/`);

async function put(path: string, key: string): Promise<void> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await run(
        "npx",
        ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", path, "--remote"],
        { timeout: 300_000 },
      );
      fs.appendFileSync(STATE, key + "\n");
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
      const { path, key } = queue.shift()!;
      await put(path, key);
      if (++n % 50 === 0) console.log(`${n}/${files.length}`);
    }
  }),
);
console.log(`uploaded ${n}`);
