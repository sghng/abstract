/**
 * Wiley: browser to the landing page (the warm profile passes the
 * Cloudflare check once the UA is de-headlessed), then an in-page
 * fetch of the pdfdirect endpoint returns the bytes with cookies and
 * UA intact. Entitlement is the campus IP; the page banner says so.
 */
import { FetchError } from "../errors.ts";
import { isPdf } from "../extract.ts";
import { withPage, isChallenge, waitOutChallenge, forceClearance } from "../browser.ts";

const B64_FETCH = `
async (u) => {
  const r = await fetch(u, { credentials: "include" });
  if (!r.ok) return "HTTP " + r.status;
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.subarray(0, 4).join(",") !== "37,80,68,70") return "notPDF";
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}`;

async function inpageFetch(page: import("playwright").Page, url: string): Promise<string> {
  return page.evaluate<string, string>(
    new Function("return (" + B64_FETCH + ")")() as (u: string) => Promise<string>,
    url,
  );
}

export async function fetchWiley(doi: string): Promise<Buffer> {
  return withPage(async (page) => {
    const resp = await page.goto(`https://onlinelibrary.wiley.com/doi/${doi}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(4000);
    let challenged = false;
    if (await isChallenge(page)) {
      challenged = true;
      if (!(await waitOutChallenge(page, 20_000))) {
        throw new FetchError("challenge_needs_human", "Wiley Cloudflare challenge did not clear");
      }
    }
    if (resp?.status() === 404) {
      throw new FetchError("publisher_missing", `Wiley 404 for ${doi} (JEM-style platform condition)`);
    }
    const body = await page.locator("body").innerText().catch(() => "");
    const badge = /Full Access|Free Access|Open Access/i.test(body)
      ? "entitled"
      : /Check Access|Get Access|Purchase/i.test(body.slice(0, 3000))
        ? "paywall"
        : "unknown";
    const url = `https://onlinelibrary.wiley.com/doi/pdfdirect/${doi}`;
    const landing = `https://onlinelibrary.wiley.com/doi/${doi}`;
    let b64 = await inpageFetch(page, url);
    if (/^HTTP 403/.test(String(b64))) {
      // no clearance cookie: force the challenge, clear it, retry once
      const forced = await forceClearance(page, landing).catch(() => false);
      b64 = await inpageFetch(page, url);
      if (/^HTTP 403/.test(String(b64)) && !forced) {
        const again = await forceClearance(page, landing).catch(() => false);
        if (again) b64 = await inpageFetch(page, url);
      }
    }
    let out: { buf?: Buffer; why: string };
    if (typeof b64 === "string" && !/^(HTTP |notPDF)/.test(b64)) {
      out = { buf: Buffer.from(b64, "base64"), why: "inpage" };
    } else {
      // 2. context-level request: context UA plus cookies
      const r = await page.request.get(url);
      const buf = Buffer.from(await r.body().catch(() => Buffer.alloc(0)));
      if (r.ok() && isPdf(buf)) {
        out = { buf, why: "context-request" };
      } else {
        // 3. true navigation: full chromium downloads the pdf
        const dl = page.waitForEvent("download", { timeout: 30_000 }).catch(() => null);
        await page.goto(url, { waitUntil: "commit", timeout: 45_000 }).catch(() => {});
        const d = await dl;
        const p = d ? await d.path().catch(() => null) : null;
        if (p) {
          out = { buf: Buffer.from(await Bun.file(p).arrayBuffer()), why: "download" };
        } else {
          const detail = `landing ${resp?.status()}, challenged=${challenged}, badge=${badge}, inpage=${b64}, request=${r.status()}`;
          if (badge === "paywall") {
            throw new FetchError("not_entitled", `Wiley shows a paywall (${detail})`);
          }
          throw new FetchError("fetch_failed", detail);
        }
      }
    }
    if (!isPdf(out.buf!)) {
      throw new FetchError("fetch_failed", `pdfdirect ${out.why} returned non-pdf bytes`);
    }
    return out.buf!;
  });
}
