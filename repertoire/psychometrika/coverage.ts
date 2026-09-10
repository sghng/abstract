#!/usr/bin/env bun
/**
 * repertoire psy-coverage: for every listed paper, fetch its Cambridge article
 * page and record whether full-text HTML is served, plus asset counts.
 * Writes .cache/coverage.json. Resumable: skips DOIs already covered.
 */
import { writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const CACHE = `${ROOT}.cache`;
const papers: { doi: string; article_url: string; year: number }[] = JSON.parse(
  await Bun.file(`${CACHE}/papers.json`).text(),
);

const SLEEP_MS = 800;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Coverage {
  doi: string;
  year: number;
  http: number;
  fulltext: boolean;
  tex_math: number;
  figures: number;
  tables: number;
  words: number;
}

let results: Coverage[] = [];
const outPath = `${CACHE}/coverage.json`;
if (await Bun.file(outPath).exists()) {
  results = JSON.parse(await Bun.file(outPath).text());
}
const done = new Set(results.map((r) => r.doi));
const todo = papers.filter((p) => !done.has(p.doi));
console.log(`coverage: ${done.size} cached, ${todo.length} to fetch`);

for (const [i, p] of todo.entries()) {
  try {
    const res = await fetch(p.article_url, {
      headers: { "user-agent": "Mozilla/5.0 (repertoire corpus builder)" },
    });
    const html = await res.text();
    const texMath = (html.match(/class="tex-math/g) || []).length;
    const figures = (html.match(/class="fig-ada"/g) || []).length;
    const tables = (html.match(/table-wrap-ada/g) || []).length;
    // crude body word count: strip tags from everything between first
    // <section and the references marker
    const body = html.slice(html.indexOf("<section"), html.indexOf('id="references"'));
    const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).length;
    results.push({
      doi: p.doi,
      year: p.year,
      http: res.status,
      fulltext: words > 1500, // abstract-only pages are well under this
      tex_math: texMath,
      figures,
      tables,
      words,
    });
  } catch (e: any) {
    results.push({ doi: p.doi, year: p.year, http: 0, fulltext: false, tex_math: 0, figures: 0, tables: 0, words: 0 });
  }
  if ((i + 1) % 20 === 0) {
    await writeFile(outPath, JSON.stringify(results, null, 1));
    console.log(`[${i + 1}/${todo.length}] saved checkpoint`);
  }
  await sleep(SLEEP_MS);
}
await writeFile(outPath, JSON.stringify(results, null, 1));

const ft = results.filter((r) => r.fulltext);
console.log(`TOTAL: ${ft.length}/${results.length} fulltext`);
for (const y of [2020, 2021, 2022, 2023, 2024, 2025]) {
  const all = results.filter((r) => r.year === y);
  const yes = all.filter((r) => r.fulltext);
  console.log(`${y}: ${yes.length}/${all.length}`);
}
