# abstract

The lab's doctrine and tooling as a config repo: a kernel, a skill library,
sidekick briefs, and the executables the skills invoke. OpenCode consumes the
repo through its own discovery mechanisms; there is no harness, no server, no
role sessions. This file is for agents developing this repository.

## Repository Layout

- `kernel.md` -- the always-on layer for research projects: layout
  invariants, the never-forget list, the delegation and review contracts.
  Mounted per project through the config's `instructions` array.
- `skills/` -- the skill library: research, writing, story-keeping,
  literature, experiments, word, repertoire, presentation, grants,
  journal-review, typst. One directory per skill: `SKILL.md` plus bundled
  `references/`, `scripts/`, `assets/` per the Agent Skills convention.
- `staging/` -- skills that have not earned graduation (lint). Never mounted.
- `agents/` -- the sidekick briefs as markdown agent files:
  reviewer-internal, reviewer-external, visual-review, literature-lookup,
  literature-review, nlpatch. Mounted per project as symlinks under
  `.opencode/agents/`.
- `opencode.template.jsonc` -- the project mount: instructions, skills, mcp.
  Deliberately no model pin; the session model is the user's choice.
- `src/cli.ts` -- the `abstract` CLI, init only: `abstract init <dir>`
  scaffolds a research project (config, agent symlinks, notes skeleton).
- `typ2docx/` -- the Typst-to-Word converter, invoked by the word skill;
  `tools/` holds the reference-stock patch series.
- `lint/` -- the style linter (Jev-judged rule set), experimental; driven
  through `staging/lint`.
- `repertoire/` -- the convention corpus pipeline plus the query path
  (`src/query.ts`) that the repertoire skill wraps. `docs/repertoire/` is the
  corpus manual.
- `hindsight.json` -- the hindsight memory plugin config (memory server URL
  plus bank id, no secrets); the plugin installs globally, and
  `HINDSIGHT_CONFIG` points here from the shell profile.
- `docs/` -- design docs and the manual (local VitePress only).
- `MEMORY.md` -- design rationale and the decision tail; read before changing
  the architecture.
- `manifesto.md` -- the philosophy behind the project.

## Working Conventions

- **Naming**: nuanced, unusual names are for tokens that live in agent
  context and need markedness against generic prose. File and directory names
  are dev-facing and stay descriptive, since only contents enter the context.
- **The kernel holds invariants only.** Membership test: if the agent forgot
  it, would the failure be silent and costly? Episodic procedures belong in
  skills; references and templates bundle inside the owning skill.
- **Propose first**: `kernel.md`, `skills/`, and `agents/` amend on the
  user's direct order, with the proposed text shown first. Never write the
  change and commit it in one step.
- **Commits**: conventional commits. A change and its documentation land in
  one commit. Architectural decisions go in `MEMORY.md`'s decision tail.

## Writing Agent-Facing Text

- ASCII only. No emoji, no non-ASCII punctuation; arrows as `-->`.
- **No dashes as punctuation**: no em dashes and no `--` anywhere in
  agent-facing prose, any form; the pattern in context shifts generation.
  CLI flags and markdown table separators are syntax, not prose, and stay.
- **Deliverable prose bans colons, semicolons, and dashes** in running text
  (see `skills/writing/SKILL.md`); skill lists may still use colons after
  bold labels.
- **Empiricism**: a rule earns its place when its absence produces a failure.
  If a line can be deleted and behavior does not change, it stays deleted;
  git remembers, so deletion is cheap and reversible.
- **Economy**: instruct only where the prior is wrong; delete if deletion
  breaks nothing.
- **State once**: each fact gets one home, chosen by audience. The kernel is
  the shared layer; a skill body carries only that skill's deviation.
- **Positive imperatives**: state what to do; cut hedges; prefer a positive
  rule over a negated one.
- **Recursion**: a line is finished not when nothing can be added, but when
  nothing can be deleted.
- **Post-surgery checklist**: after moving or renaming content, grep the
  descriptions, sibling files, and docs for the old names; residue is the
  expected failure mode of every reorganization.
