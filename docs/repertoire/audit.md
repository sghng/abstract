# repertoire ETL audit (2026-09-14)

Full audit of the repertoire ETL: fetch, clean/convert, storage, pipeline, and
the shipped dataset. Method: four independent code/data reviews (fetch
Cambridge, fetch Wiley, clean/convert, corpus sampling) plus independent spot
verification of every high-severity claim against live artifacts. Scope:
`repertoire/`, `extensions/repertoire/`, `docs/repertoire*.md`.

**Verdict:** the architecture is sound and in places better than industry norm
(immutable md + pointer serving, whole-corpus byte gates, fail-open doctrine).
The execution is the weak layer: the committed orchestrator has never run (no
`.cache/pipeline-*.json` exists; the live corpus was built by `run-tail.sh` /
`run-tail2.sh` waiting on `pgrep`), several confirmed data bugs shipped into D1
and the md, and the build is not reproducible from the repo alone.

Grades: fetch B-, clean/convert C+, dataset C (psy B+, JEM D+), storage B+,
orchestration C.

## 1. Fetch and pull (B-)

Happy path proven at ~2,200 papers (833/833 psy raw, 823 PDFs, 172/172 recent
JEM, 471 backfile). Wiley content guards (`<article` + size floors) caught
dozens of stub XMLs. Structural debts:

**High**

- `coverage.ts:40-62`: error pages and thrown fetches cached as permanent
  `fulltext:false`; no `res.ok` check, resume never re-queries. Now also
  broken-by-data: it reads the merged `papers.json` whose 583 JEM rows lack
  `article_url`, so a rerun appends 583 poisoned rows.
- `fetch.ts:69,93-105`: terminal `failed` state, no requeue; D1 updates buffered
  to end-of-run, so a crash leaves files on disk but D1 `listed` forever (rerun
  skips the file, emits no update). Split-brain by design.
- `jem-fetch-headed.ts:104-107`: stale `resp` captured before human clearance;
  every article that triggers a challenge is forfeited that run (confirmed in
  `misses.log`). `jem-fetch.ts` fixed this by re-navigating.
- `list.ts:139`: rerunning listing overwrites the merged `papers.json` (849
  psy + 583 JEM), wiping the JEM half.

**Medium**

- No timeouts/retries on any plain `fetch()` (list, fetch, fetch-raw, coverage,
  jem-list); only `download.ts` and `xml.ts` retry. No 429 handling anywhere.
  `fetch.ts` pairs the highest request rate (6 workers, no delay) with the
  harshest failure policy (terminal `failed`).
- `xml.ts:60`: no stub detection on Springer JATS (the exact 200+3KB stub the
  Wiley path guards against).
- `auth-chromium.ts:13` / `verify-clearance.ts:12`: target `besjournals...` host
  while fetches hit `onlinelibrary.wiley.com`; cf_clearance is host-scoped, so
  the helpers can certify a profile that still fails on the real host.
- `download.ts`: magic-byte check only (no `%%EOF`/content-length); non-atomic
  `curl -o`; no D1 transition; 823 PDFs vs 833 papers with no durable record of
  the 10.
- `jem-inserts.sql` uses `insert or replace`: re-applying clobbers
  state/pdf/sha256 columns.

**Producers missing from the repo** (build not reproducible): the merged
`papers.json`, `jem-papers-legacy.json` (2005-2019 list), `download-updates.sql`
(the only sha256 writer; nothing hashes or verifies PDFs), the `chunks` table
DDL, and the Vectorize repair tooling (the documented REST `/upsert` fix for
wrangler's silent drops exists only as prose in a gotcha).

## 2. Clean, parse, dataset quality (C+ / dataset C)

Prose: low risk, high quality. Token/restore around turndown is leak-free (zero
`@@MATH`/`@@BLK` residue in 1,416 files); zero HTML entities, zero nav chrome,
zero MathJax leakage corpus-wide. Psychometrika md is genuinely good.

**Confirmed shipped bugs** (each independently verified):

1. **Psychometrika references silently dropped, all 833 papers.** `html2md.ts`
   converts only `div.abstract` + `div.body`; `lean.ts:53` preserved `div.back`
   (references) and nothing reads it. JEM keeps references (531/583). In-text
   citations survive ("Reference Rubin1976") without referents, for one journal
   only. The md gate cannot see it (reference corpus made by the same
   converter). Largest silent content drop. Product decision needed: restore psy
   references, or strip JEM's and document "prose-only corpus" as policy.
2. **Every Cambridge asset row has `url: null`** (all 6,230). `html2md.ts:89`
   removes every `<img>` including those inside `fig-ada`/`table-wrap-ada`
   before line 105 reads `data-src`. Provenance lost; roadmap item 3 (batch
   figure download) silently blocked for psy. Fix: figure pass before img
   removal, re-run convert (md bytes unchanged except asset refs), re-push asset
   rows.
3. **D1 captions carry raw `@@MATHn@@` tokens** (2,043 rows in `assets.sql`):
   captions extracted after math tokenization. md is fine; the metadata channel
   is corrupted and the gate cannot see it.
4. **JEM equations missing or garbage at scale.** 255+/583 JEM files still
   contain `@@eqNNNN@@` placeholders (in tables, one heading); >1,000 equation
   images from 2005-2007 permanently missed ("no body (0B)"); landed OCR
   includes garbage that passed the sanity gates (`$01 = \frac{0}{20}$`,
   `p(a) = mse`, `W = |`); truncation undetected (`max_tokens: 700`, no
   `finish_reason` check). `img2latex-report.json` is `{}` despite thousands of
   `fail:` states (report is last-run-only).
5. **merge-tables' central invariant assumed, not verified.** `tabNN` is a
   document-order counter from `html2md.ts`; merge keys on parsed PDF caption
   numbers; one unnumbered/out-of-order table-wrap shifts every later splice in
   that paper, wearing the correct HTML caption (line 215 takes the caption from
   the md token, never compares to the PDF caption). Shipped damage:
   column-fused 2012-era tables (`md/10.1007:s11336-012-9301-5.md:534-555`),
   mangled hierarchical headers, PDF text-layer spacing artifacts (`3 . 74`), a
   dropped display equation. Fail-open paths are real and frequently exercised
   (579 merged / 228 no-tokens).
6. **JEM complex tables point at nothing.** `jem2md.ts:117-120` and
   `jemxml2md.ts:202-204` emit `![caption](tabNN)` + asset rows but no
   attachment is ever written (contrast psy's `assets/<doi>:tabNN.html`).
7. **Silent-drop branches, no placeholder/log/report:** un-annotated `<math>`
   deleted (`jem2md.ts:58-61`); figures with non-matching `src` removed with
   captions; `span.alternatives` without `tex-math` erased to a space.
8. **`img2latex.ts:199-201` async-filter bug:** `Array.filter(async ...)` never
   filters, so every full run re-downloads ~20K images through the
   clearance-riding browser, ignoring the persistent miss list. Cost and
   bot-pressure, not corruption. `pipeline.ts:138` passes `--journal jem`, a
   flag the script does not parse; the psy chain re-walks `jem/md`.
9. **JEM citation-year stripping** ("Davey & Lee, ; Eignor, ;", "see Table for
   illustration") in the 2020+ era: cross-reference xrefs unwrapped without
   fallback text.

**Gate assessment:** gate-diff enforces the cleaning doctrine but has two
structural blind spots: files missing from the new corpus are never checked
(`gate-diff.ts:60` iterates newDir only), and nothing outside md bytes is gated
(exactly where bugs 2 and 3 lived). `--validate` is wired for psy only
(`pipeline.ts:184`).

## 3. Storage scheme (B+)

Strongest part of the system: one bucket with prefix encoding nature not stage;
D1 metadata+pointers only; Vectorize metadata = filter facets only; passages as
line-span pointers into immutable md (drift structurally impossible); raw
preserved pristine.

Issues, severity order:

- **Schema not reproducible:** `schema.sql` lacks the `chunks` table (its DDL
  exists nowhere in the repo; the serving stack depends on it).
  `assets.attachment_key` was added by an inline `alter table` inside
  `upload-eq-assets.ts:65`. Norm: checked-in migrations.
- **Increment hazard in `insert-vectors.ts`:** batches rebuilt deterministically
  from all checkpoints, but `insert-state.txt` skips by batch name. After an
  increment the boundary batch's content changes while its name stays skipped:
  up to 999 new vectors silently never inserted. The documented 2026 increment
  path trips this on first run.
- **No vector count verification** after insert despite the documented wrangler
  silent-drop incident (~17K lost once). Smoke checks 8 matches, not census.
- **Two query clients, one contract:** `src/query.ts` and
  `extensions/repertoire/index.ts` reimplement the contract with drift
  (string-interpolated SQL vs bound params; the extension's search pulls all
  chunks for matched papers, unfiltered by `chunk_no`; duplicated `SECTION_MAP`
  between chunk.ts and embed.ts). Extract one shared module.
- **md is not self-contained:** `](tabNN)` refs resolve only through D1
  (`attachment_key`), and no serving path ever resolves them; attachments are
  stored but unreachable through the tool. Fine for prose imitation; flag as a
  dataset-design choice.
- **Documented lineage wart:** 105 JEM papers' `raw/` is cleaned-canonical HTML,
  not pristine (rebuild doc). 9 durably dead JEM DOIs.
- **Dead/stale code:** `sync-r2.ts` syncs the deleted per-extension buckets;
  `upload-derived.ts` docstring promises `xml-clean/` upload its SOURCES omit;
  `run-tail*.sh`, `pull-raw.ts`, `migrate-assets.ts`, `jem-pilot.ts` are
  one-offs mixed into the durable stage set; `embed.ts` comment says ~96K
  groups, code says 60K.
- **Operational:** per-object `npx wrangler` spawns for tens of thousands of R2
  puts/gets (S3 API/rclone is the standard answer); index rebuild is
  delete-then-recreate (tool downtime each full rebuild; build a new index and
  swap, or document); hardcoded account ID and D1 database ID in source.

## 4. Pipeline: batch vs online

**Recommendation: stay batch, make the one command real.** Online is the wrong
target: cadence is annual (~100 papers/year across two journals), the Wiley
fetch path fundamentally needs a human Turnstile click, and the rebuild
economics (re-chunk, re-range, re-embed everything on any md change) punish
frequent small runs. The Makefile model is right: one recipe, checkpointed
stages, declared inputs/outputs.

The uncomfortable finding: **the recipe exists and was never used for the actual
build.** `pipeline.ts` is the right shape (stage chains, `--from/--to`,
checkpoint file, validation gates), but:

- No `.cache/pipeline-*.json` exists; the logged provenance of the live corpus
  is `run-tail.sh` waiting on `pgrep -f merge-tables.py` plus manual stage runs.
  The known race (merge-tables and img2latex both write md) exists because the
  real run was concurrent shell jobs repaired afterward by re-splice.
- The orchestrator is incomplete: omits ingest (list/fetch/download), **omits
  `load-chunks` entirely** (a truly fresh run smoke-tests against stale D1 chunk
  pointers), runs `img2latex` in the psy chain where it re-walks `jem/md` (with
  the filter bug, re-downloading 20K images), passes an unparsed `--journal`
  flag, wires `--validate` for psy only.
- The 2026 increment path trips the insert-state hazard on first run.

Action: fix the orchestrator, then rebuild provenance (run the current corpus
through it or a documented equivalent, so the live dataset has a reproducible
birth record), and delete the tail scripts.

## 5. Best-practice conformance

| Practice                             | Status                                                                                                                                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medallion layout, immutable raw zone | Conforms, well executed                                                                                                                                                                                                         |
| Idempotent, resumable stages         | Partial: file-existence checkpoints, but non-atomic writes in every stage (no tmp+rename); some stages not idempotent (coverage negatives, merge-tables error checkpointing, insert-state collision)                            |
| Data validation                      | Mixed: byte gates stronger than typical for regression, but zero content assertions (abstract/references present, captions parse, asset urls non-null, chunk census) and the gate is blind to missing files and non-md channels |
| Orchestration                        | Non-conforming in practice: ad-hoc pgrep-waiting shell scripts did the real build                                                                                                                                               |
| Schema management                    | Non-conforming: incomplete checked-in DDL, inline alters as migrations                                                                                                                                                          |
| Observability                        | Weak: per-run reports overwrite; failures stdout-only in most stages; nothing aggregates "what is the corpus missing"                                                                                                           |
| Retry/backoff                        | Inconsistent: present in download/xml/embed/upload, absent in core fetch                                                                                                                                                        |
| Secrets/config                       | Fine; minor: hardcoded account/database IDs                                                                                                                                                                                     |
| Tests                                | None for converters; the empirical gate is the only harness                                                                                                                                                                     |

Verdict: the design conforms and sometimes exceeds; the operationalization
(atomicity, migrations, assertions, single execution path, aggregate reporting)
does not yet.

## 6. Remediation plan

**P0: repair shipped data corruption**

1. Fix `html2md.ts` img-removal ordering + caption token timing; re-run convert
   for psy (gate verifies md bytes), re-push asset rows. Restores 6,230 urls,
   cleans 2,043 captions.
2. Decide references: restore psy `div.back`, or strip JEM's and document the
   prose-only policy. Product decision; changes what the writer imitates.
3. Add a caption-number cross-check to merge-tables before any splice (silent
   misalignment becomes the existing fail-open path); re-audit partial/failed
   papers in the merge report.
4. Fix the `img2latex.ts` async filter + `finish_reason` truncation check before
   any further OCR; decide whether spliced OCR garbage (the
   `$01 = \frac{0}{20}$` class) gets a detection-and-revert pass.

**P1: make the pipeline the single path**

1. `pipeline.ts`: add `load-chunks` after chunk, add optional ingest stages,
   scope img2latex per journal, wire `--validate` for JEM, add post-insert
   vector census (count vs `.cache/vectors/`), add the missing-files direction
   to gate-diff. Delete `run-tail*.sh`, `sync-r2.ts`.
2. Fix `insert-vectors.ts` for increments (content-aware state, or per-doi
   append mode).
3. Commit the missing producers: `chunks` DDL into `schema.sql`, the papers.json
   merge step, jem legacy listing, the PDF sha256 writer, the vector repair
   script.

**P2: hygiene**

1. tmp+rename on all file writes; consolidate one-off scripts into
   `repertoire/oneoff/`; unify the two query clients into one shared module;
   per-stage durable failure manifests; one aggregate `report` stage answering
   "what is missing, per journal, per stage".
2. Optional: S3-API bulk transport for R2, index swap for zero-downtime
   rebuilds, unit tests for the token/restore core.

**Compliance note:** the corpus is fetched behind a bot wall with human
Turnstile clicks. For a private research corpus that is a made decision, but
keep it out of any redistribution path; the R2 bucket and any future Worker
endpoint inherit that constraint.
