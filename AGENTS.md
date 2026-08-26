# abstract

This repository is a pi agent directory: it defines a small academic
research lab made of long-running pi agents (orchestrator, engineer,
librarian) that communicate through files. This file is for agents
developing this repository. The shared invariants of the lab agents live in
`motif.md`, not here.

## Repository Layout

- `motif.md` -- invariants injected into every lab agent session: project
  layout, naming rules, team roster, protocol summary
- `agents/` -- role system prompts, one per lab role, consumed by `bin/`
- `skills/` -- pi skills: procedures and standards, one directory per skill
- `bin/` -- role launchers; each sets `PI_CODING_AGENT_DIR` to this repo,
  pins a persistent per-role session file, and injects `motif.md` plus the
  role prompt
- `TODO.md` -- design rationale, roadmap, and decisions log; read before
  changing the architecture
- `docs/` -- design documents for the harness (`multi-agent.md` for the
  message-exchange pattern, `harness.md` for the implementation plan);
  dev-facing, not loaded by lab agents
- `manifesto.md` -- human-facing philosophy behind the project
- `settings.json` -- pi settings for the agent directory

## Working Conventions

- **Style**: ASCII only. No emoji, no non-ASCII punctuation: write em-dashes
  as `--`, arrows as `-->`. New rule; existing files predate it and are not
  yet retrofitted.
- **Naming follows a musical theme** (`motif.md`, orchestrator, ...). Prefer
  music-inspired names for new harness components.
- **`motif.md` holds invariants only.** Membership test: if the lab agents
  forgot it, would the failure be silent and costly? Procedures and
  templates belong in skills.
- **Skills**: pi frontmatter (`name`, trigger-style `description`), one
  directory per skill, self-contained (re-enterable cold after compaction).
- **Commits**: conventional commits. Record architectural decisions in
  `TODO.md`'s decisions log.
