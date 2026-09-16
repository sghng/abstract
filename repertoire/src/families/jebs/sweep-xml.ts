#!/usr/bin/env bun
/** Single-shot retry of XML absents (year>=2007, no xml in manifest). */
import { chromium } from "playwright";
import * as fs from "node:fs";
import { createHash } from "node:crypto";

const OUT = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const REPO = fs.realpathSync(`${OUT}/../../../..`);
const RAW = `${REPO}/repertoire/raw-new`;
const PROFILE = `${REPO}/repertoire/.cache/spike-jebs/sage-profile2`;
const BASE = "https://journals.sagepub.com";
const CONTROL = "10.3102/1076998614548485";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

const papers: { doi: string; doi_id: string; year: number }[] = fs
  .readFileSync(`${OUT}/papers.jsonl`, "utf8").trim().split("\n").map(JSON.parse);
const hasXml = new Set(
  fs.readFileSync(`${OUT}/manifest.jsonl`, "utf8").trim().split("\n").map(JSON.parse)
    .filter((m: { format: string }) => m.format === "xml").map((m: { doi_id: string }) => m.doi_id),
);
const todo = papers.filter((p) => p.year >= 2007 && !hasXml.has(p.doi_id));
console.log(`xml absents to retry: ${todo.length}`);

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false, channel: "chrome",
  args: ["--window-position=500,60", "--disable-blink-features=AutomationControlled"],
});
const page = await ctx.newPage();
await page.goto(`${BASE}/doi/${CONTROL}`, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => {});
for (let i = 0; i < 60; i++) {
  const t = await page.title().catch(() => "");
  if (t && !/just a moment|attention required/i.test(t)) break;
  await sleep(2500);
}
await sleep(9000);

let saved = 0, still = 0;
for (const p of todo) {
  const r = await page.evaluate(async (u: string) => {
    try {
      const res = await fetch(u, { credentials: "include" });
      const ct = res.headers.get("content-type") ?? "";
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { status: res.status, ct, b64: btoa(bin) };
    } catch (e) { return { status: 0, ct: "", b64: "", err: String(e).slice(0, 80) }; }
  }, `${BASE}/doi/full-xml/${p.doi}`);
  const b = r.b64 ? Buffer.from(r.b64, "base64") : Buffer.alloc(0);
  const ok = r.status === 200 && b.length > 20_480 && b.subarray(0, 4096).toString("latin1").includes("<article");
  if (ok) {
    const name = `${p.doi_id}.xml`;
    fs.writeFileSync(`${RAW}/${name}`, b);
    fs.appendFileSync(`${OUT}/manifest.jsonl`, JSON.stringify({
      doi: p.doi, doi_id: p.doi_id, journal: "jebs", year: p.year, format: "xml",
      file: `raw-new/${name}`, bytes: b.length, sha256: sha256(b), fetched_at: new Date().toISOString(),
    }) + "\n");
    saved++;
    console.log(`SAVED ${p.doi} (${(b.length / 1024).toFixed(0)}KB)`);
  } else still++;
  await sleep(4500);
}
console.log(`retry done: saved=${saved} still-absent=${still}`);
await ctx.close();
