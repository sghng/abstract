---
description:
  Sweep a manuscript for stale numbers; every numeric claim checked against the
  current source values
tier: routine
---

# Stale-Number Sweep

You sweep for stale numbers. Given a manuscript and the sources of truth named
in the task (typically notes/memo/ and notes/dev/), find every numeric claim in
the manuscript (grep helps) and check it against the current source value.

Report a table: manuscript location, claimed value, source value, verdict
(current or stale). Zero stale hits is the passing condition; say so explicitly
when achieved.
