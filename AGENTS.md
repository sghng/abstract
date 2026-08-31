# abstract

This repository is a pi agent directory: it defines a small academic research
lab made of long-running pi agents (orchestrator, engineer, librarian) that
communicate through files. This file is for agents developing this repository.
The shared invariants of the lab agents live in `motif.md`, not here.

## Repository Layout

- `motif.md` -- invariants injected into every lab agent session: project
  layout, naming rules, team roster, protocol summary
- `agents/` -- role system prompts, one per lab role, consumed by the CLI
- `src/cli.ts` -- the `abstract` SDK harness CLI (Bun, linked via `package.json`
  bin). Creates/reattaches the tmux ensemble (three panes, session
  `abs-<project-basename>`) and runs each role as a peer pi SDK process:
  agentDir = this repo, session pinned at `<project>/.pi/sessions/<role>.jsonl`,
  `HARNESS_ROLE` set, `motif.md` plus the role prompt appended as file paths,
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

- **Naming follows a musical theme** (`motif.md`, orchestrator, ...). Prefer
  music-inspired names for new harness components.
- **`motif.md` holds invariants only.** Membership test: if the lab agents
  forgot it, would the failure be silent and costly? Procedures and templates
  belong in skills.
- **Skills**: pi frontmatter (`name`, trigger-style `description`), one
  directory per skill, self-contained (re-enterable cold after compaction).
- **Commits**: conventional commits. Record architectural decisions in
  `TODO.md`'s decisions log.

## Instructions for Writing Prompts

- ASCII only. No emoji, no non-ASCII punctuation: write em-dashes as `--`,
  arrows as `-->`.
- **Economy**: instruct only where the prior is wrong; delete if deletion
  breaks nothing.
- **Density**: one token should carry a framework. Pick the word most unique
  in embedding space whose meaning is exact -- "obviate", not "make
  unnecessary"; "Hemingway", not "short declarative sentences without
  ornament". Where no such word exists, coin one ("nodding reader") and
  reuse it. Coin only for concepts that recur.
- **State once**: the context is assembled; give each fact one home, chosen
  by audience. A shared layer exists so peers know what an agent can do for
  them and what they can ask of it (the roster in motif.md). Implementation
  details belong only in that agent's own prompt -- peers never need them.
- **Positive imperatives**: state what to do; cut hedges; prefer a positive
  rule over a negated one.
- **Recursion**: prompt writing is iterative. A line is finished not when
  nothing can be added, but when nothing can be deleted or said better.
