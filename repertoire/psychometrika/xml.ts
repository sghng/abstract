#!/usr/bin/env bun
/**
 * Download JATS XML for open-access Psychometrika articles from the Springer
 * Nature OpenAccess API. Requires SPRINGER_API_KEY in env. Step 1 paginates
 * openaccess/json?q=issn:0033-3123 into .cache/oa-dois.json; step 2 fetches
 * openaccess/jats?q=doi:... into xml/{doi_id}.xml. Resumable; D1 untouched
 * (these papers keep their HTML-pipeline state; xml/ is an auxiliary store).
 */
import * as fs from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const KEY = process.env.SPRINGER_API_KEY;
if (!KEY) throw new Error("SPRINGER_API_KEY not set");
const OUT = `${ROOT}/xml`;
const CACHE = `${ROOT}/.cache/oa-dois.json`;
fs.mkdirSync(OUT, { recursive: true });

const doiId = (doi: string) => doi.replace("/", ":");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(path: string): Promise<string> {
  const url = `https://api.springernature.com/openaccess/${path}${path.includes("?") ? "&" : "?"}api_key=${KEY}`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.text();
    if (res.status === 404) return ""; // not OA / no record
    console.log(`  HTTP ${res.status}, retry ${attempt}`);
    await sleep(3000 * attempt);
  }
  throw new Error("api failed");
}

// step 1: list all OA records for the journal
let dois: string[];
if (fs.existsSync(CACHE)) {
  dois = JSON.parse(fs.readFileSync(CACHE, "utf8"));
} else {
  dois = [];
  const first = JSON.parse(await api("json?q=issn:0033-3123&p=25"));
  const total = Number(first.result[0].total);
  console.log(`total OA records: ${total}`);
  const collect = (d: any) =>
    d.records?.forEach((r: any) => dois.push(r.doi));
  collect(first);
  for (let s = 26; s <= total; s += 25) {
    collect(JSON.parse(await api(`json?q=issn:0033-3123&p=25&s=${s}`)));
    await sleep(500);
  }
  fs.writeFileSync(CACHE, JSON.stringify(dois));
}
console.log(`${dois.length} OA dois`);

// step 2: download JATS per doi
let n = 0;
for (const doi of dois) {
  const f = `${OUT}/${doiId(doi)}.xml`;
  if (fs.existsSync(f)) continue;
  const xml = await api(`jats?q=doi:${doi}`);
  if (xml) {
    fs.writeFileSync(f, xml);
    n++;
  } else {
    console.log(`  ${doi}: no jats (listed OA but not served)`);
  }
  if (n % 20 === 0 && n > 0) console.log(`${n} downloaded`);
  await sleep(400);
}
console.log(`done: ${n} new xml files`);
