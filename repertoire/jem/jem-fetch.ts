#!/usr/bin/env bun
/**
 * Fetch JEM article HTML through Cloudflare with headless Chromium.
 * One browser session solves the challenge; each article's RAW document
 * body (response.text(), not the MathJax-mutated DOM) is saved to
 * html/{doi_id}.html. Resumable: existing files are skipped.
 */
import * as fs from "node:fs";
import { chromium, type BrowserContext } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = `${ROOT}/jem/html`;
const FRONT_MATTER =
  /^(issue information|cover|erratum|corrigendum|correction|obituary|in memoriam|book review|front matter|back matter|list of reviewers|editorial)/i;
const LIST = (
  JSON.parse(fs.readFileSync(`${ROOT}/.cache/jem-papers.json`, "utf8")) as {
    doi: string;
    doi_id: string;
    url: string;
    title: string;
  }[]
).filter((p) => !FRONT_MATTER.test(p.title));
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const browser = await chromium.launch({ headless: true });

async function freshContext(): Promise<BrowserContext> {
  return browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
}

async function fetchOne(ctx: BrowserContext, url: string): Promise<string> {
  const page = await ctx.newPage();
  try {
    let resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    for (let i = 0; i < 30 && /just a moment/i.test(await page.title()); i++)
      await page.waitForTimeout(2000);
    if (/just a moment/i.test(await page.title())) throw new Error("challenge not passed");
    // re-navigate so the captured body is the article, not the challenge page
    resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const body = await resp!.text();
    if (body.length < 100_000) throw new Error(`suspicious size ${body.length}`);
    if (!body.includes("article-section")) throw new Error("no article body marker");
    return body;
  } finally {
    await page.close();
  }
}

let ctx = await freshContext();
let done = 0;
for (const p of LIST) {
  const file = `${OUT}/${p.doi_id}.html`;
  if (fs.existsSync(file) && fs.statSync(file).size > 100_000) continue;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const body = await fetchOne(ctx, p.url);
      fs.writeFileSync(file, body);
      done++;
      console.log(`ok ${p.doi_id} (${body.length}B) [${done}]`);
      break;
    } catch (e) {
      console.log(`retry ${p.doi_id} attempt ${attempt}: ${String(e).slice(0, 120)}`);
      if (attempt === 4) {
        console.log(`FAIL ${p.doi_id}`);
      } else {
        // the clearance cookie may be stale; rotate the context
        try { await ctx.close(); } catch {}
        ctx = await freshContext();
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
  await new Promise((r) => setTimeout(r, 1200));
}
await browser.close();
console.log(`done, fetched ${done}`);
