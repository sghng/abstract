---
name: logistics
description:
  Project organization procedures - where notes go, the ticket/report/memo
  templates, wiki-link resolution. Use when creating tickets, reports, memos, or
  notes, or when unsure where a file belongs.
---

# Logistics

Where notes go and what each one looks like: the placement table, the
ticket/report/memo templates, wiki-link resolution, amendments, versioning
mechanics.

The invariant layer (the project layout tree, kebab-case naming, ticket and
report numbering, no dates, the wiki-link form, notes-merge-vs-artifacts-
version) lives in the team kernel (`AGENTS.md`, always loaded, never compacted
away). This skill holds the procedures on top of those invariants and does not
restate them.

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

Kebab-case, the `NNN` numbering, and the no-dates rule are kernel invariants;
the patterns are `ticket-NNN-name.md`, `report-NNN-name.md`, and
`memo-NNN-name.md`. The name itself is two to five descriptive words.

- `ticket-001-data-analysis.md`, `report-001-data-analysis.md`
- `memo-001-review-manuscript-a.md`, `memo-002-validity-evidence.md`

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

## Ticket Structure

Tickets are the primary work assignment format: concise, actionable,
narrative-driven.

### Standard Ticket Format

```markdown
---
date: YYYY-MM-DD
---

# Ticket NNN - Short Descriptive Title

## Quick Links

- [[story]] - Research narrative
- [[ticket-XXX]] - Related ticket, if applicable

## Background

Brief context: what is this ticket about, why does it matter.

## Core Question

The central question this ticket addresses.

## Todos

### Task 1: Task Name

- [ ] Specific action

**Because**: why this task matters to the narrative.

## Deliverables

### For You: results.md

Location: `experiments/NN-name/results.md`. Raw analysis output, code and
parameters, intermediate calculations.

### For Me: report-NNN-*.md

Location: `notes/reports/report-NNN-name.md`. Executive summary, key findings,
narrative implications, visualizations with captions.

## Questions for Orchestrator

1. Question 1?
```

### Amendments

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
blocking decisions, links) plus one sub-ticket per domain, each a self-contained
execution unit linked back to the parent:

```text
ticket-002-psychometrika-revision.md      (parent)
+-- ticket-003-literature-review.md       (sub)
+-- ticket-004-analysis.md                (sub)
`-- ticket-005-manuscript-drafting.md     (sub)
```

## Report Structure

```markdown
---
date: YYYY-MM-DD
---

# Report NNN - Short Title

**Based on**: [[ticket-XXX]], [[story]]

## Executive Summary

What was found and why it matters, in three to five sentences.

## Background

Why this work was commissioned; the ticket's question.

## Methodology

What was done, with enough detail to evaluate.

## Results

Key findings with evidence (tables, figures).

## Narrative Implications

How the results support or complicate the story.

## Risk Assessment

What could go wrong; the limitations.

## Discovery Zone

Unexpected findings, patterns suggesting new hypotheses, serendipitous
discoveries that might redirect the narrative. Also: what was added beyond the
requested tasks, and why.

## Visualizations

### Figure 1: Name

![Figure 1](experiments/NN-name/figures/name.png) **Caption**: what the figure
shows.

## Next Steps

- [ ] Step 1
```

## Memo Template

Standing memos live in `notes/memos/`; take the next free `NNN`. The librarian's
literature memos and the editor's review memos are both this shape, each filling
the findings with their own craft.

```markdown
---
date: YYYY-MM-DD
---

# Memo NNN - Short Title

## Question

What was asked.

## Findings

The substance: verified claims with verbatim passages and page numbers
(literature memos), or concrete issues with line references (review memos).

## Recommendations

What the recipient should do with this.
```

## Versioning Mechanics

Only `draft/` artifacts carry version labels (`-v1`, `-v2`, ...); never
overwrite an artifact, create the next version. Notes never carry versions:
merge related notes, split overgrown ones, supersede stale ones, edit in place.
