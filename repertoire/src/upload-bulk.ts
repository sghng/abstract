#!/usr/bin/env bun
/**
 * Bulk raw uploader: consumes family manifests produced by the bulk
 * fetchers (.cache/bulk/<family>/manifest.jsonl + papers.jsonl),
 * re-verifies sha256, uploads pristine artifacts to repertoire-docs
 * under raw/<doi_id>.<fmt> (D6 layout), and emits D1 SQL batches for
 * the sources table + papers rows (explicit column lists; papers rows
 * are insert-or-ignore so relisting never clobbers state/parse_source).
 *
 * Transport (D7): Cloudflare REST API with CF_API_TOKEN from the repo
 * root .env (probe-verified R2 read/write; no wrangler spawns). 16
 * concurrent puts, streaming bodies (no byte buffering in the queue).
 *
 * Checkpointed via .cache/r2-bulk-state.txt; resumable.
 * Central by design: family fetchers never touch the bucket or D1.
 *
 * Run: bun src/upload-bulk.ts [--dry] [--family psy|jem|jebs|bjmsp|psyarxiv|arxiv]
 */
import * as fs from "node:fs";
import * as crypto from "node:crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const BUCKET = "repertoire-docs";
const BULK = `${ROOT}/.cache/bulk`;
const STATE = `${ROOT}/.cache/r2-bulk-state.txt`;
const DRY = process.argv.includes("--dry");
const FAM = process.argv.includes("--family")
  ? process.argv[process.argv.indexOf("--family") + 1]
  : null;

// Cloudflare REST credentials: CF_API_TOKEN lives in the repo root .env
// (never printed, never committed); account id is not a secret.
const envFile = fs.readFileSync(`${ROOT}/../.env`, "utf8");
const CF_API_TOKEN = envFile.match(/^CF_API_TOKEN=(.*)$/m)?.[1]?.trim();
const ACCT =
  process.env.CF_ACCOUNT_ID || "931e2de500772326b331964159d3bd2d";
if (!CF_API_TOKEN) throw new Error("CF_API_TOKEN missing from ../.env");

interface ManifestRow {
  doi: string;
  doi_id: string;
  journal: string;
  year?: number;
  format: "pdf" | "html" | "xml" | "tex" | "docx";
  file: string; // absolute or repo-relative path
  bytes: number;
  sha256: string;
  fetched_at?: string;
}
interface PaperRow {
  doi: string;
  doi_id: string;
  title?: string;
  year?: number;
  journal: string;
  issue_url?: string;
  article_url?: string;
  pdf_url?: string;
}

const families = fs
  .readdirSync(BULK)
  .filter((d) => fs.existsSync(`${BULK}/${d}/manifest.jsonl`))
  .filter((d) => !FAM || d === FAM);

const done = new Set(
  fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8").split("\n") : [],
);

function sqlStr(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "null";
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function put(path: string, key: string): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
  let hardFails = 0;
  for (let throttle = 0; throttle < 20; throttle++) {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
        body: Bun.file(path), // lazy blob: re-read from disk per attempt
      });
      const j = (await res.json().catch(() => null)) as
        | { success: boolean; errors?: unknown }
        | null;
      if (res.ok && j?.success) {
        fs.appendFileSync(STATE, key + "\n");
        return;
      }
      if (res.status === 429) {
        // flow control, not failure: wait it out (REST caps ~6-8 puts/s
        // sustained; with ~132k objects, riding 429s is the design)
        const ra = Number(res.headers.get("retry-after") || 0);
        await new Promise((r) =>
          setTimeout(r, Math.max(ra * 1000, Math.min(5000 * 2 ** throttle, 60_000))),
        );
        continue;
      }
      throw new Error(`HTTP ${res.status} ${JSON.stringify(j?.errors ?? j)}`);
    } catch (e) {
      if (++hardFails >= 5) throw e;
      await new Promise((r) => setTimeout(r, 1000 * hardFails * hardFails));
    }
  }
  throw new Error(`put ${key}: throttled 20 times`);
}

const uploadRows: ManifestRow[] = [];
const sourceValues: string[] = [];
const paperRows = new Map<string, PaperRow>();
let skipped = 0;

for (const fam of families) {
  const manifest = fs
    .readFileSync(`${BULK}/${fam}/manifest.jsonl`, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ManifestRow);
  const papers = fs.existsSync(`${BULK}/${fam}/papers.jsonl`)
    ? fs
        .readFileSync(`${BULK}/${fam}/papers.jsonl`, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as PaperRow)
    : [];
  for (const p of papers) if (!paperRows.has(p.doi)) paperRows.set(p.doi, p);

  for (const m of manifest) {
    const path = m.file.startsWith("/") ? m.file : `${ROOT}/${m.file.replace(/^repertoire\//, "")}`;
    const key = `raw/${m.doi_id}.${m.format}`;
    sourceValues.push(
      `(${sqlStr(m.doi)}, '${m.format}', ${sqlStr(key)}, ${m.bytes ?? null}, ${sqlStr(m.sha256)}, ${sqlStr(m.fetched_at ?? new Date().toISOString())})`,
    );
    if (done.has(key) || DRY) {
      skipped++;
      continue;
    }
    if (!fs.existsSync(path)) {
      console.log(`WARN missing file (manifest row kept for D1): ${path}`);
      continue;
    }
    const bytes = fs.readFileSync(path);
    const sha = crypto.createHash("sha256").update(bytes).digest("hex");
    if (sha !== m.sha256 || bytes.length !== m.bytes) {
      console.log(`WARN sha/size mismatch ${path}: manifest ${m.sha256.slice(0, 8)}/${m.bytes} actual ${sha.slice(0, 8)}/${bytes.length} (uploading actual, fixing SQL)`);
      const idx = sourceValues.length - 1;
      sourceValues[idx] = `(${sqlStr(m.doi)}, '${m.format}', ${sqlStr(key)}, ${bytes.length}, ${sqlStr(sha)}, ${sqlStr(new Date().toISOString())})`;
    }
    uploadRows.push({ ...m, file: path });
  }
}

console.log(
  `${families.join(", ")}: ${uploadRows.length} to upload, ${skipped} already done/DRY, ${paperRows.size} papers, ${sourceValues.length} source rows`,
);

let n = 0;
const queue = [...uploadRows];
if (!DRY) {
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const m = queue.shift()!;
        const key = `raw/${m.doi_id}.${m.format}`;
        await put(m.file, key);
        if (++n % 500 === 0) console.log(`${n}/${uploadRows.length}`);
      }
    }),
  );
}

// D1 batches: 50 rows per insert statement. D1 rejects long statements
// (SQLITE_TOOBIG); measured: 150-row papers statements with titles+urls
// (~90KB) still trip it, 150-row sources statements (~22KB) pass.
function batch(values: string[], head: string, tail: string): string {
  const out: string[] = [];
  for (let i = 0; i < values.length; i += 50) {
    out.push(head + "\n" + values.slice(i, i + 50).join(",\n") + tail);
  }
  return out.join("\n;\n") + (out.length ? ";\n" : "");
}
const sourcesSql = batch(
  sourceValues.map((v) => v.replace(/^\(/, "(")), // already parenthesized
  "insert or replace into sources (doi, format, key, bytes, sha256, fetched_at) values",
  "",
);
const papersSql = batch(
  [...paperRows.values()].map(
    (p) =>
      `(${sqlStr(p.doi)}, ${sqlStr(p.doi_id)}, ${sqlStr(p.title)}, ${p.year ?? null}, ` +
      `${sqlStr(p.journal)}, ${sqlStr(p.issue_url)}, ${sqlStr(p.article_url)}, ${sqlStr(p.pdf_url)}, 'listed')`,
  ),
  "insert or ignore into papers (doi, doi_id, title, year, journal, issue_url, article_url, pdf_url, state) values",
  "",
);
fs.writeFileSync(`${BULK}/d1-sources.sql`, sourcesSql);
fs.writeFileSync(`${BULK}/d1-papers.sql`, papersSql);
console.log(
  `${DRY ? "[dry] " : ""}wrote .cache/bulk/d1-sources.sql (${sourceValues.length} rows), d1-papers.sql (${paperRows.size} rows)` +
    (DRY ? "" : `; uploaded ${n}`),
);
console.log("apply with:\n  npx wrangler d1 execute repertoire --remote --file repertoire/.cache/bulk/d1-papers.sql\n  npx wrangler d1 execute repertoire --remote --file repertoire/.cache/bulk/d1-sources.sql");
