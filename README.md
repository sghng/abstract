# abstract

A config repo that turns OpenCode into a small academic research lab: a
kernel of invariants, a library of skills (writing, literature, experiments,
story-keeping, word export, presentations, and more), and a catalog of
sidekick agent briefs (internal and external reviewers, literature lookup and
review, visual review, nlpatch). One primary session per project orchestrates
through files (tickets, reports, memos, models) and flat subagent delegation.

Status: early. See `MEMORY.md` for the design rationale and decision tail,
`docs/prompting-2026-10-11.md` for the skills-model survey and design, and
`manifesto.md` for the philosophy.

## Layout

- `kernel.md` -- the always-on instructions mounted per project
- `skills/` -- the skill library; `staging/` holds the immature (lint)
- `agents/` -- sidekick briefs (markdown agent files)
- `opencode.template.jsonc` -- the project mount (instructions + skills + mcp)
- `src/cli.ts` -- the `abstract` CLI, init only
- `typ2docx/`, `tools/`, `lint/` -- the Word converter, the reference-stock
  patches, the experimental style linter
- `repertoire/` -- the convention corpus pipeline and query path
- `docs/` -- dev-facing design documents

## Usage

Install and link once:

```sh
cd /path/to/abstract && bun install && bun link
```

Then scaffold a research project:

```sh
abstract init <dir>   # writes opencode.jsonc, symlinks the sidekick briefs
                      # into .opencode/agents/, scaffolds the notes skeleton
```

Open the project in OpenCode. The kernel and the skill library mount from
the project's config; sidekicks resolve through the symlink farm. Files are
memory; sessions are a cache.

## Memory (hindsight)

The hindsight plugin is per-machine and manual:

```sh
bun x @vectorize-io/hindsight-coding-agents install opencode2
```

That writes one plugin entry into `~/.config/opencode/opencode.json`. Its
config is one user-level file, `~/.hindsight/coding-agent.json`; merge in
the stanza from `hindsight.example.json` (the memory server URL,
`optInOnly`, and the `mapPathToBank` entry routing `~/projects/research` to
the shared `research` bank). Memory is then inert outside research projects
and no per-project env vars are needed. Note: the plugin's autoUpdate
re-stages itself via npm; set `"autoUpdate": false` to stay bun-only.
