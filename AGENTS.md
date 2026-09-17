# abstract

This repository is an OpenCode v2 agent directory: it defines a small academic
research lab (orchestrator, engineer, librarian, writer, editor) running as
persistent sessions on a lab-owned OpenCode server. This file is for agents
developing this repository. The lab agents' shared invariants live in
`lab/AGENTS.md`, not here.

## Repository Layout

- `lab/` -- the lab's OpenCode config root (`OPENCODE_CONFIG_DIR`): the kernel
  `AGENTS.md` (invariants + delegation, auto-loaded into every session),
  `agents/` (five role personas plus the subagent catalog and reviewer panel,
  one Markdown file each), `plugin/harness.ts` (the lab plugin: score
  assembly, cue, repertoire), `opencode.json` (default model, MCP servers),
  `skills` (symlink to the repo's skills), and `runtime.json` (the pinned
  `@opencode/cli` version)
- `movement/` -- the prompt movements (Markdown, one file each, descriptive
  names): shared doctrine (`prose-standard.md`, `story-doctrine.md`), role
  doctrine (`story-keeping.md`, `writing-craft.md`), and one file per lab
  role. Referenced by stem from the score; only file contents enter the
  context, so names are dev-facing
- `src/score.ts` -- the score: which movements each role assembles, in order
  (general --> specific). The plugin appends them to the system prompt per
  model request, re-reading from disk
- `src/cli.ts` -- the `abstract` CLI (Bun, linked via `package.json` bin):
  ensures the pinned runtime at `~/.local/share/abstract/runtime/`, the
  central lab server (port 4319, own config/state/DB under
  `~/.local/share/abstract` and `~/.local/state/abstract`, credentials synced
  from the daily install), and the five role sessions per project
  (`metadata.role`, created once); then attaches one TUI
  (`--server`, `--session`). Also `abstract doctor` (contract smoke test),
  `abstract stop`, `abstract upgrade [v]`
- `skills/` -- OpenCode skills: procedures and standards, one directory per
  skill, self-contained (re-enterable cold after compaction)
- `reference/` -- reference material agents read on request; reaches agents
  via `HARNESS_DIR` (set on the server by `abstract`)
- `repertoire/` -- the writer's convention corpus: pipeline scripts
  (`src/` journal-agnostic stages + `src/families/<j>/` fetchers) that turn
  journal articles (six families: psychometrika, jem, jebs, bjmsp, psyarxiv,
  arxiv stat) into raw PDF/HTML/XML/TeX + Markdown/asset stores on Cloudflare
  R2, a Vectorize index, and D1 papers/sources as source of truth; `legacy/`
  holds the parked ML stages. Served to sessions as the `repertoire` tool by
  the lab plugin. See `docs/repertoire/` (the corpus manual)
- `docs/` -- design documents, dev-facing, not loaded by lab agents.
  `docs/multi-agent.md` and `docs/harness.md` describe the RETIRED pi-era
  harness (fs inbox, tmux ensemble); keep for history. Harness docs now live
  in MIGRATION.md until it is deleted at cleanup
- `TODO.md` -- design rationale, roadmap, and decisions log; read before
  changing the architecture
- `manifesto.md` -- human-facing philosophy behind the project
- `MIGRATION.md` -- the pi --> OpenCode v2 migration roadmap (temporary;
  deleted once the migration is fully landed)

## Working Conventions

- **Naming**: nuanced, unusual names are for tokens that live in the agents'
  context and need markedness against generic prose. File and directory names
  are dev-facing and stay descriptive, since only contents enter the context.
  Musical names (`movement`, `score`, `cue`, `repertoire`) apply exactly when
  the token will appear in an agent's context, including tool names.
- **The kernel holds invariants only** (`lab/AGENTS.md`). Membership test: if
  the lab agents forgot it, would the failure be silent and costly?
  Procedures and templates belong in skills.
- **Ground truth is the pinned published binary** (`@opencode/cli` at the
  version in `lab/runtime.json`), not any source checkout, which may lag.
  Contract surfaces are enforced by `abstract doctor`, not by reading source.
- **Upgrades are deliberate**: `abstract upgrade <version>`, then `npm diff`
  plus release notes for new features to adopt, then `abstract doctor`; bump
  the pin only when doctor passes. The user's daily install is never touched.
- **Commits**: conventional commits. Record architectural decisions in
  `TODO.md`'s decisions log.

## Instructions for Writing Prompts

- ASCII only. No emoji, no non-ASCII punctuation; arrows as `-->`.
- **No em-dashes**: an em dash in prompt prose is a smell, in any form, even
  `--`.
- **Empiricism**: the goal is not a prompt that looks right; it is finding out
  what is truly needed. Start minimal and observe the agents. A rule earns its
  place when its absence produces a failure. If a line can be deleted and
  behavior does not change, it stays deleted; git remembers, so deletion is
  cheap and reversible.
- **Economy**: instruct only where the prior is wrong; delete if deletion
  breaks nothing.
- **Density**: one token should carry a framework. Pick the word most unique in
  embedding space whose meaning is exact -- "obviate", not "make unnecessary";
  "Hemingway", not "short declarative sentences without ornament". Where no such
  word exists, coin one ("nodding reader") and reuse it. Coin only for concepts
  that recur.
- **State once**: the context is assembled; give each fact one home, chosen by
  audience. The kernel (lab/AGENTS.md) is the shared layer; role movements
  carry only that role's deviation.
- **Positive imperatives**: state what to do; cut hedges; prefer a positive rule
  over a negated one.
- **Recursion**: prompt writing is iterative. A line is finished not when
  nothing can be added, but when nothing can be deleted and no word made denser.
