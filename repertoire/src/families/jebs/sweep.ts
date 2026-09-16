#!/usr/bin/env bun
/** One-off sweep: the 3 missing PDFs + spot-check 5 persistent-403 XMLs. */
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

const PDFS = ["10.3102/10769986016003000", "10.3102/10769986017002000", "10.3102/1076998611420439"];
const XMLS = ["10.3102/10769986251403007", "10.3102/10769986261472508", "10.3102/1076998611420439", "10.3102/1076998610300492", "10.3102/1076998606298032"];

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
console.log("[warm] clear");

async function grab(url: string) {
  const r = await page.evaluate(async (u: string) => {
    try {
      const res = await fetch(u, { credentials: "include" });
      const ct = res.headers.get("content-type") ?? "";
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { status: res.status, ct, b64: btoa(bin) };
    } catch (e) { return { status: 0, ct: "", b64: "", err: String(e).slice(0, 80) }; }
  }, url);
  return { ...r, b: r.b64 ? Buffer.from(r.b64, "base64") : Buffer.alloc(0) };
}

const append = (p: string, o: unknown) => fs.appendFileSync(p, JSON.stringify(o) + "\n");
for (const doi of PDFS) {
  const id = doi.toLowerCase().replace(/\//g, ":");
  const r = await grab(`${BASE}/doi/pdf/${doi}`);
  const ok = r.status === 200 && r.b.length > 4096 && r.b.subarray(0, 5).toString("latin1") === "%PDF-";
  console.log(`pdf ${doi}: status=${r.status} bytes=${r.b.length} ct=${r.ct} -> ${ok ? "SAVED" : "fail"}`);
  if (ok) {
    const name = `${id}.pdf`;
    fs.writeFileSync(`${RAW}/${name}`, r.b);
    const p = JSON.parse(fs.readFileSync(`${OUT}/papers.jsonl`, "utf8").trim().split("\n").find((l: string) => JSON.parse(l).doi_id === id) || "{}");
    append(`${OUT}/manifest.jsonl`, { doi, doi_id: id, journal: "jebs", year: p.year, format: "pdf", file: `raw-new/${name}`, bytes: r.b.length, sha256: sha256(r.b), fetched_at: new Date().toISOString() });
  } else {
    append(`${OUT}/failures.jsonl`, { doi, doi_id: id, format: "pdf", status: r.status, bytes: r.b.length, snippet: r.b.subarray(0, 160).toString("latin1").replace(/\s+/g, " "), at: new Date().toISOString(), sweep: true });
  }
  await sleep(4500);
}
for (const doi of XMLS) {
  const r = await grab(`${BASE}/doi/full-xml/${doi}`);
  console.log(`xml-spot ${doi}: status=${r.status} bytes=${r.b.length} ct=${r.ct}`);
  await sleep(4500);
}
await ctx.close();
