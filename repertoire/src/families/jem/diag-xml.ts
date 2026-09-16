#!/usr/bin/env bun
/**
 * Diagnose the xml=absent verdicts: for sample DOIs, probe
 * /doi/full-xml/<doi> via (a) the context request API and (b) in-page
 * fetch, printing status/content-type/bytes/head so the working
 * mechanism per era is visible.
 *
 * Usage: bun repertoire/.cache/bulk/jem/diag-xml.ts
 */
import { chromium } from "playwright";
import * as fs from "node:fs";

const REPO = new URL("../../../..", import.meta.url).pathname.replace(/\/$/, "");
const REPD = `${REPO}/repertoire`;
const PROFILE = `${REPD}/.cache/cf-profile`;
const BASE = "https://onlinelibrary.wiley.com";

const SAMPLE: { doi: string; note: string }[] = [
  { doi: "10.1111/jedm.12264", note: "2025 spike-verified XML, run=absent" },
  { doi: "10.1111/jedm.70016", note: "2025 run=absent" },
  { doi: "10.1111/jedm.70019", note: "2025 run=ok" },
  { doi: "10.1111/jedm.12256", note: "2019 run=absent" },
  { doi: "10.1111/jedm.12046", note: "2014 run=absent" },
  { doi: "10.1111/jedm.12047", note: "2014 run=ok" },
  { doi: "10.1111/j.1745-3984.2009.00093.x", note: "2009 run=absent" },
  { doi: "10.1111/j.1745-3984.2005.00006", note: "2005 spike-verified 182KB" },
  { doi: "10.1111/j.1745-3984.1996.tb00475.x", note: "1996 expected absent" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: "chrome",
  headless: false,
  args: ["--window-position=100,60", "--disable-blink-features=AutomationControlled"],
  viewport: { width: 1366, height: 900 },
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
page.setDefaultTimeout(90_000);

await page
  .goto(`${BASE}/doi/full/10.1111/jedm.12264`, { waitUntil: "domcontentloaded", timeout: 90_000 })
  .catch(() => {});
const t = await page.title().catch(() => "");
if (/just a moment|attention required/i.test(t)) {
  console.log("[human] ACTION NEEDED: solve the challenge in the Wiley window");
  const dl = Date.now() + 5 * 60_000;
  while (Date.now() < dl) {
    await sleep(2500);
    if (!/just a moment|attention required/i.test(await page.title().catch(() => ""))) break;
  }
  await page
    .goto(`${BASE}/doi/full/10.1111/jedm.12264`, { waitUntil: "domcontentloaded", timeout: 90_000 })
    .catch(() => {});
}
console.log("[warmup] page ready");

const out: string[] = [];
for (const s of SAMPLE) {
  const url = `${BASE}/doi/full-xml/${s.doi}`;
  // (a) request API
  let a = "req-api: ";
  try {
    const r = await ctx.request.get(url, {
      headers: { accept: "application/xml,text/xml,*/*" },
      failOnStatusCode: false,
      timeout: 60_000,
    });
    const body = Buffer.from(await r.body());
    a += `status=${r.status()} ct=${(r.headers()["content-type"] ?? "").slice(0, 30)} bytes=${body.length} head=${body.subarray(0, 80).toString("latin1").replace(/\s+/g, " ")}`;
  } catch (e) {
    a += `ERR ${String(e).slice(0, 60)}`;
  }
  await sleep(4000);
  // (b) in-page fetch
  let b = "in-page : ";
  try {
    const res: any = await page.evaluate(async (u: string) => {
      const r = await fetch(u, { credentials: "include" });
      const status = r.status;
      if (!r.ok) return { status, head: (await r.text().catch(() => "")).slice(0, 100) };
      const buf = await r.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length && i < 4096; i += 1) bin += String.fromCharCode(bytes[i]);
      return { status, bytes: bytes.length, head: bin.slice(0, 100) };
    }, url);
    b += `status=${res.status} bytes=${res.bytes ?? 0} head=${String(res.head ?? "").replace(/\s+/g, " ").slice(0, 80)}`;
  } catch (e) {
    b += `ERR ${String(e).slice(0, 60)}`;
  }
  const line = `${s.doi} (${s.note})\n  ${a}\n  ${b}`;
  console.log(line);
  out.push(line);
  await sleep(4000);
}

await ctx.close();
fs.writeFileSync(
  `${REPD}/.cache/bulk/jem/diag-xml.md`,
  "# full-xml diagnosis\n\n" + out.join("\n") + "\n",
);
console.log("done");
