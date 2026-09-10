#!/usr/bin/env bun
/**
 * List JEM (Journal of Educational Measurement, Wiley, ISSN 1745-3984)
 * articles 2020-2025 from Crossref -> .cache/jem-papers.json
 * Fields mirror .cache/papers.json: doi, doi_id, title, year, journal, url.
 */
const ISSN = "1745-3984";
const OUT = new URL("../.cache/jem-papers.json", import.meta.url).pathname;

type Row = {
  doi: string;
  doi_id: string;
  title: string;
  year: number;
  journal: string;
  url: string;
};

const rows: Row[] = [];
let cursor = "*";
while (true) {
  const u =
    `https://api.crossref.org/journals/${ISSN}/works?rows=1000&cursor=${encodeURIComponent(cursor)}` +
    `&filter=from-pub-date:2020-01-01,until-pub-date:2025-12-31,type:journal-article` +
    `&select=DOI,title,published,URL,volume,issue`;
  const res = await fetch(u);
  if (!res.ok) throw new Error(`crossref ${res.status}`);
  const msg = (await res.json()).message;
  for (const it of msg.items) {
    const doi: string = it.DOI.toLowerCase();
    const year =
      it.published?.["date-parts"]?.[0]?.[0] ??
      it["published-print"]?.["date-parts"]?.[0]?.[0];
    if (!year || year < 2020 || year > 2025) continue;
    rows.push({
      doi,
      doi_id: doi.replace("/", ":"),
      title: (it.title?.[0] ?? "").replace(/\s+/g, " ").trim(),
      year,
      journal: "jem",
      url: `https://onlinelibrary.wiley.com/doi/full/${doi}`,
    });
  }
  console.log(`got ${rows.length} / ${msg["total-results"]}`);
  if (msg.items.length < 1000) break;
  cursor = msg["next-cursor"];
}
rows.sort((a, b) => a.doi.localeCompare(b.doi));
await Bun.write(OUT, JSON.stringify(rows, null, 1));
console.log(`wrote ${rows.length} rows -> ${OUT}`);
