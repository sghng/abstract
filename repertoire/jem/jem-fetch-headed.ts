#!/usr/bin/env bun
/**
 * Backfile fetcher with HUMAN-IN-THE-LOOP Cloudflare solving.
 * Headed persistent browser (profile cached in .cache/cf-profile); when the
 * Turnstile interstitial appears the script pauses and waits for a human to
 * click "Verify you are human" in the open window, then continues.
 *
 * Usage: bun jem/jem-fetch-headed.ts [--xml] [--limit N]
 *   --xml    try /doi/full-xml/ first, fall back to /doi/full/
 *   targets: JEM 2005-2019 from .cache/jem-papers-legacy.json
 * Output: jem/xml/{doi_id}.xml or jem/html/{doi_id}.html (checkpointed,
 * resumable)
 */
import { chromium } from "playwright";
import * as fs from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = "https://onlinelibrary.wiley.com";
const PROFILE = `${ROOT}/.cache/cf-profile`;
const XML_FIRST = process.argv.includes("--xml");
const LIMIT = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : Infinity;
const SOURCE = process.argv.includes("--source")
  ? process.argv[process.argv.indexOf("--source") + 1]
  : "legacy";

function doiId(doi: string): string {
  return doi.toLowerCase().replace(/\//g, ":");
}
function have(kind: string, id: string): boolean {
  const p = `${ROOT}/jem/${kind}/${id}.${kind === "xml" ? "xml" : "html"}`;
  return fs.existsSync(p) && fs.statSync(p).size > 20_000;
}

let dois: string[];
if (SOURCE === "recent") {
  // 2020-2025 papers (already have HTML; fetching XML as the cleaner source)
  const papers = JSON.parse(fs.readFileSync(`${ROOT}/.cache/jem-papers.json`, "utf8"));
  dois = papers.map((p: { doi: string }) => p.doi);
} else {
  const byYear: Record<string, string[]> = JSON.parse(
    fs.readFileSync(`${ROOT}/.cache/jem-papers-legacy.json`, "utf8"),
  );
  const all: string[] = [];
  for (const [y, list] of Object.entries(byYear)) {
    if (Number(y) >= 2005 && Number(y) <= 2019) all.push(...list);
  }
  if (SOURCE === "misses") {
    // legacy targets with neither xml nor html, plus recent targets with no xml
    const legacyMiss = all.filter((d) => !have("xml", doiId(d)) && !have("html", doiId(d)));
    const papers = JSON.parse(fs.readFileSync(`${ROOT}/.cache/jem-papers.json`, "utf8"));
    const recentMiss = papers
      .map((p: { doi: string }) => p.doi)
      .filter((d: string) => !have("xml", doiId(d)));
    dois = [...legacyMiss, ...recentMiss];
    console.log(`misses mode: ${legacyMiss.length} legacy + ${recentMiss.length} recent`);
  } else {
    dois = all;
  }
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  args: ["--window-position=50,50"],
});
const page = await ctx.newPage();

async function ensureClearance(url: string): Promise<boolean> {
  for (;;) {
    const title = await page.title().catch(() => "");
    if (!title.includes("Just a moment")) return true;
    console.log("[human] Turnstile interstitial -- click 'Verify you are human' in the browser window");
    for (let i = 0; i < 100; i++) {
      await page.waitForTimeout(3000);
      const t = await page.title().catch(() => "");
      if (!t.includes("Just a moment")) return true;
      if (t === "" ) break; // navigated or crashed
    }
    // still stuck after 5 min: reload and ask again
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => {});
  }
}

let done = 0, skipped = 0, failed = 0;
const failures: string[] = [];
for (const doi of dois) {
  if (done >= LIMIT) break;
  const id = doiId(doi);
  // recent: HTML already exists, only XML counts; legacy/misses: either counts
  const skip = SOURCE === "recent" || SOURCE === "misses"
    ? have("xml", id) // misses mode: everything already missing html-or-xml; xml is the goal
    : have("xml", id) || have("html", id);
  if (skip) { skipped++; continue; }

  const routes = XML_FIRST
    ? SOURCE === "recent"
      ? [`${BASE}/doi/full-xml/${doi}`] // xml only, html already captured
      : [`${BASE}/doi/full-xml/${doi}`, `${BASE}/doi/full/${doi}`]
    : [`${BASE}/doi/full/${doi}`];
  let saved = false;
  for (const url of routes) {
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      if (!resp) continue;
      if (!(await ensureClearance(url))) continue;
      const body = await resp.text();
      const isXml = url.includes("full-xml");
      const status = resp.status();
      // guards: XML must be a JATS article; HTML must carry the article body
      const good = isXml
        ? body.includes("<article") && body.length > 20_000
        : body.includes("article-section") && body.length > 100_000;
      const notFound = status === 404 || /page not found/i.test(await page.title().catch(() => ""));
      if (SOURCE === "misses") {
        console.log(`  ${doi} <- ${isXml ? "xml" : "html"} status=${status} bytes=${body.length} good=${good}${notFound ? " 404" : ""}`);
      }
      if (good && !notFound) {
        const kind = isXml ? "xml" : "html";
        fs.mkdirSync(`${ROOT}/jem/${kind}`, { recursive: true });
        fs.writeFileSync(`${ROOT}/jem/${kind}/${id}.${isXml ? "xml" : "html"}`, body);
        saved = true;
        done++;
        if (done % 10 === 0) console.log(`[${done}] saved (${skipped} skipped, ${failed} failed)`);
        break;
      }
      // 404 on xml route: fall through to html route
    } catch (e) {
      console.log(`err ${doi}: ${String(e).slice(0, 80)}`);
    }
    await page.waitForTimeout(1500 + Math.random() * 2000);
  }
  if (!saved) { failed++; failures.push(doi); }
  await page.waitForTimeout(1500 + Math.random() * 2000);
}
fs.writeFileSync(`${ROOT}/.cache/jem-backfile-failures.json`, JSON.stringify(failures, null, 1));
console.log(`done: ${done} saved, ${skipped} pre-existing, ${failed} failed`);
await ctx.close();
