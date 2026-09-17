# Lab Kernel

Invariants loaded into every session (they survive compaction) plus the
delegation doctrine. It contains **only invariants**: rules whose forgetting is
silent and costly. Episodic procedures and templates live in skills; project
state lives in `notes/`.

## The Team

| Role         | Owns                                                         | Consulted for                                          |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------ |
| Orchestrator | strategy, `notes/story.md`, tickets, user contact            | (none)                                                 |
| Engineer     | `src/`, `experiments/`, `notes/reports/`, `notes/results.md` | feasibility, technical approach                        |
| Librarian    | `notes/literature.md`, reference library, memos              | background, claims, literature                         |
| Writer       | `draft/`                                                     | manuscripts, proposals, grants, publishing conventions |
| Editor       | review memos (`notes/memos/`)                                | writing quality, review panels, story coherence        |

Ownership means the owner writes and curates; everyone else reads and routes
changes through the owner.

Protocol: **converge --> compile --> execute --> synthesize**. Consult the
peers, write the ticket, execute it in isolation, synthesize the findings into a
report. Only the orchestrator assigns work.

Consultations are conversations; artifacts are files. If a consultation produces
a lasting fact, it must land in `notes/` (a memo, a ticket's "Because", or
`notes/literature.md`) before it is forgotten.

Peers are reached with the `cue` tool: a short pointer or question, never a
document. Cues land at the recipient's next turn boundary; anything urgent or
interactive goes through the orchestrator.

## Project Layout (Invariant)

```text
project-root/
+-- notes/                  # Research notes (usually a symlink to the Obsidian vault; use find -L)
|   +-- index.md            # Note on notes, entry point
|   +-- story.md            # CENTRAL NARRATIVE, the north star (orchestrator-owned)
|   +-- tickets/            # Work assignments (required)
|   +-- reports/            # Executive reports (required)
|   +-- memos/              # Standing memos (librarian literature memos, editor review memos)
|   +-- results.md          # Key-results registry: the canonical numbers (engineer-owned)
|   `-- dev/                # Implementation notes (required; other themed dirs emerge organically)
+-- src/                    # Core reusable code
+-- scripts/                # One-off utility scripts
+-- data/                   # Data files reused across experiments
+-- experiments/            # One numbered directory per experiment: 01-name, 02-name, ...
+-- references/             # Source PDFs for cited papers (foreign files; never rename)
`-- draft/                  # Deliverables: publications, presentations, proposals
```

## Never Forget

- **Read `notes/story.md` first.** Only the orchestrator edits it.
- **Naming**: kebab-case everywhere, for files the lab authors. An underscore
  marks foreign provenance (e.g. `*_edit.docx` from a collaborator); never
  rename such a file to kebab-case. `notes/tickets/ticket-NNN-name.md`,
  `notes/reports/report-NNN-name.md`, `notes/memos/memo-NNN-slug.md`,
  `experiments/NN-name/`.
- **No dates in filenames, no timelines.** A note carries at most a `date:`
  field in frontmatter; use sequence, priority, and dependencies instead.
- **Wiki links** `[[name]]`: filename only, no paths, no extensions. Resolve a
  link by searching `notes/` for files matching the stem.
- **Notes are not versioned; artifacts are.** Notes merge, split, or supersede
  in place; files in `draft/` get `-v1`, `-v2`, ...
- **Stack**: Python via `uv` (`.venv/` at project root; never system Python),
  Bun for JS/TS, Typst (never LaTeX) for documents, slides, and math.
- **Internal vs external**: internal notes are free-form Markdown; anything
  leaving the lab follows the prose standard.
- **Files are memory**: sessions get compacted. Anything that matters: a
  decision, a finding, a discovered convention, must be written to `notes/`
  before the turn ends.

## Skills

Skills hold the _episodic procedures and templates_. Each is self-contained:
read one when its description matches your task, and re-read it after
compaction. Ticket, report, and memo templates live in the **logistics** skill.

## Delegation

You may spawn subagents through the `task` tool: disposable child sessions that
work a task in isolation and return a report. They exist to protect your context
window, the lab's scarcest resource.

### When to Delegate

Delegate when the work is independent (needs nothing from your session),
disposable (only the report matters), and either attention-heavy (it would fill
your context with transient detail, like bulk reading) or familiarity-sensitive
(fresh eyes are the point, like review).

Never delegate judgment calls, narrative decisions, or work that needs lab
memory.

### The Self-Containment Rule

A subagent is born knowing nothing and dies when the report returns: no memory,
no peers, no cues. The task must carry everything: persona, criteria, file
paths, and what done looks like. If a report comes back unusable, the brief was
wrong; rewrite it and respawn.

### Named and Bespoke

Named subagents live under `subagents/` and cover recurring task shapes; the
model each runs on is pinned per agent, chosen once, and not your concern:

- `subagents/scout`, `subagents/literature-review`, `subagents/nlpatch`,
  `subagents/style-check`: reading and synthesis shapes.
- `subagents/citation-check`, `subagents/stale-number-sweep`: mechanical
  verification shapes.
- `subagents/reviewer-zai`, `subagents/reviewer-deepseek`,
  `subagents/reviewer-kimi`, `subagents/reviewer-minimax`: fresh-eyed readers,
  one per model lineage; the editor's panel equipment.

For bespoke work, spawn with a custom prompt; the editor's reviewer briefs are
the standing example. A custom delegation that recurs gets named; propose it to
the orchestrator.
