# repertoire: a convention corpus for the writer agent

(The writer plays from the repertoire when it needs conventional phrasing. The
name enters the writer's context as the retrieval tool name, so it follows the
musical naming rule for context-visible tokens.)

Purpose: when the writer drafts a document, section, or paragraph and needs
conventional phrasing for a finding, a dataset, or a method, it queries this
corpus for adjacent published prose. Convention-conforming is the objective; the
corpus is the convention, operationalized. The corpus is also CPT/SFT training
data (owner mandate, 2026-09-16); the md contract serves both consumers.

Build history and superseded proposals: [history.md](./history.md).
Next-round recipes: [fetch.md](./fetch.md) (families, era facts),
[parse.md](./parse.md) (routes, converters), and
[parse-report.md](./parse-report.md) (the failure/quality ledger).

## Corpus (checkpoint 2026-09-26)

164,351 papers tracked, 159,465 parsed to markdown (97.0%), 4,886 failures
ledgered per paper in D1 `parse_report`.

| family           | papers  | span      | parsed via                            |
| ---------------- | ------- | --------- | ------------------------------------- |
| arxiv (stat set) | 150,806 | to 2026   | tex 133,914 / pdf 11,158 / html 4,702 |
| psyarxiv         | 5,605   | 2016-     | pdf 2,031 / docx 675                  |
| psychometrika    | 4,105   | 1936-2025 | pdf 2,632 / html 833                  |
| bjmsp            | 1,566   | 1965-2026 | pdf 1,243 / xml 297                   |
| jebs             | 1,427   | 1976-2026 | pdf 739 / xml 554                     |
| jem              | 842     | 1996-2026 | xml 573                               |

## Source doctrine

Ordered by fidelity, learned across the build:

1. **arXiv: HTML is canonical.** arXiv's own LaTeXML renders (arxiv.org/html
   first, ar5iv fallback) carry real LaTeX math and clean structure; in the per-item contest against docling PDF conversion, math recovery decided it decisively (owner decision 2026-09-24). Tex tarballs are not
   stored: LaTeXML already compiled away the TeX complexity, and tarballs
   re-fetch from arXiv by DOI if ever needed. The tex preprocess ladder
   (tex-extract r0-r3 + pandoc) is superseded and dead for new work.
2. **Publisher source form first** (html/xml), PDF only when no source form
   exists (psyarxiv preprints, backfile scans). PDF conversion (docling) yields
   honest prose but zero display math (every equation becomes a `[formula]`
   placeholder) and crashes outright on a large minority of psyarxiv preprints.
3. **XML beats HTML when available**: one stable schema instead of per-era
   rendering, source-form equations and tables, no nav chrome.
4. **Scans need real OCR**: olmOCR won the bake-off (prose, tables, display math, chrome removal; the alternatives omit content or never ran). 534
   scan-tier items failed OCR this round and are terminal until that pass runs
   (see parse-report.md).

## Stores

- **D1 `repertoire`** (metadata, no blobs):
  - `papers` 164,351 rows: identity + `state` (parsed / parsing-failed),
    `parse_source` (html|xml|pdf|tex|docx, which artifact fed the md), `error`,
    `train_include` (training-round gate; the first-author rule drops each first
    author's earliest preprint, applied at training-set assembly, never at
    fetch), `keywords`.
  - `sources` 39,143 rows: raw-artifact inventory, one per (doi, format), with
    bucket key + sha256. Authoritative: every stored object has a row, every row
    has an object.
  - `parse_report` 164,351 rows: per-paper bytes/headings/math/formula stats,
    quality flags (formula-heavy, no-headings, raw-leak, tiny, ltx-residual),
    normalized failure category.
  - `chunks` + `assets`: legacy first-build tables, pending the re-embed round
    (chunks rebuilt) or retirement (assets).
- **R2 bucket `repertoire`**: `md/<doi_id>.md` (159,465 objects, 8.2 GiB,
  immutable once uploaded) and `raw/<doi_id>.<fmt>` (39,143 objects, ~47 GiB).
  Keys are derivable from D1 rows; bucket listing is an audit tool, not an
  access path.
- **Vectorize index `repertoire`**: 1024 dims (1536 cap), cosine,
  voyage-context-4, self-chunked. Vector id `<doi_id>#cNNN`; metadata is FILTER
  FACETS ONLY (doi, journal, year, section), filtered during ANN traversal.
  Stale (built from the first-build corpus); the re-embed round rebuilds it from
  the current md.
- **HF dataset `sghng/repertoire-corpus`** (private): the cold backup. md as 160
  parquet shards, meta ledgers, and the irreplaceable raws (17,205
  journal-family + psyarxiv blobs, sha256-verified) as 70 shards. Plus a local
  sqlite D1 snapshot under `repertoire/.cache/backup/`.
- **Local mirrors** (gitignored): `repertoire/raw-new/` canonical raw mirror,
  flat, manifest-verbatim, never cleaned; `.cache/md/` the md aggregate;
  `.cache/raw-backup/` the irreplaceable raws; `.cache/hf/` the parquet set.

Identifiers: papers use the page-declared DOI lowercased with `/` -> `:`
(`10.48550:arxiv.0704.0302`). Match D1 rows by `doi_id`, never by derived doi
strings (psyarxiv ids use dots where dois use slashes).

## md contract

- One `# <title>`, then `## Abstract`, `## <Section>` per source section,
  subsections `###`. No skipped levels. Headings are load-bearing structure for
  retrieval chunking and section-targeted training pairs.
- Paragraphs blank-line separated; one sentence never split across lines.
- Inline math `$...$`, display `$$...$$`, verbatim LaTeX inside.
- Simple tables inline GFM; figures/complex tables/equation images are asset
  refs, never corrupted splices. A corrupted splice is worse than a reference.
- No References section, no author biographies (not imitable prose); in-prose
  citations stay. No page chrome, emails, ORCIDs.
- `\paragraph` is a bold lead-in, not a heading.

## Serving

`config/plugin/harness.ts` registers the `repertoire` tool (in-process plugin,
no MCP): search (Voyage embed -> Vectorize query -> passages with refs), context
(chunks around a ref), outline (paper's section skeleton). The style-check
subagent is the armed consumer.

Query contract (`src/query.ts`): Vectorize query with filter facets and
--max-per-paper N (over-fetch, then cap); one D1 call chunks JOIN papers;
passages read from the R2 md by line span, deduped by doi, cached forever (md is
immutable). Query in the register you want back: draft prose retrieves published
prose.

## Durable gotchas

- Vectorize: metadata cap 10,240 bytes (facets only, never payload); filtering
  must happen in the index (indexed properties), not post-fetch;
  `wrangler vectorize insert` silently drops vectors at scale, verify counts and
  repair via REST /upsert in 250-vector batches.
- Voyage contextualizedembeddings: manual chunking needs a FLAT list per
  document, 32K tokens TOTAL per call; response nests data[i].data[j].embedding.
- D1: statement size limit bites at scale; after any bulk apply, verify with a
  count query, not with the command's exit code. The live schema can drift from
  `schema.sql` (a CHECK constraint once predated the committed schema);
  reconcile deliberately.
- wrangler error greps must not match on `[ERROR]` (ANSI codes split the token);
  match on ERROR.
- Compute-node egress (CRC) has broken IPv6: urllib waits out the v6 timeout
  (~80s/request) before v4 fallback. Force IPv4 in any fetcher.

## Roadmap

1. Vectorize re-embed from the current md (chunks table rebuilt, index recreated
   fresh, new-index-then-swap).
2. pdf-tier math recovery: GPU docling formula enrichment or the olmOCR pass for
   the formula-heavy and scan tiers (parse-report.md quantifies).
3. Annual increments per fetch.md recipes; new arXiv items fetch HTML directly.
4. SFT synthesis rounds; training-set assembly reads `train_include`.
