/**
 * The context report: what each lab agent receives, assembled the same way
 * the harness plugin assembles it (config/AGENTS.md + src/score.ts -->
 * prompts/*.md, read from disk) plus the OpenCode-native agent body, the
 * on-demand tier (skills index), the delegation tier (subagent catalog), and
 * the tool surface.
 *
 * Static by design: works with the server down, because the prompt
 * assembly itself is static (files + score). Live data (agent registry,
 * MCP status, skill discovery) is merged in when the server is reachable.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { SCORE, ROLES, type Role } from "./score.ts";

const REPO = path.resolve(import.meta.dir, "..");
const CONFIG = path.join(REPO, "config");
const KERNEL = path.join(CONFIG, "AGENTS.md");
const PROMPTS_DIR = path.join(REPO, "prompts");
const AGENTS_DIR = path.join(CONFIG, "agents");
const SKILLS_DIR = path.join(CONFIG, "skills");
const OPENCODE_JSON = path.join(CONFIG, "opencode.json");

/**
 * Plugin tool names. Keep in sync with config/plugin/harness.ts (tools.add).
 * The builtin set belongs to the pinned binary and is only summarized.
 */
const PLUGIN_TOOLS = ["cue", "repertoire"];
const BUILTIN_TOOLS_NOTE =
  "read bash edit write glob grep ls patch task webfetch (curated from the pinned binary)";

export type Piece = {
  kind: "kernel" | "prompt" | "agent";
  stem: string;
  file: string; // repo-relative
  lines: number;
  tokens: number; // estimate: chars / 4
  heading: string; // first markdown heading
  missing: boolean;
  alsoIn: Role[]; // for shared prompts: the other roles whose score lists them
};

export type SkillEntry = {
  name: string;
  description: string;
  lines: number;
  discovered?: boolean;
};

export type SubagentEntry = {
  name: string;
  description: string;
  model?: string;
  denied: string[]; // plugin tools denied via frontmatter permissions
  prompt: Piece; // the subagent's own prompt, after frontmatter
};

export type RoleReport = {
  role: Role;
  pieces: Piece[]; // kernel + prompts, assembly order
  totalTokens: number;
  skills: SkillEntry[];
  subagents: SubagentEntry[];
  tools: {
    builtin: string;
    plugin: string[];
    mcp: Array<{ name: string; status?: string }>;
  };
  denied: string[];
};

export type ContextReport = {
  serverVersion: string | null; // null = static view, server not reachable
  roles: RoleReport[];
  subagents: SubagentEntry[]; // the catalog every role can spawn
  subagentNote: string;
};

/* -- helpers -------------------------------------------------------------- */

function stat(text: string): { lines: number; tokens: number } {
  return { lines: text.split("\n").length, tokens: Math.ceil(text.length / 4) };
}

function read(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(REPO, rel), "utf8");
  } catch {
    return null;
  }
}

function firstHeading(text: string): string {
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

function splitFrontmatter(raw: string): { fm: string; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  return m ? { fm: m[1], body: raw.slice(m[0].length) } : { fm: "", body: raw };
}

function fmValue(fm: string, key: string): string | undefined {
  const inline = fm.match(new RegExp(`^${key}:\\s*(\\S.*)$`, "m"));
  if (inline) return inline[1].trim().replace(/^["']|["']$/g, "");
  const block = fm.match(new RegExp(`^${key}:\\n((?:[ \\t]+\\S.*\\n?)+)`, "m"));
  if (block) return block[1].replace(/^[ \t]+/gm, "").trim();
  return undefined;
}

/** Permission entries in agent frontmatter: `- action: X ... effect: deny`. */
function deniedTools(fm: string): string[] {
  const denied: string[] = [];
  let cur: string | null = null;
  for (const line of fm.split("\n")) {
    const a = line.match(/^\s*-\s*action:\s*(\S+)/);
    if (a) {
      cur = a[1];
      continue;
    }
    if (/^\s*effect:\s*deny/.test(line) && cur) {
      denied.push(cur);
      cur = null;
    }
  }
  return denied;
}

function oneLine(s: string, max = 88): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "..." : flat;
}

/* -- static catalogues ---------------------------------------------------- */

export function loadSkills(): SkillEntry[] {
  const out: SkillEntry[] = [];
  if (!fs.existsSync(SKILLS_DIR)) return out;
  for (const dir of fs.readdirSync(SKILLS_DIR).sort()) {
    const raw = read(path.join("config", "skills", dir, "SKILL.md"));
    if (!raw) continue;
    const { fm, body } = splitFrontmatter(raw);
    out.push({
      name: fmValue(fm, "name") ?? dir,
      description: oneLine(fmValue(fm, "description") ?? ""),
      lines: stat(body).lines,
    });
  }
  return out;
}

export function loadSubagents(
  liveAgents?: Map<
    string,
    { model?: string; description?: string; denied?: string[] }
  >,
): SubagentEntry[] {
  const out: SubagentEntry[] = [];
  if (!fs.existsSync(AGENTS_DIR)) return out;
  // Walk config/agents/ one level deep (roles at top level, named subagents
  // under subagents/); the agent ID is the path without .md, so nested files
  // carry the subagents/ prefix, matching OpenCode's discovery.
  const files: string[] = [];
  for (const entry of fs
    .readdirSync(AGENTS_DIR, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(entry.name);
    else if (entry.isDirectory())
      for (const f of fs
        .readdirSync(path.join(AGENTS_DIR, entry.name))
        .sort()) {
        if (f.endsWith(".md")) files.push(`${entry.name}/${f}`);
      }
  }
  for (const rel of files) {
    const raw = read(path.join("config", "agents", rel));
    if (!raw) continue;
    const { fm, body } = splitFrontmatter(raw);
    if (fmValue(fm, "mode") !== "subagent") continue;
    const name = rel.replace(/\.md$/, "");
    const s = stat(body);
    out.push({
      name,
      description: oneLine(
        liveAgents?.get(name)?.description ?? fmValue(fm, "description") ?? "",
      ),
      model: liveAgents?.get(name)?.model ?? fmValue(fm, "model"),
      denied: liveAgents?.get(name)?.denied ?? deniedTools(fm),
      prompt: {
        kind: "prompt",
        stem: name,
        file: `config/agents/${rel}`,
        lines: s.lines,
        tokens: s.tokens,
        heading: firstHeading(body),
        missing: false,
        alsoIn: [],
      },
    });
  }
  return out;
}

function loadMcp(): Array<{ name: string; status?: string }> {
  try {
    const cfg = JSON.parse(fs.readFileSync(OPENCODE_JSON, "utf8"));
    return Object.keys(cfg.mcp?.servers ?? {})
      .sort()
      .map((name) => ({ name }));
  } catch {
    return [];
  }
}

/* -- report --------------------------------------------------------------- */

export function buildReport(live?: {
  version: string;
  agents: Map<
    string,
    { model?: string; description?: string; denied?: string[] }
  >;
  mcp: Map<string, string | undefined>;
  skills: Set<string>;
}): ContextReport {
  const skills = loadSkills().map((s) => ({
    ...s,
    discovered: live
      ? live.skills.size === 0
        ? undefined
        : live.skills.has(s.name)
      : undefined,
  }));
  const subagents = loadSubagents(live?.agents);
  const mcp = loadMcp().map((s) => ({ ...s, status: live?.mcp.get(s.name) }));

  // reverse map: which roles share each prompt
  const shared = new Map<string, Role[]>();
  for (const role of ROLES)
    for (const stem of SCORE[role] ?? [])
      shared.set(stem, [...(shared.get(stem) ?? []), role]);

  const pieceFor = (
    role: Role,
    stem: string,
    file: string,
    kind: Piece["kind"],
    text?: string,
  ): Piece => {
    const raw = text ?? read(file);
    const s = raw ? stat(raw) : { lines: 0, tokens: 0 };
    return {
      kind,
      stem,
      file,
      lines: s.lines,
      tokens: s.tokens,
      heading: raw
        ? firstHeading(raw)
        : "(file missing; the plugin skips it silently)",
      missing: !raw,
      alsoIn:
        kind === "prompt"
          ? (shared.get(stem) ?? []).filter((r) => r !== role)
          : [],
    };
  };

  const roles: RoleReport[] = ROLES.map((role) => {
    const pieces: Piece[] = [
      pieceFor(role, "kernel", "config/AGENTS.md", "kernel"),
      ...(SCORE[role] ?? []).map((stem) =>
        pieceFor(role, stem, `prompts/${stem}.md`, "prompt"),
      ),
    ];
    // OpenCode-native doctrine: a non-empty agent body is appended by the
    // server itself, outside the score (statistician today; every role after
    // the prompts retirement).
    const agentFile = `config/agents/${role}.md`;
    const agent = read(agentFile);
    if (agent) {
      const { body } = splitFrontmatter(agent);
      if (body.trim())
        pieces.push(pieceFor(role, "agent-body", agentFile, "agent", body));
    }
    return {
      role,
      pieces,
      totalTokens: pieces.reduce((n, p) => n + p.tokens, 0),
      skills,
      subagents,
      tools: { builtin: BUILTIN_TOOLS_NOTE, plugin: PLUGIN_TOOLS, mcp },
      denied: live?.agents.get(role)?.denied ?? [],
    };
  });

  return {
    serverVersion: live?.version ?? null,
    roles,
    subagents,
    subagentNote:
      "Subagents are born blind: kernel + own prompt + skills index; no role prompts, no cue. " +
      "Denied tools come from config/agents/subagents frontmatter permissions.",
  };
}

/* -- rendering ------------------------------------------------------------ */

function tok(n: number): string {
  return n >= 1000 ? `~${(n / 1000).toFixed(1)}k tok` : `~${n} tok`;
}

export function renderReport(r: ContextReport, only?: string): string {
  const out: string[] = [];
  out.push(
    r.serverVersion
      ? `lab context assembly (live view; server ${r.serverVersion})`
      : `lab context assembly (static view; server not reachable)`,
    "",
  );
  const roles = r.roles.filter((x) => !only || x.role === only);
  const first = r.roles[0];
  if (!first) return out.join("\n");

  // The on-demand and delegation tiers are identical across roles today
  // (no role scoping). Print them once; fall back to per-role if they
  // ever diverge.
  const sameSkills = r.roles.every((x) => sameNames(x.skills, first.skills));
  const sameSubagents = r.roles.every((x) =>
    sameNames(x.subagents, first.subagents),
  );
  const sameTools =
    r.roles.every((x) => x.tools.plugin.join() === first.tools.plugin.join()) &&
    r.roles.every(
      (x) =>
        x.tools.mcp.map((m) => m.name).join() ===
        first.tools.mcp.map((m) => m.name).join(),
    );

  const printSkills = (
    label: string,
    skills: SkillEntry[],
    indent = "    ",
  ) => {
    out.push(`${label}`);
    for (const s of skills)
      out.push(
        `${indent}${s.name.padEnd(14)}${String(s.lines).padStart(4)} ln  ${s.description}` +
          (s.discovered === false ? "  [NOT discovered by server]" : ""),
      );
  };
  const printSubagents = (
    label: string,
    subs: SubagentEntry[],
    indent = "    ",
  ) => {
    out.push(`${label}`);
    for (const s of subs)
      out.push(
        `${indent}${s.name.padEnd(30)}[${s.model ?? "?"}]  ${s.description}  denied: ${s.denied.join(",") || "none"}`,
      );
  };
  const printTools = (label: string, tools: RoleReport["tools"]) => {
    const mcp = tools.mcp
      .map((m) => (m.status ? `${m.name} (${m.status})` : m.name))
      .join(", ");
    out.push(`${label}`);
    out.push(`    builtin  ${tools.builtin}`);
    out.push(`    plugin   ${tools.plugin.join(", ")}`);
    out.push(`    mcp      ${mcp || "(none)"}`);
  };

  const k = first.pieces[0];
  out.push("common to every role");
  out.push(
    `  kernel      ${k.file}  ${k.lines} ln  ${tok(k.tokens)}  # ${k.heading}`,
  );
  if (sameSkills)
    printSkills(
      "  skills      index always present; bodies on demand, lost to compaction",
      first.skills,
    );
  if (sameSubagents) printSubagents("  subagents   task tool", first.subagents);
  if (sameTools) printTools("  tools", first.tools);
  out.push("");

  for (const role of roles) {
    out.push(role.role);
    for (const p of role.pieces) {
      if (p.kind === "kernel") continue;
      const also = p.alsoIn.length ? `  [also: ${p.alsoIn.join(", ")}]` : "";
      out.push(
        `  ${p.stem.padEnd(16)}${p.file.padEnd(28)}${String(p.lines).padStart(5)} ln  ${tok(p.tokens).padStart(9)}  # ${p.heading}${also}`,
      );
    }
    const doctrine = role.totalTokens - k.tokens;
    out.push(
      `  always-on total ${tok(role.totalTokens)} = kernel ${tok(k.tokens)} + doctrine ${tok(doctrine)}` +
        " (excludes the OpenCode base prompt, skills index, and tool schemas)",
    );
    if (!sameSkills) printSkills("  skills", role.skills, "    ");
    if (!sameSubagents) printSubagents("  subagents", role.subagents, "    ");
    if (!sameTools) printTools("  tools", role.tools);
    out.push(`  denied tools: ${role.denied.join(", ") || "(none)"}`);
    out.push("");
  }

  if (!only) {
    out.push(
      "subagent contexts (born blind: kernel + own prompt; no role prompts, no cue)",
    );
    for (const s of r.subagents) {
      out.push(
        `  ${s.name.padEnd(30)}prompt ${String(s.prompt.lines).padStart(4)} ln ${tok(s.prompt.tokens).padStart(9)}` +
          `${s.model ? `  [${s.model}]` : ""}  denied: ${s.denied.join(",") || "none"}`,
      );
    }
  }
  return out.join("\n");
}

function sameNames(
  a: Array<{ name: string }>,
  b: Array<{ name: string }>,
): boolean {
  return a.length === b.length && a.every((x, i) => x.name === b[i].name);
}
