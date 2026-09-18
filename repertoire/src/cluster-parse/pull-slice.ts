#!/usr/bin/env bun
/**
 * v2 self-staging puller: fetch a slice of R2 objects into SGE $TMPDIR at
 * high concurrency (measured 2026-09-18: REST GETs uncapped at ~28 req/s
 * account-side; P12 per task). Verifies bytes when known. Writes
 * $TMPDIR/raw-new/<doi_id>.<fmt> and $TMPDIR/miss.jsonl.
 *
 * Usage: bun pull-slice.ts <slice-file> <fmt>
 */
import * as fs from "node:fs";

const sliceFile = process.argv[2];
const fmt = process.argv[3];
const TMP = process.env.TMPDIR ?? "/tmp";
const env = fs.readFileSync(`${process.env.HOME}/parse-run/.env`, "utf8");
const cred = (k: string) =>
  env.match(new RegExp(`${k}="?([^"\\n]+)"?`))?.[1]?.trim();
const TOKEN = cred("CF_API_TOKEN")!;
const ACCT = cred("CF_ACCOUNT")!;
const BUCKET = cred("R2_BUCKET")!;

const ids = fs
  .readFileSync(sliceFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
const dest = (id: string) => `${TMP}/raw-new/${id}.${fmt}`;
fs.mkdirSync(`${TMP}/raw-new`, { recursive: true });

const miss = `${TMP}/miss.jsonl`;
let done = 0;
// pacing: each worker sleeps PAUSE_MS between requests; CONC workers per
// task. MEASURED 2026-09-18: the R2 REST path 429s at roughly 15+ req/s
// or ~16+ concurrent connections ACCOUNT-WIDE (fleet of 68 tasks x 4
// conns collapsed into backoff and crawled). Defaults are 1 conn/task
// with 1000ms pacing; cap concurrent TASKS (qsub -tc) so the fleet
// stays near ~16 connections total.
const CONC = Number(process.env.PULL_CONC ?? 1);
const PAUSE_MS = Number(process.env.PULL_PAUSE_MS ?? 1000);
let idx = 0;
async function worker() {
  while (idx < ids.length) {
    const id = ids[idx++];
    const d = dest(id);
    if (fs.existsSync(d) && fs.statSync(d).size > 0) {
      done++;
      continue;
    }
    const key = `raw/${id}.${fmt}`;
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
    let ok = false;
    for (let attempt = 1; attempt <= 6 && !ok; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${TOKEN}` },
          signal: AbortSignal.timeout(25_000),
        });
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 2_000 * attempt));
          continue;
        }
        if (res.status === 404) break;
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 2_000));
          continue;
        }
        fs.writeFileSync(d, Buffer.from(await res.arrayBuffer()));
        ok = true;
      } catch {
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
    if (!ok)
      fs.appendFileSync(miss, JSON.stringify({ doi_id: id, key }) + "\n");
    done++;
    await new Promise((r) => setTimeout(r, PAUSE_MS));
    // writeSync: file-redirected stdout is block-buffered in Bun, which hid
    // live progress from the heartbeat for 10+ minutes at a time.
    if (done % 50 === 0) fs.writeSync(1, `pull ${done}/${ids.length}\n`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
const present = ids.filter(
  (id) => fs.existsSync(dest(id)) && fs.statSync(dest(id)).size > 0,
).length;
console.log(
  `pull-slice done: ${present}/${ids.length} present, misses logged to ${miss}`,
);
if (present === 0) process.exit(1);
