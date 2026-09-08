/**
 * Repertoire -- the writing-style corpus as a tool.
 *
 * One noun, three verbs:
 *   search  text -> exemplar passages (published psychometric prose) with
 *           optional metadata filters (year, doi, section) and a soft
 *           section preference
 *   context chunk ref -> the surrounding chunks (read the neighborhood of a
 *           hit without a new vector query)
 *   outline doi -> the paper's section skeleton with chunk ranges, so the
 *           agent can follow a hit into the paper's rhetorical arc
 *
 * Corpus: Psychometrika 2020-2025, 395 papers, 17,758 paragraph-aware
 * chunks, voyage-context-4 vectors in Cloudflare Vectorize. Chunk text and
 * headings ride in vector metadata; context/outline read the local chunk
 * cache (repertoire/.cache/chunks), the same files that were embedded.
 *
 * Registered for the writer and editor peers (HARNESS_ROLE). The tool object
 * is exported so extensions/subagents can pin it on subagent prototypes
 * (style-check) via customTools; children run with noExtensions: true.
 *
 * Env: VOYAGE_API_KEY and CF_API_TOKEN, from process.env or the repo .env.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Type } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const REPO = path.resolve(import.meta.dir, "..", "..");
const CHUNKS_DIR = path.join(REPO, "repertoire", ".cache", "chunks");
const ACCOUNT_ID = "931e2de500772326b331964159d3bd2d";
const INDEX = "repertoire";
const MODEL = "voyage-context-4";
const DIMS = 1024;
const PREFER_BOOST = 0.03;

function envKey(name: string): string {
  if (process.env[name]) return process.env[name]!;
  try {
    for (const line of fs.readFileSync(path.join(REPO, ".env"), "utf8").split("\n")) {
      const m = line.match(/^(\w+)=(.*)$/);
      if (m && m[1] === name) return m[2].trim();
    }
  } catch {}
  throw new Error(`${name} missing (process env or repo .env)`);
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/contextualizedembeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${envKey("VOYAGE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [[text]],
      model: MODEL,
      input_type: "query",
      output_dimension: DIMS,
    }),
  });
  if (!res.ok) throw new Error(`voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).data[0].data[0].embedding;
}

type Hit = {
  id: string;
  score: number;
  metadata: { doi: string; year: number; section: string; heading: string; text: string };
};

async function vectorizeQuery(
  vector: number[],
  topK: number,
  filter?: Record<string, unknown>,
): Promise<Hit[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/vectorize/v2/indexes/${INDEX}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envKey("CF_API_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ vector, topK, returnMetadata: "all", ...(filter ? { filter } : {}) }),
    },
  );
  if (!res.ok) throw new Error(`vectorize ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  if (!json.success) throw new Error(`vectorize: ${JSON.stringify(json.errors).slice(0, 200)}`);
  return json.result.matches;
}

type Chunk = { chunk_no: number; heading: string; text: string };

/** doi in either form ("10.1017/psy.2024.18" or "10.1017:psy.2024.18") -> chunks file */
function loadChunks(doi: string): Chunk[] {
  const doiId = doi.replace("/", ":");
  const file = path.join(CHUNKS_DIR, `${doiId}.json`);
  if (!fs.existsSync(file)) throw new Error(`no local chunks for ${doi} (regenerate: bun repertoire/src/chunk.ts)`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const fmtHit = (h: Hit, i: number) =>
  `[${i + 1}] ${h.score.toFixed(4)} ${h.id} (${h.metadata.section}) ${h.metadata.heading}\n` +
  h.metadata.text.replace(/^/gm, "    ");

export const repertoireTool = defineTool({
  name: "repertoire",
  label: "Repertoire",
  description:
    "Consult the repertoire: a corpus of published psychometric prose (Psychometrika 2020-2025) used as a style guide. " +
    "search: pass draft prose, get published passages in the same register (query in the register you want back). " +
    "context: read the chunks around a hit ref. outline: a paper's section skeleton with chunk refs. " +
    "Not for literature discovery or citation facts; it answers 'how do good writers say this kind of thing'.",
  parameters: Type.Object({
    action: Type.Union([Type.Literal("search"), Type.Literal("context"), Type.Literal("outline")]),
    text: Type.Optional(Type.String({ description: "search: the draft prose to match" })),
    ref: Type.Optional(Type.String({ description: "context: a hit ref like 10.1017:psy.2024.18#c046" })),
    doi: Type.Optional(Type.String({ description: "restrict to one paper (outline target, or search filter)" })),
    section: Type.Optional(
      Type.String({
        description:
          "hard filter on section bucket: abstract, introduction, background, methods, results, discussion, conclusion",
      }),
    ),
    prefer: Type.Optional(Type.String({ description: "soft boost for a section bucket, results re-sorted" })),
    year: Type.Optional(Type.Number({ description: "hard filter on publication year" })),
    topK: Type.Optional(Type.Number({ description: "hits to return (default 6)" })),
    radius: Type.Optional(Type.Number({ description: "context: chunks on each side of ref (default 2)" })),
  }),
  async execute(_id, params) {
    const say = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });

    if (params.action === "search") {
      if (!params.text) return say("search requires text");
      const topK = params.topK ?? 6;
      const filter: Record<string, unknown> = {};
      if (params.year) filter.year = params.year;
      if (params.doi) filter.doi = params.doi.replace(":", "/");
      if (params.section) filter.section = params.section;
      const vector = await embedQuery(params.text);
      let matches = await vectorizeQuery(
        vector,
        params.prefer ? topK * 5 : topK,
        Object.keys(filter).length ? filter : undefined,
      );
      if (params.prefer) {
        for (const m of matches) if (m.metadata.section === params.prefer) m.score += PREFER_BOOST;
        matches.sort((a, b) => b.score - a.score);
      }
      matches = matches.slice(0, topK);
      if (!matches.length) return say("no hits");
      return say(matches.map(fmtHit).join("\n\n"));
    }

    if (params.action === "context") {
      if (!params.ref) return say("context requires ref (e.g. 10.1017:psy.2024.18#c046)");
      const m = params.ref.match(/^(.+)#c(\d+)$/);
      if (!m) return say("malformed ref; expected <doi>#c<NNN>");
      const chunks = loadChunks(m[1]);
      const n = Number(m[2]);
      const r = params.radius ?? 2;
      const lo = Math.max(0, n - r);
      const hi = Math.min(chunks.length - 1, n + r);
      const doiId = m[1].replace("/", ":");
      const out = chunks
        .slice(lo, hi + 1)
        .map(
          (c, i) =>
            `[${lo + i === n ? "*" : ""}${doiId}#c${String(lo + i).padStart(3, "0")}] (${c.heading})\n` +
            c.text.replace(/^/gm, "    "),
        );
      return say(out.join("\n\n"));
    }

    // outline
    if (!params.doi) return say("outline requires doi");
    const chunks = loadChunks(params.doi);
    const doiId = params.doi.replace("/", ":");
    const lines: string[] = [];
    let start = 0;
    for (let i = 1; i <= chunks.length; i++) {
      if (i === chunks.length || chunks[i].heading !== chunks[start].heading) {
        const chars = chunks.slice(start, i).reduce((s, c) => s + c.text.length, 0);
        lines.push(
          `#c${String(start).padStart(3, "0")}-#c${String(i - 1).padStart(3, "0")}  ${chunks[start].heading}  (${chars} chars)`,
        );
        start = i;
      }
    }
    return say(`${doiId}: ${chunks.length} chunks\n` + lines.join("\n"));
  },
});

const ARMED_ROLES = ["writer", "editor"];

export default function (pi: ExtensionAPI) {
  const role = process.env.HARNESS_ROLE;
  if (!role || !ARMED_ROLES.includes(role)) return;
  pi.registerTool(repertoireTool);
}
