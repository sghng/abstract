# Cluster parse campaign: run log and lessons (2026-09-20 .. 09-23)

Full-corpus parse to markdown on the CRC cluster (crcfe01, SGE, NFS home).
Outcome first, then the durable operational lessons. The tier design and
converter internals live in `parse.md`; this file records what the fleet taught
us.

## Outcome

- 164,351 papers in D1: 159,436 parsed (97.0%), 4,915 parsing-failed, states
  reconciled exactly to md-on-disk.
- parse_source coverage complete: tex 133,914, pdf 22,539, xml 1,424, html 884,
  docx 675 (ocr-route items recorded as pdf, their source artifact).
- tex tier: LaTeXML 73.5% of tex-route items, pandoc ladder most of the rest,
  4,901 ladder-exhausted. Quality gate: 96.3% clean on a 3,000-file QC sample
  (residuals all sub-1% classes: no-headings 2.3%, raw-html 0.9%,
  replacement-char 0.5%).
- arXiv tex-failures rescued via arXiv PDFs: 6,251 fetched (26 fetch failures),
  6,220 converted with docling, 31 terminal (scan-quality PDFs whose OCR text
  carries no heading structure; the wrap skip gate rejects them by design).
- pdf tier caveat: docling's default pipeline placeholders display equations
  (`<!-- formula-not-decoded -->`, ~67/file in 98% of the 6,220). Inline math
  survives as readable text. parse_source='pdf' marks the lower-fidelity tier.

## Lessons (durable)

- Access: cluster SSH goes through `kssh` (password auth; the 1Password agent
  key stopped working 2026-09-20; rotate the password when convenient). Verify
  what a liveness check actually matches: `pgrep -f "rclone copy"` matched its
  own wrapper string and reported a dead upload as alive for half a day.
- rclone on the login node is not on PATH by default; the puller configures the
  R2 remote via `RCLONE_CONFIG_R2_*` env vars from `parse-run/.env`, not
  rclone.conf. Mirror those exports for any manual transfer.
- Bash trap: `cat > file && cmd &` backgrounds the whole chain, and backgrounded
  jobs in non-interactive shells take stdin from /dev/null, so the file lands
  empty. Pipe files in a foreground command; launch daemons in a separate one
  (`setsid nohup ... < /dev/null &`), then verify output files are non-empty.
- NFS attribute cache: after overwriting a job script, tasks dispatched in the
  first ~60s can read the stale copy and die at zero items. Either wait out the
  cache or expect-and-revive the early tasks (individual qsubs with explicit
  slice args are immune and simpler).
- SGE array tasks cannot take per-task arguments: use `-v SLICE_PREFIX=<name>`
  with a job-side default, or individual qsubs with the slice path as $1
  (preferred for odd-sized rounds).
- LaTeXML: homebrew 0.8.8_5 works on all nodes from `$HOME/homebrew/bin`; pass
  `--log=` explicitly (default log path goes stale on NFS); it exits nonzero on
  warnings, so gate on artifact size; its `--timeout` cannot break catastrophic
  Perl regexes, so wrap with GNU `timeout -k` and spawn with stdio ignored.
- Docling throughput: arXiv PDFs run 30s-10min each (OCR-heavy slices worst).
  75-item slices outran a 6h cap; 30-item slices with 6h caps drained cleanly.
  The wrap stage's no-headings gate is the correct terminal classifier for
  scan-quality sources.
- D1: the live papers table carried a CHECK constraint on parse_source that
  predated the committed schema (no 'docx'); rebuilt via
  create+insert+verify+drop+rename (164,351 rows preserved). Match updates by
  `doi_id` (the filesystem form), never by derived doi strings: psyarxiv ids use
  dots where D1 dois use slashes, and the mapping has more exceptions than
  rules.
- Transfer aggregates with a single tar stream over ssh; rsync over the same
  tunnel dies the death of 153k per-file handshakes (309 files in six hours vs
  the full 7.6GB tar in under one).
- Compute-node egress has broken IPv6: urllib waits out the v6 timeout
  (~80s/request) before v4 fallback; force IPv4 in any fetcher (curl hides the
  problem with happy-eyeballs).
- arXiv HTML rescue round (2026-09-24): the tex-failure tier is better served by
  arXiv's own LaTeXML output (arxiv.org/html 51% coverage, ar5iv most of the
  rest, 5,873/6,277) than by docling PDF conversion. 4,702 items re-shipped with
  real LaTeX math, 1,174 kept docling where the per-item contest favored it, 29
  previously-unparseable orphans recovered. Doctrine going forward: HTML is the
  canonical arXiv source for new fetch rounds regardless of tarball availability
  (owner decision 2026-09-24).
- Operational scar: one careless `qdel -u ghuang3` deleted the owner's running
  arrays along with my queued jobs (2026-09-24). Rule: delete only explicit job
  ID lists. Related: wrangler error greps must not match on `[ERROR]` (ANSI
  codes split the token); match on ERROR.
