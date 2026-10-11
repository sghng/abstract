# Verification Conventions

Three standing rules for anything that leaves the lab. Each is born from an
error that shipped. When a rule bites, the failure mode is always the same:
a description drifted from the thing it described, and nothing checked.

## 1. Instrument of Record

Any text that reproduces an operative instrument — instructions, rubrics,
criteria, prompts, survey items — is copied verbatim from the instrument's
canonical file, never paraphrased. A gloss is itself a defect, even when it
reads better. When a manuscript section quotes an instrument, the copied
text is diffed against the canonical file before any review round.

## 2. Computation of Record

Methods-section model descriptions are verified against the actual
computation — not code comments, not package defaults, not memory. When a
software label does not literally state the model (e.g., which ICC form a
package computes), verify against the primary source's formulas and record
the verification beside the pipeline.

## 3. Model-Identity Check

Every analysis pipeline carries one small verification script next to it
that asserts what the computation actually is — model form, estimator, key
settings — and the script is rerun whenever the pipeline changes. This is
the standing mechanism that operationalizes Rule 2: the check, not the
researcher's recollection, is the description's source of truth.
