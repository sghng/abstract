#!/usr/bin/env bun
/**
 * JEBS bulk listing: full Crossref cursor scan of BOTH ISSNs (1076-9986,
 * 0362-9791), keep type=journal-article AND 10.3102 prefix only (drop the
 * 10.2307 JSTOR twins), dedupe across ISSNs, drop front matter.
 * Writes papers.jsonl (oldest first).
 */
const OUT = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const ISSNS = ["1076-9986", "0362-9791"];
const FRONT =
  /^(issue information|cover|erratum|corrigendum|correction|obituary|in memoriam|front matter|back matter|list of reviewers|editorial acknowledgement|book reviews?)$/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { doi: string; doi_id: string; title: string; year: number; journal: "jebs"; volume: string };
const byDoi = new Map<string, Row>();
let droppedTwins = 0;
let droppedFront = 0;
let droppedType = 0;
const noTitle: string[] = [];

for (const issn of ISSNS) {
  let cursor = "*";
  let page = 0;
  while (cursor) {
    const url =
      `https://api.crossref.org/journals/${issn}/works?filter=from-pub-date:1976-01-01,type:journal-article` +
      `&select=DOI,title,issued,volume,type&rows=1000&cursor=${encodeURIComponent(cursor)}`;
    const res = await fetch(url, { headers: { "User-Agent": "abstract-repertoire-bulk/1.0 (bun)" } });
    if (!res.ok) {
      console.log(`[${issn}] page ${page}: HTTP ${res.status}; retry in 15s`);
      await sleep(15_000);
      continue;
    }
    const msg = (await res.json()).message as {
      "next-cursor"?: string;
      "total-results": number;
      items: { DOI: string; title?: string[]; issued: { "date-parts": number[][] }; volume?: string; type: string }[];
    };
    const items = msg.items ?? [];
    for (const it of items) {
      const doi = it.DOI;
      if (!doi.startsWith("10.3102/")) {
        droppedTwins++;
        continue;
      }
      const key = doi.toLowerCase();
      if (byDoi.has(key)) continue; // same DOI via both ISSNs
      const title = (it.title?.[0] ?? "").trim();
      if (!title) {
        noTitle.push(doi);
        continue;
      }
      if (FRONT.test(title) || FRONT.test(title.replace(/[.:;\s]+$/, ""))) {
        droppedFront++;
        continue;
      }
      const year = it.issued?.["date-parts"]?.[0]?.[0] ?? 0;
      byDoi.set(key, {
        doi,
        doi_id: key.replace(/\//g, ":"),
        title: title.replace(/\s+/g, " "),
        year,
        journal: "jebs",
        volume: it.volume ?? "",
      });
    }
    console.log(`[${issn}] page ${page}: ${items.length} items (total ${msg["total-results"]}); kept so far ${byDoi.size}`);
    cursor = msg["next-cursor"] ?? "";
    page++;
    if (!items.length) break;
    await sleep(1200);
  }
}

const rows = [...byDoi.values()].sort((a, b) => a.year - b.year || a.doi.localeCompare(b.doi));
const lines = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
require("node:fs").writeFileSync(`${OUT}/papers.jsonl`, lines);
const years = new Map<number, number>();
for (const r of rows) years.set(r.year, (years.get(r.year) ?? 0) + 1);
console.log(
  JSON.stringify(
    {
      kept: rows.length,
      droppedTwins,
      droppedFront,
      noTitle: noTitle.length,
      first: rows[0]?.year,
      last: rows[rows.length - 1]?.year,
      perYear: [...years.entries()].sort((a, b) => a[0] - b[0]),
    },
    null,
    1,
  ),
);
