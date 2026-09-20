# abstract

This repository is an OpenCode v2 agent directory: it defines a small academic
research lab (orchestrator, engineer, statistician, librarian, writer, editor)
running as persistent sessions on a lab-owned OpenCode server. This file is for
agents developing this repository. The lab agents' shared invariants live in
`config/AGENTS.md`, not here.

## Repository Layout

- `config/` -- the lab's OpenCode config root (`OPENCODE_CONFIG_DIR`): the
  kernel `AGENTS.md` (invariants + delegation, auto-loaded into every session),
  `agents/` (the six role personas at top level; `agents/subagents/` holds the
  named subagent catalog and reviewer panel, whose IDs carry the `subagents/`
  prefix), `plugin/harness.ts` (the lab plugin: score assembly, cue,
  repertoire), `opencode.json` (default model, MCP servers, the `lab-reference`
  reference alias), `skills/` (the lab's skills, a real directory), and
  `runtime.json` (the pinned `@opencode/cli` version)
- `prompts/` -- the prompt files (Markdown, one file each, descriptive names):
  shared doctrine (`style-guide.md`, `story-doctrine.md`), role doctrine
  (`story-keeping.md`, `writing-craft.md`), and one file per score-assembled
  role. Referenced by stem from the score; only file contents enter the context,
  so names are dev-facing. Transitional: the statistician's doctrine lives in
  its agent body, and the directory's retirement is tracked in `TODO.md`
- `src/score.ts` -- the score: which prompt files each role assembles, in order
  (general --> specific), plus `ROLES`, the full roster the CLI, doctor, and tab
  seeding iterate. The plugin appends score stems to the system prompt per model
  request, re-reading from disk; a role absent from the score (the statistician)
  carries its doctrine in its agent body
- `src/cli.ts` -- the `abstract` CLI (Bun, linked via `package.json` bin):
  ensures the pinned runtime at `~/.local/share/abstract/runtime/`, the central
  lab server (port 4319, own config/state/DB under `~/.local/share/abstract` and
  `~/.local/state/abstract`, credentials synced from the daily install), and the
  six role sessions per project (`metadata.role`, created once); then attaches
  one TUI (`--server`, `--session`). Also `abstract context [role] [--json]`
  (print what each agent receives: context pieces, skills, subagents, tools),
  `abstract doctor` (contract smoke test), `abstract stop`,
  `abstract upgrade [v]`
- `reference/` -- reference material agents read on request; reaches agents as
  the `lab-reference` alias (OpenCode references feature, described in
  `config/opencode.json`)
- `repertoire/` -- the writer's convention corpus: pipeline scripts (`src/`
  journal-agnostic stages + `src/families/<j>/` fetchers) that turn journal
  articles (six families: psychometrika, jem, jebs, bjmsp, psyarxiv, arxiv stat)
  into raw PDF/HTML/XML/TeX + Markdown/asset stores on Cloudflare R2, a
  Vectorize index, and D1 papers/sources as source of truth; `legacy/` holds the
  parked ML stages. Served to sessions as the `repertoire` tool by the lab
  plugin. See `docs/repertoire/` (the corpus manual)
- `docs/` -- design documents, dev-facing, not loaded by lab agents.
  `docs/multi-agent.md` and `docs/harness.md` describe the RETIRED pi-era
  harness (fs inbox, tmux ensemble); keep for history
- `TODO.md` -- design rationale, roadmap, and decisions log; read before
  changing the architecture
- `manifesto.md` -- human-facing philosophy behind the project

## Working Conventions

- **Naming**: nuanced, unusual names are for tokens that live in the agents'
  context and need markedness against generic prose. File and directory names
  are dev-facing and stay descriptive, since only contents enter the context.
  Musical names (`score`, `cue`, `repertoire`) apply exactly when the token will
  appear in an agent's context, including tool names.
- **The kernel holds invariants only** (`config/AGENTS.md`). Membership test: if
  the lab agents forgot it, would the failure be silent and costly? Episodic
  procedures and templates belong in skills.
- **Ground truth is the pinned published binary** (`@opencode/cli` at the
  version in `config/runtime.json`), not any source checkout, which may lag.
  Contract surfaces are enforced by `abstract doctor`, not by reading source.
- **Upgrades are deliberate**: `abstract upgrade <version>`, then `npm diff`
  plus release notes for new features to adopt, then `abstract doctor`; bump the
  pin only when doctor passes. The user's daily install is never touched.
- **Commits**: conventional commits. Record architectural decisions in
  `TODO.md`'s decisions log.

## Instructions for Writing Prompts

- ASCII only. No emoji, no non-ASCII punctuation; arrows as `-->`.
- **No dashes as punctuation**: no em dashes and no `--` anywhere in
  agent-facing prose, any form; the pattern in context shifts generation.
  Rewrite the sentence (split it, use a comma or parentheses). CLI flags and
  markdown table separators are syntax, not prose, and stay.
- **Deliverable prose bans colons, semicolons, and dashes** in running text (see
  `prompts/style-guide.md`); prompt lists may still use colons after bold
  labels.
- **Empiricism**: the goal is not a prompt that looks right; it is finding out
  what is truly needed. Start minimal and observe the agents. A rule earns its
  place when its absence produces a failure. If a line can be deleted and
  behavior does not change, it stays deleted; git remembers, so deletion is
  cheap and reversible.
- **Economy**: instruct only where the prior is wrong; delete if deletion breaks
  nothing.
- **State once**: the context is assembled; give each fact one home, chosen by
  audience. The kernel (config/AGENTS.md) is the shared layer; role prompt files
  carry only that role's deviation.
- **Positive imperatives**: state what to do; cut hedges; prefer a positive rule
  over a negated one.
- **Recursion**: prompt writing is iterative. A line is finished not when
  nothing can be added, but when nothing can be deleted.
- **Post-surgery checklist**: after moving or graduating prompt content, grep
  the descriptions, sibling files, and dev docs for the old names; residue is
  the expected failure mode of every graduation round.
