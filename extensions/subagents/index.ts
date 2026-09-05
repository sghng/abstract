/**
 * Subagents -- disposable delegate sessions for lab roles.
 *
 * Design: issue #27. Two flavors: bundled task-shaped subagents from
 * subagents/<name>.md (frontmatter: description, tier, model, thinking,
 * tools), and bespoke custom prompts composed by the caller (e.g. the
 * editor's reviewer panels). Children are born blind (no extensions, skills,
 * context files, or cues) and die silent (in-memory session; only the report
 * returns).
 *
 * Model selection: tiers map semantics to models in subagents/tiers.json
 * (routine = least capable suffices; standard; deep = hard reasoning). A
 * bundled spec may pin a model directly; a raw model string on the call is
 * the logged escape hatch. Every spawn appends one JSONL telemetry line to
 * <project>/.pi/subagents.jsonl.
 *
 * Loaded into every lab session from the agent dir; self-configures from
 * HARNESS_ROLE. No-op in non-lab sessions.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { ROLES, type Role } from "../../src/score.ts";

const HARNESS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SUBAGENTS_DIR = path.join(HARNESS_DIR, "subagents");
const TIERS_PATH = path.join(SUBAGENTS_DIR, "tiers.json");

const DEFAULT_TOOLS = ["read", "grep", "find", "ls", "bash"];
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const REPORT_CAP = 32_000;

interface TierSpec {
  model: string;
  thinking?: string;
}

interface SubagentSpec {
  name: string;
  description: string;
  tier?: string;
  model?: string;
  thinking?: string;
  tools?: string[];
  body: string;
}

function parseFrontmatter(text: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v: unknown = kv[2].trim();
    const arr = (v as string).match(/^\[(.*)\]$/);
    if (arr)
      v = arr[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    data[kv[1]] = v;
  }
  return { data, body: m[2].trim() };
}

function loadSpec(name: string): SubagentSpec | undefined {
  const file = path.join(SUBAGENTS_DIR, `${name}.md`);
  if (!fs.existsSync(file)) return undefined;
  const { data, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));
  return {
    name,
    description: (data.description as string) ?? "",
    tier: data.tier as string | undefined,
    model: data.model as string | undefined,
    thinking: data.thinking as string | undefined,
    tools: data.tools as string[] | undefined,
    body,
  };
}

function listSpecs(): SubagentSpec[] {
  if (!fs.existsSync(SUBAGENTS_DIR)) return [];
  return fs
    .readdirSync(SUBAGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => loadSpec(f.slice(0, -3))!)
    .filter(Boolean);
}

function loadTiers(): Record<string, TierSpec> {
  try {
    return JSON.parse(fs.readFileSync(TIERS_PATH, "utf8"));
  } catch {
    return {};
  }
}

/** "provider/id[:thinking]" -> parts */
function parseModelSpec(spec: string): {
  provider: string;
  id: string;
  thinking?: string;
} {
  const slash = spec.indexOf("/");
  const rest = spec.slice(slash + 1);
  const colon = rest.lastIndexOf(":");
  return {
    provider: spec.slice(0, slash),
    id: colon === -1 ? rest : rest.slice(0, colon),
    thinking: colon === -1 ? undefined : rest.slice(0, colon),
  };
}

export default function (pi: ExtensionAPI) {
  const roleRaw = process.env.HARNESS_ROLE;
  if (!roleRaw || !(ROLES as readonly string[]).includes(roleRaw)) return;
  const role = roleRaw as Role;

  let cwd = process.cwd();
  let runtimePromise: Promise<ModelRuntime> | undefined;
  // One delegate at a time per parent session.
  let queue: Promise<unknown> = Promise.resolve();

  const getRuntime = () => (runtimePromise ??= ModelRuntime.create({}));

  async function spawn(args: {
    task: string;
    tools: string[];
    modelSpec?: string;
    tier?: string;
    thinking?: string;
    timeoutMs?: number;
  }) {
    const tiers = loadTiers();
    const resolved =
      args.modelSpec ?? (args.tier ? tiers[args.tier]?.model : undefined);
    let thinkingLevel =
      args.thinking ??
      (args.modelSpec
        ? undefined
        : args.tier
          ? tiers[args.tier]?.thinking
          : undefined);

    let model;
    if (resolved) {
      const { provider, id, thinking: inline } = parseModelSpec(resolved);
      model = (await getRuntime()).getModel(provider, id);
      if (!model) throw new Error(`model not found: ${resolved}`);
      thinkingLevel ??= inline;
    }

    // Hide HARNESS_ROLE while the child boots: defense in depth so nothing
    // in the child can self-configure as a lab peer (noExtensions already
    // suppresses extension loading entirely).
    const savedRole = process.env.HARNESS_ROLE;
    delete process.env.HARNESS_ROLE;
    let session;
    try {
      ({ session } = await createAgentSession({
        cwd,
        modelRuntime: await getRuntime(),
        model,
        thinkingLevel: thinkingLevel as never,
        tools: args.tools,
        sessionManager: SessionManager.inMemory(cwd),
        resourceLoader: new DefaultResourceLoader({
          cwd,
          agentDir: HARNESS_DIR,
          noExtensions: true,
          noSkills: true,
          noPromptTemplates: true,
          noContextFiles: true,
        }),
      }));
    } finally {
      if (savedRole !== undefined) process.env.HARNESS_ROLE = savedRole;
    }

    const timer = setTimeout(
      () => void session.abort(),
      args.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
    try {
      await session.prompt(args.task);
      const assistants = session.messages.filter((m) => m.role === "assistant");
      const last = assistants[assistants.length - 1];
      const text = Array.isArray(last?.content)
        ? last.content
            .filter((c: { type: string }) => c.type === "text")
            .map((c) => (c as { text: string }).text)
            .join("\n")
        : "";
      const tokens = assistants.reduce((sum, m) => {
        const u = (m as { usage?: { totalTokens?: number } }).usage;
        return sum + (u?.totalTokens ?? 0);
      }, 0);
      return {
        report:
          text.slice(0, REPORT_CAP) || "(subagent returned no text report)",
        turns: assistants.length,
        tokens,
        modelUsed: model ? `${model.provider}/${model.id}` : "inherit",
      };
    } finally {
      clearTimeout(timer);
      session.dispose();
    }
  }

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      `Spawn a disposable subagent: an isolated child session that works the ` +
      `task and returns a self-contained report. Use agent for a bundled ` +
      `subagent from the catalog (subagents/ in the harness), or prompt for ` +
      `a bespoke brief. Subagents are born blind (no memory, peers, or cues) ` +
      `and die silent (only the report returns), so the task must carry ` +
      `everything the subagent needs. Pick tier by the work's nature: ` +
      `routine means the least capable model suffices, deep means hard ` +
      `reasoning. One subagent at a time; the call blocks until the report ` +
      `is ready.`,
    parameters: Type.Object({
      agent: Type.Optional(
        Type.String({ description: "Bundled subagent name from subagents/." }),
      ),
      prompt: Type.Optional(
        Type.String({
          description:
            "Bespoke persona and brief; required when agent is omitted.",
        }),
      ),
      task: Type.String({
        description:
          "The complete task: scope, file paths, criteria, what done looks like.",
      }),
      tier: Type.Optional(
        Type.Union(
          [
            Type.Literal("routine"),
            Type.Literal("standard"),
            Type.Literal("deep"),
          ],
          {
            description:
              "Model tier. routine = least capable suffices; deep = hard reasoning.",
          },
        ),
      ),
      model: Type.Optional(
        Type.String({
          description: "Escape hatch: provider/id[:thinking]. Overrides tier.",
        }),
      ),
      tools: Type.Optional(
        Type.Array(Type.String(), {
          description: `Tool allowlist; default ${DEFAULT_TOOLS.join(", ")}.`,
        }),
      ),
      output: Type.Optional(
        Type.String({ description: "Optional path to also save the report." }),
      ),
      timeoutMs: Type.Optional(
        Type.Number({ description: `Default ${DEFAULT_TIMEOUT_MS}.` }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const job = queue.then(() => run(params));
      queue = job.catch(() => {});
      return job;

      async function run(p: typeof params) {
        const started = Date.now();
        let spec: SubagentSpec | undefined;
        if (p.agent) {
          spec = loadSpec(p.agent);
          if (!spec) {
            const available = listSpecs().map(
              (s) => `${s.name}: ${s.description}`,
            );
            return err(
              `unknown subagent "${p.agent}". Available:\n${available.join("\n")}`,
            );
          }
        } else if (!p.prompt) {
          return err("either agent (bundled) or prompt (bespoke) is required");
        }

        const brief = spec
          ? spec.body
          : `${p.prompt!}\n\nYou are a disposable subagent of a research lab. ` +
            `You have no memory beyond this session, no peers, and no way to ` +
            `ask questions. Return one self-contained report: findings with ` +
            `file and line citations, no preamble.`;
        const fullTask = `${brief}\n\n## Task\n\n${p.task}`;
        const tools = p.tools ?? spec?.tools ?? DEFAULT_TOOLS;
        const tier = p.tier ?? spec?.tier;
        const modelSpec = p.model ?? spec?.model;

        try {
          const result = await spawn({
            task: fullTask,
            tools,
            modelSpec,
            tier,
            thinking: spec?.thinking,
            timeoutMs: p.timeoutMs,
          });
          if (p.output) {
            const out = path.resolve(cwd, p.output);
            fs.mkdirSync(path.dirname(out), { recursive: true });
            fs.writeFileSync(out, result.report);
          }
          telemetry(
            p,
            result.modelUsed,
            result.turns,
            result.tokens,
            Date.now() - started,
          );
          const saved = p.output ? `\n\nReport also saved to ${p.output}.` : "";
          return ok(result.report + saved);
        } catch (e) {
          telemetry(
            p,
            modelSpec ?? tier ?? "inherit",
            0,
            0,
            Date.now() - started,
            String(e),
          );
          return err(`subagent failed: ${e}`);
        }
      }

      function telemetry(
        p: typeof params,
        model: string,
        turns: number,
        tokens: number,
        durationMs: number,
        error?: string,
      ) {
        try {
          fs.mkdirSync(path.join(cwd, ".pi"), { recursive: true });
          fs.appendFileSync(
            path.join(cwd, ".pi", "subagents.jsonl"),
            JSON.stringify({
              ts: new Date().toISOString(),
              parent: role,
              agent: p.agent ?? "custom",
              model,
              tier: p.tier,
              turns,
              tokens,
              durationMs,
              output: p.output,
              error,
              task: p.task.slice(0, 200),
            }) + "\n",
          );
        } catch {
          // telemetry must never break delegation
        }
      }

      function ok(text: string) {
        return { content: [{ type: "text" as const, text }], details: {} };
      }
      function err(text: string) {
        return {
          content: [{ type: "text" as const, text }],
          details: { error: true },
        };
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
  });
}
