# repertoire host fleet (pattern reference)

Operational pattern for distributed fetching (arXiv e-prints). The
concrete fleet that inspired this doc is owner-sanctioned lab and
personal hardware; identifiers, accounts, and addresses live ONLY in
the untracked credentials file, never in this repo.

## Fleet shape (roles, not names)

| role | count | notes |
|---|---|---|
| lab cluster nodes | 5 active | shared-home Linux machines; a few more down/decommissioned at any time |
| fast personal Linux box | 1 | best single-node throughput; also the merge host |
| local workstation | 1 | runs orchestration, staging, canonical mirror; no quota concern |
| small-disk node | 0-1 | decommissioned when sync cost exceeds contribution |

Policy: hosts that are hard to deal with are skipped, not fought.
Re-probe unreachable hosts opportunistically (reachability drifts);
never block the pipeline on them. A decommissioned host's task slice
moves to a top-up task file re-run on fast finishers.

## Access

- Some fleets are PASSWORD ONLY: sshd may have pubkey authentication
  disabled server-side. Credentials live locally in an untracked,
  chmod-600 env file (`repertoire/.cache/hosts.env`), one entry set
  per host. Never printed, never committed.
- Orchestration is expect-driven password injection (scripts in the
  run-state dir). Guard against password prompts reaching the log
  (banner text can confuse expect matching), and never loop retries on
  auth failures -- stop and report (lockout risk).
- Installing our public key anyway is harmless and future-proves the
  fleet: if the servers ever enable pubkey auth, everything activates
  with zero redeployment.

## Deployment pattern

- On NFS-shared homes, deploy once via any one host; every host sees
  the files. Staging stays per-host (distinct staging dirs per host)
  so manifests and files never collide on the shared filesystem.
- Fetch utility: `arxiv-fetch` (bun-compiled self-contained linux-x64
  ELF; source `repertoire/src/arxiv-fetch.ts`). Reads a JSONL task
  file ({arxiv_id, doi, primary, cats}), GETs the e-print endpoint,
  branches on content type (gzip tarball -> .tex artifact; pdf -> .pdf
  artifact for pdf-only submissions), magic-byte validates,
  tmp+rename writes, appends manifest/failures JSONL, writes a STATUS
  file, resumes by manifest replay, paces 3.5-5s/item, stops after 40
  consecutive failures. Verify the binary's glibc floor per OS
  generation -- older floors sometimes still work; test, do not
  assume.
- Metadata (titles, categories) comes from a central OAI-PMH harvest
  (`set=stat`, `oai-harvest.ts`), never per-paper: categories stay
  intact for later filtering.
- md5-verify every binary deploy: scp has been observed to report
  success while the remote file was unchanged; the relaunch then
  silently ran the old binary. Verify after every ship, before any
  relaunch.

## Wave synchronization (how files get home)

Fetching hosts stage artifacts locally; a wave moves them to the
orchestration host in batches:

1. Each host tar's its COMPLETED staging (manifest rows already
  final; never mid-write).
2. The wave pulls the tar (one short SSH session per host), then
  GATE: `gzip -t` integrity check on the full archive. The gate runs
  BEFORE anything is pruned or merged -- a truncated-tar loss taught
  this the hard way.
3. On gate pass: extract into the canonical local mirror
  (`raw-new/`), append the wave's manifest rows to the central
  manifest, THEN prune the remote staging. Prune is cutoff-safe: only
  rows present in the pulled tar are removed remotely.
4. The central manifest may legitimately run ahead of local bytes
  between waves (rows merged, artifacts staged); the uploader uploads
  only what exists locally and catches up after each wave.
5. Distinguish ahead-because-in-flight from bytes LOST post-prune: a
  truncated-tar loss leaves rows that will never materialize. Detect
  by diffing manifest rows against raw-new existence after the
  uploader catches up; anything still byte-absent is a repair task
  (refetch into staging-repair dirs, same task pattern), not a wait.

Waves trigger on a staging-size threshold (~20k items) or at endgame;
the final wave sweeps every remaining staging dir including top-up
staging. Waves run detached with a long timeout (4h) and log to run
state; a stuck auth prompt must be killed by exact PID, never by
pattern-matched pkill (prefix collisions kill the wrong thing).

## Gotchas

- A subagent steward must not "return to sleep": finishing its
  response terminates the session. Long waits belong in background
  shells whose completion notifications wake it.
- expect false-match lesson: helper output (e.g. ssh-copy-id's INFO
  banner "already installed") can precede the real prompt; match the
  real prompts exactly or you silently do nothing.
- Source rate limits are per-IP: distributing across hosts is the
  point; never run more than one fetcher per host.
- One steward cycle per invocation, heartbeat-driven: sweeps every
  60-90 min, logs everything to the run-state OPS-LOG, and every
  action recipe is idempotent so a killed cycle is safely re-run.
