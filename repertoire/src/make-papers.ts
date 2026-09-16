#!/usr/bin/env bun
/**
 * Emit .cache/bulk/arxiv/papers.jsonl from metadata.jsonl for the central
 * uploader (upload-bulk.ts papers schema). year from created; canonical
 * arXiv URLs. journal slug "arxiv".
 */
import * as fs from "node:fs";
const DIR = new URL("../../.cache/bulk/arxiv/", import.meta.url).pathname.replace(/\/$/, "");
const rows = fs.readFileSync(`${DIR}/metadata.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const out = rows.map((r) => ({
  doi: r.doi,
  doi_id: r.doi.toLowerCase().replace(/\//g, ":"),
  title: r.title,
  year: Number(r.created.slice(0, 4)) || null,
  journal: "arxiv",
  issue_url: null,
  article_url: `https://arxiv.org/abs/${r.arxiv_id}`,
  pdf_url: `https://arxiv.org/pdf/${r.arxiv_id}`,
}));
fs.writeFileSync(`${DIR}/papers.jsonl`, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`papers.jsonl: ${out.length} rows`);
