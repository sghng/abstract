#!/usr/bin/env bun
/**
 * repertoire psy-fetch: download article HTML for all listed papers.
 *
 * Pool of 6 workers over D1 rows in state 'listed'. Saves verbatim HTML to
 * html/{doi_id}.html, scrapes citation_* meta tags into D1, sets state
 * 'fetched'. Resumable: skips papers whose HTML file already exists.
 */
import { mkdir, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const HTML_DIR = `${ROOT}/html`;
const CONCURRENCY = 6;

async function d1(sql: string): Promise<any[]> {
  const proc = Bun.spawn(
    ["wrangler", "d1", "execute", "repertoire", "--remote", "--command", sql, "--json"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return JSON.parse(out)[0]?.results ?? [];
}

async function d1Batch(statements: string[]) {
  if (!statements.length) return;
  const file = `${ROOT}/.cache/d1-batch.sql`;
  await writeFile(file, statements.join("\n") + "\n");
  const proc = Bun.spawn(
    ["wrangler", "d1", "execute", "repertoire", "--remote", "--file", file],
    { stdout: "pipe", stderr: "pipe" },
  );
  if ((await proc.exited) !== 0)
    throw new Error(`d1 batch failed: ${await new Response(proc.stderr).text()}`);
}

const esc = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);

function metas(html: string) {
  const get = (name: string) =>
    html.match(new RegExp(`<meta name="${name}"\\s+content="([^"]*)"`, "i"))?.[1] ?? null;
  const getAll = (name: string) =>
    [...html.matchAll(new RegExp(`<meta name="${name}"\\s+content="([^"]*)"`, "gi"))].map(
      (m) => m[1],
    );
  return {
    title: get("citation_title"),
    authors: getAll("citation_author").join("; ") || null,
    date: get("citation_publication_date") ?? get("citation_online_date"),
    keywords: get("citation_keywords"),
  };
}

async function fetchOne(p: { doi: string; doi_id: string; article_url: string }) {
  const outPath = `${HTML_DIR}/${p.doi_id}.html`;
  if (await Bun.file(outPath).exists()) return { p, skipped: true };
  const res = await fetch(p.article_url, {
    headers: { "user-agent": "Mozilla/5.0 (repertoire corpus builder)" },
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const html = await res.text();
  await writeFile(outPath, html);
  return { p, skipped: false, html };
}

const main = async () => {
  await mkdir(HTML_DIR, { recursive: true });
  const rows = await d1(
    "select doi, doi_id, article_url from papers where state in ('listed','fetched','downloaded')",
  );
  console.log(`${rows.length} papers to fetch`);

  let done = 0;
  const updates: string[] = [];
  const queue = [...rows];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift()!;
      try {
        const r = await fetchOne(p);
        if (!r.skipped && r.html) {
          const m = metas(r.html);
          updates.push(
            `update papers set state='fetched', title=coalesce(${esc(m.title)}, title), ` +
              `authors=${esc(m.authors)}, keywords=${esc(m.keywords)}, local_path=${esc(
                `${HTML_DIR}/${p.doi_id}.html`,
              )}, updated_at=current_timestamp where doi=${esc(p.doi)};`,
          );
        }
        done++;
        if (done % 25 === 0) console.log(`[${done}/${rows.length}]`);
      } catch (e: any) {
        updates.push(
          `update papers set state='failed', error=${esc(String(e.message).slice(0, 150))}, updated_at=current_timestamp where doi=${esc(p.doi)};`,
        );
        console.log(`${p.doi} FAILED: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // apply updates in chunks to keep each SQL file modest
  for (let i = 0; i < updates.length; i += 100) {
    await d1Batch(updates.slice(i, i + 100));
  }
  console.log(`done. ${updates.length} D1 updates applied`);
};

await main();
