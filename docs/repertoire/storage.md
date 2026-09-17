# Storage layout for the expanded repertoire (2026-09-15)

Proposal written during the fetch phase of the expansion rebuild, while families
complete one by one. Numbers are current-state, not projections.

## Scale jump

|                  | old corpus                         | expansion                                                     |
| ---------------- | ---------------------------------- | ------------------------------------------------------------- |
| papers (D1)      | 1,432 (jem 583, psychometrika 849) | ~141,600                                                      |
| raw objects (R2) | ~2,900                             | ~230,000-285,000                                              |
| journals         | 2                                  | 6 families (psychometrika, jem, jebs, bjmsp, psyarxiv, arxiv) |

The old layout was designed at 1.4k papers. Two parts survive the jump
unchanged; three need decisions.

## Settled (no change)

- **`raw/<doi_id>.<fmt>`** flat pristine namespace (D6). Already implemented in
  `src/upload-bulk.ts` and the sources table. R2 has no folder penalty; the
  catalog lives in D1, not in keys. arXiv ids (`arxiv:2310.06725`) form their
  own keyspace inside it, collision-free. Wiley journals share DOI prefixes
  (10.1111/10.1348 across jem+bjmsp), so journal is NOT derivable from a key
  alone -- D1 answers that, by design.
- **`assets/<doi_id>:<handle>.<ext>`** attachments, rsplit(':', 1) parsing.
- **D1 tables** as in schema.sql; sources (new this rebuild) becomes the
  authoritative raw inventory.

## Decided spec deltas (owner sign-off 2026-09-16)

1. **Derived md moves from root-level to `md/<doi_id>.md`.** At 141k papers the
   bucket root would be a 141k-object flat namespace interleaved with raw/ and
   assets/. A prefix keeps nature-encoding honest (raw/, md/, assets/) and makes
   phase-2 ops (per-nature counts, selective re-derive) trivial. Touches only
   the derived uploader (phase 3/4). Old root-level md migrates away per-paper
   as re-derivation replaces it.
2. **Lean html and cleaned xml never upload.** In the old corpus `<doi_id>.html`
   (pipeline intermediate) rode the bucket alongside md. Intermediates are local
   scratch (gitignored), regenerable from raw. Saves ~145k derived objects.
3. **arXiv: one artifact per item** (see decisions below).

## Local layout (owner decision: local copy mandatory)

- **`repertoire/raw-new/`** IS the canonical local raw store. Flat, exactly as
  manifests reference it (`file` field, verbatim). No relocate pass, no
  sharding: a move would invalidate every manifest `file` pointer for no
  functional gain. ~200GB at completion, 2.3T free. Never cleaned after upload;
  integrity stays checkable via manifest sha256 replay forever.
- **Derived staging mirrors the same doctrine** in phase 3/4:
  `repertoire/md-new/` and `repertoire/assets-new/` accumulate derived artifacts
  flat; upload reads them; they stay as the local derived copy. Same name shape
  as raw-new so all three phases share one mental model.
- APFS note: several hundred thousand flat files is survivable because every
  access is by exact name (D1 or manifest answers "which name"); nothing ever
  lists these dirs blindly. If a real tool demands sharding, shard then, with a
  D1-derived rename map -- not before.

## D1 transition

- Fresh papers rows: insert-or-ignore (already implemented; relisting never
  clobbers state).
- **The 1,432 old rows need an explicit reset** at psychometrika/jem upload
  time:
  `state='listed', parse_source=null, local_path=null, sha256=null, error=null`
  for those dois. Without it, old pipeline state (parsed, with parse_source)
  masks papers whose raw bytes just changed underneath them. Small SQL file,
  applied with the family batches; reversible.
- sources table populates from family manifests via upload-bulk's
  d1-sources.sql; one row per (doi, format), bucket key recorded.

## Cleanup inventory (audited 2026-09-17 by full bucket walk)

Old-bucket objects are keyed off the 1,432 old dois -- deletion lists come from
D1, not bucket censuses. Audited counts (187,902 objects total): manifest raw/
167,210 all present (0 missing, reconciled against all six manifests), plus the
old-corpus residue below:

1. **raw/ orphans (346)**: old-pipeline psychometrika objects under the new
   prefix (176 xml, 170 html), dois overlap the fresh set but the formats do not
   (fresh fetch recorded pdf/html only). Unrecorded in any manifest or D1
   sources row. Decision pending: adopt (HEAD for sha/bytes, ledger them;
   Springer xml is the cleaner parse source) or delete. Default when the phase-2
   parse routes are chosen.
2. **Root-level `<doi_id>.md` + `<doi_id>.html`** (2,526 objects: 1,416 md,
   1,110 html): these feed the LIVE writer corpus today. They are deleted only
   in phase 2, per-paper, as `md/<doi_id>.md` replacements upload+verify (change
   1 makes this a prefix migration, not an overwrite dance).
3. **assets/ (17,817)**: old asset objects for old dois, same phase-2 per-paper
   rule (new convert emits fresh asset handles; old handles for that doi die).
4. **reports/ (3)**: old resume artifacts; delete wholesale at phase-1 end (new
   run keeps its own).
5. **Local**: delete `repertoire/{html,md,xml,pdf}/` and `repertoire/jem/`
   working trees at phase-1 end, after per-family spot-verify. KEEP
   `.cache/md-reference/` (the conversion gate reference) unconditionally.

## Family completion checklist (phase 1 spine)

per family: fetch complete -> failure sweeps until empty or documented
hard-fails -> `upload-bulk --dry --family <f>` clean -> real run -> apply
d1-papers.sql + d1-sources.sql (+ old-row reset for psychometrika/jem) ->
spot-get 3 random objects vs sha256 -> OPS-LOG entry: family complete.

## Local copy (OWNER DECISION, 2026-09-16)

A durable local copy of every artifact is MANDATORY (bucket round-trips are
slow; the local copy feeds the parse phases and any future re-derive without
re-downloading). Implementation: `repertoire/raw-new/` stays the canonical local
store, flat, exactly as manifests reference it (`raw-new/<doi_id>.<fmt>`) --
manifests remain verbatim-valid forever, no reorganization (sharding only if a
real tool demands it). Never clean raw-new after upload; disk budget ~200GB at
completion (2.3T free). Derived artifacts get the same treatment in Phase 4 (md/
and assets/ mirrored locally before bucket upload).

## Owner decisions (2026-09-16, all final)

1. **Derived md lives under `md/<doi_id>.md`** (root stays clean; old root-level
   objects migrate away during Phase 4 re-derivation).
2. **Pipeline intermediates are local-only** (revises the plan's D6 "kept in
   bucket": lean html + cleaned xml never upload; ~145k fewer derived objects).
3. **arXiv: one artifact per item** (tex ~91% / pdf-fallback ~9% as fetched; no
   second-format pass; arXiv serves PDFs freely forever).
4. **PsyArXiv .docx primaries enter the contract** (699 preprints; format 'docx'
   joins pdf/html/xml/tex; pandoc parse route in Phase 3).
5. **Local copy mandatory** (recorded above: raw-new/ is the canonical local
   mirror, flat, manifests stay verbatim-valid; never clean it).

Open follow-up the owner flagged: a full whole-storage layout discussion
(bucket + local + D1 + derived trees end state). Drafted below.

## End state: whole storage (discussion draft, for owner review)

Everything above decided; this section assembles the pieces into one picture so
the remaining gaps are visible. Counts are projections from fetch-phase numbers.

### Bucket (`repertoire-docs`, R2)

| prefix    | contents                               | key grammar                      | ~count | written by                        |
| --------- | -------------------------------------- | -------------------------------- | ------ | --------------------------------- |
| `raw/`    | pristine artifacts, exactly as fetched | `raw/<doi_id>.<fmt>`             | ~230k  | upload-bulk (phase 1, per family) |
| `md/`     | final derived markdown, one per paper  | `md/<doi_id>.md`                 | ~150k  | derived uploader (phase 3/4)      |
| `assets/` | figures, complex tables, equations     | `assets/<doi_id>:<handle>.<ext>` | ~100k+ | derived uploader (phase 3/4)      |
| (root)    | nothing, once migration completes      | --                               | 0      | --                                |

Intermediates (lean html, cleaned xml) are local-only by decision 2. `reports/`
(old corpus run artifacts) is NOT recreated: run state lives in D1
(`papers.error`, `papers.state`) and local logs. OPEN POINT A: confirm reports/
dies (recommend yes).

The catalog is D1, never a bucket listing: every key above is derivable from D1
rows (`sources.key`, `assets.attachment_key`, md key from `doi_id`). R2 prefix
listing is an audit tool, not an access path.

### Local (repo, gitignored)

| dir                                                          | role                                                 | lifetime                                           |
| ------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| `repertoire/raw-new/`                                        | canonical raw mirror (flat, manifest-verbatim)       | forever; never cleaned                             |
| `repertoire/md-new/`                                         | derived md mirror (phase 3/4 staging = final home)   | forever                                            |
| `repertoire/assets-new/`                                     | derived assets mirror                                | forever                                            |
| `repertoire/.cache/bulk/<family>/`                           | manifests, failures.jsonl, STATUS, OPS-LOG, fetchers | manifests + OPS-LOG are the permanent audit ledger |
| `repertoire/.cache/md-reference/`                            | conversion gate reference                            | unconditional keep                                 |
| `repertoire/legacy/`                                         | parked ML stages                                     | until the OCR phase consumes them                  |
| old trees `repertoire/{html,xml,pdf,md}/`, `repertoire/jem/` | pre-expansion working state                          | deleted at cleanup (enumerable)                    |

### D1 (`repertoire`)

- `papers` ~150k rows. `state` machine: listed --> ... --> parsed;
  `parse_source` records which FORMAT fed the md (html|xml|pdf|tex|docx);
  `local_path`/`sha256` refer to the raw artifact.
- `sources` ~230k rows: the authoritative raw inventory (one per doi+format,
  with bucket key + sha256).
- `chunks` ~1-2M rows at ~10 chunks/paper: chunk spans for retrieval.
- `assets` ~100k+ rows: handle registry with provenance URLs and durable
  attachment keys.

### Flow (phase 3/4, per paper)

raw-new/ (or bucket) --> intermediates (local scratch) --> md-new/ + assets-new/
--> upload md/ + assets/ --> D1 papers/chunks/assets rows --> Vectorize vectors.
Local mirrors retain every stage's output; the bucket retains only what
retrieval needs (md, assets) plus the pristine raws.

### Migration sequence (ordered)

1. Fetch endgame (in flight): fleet finish --> topup --> 403 + lost-wave5 repair
   --> final wave --> uploader drain --> single arxiv D1 apply --> psyarxiv docx
   upload. Phase 1 closed.
2. Cleanup: old raw objects for dois absent from fresh sources; old reports/
   wholesale; local old trees. All lists derived from D1.
3. Phase 3/4 per family: derive, upload md/ + assets/, and per paper delete the
   old root-level `<doi_id>.md`/`.html` once `md/<doi_id>.md` verifies. Root
   empties as re-derivation sweeps.
4. Vectorize rebuild. OPEN POINT B: in-place reindex (downtime, simpler) vs
   new-index-then-swap (zero downtime, double index cost briefly). Recommend
   new-index-then-swap since the writer corpus stays live.

Remaining open points are only A and B above; everything else is decided. Owner:
veto or confirm A/B and this picture stands as the layout of record.

## Superseded recommendations (kept for the record)

- **arXiv both-formats upload** (proposed 2026-09-15, rejected 2026-09-16):
  storing tex AND pdf per item was argued as replay-proof completeness (~40GB
  pdf + ~45GB tex). Owner chose one artifact per item: arXiv serves PDFs freely
  forever and tex recompiles, so the second copy buys little for a second ~12h
  fleet pass. pdf-fallback items (~9%) are stored as pdf; tex-having items are
  stored as tex only.
- **Local relocate pass to `raw/<journal>/` sharded tree** (proposed 2026-09-15,
  rejected 2026-09-16): superseded by the local-copy decision (raw-new stays
  canonical flat). Year-sharding for arXiv likewise waits for an observed tool
  failure, not anticipation.
- PsyArXiv docx question: resolved (decision 4, in contract).
- md/ prefix + lean-html drop: resolved (decisions 1-2). The veto condition
  (writer retrieval depending on root-level md keys) was checked: the repertoire
  extension reads D1 pointers, so no dependency.
