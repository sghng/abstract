# repertoire host fleet (a lab fetch fleet)

Operational reference for distributed fetching (arXiv e-prints, 2026-09-15
onward). Owner-sanctioned use of the student lab for corpus fetching.

## Hosts (studentNN.)

| host | state | role | notes |
|---|---|---|---|
| node-04 | up | bun fetcher (surprise: works) | CentOS 7, glibc 2.17 -- the compiled bun binary runs here after all (smoke-tested end to end 2026-09-15); curl 7.29/NSS |
| node-05 | up | bun fetcher | el8, glibc 2.28 (bun's exact floor) |
| node-06 | down | skip | ping + TCP/22 dead from Mac and from inside; may return |
| node-07 | down | skip | same |
| node-08 | down | skip | same |
| node-09 | gone | skip | no DNS internally or externally; likely decommissioned |
| node-10 | up | bun fetcher | el8 |
| node-11 | up | bun fetcher | el8 |
| node-12 | gone | skip | no DNS |
| node-13 | up | bun fetcher | el8 |

| NODE-C | up | bun fetcher | Tailscale MagicDNS (bare name; 100.x addr); Ubuntu, glibc 2.43, x86_64, 12 cores; user OWNER |
| NODE-M | decommissioned | out (owner: 5.1G disk not worth it) | fetcher killed, task deleted remotely (accidental relaunch dies at task-read), top-up ids in task-topup.jsonl |
| this Mac | up | bun fetcher | darwin-arm64 binary `arxiv-fetch-mac`; staging local, no quota concern |

Policy: hosts that are hard to deal with are skipped, not fought. Re-probe
the down hosts opportunistically (reachability drifted once already);
never block the pipeline on them.

## Access

- Auth is PASSWORD ONLY: sshd has pubkey authentication disabled
  server-side (`Authentications that can continue: password`; even the
  account's own key fails to localhost).
- Credentials live locally in `repertoire/.cache/hosts.env` (chmod 600,
  owner-sanctioned; not committed). Per-host entries: the student fleet
  (USER/PASSWORD), NODE-C_* (user OWNER), NODE-M_* (user USER).
  Tailscale resolves NODE-C/NODE-M by bare name.
- Our ed25519 key IS installed in `~/.ssh/authorized_keys` and homes are
  NFS-shared (~13T free): if the lab ever enables PubkeyAuthentication,
  key auth activates fleet-wide with zero redeployment.
- Orchestration is expect-driven password injection (see
  `repertoire/.cache/bulk/arxiv/*.expect`); guard against password
  prompts mid-session and never loop retries on auth failures (lockout
  risk -> stop and report).
- ProxyJump through node-04 works for reaching inner hosts (currently
  moot: the down hosts are down inside too).

## Deployment pattern

- Homes are NFS-shared: deploy once via one host; every host sees the
  files. Staging is per-host (`~/repertoire-fetch/<host>-staging/`) to
  avoid manifest/file collisions on the shared filesystem.
- Fetch utility: `arxiv-fetch` (bun-compiled linux-x64 ELF, ~81MB,
  self-contained; source `repertoire/src/arxiv-fetch.ts`). Reads a JSONL task file
  ({arxiv_id, doi, primary, cats}), GETs `arxiv.org/e-print/<id>`,
  branches on content type (gzip -> .tex artifact; application/pdf ->
  .pdf artifact for pdf-only submissions), magic-byte validates,
  tmp+rename writes, appends manifest/failures JSONL, writes STATUS.json,
  resumable by manifest replay, 3.5-4.5s pacing, stops after 40
  consecutive failures.
- Metadata (titles, categories) comes from a central OAI-PMH harvest
  (`set=stat`, `oai-harvest.ts`), never per-paper: categories stay intact
  for later filtering.
- node-04 runs the same bun binary (verified empirically despite
  glibc 2.17); no bash fallback was needed.

## Gotchas

- `node-06/07/08` unreachable and `node-09/12` gone: skip.
- **Verify binary deploys with remote md5sum.** A fleet scp once
  reported success (no error, quiet mode) while the remote file was
  unchanged -- the relaunch silently ran the old binary. md5-verify
  after every ship, before relaunching.
- **A subagent steward must not "return to sleep"**: finishing its
  response terminates the session. Long waits belong in background
  shells (timeout 0) whose completion notifications wake it.
- expect false-match lesson: `ssh-copy-id` prints an INFO banner
  containing "already installed" BEFORE the password prompt; match the
  real prompts ("password:", "Number of key(s) added") or you silently
  install nothing.
- arXiv rate limits are per-IP: distributing across hosts is the point;
  never run more than one fetcher per host.
- Wave-based sync back to the Mac (tar completed batches, expect-scp)
  keeps any single SSH session short.
