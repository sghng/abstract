# repertoire rebuild plan (aligned 2026-09-09)

Decisions from the grill session. Execution order at the bottom. This note
governs the rebuild; docs/repertoire.md gets updated when the rebuild lands.

## Transition log (2026-09-09 overnight, dev agent)

- Raw recovery DONE: 833 psy html re-fetched from Cambridge; 172 JEM raw
  pulled from the old bucket (105 papers are cleaned-canonical: 70
  backfile never synced + 35 recent fetched after the last sync; recorded
  here, not re-fetchable without a headed Turnstile session).
- Bucket repertoire-docs created; 2,542 raw objects uploaded and
  size-verified.
- assets re-keyed to (doi, handle): psy 6,230 rows (short handles; the old
  D1 rows were a partial apply because html2md --apply lacked npx and ran
  a local sqlite silently), jem HTML 9,771 + XML 24,715 upserted.
- Handle unification: psy md regenerated with short handles; gate-diff
  PASSED (5,304 renames, 326 splice-reverts, 0 unexpected).
- Redo-safety gates PASSED byte-identical: psy 833/833 (raw -> clean ->
  lean -> prettier -> convert), jem 583/583, xml-clean 531/531 (custom
  formatter; xmllint --format DROPS significant inter-element spaces,
  503/531 files -- do not use it on Wiley XML).
- merge-tables hardened: number-based alignment (anchored caption numbers,
  sub-table captions like "9a.", continuation grouping by empty caption +
  column count, positional fill only on exact count match, fail-open
  keeps the image ref + report). 18/19 pilot failures now merge; corpus
  run in flight.
- img2latex: 16,521 equation images downloaded live (srcmaps built from
  article pages for 320 papers; dead-era urls ~4K recorded as misses);
  85% of images are sub-20px single-glyph fragments -> placeholder policy
  (fail-open; later context-aware sweep can resolve). DeepSeek OCR for
  the >=20px fragments in flight. Bake-off round 1: M3 and DeepSeek
  identical on real formulas; tiny glyphs M3 guesses / DeepSeek empties
  -- neither meets the near-verbatim bar.
- Known race: merge-tables and img2latex both write md; run-tail.sh
  re-runs the eq splice after merge to repair clobbered papers.

## 1. Clean slate: raw recovery

- Psychometrika: re-fetch all 833 raw HTML from Cambridge (plain curl,
  verbatim, resumable). Current R2 html copies are LEAN (verified), raw is
  gone locally.
- JEM: 172 recent raw HTML preserved in old bucket repertoire-html (synced
  pre-clean; verified raw by size/content). Pull down, verify rawness by
  content inspection. The 70 backfile HTML fallbacks: cleaned local copy
  becomes canonical raw (wart, recorded). XML (704 both journals) and PDFs
  (833 psy) are raw by nature.
- PDFs and all XML go to the new bucket under raw/ unchanged.

## 2. Storage: one bucket `repertoire-docs`

```
raw/<doi_id>.{html,xml,pdf}      # pristine, never rewritten
<doi_id>.html                    # lean formatted (pipeline output)
<doi_id>.xml                     # cleaned/formatted XML (pipeline output)
<doi_id>.md                      # corpus markdown
<doi_id>:<handle>.html           # complex-table attachments
# future lazy figure downloads: <doi_id>:figNN.<ext>
```

- doi_id keeps the `:` convention (flat keys, matches filenames).
  Attachments use `:` separator too; parse with rsplit(':', 1).
- Derived artifacts upload ONLY from the pipeline's final stage: the
  archive is by construction the last successful run's output.
- Old buckets (repertoire-html/md/xml) deleted after the new one verifies.
- D1 stays metadata + pointers. assets re-keyed to (doi, handle, kind,
  url-or-attachment-key); import .cache/jem*-assets.ndjson.

## 3. Pipeline: one end-to-end orchestrator, built for rare runs

- Sequence: raw -> clean -> lean -> format -> convert -> [merge-tables]
  -> [img2latex] -> md-format -> chunk -> embed -> insert -> upload ->
  smoke query. Terminus = queryable index.
- Per journal: JEM = XML-first, HTML fallback (no PDF); psychometrika =
  HTML + PDF tables.
- Annual batch (2026+): list new DOIs only, new papers flow through
  stages, vectors appended. Per-stage checkpoints make everything
  resumable (merge-tables and embed are the long poles).
- Validation gates INSIDE the run: every html/xml cleaning or formatting
  stage is followed by convert + full-corpus MD diff (byte-identical or
  better) and a hard stop on failure. Sampling reports emitted per stage.
- XML: pristine in raw/. Cleaned copy = xmllint formatting, must pass the
  same MD-diff gate (converter must be whitespace-insensitive; if not, the
  gate says so). Eyeball copies are throwaway.
- Vectorize index recreated fresh (delete + recreate with metadata
  indexes), full re-insert (~66K+ vectors; md changes: short handles,
  merged tables, real LaTeX).

## 4. Content decisions

- Handles unified journal-wide to short per-paper ids: fig01, tab01,
  eq0001 (document order). Psychometrika md regenerated; attachments
  renamed to <doi_id>:tabNN.html.
- MD is COMPLETE: real LaTeX where obtainable, tables reconstructed.
- merge-tables is EXPERIMENTAL until the alignment rule set resolves ALL
  conflicts deterministically (pilot: 23% mismatch on 81 papers). Harden
  rules first, eyeball samples (M3 children can read rendered tables),
  then the corpus-wide docling run (MPS, ~10h+, just waiting). Fail-open:
  unresolved table keeps its image asset ref + lands in a failure report.
- img2latex IN SCOPE, sequenced before chunk/embed (one re-embed, not
  two). Equation PNGs (JEM 2020-21) + GIFs (2005-era, converted to PNG)
  downloaded through the headed-Chromium session. OCR via DeepSeek
  v4-flash-vision-exp API (programmatic). Gate: 30-equation sample across
  eras, ~90% near-verbatim before bulk. Splice placeholders in md only;
  full-corpus diff must show only placeholder lines changed. Failures
  stay placeholders + report.
- Chunking: GFM tables are atomic blocks (never sentence-split), and
  table content IS embedded (embed everything; revisit only if query
  quality suffers). Chunking policy documented in docs for audit.
- MD final stage: prettier format ONLY. No downstream fix lists. If
  sampling reveals recurring artifact patterns, fix the upstream
  converter that produces them; never patch md one by one.
- Sampling-and-read at EVERY stage is mandatory (point 8), with special
  attention to math across eras (psy tex-math; JEM 2022+ annotations,
  2020-21 PNGs, 2005 GIF refs).

## 5. Subagents and models (harness owner applies; not dev-agent scope)

- tiers.json: routine/standard = minimax-cn/MiniMax-M3 (multimodal:
  artifact eyeballing, equation/table image reads), deep = zai/glm-5.3
  (advanced coding; glm-5.3-flash noted for bulk-mechanical). Kimi
  dropped from tiers, stays available ad hoc.
- Vision bake-off side quest: M3 vs deepseek-v4-flash-vision-exp on the
  same small task set (equations, table renders); eyeballed verdict,
  informational.
- Programmatic img2latex calls the DeepSeek API.

## 6. Working agreement

- Dev agent scope: repertoire/ and docs/repertoire*.md only. Harness
  files (subagents/, extensions/, src/, movement/) belong to the harness
  owner.
- Commits: conventional, conceptually grouped; squash adjacent
  micro-commits with --amend. Commit as work progresses, not per tiny
  change.

## Execution order

0. Save this note; commit doc/spec work in repertoire scope.
1. Headed Chromium up EARLY so the human clears the Cloudflare challenge
   once; cf_clearance persists in .cache/cf-profile for all session
   traffic (any re-fetches, equation downloads).
2. Raw recovery: psy re-fetch; JEM raw pull + verify; stage pdf/xml.
3. Create repertoire-docs; upload raw/; D1 assets re-key + jem ndjson
   import.
4. Rebuild converter chain with gates: psy short handles, JEM XML+HTML
   converters, xmllint-XML stage, lean stages; full-corpus MD diffs.
5. merge-tables hardening loop -> corpus-wide run + failure report.
6. Vision bake-off (whenever, cheap).
7. img2latex: download pass, 30-sample gate, bulk OCR, splice + diff.
8. MD format round + sampling reads; upstream fixes for recurring
   patterns.
9. chunk (atomic tables, documented policy) -> embed -> insert (fresh
   index) -> smoke query.
10. Upload derived artifacts; verify; delete old buckets.
11. Update docs/repertoire.md + TODO.md decisions log; final commit.
