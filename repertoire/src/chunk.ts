#!/usr/bin/env bun
/**
 * repertoire chunk: Markdown -> paragraph-aware chunks (~500 tokens).
 *
 * POLICY (audit record; see docs/repertoire.md):
 *   - split on blank lines; track the current ## heading
 *   - merge blocks until ~1900 chars (~475 tokens); split oversized
 *     prose blocks on sentences; never merge across a heading
 *   - GFM tables are ATOMIC: a pipe block is never sentence-split and
 *     never merged with prose; an oversized table stands as one chunk
 *     (table content IS embedded; a shredded table would be worse)
 *   - asset-ref lines (captions) ride with prose like any block
 *   - embedding text transforms @@eqNNNN@@ -> [formula] (noise to the
 *     embedder; the md keeps the real tokens for the future OCR pass)
 *   - each chunk records its line span in the md: D1 serves pointers,
 *     passages are read from the document itself
 *
 * Output: .cache/chunks/{doi_id}.json
 *   [{chunk_no, heading, section, line_start, line_end, text}]
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const MD_DIRS = [`${ROOT}/md`, `${ROOT}/jem/md`];
const OUT_DIR = `${ROOT}/.cache/chunks`;
const MAX_CHARS = 1900;

const SECTION_MAP: [RegExp, string][] = [
  [/^(abstract|summary)/, "abstract"],
  [/^(method|material|procedure|measure|instrument|sample|participant|design|estimation|data)/, "methods"],
  [/^(result|finding|simulation|application|empirical|analysis|example|illustration|numerical)/, "results"],
  [/^(discussion|limitation|general|robustness)/, "discussion"],
  [/^(conclusion|concluding|future|summary|final)/, "conclusion"],
  [/^(reference|bibliograph|appendix|acknowledg|supplement)/, "backmatter"],
];

function sectionOf(heading: string): string {
  const h = heading.replace(/^#+\s*/, "").replace(/^[\d.\s]+/, "").toLowerCase().trim();
  for (const [re, bucket] of SECTION_MAP) if (re.test(h)) return bucket;
  return h.split(/[\s:;,(]/)[0] ?? "";
}

type Chunk = {
  chunk_no: number;
  heading: string;
  section: string;
  line_start: number;
  line_end: number;
  text: string;
};

function splitSentences(text: string): string[] {
  // split after sentence-final punctuation followed by space+capital/digit/$
  return text.split(/(?<=[.!?])\s+(?=[A-Z0-9$(\\])/);
}

// group raw lines into blocks of consecutive non-blank lines, keeping
// 1-based start/end line numbers so chunks can point into the md
function toBlocks(md: string): { text: string; start: number; end: number }[] {
  const lines = md.split("\n");
  const blocks: { text: string; start: number; end: number }[] = [];
  let buf: string[] = [];
  let start = 0;
  for (let i = 0; i <= lines.length; i++) {
    const blank = i === lines.length || lines[i].trim() === "";
    if (!blank) {
      if (!buf.length) start = i + 1; // 1-based
      buf.push(lines[i]);
    } else if (buf.length) {
      blocks.push({ text: buf.join("\n").trim(), start, end: i });
      buf = [];
    }
  }
  return blocks.filter((b) => b.text);
}

function chunkPaper(md: string): Chunk[] {
  const blocks = toBlocks(md);
  const chunks: Chunk[] = [];
  let heading = "";
  let buf = "";
  let bStart = 0;
  let bEnd = 0;
  const flush = () => {
    if (buf.trim())
      chunks.push({
        chunk_no: chunks.length,
        heading,
        section: sectionOf(heading),
        line_start: bStart,
        line_end: bEnd,
        text: buf.trim().replace(/@@eq\d{4}@@/g, "[formula]"),
      });
    buf = "";
  };
  for (const block of blocks) {
    const h = block.text.match(/^#{2,3}\s+(.*)$/);
    if (h) {
      flush();
      heading = h[1].trim();
      bStart = block.start;
      bEnd = block.end;
      buf = block.text; // heading line starts the next chunk
      continue;
    }
    if (block.text.startsWith("|")) {
      // atomic GFM table: own chunk, never split, never merged
      flush();
      bStart = block.start;
      bEnd = block.end;
      buf = block.text;
      flush();
      continue;
    }
    if (!buf) {
      bStart = block.start;
    }
    bEnd = block.end;
    if (block.text.length > MAX_CHARS) {
      flush();
      for (const sent of splitSentences(block.text)) {
        if (buf.length + sent.length + 1 > MAX_CHARS) flush();
        if (!buf) bStart = block.start; // sentence-split chunk starts here
        buf = buf ? buf + " " + sent : sent;
        bEnd = block.end;
      }
      continue;
    }
    if (buf.length + block.text.length + 2 > MAX_CHARS) flush();
    buf = buf ? buf + "\n\n" + block.text : block.text;
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
