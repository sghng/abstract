# Build history and superseded proposals

The arc, one entry per phase: what happened, the decisions that still bind, the
lesson. Layer docs carry the durable technical detail; this file is the
narrative and the decision record.

## Old corpus (to 2026-09)

1,432 papers (psychometrika 849, jem 583), per-extension buckets, a local
orchestrator that had never actually run end to end. Served the writer via the
first Vectorize index; those vectors and the `chunks`/`assets` tables are its
residue, pending the re-embed round.

## Audit (2026-09-14)

Four independent reviews plus spot verification. Verdict: architecture sound
(immutable md + pointer serving, byte gates, fail-open doctrine); execution weak
(confirmed data bugs in D1 and md, build not reproducible from the repo). The
audit triggered the expansion rebuild; its findings described code paths that no
longer exist, so the document was retired at this wrap-up.

## Expansion fetch (2026-09-15..17)

Six families, 164,351 papers listed, ~179k raw objects fetched and uploaded; D1
became the catalog of record. Decisions that still bind:

- One bucket, nature-encoding prefixes (`raw/`, later `md/`); the catalog is D1,
  never a bucket listing.
- arXiv: one artifact per item (tex preferred, pdf fallback at fetch time);
  psyarxiv docx joined the format contract.
- Local raw mirror mandatory (`raw-new/`, flat, manifest-verbatim, never
  cleaned); pipeline intermediates (lean html, cleaned xml) never upload.
- Listings are additive; relisting never clobbers state; fresh bytes under an
  old key require a parse-state reset for that journal.

Era facts (which route exists per family per decade, publisher quirks) are the
fetch layer's stock in trade: [fetch.md](./fetch.md).

## Cluster parse campaign (2026-09-18..23)

Full-corpus conversion on CRC (SGE): tex via LaTeXML + ladder, pdf via docling,
xml/html/docx via the family converters, scans via olmOCR. 159,436 of 164,351
parsed; the pdf tier's placeholder math and the tex tier's 4,901
ladder-exhausted items set up the next phase. Run mechanics were logistics and
are not kept; the surviving technical lessons (broken IPv6 on compute egress, D1
CHECK drift, match by doi_id, verify-after-apply) live in [index.md](./index.md) gotchas.

## HTML rescue round (2026-09-24)

The tex-failure and pdf tiers were re-served from arXiv's own LaTeXML
(arxiv.org/html first, ar5iv fallback for most of the rest); the per-item
quality contest re-shipped the large majority with real LaTeX math and
recovered previously unparseable orphans. Outcome doctrine: HTML is the
canonical arXiv source; tex tarballs need not be stored.

## Checkpoint and consolidation (2026-09-25..26)

Quality ledger (`parse_report` on D1, [parse-report.md](./parse-report.md) in the manual), a targeted
leak-fix pass over the flagged md, and the store consolidation: single bucket
`repertoire` (tex tarballs purged, 302.8 GiB; first-build top-level objects
swept), D1 pruned to match storage exactly, the checkpoint bundled to HF
`sghng/repertoire-corpus` (private), local mirrors verified byte-for-byte.
Corpus closed at 159,465 md / 97.0%.

## Superseded proposals (kept for the record)

- **arXiv both-formats storage** (2026-09-15, rejected next day): tex AND pdf
  per item argued as replay-proof completeness; owner chose one artifact per
  item. Later mooted further by the HTML doctrine.
- **Local sharded raw tree** (2026-09-15, rejected): raw-new stays flat and
  manifest-verbatim; sharding waits for an observed tool failure, not
  anticipation.
- **md at the bucket root** (original layout, superseded 2026-09-16): derived md
  lives under `md/`; the root is a junk drawer at 150k scale.
- **The tex preprocess ladder** (superseded 2026-09-24): built, run at scale,
  then obsoleted by the HTML route for everything except the already-parsed
  133,914.
