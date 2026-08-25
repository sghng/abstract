# abstract

A [pi](https://github.com/badlogic/pi-mono) agent directory that turns the pi
CLI into a small academic research lab: long-running **orchestrator**,
**engineer**, and **librarian** agents with persistent sessions, communicating
through files (tickets, reports, memos).

Status: early. See `TODO.md` for the design rationale and roadmap, and
`manifesto.md` for the philosophy.

## Layout

- `AGENTS.md` -- team kernel: invariants loaded into every session
- `agents/` -- role system prompts (consumed by `bin/`)
- `skills/` -- pi skills: procedures and standards, one directory per skill
- `bin/` -- role launchers; each pins a persistent session file per role
- `manifesto.md` -- human-facing philosophy

## Usage

Run a role inside a research project directory:

```sh
/path/to/abstract/bin/orchestrator
/path/to/abstract/bin/engineer
/path/to/abstract/bin/librarian
```

Each launcher points pi's agent directory at this repository
(`PI_CODING_AGENT_DIR`) and resumes the role's persistent session at
`.pi/sessions/<role>.jsonl` inside the project.
