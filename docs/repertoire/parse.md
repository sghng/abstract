# Parse layer: routes, converters, verdicts

The md contract and the converter inventory. The route verdicts below are the
distilled experiment record; the per-paper quality and failure ledger for the
2026 round is [parse-report.md](./parse-report.md).

## Owner mandate (2026-09-16)

The corpus serves BOTH the writer's retrieval tool AND CPT/SFT training data:

1. **No bibliography lists.** References stripped at conversion (cut the source
   construct pre-conversion: thebibliography env, bib commands, html/xml
   ref-list nodes). In-prose citations stay; author bios stripped;
   acknowledgments kept.
2. **Sections are load-bearing structure.** Every section boundary an ATX
   heading; downstream needs per-section targeting, continuation training, and
   barebone/expanded pairs on faithful headings + paragraph boundaries.
3. **Faithful prose above all.** No OCR-class errors, no mangled math, no
   flattened tables. Attachment beats corruption.

No manual md patches, ever: an observed artifact becomes a RULE in the producing
converter, and the exposing paper joins that route's samples as a standing
regression case. Exceptions a rule cannot fix land in a documented
terminal-exceptions list. Batch runs emit per-item report.jsonl
(stub/fail/escalate classes); silence is the only unhandled state.

## Route table (current truth)

| family x format     | parsed             | converter                           | verdict                                                                                                      |
| ------------------- | ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| arxiv html          | 4,702 + go-forward | axhtml-fetch + axhtml-convert       | CANONICAL: arxiv.org/html, ar5iv fallback; per-item contest vs docling (ship on more headings AND more math) |
| arxiv tex           | 133,914            | tex-extract + tex-convert           | HISTORICAL: LaTeXML + pandoc ladder. Tarballs purged; superseded by the HTML route          |
| arxiv pdf           | 11,158             | docling + pdf-wrap                  | baseline: prose-only fidelity, zero display math                                                             |
| psyarxiv pdf        | 2,031              | docling + pdf-wrap                  | crash-prone tier (3,457 failures, no alternative source)                                                     |
| psyarxiv docx       | 675                | docx2md + docx-heal.lua             | bold-heading heuristic P=.996 R=.922                                                                         |
| psychometrika html  | 833                | psychometrika/html2md.ts            | Cambridge full-text HTML, tex-math spans verbatim                                                            |
| psychometrika pdf   | 2,632              | docling + pdf-wrap / olmOCR (scans) | pre-1961 scans need OCR; 2012+ pdf is table-source only                                                      |
| jem xml             | 573                | jem/jemxml2md.ts                    | Wiley XML, per-paper availability                                                                            |
| bjmsp xml           | 297                | jem/jemxml2md.ts                    | alias-DOI handling recovers the 10.1348 era                                                                  |
| jebs xml            | 554                | jebs2md xml sub-route               | SAGE JATS, mml:math via pandoc                                                                               |
| jebs/bjmsp/jem html | captures only      | none                                | abstract-only sources; ride the pdf twin                                                                     |

## Verdicts that bind future rounds

- **HTML over tex for arXiv** (owner decision 2026-09-24): LaTeXML output has
  real math and clean structure; raw TeX needs a fragile ladder (r0-r3
  preprocess + pandoc + LaTeXML escalation) to reach the same place. New arXiv
  rounds fetch HTML directly; tex tarballs are not stored.
- **docling's profile**: prose faithful, display math dropped 100% (`[formula]`
  placeholders on math-bearing pdfs), headings flattened (wrap stage
  promotes), crashes outright on a large minority of psyarxiv preprints, and its
  text on scan-quality pdfs
  lacks heading structure entirely. The wrap stage's no-headings gate is the
  correct terminal classifier for scans.
- **olmOCR** won the scan bake-off (prose, value-perfect tables, display math
  with tags, chrome removal). nougat typesets math best but silently omits content; tesseract is the
  CPU baseline; marker never ran (needs Docker for vllm).
- **markdown writer, never gfm**: pandoc `-t markdown` lands math natively as
  $/$$; gfm fenced math silently drops citations and corrupts adjacency. This
  single flag was docx route's entire problem.
- **XML beats HTML** (stable schema, source-form equations/tables, no eras);
  stub XMLs (Early-View 5KB) rejected at fetch, HTML stands.
- `\paragraph` emits as bold lead-in pre-conversion; `# <title>` is required
  (title glue from \title/centerline/center-env).

## Converter inventory (graduated, src/ homes)

- `src/families/*/`: per-family list/fetch (fetch.md); converters
  `jem/jemxml2md.ts`, `src/families/jebs/jebs2md.ts` (html + xml),
  `psychometrika/html2md.ts`, `src/families/psyarxiv/docx2md.ts` +
  `docx-heal.lua`.
- `src/pdf-wrap.ts`: journal-agnostic post-docling wrap (title promotion, refs
  strip, hierarchy repair, chrome rules, asset-key normalization,
  degenerate-scan gate). CLI: `<doi_id>` | `--batch <rows.jsonl>`.
- `src/tex-extract.ts`, `src/tex-convert.ts`: the historical tex route, kept as
  record; not for new work.
- `src/cluster-parse/`: the campaign tools (fetch: `axhtml-fetch.py`; convert:
  `axhtml-convert.py`; sweeps `md-stats*.py`, `md-leakfix.py`, `declutter.py`;
  packaging `build-hf-parquet.py`, `build-hf-raw.py`, `validate-checkpoint.py`,
  `raw-backup-local.py`, `r2-purge.py`; SGE job wrappers). axhtml-convert's
  sanitize -> pandoc -> md-sweep path is the same regex family the tex tier
  proved; its quality-contest pattern (ship only on more headings AND more math)
  is the reusable idea.
- Escalation pattern: report classes stub/fail/escalate; recurring classes gain
  a rule or become documented terminal exceptions.
