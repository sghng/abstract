---
name: lint
description: >-
  EXPERIMENTAL, never mounted by default. Style-checks prose against the
  calibrated house rule set, judged paragraph by paragraph. Use only when the
  user explicitly asks to lint a manuscript or a passage.
---

# abstract lint (experimental)

The linter judges each paragraph of a manuscript against the calibrated rule
set (`lint/rules.yaml` in the abstract repo, distilled from expert edits).
It lives in staging because it is not fully functional yet; thresholds and
the rule set still drift.

Run it from the abstract repo root:

```bash
bun ~/dev/abstract/lint/cli.ts <file.typ|file.md>
echo "a prose passage" | bun ~/dev/abstract/lint/cli.ts -
```

Output: one line per hit, `R53 p=.78` style, with the lesson inline. The
informative band is p >= 0.75 (the default threshold); below that,
inapplicable rules park around 0.5 and flag everything. Exit 0 clean, 1 hits
found, 2 error.

The doctrine behind the calibration (what was tried, what was dropped, why
the threshold is 0.75) lives in `MEMORY.md` and the repo's git history.
