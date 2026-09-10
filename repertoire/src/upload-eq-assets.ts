#!/usr/bin/env bun
/**
 * Preserve equation source images durably:
 *   .cache/eqimg/<doi_id>:eqNNNN.png -> r2: repertoire-docs assets/<doi_id>:eqNNNN.png
 * and record the durable copy in D1: assets.attachment_key (new column;
 * `url` keeps publisher provenance, `attachment_key` points at our bucket).
 *
 * This makes the OCR stage fully resumable without Wiley: a future run can
 * bulk-sync assets/eq-* back into .cache/eqimg and re-run img2latex offline.
 *
 * Also snapshots the resume artifacts (eqimg-misses.json, img2latex-state.json)
 * into reports/ so a crash on this machine loses no work product.
 *
 * Checkpointed via .cache/eq-asset-state.txt; resumable; 6 workers.
 *
 * Run: bun src/upload-eq-assets.ts
 */
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const BUCKET = "repertoire-docs";
const IMG_DIR = `${ROOT}/.cache/eqimg`;
const STATE = `${ROOT}/.cache/eq-asset-state.txt`;
const D1 = "repertoire";

const done = new Set(
  fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8").split("\n") : [],
);
const files = fs
  .readdirSync(IMG_DIR)
  .filter((f) => f.endsWith(".png") && !done.has(f))
  .map((f) => ({ file: f, key: `assets/${f}` }));
console.log(`${files.length} equation images to upload -> r2://${BUCKET}/assets/`);

let n = 0;
const queue = [...files];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const { file, key } = queue.shift()!;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          await run(
            "npx",
            ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", `${IMG_DIR}/${file}`, "--remote"],
            { timeout: 120_000 },
          );
          fs.appendFileSync(STATE, file + "\n");
          break;
        } catch (e) {
          if (attempt === 5) throw e;
          await new Promise((r) => setTimeout(r, 3000 * attempt));
        }
      }
      if (++n % 200 === 0) console.log(`${n}/${files.length}`);
    }
  }),
);
console.log(`uploaded ${n} equation images`);

// D1: add attachment_key column if missing, then one UPDATE per image.
await run("npx", ["wrangler", "d1", "execute", D1, "--remote", "--command",
  "alter table assets add column attachment_key text"], { timeout: 60_000 })
  .catch((e) => console.log("alter (exists?):", String(e).split("\n")[0]));

const sqlPath = `${ROOT}/.cache/eq-attachment-keys.sql`;
const w = fs.createWriteStream(sqlPath);
for (const { file, key } of files) {
  const stem = file.replace(/\.png$/, "");
  const i = stem.lastIndexOf(":");
  const doi = stem.slice(0, i).replace(":", "/");
  const handle = stem.slice(i + 1);
  w.write(
    `update assets set attachment_key='${key.replace(/'/g, "''")}' where doi='${doi.replace(/'/g, "''")}' and handle='${handle}';\n`,
  );
}
w.end();
await new Promise((r) => w.once("close", r));
await run("npx", ["wrangler", "d1", "execute", D1, "--remote", "--file", sqlPath], { timeout: 600_000 });
console.log(`D1 attachment_key updated for ${files.length} eq rows`);

// snapshot resume artifacts into reports/
for (const f of ["eqimg-misses.json", "img2latex-state.json", "merge-report.json"]) {
  const src = `${ROOT}/.cache/${f}`;
  if (fs.existsSync(src)) {
    await run("npx", ["wrangler", "r2", "object", "put", `${BUCKET}/reports/${f}`, "--file", src, "--remote"],
      { timeout: 60_000 });
    console.log(`snapshotted reports/${f}`);
  }
}
console.log("done");
