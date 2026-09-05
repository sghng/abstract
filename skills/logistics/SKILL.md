---
name: logistics
description:
  Project organization standards -- repository layout, ticket and report
  templates, file naming, wiki-links, workflow. Use when creating tickets,
  reports, or notes, or when unsure where a file belongs.
---

# Logistics

How research projects are organized, structured, and executed. This module
covers file naming, repository structure, ticket conventions, wiki-links, and
the workflow from story to deliverables.

---

## Repository Structure

A typical research project follows this layout:

```
project-root/
+-- notes/                  # Research notes (often symlink to Obsidian vault)
|   +-- index.md            # Note on notes - entry point to the vault
|   +-- story.md            # Central narrative - the north star
|   +-- tickets/            # Active work assignments (required)
|   +-- reports/            # Completed reports to orchestrator (required)
|   +-- dev/                # Implementation notes, work-in-progress (required)
|   `-- ...                 # Other themed dirs optional, emerge as needed
+-- src/                   # Core reusable code
+-- scripts/               # One-off utility scripts
+-- data/                  # Data files reused across experiments
+-- experiments/           # Individual experiment directories
|   +-- 01-name/
|   `-- 02-name/
`-- draft/                 # Publications, presentations, proposals (artifacts)
```

### Key Conventions

- **notes/** is typically a symlink to an Obsidian vault. Use `-L` with `find`
  to follow symlinks.
- **story.md** lives at `notes/story.md` -- inside notes, at the vault root
- **index.md** lives at `notes/index.md` -- the "note on notes", entry point
- **tickets/**, **reports/**, **dev/** are the only required subdirectories
- Other themed directories (methodology/, literature/, publications/, etc.) are
  created organically when the volume of notes justifies them
- **experiments/** are numbered sequentially
- **src/** contains reusable code, **scripts/** contains one-offs

### Where Do Notes Go?

| Note type                             | Location                            |
| ------------------------------------- | ----------------------------------- |
| Global / cross-cutting (story, index) | `notes/` root                       |
| Active work assignment                | `notes/tickets/`                    |
| Report to orchestrator                | `notes/reports/`                    |
| Implementation detail, scratch work   | `notes/dev/`                        |
| Themed content (literature, methods)  | Optional subdir, create when needed |
| Random working notes                  | `notes/` root                       |

If a note doesn't clearly belong to a themed directory, keep it at the notes
root. Don't force categorization -- let patterns emerge and create directories
retroactively when a clear theme appears.

---

## Notes Index (index.md)

Every notes vault should have an `index.md` at its root -- a "note on notes"
that serves as the entry point for both humans and agents.

### Purpose

- Orient anyone (human or agent) entering the project
- List key notes and what each contains
- Link to the story, active tickets, and recent reports

### Standard Format

```markdown
# [Project Name]

Short description of the project and what it's about.

## Key Notes

- [[story]] - Central narrative
- [[ticket-001-...]] - Current active work
- [[report-001-...]] - Latest report

## Tasks Query

(Optional Obsidian tasks query for pending items)
```

### When to Update

- When a new ticket is created
- When a report is completed
- When the story changes substantially
- When new themed directories are added

---

## File Naming

All files use **kebab-case** (lowercase with hyphens):

```
GOOD: ticket-001-data-analysis.md
GOOD: report-003-final-results.md
GOOD: proposal-v2-revised.md

BAD: ticket_001_data_analysis.md
BAD: Report003FinalResults.md
BAD: proposal_v2.md
```

### Ticket Naming

Tickets use the format:

```
ticket-NNN-short-descriptive-name.md
```

- **NNN**: Sequential number (001, 002, etc.)
- **name**: 2-5 words describing the work
- **No dates** in ticket filenames
- Tickets are atomic static artifacts

Examples:

- `ticket-001-data-analysis.md`
- `ticket-002-proposal-prep.md`
- `ticket-003-story-reframe.md`

### Report Naming

Reports use the format:

```
report-NNN-short-descriptive-name.md
```

Examples:

- `report-001-data-analysis.md`
- `report-002-proposal-draft.md`

---

## Wiki-Link Conventions

Use wiki-links to cross-reference documents without paths or extensions:

```markdown
See [[story]] for the research narrative. Refer to [[ticket-001-data-analysis]]
for details. Check [[report-001-data-analysis]] for results.
```

### Resolution Rules

- `[[story]]` --> resolves to `story.md` at `notes/` root (inside the vault)
- `[[ticket-001]]` --> resolves to `notes/tickets/ticket-001-*.md`
- `[[report-001]]` --> resolves to `notes/reports/report-001-*.md`
- Links are case-sensitive and must match filename exactly

### When to Use Wiki-Links

- GOOD: Cross-referencing tickets from other tickets
- GOOD: Referencing story.md from any document
- GOOD: Linking reports to tickets
- GOOD: Citing methodology documents

- BAD: External URLs (use standard markdown links)
- BAD: Files outside the project
- BAD: Absolute file paths

---

## Ticket Structure

Tickets are the primary work assignment format. They should be **concise**,
**actionable**, and **narrative-driven**.

### Standard Ticket Format

```markdown
# Ticket NNN - Short Descriptive Title

## Quick Links

- [[story]] - Research narrative
- [[ticket-XXX]] - Related ticket (if applicable)
- [[report-YYY]] - Previous report (if applicable)

---

## Background

Brief context: What is this ticket about? Why does it matter?

## Core Question / Research Question

The central question this ticket addresses.

---

## Todos

### Task 1: Task Name

- [ ] Specific action
- [ ] Another action

**Because**: Why this task matters to the narrative.

### Task 2: Task Name

- [ ] Specific action

**Because**: Narrative rationale.

---

## Deliverables

### For You: `results.md`

Location: `experiments/NNN-name/results.md`

- Raw analysis output
- Code and parameters
- Intermediate calculations

### For Me: `report-NNN-*.md`

Location: `notes/reports/report-NNN-name.md`

- Executive summary
- Key findings
- Narrative implications
- Visualizations with captions

---

## Questions for Orchestrator

1. Question 1?
2. Question 2?

---

## Amendments

### Amendment 1: Description

**Date**: YYYY-MM-DD **Based on**: [[report-XXX]] review

What changed and why.
```

### When Amendments Apply

Amendments apply **only after** a ticket has been finalized and delegated to
execution. They capture corrections discovered during execution (e.g., a report
reveals gaps or unexpected clarifications) without touching the ticket body.

**During the drafting phase** (before delegation), do NOT use amendments. Just
redraft the ticket directly -- edit the body freely. A ticket is not finalized
until it's delegated; anything before that is draft, and drafts are redrafted,
not amended.

Lifecycle:

1. **Drafting**: Edit the body freely. No amendments.
2. **Delegated**: Ticket body is frozen. Discovered issues --> append
   amendments.
3. **Superseded**: New ticket (or full redraft) replaces it.

### Key Principles

1. **Every task needs a "Because"**: Explain how the task contributes to the
   narrative
2. **Quick Links at top**: Easy navigation to related documents
3. **Deliverables section**: Clear output expectations
4. **Questions section**: Blockers and clarifications
5. **Amendments only after delegation**: During drafting, redraft instead
6. **Parent/sub-ticket split**: Large tickets may be split into a parent ticket
   plus numbered sub-tickets, interconnected via wiki links

---

## Parent and Sub-Tickets

When a ticket spans multiple domains (analysis, literature, writing, etc.),
split it:

- **Parent ticket**: Overview, blocking decisions, domain summary. Links to
  sub-tickets via wiki links. Remains stable; sub-tickets carry the detail.
- **Sub-tickets**: One per domain. `ticket-NNN-short-name.md` each. Each is a
  self-contained execution unit with its own Quick Links, Background, Todos, and
  Deliverables. Link back to the parent and to each other where dependent.

Example:

```
ticket-002-psychometrika-revision.md      (parent)
+-- ticket-003-literature-review.md       (sub)
+-- ticket-004-analysis.md                (sub)
`-- ticket-005-manuscript-drafting.md     (sub)
```

---

## Versioning

**Artifacts are versioned. Internal notes are not.**

- **Versioned (artifacts)**: Drafts (`manuscript-v5.docx`), figures, tables,
  proposals, and other deliverables get version labels (`-v1`, `-v2`, ...).
  Never overwrite an artifact; create the next version.
- **Not versioned (internal notes)**: Story, tickets, reports, methodology
  notes, dev notes. Don't append version numbers or dates to these. When
  something changes: **merge** related notes, **split** overgrown notes, or
  **supersede** stale notes. Editing in place is fine.

This is why notes filenames use kebab-case without versions, while `draft/`
artifacts carry explicit version labels.

---

## Report Structure

Reports are **executive summaries** for the orchestrator, not raw logs.

### Standard Report Format

```markdown
# Report NNN - Short Title

**Date**: YYYY-MM-DD **Based on**: [[ticket-XXX]], [[story]]

---

## Executive Summary

One paragraph: What was done, what was found, why it matters.

---

## Background

Brief reminder of context (1-2 paragraphs).

---

## Methodology

What was done, with enough detail to evaluate.

---

## Results

Key findings with evidence (tables, figures).

---

## Narrative Implications

How do these results support or complicate the story?

- Supports: Finding X validates our approach
- Complicates: Finding Y requires reframing

---

## Risk Assessment

What could go wrong? What are the limitations?

---

## Visualizations

### Figure 1: Name

![Figure 1](experiments/NNN/figures/name.png) **Caption**: Description of what
the figure shows.

---

## Next Steps

- [ ] Step 1
- [ ] Step 2
```

---

## Working with Symlinks

The `notes/` directory is often a symlink to an Obsidian vault:

```
notes -> /Users/.../iCloud~md~obsidian/Documents/vault/projects/project-name
```

### Commands That Follow Symlinks

```bash
# Find files (follow symlinks)
find -L notes -name "*.md"

# Read files (follows symlinks automatically)
cat notes/tickets/ticket-001.md

# List directory (follows symlinks)
ls -la notes/
```

### Commands That Do NOT Follow Symlinks

```bash
# Find without -L (skips symlink contents)
find notes -name "*.md"  # May miss files!

# Glob patterns (may not follow symlinks)
```

**Rule**: Always use `-L` flag with `find` when searching the notes directory.

---

## Workflow

The standard research workflow flows through these artifacts:

```
story.md --> tickets --> experiments --> reports --> deliverables
```

### Story-Driven

1. **story.md** defines the narrative
2. **Tickets** are created to advance specific aspects of the story
3. **Experiments** execute the work
4. **Reports** summarize findings and implications
5. **Deliverables** (manuscripts, presentations) are produced

### When to Create Each Artifact

- **Create a ticket** when:
  - You have a specific task to complete
  - The task contributes to the story
  - You need to delegate or track work

- **Create a report** when:
  - An experiment is complete
  - You need to communicate findings to orchestrator
  - Results inform the narrative

- **Update story.md** when:
  - The narrative shifts
  - New findings change the story
  - You reach a new phase

---

## Cross-Referencing Conventions

### From Tickets

```markdown
See [[story]] for current narrative. Based on [[report-001-data-analysis]].
Related: [[ticket-002-proposal-prep]].
```

### From Reports

```markdown
Based on [[ticket-001-data-analysis]]. See [[story]] for narrative context.
```

### From Story

```markdown
See [[ticket-001]] for data analysis. See [[report-001]] for results.
```

### From Deliverables

```markdown
See [[story]] for research narrative. Results detailed in [[report-001]].
```

---

## Common Patterns

### Pattern 1: Analysis Pipeline

```
ticket-001-data-analysis.md
  --> experiments/01-data-analysis/
    --> results.md (raw output)
  --> notes/reports/report-001-data-analysis.md (executive summary)
```

### Pattern 2: Manuscript Preparation

```
ticket-002-proposal-prep.md
  --> draft/proposal-draft.md
  --> notes/reports/report-002-proposal-review.md
```

### Pattern 3: Revision Cycle

```
story.md (updated narrative)
  --> ticket-003-revision-v1.md
    --> draft/manuscript-revised.md
    --> notes/reports/report-003-revision-complete.md
```

---

## Anti-Patterns to Avoid

### 1. No Dates in Tickets

```
BAD: ticket-001-2024-08-06.md
BAD: ticket-001-data-analysis-Aug-2024.md

GOOD: ticket-001-data-analysis.md
```

### 2. Don't Duplicate Information

```
BAD: Copying entire story.md into ticket.md
GOOD: Linking to [[story]] and quoting relevant parts
```

### 3. Don't Put Tickets Outside notes/tickets/

```
BAD: /ticket-001.md (at root)
BAD: /experiments/01/ticket-001.md

GOOD: /notes/tickets/ticket-001-*.md
```

### 4. Don't Use Absolute Paths in Wiki-Links

```
BAD: [[/Users/name/projects/q-matrix/notes/tickets/ticket-001]]
BAD: [[notes/tickets/ticket-001]]

GOOD: [[ticket-001]]
```

### 5. Don't Create Tickets Without "Because" Rationale

```
BAD: Task: Run analysis

GOOD: Task: Calculate drift per model
   **Because**: Establishes competitive landscape for narrative
```

---

## File Status Indicators

Some projects use emoji/status indicators in filenames:

```
GOOD: Final: No indicator needed
draft-*.md              # Work in progress
scratch-*.md           # Temporary notes
archive-*.md           # Old versions
```

Check project conventions before adding indicators.

---

## Summary

- **Naming**: kebab-case, sequential numbers for tickets/reports
- **Links**: Wiki-links `[[name]]` without paths or extensions
- **Tickets**: Concise, narrative-driven, with "Because" rationale
- **Reports**: Executive summaries, not raw logs
- **Workflow**: story --> tickets --> experiments --> reports --> deliverables
- **Symlinks**: Use `-L` flag with `find`

---

_This logistics module defines how research work is organized and executed. See
content-specific skills (manuscript, presentation, etc.) for domain
conventions._
