# Engineering

This skill describes the engineering aspect of academic research. This skill is
relevant to:

- Preferred tech stack.
- How to run experiments.
- Conventions of file organization for code and notes.
- Plotting diagrams for publication or report.
- Writing experiment reports.

## Repository Structure

A typical research project follows this structure:

```
project-root/
├── notes/                  # Research notes and documentation
│   ├── narrative/          # Story, research questions, methodology
│   │   ├── story.md        # MASTER NARRATIVE - central story document
│   │   └── research-questions.md
│   ├── tickets/            # Active work assignments (tickets)
│   ├── reports/            # Completed reports to supervisor
│   ├── methodology/        # Analysis methods, conventions
│   └── dev/                # Implementation notes, work-in-progress
├── src/                    # Core reusable code across experiments
├── scripts/                # One-off utility scripts
├── data/                   # Data files reused across experiments
├── experiments/            # Individual experiment directories
│   ├── 01-name_of_experiment/
│   └── 02-another_experiment/
└── draft/                  # Publications, presentations, proposals
```

### Key Directories

- **`notes/`**: Central location for all documentation. Use wiki links like
  `[[story]]` to cross-reference notes.
- **`src/`**: Code that is heavily reused across experiments (core utilities,
  database access, shared functions).
- **`experiments/`**: Each experiment gets its own numbered directory.
- **`draft/`**: Manuscripts, presentations, and other publication artifacts.

## Notes System

The `notes/` directory uses a structured organization:

- **`notes/narrative/`**: High-level research documentation
  - `story.md`: Central narrative document defining the research story
  - `research-questions.md`: Research questions and hypotheses
  - `methodology/`: Analysis methods and conventions

- **`notes/tickets/`**: Active work assignments. Tickets use the format
  `ticket-NNN-short-title.md` and should NEVER include dates or timelines.
  Tickets are atomic static artifacts.

- **`notes/reports/`**: Completed reports to supervisor. Use the format
  `report-NNN-short-title.md`. Reports should be executive summaries, not raw
  logs.

- **`notes/dev/`**: Working notes, implementation details, and scratch space.

### Wiki Link Convention

Use kebab-case wiki links to cross-reference notes:

```markdown
See [[story]] for the research narrative.
Refer to [[ticket-001-data-analysis]] for details.
Check [[inter-rater-reliability]] methodology.
```

Links are resolved to files automatically (e.g., `[[story]]` →
`notes/narrative/story.md`). No paths or extensions needed.

## Experiment Convention

- An experiment directory: `experiments/01-name_of_the_experiment/`
- Each experiment is self-contained with its own code, data, and results
- Experiments are numbered sequentially
- Almost all experiments produce a report to `notes/reports/`

**Experiment contents typically include:**
- Analysis scripts (Python, R, etc.)
- Generated figures and tables
- `results.md`: Detailed log of actions and data (for internal use)
- References to parent report in `notes/reports/`

## Code and Data

### Reusable Assets

If code or data will be reused across multiple experiments, extract to `src/` or
`data/`:

- `src/`: Core algorithms, database utilities, shared functions
- `data/`: Cleaned datasets, reference files, lookup tables

### Documentation

Keep extensive inline documentation:

- Document the purpose clearly in source files
- Comment WHY choices are made, not just HOW
- Explain how code contributes to the experiment
- Include Zotero cite keys when ideas are borrowed from papers

## Preferred Tech Stack

Unless overridden by repo-specific rules:

- **Python**: For data analysis (latest via `uv`)
  - Virtual environment at `.venv/`
  - Check existing `requirements.txt` before installing new packages
- **JavaScript/TypeScript**: Use Bun
- **R**: Avoid; if necessary, call from Python to minimize R logic
- **Typst**: For typesetting documents and presentations

Prefer existing frameworks. Do not reinvent wheels. Always search for latest
options and discuss framework choices with user before adopting.

## Artifact Conventions

### No Timelines in Tickets or Reports

**Rule**: Never include specific dates, deadlines, or timelines in tickets and
reports.

**Rationale**: Tickets and reports are atomic, static artifacts. They should
remain valid regardless of when they are read.

**Use instead**:
- ✅ Sequence: "Complete Task 1 before Task 2"
- ✅ Priorities: "Task A is critical; Task B is secondary"
- ✅ Dependencies: "Requires completion of experiment 01"
- ❌ Dates: "Complete by June 14"
- ❌ Deadlines: "Due next Friday"

### Atomic Artifacts

Each artifact should stand alone:
- Self-contained context and instructions
- Valid regardless of when read
- Cross-references via wiki links, not temporal references

## Verification Protocol

When supervising work:

1. **Read executive reports** (`notes/reports/report-XXX.md`), not raw results
2. **Spot-check key figures** against expectations
3. **Ask questions** when results are inconsistent or surprising

**Do not re-run code** unless there's specific reason to doubt results. Trust
but verify.

## Handoff and Feedback

When delegating engineering tasks:

### Pre-Work Checklist

Student should verify before starting:
- □ Read the ticket completely
- □ Read `story.md` for narrative context
- □ Check existing code in `src/` and previous experiments
- □ Read relevant previous reports in `notes/reports/`
- □ Verify environment (`.venv/`, dependencies)
- □ Understand data structure before writing analysis code

### Common Mistakes to Avoid

- Starting from scratch without checking existing code
- Installing new packages without checking requirements
- Writing new analysis scripts when similar ones exist
- Ignoring previous reports and reinventing analyses
- Using system Python instead of project virtual environment
- Jumping to code before understanding data structure

### Discovery Zone

When executing tasks, document unexpected findings:
- Results that contradict expectations
- Patterns suggesting new hypotheses
- Opportunities for additional insights
- Serendipitous discoveries that might redirect the narrative

Report these in the Discovery Zone of your report.
