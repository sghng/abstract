# repertoire parse layer: routes, requirements, experiments

Durable reference for converting raw artifacts to corpus markdown
(Phase 2/3 of the expansion). Grows the way docs/repertoire/fetch.md
did: experiments land here as they conclude; graduated utils are listed
with their src/ homes. Fetch-layer facts live in repertoire-fetch.md;
storage shape in repertoire-layout-2026-09-15.md.

## Training-data requirements (owner mandate, 2026-09-16)

The corpus serves BOTH the writer's retrieval tool AND CPT/SFT training
data. Consequences for md output:

1. **No bibliography lists.** The References section is stripped at
   conversion. In-prose citations (author-year or numeric) STAY: they
   are prose. Author biographies also stripped (not imitable prose);
   acknowledgments kept.
2. **Sections are load-bearing structure.** Every section boundary is
   an ATX heading, never flattened prose. Downstream training needs:
   per-section-type targeting (needs normalized section names: methods,
   results, discussion...; a classifier utility later), section and
   paragraph boundaries for continuation training, barebone/expanded
   section pairs (expansion training), abstract-to-body structuring.
   All of that stands on faithful headings + blank-line paragraph
   separation. The chunks table (heading, section, line spans) already
   models this for retrieval; training pairs read the same md.
3. **Faithful prose above all.** No OCR-class text errors, no mangled
   math, no flattened tables (attachment beats corruption). This is the
   pre-expansion doctrine, unchanged, now also a training-data rule.

Old corpus kept References (see any md-reference file); the new
pipeline strips. The 1,416 md-reference files remain the quality GATE
for the routes that produced them.

## Target md contract

From the gated old corpus (md-reference) + mandate:

- One `# <title>`, then `## Abstract`, `## <Section>` per source
  section. Subsections `###`. No skipped levels without a parent.
- Paragraphs = blank-line separated; one sentence never split across
  lines (prettier handles wrapping).
- Inline math `$...$`; display `$$...$$`; verbatim LaTeX inside.
- Figures/complex tables/equation-images: asset refs + asset rows
  (fig01/tab01/eq0001 handles, `<doi_id>:<handle>.<ext>` keys). Simple
  tables inline GFM. A corrupted splice is worse than an asset ref.
- Page chrome, nav, emails, ORCIDs, footer cruft: never enter.
- Ends after the last prose section (no References, no bios).

## Route table

| family x format | volume | converter | status |
|---|---|---|---|
| arxiv tex (gz tarball) | ~120k | NONE | spike P1 (pandoc primary; LaTeXML if installable) |
| psychometrika pdf 1936-1960 (scans) | small | needs-OCR | parked for local-model OCR pass (legacy ML roadmap) |
| psychometrika pdf 1961-2011 | ~1-2k | legacy/pdf2md.py + wrap | attachment-heavy; footnote chrome + glyph maps in wrap |
| psychometrika pdf 2012+ | ~1k | NONE (table-source only) | merge-tables doctrine; no md route |
| psyarxiv pdf | ~4.2k | legacy/pdf2md.py + wrap | good after de-chrome; eq-asset refs norm for math |
| jebs pdf (pre-2007) | ~0.7k | legacy/pdf2md.py + wrap | worst route; dehyphenation + glyph maps; reviews fail |
| jebs html (2007+) | 51 | src/families/jebs/jebs2md.ts | GO: 51/51 convert, MathML->TeX clean, 302 asset rows |
| jebs xml (JATS) | 569 | jebs2md xml sub-route | GO: full family 605/620 (15 review skips), 0 failures; MathML 532/569 (namespaced mml: -- the 'image-only' claim was a selector bug; 0 eq-asset needs); 3,826 external .tif asset hrefs -> download-list for a later fetch pass |
| bjmsp xml (Wiley) | ~1.5k | jem/jemxml2md.ts | FIXED T1-T5: 95 alias-recovered, 297/298 convert, refs stripped, regression-proof |
| jem xml/html (new years) | ~0.8k | jem/jemxml2md.ts, jem2md.ts | spike P3: still-current check |
| psychometrika html (2012+) | ~2.7k | psychometrika/html2md.ts | existing, gated; re-gate on refetch |
| psychometrika xml (OA JATS) | subset | xml.ts store | aux only, as before |
| psyarxiv docx | 699 | docx2md (graduating) | GO: lua-filter headings P=.996/R=.941, markdown writer = native $ math, textutil 6/6 |

The tex route is 85% of the corpus: highest leverage, zero existing
code. PDF routes are last resort but unavoidable for scans and
preprints (no source form exists).

## Experiment conventions

- Run state in gitignored `.cache/spike-parse/<route>/`; samples
  recorded in `samples.jsonl` (doi_id, journal, year, format, file) so
  every experiment is reproducible. Utils graduate to `src/` only after
  a route verdict.
- **No manual md patches, ever** (owner reminder 2026-09-16, matching
  the old spec's doctrine): an observed conversion artifact becomes a
  RULE in the script that produced it, and the paper that exposed it
  joins that route's samples.jsonl as a standing regression case. The
  sample sets ARE the regression harness: a converter change re-runs
  its full sample set plus byte-diff where applicable before commit.
  Exceptions a rule cannot fix land in a documented terminal-exceptions
  list (like the fetch layer's), never as one-off edits.
- Batch conversion runs emit report.jsonl per item (stub/fail/escalate
  classes); every recurring class in a report either gains a rule or
  becomes a documented terminal exception. Silence is the only
  unhandled state.
- Cleaning doctrine carries over from the spec: iterate against
  conversion output with byte-diffs, never eyeball-only; a rule earns
  its place on a full-corpus (or per-family full) pass. At expansion
  scale, iterate on stratified samples, then confirm on the family's
  full manifest before declaring a route done.
- Bibliography strip: prefer cutting the SOURCE construct pre-conversion
  (thebibliography env, \bibliography{..}; html/xml ref-list nodes)
  over slicing converted output; record which in each converter.

## Experiment log

- **P1 tex (DONE 2026-09-16)**: `pandoc -f latex -t markdown
  --wrap=none` on bib-stripped, input-expanded source. 16/16 convert
  (13 direct, 3 via preprocess ladder: comment-strip, drop
  delimited-defs, definition-blind). gfm writers REJECTED: fenced math
  violates the contract and silently drops \cite. Math lands as
  $..$/$$..$$ natively; headings fidelity ~1.0 (excess = \paragraph).
  Hostile: 180MB tarball trivial (images dominate); no-documentclass
  payloads ~1.5% (main-detect fallback works); needs a min-content gate
  for stubs. LaTeXML (brew) converts everything pandoc-hostile, ~30x
  slower: escalator for ladder-exhausted (<2% expected), needs html->md
  glue. GRADUATING: src/tex-extract.ts ships WITH bibStrip, manual-refs
  cut, \renewcommand\section drop (those fixed silent 0-heading and
  References-leak outputs). 120k-scale gotchas: stream gunzip|tar, cap
  ~5MB/60s per pandoc call, member args not --include (bsdtar), \input
  regex word-boundary (else beheads \includegraphics), Bun.gunzipSync
  needs Buffer.from. State: .cache/spike-parse/tex/ (VERDICT.md,
  samples/metrics/variants, scripts).
- **P2 pdf (DONE 2026-09-16)**: docling 2.126 via wrapped legacy/
  pdf2md.py, 14 stratified samples; marker BLOCKED (2.0.0 needs
  transformers>=5, shared venv pins 4.57.6 for docling; the spec's venv
  gotcha confirmed -- dedicated venv if marker is ever revisited).
  Era verdicts: psy 1936-1960 scans needs-OCR (fail as-is); psy
  1961-2011 attachment-heavy (footnote chrome + afii glyph maps needed);
  psy 2012+ NO pdf md-route (gated HTML exists; pdf = table-source only,
  merge-tables doctrine -- tables DO inline well); psyarxiv 2025+ GOOD
  after de-chrome (line numbers, emails, funding note, title reorder;
  ff-ligature watch); jebs pre-2007 worst (dehyphenation + glyph maps,
  math-bearing prose corrupted, book reviews fail). Structural damage:
  display math dropped 100% (323/323 formula items with enrichment
  off; VLM enrichment is 10+ min/paper CPU -- declined at 8k-file
  scale; eq-asset refs are the norm for math-bearing pdfs pending the
  local-model OCR roadmap pass); headings flattened (all ##, 0 titles,
  0 ### -- wrap-fixable); References/bios retained (legacy predates
  the no-refs mandate -- strip in the wrap stage); asset keys
  <doi_id>-figNN need normalizing to <doi_id>:figNN. Projected pdf-route
  mix (~8k files): good ~45% (psyarxiv-led), attachment-heavy ~40%,
  needs-OCR/fail ~15% (scans + jebs reviews). GRADUATION: a pdf-wrap
  stage (heading promotion incl. # title, refs/bio strip, chrome
  filters, asset-key normalization) rather than a new converter.
- **P3 structure (DONE 2026-09-16)**: (a) SAGE jebs: ONE uniform DOM
  2011-2026 (#abstracts/#bodymatter/#backmatter, bare-div prose, pure
  MathML, zero TeX); first-cut jebs2md.ts converts 6/6. Graduation
  fixes: MathML->TeX spacing artifacts (\ , \middle|, {=..}), asset
  download, emphasis/autolink cosmetics. (b) Wiley XML taxonomy:
  T1 DOI filter silently skips 32% of bjmsp (95/298, all 10.1348 =
  2005-2011; alias test converts cleanly); T2 References emitted
  (violates no-refs mandate); T3 book-review XML -> junk (needs
  articleCategory filter); T5 2012 title damage (_2.1_ . _X_); T6
  silent drops are mandate-compliant. Math eras: pre-2015 100% image
  (img2latex fallback holds); 2021-26 = 59 tex / 86 MathML-noTeX / 13
  mixed, all mathNoTeX carry wiley:location PNGs. Tables 2021-26:
  797 complex vs 65 simple (asset refs dominate). (c) jem still
  current: YES (2026 file 181/181 tex math; only T2/T3 apply). (d)
  docx: 691/697 convert (6 OLE2 .doc need textutil hop); OMML lands as
  $`x`$ code-spans and ```math fences (normalize to $/$$); BLOCKER:
  0/4 samples use Word heading styles (bold pseudo-headings) --
  section structure needs a bold-line heuristic. Shared utils worth
  extracting: pandocRun wrapper + writer flags + unescape;
  per-publisher bib/bio strip registry; mathml2tex-by-pandoc;
  asset-token protect/restore. Traps: cheerio replaceWith(descendant)
  drops the node; Bun 1.4.2 spawnSync{input} feeds empty stdin (temp
  file); pandoc needs -simple_tables-multiline_tables and
  --markdown-headings=atx.

- **P3b docx (DONE 2026-09-16)**: census 16: 12/16 bold pseudo-headings
  (3 flavors), 2/16 real heading styles (pandoc maps via w:name),
  2/16 legitimately structureless (pointer/supplement docs -- min-content
  gate). Hand-labeled 628 candidates; heuristic V1+ (bold + <120 chars +
  no trailing punctuation, Table/Figure veto, front-matter suppression,
  backmatter/Study-N exemption, title capture+dedupe): P=.996 R=.941;
  trailing-? variant lifts R to .983 but promotes survey questions --
  rejected (precision-first). Implementation: pandoc LUA FILTER (one
  call, no zip surgery) + native-header cleanup + # title injection +
  References strip header-to-header + equation-table lift to $$..$$.
  KEY: use the MARKDOWN writer, not gfm -- math lands natively as
  $..$/$$..$$ (0 fences across 56 conversions); gfm was P3's entire
  problem. Trap: -raw_attribute corrupts $x$0 adjacency; post-pass
  normalize. OLE2 .doc: textutil hop 6/6. Smoke 40/40 convert, 40/40 #
  title, 36/40 ## sections (4 legitimately fragment docs). GO.

## Contract rulings (2026-09-16, from P3 findings)

- **`# <title>` is REQUIRED.** The md-reference gate files lack it
  (they predate the training mandate); the title participates in
  abstract-to-body structuring pairs. Old-corpus md gains titles during
  Phase 4 re-derivation; do not "fix" new converters to match the old
  gate on this point.
- **`\paragraph` is a bold lead-in, not a heading**: emit as
  `**Lead-in.** text` inline. Keeps the section skeleton clean (## /
  ### only) and the prose flow intact for continuation training.

## Open questions (parse layer)

- **Citation tokens from tex**: pandoc leaves unresolved \cite as [@key]
  (journal routes render resolved author-year citations in prose).
  Options: leave as-is (machine-parseable, prose-hostile), resolve from
  .bbl/thebibliography (natbib-shaped only), or drop. Owner call when
  the training-data shape is decided; post-processing pass, does not
  block tex-extract.
- Section-name normalization utility (methods/results/discussion) for
  per-section SFT targeting; reads headings, emits facets.
- \paragraph promotion or demotion policy (pandoc emits as headings,
  inflating counts vs the contract's heading semantics).
- chunks-table line spans for tex outputs (chunker is md-driven; no
  change expected, verify on tex md).

## Utils inventory (graduated)

- `jem/jemxml2md.ts` (upgraded 2026-09-16, Wiley T1-T5 fixes): alias
  DOI handling recovers the 10.1348 era (95 files, 32% of bjmsp);
  References/back-matter strip per mandate; articleCategory filter
  (book reviews/front-matter) with `--skipped <file>` convention (rows
  {doi_id, reason, category, title}); 2012 title repair. Full bjmsp
  run: 297/298, 0 failures. Regression-proof: unaffected outputs
  byte-identical vs pristine snapshot.
- `src/families/jebs/jebs2md.ts` (graduated 2026-09-16): SAGE html
  route. 51/51 convert; # title 51/51; Abstract 33/33; refs/orcid/bios
  0; MathML artifacts 0; 302 asset rows (202 fig/100 tab) matching md
  refs. Cosmetic residuals (wrap-stage normalizable): *x* emphasis
  (48), 1\. list-escape (11), <url> autolinks (23).
- `src/families/jebs/jebs2md.ts` xml sub-route (same file, upgraded
  same day): JATS 2007-2026, mml-prefix strip -> fragment walk ->
  shared pandoc/post/cleanTex tail with the html route; precedence
  html > xml per doi (0 dois currently have both). FULL FAMILY GO:
  605/620 converted (15 book-review skips recorded), 0 failures.
  Census CORRECTION: 532/569 carry namespaced MathML (mml:math) -- the
  earlier image-only claim was a selector bug; 0 files need eq-image
  assets. External asset hrefs emit a resumable download-list
  (--downloads, .cache/jebs-xml-downloads.jsonl): 3,826 rows (2,217
  fig / 1,603 tab / 6 eq, all .tif) = the later image fetch pass's
  queue. Trap: cheerio node construction on an xml-loaded instance
  corrupts serialization -- build nodes on the html fragment side.
- `src/tex-extract.ts` (graduated 2026-09-16 from spike P1, verified:
  16/16 spike samples byte-identical expanded+stripped source, 3 fresh
  manifest rows end-to-end): streamed extract (gunzip|tar), payload
  kind detect, main-file detection with no-documentclass fallback,
  \input/\include expansion (word-boundary regex), bib strip (section
  redefs, thebibliography, bib commands, manual refs, harvard env),
  preprocess ladder r0-r3 + probe. CLI: `bun src/tex-extract.ts
  <doi_id> [--keep]`. Known gap: \endinput cut on the MAIN file is
  caller-side in the spike; not exercised by any sample -- handle in
  the conversion stage if it surfaces.
- `src/tex-convert.ts` (graduated 2026-09-16, verified on 22 items:
  21 ok + 1 stub-flagged + 0 fails; references absent 22/22): the
  extract chain -> ladder probe -> pandoc (-t markdown --wrap=none) ->
  post-pass (title glue: \title > style-title commands > centerline >
  center-env groups; ## Abstract; \paragraph/subparagraph -> bold
  lead-in PRE-conversion so heading counts collapse exactly onto the
  section skeleton; min-content + zero-structure stub gate -- caught an
  HTML-listing payload posing as tex; trailing-refs sweep; residual
  raw-tex density metric). Escalator hook emits structured records
  (latexmlc && pandoc -f html template documented in code); 0
  rung-exhausted in 22, 1 density escalation. Metric corrections vs
  P1: multi-line $..$ spans were under-stripped and the inline counter
  halved true math pairs -- densities recalibrated. CLI:
  `bun src/tex-convert.ts <doi_id>` (md stdout, report stderr) |
  `--batch <ids> --out <dir>` writing .md + report.jsonl -- the 120k
  entry point; stubs/fails recorded, not written.
- `src/families/psyarxiv/docx2md.ts` + sibling `docx-heal.lua`
  (graduated 2026-09-16, verified end-to-end: 16 census + 40 smoke +
  3 fresh; 0 fails; headings P=.996 R=.922 vs the 628-label set;
  residual FNs are question-headings/long/math-suffixed lines):
  pandoc -f docx -t markdown + lua filter (V1+ headings, native-header
  cleanup, # title injection incl. ?-titles, References strip
  header-to-header, equation-table lift) + post-pass; OLE2 .doc via
  textutil hop; skip classes no-sections/fragment (flat/supplement
  docs) per the --skipped convention. Graduation fixes found by
  re-verify: UTF-8 literal gsub for invisible-strip (was eating
  en-dashes/curly quotes), ***x*** + soft-hyphen promotion,
  blockquote headings, auto-numbered section lists, Span/Underline
  strip. CLI: <doi_id> | --batch [--out dir] (default all 697 rows).
- `src/pdf-wrap.ts` (graduated 2026-09-16): journal-agnostic post-docling
  wrap stage; input docling md + {doi_id, journal, year}. Verified 14/14
  spike outputs: titles promoted 14/14, refs stripped 14/14 (1 residual
  on a verdict-fail book-review scan, era gate owns it), hierarchy
  repairs (numbered 2.1 -> ###), soft-hyphen joins, asset-key
  normalization to <doi_id>:figNN with refs rewritten. Chrome rules (all
  with corpus hits, none zero-hit): banner, line_number, running_head,
  journal_banner, author_block, email/correspondence, funding_note,
  copyright, manuscript_dates. Ligature repair (e ect -> effect class);
  PUA-codepoint detection. Skip gate for degenerate scans. Verify caught
  and fixed a parseBlocks table-splitting bug (GFM tables were broken
  mid-table). CLI: <doi_id> [--in md|stdin] | --batch <rows.jsonl>
  --out <dir> (ok/skip/fail report classes).
