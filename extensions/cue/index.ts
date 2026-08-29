/**
 * Cue -- brokerless message exchange between lab roles.
 *
 * Design: docs/multi-agent.md. Implementation plan: docs/harness.md.
 * Loaded into every lab session from the agent dir; self-configures from
 * HARNESS_ROLE (set by bin/<role>). No-op in non-lab sessions.
 *
 * Current mode: fire-and-forget. The previous state machine (awaiting/debts,
 * one-cue-at-a-time, reminders, status line) is disabled while we see whether
 * agents can self-manage turn-taking with human oversight. See the
 * DISABLED_STATE_MACHINE block at the end of this file for the tracked version.
 */
import * as fs from "node:fs";
import { Type } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  ackCue,
  ensureDirs,
  inboxDir,
  scanInbox,
  sendCue,
} from "./core.ts";

const ROLES = ["orchestrator", "engineer", "librarian"] as const;
type Role = (typeof ROLES)[number];

export default function(pi: ExtensionAPI) {
  const roleRaw = process.env.HARNESS_ROLE;
  if (!roleRaw || !(ROLES as readonly string[]).includes(roleRaw)) return;
  const role = roleRaw as Role;

  let cwd = process.cwd();
  let watcher: fs.FSWatcher | undefined;
  let delivering = false;

  /** Deliver every pending cue in the inbox as a follow-up. */
  function tryDeliver(ctx: ExtensionContext) {
    if (delivering) return;
    delivering = true;
    try {
      for (const { file, env } of scanInbox(cwd, role)) {
        ackCue(cwd, role, file);
        pi.sendMessage(
          {
            customType: "cue",
            display: true,
            content:
              `[cue from ${env.from}] ${env.message}\n\n` +
              `If ${env.from} would benefit from a reply, ` +
              `do so via cue(target="${env.from}", message="...").`,
            details: env as unknown as Record<string, unknown>,
          },
          { triggerTurn: true, deliverAs: "followUp" },
        );
      }
    } finally {
      delivering = false;
    }
  }

  pi.registerTool({
    name: "cue",
    label: "Cue",
    description:
      `Send a short message (cue) to another role.` +
      `Any role can cue any role except itself.`,
    parameters: Type.Object({
      target: Type.Union(
        ROLES.filter((r) => r !== role).map((r) => Type.Literal(r)),
      ),
      message: Type.String({ description: "Short pointer or question; not a document." }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const env = sendCue(cwd, role, params.target, params.message);
      setTimeout(() => tryDeliver(ctx), 0);
      return {
        content: [
          { type: "text", text: `cue sent to ${params.target}:\n\n${params.message}` },
        ],
        details: env as unknown as Record<string, unknown>,
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
    ensureDirs(cwd, ROLES as unknown as string[]);
    watcher?.close();
    let timer: NodeJS.Timeout | undefined;
    watcher = fs.watch(inboxDir(cwd, role), () => {
      clearTimeout(timer);
      timer = setTimeout(() => tryDeliver(ctx), 150);
    });
    tryDeliver(ctx);
  });

  pi.on("turn_end", async (_event, ctx) => {
    tryDeliver(ctx);
  });

  pi.on("agent_settled", async (_event, ctx) => {
    tryDeliver(ctx);
  });

  pi.on("session_shutdown", async () => {
    watcher?.close();
  });
}

/* DISABLED_STATE_MACHINE: state-tracked cue exchange.
   This version enforced one-inbound-cue-at-a-time, tracked awaiting/debt counts,
   and injected reminders/status lines. Disabled while we run agents without
   harness-level turn enforcement and observe whether human oversight is enough.
   Re-enable by replacing the active implementation above with this block.

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

function stateMachineExtension(pi: ExtensionAPI) {
  ...
}
*/
