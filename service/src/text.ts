/**
 * Page-anchored reading over stored artifacts. Mirrors the Zotero
 * read_pdf_pages idiom: targeted ranges, snippets for verification,
 * base64 export only for durable capture.
 */
import { existsSync, readFileSync } from "node:fs";
import { artPath, readMeta, validArtifact } from "./store.ts";

function loadPages(artifact: string): string[] {
  if (!validArtifact(artifact)) throw new Error(`bad artifact id: ${artifact}`);
  const p = artPath(artifact, "txt");
  if (!existsSync(p)) throw new Error(`artifact not found or not fetched yet: ${artifact}`);
  const pages = readFileSync(p, "utf8").split("\f");
  if (pages.length > 0 && pages[pages.length - 1].trim() === "") pages.pop();
  return pages;
}

export function readPages(artifact: string, from: number, to: number) {
  const meta = readMeta(artifact);
  const pages = loadPages(artifact);
  const f = Math.max(1, Math.min(from || 1, pages.length));
  const t = Math.max(f, Math.min(to || f, pages.length));
  return {
    artifact,
    doi: meta?.doi,
    title: meta?.title,
    total_pages: pages.length,
    from: f,
    to: t,
    text: pages.slice(f - 1, t).join("\f"),
  };
}

export function findInPaper(artifact: string, query: string) {
  const pages = loadPages(artifact);
  const q = query.toLowerCase();
  const hits: Array<{ page: number; snippet: string }> = [];
  pages.forEach((text, i) => {
    const lower = text.toLowerCase();
    let at = lower.indexOf(q);
    while (at !== -1 && hits.length < 8) {
      const start = Math.max(0, at - 160);
      hits.push({
        page: i + 1,
        snippet: text.slice(start, Math.min(text.length, at + q.length + 160)).replace(/\s+/g, " ").trim(),
      });
      at = lower.indexOf(q, at + q.length);
    }
  });
  return { artifact, query, hits };
}

export function exportPdf(artifact: string) {
  if (!validArtifact(artifact)) throw new Error(`bad artifact id: ${artifact}`);
  const p = artPath(artifact, "pdf");
  if (!existsSync(p)) throw new Error(`artifact not found: ${artifact}`);
  const meta = readMeta(artifact);
  return {
    artifact,
    doi: meta?.doi,
    bytes: readFileSync(p).length,
    base64: readFileSync(p).toString("base64"),
  };
}
