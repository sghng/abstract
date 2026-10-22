# Logistics

Where notes go and how the artifact types work. The templates sit beside this
file (`../assets/ticket.md`, `../assets/report.md`, `../assets/memo.md`); copy
from them, never retype. Decks start from the presentation skill's
`assets/deck.typ`, governed by its `references/presentation.md`. Verification
conventions for outgoing artifacts live beside this file in
`verification.md`.

## Where Do Notes Go?

| Content                                | Location                        |
| -------------------------------------- | ------------------------------- |
| Closing records of tickets             | `notes/reports/report-NNN-*.md` |
| Implementation notes, work-in-progress | `notes/dev/`                    |
| Literature findings, verified claims   | `notes/literature.md` or `notes/literature/` |
| Standing memos (review, literature)    | `notes/memos/memo-NNN-*.md`     |
| Key results registry                   | `notes/results.md`              |
| Story (central narrative)              | `notes/story.md`                |
| Where the work stands (phases, ticket states, submissions) | `notes/states.md` |
| Orchestrator working memory (PI preferences, open loops)   | `notes/orchestrator.md` |
| Event journal (what happened, append-only) | `notes/log.md`                  |
| Briefings (PI-facing checkpoint records)   | `notes/briefs/briefing-NNN-*.md` |
| Companion (the PI's defense reference)     | beside the deliverable it pairs with |
| Note on notes, entry point             | `notes/index.md`                |
| Tickets                                | `notes/tickets/ticket-NNN-*.md` |
| Source PDFs                            | `references/`                   |
| Working files, one-off scripts         | `scratch/`                      |
| Superseded work, archived with a manifest | `scratch/archive/` + `MANIFEST.md` |

The memory files divide by tense. `log.md` holds what happened:
append-only, dated entries. `states.md` holds where things stand:
rewritten in place. `story.md` holds the framing: atemporal, no event
log. `orchestrator.md` holds standing rulings and open loops: distilled
in place. Events found in the story or the working memory are evicted to
the log.

## Linear Mirror

Linear (team SGH) is the PI-visible surface for work status; `notes/` stays
the record. Each project names its Linear project in `notes/orchestrator.md`;
threads without their own Linear project live in the `research` catch-all.
The mirror runs at milestone grain, and status writes are mechanical:

- A research thread opens: one issue in its Linear project, a line plus a
  pointer to the story or ticket.
- A phase turns or a report lands: a one-line comment on the thread's
  issue; status moves with the thread.
- A PI-authored issue is a work request: it crystallizes into a ticket
  through the usual interview, and the ticket NNN goes back onto the issue.

Use the Linear MCP in session; the `linear` CLI is the script fallback.
Linear carries status plus a pointer; narrative stays in `notes/`. This
agent does not sign comments; the board's signature convention belongs to
other writers.

## Notes Index

`notes/index.md` is the vault's entry point: one line per standing note,
wiki-linked, grouped by kind (story, tickets, reports, memos, literature).
Update it whenever a note is created, merged, or superseded.

## File Naming

Kebab-case, the `NNN` numbering, and the no-dates rule are kernel invariants.
The name itself is two to five descriptive words:
`ticket-001-data-analysis.md`, `memo-001-review-manuscript-a.md`.

Each template carries a `date:` frontmatter field, the one sanctioned exception
to the no-dates rule.

## Wiki-Link Conventions

Use wiki-links to cross-reference documents without paths or extensions:

```markdown
See [[story]] for the narrative. Details in [[ticket-001-data-analysis]];
results in [[report-001-data-analysis]].
```

Resolution: `[[story]]` is `story.md` at the `notes/` root; `[[ticket-001]]`
resolves to `notes/tickets/ticket-001-*.md` by stem match; likewise reports and
memos. Links are case-sensitive and match the filename exactly. External URLs
and files outside the project take standard markdown links, not wiki-links.

## Amendments

Amendments apply only after a ticket has been delegated; until then the ticket
is a draft and drafts are redrafted in place, not amended. Once delegated, the
body is frozen and discovered issues arrive as appended amendments:

```markdown
## Amendments

### Amendment 1: Description

**Based on**: [[report-XXX]] review. What changed and why.
```

### Parent and Sub-Tickets

A ticket spanning multiple domains splits into a parent ticket (overview,
blocking decisions, links) plus one sub-ticket per domain, each a
self-contained execution unit linked back to the parent:

```text
ticket-002-psychometrika-revision.md      (parent)
+-- ticket-003-literature-review.md       (sub)
+-- ticket-004-analysis.md                (sub)
`-- ticket-005-manuscript-drafting.md     (sub)
```

## Versioning Mechanics

Only `draft/` artifacts carry version labels (`-v1`, `-v2`, ...); never
overwrite an artifact, create the next version. Notes never carry versions:
merge related notes, split overgrown ones, supersede stale ones, edit in place.
Superseded work that is not a note (old scripts, retired roots, frozen logs)
moves to `scratch/archive/`, recorded in its `MANIFEST.md`.
