/**
 * Cue -- brokerless message exchange between lab roles.
 *
 * Design: docs/multi-agent.md. Implementation plan: docs/harness.md.
 * Loaded into every lab session from the agent dir; self-configures from
 * HARNESS_ROLE (set by bin/<role>). No-op in non-lab sessions.
 *
 * One primitive: cue(target, message). Initiating and resolving are the
 * same call. Cues are always follow-ups, never steer. One inbound cue at
 * a time; the rest wait in the inbox dir. Offline roles: the cue waits on
 * disk and delivers on launch.
 */
import * as fs from "node:fs";
import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  ackCue,
  emptyState,
  ensureDirs,
  inboxDir,
  loadState,
  peekCounts,
  saveState,
  scanInbox,
  sendCue,
  type CueState,
} from "./core.ts";

const ROLES = ["orchestrator", "engineer", "librarian"] as const;
type Role = (typeof ROLES)[number];

export default function (pi: ExtensionAPI) {
  const roleRaw = process.env.HARNESS_ROLE;
  if (!roleRaw || !(ROLES as readonly string[]).includes(roleRaw)) return;
  const role = roleRaw as Role;

  let cwd = process.cwd();
  let state: CueState = emptyState();
  let watcher: fs.FSWatcher | undefined;
  let delivering = false;

  const preview = (msg: string) =>
    (msg.length > 60 ? `${msg.slice(0, 57)}...` : msg).replace(/\n/g, " ");
  const ago = (ts: number) => `${Math.max(0, Math.round((Date.now() - ts) / 60000))}m`;

  function persist() {
    saveState(cwd, role, state);
  }

  /** Per-session footer line: own awaits, own debts, lab-wide queue peek. */
  function statusLine(ctx: ExtensionContext) {
    const parts: string[] = [];
    const aw = Object.entries(state.awaiting).filter(([, n]) => n > 0);
    if (aw.length)
      parts.push(`awaiting: ${aw.map(([r, n]) => (n > 1 ? `${r}x${n}` : r)).join(", ")}`);
    if (state.debts.length)
      parts.push(`unanswered: ${state.debts.map((d) => d.from).join(", ")}`);
    const counts = peekCounts(cwd, ROLES as unknown as string[]);
    const queued = ROLES.filter((r) => r !== role && counts[r] > 0).map(
      (r) => `${r}:${counts[r]}`,
    );
    if (queued.length) parts.push(`queued for ${queued.join(" ")}`);
    ctx.ui.setStatus("cue", parts.length ? `cue | ${parts.join(" | ")}` : undefined);
  }

  /** Deliver at most one inbound cue; the rest wait until debts resolve. */
  function tryDeliver(ctx: ExtensionContext) {
    if (delivering || state.debts.length > 0) return;
    const [next] = scanInbox(cwd, role);
    if (!next) return;
    delivering = true;
    try {
      ackCue(cwd, role, next.file);
      state.debts.push({
        from: next.env.from,
        ts: next.env.ts,
        preview: preview(next.env.message),
      });
      // an inbound cue resolves the sender's oldest outstanding await on us
      const n = state.awaiting[next.env.from] ?? 0;
      if (n <= 1) delete state.awaiting[next.env.from];
      else state.awaiting[next.env.from] = n - 1;
      persist();
      pi.sendMessage(
        {
          customType: "cue",
          display: true,
          content: `[cue from ${next.env.from}] ${next.env.message}`,
          details: next.env as unknown as Record<string, unknown>,
        },
        { triggerTurn: true, deliverAs: "followUp" },
      );
    } finally {
      delivering = false;
    }
    statusLine(ctx);
  }

  pi.registerTool({
    name: "cue",
    label: "Cue",
    description:
      `Pass the turn to another lab role (you are the ${role}). Initiating and resolving are the same call: ` +
      `cueing a role that awaits your cue resolves that exchange. Keep the message short; durable content ` +
      `belongs in files (cue the path). End your response right after cueing.`,
    parameters: Type.Object({
      target: Type.Union(
        ROLES.filter((r) => r !== role).map((r) => Type.Literal(r)),
      ),
      message: Type.String({ description: "Short pointer or question; not a document." }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const env = sendCue(cwd, role, params.target, params.message);
      state.awaiting[params.target] = (state.awaiting[params.target] ?? 0) + 1;
      // FIFO resolution: this cue answers the oldest open debt from target
      const i = state.debts.findIndex((d) => d.from === params.target);
      const resolved = i >= 0;
      if (resolved) state.debts.splice(i, 1);
      persist();
      statusLine(ctx);
      if (state.debts.length === 0) setTimeout(() => tryDeliver(ctx), 0);
      return {
        content: [
          {
            type: "text",
            text: resolved
              ? `cue sent to ${params.target}; this resolves their open cue. awaiting their next cue.`
              : `cue sent to ${params.target}; awaiting their cue.`,
          },
        ],
        details: env as unknown as Record<string, unknown>,
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    ensureDirs(cwd, ROLES as unknown as string[]);
    state = loadState(cwd, role);
    watcher?.close();
    let timer: NodeJS.Timeout | undefined;
    watcher = fs.watch(inboxDir(cwd, role), () => {
      clearTimeout(timer);
      timer = setTimeout(() => tryDeliver(ctx), 150);
    });
    tryDeliver(ctx);
    statusLine(ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    tryDeliver(ctx);
    statusLine(ctx);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    tryDeliver(ctx);
    statusLine(ctx);
  });

  // Reminder line: transient system-prompt append, zero transcript spam.
  pi.on("before_agent_start", async (event, _ctx) => {
    const lines: string[] = [];
    const aw = Object.entries(state.awaiting).filter(([, n]) => n > 0);
    if (aw.length)
      lines.push(`awaiting cue from: ${aw.map(([r, n]) => (n > 1 ? `${r} x${n}` : r)).join(", ")}`);
    for (const d of state.debts)
      lines.push(`${d.from} awaits your cue -- "${d.preview}" (${ago(d.ts)} ago)`);
    if (!lines.length) return;
    return { systemPrompt: `${event.systemPrompt}\n\n## Cues\n${lines.join("\n")}` };
  });

  pi.on("session_shutdown", async () => {
    watcher?.close();
  });
}
