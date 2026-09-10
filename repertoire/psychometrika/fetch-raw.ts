#!/usr/bin/env bun
/**
 * repertoire psy-fetch-raw: re-download pristine publisher HTML for all
 * psychometrika papers into raw/{doi_id}.html. The working copies in
 * html/ were cleaned in place, so the pristine corpus must be re-captured
 * from Cambridge (serves plain HTTP, no challenge). No D1 writes; papers
 * rows already exist. Resumable: skips files already present.
 *
 * Run: bun psychometrika/fetch-raw.ts
 */
import { mkdir, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const RAW_DIR = `${ROOT}/raw`;
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

async function fetchOne(p: { doi_id: string; article_url: string }) {
  const outPath = `${RAW_DIR}/${p.doi_id}.html`;
  if (await Bun.file(outPath).exists()) return "skip";
  const res = await fetch(p.article_url, {
    headers: { "user-agent": "Mozilla/5.0 (repertoire corpus builder)" },
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  const html = await res.text();
  if (!/<meta name="citation_title"/i.test(html) || html.length < 20_000)
    throw new Error(`suspect body (${html.length} B)`);
  await writeFile(outPath, html);
  return "ok";
}

const main = async () => {
  await mkdir(RAW_DIR, { recursive: true });
  const rows = await d1(
    "select doi_id, article_url from papers where journal = 'psychometrika' and state in ('listed','fetched','downloaded') and article_url is not null",
  );
  console.log(`${rows.length} papers to raw-fetch`);

  let done = 0;
  const queue = [...rows];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift()!;
      try {
        await fetchOne(p);
      } catch (e) {
        console.log(`FAIL ${p.doi_id}: ${e}`);
      }
      if (++done % 50 === 0) console.log(`${done}/${rows.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log("done");
};

main();
