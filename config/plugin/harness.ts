/**
 * abstract harness plugin -- the lab's three in-process behaviors:
 *
 *   score assembly   session.context hook appends the calling role's
 *                    prompt files (src/score.ts --> prompts/*.md, read from
 *                    disk on every request, so edits go live next turn)
 *   cue              tool: brokerless message exchange between role sessions
 *                    on this server (session.prompt, delivery "queue"; the
 *                    recipient reads it at its next turn boundary)
 *   repertoire       tool: the writing-style corpus as a tool
 *                    (see docs/repertoire/index.md for the contract)
 *
 * Runs inside the Abstract server. The server URL and password arrive via
 * env (ABSTRACT_SERVER_URL, OPENCODE_PASSWORD), both set by `abstract`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { Plugin } from "@opencode/plugin";
import { OpenCode } from "@opencode/client";
import { z } from "zod";
import { SCORE, ROLES, type Role } from "../../src/score.ts";

const REPO = path.resolve(import.meta.dir, "..", "..");
const PROMPTS_DIR = path.join(REPO, "prompts");

const SERVER_URL = process.env.ABSTRACT_SERVER_URL ?? "http://127.0.0.1:4319";
const SERVER_PASSWORD = process.env.OPENCODE_PASSWORD ?? "";
const DEBUG_LOG = path.join(
  homedir(),
  ".local",
  "share",
  "abstract",
  "logs",
  "hook.log",
);

function client() {
  const headers: Record<string, string> = SERVER_PASSWORD
    ? {
        Authorization:
          "Basic " +
          Buffer.from(`opencode:${SERVER_PASSWORD}`).toString("base64"),
      }
    : {};
  return OpenCode.make({ baseUrl: SERVER_URL, headers });
}

const MAX_MESSAGE_BYTES = 32 * 1024;

export default Plugin.define({
  id: "abstract-harness",
  setup: async (ctx) => {
    // -- score assembly ----------------------------------------------------
    await ctx.session.hook("context", (event) => {
      const stems = SCORE[event.agent as Role];
      if (process.env.ABSTRACT_DEBUG)
        fs.appendFileSync(
          DEBUG_LOG,
          `context agent=${event.agent} stems=${JSON.stringify(stems ?? null)} system=${event.system.length}\n`,
        );
      if (!stems) return; // subagents and ad-hoc agents: kernel only
      for (const stem of stems) {
        try {
          const text = fs
            .readFileSync(path.join(PROMPTS_DIR, `${stem}.md`), "utf8")
            .trim();
          if (text) event.system.push({ type: "text", text });
        } catch {
          // a missing movement is a prompt bug, not a session killer
        }
      }
      if (process.env.ABSTRACT_DEBUG)
        fs.appendFileSync(
          DEBUG_LOG,
          `after agent=${event.agent} system=${event.system.length} heads=${event.system
            .map((p) => (p.text ?? "").split("\n")[0]?.slice(0, 36))
            .join(" | ")}\n`,
        );
    });

    // -- cue ---------------------------------------------------------------
    await ctx.tool.transform((tools) => {
      tools.add({
        name: "cue",
        description:
          "Send a short message (cue) to another lab role in this project. " +
          "Any role can cue any role except itself. The cue lands at the " +
          "recipient's next turn boundary.",
        options: { codemode: false },
        input: z.object({
          target: z.enum(ROLES as [Role, ...Role[]]).describe("recipient role"),
          message: z
            .string()
            .describe("Short pointer or question; not a document."),
        }),
        execute: async ({ target, message }, context) => {
          if (Buffer.byteLength(message, "utf8") > MAX_MESSAGE_BYTES)
            return {
              content: `cue exceeds ${MAX_MESSAGE_BYTES} bytes; put the content in a file and cue the path`,
            };
          const api = client();
          const caller = await api.session.get({
            sessionID: context.sessionID,
          });
          const from =
            (caller.metadata?.role as string | undefined) ?? context.agent;
          if (from === target)
            return { content: `cannot cue yourself (${target})` };
          const listed = await api.session.list({
            directory: caller.location.directory,
          });
          const hit = listed.data.find(
            (s) => s.metadata?.role === target && s.parentID === undefined,
          );
          if (!hit)
            return {
              content: `no ${target} session in this project; it is created by \`abstract\` in the project directory`,
            };
          await api.session.prompt({
            sessionID: hit.id,
            text:
              `[cue from ${from}] ${message}\n\n` +
              `If ${from} would benefit from a reply, do so via cue(target="${from}", message="...").`,
            delivery: "queue",
          });
          return { content: `cue sent to ${target}:\n\n${message}` };
        },
      });
    });

    // -- repertoire --------------------------------------------------------
    await ctx.tool.transform((tools) => {
      tools.add(repertoireTool());
    });
  },
});

/* ----------------------------------------------------------------------
 * repertoire -- the writing-style corpus as a tool. Ported from
 * extensions/repertoire; see docs/repertoire/index.md for the contract.
 */

const REPERTOIRE = path.join(REPO, "repertoire");
const MD_CACHE = path.join(REPERTOIRE, ".cache", "mdcache");
const ACCOUNT_ID = "931e2de500772326b331964159d3bd2d";
const D1_DATABASE = "36c30d13-6ddd-4f7a-9b9b-d3d971e6f800";
const BUCKET = "repertoire-docs";
const INDEX = "repertoire";
const MODEL = "voyage-context-4";
const DIMS = 1024;
const PREFER_BOOST = 0.03;

function envKey(name: string): string {
  if (process.env[name]) return process.env[name]!;
  try {
    for (const line of fs
      .readFileSync(path.join(REPO, ".env"), "utf8")
      .split("\n")) {
      const m = line.match(/^(\w+)=(.*)$/);
      if (m && m[1] === name) return m[2].trim();
    }
  } catch {}
  throw new Error(`${name} missing (process env or repo .env)`);
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(
    "https://api.voyageai.com/v1/contextualizedembeddings",
    {
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
    },
  );
  if (!res.ok)
    throw new Error(
      `voyage ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  return (await res.json()).data[0].data[0].embedding;
}

type Hit = {
  id: string; // <doi_id>#cNNN
  score: number;
  metadata: {
    doi: string;
    journal: string;
    year: number | null;
    section: string;
  };
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
      body: JSON.stringify({
        vector,
        topK,
        returnMetadata: "indexed",
        ...(filter ? { filter } : {}),
      }),
    },
  );
  if (!res.ok)
    throw new Error(
      `vectorize ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  const json = await res.json();
  if (!json.success)
    throw new Error(`vectorize: ${JSON.stringify(json.errors).slice(0, 200)}`);
  return json.result.matches;
}

type ChunkRow = {
  doi: string;
  chunk_no: number;
  heading: string | null;
  section: string | null;
  line_start: number;
  line_end: number;
  title?: string | null;
  journal?: string | null;
  year?: number | null;
};

async function d1(
  sql: string,
  params: (string | number)[],
): Promise<ChunkRow[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${D1_DATABASE}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envKey("CF_API_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  if (!res.ok)
    throw new Error(`d1 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  if (!json.success)
    throw new Error(`d1: ${JSON.stringify(json.errors).slice(0, 200)}`);
  return json.result[0].results;
}

const doiToId = (doi: string) => doi.replace("/", ":");
const idToDoi = (doiId: string) => doiId.replace(":", "/");

async function mdLines(doiId: string): Promise<string[]> {
  const local = path.join(MD_CACHE, `${doiId}.md`);
  if (!fs.existsSync(local)) {
    fs.mkdirSync(MD_CACHE, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      execFile(
        "npx",
        [
          "wrangler",
          "r2",
          "object",
          "get",
          `${BUCKET}/${doiId}.md`,
          "--file",
          local,
          "--remote",
        ],
        {
          cwd: REPERTOIRE,
          env: { ...process.env, CF_API_TOKEN: envKey("CF_API_TOKEN") },
        },
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
  return fs.readFileSync(local, "utf8").split("\n");
}

const span = (lines: string[], r: ChunkRow) =>
  lines.slice(r.line_start - 1, r.line_end).join("\n");

function repertoireTool() {
  return {
    name: "repertoire",
    description:
      "Consult the repertoire: a corpus of published psychometric prose (Psychometrika 2012-2025 + JEM 2005-2025) used as a style guide. " +
      "search: pass draft prose, get published passages in the same register (query in the register you want back). " +
      "context: read the chunks around a hit ref. outline: a paper's section skeleton with chunk refs. " +
      "Not for literature discovery or citation facts; it answers 'how do good writers say this kind of thing'.",
    options: { codemode: false },
    input: z.object({
      action: z.enum(["search", "context", "outline"]),
      text: z.string().optional().describe("search: the draft prose to match"),
      ref: z
        .string()
        .optional()
        .describe("context: a hit ref like 10.1017:psy.2024.18#c046"),
      doi: z
        .string()
        .optional()
        .describe("restrict to one paper (outline target, or search filter)"),
      journal: z.string().optional().describe("filter: psychometrika or jem"),
      section: z
        .string()
        .optional()
        .describe(
          "filter on section bucket: abstract, introduction, methods, results, discussion, conclusion, backmatter (heading-derived values also match)",
        ),
      prefer: z
        .string()
        .optional()
        .describe("soft boost for a section bucket, results re-sorted"),
      year: z.number().optional().describe("filter on publication year"),
      topK: z.number().optional().describe("hits to return (default 6)"),
      maxPerPaper: z
        .number()
        .optional()
        .describe(
          "max hits per paper (default 0 = unlimited; 1 = all-distinct papers)",
        ),
      radius: z
        .number()
        .optional()
        .describe("context: chunks on each side of ref (default 2)"),
    }),
    execute: async (params: any) => {
      const say = (text: string): { content: string } => ({ content: text });

      if (params.action === "search") {
        if (!params.text) return say("search requires text");
        const topK = params.topK ?? 6;
        const maxPerPaper = params.maxPerPaper ?? 0;
        const filter: Record<string, unknown> = {};
        if (params.year) filter.year = params.year;
        if (params.doi) filter.doi = idToDoi(params.doi);
        if (params.journal) filter.journal = params.journal;
        if (params.section) filter.section = params.section;
        const vector = await embedQuery(params.text);
        let matches = await vectorizeQuery(
          vector,
          Math.max(
            topK,
            params.prefer ? topK * 5 : 0,
            maxPerPaper > 0 ? topK * 5 : 0,
          ),
          Object.keys(filter).length ? filter : undefined,
        );
        if (params.prefer) {
          for (const m of matches)
            if (m.metadata.section === params.prefer) m.score += PREFER_BOOST;
          matches.sort((a, b) => b.score - a.score);
        }
        if (maxPerPaper > 0) {
          const seen = new Map<string, number>();
          matches = matches.filter((m) => {
            const doiId = m.id.slice(0, m.id.indexOf("#"));
            const n = (seen.get(doiId) ?? 0) + 1;
            seen.set(doiId, n);
            return n <= maxPerPaper;
          });
        }
        matches = matches.slice(0, topK);
        if (!matches.length) return say("no hits");

        const dois = [...new Set(matches.map((m) => m.metadata.doi))];
        const rows = await d1(
          `select c.doi, c.chunk_no, c.heading, c.section, c.line_start, c.line_end,
                  p.title, p.journal, p.year
           from chunks c left join papers p on p.doi = c.doi
           where c.doi in (${dois.map(() => "?").join(",")})`,
          dois,
        );
        const rowBy = new Map(rows.map((r) => [`${r.doi}#${r.chunk_no}`, r]));
        const mdByDoiId = new Map<string, string[]>();
        const out: string[] = [];
        for (const [i, m] of matches.entries()) {
          const at = m.id.indexOf("#");
          const doiId = m.id.slice(0, at);
          const n = Number(m.id.slice(at + 2));
          const r = rowBy.get(`${m.metadata.doi}#${n}`);
          if (!r) continue;
          if (!mdByDoiId.has(doiId)) mdByDoiId.set(doiId, await mdLines(doiId));
          const passage = span(mdByDoiId.get(doiId)!, r);
          out.push(
            `[${i + 1}] ${m.score.toFixed(4)} ${doiId}#c${String(n).padStart(3, "0")} (${r.journal ?? "?"} ${r.year ?? "?"}) ` +
              `${r.section ?? ""} | ${r.heading ?? ""} | lines ${r.line_start}-${r.line_end}\n` +
              passage.replace(/^/gm, "    "),
          );
        }
        return say(out.join("\n\n"));
      }

      if (params.action === "context") {
        if (!params.ref)
          return say("context requires ref (e.g. 10.1017:psy.2024.18#c046)");
        const m = params.ref.match(/^(.+)#c(\d+)$/);
        if (!m) return say("malformed ref; expected <doi>#c<NNN>");
        const doi = idToDoi(m[1]);
        const n = Number(m[2]);
        const r = params.radius ?? 2;
        const rows = await d1(
          `select doi, chunk_no, heading, section, line_start, line_end from chunks
           where doi = ? and chunk_no between ? and ? order by chunk_no`,
          [doi, Math.max(0, n - r), n + r],
        );
        if (!rows.length) return say(`no chunks for ${doi}`);
        const lines = await mdLines(doiToId(doi));
        const out = rows.map(
          (c) =>
            `[${c.chunk_no === n ? "*" : ""}${doiToId(doi)}#c${String(c.chunk_no).padStart(3, "0")}] ` +
            `(${c.heading ?? ""} | lines ${c.line_start}-${c.line_end})\n` +
            span(lines, c).replace(/^/gm, "    "),
        );
        return say(out.join("\n\n"));
      }

      // outline
      if (!params.doi) return say("outline requires doi");
      const doi = idToDoi(params.doi);
      const rows = await d1(
        `select c.chunk_no, c.heading, c.section, c.line_start, c.line_end, p.title, p.journal, p.year
         from chunks c left join papers p on p.doi = c.doi
         where c.doi = ? order by c.chunk_no`,
        [doi],
      );
      if (!rows.length) return say(`no chunks for ${doi}`);
      const lines: string[] = [];
      let start = 0;
      for (let i = 1; i <= rows.length; i++) {
        if (i === rows.length || rows[i].heading !== rows[start].heading) {
          lines.push(
            `#c${String(rows[start].chunk_no).padStart(3, "0")}-#c${String(rows[i - 1].chunk_no).padStart(3, "0")}  ` +
              `${rows[start].heading ?? ""}  (md lines ${rows[start].line_start}-${rows[i - 1].line_end})`,
          );
          start = i;
        }
      }
      const p = rows[0];
      return say(
        `${doi}: ${rows.length} chunks\n${p.title ?? ""} (${p.journal ?? "?"} ${p.year ?? "?"})\n` +
          lines.join("\n"),
      );
    },
  };
}
