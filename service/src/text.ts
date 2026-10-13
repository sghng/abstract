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

// match surface: line-break hyphens joined, whitespace collapsed, so a
// phrase spanning layout breaks still matches as typed
function normText(s: string): string {
  return s.replace(/(\w)-\s*\n\s*/g, "$1").replace(/\s+/g, " ").trim();
}

export function findInPaper(artifact: string, query: string) {
  const pages = loadPages(artifact);
  const normPages = pages.map((t) => normText(t));
  const q = normText(query).toLowerCase();
  const hits: Array<{ page: number; snippet: string }> = [];
  normPages.forEach((text, i) => {
    const lower = text.toLowerCase();
    let at = lower.indexOf(q);
    while (at !== -1 && hits.length < 8) {
      hits.push({
        page: i + 1,
        snippet: text.slice(Math.max(0, at - 160), Math.min(text.length, at + q.length + 160)).trim(),
      });
      at = lower.indexOf(q, at + q.length);
    }
  });
  if (hits.length > 0) return { artifact, query, mode: "phrase", hits };
  // fallback: pages containing every query word, tightest span first
  const tokens = [...new Set(q.split(/[^a-z0-9]+/).filter((t) => t.length > 1))];
  const loose: Array<{ page: number; snippet: string; span: number }> = [];
  if (tokens.length > 0) {
    normPages.forEach((text, i) => {
      const lower = text.toLowerCase();
      if (!tokens.every((t) => lower.includes(t))) return;
      const first = Math.min(...tokens.map((t) => lower.indexOf(t)));
      const last = Math.max(...tokens.map((t) => lower.lastIndexOf(t) + t.length));
      loose.push({
        page: i + 1,
        span: last - first,
        snippet: text.slice(Math.max(0, first - 80), Math.min(text.length, last + 80)).trim(),
      });
    });
  }
  loose.sort((a, b) => a.span - b.span);
  return {
    artifact,
    query,
    mode: "tokens",
    hits: loose.slice(0, 8).map(({ page, snippet }) => ({ page, snippet })),
  };
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
