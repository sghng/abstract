---
name: experiments
description:
  Executing research tickets: experiment directories, the results notebook,
  reports, the key-results registry, data discipline, figures, and the
  checks doctrine for mathematical claims in model/. Use when running an
  experiment, analyzing data, deriving or checking a model, or producing any
  finding the story will cite.
---

# Experiments and Models

The loop: ticket --> experiments or `model/` --> results.md -->
report-NNN --> the primary session.

## Tickets

Read the ticket and `notes/story.md`; understand why the work matters to the
narrative. If the question, deliverable, or a "because" is unclear or
contradicts the story, raise it upfront, not when stuck. Check `src/` and
previous experiments before writing anything new; prefer existing utilities
over reinvention. Report facts fully; framing happens downstream.

## Experiment Directories

One ticket usually means NEW experiment directories (`experiments/NN-name/`):
anything that analyzes, calculates, tests, explores, or determines gets its
own directory, self-contained with its own code, data, and figures. Never
clutter old experiment directories. Rare exceptions: pure logistics,
synthesis of existing work, writer handoff.

Document each experiment in its `results.md`, a comprehensive lab notebook:
methods, data, parameters, all results including nulls and failures,
surprises, dead ends. Write for your future self and for reproducibility. No
synthesis here. Then synthesize findings into
`notes/reports/report-NNN-name.md`: the report is the mini paper, what
matters, why it advances the narrative, honest limitations, and recommended
next steps.

## Data Discipline

Inspect first, analyze second; stay close to the data.

- Examine structure before calculating: columns, types, missing values, and
  what "empty" means in this dataset (NaN, blank, whitespace).
- Filter before counting; count valid observations, not rows.
- Never aggregate across dimensions; each dimension gets its own statistics.
- Show the full breakdown before the summary statistic. "Mean = 0.85" alone
  is unanswerable; counts or the matrix first, then the mean.
- Explore before confirming: distributions, patterns, outliers first, formal
  analysis after. Be open to findings that contradict expectations.
- Report sample sizes with every statistic; show variance, not just means;
  document outliers and edge cases.

## Figures

Figures live in the experiment's own `figures/` directory under descriptive
kebab-case names (`acceptance-by-model.png`, not `fig1.png`), are
publication-ready (clear labels, adequate resolution), and are referenced
from the report with captions.

## Proactive Discovery

When the ticket asks for A, B, C and expertise says D is an obvious
alternative or a missing control, test it too. Add when the literature
suggests it or the design is incomplete without it; skip when it delays
delivery or drifts from the narrative. In the report, state clearly what was
requested versus what was added, and why; surprises and serendipitous finds
belong in the report's Discovery Zone.

## Model Development

`model/` holds one directory per model, self-contained. `main.typ` grows in
place in sections (model, assumptions, derivations, estimator, evaluation
plan, status); a superseded model gets a status line, and history stays in
place. `checks/` holds one script per check, each stating the claim it
tests, the pass criterion, and how to run; `figures/` holds check outputs
worth eyeballing. The Typst source is the artifact; a compiled PDF is a
build product.

### Checks

A major claim is done when a check exists that runs in seconds, names its
claim and pass criterion, and has been seen to fail: corrupt the mathematics
deliberately, watch the check go red, restore. A check that cannot fail is
deleted.

Pick the cheapest check that can kill the claim:

1. Reduction to a special case with a textbook answer.
2. Symbolic (SymPy): differentiate, simplify, or substitute the claimed
   estimator into the score and reduce to zero.
3. Derivative cross-examination: hand-derived score or Hessian against
   finite differences or autodiff of the coded log-likelihood.
4. Score at truth: evaluate the score at simulated true parameters, without
   an optimizer.
5. Parameter recovery: simulate, estimate, recover within a stated Monte
   Carlo tolerance, fixed seed.
6. Asymptotic probes: consistency as n grows, interval coverage. Heaviest.

A check that outgrows seconds has become an experiment. `main.typ` carries a
checks table (claim, script, status) kept current with both; that table is
the record.

### Statistical Advice and Prospection

Name the model, metric, or estimator a scenario calls for, with the
assumptions it rests on; reply as a pointer. Reading `notes/story.md`, flag
the statistical gaps nobody asked about: identification, power, the wrong
metric, an untestable claim.

## Compute and Stack

Checks run in seconds on the project interpreter via `uv run`; numpy and
scipy always, SymPy available, autodiff on first need. The machine is local
and CPU-bound, so derivations are pen and paper with light numeric checks.
