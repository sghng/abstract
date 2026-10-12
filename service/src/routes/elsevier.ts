/**
 * Elsevier: resolve the DOI to a PII through the doi.org redirect chain
 * without ever hitting ScienceDirect from a non-browser client, then a
 * browser session does the work. A warm profile deep-links straight to
 * the article; a cold one runs the funnel (home, then article) that
 * avoids the robot captcha. The pdfft link is navigated, landing on a
 * signed CDN URL that is then fetched in-page.
 */
import { FetchError } from "../errors.ts";
import { withPage } from "../browser.ts";

const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";

const B64_FETCH = `
async () => {
  const r = await fetch(location.href, { credentials: "include" });
  if (!r.ok) return "HTTP " + r.status;
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.subarray(0, 4).join(",") !== "37,80,68,70") return "notPDF";
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}`;

async function resolvePii(doi: string): Promise<string> {
  let url = `https://doi.org/${doi}`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { redirect: "manual", headers: { "user-agent": UA } });
    const loc = r.headers.get("location");
    if (!loc) break;
    const m = loc.match(/pii\/([A-Za-z0-9]+)/);
    url = new URL(loc, url).href;
    if (m) return m[1];
  }
  const m = url.match(/pii\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  throw new FetchError("resolve_failed", `no PII in redirect chain for ${doi}`);
}

async function blockedSd(page: import("playwright").Page): Promise<boolean> {
  const title = (await page.title().catch(() => "")).trim();
  if (title === "ScienceDirect" || /^Just a moment/i.test(title)) return true;
  const body = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return /are you a robot|ip blocked|unusual traffic|security check/i.test(body);
}

export async function fetchElsevier(doi: string): Promise<Buffer> {
  const pii = await resolvePii(doi);
  return withPage(async (page) => {
    const article = `https://www.sciencedirect.com/science/article/pii/${pii}`;
    let resp = await page.goto(article, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(5000);
    if (await blockedSd(page)) {
      // cold profile: dwell on the home page, then retry; a second,
      // deeper funnel if the first did not take
      await page.goto("https://www.sciencedirect.com", { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(6000);
      resp = await page.goto(article, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(6000);
      if (await blockedSd(page)) {
        await page.goto("https://www.sciencedirect.com/browse/journals-and-books", {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        await page.waitForTimeout(4000);
        resp = await page.goto(article, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(6000);
        if (await blockedSd(page)) {
          throw new FetchError("challenge_needs_human", "ScienceDirect block page did not clear");
        }
      }
    }
    if (resp?.status() === 404) {
      throw new FetchError("publisher_missing", `ScienceDirect 404 for ${doi}`);
    }
    const href = await page
      .$eval('a[href*="pdfft"]', (a) => a.href)
      .catch(() => null as string | null);
    if (!href) {
      const diag = await page
        .$$eval("a, button", (els) =>
          els
            .filter((x) => /pdf|download|view/i.test((x as HTMLElement).href ?? "") + (x.textContent ?? ""))
            .map((x) => `${(x as HTMLElement).tagName}:${((x as HTMLElement).href ?? "").slice(0, 110)}:${(x.textContent ?? "").trim().slice(0, 30)}`)
            .slice(0, 6),
        )
        .catch(() => [] as string[]);
      throw new FetchError(
        "fetch_failed",
        `no pdfft link; url=${page.url().slice(0, 100)} title=${(await page.title()).slice(0, 60)} links=${diag.join(" | ")}`,
      );
    }
    await page.goto(href, { waitUntil: "commit", timeout: 60_000 }).catch(() => {});
    for (let i = 0; i < 10 && !/pdf\.sciencedirectassets\.com/.test(page.url()); i++) {
      await page.waitForTimeout(2000);
    }
    if (!/pdf\.sciencedirectassets\.com/.test(page.url())) {
      throw new FetchError("fetch_failed", "navigation never reached the signed PDF URL");
    }
    const b64 = await page.evaluate<string, never>(
      new Function("return (" + B64_FETCH + ")")() as () => Promise<string>,
    );
    if (typeof b64 !== "string" || /^(HTTP |notPDF)/.test(b64)) {
      throw new FetchError("fetch_failed", `signed URL fetch returned ${b64}`);
    }
    return Buffer.from(b64, "base64");
  });
}
