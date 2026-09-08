#!/usr/bin/env bun
/**
 * repertoire chunk: Markdown -> paragraph-aware chunks (~500 tokens).
 *
 * Rules: split on blank lines; track the current ## heading; merge blocks
 * until ~1900 chars (~475 tokens); split oversized blocks on sentences;
 * never merge across a heading. Output: .cache/chunks/{doi_id}.json
 * [{chunk_no, heading, text}].
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const MD_DIRS = [`${ROOT}/md`, `${ROOT}/jem/md`];
const OUT_DIR = `${ROOT}/.cache/chunks`;
const MAX_CHARS = 1900;

function splitSentences(text: string): string[] {
  // split after sentence-final punctuation followed by space+capital/digit/$
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9$(\\])/);
}

function chunkPaper(md: string): { chunk_no: number; heading: string; text: string }[] {
  const blocks = md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const chunks: { chunk_no: number; heading: string; text: string }[] = [];
  let heading = "";
  let buf = "";
  const flush = () => {
    if (buf.trim()) chunks.push({ chunk_no: chunks.length, heading, text: buf.trim() });
    buf = "";
  };
  for (const block of blocks) {
    const h = block.match(/^#{2,3}\s+(.*)$/);
    if (h) {
      flush();
      heading = h[1].trim();
      buf = block; // heading line starts the next chunk
      continue;
    }
    if (block.length > MAX_CHARS) {
      flush();
      for (const sent of splitSentences(block)) {
        if (buf.length + sent.length + 1 > MAX_CHARS) flush();
        buf = buf ? buf + " " + sent : sent;
      }
      continue;
    }
    if (buf.length + block.length + 2 > MAX_CHARS) flush();
    buf = buf ? buf + "\n\n" + block : block;
  }
  flush();
  return chunks;
}

const main = async () => {
  await mkdir(OUT_DIR, { recursive: true });
  const sources: { dir: string; file: string }[] = [];
  for (const dir of MD_DIRS) {
    for (const f of (await readdir(dir)).filter((f) => f.endsWith(".md")).sort()) {
      sources.push({ dir, file: f });
    }
  }
  let total = 0;
  const sizes: number[] = [];
  for (const { dir, file: f } of sources) {
    const doiId = f.slice(0, -3);
    const chunks = chunkPaper(await Bun.file(`${dir}/${f}`).text());
    total += chunks.length;
    sizes.push(...chunks.map((c) => c.text.length));
    await writeFile(`${OUT_DIR}/${doiId}.json`, JSON.stringify(chunks, null, 1));
  }
  sizes.sort((a, b) => a - b);
  console.log(
    `${sources.length} papers -> ${total} chunks | median ${sizes[sizes.length >> 1]} chars, ` +
      `p95 ${sizes[Math.floor(sizes.length * 0.95)]}, max ${sizes[sizes.length - 1]}`,
  );
};

await main();
