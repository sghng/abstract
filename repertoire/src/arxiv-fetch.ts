#!/usr/bin/env bun
/**
 * arXiv e-print fetcher (self-contained, no imports beyond builtins;
 * compiled with bun for linux-x64 and deployed to studentNN hosts).
 *
 * Task file: JSONL lines {"arxiv_id","doi","primary","cats"}.
 * Per item: GET https://arxiv.org/e-print/<arxiv_id> (follows 301 to
 * /src/). Content-type branches: application/pdf -> <doi_id>.pdf
 * (pdf-only submission); gzip tarball -> <doi_id>.tex. Magic-byte
 * validation, tmp+rename, resumable, manifest + failures + STATUS.
 *
 * Usage: ./arxiv-fetch --task task.jsonl --out ./staging
 */
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import * as path from "node:path";

const args = process.argv.slice(2);
const arg = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : null);
const TASK = arg("task") ?? "task.jsonl";
const OUT = arg("out") ?? "staging";
const HOST = arg("host") ?? "unknown";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });
const MANIFEST = `${OUT}/manifest.jsonl`;
const FAILURES = `${OUT}/failures.jsonl`;
const STATUS = `${OUT}/STATUS.json`;

interface TaskRow {
  arxiv_id: string;
  doi: string;
  primary: string | null;
  cats: string[];
}

const rows: TaskRow[] = fs
  .readFileSync(TASK, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const have = new Set<string>();
if (fs.existsSync(MANIFEST)) {
  for (const l of fs.readFileSync(MANIFEST, "utf8").split("\n").filter(Boolean)) {
    try { have.add(JSON.parse(l).arxiv_id); } catch {}
  }
}
const queue = rows.filter((r) => !have.has(r.arxiv_id));
const doiId = (doi: string) => doi.toLowerCase().replace(/\//g, ":");
const total = rows.length;
let done = have.size;
let fails = 0;
let consecutive = 0;
const t0 = Date.now();

function status(phase: string, extra: object = {}) {
  fs.writeFileSync(
    STATUS,
    JSON.stringify({ host: HOST, phase, done, total, fails, elapsed_min: Math.round((Date.now() - t0) / 60000), ...extra, at: new Date().toISOString() }),
  );
}
status("start");

for (const r of queue) {
  const id = doiId(r.doi);
  let saved = false;
  let lastErr = "";
  for (let attempt = 1; attempt <= 4 && !saved; attempt++) {
    try {
      let res = await fetch(`https://arxiv.org/e-print/${r.arxiv_id}`, {
        redirect: "follow",
        headers: { "user-agent": "repertoire-fetch/0.1 (corpus building; mailto:corpus@example.org)" },
      });
      let via: string | undefined;
      if (res.status === 429 || res.status === 503) {
        const wait = Number(res.headers.get("retry-after") ?? 30);
        console.log(`${r.arxiv_id}: ${res.status}; cooling ${wait}s`);
        await sleep(wait * 1000);
        attempt--;
        continue;
      }
      if (res.status === 404) {
        lastErr = "404";
        break; // genuinely absent; do not retry
      }
      if (res.status === 403) {
        // source withheld by author request (common on old items):
        // permanent for the tarball route -- capture the PDF instead
        const fb = await fetch(`https://arxiv.org/pdf/${r.arxiv_id}`, {
          redirect: "follow",
          headers: { "user-agent": "repertoire-fetch/0.1 (corpus building; mailto:corpus@example.org)" },
        });
        if (fb.ok) {
          res = fb;
          via = "pdf-fallback";
        } else {
          lastErr = `403 source withheld; pdf fallback http ${fb.status}`;
          break;
        }
      }
      if (!res.ok) throw new Error(`http ${res.status}`);
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();
      const bytes = new Uint8Array(await res.arrayBuffer());
      const magic = bytes.subarray(0, 4);
      let format: string | null = null;
      let ext = "";
      if (magic[0] === 0x1f && magic[1] === 0x8b) { format = "tex"; ext = ".tex"; }
      else if (ct.includes("pdf") || magic[0] === 0x25 && magic[1] === 0x50 && magic[2] === 0x44 && magic[3] === 0x46) { format = "pdf"; ext = ".pdf"; }
      else { lastErr = `unexpected content: ct=${ct.slice(0, 40)} magic=${Array.from(magic).map((b) => b.toString(16)).join("")}`; break; }
      if (bytes.length < 500) { lastErr = `suspiciously small ${bytes.length}B`; break; }
      const tmp = path.join(OUT, `.tmp-${id}${ext}`);
      const fin = path.join(OUT, `${id}${ext}`);
      fs.writeFileSync(tmp, bytes);
      fs.renameSync(tmp, fin);
      const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      fs.appendFileSync(
        MANIFEST,
        JSON.stringify({
          doi: r.doi, doi_id: id, journal: "arxiv", format, file: `${path.basename(OUT)}/${id}${ext}`,
          bytes: bytes.length, sha256, arxiv_id: r.arxiv_id, primary: r.primary, cats: r.cats, via: via ?? null,
          fetched_at: new Date().toISOString(),
        }) + "\n",
      );
      saved = true;
      done++;
      consecutive = 0;
      if (done % 25 === 0) {
        status("running");
        console.log(`[${HOST}] ${done}/${total} (fails ${fails})`);
      }
    } catch (e) {
      lastErr = String(e).slice(0, 120);
      await sleep(8000 * attempt);
    }
  }
  if (!saved) {
    fails++;
    consecutive++;
    fs.appendFileSync(FAILURES, JSON.stringify({ arxiv_id: r.arxiv_id, doi: r.doi, error: lastErr, at: new Date().toISOString() }) + "\n");
  }
  if (consecutive >= 40) {
    status("stopped", { reason: `40 consecutive failures (last: ${lastErr})` });
    console.log(`STOP: 40 consecutive failures; last: ${lastErr}`);
    process.exit(0);
  }
  await sleep(3500 + Math.random() * 1000);
}
status("done");
console.log(`[${HOST}] done: ${done}/${total}, ${fails} failures`);
