/**
 * Verify the cached cf_clearance still passes Cloudflare: load a Wiley
 * article page headed, poll up to 120s (human may click the challenge),
 * print final status + title. Article title => good; "Just a moment" or
 * 403 => profile needs a fresh clearance.
 */
import { chromium } from "playwright";

const ROOT = new URL(".", import.meta.url).pathname;
const PROFILE = `${ROOT}/.cache/cf-profile`;
const TARGET =
  "https://besjournals.onlinelibrary.wiley.com/doi/10.1111/j.1745-3984.2005.00011";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
const resp = await page.goto(TARGET, { waitUntil: "domcontentloaded" }).catch((e) => e);
const firstStatus = resp?.status?.() ?? String(resp);

let title = "";
for (let i = 0; i < 40; i++) {
  title = await page.title().catch(() => "");
  if (title && !/just a moment|attention required|challenge/i.test(title)) break;
  await new Promise((r) => setTimeout(r, 3000));
}
const ua = await page.evaluate(() => navigator.userAgent);
console.log("first-status:", firstStatus);
console.log("title:", title);
console.log("h1:", ((await page.locator("h1").first().textContent().catch(() => "")) || "").trim().slice(0, 100));
console.log("ua:", ua);
await ctx.close();
