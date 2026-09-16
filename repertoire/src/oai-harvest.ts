#!/usr/bin/env bun
/**
 * arXiv stat metadata harvest via OAI-PMH (export.arxiv.org/oai2).
 * Bulk source of truth for the whole stat.* domain: ids, versions,
 * titles, authors, dates, categories (primary + cross-lists) -- so
 * filtering can happen later without any per-paper fetches.
 *
 * Output: .cache/bulk/arxiv/metadata.jsonl
 *         {"arxiv_id","doi","title","authors","created","updated","cats","primary"}
 * Raw pages kept under oai/ for reparsing; resumptionToken state makes
 * the run resumable. Pacing 3.5s+ (arXiv courtesy).
 */
import * as fs from "node:fs";

const OUT = new URL("../../.cache/bulk/arxiv/", import.meta.url).pathname.replace(/\/$/, "");
const OAI = "https://export.arxiv.org/oai2";
const PAGES = `${OUT}/oai`;
const META = `${OUT}/metadata.jsonl`;
const TOKEN = `${OUT}/oai-token.txt`;
const STATUS = `${OUT}/STATUS-oai.json`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(PAGES, { recursive: true });
const page = Number(fs.existsSync(`${PAGES}/count`) ? fs.readFileSync(`${PAGES}/count`, "utf8").trim() : 0);

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

function parseRecords(xml: string): object[] {
  const rows: object[] = [];
  for (const rec of xml.split("<record>").slice(1)) {
    const identifier = rec.match(/<identifier>oai:arXiv\.org:([^<]+)<\/identifier>/)?.[1];
    if (!identifier) continue;
    const cats = [...rec.matchAll(/<setSpec>([^<]+)<\/setSpec>/g)].map((m) => m[1]).filter((c) => c.startsWith("stat"));
    const title = decode(rec.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "");
    const authors = [...rec.matchAll(/<keyName>\s*([\s\S]*?)\s*<\/keyName>/g)].map((m) =>
      decode(m[1].replace(/\s+/g, " ").trim()),
    );
    const created = rec.match(/<created>([^<]+)<\/created>/)?.[1] ?? "";
    const updated = rec.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? "";
    const idNoV = identifier.replace(/v\d+$/, "");
    rows.push({
      arxiv_id: identifier,
      doi: `10.48550/arXiv.${idNoV}`,
      title,
      authors,
      created,
      updated,
      cats,
      primary: cats[0] ?? null,
    });
  }
  return rows;
}

let token = fs.existsSync(TOKEN) ? fs.readFileSync(TOKEN, "utf8").trim() : "";
let n = page;
let records = page > 0 ? 0 : 0; // count from jsonl on resume
if (fs.existsSync(META)) {
  records = fs.readFileSync(META, "utf8").split("\n").filter(Boolean).length;
}

for (;;) {
  const url = token
    ? `${OAI}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}`
    : `${OAI}?verb=ListRecords&set=stat&metadataPrefix=arXiv`;
  let xml = "";
  let ok = false;
  for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "repertoire-metadata-harvest/0.1 (corpus building; mailto:corpus@example.org)" } });
      if (res.status === 503) {
        const retry = Number(res.headers.get("retry-after") ?? 20);
        console.log(`503; sleeping ${retry}s`);
        await sleep(retry * 1000);
        continue;
      }
      xml = await res.text();
      ok = true;
    } catch (e) {
      console.log(`fetch error attempt ${attempt}: ${String(e).slice(0, 80)}`);
      await sleep(10_000 * attempt);
    }
  }
  if (!ok) {
    fs.writeFileSync(STATUS, JSON.stringify({ phase: "error-stopped", page: n, records, at: new Date().toISOString() }));
    process.exit(1);
  }
  fs.writeFileSync(`${PAGES}/page-${n}.xml`, xml);
  const rows = parseRecords(xml);
  if (rows.length) fs.appendFileSync(META, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  records += rows.length;
  token = xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/)?.[1]?.trim() ?? "";
  fs.writeFileSync(TOKEN, token);
  n++;
  fs.writeFileSync(PAGES + "/count", String(n));
  fs.writeFileSync(STATUS, JSON.stringify({ phase: token ? "running" : "done", pages: n, records, lastToken: token.slice(0, 20), at: new Date().toISOString() }));
  console.log(`page ${n}: +${rows.length} records (total ${records})${token ? "" : " -- LIST COMPLETE"}`);
  if (!token) break;
  await sleep(3500 + Math.random() * 500);
}
console.log(`harvest complete: ${records} records, ${n} pages -> metadata.jsonl`);
