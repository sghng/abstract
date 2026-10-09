# Logistics

Where notes go and how the artifact types work. The templates sit beside this
file (`ticket.md`, `report.md`, `memo.md`); copy from them, never retype.
Decks start from `deck.typ`, governed by `presentation.md`. Verification
conventions for outgoing artifacts live in `verification.md`.

## Where Do Notes Go?

| Content                                | Location                        |
| -------------------------------------- | ------------------------------- |
| Executive reports to the orchestrator  | `notes/reports/report-NNN-*.md` |
| Implementation notes, work-in-progress | `notes/dev/`                    |
| Literature findings, verified claims   | `notes/literature.md`           |
| Standing memos (review, literature)    | `notes/memos/memo-NNN-*.md`     |
| Key results registry                   | `notes/results.md`              |
| Story (central narrative)              | `notes/story.md`                |
| Note on notes, entry point             | `notes/index.md`                |
| Tickets                                | `notes/tickets/ticket-NNN-*.md` |
| Source PDFs                            | `references/`                   |

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
