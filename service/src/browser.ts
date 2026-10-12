/**
 * The one persistent chromium context. The profile directory survives
 * restarts, so publisher session cookies amortize bot challenges to
 * near zero. The UA is probed once (navigator.userAgent with the
 * Headless token stripped) and persisted; claiming plain Chrome is
 * what passes Wiley's Cloudflare.
 */
import { chromium } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PROFILE } from "./store.ts";

const UA_FILE = `${PROFILE}/ua.txt`;

let ctxPromise: Promise<import("playwright").BrowserContext> | null = null;

const LAUNCH = {
  headless: true,
  // full chromium in new-headless mode, not the headless shell: the
  // shell's fingerprint is what Cloudflare flags
  channel: "chromium",
  locale: "en-US",
  viewport: { width: 1366, height: 900 },
  args: ["--disable-blink-features=AutomationControlled"],
};

async function probeUa(ctx: import("playwright").BrowserContext): Promise<string> {
  const page = await ctx.newPage();
  const ua = await page.evaluate(() => navigator.userAgent);
  await page.close();
  return ua.replace("HeadlessChrome", "Chrome");
}

export async function getContext(): Promise<import("playwright").BrowserContext> {
  if (!ctxPromise) {
    ctxPromise = (async () => {
      let ua = existsSync(UA_FILE) ? readFileSync(UA_FILE, "utf8").trim() : undefined;
      let ctx = await chromium.launchPersistentContext(PROFILE, { ...LAUNCH, userAgent: ua });
      if (!ua) {
        ua = await probeUa(ctx);
        await ctx.close();
        writeFileSync(UA_FILE, ua);
        ctx = await chromium.launchPersistentContext(PROFILE, { ...LAUNCH, userAgent: ua });
      }
      return ctx;
    })().catch((e) => {
      ctxPromise = null;
      throw e;
    });
  }
  return ctxPromise;
}

export async function withPage<T>(fn: (page: import("playwright").Page) => Promise<T>): Promise<T> {
  try {
    return await attemptWithPage(fn);
  } catch (e) {
    // a cached context can outlive its browser; rebuild once from the
    // persistent profile and try again
    if (!/has been closed|Target closed|browser has been/i.test(String(e))) throw e;
    await resetBrowser();
    return attemptWithPage(fn);
  }
}

async function attemptWithPage<T>(fn: (page: import("playwright").Page) => Promise<T>): Promise<T> {
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

export async function resetBrowser(): Promise<void> {
  const p = ctxPromise;
  ctxPromise = null;
  if (p) await (await p).close().catch(() => {});
}

/**
 * Force a Cloudflare interstitial by briefly claiming the headless UA,
 * then clear it by restoring the clean UA and reloading. A passed
 * challenge plants the clearance cookie that authorizes pdfdirect and
 * other protected subresources for the whole profile. No-op when no
 * challenge appears.
 */
export async function forceClearance(
  page: import("playwright").Page,
  url: string,
): Promise<boolean> {
  const good = existsSync(UA_FILE) ? readFileSync(UA_FILE, "utf8").trim() : undefined;
  if (!good) return false;
  const headless = good.replace("Chrome/", "HeadlessChrome/");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.setUserAgentOverride", { userAgent: headless });
  await page.goto(url, { waitUntil: "commit", timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await cdp.send("Network.setUserAgentOverride", { userAgent: good });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  const cleared = await waitOutChallenge(page, 25_000);
  const cookies = await page.context().cookies(url);
  const has = cookies.some((c) => /clearance|__cf_bm|ak_bmsc|bm_sv/i.test(c.name));
  return cleared && has;
}

export async function isChallenge(page: import("playwright").Page): Promise<boolean> {
  const title = await page.title().catch(() => "");
  if (/just a moment|attention required/i.test(title)) return true;
  const body = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /are you a robot|security verification|confirm you are a human/i.test(body);
}

export async function waitOutChallenge(page: import("playwright").Page, ms = 20000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    if (!(await isChallenge(page))) return true;
  }
  return false;
}
