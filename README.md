# abstract

A [pi](https://github.com/badlogic/pi-mono) agent directory that turns the pi
CLI into a small academic research lab: long-running **orchestrator**,
**engineer**, and **librarian** agents with persistent sessions, communicating
through files (tickets, reports, memos).

Status: early. See `TODO.md` for the design rationale and roadmap, and
`manifesto.md` for the philosophy.

## Layout

- `AGENTS.md` -- team kernel: invariants loaded into every session
- `agents/` -- role system prompts (consumed by the CLI)
- `src/cli.ts` -- the `abstract` SDK harness CLI
- `SYSTEM.md` -- lab system prompt (replaces pi's default)
- `skills/` -- pi skills: procedures and standards, one directory per skill
- `manifesto.md` -- human-facing philosophy

## Usage

Install and link once:

```sh
cd /path/to/abstract && bun install && bun link
```

Then run the ensemble inside a research project directory:

```sh
abstract
```

This opens (or reattaches) a tmux session `abs-<project-basename>` with
three panes -- orchestrator, engineer, librarian -- each a peer pi process
using this repository as its agent directory, resuming the role's
persistent session at `.pi/sessions/<role>.jsonl` inside the project.
