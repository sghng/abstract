# Rebuild runbook

The from-zero recipe, one command sequence per phase. Rationale and
compared alternatives live in the layer docs (see the manual map in
`index.md`); this page is only the order of operations. Everything
below was executed 2026-09-15/16 to build the current corpus; the
commands are the proven path, not projections.

Assumes: macOS + Bun, pandoc 3.x, a Python venv with docling (see
`repertoire/legacy/` for the pinned versions), wrangler CLI, and a
Cloudflare account holding R2 bucket `repertoire-docs`, D1 database
`repertoire`, and the Vectorize index. `CF_API_TOKEN` (R2 + D1 write)
in the repo root `.env`; never ambient, never printed.

## Phase 0: storage + schema

1. R2 bucket `repertoire-docs` (flat pristine namespace
   `raw/<doi_id>.<fmt>`; derived prefixes come with Phase 4).
2. `npx wrangler d1 execute repertoire --remote --file
   repertoire/schema.sql` (papers, sources; docx is a first-class
   format).
3. Local tree: `repertoire/.cache/bulk/<family>/` for run state,
   `repertoire/raw-new/` as the canonical flat mirror (never cleaned;
   manifests stay verbatim-valid forever).

## Phase 1: listings (per family)

```
bun src/families/<fam>/list.ts          # listings are additive
```

Produces each family's task list (dois + era metadata). Listings are
idempotent; re-run anytime to pick up new issues.

## Phase 2: fetch

- Single-host scale (the journal families): recipes per family in
  `fetch.md` (Cambridge eras, Wiley XML + alias DOIs, SAGE uniform DOM,
  OSF/psyarxiv including .docx primaries). Each fetcher is resumable:
  it skips saved dois and appends to the family manifest.
- Fleet scale (arxiv): the host pattern in `hostfleet.md` -- task
  split, per-host staging, wave syncs with an integrity gate
  (gzip -t) BEFORE any prune, detached processes, one cycle per
  steward invocation. Fetch everything with metadata intact; filter
  later.

## Phase 3: upload + D1 apply (per family, serialized)

```
bun src/upload-bulk.ts --family <fam>    # diffs checkpoint vs manifest
npx wrangler d1 execute repertoire --remote --file .cache/bulk/d1-papers.sql
npx wrangler d1 execute repertoire --remote --file .cache/bulk/d1-sources.sql
```

One uploader at a time (shared checkpoint + SQL paths). Re-run until
checkpoint == manifest rows with local bytes; the manifest can run
ahead of local bytes between waves. Apply SQL only from the LAST pass
of the LAST family state -- count-verify papers/sources afterward.
Spot-verify objects: REST GET with the key fully percent-encoded
(colons included), compare sha256 + bytes.

## Phase 4: derive Markdown

Route per format (verdicts + invariants in `parse.md`):

```
bun src/tex-extract.ts --batch ...       # arxiv e-print tars -> .tex
bun src/tex-convert.ts --batch ...       # latex -> md (pandoc ladder)
bun src/families/jem/jemxml2md.ts ...    # Wiley XML (jem, bjmsp)
bun src/families/jebs/jebs2md.ts ...     # SAGE html + JATS xml
bun src/families/psyarxiv/docx2md.ts --batch ...
python repertoire/legacy/pdf2md.py ... && bun src/pdf-wrap.ts --batch ...
```

Every converter emits report.jsonl (ok/skip/fail) + skipped.jsonl.
Observed artifacts become rules in the script that produced them, plus
regression samples in that route's samples set -- never manual md
patches. Re-verify the sample set after any converter change.

## Phase 5: serving

Chunk + embed + load (spec in `index.md`): D1 chunks keyed
(doi, chunk_no), Vectorize metadata as filter facets only, md fetched
from R2 by pointer. Gate: whole-corpus byte checks before index swap.

## What is NOT in this repo

Ephemeral run state: manifests, wave logs, OPS-LOG, upload checkpoint,
sample scratch -- all under `repertoire/.cache/` (gitignored).
Working memos live in `repertoire/.cache/notes/`. The durable record
is this directory plus the code.
