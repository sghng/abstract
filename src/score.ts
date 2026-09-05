/**
 * The score: which movements each role's prompt assembles, in order.
 *
 * A movement is a Markdown file in `movement/` (referenced here by stem, no
 * extension). The score lists them general --> specific: lab invariants
 * (invariants) first, shared doctrine next, role-specific deviation last. The CLI
 * maps the score to file paths for `appendSystemPrompt`, re-read from disk
 * on every /reload.
 *
 * Placement rule: a movement is always-on (listed here) iff it is needed in
 * most turns of the role, or forgetting it is silent and costly. Everything
 * else stays on-demand as a skill. Doctrine graduates per role: a single-
 * function role (writer, editor) inlines what it always needs; skills keep
 * episodic, task-matched procedures.
 */
export const SCORE = {
  orchestrator: [
    "invariants",
    "delegation",
    "story-doctrine",
    "story-keeping",
    "orchestrator",
  ],
  engineer: ["invariants", "delegation", "engineer"],
  librarian: ["invariants", "delegation", "librarian"],
  writer: [
    "invariants",
    "delegation",
    "prose-standard",
    "story-doctrine",
    "writing-craft",
    "writer",
  ],
  editor: ["invariants", "delegation", "prose-standard", "editor"],
} as const;

export type Role = keyof typeof SCORE;

export const ROLES = Object.keys(SCORE) as Role[];
