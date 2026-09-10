/**
 * Open the headed Chromium at a Wiley page so a human can clear the
 * Cloudflare/Turnstile challenge once. Polls for the cf_clearance cookie,
 * prints it when present, then keeps the profile on disk for all later
 * session-riding fetches. Exit: Ctrl-C or cookie found + 5s grace.
 *
 * Run: bun psychometrika/../auth-chromium.ts   (any cwd; paths absolute)
 */
import { chromium } from "playwright";

const ROOT = new URL(".", import.meta.url).pathname;
const PROFILE = `${ROOT}/.cache/cf-profile`;
const TARGET = "https://besjournals.onlinelibrary.wiley.com/journal/17453984";

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(TARGET, { waitUntil: "domcontentloaded" }).catch(() => {});

console.log("Browser open. Clear the challenge in the window if shown.");

for (;;) {
  const cookies = await ctx.cookies();
  const clear = cookies.find((c) => c.name === "cf_clearance");
  if (clear) {
    console.log(`cf_clearance present (expires ${new Date(clear.expires! * 1000).toISOString()})`);
    console.log(`cookie count: ${cookies.length}`);
    break;
  }
  await new Promise((r) => setTimeout(r, 2000));
}

await new Promise((r) => setTimeout(r, 5000));
await ctx.close();
