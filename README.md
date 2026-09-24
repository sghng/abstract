# abstract

An OpenCode v2 agent directory that turns the CLI into a small academic research
lab: persistent, context-isolated role sessions (orchestrator, engineer,
statistician, librarian, writer, editor) that collaborate through files
(tickets, reports, memos, models) and cues.

Status: early. See `TODO.md` for the design rationale and roadmap, and
`manifesto.md` for the philosophy.

## Layout

- `config/` -- the lab's OpenCode config root (`OPENCODE_CONFIG_DIR`): the
  kernel `AGENTS.md`, `agents/` (role personas and the subagent catalog),
  `plugin/harness.ts` (the cue and repertoire tools), `skills/`, and
  `opencode.json`
- `prompts/` -- role doctrine, assembled into the system prompt by each role's
  binder
- `src/` -- the `abstract` CLI, the binders, and the context report
- `docs/` -- dev-facing design documents; `repertoire/` is the writer's
  convention corpus (see `docs/repertoire/`)
- `manifesto.md` -- the philosophy behind the project

## Usage

Install and link once:

```sh
cd /path/to/abstract && bun install && bun link
```

Then, inside a research project directory:

```sh
abstract              # ensure runtime, server, and role sessions; attach the TUI
abstract context      # what each agent receives: context, skills, subagents, tools
abstract lint <f.typ> # style-check a manuscript against the expert edits (Jev)
abstract doctor       # contract smoke test against the pinned runtime
abstract stop         # stop the lab server
```

The lab runs on a per-host OpenCode server at port 4319 with its own config,
state, and database under `~/.local/share/abstract` and
`~/.local/state/abstract`. Files are memory; sessions are a cache.
