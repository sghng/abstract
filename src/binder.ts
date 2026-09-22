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
 * lives in config/AGENTS.md and is loaded natively into every session.
 *
 * Placement rule: a prompt is listed here iff it is needed in most turns of the
 * role, or forgetting it is silent and costly. Everything else stays on-demand
 * as a skill. Doctrine graduates per role: a single-function role inlines what
 * it always needs; skills keep episodic, task-matched procedures.
 */
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
