#!/usr/bin/env bun
/**
 * Reparse the kept OAI-PMH pages (oai/page-*.xml) into metadata.jsonl
 * with corrected field extraction:
 *   - authors from <author><keyname>/<forenames> pairs (lowercase tags)
 *   - cats + primary from <categories> (dotted, space-separated,
 *     primary FIRST -- the authoritative ordering, incl. cross-lists
 *     from other archives like math.ST / cs.LG)
 *   - setSpecs used only as fallback when <categories> is absent
 * Atomic: writes metadata.new.jsonl, validates count, then replaces.
 */
import * as fs from "node:fs";

const DIR = new URL("../../.cache/bulk/arxiv/", import.meta.url).pathname.replace(/\/$/, "");
const PAGES = `${DIR}/oai`;
const OUT = `${DIR}/metadata.new.jsonl`;
const FINAL = `${DIR}/metadata.jsonl`;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

const rows: string[] = [];
const pages = fs.readdirSync(PAGES).filter((f) => /^page-\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));

for (const p of pages) {
  const xml = fs.readFileSync(`${PAGES}/${p}`, "utf8");
  for (const rec of xml.split("<record>").slice(1)) {
    const id = rec.match(/<identifier>oai:arXiv\.org:([^<]+)<\/identifier>/)?.[1];
    if (!id) continue;
    const authors = [...rec.matchAll(/<author>\s*<keyname>([\s\S]*?)<\/keyname>\s*<forenames>([\s\S]*?)<\/forenames>\s*<\/author>/g)]
      .map((m) => `${decode(m[2].replace(/\s+/g, " ").trim())} ${decode(m[1].replace(/\s+/g, " ").trim())}`.trim());
    const catsRaw = rec.match(/<categories>([^<]+)<\/categories>/)?.[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
    const cats = catsRaw.length
      ? catsRaw
      : [...rec.matchAll(/<setSpec>([^<]+)<\/setSpec>/g)].map((m) => m[1]).filter((c) => c.startsWith("stat")).map((c) => c.replace(/^stat:stat:/, "stat."));
    rows.push(
      JSON.stringify({
        arxiv_id: id.replace(/v\d+$/, ""),
        doi: `10.48550/arXiv.${id.replace(/v\d+$/, "")}`,
        title: decode(rec.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() ?? ""),
        authors,
        created: rec.match(/<created>([^<]+)<\/created>/)?.[1] ?? "",
        updated: rec.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "",
        cats,
        primary: cats[0] ?? null,
      }),
    );
  }
}

fs.writeFileSync(OUT, rows.join("\n") + "\n");

// validate before replacing
const ids = new Set(rows.map((r) => JSON.parse(r).arxiv_id));
const oldCount = fs.existsSync(FINAL) ? fs.readFileSync(FINAL, "utf8").split("\n").filter(Boolean).length : 0;
console.log(`parsed: ${rows.length} rows, ${ids.size} unique (old metadata.jsonl: ${oldCount})`);
if (rows.length !== oldCount || ids.size !== rows.length) {
  console.error("VALIDATION FAILED -- keeping old metadata.jsonl, inspect metadata.new.jsonl");
  process.exit(1);
}
fs.renameSync(OUT, FINAL);
console.log("metadata.jsonl replaced");
