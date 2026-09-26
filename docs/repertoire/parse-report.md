# Parse report: the 164k corpus ledger

Per-paper record of what became of every paper in the parse campaign: what
source produced its Markdown, or why it failed, plus quality flags on the
output. Lives as the `parse_report` table on D1 (one row per paper, 164,351
rows); this file is the human summary and the playbook for the next data-build
round.

Regenerate: `md-stats.py` (cluster, sweeps `out/md`) + `parse-report.py` (local,
merges the D1 papers dump) rebuild the table from scratch.

## Headline tally

| state          | n       |                                            |
| -------------- | ------- | ------------------------------------------ |
| parsed         | 159,465 | 97.0% of the corpus, all on R2 under `md/` |
| parsing-failed | 4,886   | 3.0%, every one bucketed below             |

Campaign tier quality for context: the tex tier ran LaTeXML on 73.5% of its
items (pandoc ladder the rest) and scored 96.3% clean on a 3,000-file QC sample;
the pdf tier is prose-faithful but placeholder-math (the table below tells that
story).

Parsed Markdown by source (also `papers.parse_source` on D1):

| parse_source   | n       | share | no headings | raw leak | formula heavy | math rich (>20 display blocks) |
| -------------- | ------- | ----- | ----------- | -------- | ------------- | ------------------------------ |
| tex            | 133,914 | 84.0% | 2,495       | 1,922    | 0             | 55,888                         |
| pdf (docling)  | 17,866  | 11.2% | 398         | 216      | 5,881         | 0                              |
| html (LaTeXML) | 5,586   | 3.5%  | 0           | 2        | 0             | 4,196                          |
| xml (JATS)     | 1,424   | 0.9%  | 0           | 0        | 0             | 418                            |
| docx           | 675     | 0.4%  | 0           | 25       | 0             | 32                             |

The pdf tier's math_rich = 0 is structural, not bad luck: docling emits no
display math at all. Every `[formula]` placeholder in the corpus (5,881
formula-heavy files, all pdf tier) is a formula docling saw but could not write.
The html rescue round exists because of this column.

## Why papers failed (parsing-failed, 4,886)

| failure               | n     | where                                                         | what it means                                                                  |
| --------------------- | ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| docling-pdf-failed    | 3,457 | psyarxiv 2,877, psy 268, arxiv 203, jebs 68, bjmsp 24, jem 17 | docling crashed or refused on the PDF                                          |
| no-route-assigned     | 867   | arxiv 801, psyarxiv 22, psy 16, jebs 15                       | never enqueued: no raw artifact on disk to parse                               |
| ocr-failed            | 534   | psy 356, jem 178                                              | scan-quality PDFs; olmOCR/docling text extraction failed (terminal this round) |
| tex-ladder-failed     | 18    | arxiv                                                         | pandoc ladder exhausted on malformed TeX                                       |
| tex-exhausted-no-raw  | 5     | arxiv                                                         | TeX failed and no PDF raw was stored to fall back on                           |
| scan-quality-terminal | 3     | arxiv                                                         | docling text lacked headings; wrap rejected                                    |
| tex-no-main-file      | 2     | arxiv                                                         | tarball had no root TeX document                                               |

## Quality flags on parsed files

| flag          | n     | meaning                                                                |
| ------------- | ----- | ---------------------------------------------------------------------- |
| formula-heavy | 5,881 | > 20 `[formula]` placeholders (pdf tier only; prose intact, math lost) |
| no-headings   | 2,893 | no ATX heading survived conversion; chunking degrades                  |
| raw-leak      | 2,165 | residual HTML tags (mostly `<table>`/`<span>` in tex tier)             |
| tiny          | 612   | under 2 KB; stub or failed extraction that passed state checks         |
| ltx-residual  | 70    | LaTeXML artifact strings survived sanitization                         |

## R2 layout after this round

- `md/<doi_id>.md`: 159,465 files, the campaign output (this round).
- `raw/<doi_id>.<fmt>`: 39,143 artifacts tracked in `sources` (pdf 28,912 / html
  8,083 / xml 1,451 / docx 697), in the `repertoire` bucket. The 140,191 arXiv
  TeX tarballs (302.8 GiB) were purged 2026-09-25: LaTeXML HTML is the canonical
  arXiv source and the tarballs are re-fetchable by DOI. The first build's bare
  top-level objects (2,526) were swept in the same pass.
- HF mirror: `sghng/repertoire-corpus` (private) carries the markdown (160 zstd
  parquet shards), the metadata ledgers, and the irreplaceable raws (17,205
  publisher/psyarxiv artifacts, blobs inline, sha256-verified).

## What to change for the next data build

1. psyarxiv is the failure center (2,877 of 3,457 docling crashes, no tex/html
   alternative: preprints are PDF-only). Options, in cost order: upgrade
   docling + retry; GPU formula enrichment; Mathpix for the remainder.
2. About 1,000 arxiv papers remain rescuable by the html path in under an hour
   of fetching: 801 no-route (fetch raws first, then route) and 203 docling
   failures that were outside the 6,277-id rescue universe.
3. no-headings (2,893) and raw-leak (2,165) concentrate in the tex tier; a
   md-sweep pass over flagged files (heading inference from font-size markup is
   already in the extractor for the ladder path) would upgrade chunking for the
   next embed.
4. `[formula]` placeholders are accepted for this round (prose-first); for
   math-aware training, the html tier plus GPU docling enrichment covers the pdf
   tier's 5,881 formula-heavy files.
5. ocr-failed (534) and scan-quality (3) are genuinely terminal without an OCR
   investment; oldest psychometrika/jem back catalogue.
