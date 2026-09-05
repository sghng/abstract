# abstract

This repository is a pi agent directory: it defines a small academic research
lab made of long-running pi agents (orchestrator, engineer, librarian) that
communicate through files. This file is for agents developing this repository.
The shared invariants of the lab agents live in `movement/invariants.md`, not
here.

## Repository Layout

- `movement/` -- the prompt movements (Markdown, one file each, descriptive
  names): `invariants.md` for all roles, shared doctrine (`prose-standard.md`,
  `story-doctrine.md`), role doctrine (`story-keeping.md`, `writing-craft.md`),
  and one file per lab role. Referenced by stem from the score. Only file
  contents enter the context, so names are dev-facing and descriptive rather
  than musical
- `src/score.ts` -- the score: which movements each role's prompt assembles, in
  order (general --> specific). Always-on content lives here; on-demand
  procedures stay in skills
- `src/cli.ts` -- the `abstract` SDK harness CLI (Bun, linked via `package.json`
  bin). Creates/reattaches the tmux ensemble (two windows, session
  `abs-<project-basename>`) and runs each role as a peer pi SDK process:
  agentDir = this repo, session pinned at `<project>/.pi/sessions/<role>.jsonl`,
  `HARNESS_ROLE` set, the role's score movements appended as file paths,
  `noContextFiles: true`.
- `SYSTEM.md` -- replaces pi's default system prompt for lab agents (discovered
  natively from the agent dir)
- `extensions/` -- pi extensions, one directory per extension: `cue/`
  (brokerless message exchange, see `docs/harness.md`) and `mcp/` (internal
  adapter: registers tools we don't implement -- the implementation hides behind
  a server URL; the server list and per-role scoping are code in `servers.ts`,
  not config)
- `skills/` -- pi skills: procedures and standards, one directory per skill
- `TODO.md` -- design rationale, roadmap, and decisions log; read before
  changing the architecture
- `docs/` -- design documents for the harness (`multi-agent.md` for the
  message-exchange pattern, `harness.md` for the implementation plan);
  dev-facing, not loaded by lab agents
- `manifesto.md` -- human-facing philosophy behind the project
- `settings.json` -- pi settings for the agent directory

## Working Conventions

- **Naming**: nuanced, unusual names are for tokens that live in the agents'
  context and need markedness against generic prose. File and directory names
  are dev-facing and stay descriptive, since only contents enter the context.
  Where a standard term already carries the exact meaning (subagent), use it;
  coining fights the model's prior. Harness components keep their musical names
  (`movement`, `score`, `cue`).
- **`invariants.md` holds invariants only.** Membership test: if the lab agents
  forgot it, would the failure be silent and costly? Procedures and templates
  belong in skills.
- **Skills**: pi frontmatter (`name`, trigger-style `description`), one
  directory per skill, self-contained (re-enterable cold after compaction).
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
- **Economy**: instruct only where the prior is wrong; delete if deletion breaks
  nothing.
- **Density**: one token should carry a framework. Pick the word most unique in
  embedding space whose meaning is exact -- "obviate", not "make unnecessary";
  "Hemingway", not "short declarative sentences without ornament". Where no such
  word exists, coin one ("nodding reader") and reuse it. Coin only for concepts
  that recur.
- **State once**: the context is assembled; give each fact one home, chosen by
  audience. A shared layer exists so peers know what an agent can do for them
  and what they can ask of it (the roster in invariants.md). Implementation
  details belong only in that agent's own prompt -- peers never need them.
- **Positive imperatives**: state what to do; cut hedges; prefer a positive rule
  over a negated one.
- **Recursion**: prompt writing is iterative. A line is finished not when
  nothing can be added, but when nothing can be deleted and no word made denser.
