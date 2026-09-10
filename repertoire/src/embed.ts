#!/usr/bin/env bun
/**
 * repertoire embed: chunked corpus -> Vectorize via voyage-context-4.
 *
 * Reads .cache/chunks/{doi_id}.json (from chunk.ts) and sends each paper's
 * chunk list in ONE contextualizedembeddings call (manual chunking still
 * yields document-contextualized vectors). Chunk text and heading ride in
 * Vectorize metadata so query results carry the passage itself.
 * Per-paper NDJSON checkpoints in .cache/vectors/ make it resumable.
 *
 * Then: bun src/insert-vectors.ts  (batches checkpoints into wrangler insert)
 *
 * Env: VOYAGE_API_KEY (root .env).
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const CHUNK_DIR = `${ROOT}/.cache/chunks`;
const VEC_DIR = `${ROOT}/.cache/vectors`;
const CONCURRENCY = 8;
const MODEL = "voyage-context-4";

const KEY = process.env.VOYAGE_API_KEY;
if (!KEY) throw new Error("VOYAGE_API_KEY not in env (source repo-root .env)");

// doi -> year, journal from the scrape cache
const papers: { doi: string; year: number; journal: string }[] = JSON.parse(
  await Bun.file(`${ROOT}/.cache/papers.json`).text(),
);
// canonical section bucket from the chunk heading: "## 4. Discussion and
// Concluding Remarks" -> "discussion". Conventional academic headings map
// to a small enum; anything unrecognized falls back to its first word.
const SECTION_MAP: [RegExp, string][] = [
  [/^abstract/, "abstract"],
  [/^(introduction|intro)/, "introduction"],
  [/^(background|literature|related|prelim|theor|overview|review of|previous)/, "background"],
  [/^(method|model|materials|design|procedure|estimation|algorithm|framework|approach|the )/, "methods"],
  [/^(result|finding|simulation|application|empirical|analysis|example|illustration|data|numerical)/, "results"],
  [/^(discussion|limitation|general|robustness)/, "discussion"],
  [/^(conclusion|concluding|future|summary|final)/, "conclusion"],
  [/^(reference|bibliograph|appendix|acknowledg|supplement)/, "backmatter"],
];
const sectionOf = (heading: string): string => {
  const h = heading.replace(/^#+\s*/, "").replace(/^[\d.\s]+/, "").toLowerCase().trim();
  for (const [re, bucket] of SECTION_MAP) if (re.test(h)) return bucket;
  return h.split(/[\s:;,(]/)[0] ?? "";
};

const metaByDoi = new Map(papers.map((p) => [p.doi, p]));

// manual-chunk mode is capped at 32K tokens per call; split long papers
// into ~96K-char groups (contextualization is then per-group, fine for the
// handful of papers that long)
const MAX_GROUP_CHARS = 60_000;

async function embedDoc(chunks: string[], retries = 4): Promise<number[][]> {
  const groups: string[][] = [];
  let cur: string[] = [];
  let curLen = 0;
  for (const c of chunks) {
    if (curLen + c.length > MAX_GROUP_CHARS && cur.length) {
      groups.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(c);
    curLen += c.length;
  }
  if (cur.length) groups.push(cur);
  const out: number[][] = [];
  for (const g of groups) out.push(...(await embedGroup(g, retries)));
  return out;
}

async function embedGroup(chunks: string[], retries: number): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.voyageai.com/v1/contextualizedembeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: [chunks],
          model: MODEL,
          input_type: "document",
          output_dimension: 1024,
        }),
      });
    } catch (e) {
      // network-level errors (DNS, socket drops) are retryable too
      if (attempt <= retries) {
        await Bun.sleep(2000 * attempt);
        continue;
      }
      throw e;
    }
    if (res.ok) {
      const r = await res.json();
      return r.data[0].data.map((c: any) => c.embedding as number[]);
    }
    if ((res.status === 429 || res.status >= 500) && attempt <= retries) {
      await Bun.sleep(2000 * attempt);
      continue;
    }
    throw new Error(`voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

const main = async () => {
  await mkdir(VEC_DIR, { recursive: true });
  const files = (await readdir(CHUNK_DIR)).filter((f) => f.endsWith(".json")).sort();
  const done = new Set(
    (await readdir(VEC_DIR)).filter((f) => f.endsWith(".ndjson")).map((f) => f.slice(0, -7)),
  );
  const todo = files.filter((f) => !done.has(f.slice(0, -5)));
  console.log(`${files.length} papers, ${done.size} already embedded, ${todo.length} to go`);

  let n = 0;
  let vectors = 0;
  let tokens = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const f = queue.shift()!;
      const doiId = f.slice(0, -5);
      const doi = doiId.replace(":", "/");
      try {
        const chunks: { chunk_no: number; heading: string; text: string }[] = JSON.parse(
          await Bun.file(`${CHUNK_DIR}/${f}`).text(),
        );
        const embs = await embedDoc(chunks.map((c) => c.text));
        if (embs.length !== chunks.length)
          throw new Error(`chunk/embedding count mismatch ${chunks.length} vs ${embs.length}`);
        const m = metaByDoi.get(doi);
        const lines = chunks.map((c, i) =>
          JSON.stringify({
            id: `${doiId}#c${String(i).padStart(3, "0")}`,
            values: embs[i],
            metadata: {
              doi,
              journal: m?.journal ?? "psychometrika",
              year: m?.year ?? null,
              section: c.section ?? sectionOf(c.heading),
            },
          }),
        );
        await writeFile(`${VEC_DIR}/${doiId}.ndjson`, lines.join("\n") + "\n");
        n++;
        vectors += chunks.length;
        if (n % 25 === 0) console.log(`[${n}/${todo.length}] vectors so far: ${vectors}`);
      } catch (e: any) {
        console.log(`${doiId} FAILED: ${e.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`done. ${n} papers -> ${vectors} vectors in ${VEC_DIR}`);
};

await main();
