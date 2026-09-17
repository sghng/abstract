/**
 * The score: which movements each role's prompt assembles, in order.
 *
 * A movement is a Markdown file in `movement/` (referenced here by stem, no
 * extension). The score lists them general --> specific: shared doctrine
 * first, role-specific deviation last. The harness plugin (lab/plugin)
 * appends them to the system prompt per model request, re-reading each file
 * from disk, so edits go live on the next turn.
 *
 * The kernel (lab invariants + delegation doctrine) is NOT listed here: it
 * lives in lab/AGENTS.md and is loaded natively into every session.
 *
 * Placement rule: a movement is always-on (listed here) iff it is needed in
 * most turns of the role, or forgetting it is silent and costly. Everything
 * else stays on-demand as a skill. Doctrine graduates per role: a single-
 * function role (writer, editor) inlines what it always needs; skills keep
 * episodic, task-matched procedures.
 */
export const SCORE = {
  orchestrator: ["story-doctrine", "story-keeping", "orchestrator"],
  engineer: ["engineer"],
  librarian: ["librarian"],
  writer: ["prose-standard", "story-doctrine", "writing-craft", "writer"],
  editor: ["prose-standard", "editor"],
} as const;

export type Role = keyof typeof SCORE;

export const ROLES = Object.keys(SCORE) as Role[];
