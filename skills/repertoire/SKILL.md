---
name: repertoire
description: >-
  The convention corpus: query published psychometric writing with draft
  prose, filtered by section, venue, year, or paper. Use while drafting or
  reviewing prose to match a venue's register, to settle whether a phrase is
  plain, or to trace a convention across a paper. Not for literature search;
  that is the literature skill.
---

# Repertoire

The repertoire is the lab's corpus of published venue writing, served as
the abstract MCP server's `repertoire_query` tool over a Vectorize index
plus D1 metadata plus R2 markdown
stores. Query in the register you want back: draft prose retrieves published
prose.

## Invocation

Call `repertoire_query` on the abstract MCP server: the draft prose as
`query`, plus `top_k`, `max_per_paper`, and the facet filters
`section`, `journal`, `year`, `doi` as needed. The tool runs the
hybrid engine, embedding similarity fused with keyword match, then
reranked.

The CLI remains for scripts and bulk passes, run from the abstract repo
root (it reads the repo's `.env`; it is the dense-only path, no keyword
leg):

```bash
bun ~/dev/abstract/repertoire/src/query.ts "your draft sentence or paragraph"
bun ~/dev/abstract/repertoire/src/query.ts --file draft.md --top-k 8 --year 2024
bun ~/dev/abstract/repertoire/src/query.ts "..." --doi 10.1017/psy.2025.10034
bun ~/dev/abstract/repertoire/src/query.ts "..." --section methods --prefer discussion
bun ~/dev/abstract/repertoire/src/query.ts "..." --max-per-paper 1
```

Each hit bundles score, DOI, title, journal, year, section, heading, and the
passage with its line span. Retrieved markdown caches locally forever;
repeat papers are free.

## Reading the Results

Query one paragraph or two at a time, with `section` set to the matching
bucket (abstract, introduction, methods, results, discussion, conclusion).
The conventions that matter are paragraph-level: how claims are hedged, how
numbers are reported, how citations sit in sentences, how a section opens
and closes.

Scores guide confidence: hits at 0.45 and above mean the corpus speaks to
this passage; below 0.40 the corpus has no close convention, so judge from
general academic register and say so.

The corpus settles register doubt: a phrase the target venue publishes
routinely is plain. The corpus manual (`docs/repertoire/` in the abstract
repo) holds the store layout and the collection recipes.
