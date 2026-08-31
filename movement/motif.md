# Motif

This file is the lab's motif: the shared invariants loaded into every agent
session, which survive compaction. It contains **only invariants**: the
rules that must never be forgotten. Procedures and templates live in skills;
project state lives in `notes/`.

## The Team

| Role | Owns | Consulted for |
|---|---|---|
| Orchestrator | strategy, `notes/story.md`, tickets, user contact | -- |
| Engineer | `src/`, `experiments/`, reports | feasibility, technical approach |
| Librarian | `notes/literature.md`, reference library, memos | background, claims, literature |
| Writer | `draft/`, writing tickets | manuscripts, proposals, grants, publishing conventions |
| Reviewer | review memos (`notes/memos/`) | writing quality, argument flow, nodding-reader test |

Protocol rhythm: **converge --> compile --> execute --> synthesize**. Tickets are
co-designed through consultation, executed in isolation, then synthesized
into reports. Only the orchestrator assigns work.

Consultations are conversations; artifacts are files. If a consultation
produces a lasting fact, it must land in `notes/` (a memo, a ticket's
"Because", or `notes/literature.md`) before it is forgotten.

## Project Layout (Invariant)

```
project-root/
+-- notes/                  # Research notes (usually a symlink to the Obsidian vault; use find -L)
|   +-- index.md            # Note on notes, entry point
|   +-- story.md            # CENTRAL NARRATIVE, the north star (orchestrator-owned)
|   +-- tickets/            # Work assignments (required)
|   +-- reports/            # Executive reports (required)
|   `-- dev/                # Implementation notes (required; other themed dirs emerge organically)
+-- src/                    # Core reusable code
+-- scripts/                # One-off utility scripts
+-- data/                   # Data files reused across experiments
+-- experiments/            # One numbered directory per experiment: 01-name, 02-name, ...
`-- draft/                  # Deliverables: publications, presentations, proposals
```

## Never Forget

- **Read `notes/story.md` first.** Only the orchestrator edits it.
- **Naming**: kebab-case everywhere. `notes/tickets/ticket-NNN-name.md`,
  `notes/reports/report-NNN-name.md`, `experiments/NN-name/`.
- **No dates or timelines** in tickets, reports, or note filenames. Use
  sequence, priority, and dependencies instead.
- **Wiki links** `[[name]]`: filename only, no paths, no extensions.
- **Notes are not versioned; artifacts are.** Notes merge, split, or supersede
  in place; files in `draft/` get `-v1`, `-v2`, ...
- **Stack**: Python via `uv` (`.venv/` at project root; never system Python),
  Bun for JS/TS, Typst (never LaTeX) for documents, slides, and math.
- **Internal vs external**: internal notes are free-form Markdown; anything
  leaving the lab follows the writing skill.
- **Files are memory**: sessions get compacted. Anything that matters: a
  decision, a finding, a discovered convention, must be written to `notes/`
  before the turn ends.

## Skills

Skills hold the *procedures and templates*. Each is self-contained: read one
when its description matches your task, and re-read it after compaction.
Ticket/report templates live in the **logistics** skill; the mindset for
framing and narrative decisions lives in the **philosophy** skill.
