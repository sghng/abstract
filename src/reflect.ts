/**
 * reflection -- the /reflect command and its batch driver.
 *
 * The owner types /reflect in the orchestrator session (anywhere else is
 * refused). The driver snapshots the doctrine directories, forks every live
 * role session at its tip for an INDEPENDENT reflection over its own
 * transcript (phase 1, concurrent), diffs the doctrine, then forks the
 * orchestrator for a curator pass that RECOMMENDS but does not amend
 * (phase 2). The report is written to the lab state dir and delivered to
 * the live orchestrator session via a steer synthetic, so the orchestrator
 * presents the proposals and the owner ratifies. The /reflect invocation is
 * the owner's direct order; the review gate is the diff plus ratification,
 * so forks edit directly but only what they are confident about.
 *
 * Isolation is mechanical, not instructed: forks are never cue peers (the
 * no-fork-lineage invariant in the cue tool and in roleSessions), so a
 * reflection fork cannot cue out and nothing can cue in.
 *
 * Design doc: docs/reflection.md. Lives in src/ (not config/plugin/):
 * every file in the plugin directory must be a plugin with a default
 * export, and this module is a helper imported by harness.ts.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { ROLES, type Role } from "./binder.ts";

const REFLECTIONS_DIR = path.join(
  homedir(),
  ".local",
  "share",
  "abstract",
  "reflections",
);
const FORK_TIMEOUT_MS = 15 * 60_000;
const CURATOR_TIMEOUT_MS = 20 * 60_000;
const SUMMARY_MAX = 4096;
const DIFF_MAX = 60 * 1024;

/** One batch at a time, server-wide. */
let activeBatch: string | null = null;

type Deps = {
  client: () => any;
  promptsDir: string;
  referenceDir: string;
};

export function reflectCommand(deps: Deps): {
  name: string;
  description: string;
  execute: (input: { sessionID: string }) => Promise<void>;
} {
  return {
    name: "reflect",
    description:
      "Run a reflection batch: fork each role session for an independent " +
      "reflection over its transcript, then a curator pass. The report " +
      "lands in this session for you to present to the user. Orchestrator " +
      "session only.",
    execute: async ({ sessionID }) => {
      const api = deps.client();
      const say = (text: string) =>
        api.session.synthetic({
          sessionID,
          text,
          description: "reflect",
          metadata: { reflect: true },
          delivery: "steer",
        });
      const session = await api.session.get({ sessionID });
      if (session.metadata?.role !== "orchestrator") {
        await say("/reflect runs only in the orchestrator session.");
        return;
      }
      if (activeBatch) {
        await say(
          `reflection batch ${activeBatch} is still running; wait for its report.`,
        );
        return;
      }
      const directory = session.location.directory;
      const listed = await api.session.list({ directory });
      // Live role sessions only: top level, no fork lineage (the invariant).
      const live = new Map<Role, any>();
      for (const s of listed.data) {
        if (s.parentID !== undefined || s.fork) continue;
        const r = s.metadata?.role;
        if ((ROLES as readonly string[]).includes(r)) live.set(r as Role, s);
      }
      if (!live.size) {
        await say(
          "no role sessions in this project; run `abstract` there first.",
        );
        return;
      }
      const batchId = nextBatchId();
      activeBatch = batchId;
      const phase1 = ROLES.filter((r) => r !== "orchestrator" && live.has(r));
      await say(
        `reflection batch ${batchId} started: forking ${phase1.join(", ")}; ` +
          `the curator pass follows. The report lands in this session.`,
      );
      runBatch(api, deps, batchId, directory, live, sessionID)
        .catch(async (e) => {
          await say(
            `reflection batch ${batchId} failed: ${e instanceof Error ? e.message : String(e)}`,
          ).catch(() => {});
        })
        .finally(() => {
          activeBatch = null;
        });
    },
  };
}

function nextBatchId(): string {
  let max = 0;
  try {
    for (const f of fs.readdirSync(REFLECTIONS_DIR)) {
      const m = f.match(/^reflect-(\d+)\.md$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch {}
  return String(max + 1).padStart(3, "0");
}

/* -- the batch ------------------------------------------------------------ */

type Outcome = { status: string; text: string };

async function runBatch(
  api: any,
  deps: Deps,
  batchId: string,
  directory: string,
  live: Map<Role, any>,
  orchestratorSessionID: string,
): Promise<void> {
  const started = new Date().toISOString();
  const before = snapshot(deps, batchId);

  // phase 1: independent reflections, concurrently
  const roles = ROLES.filter((r) => r !== "orchestrator" && live.has(r));
  const settled = await Promise.allSettled(
    roles.map((role) =>
      reflectRole(
        api,
        role,
        live.get(role)!,
        batchId,
        roleBrief(role, batchId),
      ),
    ),
  );
  const summaries: Record<string, Outcome> = {};
  settled.forEach((r, i) => {
    summaries[roles[i]] =
      r.status === "fulfilled"
        ? r.value
        : { status: "error", text: String(r.reason) };
  });

  const diff = await doctrineDiff(deps, before);

  // phase 2: the curator pass (recommends, does not amend)
  const orchestrator = live.get("orchestrator");
  const curator: Outcome = orchestrator
    ? await reflectRole(
        api,
        "orchestrator",
        orchestrator,
        batchId,
        curatorBrief(batchId, summaries, diff),
        CURATOR_TIMEOUT_MS,
      )
    : { status: "skipped (no live orchestrator session)", text: "" };

  const finished = new Date().toISOString();
  fs.mkdirSync(REFLECTIONS_DIR, { recursive: true });
  const reportPath = path.join(REFLECTIONS_DIR, `reflect-${batchId}.md`);
  fs.writeFileSync(
    reportPath,
    renderReport(
      batchId,
      directory,
      started,
      finished,
      summaries,
      curator,
      diff,
    ),
  );
  fs.rmSync(before, { recursive: true, force: true });

  const changedFiles = (diff.match(/^diff -ruN /gm) ?? []).length;
  const outcomes = [
    ...Object.entries(summaries),
    ["orchestrator", curator] as const,
  ]
    .map(([r, o]) => `${r} ${o.status}`)
    .join(", ");
  await api.session.synthetic({
    sessionID: orchestratorSessionID,
    delivery: "steer",
    description: `reflection batch ${batchId} complete`,
    metadata: { reflection: batchId },
    text:
      `[reflection batch ${batchId} complete] ` +
      `${changedFiles} doctrine file(s) changed; outcomes: ${outcomes}. ` +
      `Full report: ${reportPath}\n\n` +
      `Read the report, review the uncommitted doctrine diff, and present ` +
      `the proposals to the user for ratification. The user decides what ` +
      `stays; you have curator scope to apply their verdicts.`,
  });
}

/** Fork one role session, run the brief, harvest the closing summary. */
async function reflectRole(
  api: any,
  role: Role,
  session: any,
  batchId: string,
  brief: string,
  timeoutMs = FORK_TIMEOUT_MS,
): Promise<Outcome> {
  const msgs = await api.message.list({
    sessionID: session.id,
    order: "desc",
    limit: 1,
  });
  const last = msgs.data?.[0];
  if (!last) return { status: "skipped (no transcript)", text: "" };
  const fork = await api.session.fork({
    sessionID: session.id,
    before: last.id,
  });
  const forkID: string = fork.id ?? fork.data?.id;
  try {
    await api.session.update({
      sessionID: forkID,
      title: `reflect-${role}-${batchId}`,
      metadata: { ...(fork.metadata ?? {}), reflection: batchId },
    });
  } catch {}
  try {
    await api.session.background({ sessionID: forkID });
  } catch {}
  await api.session.prompt({
    sessionID: forkID,
    text: brief,
    delivery: "queue",
  });
  const outcome = await waitWithTimeout(api, forkID, timeoutMs);
  if (outcome === "timeout") {
    try {
      await api.session.interrupt({ sessionID: forkID });
    } catch {}
  }
  return { status: outcome, text: await lastAssistantText(api, forkID) };
}

function waitWithTimeout(
  api: any,
  sessionID: string,
  ms: number,
): Promise<"ok" | "timeout" | "error"> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve("timeout"), ms);
    api.session.wait({ sessionID }).then(
      () => {
        clearTimeout(t);
        resolve("ok");
      },
      () => {
        clearTimeout(t);
        resolve("error");
      },
    );
  });
}

async function lastAssistantText(api: any, sessionID: string): Promise<string> {
  const msgs = await api.message.list({
    sessionID,
    order: "desc",
    limit: 5,
    type: "assistant",
  });
  for (const m of msgs.data ?? []) {
    const text = messageText(m).trim();
    if (text) return text.slice(0, SUMMARY_MAX);
  }
  return "(no assistant reply harvested)";
}

function messageText(m: any): string {
  if (typeof m.text === "string") return m.text;
  const parts = Array.isArray(m.content)
    ? m.content
    : Array.isArray(m.parts)
      ? m.parts
      : [];
  return parts
    .filter((p: any) => p?.type === "text" && typeof p.text === "string")
    .map((p: any) => p.text)
    .join("\n");
}

/* -- snapshot and diff ------------------------------------------------------ */

function snapshot(deps: Deps, batchId: string): string {
  const base = path.join(REFLECTIONS_DIR, ".work", batchId);
  const keep = (src: string) =>
    !src.endsWith(".docx") && !src.endsWith(".DS_Store");
  fs.rmSync(base, { recursive: true, force: true });
  fs.cpSync(deps.promptsDir, path.join(base, "prompts"), {
    recursive: true,
    filter: keep,
  });
  fs.cpSync(deps.referenceDir, path.join(base, "reference"), {
    recursive: true,
    filter: keep,
  });
  return base;
}

function diffTree(beforeDir: string, afterDir: string): Promise<string> {
  return new Promise((resolve) => {
    // diff exits 1 when files differ; that is the expected case, not an error.
    execFile(
      "diff",
      ["-ruN", beforeDir, afterDir],
      { maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err && typeof err.code === "number" && err.code > 1)
          return resolve(`(diff failed: ${err.message})`);
        resolve(stdout);
      },
    );
  });
}

async function doctrineDiff(deps: Deps, before: string): Promise<string> {
  const raw =
    (await diffTree(path.join(before, "prompts"), deps.promptsDir)) +
    (await diffTree(path.join(before, "reference"), deps.referenceDir));
  if (!raw.trim()) return "";
  return raw.length > DIFF_MAX
    ? raw.slice(0, DIFF_MAX) + `\n\n(diff truncated at ${DIFF_MAX} bytes)`
    : raw;
}

/* -- report ----------------------------------------------------------------- */

function renderReport(
  batchId: string,
  directory: string,
  started: string,
  finished: string,
  summaries: Record<string, Outcome>,
  curator: Outcome,
  diff: string,
): string {
  const sections = Object.entries(summaries).map(
    ([role, o]) => `## ${role} (${o.status})\n\n${o.text || "(no summary)"}`,
  );
  return [
    `# Reflection batch ${batchId}`,
    "",
    `project: ${directory}`,
    `started: ${started}`,
    `finished: ${finished}`,
    "",
    ...sections,
    "",
    `## curator review (orchestrator fork, ${curator.status})`,
    "",
    curator.text || "(no summary)",
    "",
    "## doctrine diff",
    "",
    diff ? "```diff\n" + diff + "\n```" : "no changes",
    "",
  ].join("\n");
}

/* -- briefs ----------------------------------------------------------------- */

function roleBrief(role: Role, batchId: string): string {
  return (
    `[reflection batch ${batchId}] You are a fork of the ${role} session, ` +
    `spun up for a reflection pass. The live lab runs without you. The ` +
    `owner's /reflect command is your direct order; the review gate is the ` +
    `diff afterward, so edit directly, but only what you are confident about.\n\n` +
    `Reflect on your recent work in this transcript: what recurred, what ` +
    `failed, what was harder than it should have been, which instructions ` +
    `you worked around, forgot, or found missing.\n\n` +
    `You may edit only: your binder's prompt files (named in the binder ` +
    `footer above), your own entry in prompts/binder.yaml, files in the ` +
    `reference directory. Nothing else: no project files (notes/, draft/, ` +
    `src/, experiments/, model/, data/), no experiments, no tickets or ` +
    `memos. cue is unavailable in this session.\n\n` +
    `Close with exactly these sections, at most 5 lines each:\n` +
    `CHANGED: each edit and its reason, one line per edit\n` +
    `CONSIDERED: what you rejected and why\n` +
    `CURATOR: what needs the orchestrator's judgment (shared prompts, ` +
    `cross-role doctrine, anything you were not confident enough to edit)`
  );
}

function curatorBrief(
  batchId: string,
  summaries: Record<string, Outcome>,
  diff: string,
): string {
  const summaryBlock = Object.entries(summaries)
    .map(([role, o]) => `--- ${role} (${o.status}) ---\n${o.text || "(none)"}`)
    .join("\n\n");
  return (
    `[reflection batch ${batchId}] You are a fork of the orchestrator ` +
    `session, spun up for the curator pass of a reflection batch. The live ` +
    `lab runs without you. The owner's /reflect command is your direct ` +
    `order; the review gate is the owner's ratification afterward.\n\n` +
    `First, reflect on your own recent work as any role would: what ` +
    `recurred, what failed, which instructions you worked around, forgot, ` +
    `or found missing. You may edit only your own binder's prompt files ` +
    `(named in the binder footer above), entries in prompts/binder.yaml, ` +
    `and files in the reference directory. Nothing else: no project files, ` +
    `no experiments, no tickets or memos. cue is unavailable in this session.\n\n` +
    `Then review the batch. The role forks reflected independently; their ` +
    `closing summaries and the resulting doctrine diff follow. You are the ` +
    `doctrine's curator, but in this pass you recommend, you do not decide: ` +
    `the owner ratifies. Do not edit anything on another role's behalf in ` +
    `this pass.\n\n` +
    `Close with exactly these sections:\n` +
    `OWN: your CHANGED and CONSIDERED items, one line each\n` +
    `REVIEW: one line per role edit in the diff (ratify | amend | revert, ` +
    `with a reason)\n` +
    `CURATOR CALLS: your recommendation on each CURATOR item from the role ` +
    `summaries\n` +
    `CONFLICTS: cross-role tensions you found, or none\n\n` +
    `=== ROLE SUMMARIES ===\n\n${summaryBlock}\n\n` +
    `=== DOCTRINE DIFF ===\n\n${diff || "(no doctrine changes)"}`
  );
}
