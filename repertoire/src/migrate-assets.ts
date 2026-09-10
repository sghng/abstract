#!/usr/bin/env bun
/**
 * Re-key assets to (doi, handle) and import the pending JEM XML-derived
 * ndjson. Steps:
 *   1. create assets_new with PK (doi, handle)
 *   2. copy live rows, stripping the `${doi_id}-` prefix from asset_id to
 *      get the short handle (10.1017:psy.2025.10034-fig01 -> fig01,
 *      10.1111:jedm.12264-math-0001 -> math-0001)
 *   3. import .cache/jem-xml-assets.ndjson with upsert (XML shadows HTML)
 *   4. drop assets, rename assets_new -> assets
 *   5. verify counts by journal/kind
 * One INSERT per line, chunked --file batches (SQLITE_TOOBIG rule).
 *
 * Run: bun src/migrate-assets.ts
 */
import { writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const BATCH = `${ROOT}/.cache/assets-batch.sql`;

async function d1(sql: string, isFile = false): Promise<any[]> {
  const args = isFile
    ? ["npx", "wrangler", "d1", "execute", "repertoire", "--remote", "--json", "--file", sql]
    : ["npx", "wrangler", "d1", "execute", "repertoire", "--remote", "--json", "--command", sql];
  const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(proc.stdout).text();
  const err = await new Response(proc.stderr).text();
  if ((await proc.exited) !== 0) throw new Error(`d1 failed: ${err.slice(0, 400)}`);
  if (isFile) return []; // file mode prints a summary table, not JSON
  return out ? (JSON.parse(out)[0]?.results ?? []) : [];
}

const esc = (s: string | null | undefined) =>
  s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`;

async function execChunk(lines: string[]) {
  for (let i = 0; i < lines.length; i += 2000) {
    await writeFile(BATCH, lines.slice(i, i + 2000).join("\n") + "\n");
    await d1(BATCH, true);
  }
}

const main = async () => {
  await d1(`create table if not exists assets_new (
    doi text not null,
    handle text not null,
    kind text not null,
    url text,
    caption text,
    primary key (doi, handle)
  )`);

  // 2. copy live rows with handle derivation
  const rows = await d1("select asset_id, doi, kind, url, caption from assets");
  console.log(`live rows: ${rows.length}`);
  const lines = rows.map((r: any) => {
    const doiId = r.asset_id.replace(/-(fig|tab|eq|math)[-_]?[0-9]+$/, "");
    let handle = r.asset_id.startsWith(doiId + "-") ? r.asset_id.slice(doiId.length + 1) : r.asset_id;
    return `insert or ignore into assets_new (doi, handle, kind, url, caption) values (${esc(r.doi)}, ${esc(handle)}, ${esc(r.kind)}, ${esc(r.url)}, ${esc(r.caption)});`;
  });
  await execChunk(lines);
  console.log("copied live rows");

  // 3. import xml-derived jem assets, xml wins on conflict
  const ndjson = await Bun.file(`${ROOT}/.cache/jem-xml-assets.ndjson`).text();
  const xmlLines = ndjson
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .map(
      (r: any) =>
        `insert into assets_new (doi, handle, kind, url, caption) values (${esc(r.doi)}, ${esc(r.asset_id)}, ${esc(r.kind)}, ${esc(r.url)}, ${esc(r.caption)}) on conflict(doi, handle) do update set kind=excluded.kind, url=excluded.url, caption=excluded.caption;`,
    );
  await execChunk(xmlLines);
  console.log(`imported ${xmlLines.length} xml-derived rows`);

  // 4. swap
  await d1("drop table assets");
  await d1("alter table assets_new rename to assets");

  // 5. verify
  const counts = await d1(
    "select case when doi like '10.1017%' then 'psy' else 'jem' end j, kind, count(*) n from assets group by j, kind",
  );
  for (const c of counts) console.log(c.j, c.kind, c.n);
  await unlink(BATCH).catch(() => {});
};

main();
