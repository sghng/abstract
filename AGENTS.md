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
  prefix), `plugin/harness.ts` (the lab plugin: binder assembly, cue,
  repertoire, tuning), `opencode.json` (default model, MCP servers, the
  `lab-reference` reference alias), and `skills/` (the lab's skills, a real
  directory)
- `lint/` -- `abstract lint`: the rule set (`rules.yaml`, lessons verbatim,
  distilled from the calibrated expert edits), the Typst extractor (`extract/`,
  a Rust sidecar on parser-level typst-syntax, pinned to the installed typst; it
  owns all dialect knowledge and emits the Block contract: text, line range, H1,
  role), `scan.ts` (the sidecar wrapper: lazy cargo build into the abstract
  home, stamped by a source hash, no fallback), the Jev client (`jev.ts`), the
  shared renderer (`format.ts`; one output for the CLI and the tuning tool), and
  the command (`cli.ts`; `-` lints one plain prose passage from stdin)
- `prompts/` -- the prompt files (Markdown, one file each, descriptive names):
  shared doctrine (`style-guide.md`, `story-doctrine.md`), role doctrine
  (`story-keeping.md`, `writing-craft.md`), and one file per role. Referenced by
  stem from each role's binder; only file contents enter the context, so names
  are dev-facing
- `src/binder.ts` -- the binders: which prompts each role always carries, in
  order (general --> specific), plus `ROLES`, the full roster the CLI, doctor,
  and tab seeding iterate. The plugin assembles the binder into the system
  prompt per model request, re-reading from disk; agent files hold registry
  config only
- `src/cli.ts` -- the `abstract` CLI (Bun, linked via `package.json` bin):
  ensures the pinned runtime at `~/.local/share/abstract/runtime/`, the central
  lab server (port 4319, own config/state/DB under `~/.local/share/abstract` and
  `~/.local/state/abstract`, credentials synced from the daily install), and the
  six role sessions per project (`metadata.role`, created once); then attaches
  one TUI (`--server`, `--session`). Also `abstract context [role] [--json]`
  (print what each agent receives: context pieces, skills, subagents, tools),
  `abstract typ2docx <file.typ>` (Typst to Word beside the source, through a
  house reference stock rebuilt fresh from the patch series; citeproc and native
  numbering; no server or model involved), `abstract doctor` (contract smoke
  test), `abstract stop`
- `reference/` -- reference material agents read on request; reaches agents as
  the `lab-reference` alias (OpenCode references feature, described in
  `config/opencode.json`)
- `tools/` -- builds the house reference doc (the pandoc reference doc styling
  every Word export) by applying the numbered `NN-*.patch` series in order to a
  pristine pandoc template export, one self-contained style concern per patch;
  fuzz=0 and a pandoc version pin make drift fail loudly, `--max-patch N`
  bisects the series (0 is the pristine export; partial builds write
  `reference/reference.debug.docx`); built docx artifacts are never committed:
  `abstract typ2docx` rebuilds a fresh stock into a private temp dir on every
  conversion, so the patch series is the single source of truth. Also
  `typ2docx.lua`, the typ2docx filter. The filter normalizes captured block/box
  fills and `highlight` mark regions onto pandoc's native mark handling, the
  default text highlight pen, and the writer pens every run inside a mark: text,
  OMML math, and the caption supplements it builds itself (a marked caption's
  "Table 9:" label lands inside the mark span). A marked region ending in a
  table hoists it out (the following paragraph regains its `FirstParagraph`
  margin). The filter also drops the reader's whitespace-only and anchor-only
  paragraph artifacts (comment lines and labels) and flattens a figure that
  wraps only a table
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
  Musical names (`binder`, `cue`, `repertoire`) apply exactly when the token
  will appear in an agent's context, including tool names.
- **The kernel holds invariants only** (`config/AGENTS.md`). Membership test: if
  the lab agents forgot it, would the failure be silent and costly? Episodic
  procedures and templates belong in skills.
- **Ground truth is the pinned published binary** (`@opencode/cli` at the
  version of the `@opencode/*` deps in `package.json`), not any source checkout,
  which may lag. Contract surfaces are enforced by `abstract doctor`, not by
  reading source.
- **Upgrades are deliberate**: bump the `@opencode/*` deps in `package.json`,
  `npm diff` plus release notes for new features to adopt, then `abstract stop`
  and `abstract doctor`; keep the bump only when doctor passes. The user's daily
  install is never touched.
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
