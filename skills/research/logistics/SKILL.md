# Logistics

How research projects are organized, structured, and executed. This module covers file naming, repository structure, ticket conventions, wiki-links, and the workflow from story to deliverables.

---

## Repository Structure

A typical research project follows this layout:

```
project-root/
├── story.md                # Central narrative - the north star
├── notes/                  # Research notes (often symlink to Obsidian vault)
│   ├── tickets/            # Active work assignments
│   ├── reports/          # Completed reports to supervisor
│   ├── methodology/      # Analysis conventions and methods
│   ├── dev/              # Implementation notes, work-in-progress
│   └── narrative/        # Story-related documents
├── src/                   # Core reusable code
├── scripts/               # One-off utility scripts
├── data/                  # Data files reused across experiments
├── experiments/           # Individual experiment directories
│   ├── 01-name/
│   └── 02-name/
└── draft/                 # Publications, presentations, proposals
```

### Key Conventions

- **notes/** is typically a symlink to an Obsidian vault. Use `-L` with `find` to follow symlinks.
- **story.md** lives at project root, not in notes/
- **experiments/** are numbered sequentially
- **src/** contains reusable code, **scripts/** contains one-offs

---

## File Naming

All files use **kebab-case** (lowercase with hyphens):

```
✅ ticket-001-data-analysis.md
✅ report-003-final-results.md
✅ proposal-v2-revised.md

❌ ticket_001_data_analysis.md
❌ Report003FinalResults.md
❌ proposal_v2.md
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
See [[story]] for the research narrative.
Refer to [[ticket-001-data-analysis]] for details.
Check [[report-001-data-analysis]] for results.
```

### Resolution Rules

- `[[story]]` → resolves to `story.md` at project root
- `[[ticket-001]]` → resolves to `notes/tickets/ticket-001-*.md`
- `[[report-001]]` → resolves to `notes/reports/report-001-*.md`
- Links are case-sensitive and must match filename exactly

### When to Use Wiki-Links

- ✅ Cross-referencing tickets from other tickets
- ✅ Referencing story.md from any document
- ✅ Linking reports to tickets
- ✅ Citing methodology documents

- ❌ External URLs (use standard markdown links)
- ❌ Files outside the project
- ❌ Absolute file paths

---

## Ticket Structure

Tickets are the primary work assignment format. They should be **concise**, **actionable**, and **narrative-driven**.

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

## Questions for Supervisor

1. Question 1?
2. Question 2?

---

## Amendments

### Amendment 1: Description
**Date**: YYYY-MM-DD
**Based on**: [[report-XXX]] review

What changed and why.
```

### Key Principles

1. **Every task needs a "Because"**: Explain how the task contributes to the narrative
2. **Quick Links at top**: Easy navigation to related documents
3. **Deliverables section**: Clear output expectations
4. **Questions section**: Blockers and clarifications
5. **Amendments at bottom**: Track corrections without editing the main ticket

---

## Report Structure

Reports are **executive summaries** for the supervisor, not raw logs.

### Standard Report Format

```markdown
# Report NNN - Short Title

**Date**: YYYY-MM-DD
**Based on**: [[ticket-XXX]], [[story]]

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
![Figure 1](experiments/NNN/figures/name.png)
**Caption**: Description of what the figure shows.

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
story.md → tickets → experiments → reports → deliverables
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
  - You need to communicate findings to supervisor
  - Results inform the narrative

- **Update story.md** when:
  - The narrative shifts
  - New findings change the story
  - You reach a new phase

---

## Cross-Referencing Conventions

### From Tickets

```markdown
See [[story]] for current narrative.
Based on [[report-001-data-analysis]].
Related: [[ticket-002-proposal-prep]].
```

### From Reports

```markdown
Based on [[ticket-001-data-analysis]].
See [[story]] for narrative context.
```

### From Story

```markdown
See [[ticket-001]] for data analysis.
See [[report-001]] for results.
```

### From Deliverables

```markdown
See [[story]] for research narrative.
Results detailed in [[report-001]].
```

---

## Common Patterns

### Pattern 1: Analysis Pipeline

```
ticket-001-data-analysis.md
  → experiments/01-data-analysis/
    → results.md (raw output)
  → notes/reports/report-001-data-analysis.md (executive summary)
```

### Pattern 2: Manuscript Preparation

```
ticket-002-proposal-prep.md
  → draft/proposal-draft.md
  → notes/reports/report-002-proposal-review.md
```

### Pattern 3: Revision Cycle

```
story.md (updated narrative)
  → ticket-003-revision-v1.md
    → draft/manuscript-revised.md
    → notes/reports/report-003-revision-complete.md
```

---

## Anti-Patterns to Avoid

### 1. No Dates in Tickets

```
❌ ticket-001-2024-08-06.md
❌ ticket-001-data-analysis-Aug-2024.md

✅ ticket-001-data-analysis.md
```

### 2. Don't Duplicate Information

```
❌ Copying entire story.md into ticket.md
✅ Linking to [[story]] and quoting relevant parts
```

### 3. Don't Put Tickets Outside notes/tickets/

```
❌ /ticket-001.md (at root)
❌ /experiments/01/ticket-001.md

✅ /notes/tickets/ticket-001-*.md
```

### 4. Don't Use Absolute Paths in Wiki-Links

```
❌ [[/Users/name/projects/q-matrix/notes/tickets/ticket-001]]
❌ [[notes/tickets/ticket-001]]

✅ [[ticket-001]]
```

### 5. Don't Create Tickets Without "Because" Rationale

```
❌ Task: Run analysis

✅ Task: Calculate drift per model
   **Because**: Establishes competitive landscape for narrative
```

---

## File Status Indicators

Some projects use emoji/status indicators in filenames:

```
✅ Final: No indicator needed
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
- **Workflow**: story → tickets → experiments → reports → deliverables
- **Symlinks**: Use `-L` flag with `find`

---

*This logistics module defines how research work is organized and executed. See content-specific skills (manuscript, presentation, etc.) for domain conventions.*
