/**
 * The binders: which prompt files each role always carries, in order.
 *
 * Every player in the lab has a binder. A prompt file is a Markdown file in
 * `prompts/` (referenced by stem, no extension), and a role's binder lists
 * its prompts general --> specific: shared doctrine first, role-specific
 * deviation last. Two roles share a prompt by listing the same stem, so the
 * text itself has exactly one home. The mapping lives in
 * `prompts/binder.yaml` (the single source; this file holds the machinery),
 * and the harness plugin (config/plugin) re-reads both the mapping and the
 * prompt files from disk on every model request, so edits and binder surgery
 * go live on the next turn, no server restart.
 *
 * Why not the agent bodies (`config/agents/<role>.md`): the body is the
 * agent's `system` field, which rides in the cached request prefix
 * (session/runner/llm.ts: `system: [agent.info?.system, epoch.baseline]`), so
 * editing it invalidates the prompt cache, the registry does not reload
 * without a server restart, and a shared prompt would have to be copied into
 * two bodies. Agent files therefore hold registry config only.
 *
 * The kernel (lab invariants + delegation doctrine) is NOT listed in any
 * binder: it lives in config/AGENTS.md and is loaded natively into every
 * session. Its absence from every binder is also what keeps it out of role
 * scope: a role may amend its own prompt files and its own binder entry (the
 * kernel's self-amendment rule), and ordinary scope is exactly the role's
 * entry. The one exception is the orchestrator, the doctrine's curator, whose
 * scope is every prompt file, every binder entry, and the kernel itself.
 *
 * The binder footer (binderFooter below) is the context piece that tells a
 * role which prompt files are its to amend and where the mapping lives, so
 * the self-amendment rule has something concrete to point at. It is assembled
 * from the freshly read mapping, never hand-maintained: a binder change
 * rewrites the footer, and a shared prompt names its co-carriers, since an
 * edit to one lands in a peer's context on the peer's next turn. The
 * orchestrator's footer instead names every prompt file with its carriers,
 * plus the kernel's path.
 *
 * Placement rule: a prompt is listed iff it is needed in most turns of the
 * role, or forgetting it is silent and costly. Everything else stays on-demand
 * as a skill. Doctrine graduates per role: a single-function role inlines what
 * it always needs; skills keep episodic, task-matched procedures.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "yaml";

/**
 * Every role the lab runs: each gets a session and a TUI tab.
 * Structural (not agent-curated), so it stays code.
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

export type Binders = Record<Role, readonly string[]>;

const REPO = path.resolve(import.meta.dir, "..");
const PROMPTS_DIR = path.join(REPO, "prompts");
export const BINDER_FILE = path.join(PROMPTS_DIR, "binder.yaml");
const KERNEL = path.join(REPO, "config", "AGENTS.md");

/** Last good parse, served when the file is broken mid-edit. */
let lastGood: Binders | null = null;

/**
 * Read the binder mapping from prompts/binder.yaml. Called per model request
 * by the harness hook and statically by `abstract context`. Validation is
 * strict, because agents hand-edit the file: every role must be present,
 * unknown roles are rejected, each entry must be a list of stems, and every
 * stem must resolve to a prompt file (a missing prompt would otherwise be
 * skipped silently downstream). On any failure the last good parse is served
 * (an empty mapping if the file was already broken at server start) and the
 * error rides along for the caller to surface loudly.
 */
export function loadBinders(): { binders: Binders; error?: string } {
  try {
    const raw: unknown = parse(fs.readFileSync(BINDER_FILE, "utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      throw new Error("top level must be a mapping of role to stem list");
    const binders: Record<string, readonly string[]> = {};
    for (const [role, stems] of Object.entries(raw)) {
      if (!(ROLES as readonly string[]).includes(role))
        throw new Error(`unknown role "${role}"`);
      if (!Array.isArray(stems) || stems.some((s) => typeof s !== "string"))
        throw new Error(`"${role}" must be a list of prompt stems`);
      binders[role] = stems;
    }
    for (const role of ROLES)
      if (!(role in binders)) throw new Error(`missing entry for "${role}"`);
    for (const [role, stems] of Object.entries(binders))
      for (const stem of stems)
        if (!fs.existsSync(path.join(PROMPTS_DIR, `${stem}.md`)))
          throw new Error(
            `unresolved stem "${stem}" in "${role}" ` +
              `(no such file prompts/${stem}.md)`,
          );
    lastGood = binders as Binders;
    return { binders: lastGood };
  } catch (e) {
    return {
      binders: lastGood ?? ({} as Binders),
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * The binder footer: one context piece naming the prompt files a role may
 * amend and where the mapping lives, appended after the prompts by the
 * harness context hook. Each prompt piece already carries its own path in an
 * "Instructions from:" header, so the footer's job is scope, not location:
 * these stems are yours to amend (the kernel arrives with the same header
 * format but is in no binder), and shared stems name their co-carriers,
 * since an edit to one lands in a peer's context on the peer's next turn.
 * The orchestrator is the doctrine's curator: its footer names every prompt
 * file with its carriers, plus the kernel's path. Agent-facing prose: ASCII,
 * no dashes as punctuation.
 */
export function binderFooter(role: Role, binders: Binders): string | null {
  const stems = binders[role];
  if (!stems?.length) return null;

  // stem --> every role carrying it, across all binders
  const carriers = new Map<string, Role[]>();
  for (const r of ROLES)
    for (const s of binders[r] ?? [])
      carriers.set(s, [...(carriers.get(s) ?? []), r]);

  if (role === "orchestrator") {
    const list = [...carriers.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([s, rs]) => `${s}.md (${rs.join(", ")})`)
      .join(", ");
    return (
      `Every prompt file in ${PROMPTS_DIR} is yours to amend, as is the ` +
      `kernel at ${KERNEL}, and every entry in the binder mapping at ` +
      `${BINDER_FILE}. Carriers: ${list}. ` +
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
    `The kernel's self-amendment rule governs any edit to them. ` +
    `To add or remove a piece, edit your entry (never another role's) in ` +
    `${BINDER_FILE}; a new piece pairs a prompts/<stem>.md file ` +
    `(kebab-case, descriptive) with its stem in your list.`
  );
}
