---
name: engineering
description:
  Research engineering procedures -- experiments, code and data conventions,
  data analysis, figures. Use when writing or running code, creating
  experiments, analyzing data, or producing figures.
---

# Engineering

This skill covers the engineering _procedures_ of academic research: how to run
experiments, organize code and data, analyze data, and produce figures.

The invariant project layout, file naming, and wiki-link conventions are defined
in the team kernel (`AGENTS.md`, always loaded). Templates for tickets and
reports live in the logistics skill.

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

## Data Analysis Conventions

### Before You Analyze

**Inspect first, analyze second.**

1. **Check existing code**: Look in `src/` and `experiments/` for reusable
   utilities before writing new scripts.

2. **Understand data structure**:
   - Load data and examine structure before calculations
   - Check column names, data types, missing values
   - Read project-specific documentation on data conventions

3. **Verify assumptions**:
   - What does "empty" mean in this dataset? (NaN, empty string, whitespace?)
   - What are the expected value ranges?
   - Any special encoding or categorical mappings?

### Data Quality Rules

1. **Filter before counting**: Most review/analysis cells will be empty. Always
   filter empty/NaN values before calculating statistics.

2. **Count completed observations**: Count actual valid ratings/measurements,
   not rows in the spreadsheet.

3. **Never aggregate across dimensions**: If analyzing 7 quality dimensions,
   calculate statistics separately for each dimension. Do not average across
   dimensions.

4. **Show intermediate work**: Present the full matrix or breakdown before
   aggregated results. Example:
   - BAD: "Mean = 0.85" (where did this come from?)
   - GOOD: Show the count per category, then calculate mean

### Analysis Workflow

1. **Load and validate**: Load data, check structure, validate assumptions
2. **Filter and clean**: Remove empty values, handle edge cases
3. **Calculate comprehensively**: Show full breakdowns before aggregation
4. **Document methodology**: Explain what you counted and why
5. **Report findings**: Write to `notes/reports/`, not just `results.md`

### Analysis Principles

**Explore Before Confirming**

Always begin with exploratory analysis before testing hypotheses:

- Load data and visualize distributions first
- Look for patterns, outliers, and unexpected structures
- Document initial observations before formal analysis
- Be open to findings that contradict expectations

**Analyze Full Picture, Then Synthesize**

1. **Start comprehensive**: Show the complete breakdown before aggregation
   - BAD: "Mean = 0.85" (opaque)
   - GOOD: Show counts/tables per category, then calculate mean

2. **Present intermediate results**: Full matrices, cross-tabs, or breakdowns
   before summary statistics

3. **Synthesize into narrative**: After seeing the full picture, identify:
   - The strongest patterns
   - Surprising findings
   - What supports or complicates the story

**Prefer Positive Framing**

When analyzing and reporting results:

- "Higher success rate under condition X" rather than "Lower failure rate"
- "Items showed quality retention" rather than "Minimal degradation"
- Frame findings around what works, not just what doesn't
- Highlight model strengths, not just limitations

**Stay Close to the Data**

- Avoid premature aggregation
- Report sample sizes with all statistics
- Show variance, not just means
- Document outliers and edge cases

### Figure Generation

- Save figures in experiment directory (e.g., `experiments/01-name/figures/`)
- Use descriptive filenames: `acceptance_by_model.png`, not `fig1.png`
- Include captions in reports referencing figure files
- Ensure figures are publication-ready (clear labels, appropriate resolution)

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

- GOOD: Sequence: "Complete Task 1 before Task 2"
- GOOD: Priorities: "Task A is critical; Task B is secondary"
- GOOD: Dependencies: "Requires completion of experiment 01"
- BAD: Dates: "Complete by June 14"
- BAD: Deadlines: "Due next Friday"

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

The engineer verifies before starting:

- [ ] Read the ticket completely
- [ ] Read `notes/story.md` for narrative context
- [ ] Check existing code in `src/` and previous experiments
- [ ] Read relevant previous reports in `notes/reports/`
- [ ] Verify environment (`.venv/`, dependencies)
- [ ] Understand data structure before writing analysis code

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
