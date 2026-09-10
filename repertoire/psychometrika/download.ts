#!/usr/bin/env bun
/**
 * Download publisher PDFs for every converted Psychometrika paper. PDF URLs
 * come from citation_pdf_url metas in the local lean HTML (no issue scraping).
 * Cambridge serves them with plain curl. Output: pdf/{doi_id}.pdf, resumable.
 */
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const ROOT = new URL("..", import.meta.url).pathname;
const OUT = `${ROOT}/pdf`;
fs.mkdirSync(OUT, { recursive: true });

const files = fs
  .readdirSync(`${ROOT}/html`)
  .filter((f) => /^(10\.1007:s11336|10\.1017:psy)/.test(f));
let todo = 0;
for (const f of files) {
  const doiId = f.replace(/\.html$/, "");
  const dest = `${OUT}/${doiId}.pdf`;
  if (fs.existsSync(dest)) continue;
  const m = fs
    .readFileSync(`${ROOT}/html/${f}`, "utf8")
    .match(/citation_pdf_url"\s+content="([^"]+)"/);
  if (!m) {
    console.log(`${doiId}: no citation_pdf_url`);
    continue;
  }
  todo++;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await run("curl", ["-sL", "--fail", "-o", dest, m[1]], { timeout: 180_000 });
      const head = fs.readFileSync(dest).subarray(0, 5).toString();
      if (head !== "%PDF-") throw new Error("not a pdf");
      break;
    } catch {
      fs.rmSync(dest, { force: true });
      if (attempt === 4) console.log(`${doiId}: FAILED`);
      else await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  if (todo % 25 === 0) console.log(`${todo} downloaded`);
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`done: ${todo} pdfs`);
