#!/usr/bin/env bun
/**
 * Pipeline final stage: upload derived artifacts to repertoire-docs.
 * Sources (all journal-agnostic; doi_ids never collide):
 *   html/        lean psychometrika HTML   -> <doi_id>.html
 *   jem/html/    lean JEM HTML             -> <doi_id>.html
 *   xml-clean/   cleaned XML (both)        -> <doi_id>.xml
 *   md/          psychometrika md          -> <doi_id>.md
 *   jem/md/      JEM md                    -> <doi_id>.md
 *   assets/      table attachments         -> <doi_id>:tabNN.html
 * Checkpointed via .cache/r2-derived-state.txt; resumable; 4 workers.
 * Raw sources are uploaded separately (src/upload-raw.ts) and are never
 * rewritten by this stage.
 *
 * Usage: bun src/upload-derived.ts
 */
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const BUCKET = "repertoire-docs";
const STATE = `${ROOT}/.cache/r2-derived-state.txt`;

const SOURCES: { dir: string; key: (f: string) => string }[] = [
  { dir: `${ROOT}/html`, key: (f) => f },
  { dir: `${ROOT}/jem/html`, key: (f) => f },
  { dir: `${ROOT}/xml-clean`, key: (f) => f },
  { dir: `${ROOT}/md`, key: (f) => f },
  { dir: `${ROOT}/jem/md`, key: (f) => f },
  { dir: `${ROOT}/assets`, key: (f) => `assets/${f}` },
];

const done = new Set(
  fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8").split("\n") : [],
);
const files: { path: string; key: string }[] = [];
for (const { dir, key } of SOURCES) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    const k = key(f);
    if (!done.has(k) && /\.(html|xml|md)$/.test(f)) files.push({ path: `${dir}/${f}`, key: k });
  }
}
console.log(`${files.length} objects -> r2://${BUCKET}/`);

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
      if (++n % 100 === 0) console.log(`${n}/${files.length}`);
    }
  }),
);
console.log(`uploaded ${n}`);

// record table attachment keys in D1: assets/<doi_id>:tabNN.html rows get
// attachment_key so the retrieval layer can find the bucket object. url
// stays as publisher provenance where it exists.
const sqlPath = `${ROOT}/.cache/tab-attachment-keys.sql`;
const w = fs.createWriteStream(sqlPath);
let tabs = 0;
for (const f of fs.readdirSync(`${ROOT}/assets`)) {
  if (!f.endsWith(".html")) continue;
  const stem = f.replace(/\.html$/, "");
  const i = stem.lastIndexOf(":");
  const doi = stem.slice(0, i).replace(":", "/");
  const handle = stem.slice(i + 1);
  w.write(
    `update assets set attachment_key='assets/${f.replace(/'/g, "''")}' where doi='${doi.replace(/'/g, "''")}' and handle='${handle}';\n`,
  );
  tabs++;
}
w.end();
await new Promise((r) => w.once("close", r));
await run("npx", ["wrangler", "d1", "execute", "repertoire", "--remote", "--file", sqlPath], { timeout: 600_000 });
console.log(`D1 attachment_key updated for ${tabs} table rows`);
