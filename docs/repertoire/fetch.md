# repertoire fetch layer: state and recipes (2026-09-16)

Durable reference for the corpus fetch layer after the 2026-09 expansion
rebuild: what the corpus is, how each family is fetched, the machinery
conventions everything shares, and the recipes for future work (annual
increments, refetches, new journals). Evidence base: the run OPS-LOGs in
`repertoire/.cache/bulk/<family>/`, the fetch spikes
(`repertoire/.cache/notes/repertoire-spike-2026-09-15.md`), and `docs/repertoire/audit.md`.
The expansion plan (`repertoire/.cache/notes/repertoire-rebuild-expansion.md`, local memo) is the
temporary working plan for the remaining phases (2-5: parse routes, full
re-derivation, cutover); this doc survives it.

## Corpus inventory (post-expansion fetch, 2026-09-16)

| family | journal | span | papers | R2 objects | status |
|---|---|---|---|---|---|
| psychometrika | Psychometrika (Cambridge) | 1936-2025 | 4,105 | 4,938 (4,105 pdf, 833 html) | complete |
| jem | J. Educational Measurement (Wiley) | 1996-2026 | 842 | 1,643 (842 pdf, 584 xml, 217 html) | complete |
| jebs | J. Ed. and Behavioral Statistics (SAGE) | 1976-2026 | 1,427 | 2,047 (1,427 pdf, 569 xml, 51 html) | complete |
| bjmsp | Br. J. Math and Stat Psychology (Wiley) | 1965-2026 | 1,566 | 2,972 (1,565 pdf, 298 xml, 1,109 html) | complete |
| psyarxiv | PsyArXiv quantitative-methods | 2016- | 4,908 fetched | 4,908 (all pdf) | complete; 699 docx-primary skipped (open question) |
| arxiv | arXiv stat set (cross-lists included) | -2026 | ~132k items | ~132k (tex ~91%, pdf ~9%) | in flight 2026-09-16 |

D1 `repertoire`: papers 12,851 (five families; arxiv pending), sources
16,508, exact match with the upload checkpoint file
(`repertoire/.cache/r2-bulk-state.txt`). Local raws staging:
`repertoire/raw-new/` (flat; drains into the canonical local mirror,
see `docs/repertoire/storage.md`).

## Per-family reference

Durable scripts: `repertoire/src/families/<family>/` (list / fetch /
backfill-html as applicable). Run state and OPS-LOGs:
`repertoire/.cache/bulk/<family>/`. All fetchers run on this Mac
(institution-IP entitlement; never proxied), one family per browser
profile.

### psychometrika (Cambridge)
- Listing: Cambridge all-issues pages (364 issues, no year gaps);
  `list.ts`.
- Routes: PDF (publisher, all eras) + full-text HTML (2012+; the 16
  online-first `s11336-011` stratum is PDF-only by nature).
- Era facts: full backfile PDFs are real articles (text-layer presence
  varies; parse decisions are Phase 2's job, raws are uniform).
- Zero failures across the full span.

### jem (Wiley, onlinelibrary zone)
- Listing: Crossref, both ISSNs union, dedup by DOI; `list.ts`.
- Routes: PDF all eras via `/doi/pdfdirect/`; JATS XML via
  `/doi/full-xml/`; HTML full text exists ALL eras (page-nav capture
  pre-2005, in-page fetch 2005+; the request API 403s old content, so
  nav-first pre-2005).
- Era facts: XML availability is PER-PAPER, not era-uniform (2005-2019:
  87%, 2020+: 93%, pre-2005: none). Wiley-component XML buries
  `<article` as deep as 60KB+ past the head; classify on whole-body
  containment, not the first 64KB.
- Backfill rule (applies to both Wiley journals): every paper with no
  xml row in the manifest gets an HTML capture; EPUB deliberately
  skipped (derivative of the same full text).

### jebs (SAGE)
- Listing: SAGE per-volume pages; `list.ts`.
- Routes: PDF all eras (100% coverage incl. 1970s scans, p50 ~1.2MB);
  XML modern era; HTML via landing page for 2007+ xml-absent.
- Era facts: pre-2007 HTML is ABSTRACT-ONLY (spike-proven shells on
  both routes; excluded by year gate). SAGE challenges (Turnstile)
  self-clear on a warmed profile more often than not; the human
  handoff pattern exists for the rest.
- Incident lore: >500 PDF/full-text downloads per session triggers a
  ~3h IP block; fetchers detect block pages and stop clean. Recovery
  was observed to need a manual browser close, not just time.

### bjmsp (Wiley, bpspsychub zone)
- Listing: Crossref, ISSN 2044-8317 union print 0007-1102; `list.ts`.
- Routes: same Wiley recipes as jem; the bpspsychub zone shares
  cf_clearance with onlinelibrary (one warmed profile covers both).
- Era facts: XML 2005+ per-paper (21 terminal 403s);
  10.1348/000711005x47168 (2005) is absent at Wiley (withdrawn) -- the
  single missing PDF in the corpus.

### psyarxiv (OSF)
- Listing: OSF API provider listing + Crossref candidate union
  (~55.8k), subject filter = quantitative-methods node containment
  (full path, not leaf match): 5,813 matched; `fetch.ts` (details
  cache makes relisting cheap).
- Routes: PDF via base-guid download URL. OSF `preprint_doi` is
  version-locked on 38% of records; normalize to base form.
- Open question (owner): 699 QM preprints have a .docx/.doc primary
  and no PDF. Fetchable + pandoc-convertible, but outside the
  pdf/html/xml/tex contract. Skipped and recorded `non-pdf-primary`.
- OSF throttles per-IP (429) under sustained load; the provider
  listing route (100 records/request) beats per-record details.

### arxiv (stat set, cross-lists included)
- Metadata: OAI-PMH `set=stat` harvest (150,806 records;
  `src/oai-harvest.ts` + `src/reparse-metadata.ts` + `src/make-papers.ts`),
  categories kept intact primary-first; FILTERING HAPPENS AFTER FETCH,
  never at fetch time.
- Fetch: e-print source (`/e-print/<id>`, gzip tarball -> .tex
  artifact); on withheld-source 403, PDF fallback (manifest carries
  `via: pdf-fallback`). Observed mix: ~91% tex, ~9% pdf. Sizes: tex
  p50 416KB / p90 3.9MB / max 79MB; pdf p50 503KB. Projected total
  ~132k objects, ~155-170GB.
- Distribution: 7-host fleet (5 lab nodes + 1 fast Linux box + this
  Mac), one fetcher per host, partitions ~18.8k items. See
  `docs/repertoire/hostfleet.md` (access, deployment, gotchas) and
  `repertoire/.cache/bulk/arxiv/README.md` (code/state split).
  Centralization is wave-based (tar staged batches, expect-scp).
  Endgame: topup task file + 403-repair pass, final wave.

## Shared machinery conventions

- Manifest schema (the family ledger, append-only, truth for resume
  and upload): `{doi, doi_id, journal, year, format, file:
  "raw-new/<name>", bytes, sha256, fetched_at}`; arxiv rows add
  `{arxiv_id, primary, cats, via}`. doi_id = doi lowercased, `/`->`:`.
  papers.jsonl rows: `{doi, doi_id, title, year, journal, issue_url,
  article_url, pdf_url}`.
- Resume = manifest replay; orphans (files without rows) adopted;
  failures.jsonl never blocks a relaunch. One detached fetcher per
  family; STATUS.json every ~25 items.
- Validators are STRUCTURAL, not size-only: Wiley XML = `<article`
  whole-body containment; HTML = bytes >40KB AND (section markers OR
  references block), shell-on-both-routes = definitive miss; PDF =
  %PDF magic + YEAR-AWARE floors (>4KB pre-2000, >20KB after).
- Fetcher armor (learned the hard way): AbortController ~120s INSIDE
  in-page fetch calls (a stalled connection otherwise wedges the run
  silently); block-page text detection -> clean stop with reason;
  challenge handling with human handoff, 2 strikes -> stop; 4-5s
  jittered pacing; 11.5-12h caps.
- Browser profiles: one persistent Chromium profile per family dir;
  clone (rsync/APFS copy) to parallelize -- clearance cookies ride
  along. Gates/execs that launch bun must use the absolute bun path
  (nohup'd sh has no PATH). NEVER `pkill -f` with a family prefix:
  `bulk/psy` matches `psyarxiv` (it killed a healthy run once).
- Front-matter filter (all journals):
  /^(issue information|cover|erratum|corrigendum|correction|obituary|
  in memoriam|front matter|back matter|list of reviewers|editorial
  acknowledgement|book reviews?)$/i

## Storage and metadata

- R2 `repertoire-docs`, flat pristine namespace `raw/<doi_id>.<fmt>`
  (arxiv ids form their own keyspace: `raw/arxiv:2310.06725.tex`).
  R2 limits: unlimited objects and total storage; 5GiB single PUT.
- D1 `repertoire`: papers + sources tables (schema.sql). Limits that
  bite: 100KB max SQL statement (insert batches are 50 rows/statement;
  1,000-row batches measured ~500KB and fail SQLITE_TOOBIG with an
  error easy to miss in grep'd wrangler output -- always verify with a
  count query after applying), 100 bound params/query, 10GB/db (our
  metadata is tens of MB).
- Upload: `src/upload-bulk.ts` per family (checkpointed, sha256
  re-verify before put, emits d1-papers.sql + d1-sources.sql). The
  wrangler-per-object transport (~2 obj/s) is retired per D7 in favor
  of the Cloudflare REST API uploader using the existing CF_API_TOKEN
  (probe-verified R2 read/write; ~16 concurrent puts). Uploads
  SERIALIZE across families (shared checkpoint + SQL output paths).
- Apply sequence per family: upload -> d1-papers.sql -> old-row reset
  (state='listed', parse_source=null, ... for that journal's rows)
  when the family existed pre-expansion -> d1-sources.sql -> count
  reconcile -> 3-object spot-get vs manifest sha256.
- Old-row reset exists because fresh bytes under the same key make
  old parse_source values lie. On refetch, reset again.

## Recipes

### Annual increment (new papers, next year)
1. `bun src/families/<fam>/list.ts` -- listings are additive; verify
   only new DOIs appear (papers.json destruction bug class from the
   audit; listings write per-journal files).
2. `bun src/families/<fam>/fetch.ts` -- resume skips saved dois.
3. Wiley families: backfill-html for any new xml-absent papers.
4. `upload-bulk --family <fam>` + apply SQL. NO old-row reset
   (increment rows are new; existing rows untouched).
5. arxiv: re-run the OAI harvest from last harvest date
   (from-until), partition only the new ids, fleet or single-host
   (a few thousand items is a one-host job).

### Full refetch (raws suspected stale or lost)
1. Same as increment but full listing; fetcher resume means existing
   files are skipped -- DELETE the manifest + checkpoint entries for
   what must be refetched, or fetch into a fresh family dir.
2. Apply the old-row reset for refetched journals (parse_source lies
   otherwise).
3. Derived cleanup follows per docs/repertoire/storage.md
   (enumerable lists: old raw keys not in fresh sources, per-paper md
   + assets replacement at re-derive time).

### Adding a journal
1. SPIKE FIRST: 5-6 DOIs across eras; probe pdf/xml/html routes and
   validators empirically (see spike doc for the method). Era facts
   are established by probing, never by doc folklore.
2. list / fetch / backfill-html triplet in src/families/<new>/;
   manifest schema and validators per conventions above.
3. Upload + D1 apply is family-generic (upload-bulk discovers
   manifests; add the family to its list if new).

## Pointers

- `docs/repertoire/storage.md` -- storage layout decisions
  (md/ prefix, lean-html, arxiv both-formats) and cleanup inventory;
  open questions awaiting owner.
- `docs/repertoire/hostfleet.md` -- fleet access, deployment, gotchas.
- `repertoire/.cache/notes/repertoire-spike-2026-09-15.md` -- per-publisher probe
  evidence (the era facts above trace here).
- `repertoire/.cache/notes/repertoire-rebuild-expansion.md` (local memo) -- locked
  decisions D1-D10 and remaining phases 2-5.
- `docs/repertoire/audit.md` -- why this rebuild happened.
