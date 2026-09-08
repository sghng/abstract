# repertoire: a convention corpus for the writer agent

(The writer plays from the repertoire when it needs conventional phrasing.
The name enters the writer's context as the retrieval tool name, so it
follows the musical naming rule for context-visible tokens.)

Purpose: when the writer drafts a document, section, or paragraph and needs
conventional phrasing for a finding, a dataset, or a method, it queries this
corpus for adjacent published prose. Convention-conforming is the objective;
the corpus is the convention, operationalized.

Corpus: Psychometrika 2020-2025, 395 articles, 100% of them converted from
publisher full-text HTML. Journal-agnostic by construction: list/fetch are
the only per-journal code.

## Key architectural decision: publisher HTML, not PDF conversion

PDF converters (docling / marker / MinerU bake-off, 2026-09) all damage the
corpus in ways an agentic cleanup pass cannot repair: MinerU rasterizes
equations to images, marker flattens complex tables and mashes words, all
three introduce OCR-class text errors (fatal for a prose-imitation corpus).
Meanwhile Cambridge Core serves full-text HTML for 395/395 articles under
campus entitlement, where:

- body text is byte-perfect publisher source,
- every equation carries the authors' own LaTeX (`span.tex-math`),
- figures/tables are full-res images with captions and stable CDN URLs,
- metadata (title, authors, keywords) is in citation_* meta tags.

So the corpus is transcribed from HTML, never extracted from PDF. PDF
conversion (docling installed in the root .venv) survives only as the
fallback for future journals without HTML full text.

Tables: Cambridge serves tables as images only (zero `<table>` elements in
both eras), so the simple/complex split is moot: every table is an asset
reference (caption + URL), uniformly with figures. Table data does not enter
embeddings; captions and surrounding prose do. Accepted trade for a
writing-conventions corpus.

## Layout

```
repertoire/
  schema.sql           # D1 schema: papers + assets
  psychometrika/       # per-journal scripts: list, fetch, html2md, lean,
                       #   coverage, download (PDFs), xml (JATS), pdf2md.py,
                       #   merge-tables.py
  src/                 # journal-agnostic pipeline: clean-html, chunk, embed,
                       #   insert-vectors, query, sync-r2; JEM scripts live
                       #   here (jem-*) until that journal gets its own dir
  html/                # raw article HTML, verbatim       (gitignored, -> R2)
  md/                  # corpus Markdown                  (gitignored, -> R2)
  .cache/              # scrape caches, SQL batches, reports (gitignored)
  pdf/, assets/        # docling-era pilot artifacts, fallback only
```

Corpus artifacts are gitignored; the D1 database and R2 buckets are the
durable stores. Scripts live at repo root level of the Bun project
(dependencies: cheerio, turndown). Python `.venv` at repo root exists only
for the docling fallback.

## Stores

- **D1 `repertoire`** (metadata + pointers, no blobs):
  - `papers(doi PK, doi_id, title, authors, year, journal, issue_url,
    article_url, pdf_url, state, local_path, sha256, keywords, error,
    updated_at)`. `state` drives resumability per stage
    (listed -> fetched -> ...).
  - `assets(asset_id PK, doi, kind figure|table, url, caption)`. 3248 rows
    for the current corpus. The url column enables lazy batch download of
    images at any later date.
- **R2** (bytes): raw HTML and Markdown mirrors. Not yet synced.
- **Vectorize** (vectors): index `repertoire`, 1024 dims, cosine (1536 is the
  dimension cap, so 1024 not 2048). Metadata indexes: doi, journal, year,
  chunk_no, section -- created before first insert, per Vectorize rules. Populated:
  17,758 vectors (395 papers, voyage-context-4, paragraph-aware self-chunking
  at ~475-token cap; chunk text + section heading + canonical section bucket
  ride in vector metadata so query results carry the passage itself). Voyage free tier (200M tokens)
  covers the corpus many times over.

Identifiers: papers use the page-declared DOI lowercased with `/` -> `:`
(`10.1017:psy.2025.10034`). Assets are `{doi_id}-figNN` / `{doi_id}-tabNN`
(numbered in document order); dash separates paper key from asset key.

## Scripts (Bun, run from repertoire/: `bun psychometrika/<name>.ts` or
`bun src/<name>.ts`; journal-specific ones live in the journal dir)

- **clean-html.ts** [--dry] -- in-place strip of script/style/svg/noscript
  and HTML comments from html/*.html (1.5GB -> 538MB corpus-wide; scripts
  alone are ~1MB/page). Lossless for conversion: md output byte-identical.
  Run after any fetch.
- **lean.ts** [--dry] -- Cambridge-specific slimming, in place: rebuilds
  each file as kept metas (citation_/dc./description) + div.abstract +
  div.body + div.back, drops all other chrome, prunes attributes to a
  whitelist, and normalizes meta content whitespace (embedded TeX in
  citation_reference metas otherwise defeats prettier). Run after clean-html.
  Then `prettier --write --parser html html/*.html` for eyeballing (+30%
  size; md output differs only in caption whitespace, for the better).
- **list.ts** -- scrape Cambridge all-issues -> 2012-2025 issue pages ->
  article URLs + page-declared DOIs. Writes .cache/papers.json and
  inserts.sql; apply to D1 with wrangler. Page cache in .cache makes it
  idempotent. Result: 849 rows for 2012-2025 (2012 is the first year with
  full-text HTML).
- **coverage.ts** -- probe: fetch each article page, classify fulltext vs
  abstract-only, count tex-math/figures/tables. Verified 395/395 fulltext,
  2008 figures, 3332 tables corpus-wide.
- **fetch.ts** -- pool of 6 workers downloads verbatim HTML for every
  listed paper to html/{doi_id}.html; scrapes citation_* metas into D1;
  state -> fetched. Resumable (skips existing files), batched D1 updates.
- **html2md.ts** [--apply] -- the converter. cheerio surgery on div.body,
  then turndown for generic markup:
  - `span.alternatives` (tex-math + fallback img) -> token, restored AFTER
    turndown so LaTeX is verbatim (turndown would escape `\` and `_`);
  - `div.fig-ada` / `div.table-wrap-ada` -> `![caption](asset_id)` + an
    assets row (kind, url, caption); all other images dropped (equation
    glyphs, badges);
  - internal `#fragment` links unwrapped; `div.body` selection excludes all
    page chrome (TOC, nav, Springer/Cambridge headers) -- which also solves
    the title/category problem: page furniture like "Theory and Methods"
    never enters the Markdown.
  - Output: md/{doi_id}.md + .cache/assets.sql; --apply pushes to D1.
- **chunk.ts** -- md/ -> paragraph-aware chunks (~1900 char cap, merge short
  blocks, split oversized on sentences, never cross a ## heading; heading
  recorded per chunk). Output .cache/chunks/{doi_id}.json. 395 papers ->
  17,758 chunks, median ~1,445 chars (includes abstracts:
  div.abstract lives OUTSIDE div.body; 330/395 papers have one, the 65
  without genuinely lack one -- Crossref has no abstract for them either). Self-chunking (not Voyage
  auto-chunking) because the API does not echo chunk boundaries, and queries
  must return the passage text.
- **embed.ts** -- chunks -> Voyage voyage-context-4 contextualizedembeddings,
  one call per paper with the chunk list (manual chunking still yields
  document-contextualized vectors). Papers over the 32K-token per-call cap
  are split into ~60K-char groups (LaTeX tokenizes ~3 chars/token).
  8-worker pool, per-paper NDJSON checkpoints in .cache/vectors/, resumable.
- **insert-vectors.ts** -- concatenates checkpoints into 1000-vector batches,
  `wrangler vectorize insert` per batch, state in .cache/insert-state.txt.
  (wrangler is fine for bulk insert; the QUERY path uses the TS SDK.)
- **query.ts** -- the retrieval client: Voyage embeds the query
  (input_type=query) -> Cloudflare TS SDK queries Vectorize with optional
  --year/--doi/--journal filters -> prints score, paper title, heading, and the
  passage. Flags: --top-k, --distinct (dedupe per paper), --year/--doi/--journal
  metadata filters, --section (hard filter on canonical section bucket:
  abstract/introduction/background/methods/results/discussion/conclusion/
  backmatter), --prefer (soft +0.03 boost, re-sorted). Needs CF_API_TOKEN (+ optional CF_ACCOUNT_ID) in root .env.
  Query in the register you want back: draft prose retrieves published
  prose; QA-style queries retrieve prose ABOUT the question (worse).
- **xml.ts** -- JATS XML from the Springer Nature OpenAccess API for OA
  Psychometrika articles (~173 of 833; the rest are not OA). Auxiliary store
  in xml/, D1 untouched. Needs SPRINGER_API_KEY in root .env; free tier caps
  page size at p=25 (larger is a 403 "premium feature").
- **download.ts** -- publisher PDFs via the citation_pdf_url metas already in
  the lean HTML (Cambridge serves them to plain curl). pdf/{doi_id}.pdf.
- **pdf2md.py** -- docling PDF fallback (per-paper: `--formulas` opt-in;
  MPS accelerator; 32px icon filter; images_scale 2.0).
- **merge-tables.py** -- splices docling PDF tables into HTML-derived md:
  aligns docling tables to tabNN asset tokens by reading order + caption
  number; simple tables become inline GFM, complex ones (spanning cells) go
  to assets/{doi_id}-tabNN.html. Checkpointed via .cache/merge-report.json.

## Gotchas learned (do not relearn)

- Cambridge Core hosts the whole Psychometrika backfile to 1936, but
  full-text HTML (div.body) exists only from 2012 (vol 77) onward; 2011 and
  earlier article pages are abstract + PDF scan only. Probed one article per
  year/decade plus all four 2011/2012 issues to pin the boundary. Within 2012
  issues, the 16 stragglers with 2011-era DOIs (`10.1007/s11336-011-*`,
  online-first under the old production flow) have no full text: 10 real
  articles are abstract-only and 6 are front-matter junk (acknowledgements,
  volume index); they carry D1 state abstract-only/frontmatter and no local
  files, so re-listing is a no-op.
- Tables are served as rasterized images (div.table-wrap-ada > img), never
  as <table>, in both Springer and Cambridge eras (17 real-table exceptions
  exist; psy2md drops them like the rest). PDFs keep tables as typeset text,
  which is why docling recovers them. Cambridge does not expose JATS
  publicly (probed content-api, .xml suffixes, binary service: all soft-404);
  Springer Nature serves JATS via api.springernature.com only for OA articles.

- Manual-chunk contextualizedembeddings calls are capped at 32K tokens TOTAL
  per call (the 120K window applies to auto-chunking mode only); group long
  papers at ~60K chars.
- Vectorize caps dimensions at 1536: use Voyage output_dimension 1024.
- wrangler vectorize query's --vector flag does not parse JSON arrays or
  comma lists despite its help example; use --vector-id for smoke tests and
  the REST API (with an API token) for real clients.
- contextualizedembeddings response nests: data[i].data[j].embedding.
  Auto-chunking requires inputs as a FLAT list of document strings plus
  enable_auto_chunking: true (nested list-of-chunks means manual chunks).
- bash `cd x && cmd & tail log` backgrounds the whole list: `cd; cmd &`.

- D1 rejects multi-hundred-row INSERT VALUES statements
  (SQLITE_TOOBIG): use one INSERT per line in a --file batch.
- The equation wrappers nest `span.alternatives > span.mathjax-tex-wrapper >
  span.tex-math + img`. Replace at the OUTER container; replacing the inner
  span and then removing the outer one deletes the TeX you just inserted.
- tex-math content already includes `$` delimiters; display math arrives as
  `$$ \begin{align*} ... $$`.
- marker >= 2 requires transformers >= 5 while MinerU requires < 5: they can
  never share a venv. Both are fallback-only now.
- bash tool cwd resets between calls; `cd` inside every command.

## The agent-facing tool

`extensions/repertoire/index.ts` registers the `repertoire` tool
(pi.registerTool, no MCP): action search (Voyage embed -> Vectorize query ->
passages with refs), context (chunks around a ref, local chunk cache),
outline (paper's section skeleton with chunk ranges, local cache). Registered
for writer/editor peers via HARNESS_ROLE gate; pinnable on subagent
prototypes through extensions/subagents' CUSTOM_TOOLS registry (children run
noExtensions). Armed prototype: subagents/style-check.md.

## Remaining roadmap

1. Batch asset download from the assets.url column (lazy by design).
2. ~~Embed~~ DONE: voyage-context-4, self-chunked -> 30,474 vectors in
   Vectorize `repertoire` (1024 dims, cosine), passage text in metadata.
3. Sync html/ and md/ to R2 buckets.
4. ~~query.ts~~ DONE modulo CF_API_TOKEN: Voyage embed -> Cloudflare TS SDK
   -> passages with metadata filters. Later: --hyde (caller hallucinates an
   exemplar passage, embeds that) for description-style queries; promote to
   a Worker endpoint only when the writer agent needs remote access.
5. Agentic cosmetic pass (optional): prose linting, LaTeX render-check via
   KaTeX, artifact cleanup (`$ and $`-class leftovers).
6. Second journal adapter: psychometrika/{list,fetch} are the per-journal surface;
   psy2md is Cambridge-flavored but structured for reuse.

## Second journal: JEM (Wiley)

Journal of Educational Measurement, 2020-2025: 172 research articles (35
front-matter items excluded), added 2026-09. Per-journal adapter scripts:
jem/jem-list.ts (Crossref ISSN 1745-3984; Wiley's site is behind a Cloudflare
bot challenge, so Crossref does listing), jem/jem-fetch.ts (Playwright headless
Chromium solves the challenge, captures the RAW document body -- the live DOM
is MathJax-mutated and loses the source), src/jem2md.ts (Wiley schema).

Wiley markup: body div.article__body; h2.article-section__title; math as
<math> MathML with <annotation encoding="application/x-tex"> (2022+ -- TeX
source on the page, extracted verbatim); 2020-21 math as PNG images only
(img.section_image, src .../jedmNNNNN-math-NNNN.png) -> @@EQIMG placeholders
awaiting an img2latex pass; figures <figure class="figure"> -> asset refs;
tables are REAL <table> elements: simple grids become GFM pipe tables,
colspan/rowspan tables become caption + asset ref (raw HTML tables are layout,
not prose, and a single line can exceed 100K chars -- unchunkable).

D1: 172 papers (journal='jem'), 4,334 assets (2,588 equation + 826 figure +
920 table). Vectorize: 16,732 JEM vectors (index total ~34K). Raw HTML is
preserved locally (html/) and in R2 (bucket repertoire-html, repertoire-md)
via src/sync-r2.ts.

Known wart: author-biography sections ride into chunks (heading "Biographies").

### JEM backfile (2005-2019)

HTML full text starts at 2005 (Volume 42 Issue 1) -- verified by eyeballing
the site; 2003 redirects /doi/full/ to /doi/abs/ (abstract-only). Crossref
lists 442 articles for 2005-2019 (JEM began 1964; 1,620 pre-2020 records
total, but pre-2005 is PDF-only).

Math eras: 2022+ = MathML with application/x-tex annotations; 2020-21 =
per-equation PNGs (math-NNNN.png); 2009 sampled = article__body HTML with
NEITHER marker -- a third era whose math markup is unidentified (candidate:
MathML without TeX annotations, or differently-named images). The 2005-2019
fetch must sample math markup per year before the converter is extended.

XML: Wiley exposes /doi/full-xml/{doi} (JATS-flavored full-text XML).
Crossref TDM link records show application/xml deposits only from 2019, and
patchily -- deposits understate availability. Live eyeballing (2026-09):
XML exists at least back to 2005 but coverage is PER-ARTICLE patchy
(10.1111/j.1745-3984.2005.00012.x complete, ...00007.x 404).

**Backfile fetched (human-solved Turnstile)**: Cloudflare escalated to an
interactive Turnstile checkbox after ~400 requests in a day, from ANY IP
(curl AND headless blocked from home and Notre Dame alike; student04 is
glibc 2.17 and can't run any modern browser; student05 can but the
challenge still demands a click). Solution: `jem-fetch-headed.ts` --
headed persistent-context Chromium, the script pauses on "Just a moment"
and waits for a human click, then rides cf_clearance. Result: 2005-2019
442 targets --> 363 XML + 70 HTML fallback, only 9 with genuinely no full
text (abstract-only book reviews/errata). 2020-2025 re-fetched as XML:
168/207 (39 have only 5KB Early-View stub XMLs; their HTML stands).
2005-era XML is Wiley-namespaced (not JATS), equations as structured GIF
refs (<mediaResource href="graphic/JEDM_NNNN_mN.gif">). Backfile fetch
strategy: try full-xml first, fall back to full HTML, count the losses.
XML beats HTML when available: semantic section markup, equations and
tables in source form (one stable schema instead of the website's per-era
rendering mix), no nav chrome, no MathJax-mutated DOM.

### img2latex (pending pass)

Scope: 2,553 @@EQIMG placeholders in ~44 image-era (2020-21) papers. Two
steps: download the PNGs through the Playwright session (asset URLs are
Cloudflare-walled too), then OCR each to TeX.

Candidates:
- pix2tex (Lukas- Blecher LaTeX-OCR): local, free, purpose-built for rendered
  equations; ViT + transformer decoder; quality is good on clean display
  math, shakier on dense inline symbols and subscript stacks; model download
  ~100MB, runs on CPU/MPS.
- VLM API (Gemini Flash / Qwen-VL): paid but cents for this volume, better
  on noisy inline math, no local model management; needs an API key and
  prompt discipline ("transcribe exactly, $...$ delimiters, no commentary").

Decision deferred until the download pass lands; acceptance test either way:
sample 30 equations, eyeball TeX vs PNG, require near-verbatim on 90%+
before bulk replacement (fixable-by-agent errors are cheap to sweep after).
Raw HTML in R2 makes the whole pass redo-safe.

### HTML cleaning doctrine (the psychometrika workflow)

HTML cleaning is ITERATED AGAINST CONVERSION, never judged by eye alone:
1. run html->md on the RAW html; keep that md as the reference output
2. shave the html (curated, per-journal cleaner)
3. run html->md again on the cleaned html
4. the new md must be BYTE-IDENTICAL to the reference, or BETTER (junk
   gone, prose intact) -- verify by diffing the full md corpus, reading
   every non-chrome changed line
A cleaning rule earns its place only when step 4 passes on the WHOLE
corpus, not a sample. Raw bytes are never the working set's concern (R2
preserves the originals); the local html is the redo-safe working copy,
so shaving in place is fine as long as step 4 keeps passing.

### Repo hygiene (per-journal dirs)

Data and journal-specific scripts live per journal: `repertoire/jem/{html,xml,md}/`
plus `repertoire/jem/*.ts` (list/fetch/convert); psychometrika keeps the flat
dirs until its agent migrates. Shared stages (chunk/embed/query/sync-r2/clean-html)
scan both roots. Source precedence per paper: `xml/` shadows `html/` (stub XMLs
were rejected at fetch; verified none on disk). Prettier does NOT format the
XML corpus: @prettier/plugin-xml in strict mode leaves Wiley XML untouched,
and whitespace-ignore mode injects spaces around inline elements
("(2019)" -> "( 2019 )", 56/79 paragraphs corrupted). For eyeballing, format
a throwaway copy only. Cleaning is PER-JOURNAL, no shared pass: jem/clean-html.ts strips
script/style/svg/noscript/comments plus Wiley UI chrome (button/form/iframe
-- "Open in figure viewer / PowerPoint", citation widgets, search/login,
ads); 91MB -> 70MB, jem2md output verified byte-identical after the first pass;
second pass added render-chrome anchor removal (Google Scholar
getFTRLinkout, OpenURL/EBSCO servlet/linkout, cdn-cgi email obfuscation --
PROVEN absent from the Wiley XML source of the same articles, so zero
information loss; verified by full-corpus MD diff: only chrome lines
removed). Known artifact: biography "; ." punctuation residue where the
email anchor was stripped.

### JEM pipeline, end-to-end (2026-09-08)

Stages in order: clean-html -> lean -> prettier(html) -> jem2md (html-only
papers; XML shadows HTML by glob check) -> jemxml2md (531 XMLs, zero
failures) -> prettier(md) -> chunk -> embed -> insert. jemxml2md tag policy
implemented: structure/styling/navigation/content classes, CALS tables
(pipe or caption+asset), TeX annotations verbatim, block tokens protect
nested display math and lists from paragraph whitespace collapse.
583 JEM MDs live (531 XML + 52 HTML-only; 35 of the 207 recent Crossref
DOIs turned out to be Issue Information front matter, correctly skipped).
Asset handles are SHORT per-paper ids (fig01, tab01, eq0001,
document-order); (doi_id, handle) -> url mapping in
.cache/jem{,-xml}-assets.ndjson pending D1 import. Figures/tables are NOT
downloaded yet by design; only equation images feed img2latex (20,326
placeholders). Vectors: 65,858 fresh ids; insert via wrangler batches
SILENTLY DROPPED 17,242 (445 papers, mostly psy) -- detected by
list-vs-cache diff, repaired via REST /upsert (250/batch, all landed;
/list is eventually consistent, get_by_ids is ground truth). Raw XML (704
files, both journals) synced to new R2 bucket repertoire-xml.

Full JEM pipeline per the doctrine: clean-html (regex, chrome) ->
jem/lean.ts (cheerio rebuild: citation_/dc. metas + div.article__body,
attribute whitelist; 70MB -> 49MB, MD byte-identical modulo dropped
duplicate image title attrs) -> prettier --parser html batch (49MB ->
54MB; HTML prettier is whitespace-safe; MD diffs pure whitespace, and
BETTER: spaces restored at caption element boundaries,
"assessments.Colour" -> "assessments. Colour"; verified 122/122
whitespace-only). Final HTML is prettified and human-readable.
R2 keeps the raw originals; local copies are the lean working set.

### Wiley XML -> MD converter policy (jemxml2md)

Tag classes: STYLING (italic/bold/sup/sc) kept and mapped to MD emphasis;
NAVIGATION (link/linkSpan citation xrefs) unwrapped to bare text, pointers
discarded; CONTENT REFS (mediaResource equation GIFs, figures, tableWrap)
become asset placeholders, never flattened. Raw XML stays pristine; all
decisions live in the converter.
