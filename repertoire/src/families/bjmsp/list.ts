#!/usr/bin/env bun
/**
 * Bulk BJMSP listing: Crossref journal 2044-8317 (electronic) union
 * 0007-1102 (print backfile), Wiley partner zone
 * bpspsychub.onlinelibrary.wiley.com, content 1965+, cursor-paginated,
 * type=journal-article, front matter filtered.
 * Writes papers.jsonl rows
 * {"doi","doi_id","title","year","journal":"bjmsp","issue_url","article_url","pdf_url"}.
 *
 * Usage: bun repertoire/.cache/bulk/bjmsp/list.ts
 */
import * as fs from "node:fs";

const BULK = new URL(".", import.meta.url).pathname;
const BASE = "https://bpspsychub.onlinelibrary.wiley.com";
// BJMSP registers under both the electronic ISSN (recent records) and the
// print ISSN 0007-1102 (backfile); the union, deduped by DOI, is the span.
const ISSNS = ["2044-8317", "0007-1102"];

const FRONT_MATTER =
  /^(issue information|cover|erratum|corrigendum|correction|obituary|in memoriam|front matter|back matter|list of reviewers|editorial acknowledgement|book reviews?)$/i;

interface Row {
  doi: string;
  doi_id: string;
  title: string;
  year: number;
  journal: string;
  issue_url: string;
  article_url: string;
  pdf_url: string;
}

const rows: Row[] = [];
const seen = new Set<string>();
let odd = 0;
for (const ISSN of ISSNS) {
  console.log(`-- ISSN ${ISSN}`);
  let cursor = "*";
  while (cursor) {
    const u =
      `https://api.crossref.org/journals/${ISSN}/works?rows=1000&cursor=${encodeURIComponent(cursor)}` +
      `&filter=from-pub-date:1965-01-01` +
      `&select=DOI,title,issued,volume,issue,type`;
    const res = await fetch(u, {
      headers: { "user-agent": "abstract-repertoire-bulk/1.0" },
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 10) * 1000;
      console.log(`  crossref 429; backing off ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue; // same cursor again
    }
    if (!res.ok) throw new Error(`crossref ${res.status}`);
    const msg = (await res.json()).message;
    const items: any[] = msg.items ?? [];
    for (const it of items) {
      if (it.type !== "journal-article") continue;
      const doi: string = it.DOI;
      if (!doi) continue;
      const title = ((Array.isArray(it.title) ? it.title[0] : it.title) ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (FRONT_MATTER.test(title)) continue;
      const id = doi.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      // BJMSP spans 10.1111 (j.2044-8317.* backfile, bmsp.* current) and
      // 10.1348 (BPS prefix, ~1997-2004); count anything else as odd.
      if (!/^(10\.1111|10\.1348)\//.test(id)) {
        odd++;
        console.log(`  [odd-prefix] ${doi} "${title.slice(0, 60)}"`);
      }
      const year = it.issued?.["date-parts"]?.[0]?.[0] ?? 0;
      // Wiley issue toc pattern, verified from spike HTML: /toc/<issn-digits>/<year>/<vol>/<issue>
      const issueUrl =
        it.volume && it.issue ? `${BASE}/toc/20448317/${year}/${it.volume}/${it.issue}` : "";
      rows.push({
        doi,
        doi_id: id.replace(/\//g, ":"),
        title,
        year,
        journal: "bjmsp",
        issue_url: issueUrl,
        article_url: `${BASE}/doi/${doi}`,
        pdf_url: `${BASE}/doi/pdfdirect/${doi}`,
      });
    }
    console.log(
      `page: ${items.length} items -> ${rows.length} kept (total-results ${msg["total-results"]})`,
    );
    cursor = msg["next-cursor"] ?? "";
    if (cursor) await new Promise((r) => setTimeout(r, 1200));
  }
}

rows.sort((a, b) => a.year - b.year || a.doi.localeCompare(b.doi));
fs.writeFileSync(`${BULK}papers.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

const byDecade = new Map<string, number>();
for (const r of rows) {
  const k = `${Math.floor(r.year / 10) * 10}s`;
  byDecade.set(k, (byDecade.get(k) ?? 0) + 1);
}
console.log(`wrote ${rows.length} rows -> ${BULK}papers.jsonl`);
console.log(`non-10.1111/10.1348 DOIs: ${odd}`);
console.log([...byDecade.entries()].map(([k, v]) => `${k}:${v}`).join("  "));
