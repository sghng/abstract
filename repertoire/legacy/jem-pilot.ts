#!/usr/bin/env bun
/**
 * Pilot: fetch one JEM article HTML through Cloudflare via headless Chromium.
 * Usage: bun jem/jem-pilot.ts <doi> [out.html]
 */
import { chromium } from "playwright";

const doi = process.argv[2] ?? "10.1111/jedm.12351";
const out = process.argv[3] ?? "/tmp/jem-page.html";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
console.log("goto", doi);
await page.goto(`https://onlinelibrary.wiley.com/doi/full/${doi}`, {
  waitUntil: "domcontentloaded",
  timeout: 120_000,
});
// wait out the Cloudflare interstitial
for (let i = 0; i < 30; i++) {
  const title = await page.title();
  if (!/just a moment/i.test(title)) break;
  await page.waitForTimeout(2000);
}
const title = await page.title();
console.log("title:", title);
if (/just a moment/i.test(title)) {
  console.log("CHALLENGE NOT PASSED");
  process.exit(1);
}
// give MathJax/KaTeX a beat to typeset
await page.waitForTimeout(5000);
await Bun.write(out, await page.content());
console.log("saved", out, (await Bun.file(out).size), "bytes");
await browser.close();
