# repertoire: a convention corpus for the writer agent

(The writer plays from the repertoire when it needs conventional phrasing.
The name enters the writer's context as the retrieval tool name, so it
follows the musical naming rule for context-visible tokens.)

Purpose: when the writer drafts a document, section, or paragraph and needs
conventional phrasing for a finding, a dataset, or a method, it queries this
corpus for adjacent published prose. Convention-conforming is the objective;
the corpus is the convention, operationalized.

Corpus: Psychometrika (Cambridge) 2012-2025, 833 papers; JEM (Wiley)
2005-2025, 583 converted papers. Journal-agnostic pipeline: list, fetch, and
convert are the only per-journal code.

This document is the SPEC of the rebuilt system: one bucket, an end-to-end
orchestrator, complete md (real LaTeX and reconstructed tables). The
transition from the pre-rebuild state lives in docs/repertoire-rebuild.md
until the rebuild lands, then that note is deleted.

## Source strategy: publisher HTML/XML, never PDF conversion

PDF converters (docling / marker / MinerU) damage a prose-imitation corpus
irreparably: rasterized or mangled equations, flattened tables, OCR-class
text errors. Both publishers serve full text in source form, so the corpus
is transcribed, never extracted from PDF:

- Cambridge: full-text HTML -- byte-perfect body, authors' LaTeX in
  span.tex-math, full-res figures, citation_* meta tags.
- Wiley: JATS-flavored XML at /doi/full-xml/ -- semantic sections,
  equations and tables in source form; HTML fallback when absent.

One exception: Cambridge serves tables only as rasterized images in HTML,
while the PDF keeps them as typeset text. The merge-tables stage splices
docling-read tables (PDF) into the md (inline GFM when expressible, HTML
attachment otherwise). Psychometrika PDFs are therefore source material,
stored raw. PDF conversion remains the fallback for future journals
without source-form full text.

## Layout

```
repertoire/
  schema.sql           # D1 schema: papers + assets
  psychometrika/       # Cambridge adapter: list, fetch, coverage, html2md,
                       #   lean, download (PDFs), xml (Springer OA JATS),
                       #   pdf2md.py + merge-tables.py (docling table read)
  jem/                 # Wiley adapter: jem-list, jem-fetch, jem-fetch-headed,
                       #   clean-html, lean, jem2md (HTML), jemxml2md (XML);
                       #   data in jem/{html,xml,md}
  src/                 # journal-agnostic stages: pipeline (orchestrator),
                       #   chunk, embed, insert-vectors, query, sync-r2,
                       #   clean-html (psychometrika html/), img2latex
  auth-chromium.ts     # one-time human Turnstile click -> cf-profile
  verify-clearance.ts  # check the cached clearance still passes
  html/ md/            # psychometrika lean working copies  (gitignored)
  xml/                 # psychometrika OA JATS, pristine    (gitignored)
  pdf/                 # publisher PDFs, typeset-table source (gitignored)
  .cache/              # scrape caches, chunks, vector checkpoints, reports,
                       #   cf-profile (persistent Chromium context)
```

Scripts run from repertoire/: `bun psychometrika/<name>.ts` etc.
Dependencies: cheerio, turndown, playwright. Python .venv at repo root is
docling only.

Identifiers: papers use the page-declared DOI lowercased with `/` -> `:`
(`10.1017:psy.2025.10034`). Assets are short per-paper handles in document
order: `fig01`, `tab01`, `eq0001`; attachment and future image keys use
the same `:` separator (`<doi_id>:tab03.html`), parsed with
rsplit(':', 1).

## Stores

- **D1 `repertoire`** (metadata + pointers, no blobs):
  `papers(doi PK, doi_id, title, authors, year, journal, issue_url,
  article_url, pdf_url, state, local_path, sha256, error, updated_at)` --
  `state` drives resumability per stage. `assets(doi, handle, kind, url,
  attachment_key, caption)` keyed (doi, handle): `url` is publisher
  provenance (may be dead at the CDN), `attachment_key` points at our
  durable copy in the bucket. `chunks(doi, chunk_no, heading, section,
  line_start, line_end)` keyed (doi, chunk_no): passage POINTERS into the
  R2 md (1-based inclusive line span); no passage text in D1.
- **R2** bucket `repertoire-docs` (bytes), one bucket. The prefix encodes
  NATURE, not pipeline stage:
  ```
  raw/<doi_id>.pdf                pristine; PDF is always raw (psy table source)
  raw/<doi_id>.xml                pristine as received (never reformatted)
  raw/<doi_id>.html               pristine html (psy re-fetch; jem where raw survived)
  <doi_id>.html                   lean formatted html   (pipeline output)
  <doi_id>.md                     corpus markdown       (pipeline output)
  assets/<doi_id>:<handle>.html   complex-table attachments
  assets/<doi_id>:<handle>.png    equation images, figures
  reports/                        resume artifacts (miss lists, OCR state,
                                  merge report)
  ```
  md objects are IMMUTABLE once uploaded (any change re-chunks, re-ranges,
  re-embeds; drift is structurally impossible). Derived artifacts are
  uploaded only by the pipeline's final stage (`src/upload-raw.ts`,
  `src/upload-derived.ts`, `src/upload-eq-assets.ts`, all checkpointed),
  so the bucket is by construction the last successful run's output.
  The old per-extension buckets were deleted after verify-buckets.sh
  passed (coverage, spot-gets, census).
- **Vectorize** index `repertoire`: 1024 dims (1536 is the cap), cosine,
  voyage-context-4, self-chunked passages. Vector id `<doi_id>#cNNN`
  encodes doi + chunk; metadata is FILTER FACETS ONLY (doi, journal,
  year, section -- indexed at creation; filtering happens during ANN
  traversal). Passage text never rides in metadata (10,240-byte cap;
  text belongs to D1 pointers + the R2 md). Recreated fresh at each full
  rebuild; annual increments append vectors for new papers only.

## Pipeline

Entry: `src/pipeline.ts --journal jem|psychometrika`. Stages, in order:
raw -> clean-html -> lean -> format -> convert -> merge-tables (psy) ->
img2latex -> md-format -> chunk (+ load-chunks) -> embed ->
insert-vectors -> upload -> smoke query. Built for rare runs (annual batches): every stage
checkpointed and resumable; annual increments list only new DOIs and
append vectors. Validation gates run INSIDE the pipeline and stop it
loudly on failure; per-stage sampling reports are emitted (sample and
read artifacts at every stage; math differs by era).

Source precedence per paper: XML shadows HTML (stub XMLs are rejected at
fetch).

- **auth-chromium.ts** -- opens the headed Chromium for the one-time
  human Cloudflare click; cf_clearance persists in .cache/cf-profile and
  every Wiley-facing fetch rides it. Run this FIRST in any session that
  will touch Wiley; verify-clearance.ts checks the cookie still passes.
- **psychometrika/list.ts** -- Cambridge all-issues -> issue pages -> DOIs;
  writes `.cache/papers.json` + `inserts.sql`; page cache makes it
  idempotent.
- **psychometrika/fetch.ts** -- 6-worker pool; verbatim `html/{doi_id}.html`;
  scrapes citation_* metas into D1; resumable. Cambridge serves plain curl.
- **psychometrika/coverage.ts** -- probe fulltext vs abstract-only plus
  asset counts (`.cache/coverage.json`), resumable.
- **psychometrika/html2md.ts** [--apply] -- cheerio surgery on div.body,
  then turndown. `span.alternatives` -> token, restored AFTER turndown so
  LaTeX is verbatim; figures and table-images -> asset refs + asset rows;
  all other images dropped (equation glyphs, badges). Page chrome never
  enters (div.body excludes it).
- **psychometrika/download.ts** -- publisher PDFs from citation_pdf_url
  metas.
- **psychometrika/xml.ts** -- JATS for OA articles from the Springer Nature
  OpenAccess API; auxiliary `xml/` store, D1 untouched.
- **psychometrika/merge-tables.py** -- docling reads tables from the PDF;
  alignment rules reconcile them with the HTML table-image refs by
  caption/number/count. Simple grids splice as inline GFM; complex ones
  (rowspans/colspans, non-GFM) become `<doi_id>:tabNN.html` attachments +
  asset rows. Tables the rules cannot reconcile deterministically keep
  their image asset ref and land in a failure report; the rule set is
  curated toward zero such cases. Corrupting a table with a wrong splice
  is worse than leaving the image ref.
- **jem/jem-list.ts** -- Crossref (ISSN 1745-3984); Wiley's site is behind
  a Cloudflare bot challenge, so Crossref does listing.
- **jem/jem-fetch.ts** -- headless Chromium solves the challenge once, then
  saves each article's RAW response body (the live DOM is MathJax-mutated
  and loses the source).
- **jem/jem-fetch-headed.ts** [--xml] -- headed persistent-context Chromium
  for Cloudflare's interactive Turnstile (it escalates after a few hundred
  requests, from any IP): pauses for a human click, then rides cf_clearance.
  Tries /doi/full-xml/ first, falls back to HTML.
- **jem/clean-html.ts**, **jem/lean.ts** -- Wiley chrome strip; rebuild as
  citation_/dc. metas + div.article__body, attribute whitelist.
- **jem/jem2md.ts** -- Wiley HTML -> md. Real `<table>` elements: simple
  grids -> GFM pipe tables, colspans -> caption + asset ref.
- **jem/jemxml2md.ts** [--only id] -- Wiley XML -> md, shadows HTML output.
  Tag classes: structure -> headings; styling -> emphasis; navigation xrefs
  unwrapped; content refs (figures, CALS tables, equations) -> asset
  placeholders; TeX annotations verbatim; boilerplate dropped.
- **src/clean-html.ts**, **psychometrika/lean.ts** -- the psychometrika
  equivalents (strip script/style/svg/noscript/comments; rebuild metas +
  abstract + body + back).
- **src/img2latex.ts** -- resolves equation-image placeholders (JEM 2020-21
  PNGs, 2005-era GIFs converted to PNG) to TeX. Images download through
  the cf_clearance-riding session (asset URLs are Cloudflare-walled too);
  OCR via the DeepSeek API (v4-flash-vision-exp). Sub-20px images are
  single-glyph fragments where OCR is unreliable: they stay placeholders
  (fail-open) for the local-model pass in the roadmap. Downloaded images
  and the (doi, handle) mapping are preserved in R2/D1, so OCR is
  resumable offline. Failures stay placeholders + report.
- **md-format stage** -- prettier on the md corpus, formatting only. No
  downstream fix lists: recurring artifact patterns found by sampling are
  fixed in the upstream converter that produces them, never patched
  one-by-one in md.
- **src/chunk.ts** -- paragraph-aware chunks, ~1900 char cap, merge short
  blocks, split oversized on sentences, never across a `##` heading;
  heading + section recorded per chunk. GFM tables are atomic blocks:
  never sentence-split, never merged with prose. Table content IS
  embedded. Each chunk records its 1-based inclusive line span in the md
  (D1 serves pointers; passages are read from the document). Embedding
  text transforms `@@eqNNNN@@` -> `[formula]` (noise to the embedder;
  the md keeps real tokens for the future OCR pass). Self-chunked (not
  Voyage auto-chunking): the API does not echo chunk boundaries and the
  query client needs deterministic ids. This policy is the audit record.
- **src/load-chunks.ts** [--doi id] -- chunk pointers into D1 `chunks`.
  Full rebuild by default; per-doi delete+insert is idempotent for
  increments (re-chunking shifts line ranges).
- **src/embed.ts** -- voyage-context-4 contextualizedembeddings, one call
  per paper (manual chunking still yields document-contextualized vectors),
  8-worker pool, per-paper NDJSON checkpoints, resumable. Metadata =
  filter facets only (doi, journal, year, section).
- **src/insert-vectors.ts** [--fresh-index] -- concatenate checkpoints
  into 1000-vector batches -> `wrangler vectorize insert`; --fresh-index
  recreates the index (delete, create, metadata indexes) first.
- **src/query.ts** -- the reference retrieval client. Contract: (1) Voyage
  embeds the query; (2) Vectorize query with filter facets
  (--year/--doi/--journal/--section -- filtering happens during traversal)
  and --max-per-paper N (0 = unlimited, 1 = distinct papers; enforced by
  over-fetching candidates); (3) one D1 call chunks JOIN papers; (4)
  passages read from the R2 md by line span, deduped by doi, cached
  forever locally (md objects are immutable); (5) bundle
  {score, doi, title, journal, year, section, heading, chunk_no,
  line_start, line_end, passage}. --prefer gives a section a soft score
  boost. Query in the register you want back: draft prose retrieves
  published prose; QA-style queries retrieve prose ABOUT the question.
- **src/upload-raw.ts / upload-derived.ts / upload-eq-assets.ts** --
  final stage uploads, all checkpointed and resumable; eq-assets also
  snapshots resume artifacts to reports/. verify-buckets.sh gates any
  destructive bucket step.

Env (root .env): VOYAGE_API_KEY, DEEPSEEK_API_KEY, CF_API_TOKEN (+
optional CF_ACCOUNT_ID), SPRINGER_API_KEY for xml.ts.

## Cleaning doctrine

HTML/XML cleaning is iterated against conversion, never judged by eye:
convert the raw html/xml and keep that md as the reference; shave the
source; convert again; the new md must be byte-identical or better,
verified by diffing the WHOLE corpus. A cleaning rule earns its place
only on a full-corpus pass. The bucket's raw/ prefix preserves the
originals, so in-place slimming of working copies is safe.

Prettier: `--parser html` is whitespace-safe on both schemas (run for
eyeballing; caption-boundary spaces improve). XML ships PRISTINE: no
cleaned copy, no formatter. (xmllint --format is unsafe on Wiley XML --
it drops significant inter-element spaces; a structure-aware replacement
was built and then deleted by decision: if formatting fails, keep the
bytes as received.)

## Publisher facts (do not relearn)

- Cambridge full-text HTML starts 2012 (vol 77); 1936-2011 article pages
  are abstract + PDF scan only. 16 stragglers inside 2012 issues carry
  2011-era DOIs and no full text (10 abstract-only, 6 front-matter junk;
  D1 state abstract-only/frontmatter, no local files; relisting is a
  no-op).
- Cambridge serves tables as rasterized images, never `<table>` (17 real
  exceptions, dropped like the rest). Cambridge exposes no JATS publicly;
  Springer Nature serves JATS via its API for OA articles only.
- JEM HTML full text starts 2005 (vol 42); 2003 and earlier redirect to
  abstract-only. Wiley XML coverage is per-article patchy; Crossref TDM
  records understate it, so probe /doi/full-xml/ per article.
- Wiley math eras: 2022+ MathML with application/x-tex annotations;
  2020-21 per-equation PNGs (img2latex resolves them); 2005-era XML is
  Wiley-namespaced (not JATS) with GIF equation refs (wiley:mediaResource,
  converted to PNG before OCR). A sampled 2009 article shows neither
  marker -- identify that era's math markup before extending conversion
  further back.
- XML beats HTML when available: one stable schema instead of per-era
  rendering, source-form equations and tables, no nav chrome, no MathJax
  mutation. Some recent articles have only 5KB Early-View stub XMLs; their
  HTML stands.
- Springer free tier caps API page size at p=25 (larger is a 403).
- Known warts: JEM author-biography sections ride into chunks; stripped
  email anchors leave "; ." residue in biographies. Fixes go upstream
  into the converter when they recur, not into md patches.

## Gotchas (durable)

- Vectorize caps dimensions at 1536: use Voyage output_dimension 1024.
- Vectorize metadata is capped at 10,240 bytes per vector; metadata is
  filter facets only (doi/journal/year/section), never payload.
- Vectorize metadata filtering happens during ANN traversal (indexed
  properties only); post-fetch client-side filtering loses true matches
  below the cut -- filter facets belong IN the index.
- `wrangler r2 bucket delete` refuses non-empty buckets; bulk cleanup
  works via the REST API (GET .../objects?per_page=1000, cursor in
  result_info.cursor; DELETE per object; back off on 429).
- contextualizedembeddings: manual chunks = one chunk-list per document
  input (auto-chunking needs a FLAT list + enable_auto_chunking); 32K
  tokens TOTAL per call in manual mode (the 120K window is auto-chunk
  only) -- group long papers at ~60K chars; response nests
  data[i].data[j].embedding.
- `wrangler vectorize insert` SILENTLY DROPS vectors at scale (~17K lost
  once). Verify counts vs .cache/vectors/ (get_by_ids is ground truth;
  /list is eventually consistent) and repair via REST /upsert in 250-vector
  batches.
- `wrangler vectorize query --vector` does not parse arrays; use
  --vector-id for smoke tests, the TS SDK or REST for real clients.
- D1 rejects multi-hundred-row INSERT VALUES statements (SQLITE_TOOBIG):
  one INSERT per line in a --file batch.
- Equation wrappers nest `span.alternatives > span.mathjax-tex-wrapper >
  span.tex-math + img`; replace at the OUTER container or the TeX you
  inserted gets deleted with it.
- tex-math content already includes `$` delimiters; display math arrives
  as `$$ \begin{align*} ... $$`.
- marker >= 2 requires transformers >= 5, MinerU < 5: they can never share
  a venv.
- cf_clearance is bound to the profile's user-agent and IP; all
  session-riding fetches must reuse the persistent context (or export both
  cookie and UA together).

## The agent-facing tool

`extensions/repertoire/index.ts` registers the `repertoire` tool
(pi.registerTool, no MCP): action search (Voyage embed -> Vectorize query ->
passages with refs), context (chunks around a ref, local chunk cache),
outline (paper's section skeleton with chunk ranges). Registered for
writer/editor peers via HARNESS_ROLE gate; pinnable on subagent prototypes
through extensions/subagents' CUSTOM_TOOLS registry (children run
noExtensions). Armed prototype: subagents/style-check.md.

## Roadmap

1. Tiny-glyph OCR pass (local model, pix2tex-class): ~11K sub-20px
   single-glyph placeholders; images + (doi, handle) mapping are durable
   in R2/D1, so this runs offline whenever.
2. Retry passes: 3,539 equations that passed OCR once but regressed on
   the lossy re-splice (state ok, images in R2); 1,829 equation downloads
   that were interrupted, not dead.
3. Batch figure image download from assets.url (eq images and pilot
   figures are done; keys land as `<doi_id>:figNN.<ext>`).
4. query.ts --hyde (caller hallucinates an exemplar passage, embeds that)
   for description-style queries; promote to a Worker endpoint only when
   the writer agent needs remote access.
5. Identify the 2009-era Wiley math markup before extending conversion
   further back.
6. 2026 increment: new DOIs only; chunk/embed/insert append; per-doi
   load-chunks.
