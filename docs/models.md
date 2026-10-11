# Model assignment

Rationale record for the model pins; ground truth is the frontmatter of
`config/agents/*.md` and the default in `config/opencode.json`. This page
is updated when pins change, not consulted to decide them.

## Current pins (verified 2026-10-11)

| Agent | Model | Shape |
| ----- | ----- | ----- |
| default (server, bespoke spawns) | `kimi-code-plan-global/kimi-for-coding` | cheap default for scratch instances |
| orchestrator | `kimi-code-plan-global/k3` | 1M context, 2x plan quota; long-lived sessions |
| statistician | `kimi-code-plan-global/k3` | derivations, long working context |
| writer | `kimi-code-plan-global/k3` | long drafting sessions |
| librarian | `kimi-code-plan-global/k3-256k` | same weights, 1x quota; the window is enough |
| engineer | `kimi-code-plan-global/kimi-for-coding` | K2.8, efficient thinking, cheap execution |
| editor | `deepseek/deepseek-v4-pro` | the coldest read in the loop |

Subagents: `scout`, `nlpatch`, `citation-check`, `stale-number-sweep` on
`kimi-for-coding`; `literature-review`, `style-check`, `reviewer-kimi` on
`k3-256k`; `reviewer-deepseek` on `deepseek-v4-pro`; `visual-review` on
`opencode/claude-opus-5-5` (vision).

## Principles

- Assignment by shape, not by rank: the 1M window goes only where it earns
  itself (long-lived sessions, derivations); execution-shaped work runs on
  the cheap efficient tier; the editor's cold read shares lineage with its
  reviewer panel.
- The reviewer panel is two lineages (kimi, deepseek-v4-pro). Reviewer-zai
  and reviewer-minimax were retired with the 2026-09-28 consolidation;
  varying model family x familiarity is the panel's axis, not vendor count.
- Older Kimi tiers (K2.5, K2.6) were evaluated and skipped: per-token via
  openrouter loses to K2.8 inside the plan for every subagent shape run.

## Failure mode on record

Credential re-syncs can rename provider ids (`kimi-for-coding` became
`kimi-code-plan-global` once), and every pin naming the old id silently
stops resolving: sessions fall back to the default while the agent files
still claim the old model. Symptom and diagnosis: the session DB shows
which model actually served turns. When a provider id changes, sweep every
pin the same day.
