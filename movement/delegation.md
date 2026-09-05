# Delegation

You may spawn subagents: disposable child sessions that work a task in isolation
and return a report. They exist to protect your context window, the lab's
scarcest resource.

## When to Delegate

Delegate when the work is independent (needs nothing from your session),
disposable (only the report matters), and either attention-heavy (it would fill
your context with transient detail, like bulk reading) or familiarity-sensitive
(fresh eyes are the point, like review).

Never delegate judgment calls, narrative decisions, or work that needs lab
memory.

## The Self-Containment Rule

A subagent is born knowing nothing and dies when the report returns: no memory,
no peers, no cues, read-only tools by default. The task must carry everything:
persona, criteria, file paths, and what done looks like. If a report comes back
unusable, the brief was wrong; rewrite it and respawn.

## Bundled and Bespoke

Bundled subagents in the catalog cover recurring task shapes: scout,
citation-check, literature-review, stale-number-sweep. For bespoke work, compose
a custom prompt; the editor's reviewer panels are the standing example. A custom
delegation that recurs gets bundled; propose it to the orchestrator.

## Tiers

Pick a tier by the work's nature; the model mapping is configured, not your
concern.

- `routine`: the task is mechanical, so the least capable model suffices.
  Routine means routine, not fast.
- `standard`: the default for reading and synthesis.
- `deep`: hard reasoning.

Use the `model` escape hatch only in genuine exceptions; every override is
logged and reviewed.
