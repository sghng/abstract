/**
 * The binders: which prompt files each role always carries, in order.
 *
 * Every player in the lab has a binder. A prompt file is a Markdown file in
 * `prompts/` (referenced here by stem, no extension), and a role's binder lists
 * its prompts general --> specific: shared doctrine first, role-specific
 * deviation last. Two roles share a prompt by listing the same stem, so the
 * text itself has exactly one home. The harness plugin (config/plugin)
 * assembles the binder into the system prompt per model request, re-reading
 * each file from disk, so edits go live on the next turn.
 *
 * Why here and not in the agent bodies (`config/agents/<role>.md`): the body is
 * the agent's `system` field, which rides in the cached request prefix
 * (session/runner/llm.ts: `system: [agent.info?.system, epoch.baseline]`), so
 * editing it invalidates the prompt cache, and a shared prompt would have to be
 * copied into two bodies. Agent files therefore hold registry config only.
 *
 * The kernel (lab invariants + delegation doctrine) is NOT listed here: it
 * lives in config/AGENTS.md and is loaded natively into every session. Its
 * absence from every binder is also what keeps it out of role scope: a role
 * may amend its own prompt files (the kernel's self-amendment rule), and
 * ordinary scope is exactly BINDERS. The one exception is the orchestrator,
 * the doctrine's curator, whose scope is every prompt file plus the kernel
 * itself.
 *
 * The binder footer (binderFooter below) is the context piece that tells a
 * role which prompt files are its to amend, so the self-amendment rule has
 * something concrete to point at. It is assembled from BINDERS, never
 * hand-maintained: a binder change rewrites the footer, and a shared prompt
 * names its co-carriers, since an edit to one lands in a peer's context on
 * the peer's next turn. The orchestrator's footer instead names every
 * prompt file with its carriers, plus the kernel's path.
 *
 * Placement rule: a prompt is listed here iff it is needed in most turns of the
 * role, or forgetting it is silent and costly. Everything else stays on-demand
 * as a skill. Doctrine graduates per role: a single-function role inlines what
 * it always needs; skills keep episodic, task-matched procedures.
 */
import * as path from "node:path";

export const BINDERS: Partial<Record<Role, readonly string[]>> = {
  orchestrator: ["story-doctrine", "story-keeping", "orchestrator"],
  engineer: ["engineer"],
  statistician: ["statistician"],
  librarian: ["librarian"],
  writer: ["style-guide", "story-doctrine", "writing-craft", "writer"],
  editor: ["style-guide", "editor"],
};

/**
 * Every role the lab runs: each gets a session, a TUI tab, and a doctor check.
 */
export const ROLES = [
  "orchestrator",
  "engineer",
  "statistician",
  "librarian",
  "writer",
  "editor",
] as const;

export type Role = (typeof ROLES)[number];

const REPO = path.resolve(import.meta.dir, "..");
const PROMPTS_DIR = path.join(REPO, "prompts");
const KERNEL = path.join(REPO, "config", "AGENTS.md");

/**
 * The binder footer: one line of context naming the prompt files a role may
 * amend, appended after the prompts by the harness context hook. Each
 * prompt piece already carries its own path in an "Instructions from:"
 * header, so the footer's job is scope, not location: these stems are
 * yours to amend (the kernel arrives with the same header format but is in
 * no binder), and shared stems name their co-carriers, since an edit to
 * one lands in a peer's context on the peer's next turn. The orchestrator
 * is the doctrine's curator: its footer names every prompt file with its
 * carriers, plus the kernel's path. Agent-facing prose: ASCII, no dashes
 * as punctuation.
 */
export function binderFooter(role: Role): string | null {
  const stems = BINDERS[role];
  if (!stems?.length) return null;

  // stem --> every role carrying it, across all binders
  const carriers = new Map<string, Role[]>();
  for (const r of ROLES)
    for (const s of BINDERS[r] ?? [])
      carriers.set(s, [...(carriers.get(s) ?? []), r]);

  if (role === "orchestrator") {
    const list = [...carriers.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([s, rs]) => `${s}.md (${rs.join(", ")})`)
      .join(", ");
    return (
      `Every prompt file in ${PROMPTS_DIR} is yours to amend, as is the ` +
      `kernel at ${KERNEL}. Carriers: ${list}. ` +
      `The kernel's self-amendment rule governs any edit.`
    );
  }

  const list = stems
    .map((s) => {
      const others = carriers.get(s)!.filter((r) => r !== role);
      return others.length
        ? `${s}.md (also carried by ${others.join(", ")})`
        : `${s}.md`;
    })
    .join(", ");
  return (
    `Your binder's prompt files arrive in your context headed ` +
    `"Instructions from:" plus their path: ${list}. ` +
    `The kernel's self-amendment rule governs any edit to them.`
  );
}
