#!/usr/bin/env bun
/**
 * Pull JEM pristine HTML from the old bucket repertoire-html into
 * raw/{doi_id}.html. Those objects were uploaded BEFORE the cleaning pass,
 * so they are the only surviving raw copies of the recent-era JEM HTML
 * (the 2005-2019 backfile fallbacks were cleaned in place and never
 * synced; the cleaned local copy is their canonical raw, recorded as a
 * wart). Resumable: skips files already present locally. 4 workers.
 *
 * Run: bun jem/pull-raw.ts
 */
import { mkdir } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const RAW_DIR = `${ROOT}/raw`;
const JEM_HTML = `${ROOT}/jem/html`;

const main = async () => {
  await mkdir(RAW_DIR, { recursive: true });
  // D1 papers rows only cover the recent era; the local working dir is
  // the complete inventory of JEM HTML papers.
  const files = (await readdir(JEM_HTML)).filter((f) => f.endsWith(".html"));
  console.log(`${files.length} jem html papers to pull`);

  let n = 0;
  const queue = [...files];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const f = queue.shift()!;
        const outPath = `${RAW_DIR}/${f}`;
        if (await Bun.file(outPath).exists()) continue;
        try {
          await run(
            "npx",
            ["wrangler", "r2", "object", "get", `repertoire-html/${f}`, "--file", outPath, "--remote"],
            { timeout: 120_000 },
          );
          const stat = await Bun.file(outPath).exists();
          if (!stat) throw new Error("empty get");
          // wrangler exits 0 on a missing object after writing a 0-byte file.
          if ((await Bun.file(outPath).size) === 0) {
            await run("rm", [outPath]);
            throw new Error("missing object (0-byte)");
          }
        } catch (e) {
          // Expected for the backfile era (never synced). Counted, not retried.
          console.log(`MISS ${f}`);
        }
        if (++n % 25 === 0) console.log(`${n}/${queue.length + n}`);
      }
    }),
  );
  console.log("done");
};

main();
