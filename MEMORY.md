# MEMORY -- Design Rationale and Roadmap

This file is the lab harness's design memory: the principles still
load-bearing, the open questions, and the recent decision tail. Read it
before changing the architecture. Durable how-it-runs doctrine has
graduated to dedicated pages: the lab's operation ([lab](/lab)), prompt
authoring ([prompts](/prompts)), model pins ([models](/models)), the Word
converter ([typ2docx](/typ2docx)), the corpus manual
(`docs/repertoire/`), and the per-system design docs (`desk`,
`reflection`, `remote-access`, `writing`, `ledger`, `prompt-hierarchy`).
Older arcs live in git history.

## Goal

An agentic harness for academic research: a small team of long-running
agents with persistent, per-role context, whose interactions and context
management we can iteratively fine-tune. Niche: academic research (not
coding).

## Core Principles

1. **Files are memory; sessions are attention.** A long-running agent is a
   persistent session file plus durable artifacts, not a long-running
   process. Anything that matters gets written down before the turn ends;
   session context is a lossy cache that will be compacted.
2. **Consultations are tool calls; artifacts are files.** A consultation
   reply is ephemeral; anything with lasting value additionally lands in
   `notes/`. This keeps contexts clean, the record complete, and all
   coordination human-readable.
3. **Three tiers of knowledge.** Kernel (always loaded, invariants only),
   index (skill descriptions, trigger-style), modules (skills, on demand,
   written to be re-enterable cold after compaction). Tier-1 knowledge
   must never live in tier-3 files; that was the pre-restructure failure
   mode.
4. **Roles are responsibility boundaries, not knowledge boundaries.**
   Split a role only when context pressure demands it, not for taxonomy.
   Per-artifact ownership prevents races when sessions run concurrently.
5. **Only the orchestrator fans out.** Hub-and-spoke assignment of work;
   peer consultation is allowed but must produce an artifact.

## Open Questions / Deferred Ideas

- **Convention enforcement by code**: a hook warning on or blocking writes
  that violate layout conventions. Deletes a whole class of silent
  post-compaction failures.
- **Role-aware compaction**: custom pre-compaction instructions per role
  (preserve role-relevant context verbatim).
- **Hot binder prompts**: v2 inserts hot edits only for SystemContext
  sources. A `systemContext` plugin domain would let binder prompts
  update without a cache re-prefill; watch for it at upgrades.
- **Binder hash-and-announce**: hook pieces land silently on the next
  request; add a diff announcement when a missed amendment actually hurts.
- **Persistent editor freshness**: a long-lived editor session accretes
  lab memory; fresh sessions per review round would be the full fix (CLI
  concern).

## Upgrade watches

- `#51960` system-baseline order: recheck the perceived context piece
  order (`abstract context`) on every runtime bump.
- An `attach` subcommand upstream would replace the `--server` flag dance
  for remote TUI attachment; adopt when it lands (see
  [remote access](/remote-access)).
- TUI dialog search and footer actions (2.0.24): the desk could adopt.

## Decision tail

Newest last. Entries age into the graduated docs above; when a fact has a
better home, it moves and leaves a pointer at most.

- **2026-09-30**: the desk. Durable review queue for the user on the lab
  server; cache decided the injection point (tail of last user message,
  re-rendered per request, never persisted). Design doc `docs/desk.md`.
- **2026-10-03**: float placement for Word export. Typst `placement: auto`
  reaches Word through the filter (stamps auto on every float), the
  fixpoint (inline token measurement, never sentinels), and the chain
  (keep-together as docx post-process). Pandoc stays pristine lab-stack.
  Contract: `docs/typ2docx.md`.
- **2026-10-04**: display math chopped where the writer cannot see it
  (Word renders oMathPara inline inside mixed paragraphs; the filter lifts
  marked equations into their own span-wrapped paragraphs; guard is
  presence of display math, not region membership, or table cells lose the
  Compact style).
- **2026-10-06**: hindsight memory joins the lab (bank `research`, config
  `config/hindsight.json`, gitignored plugin symlink; caution: server cwd
  anchors git ingestion, so the server spawns at the abstract home).
  `abstract doctor` deleted; daily use is the test, and stem resolution
  moved into `loadBinders`. Details: [lab](/lab).
- **2026-10-07**: runtime 2.0.21 --> 2.0.24. Additive-only on lab
  surfaces; owner verified the lab serves turns. Pin history: [lab](/lab).
- **2026-10-08**: kernel deadline doctrine. The lab never asks when
  requested work is due and never lets a due date shape scope; outside the
  lab a date still decides relevance (a past-due call for papers is
  closed).
- **2026-10-09**: reference shelf gains the deck starter (`deck.typ`),
  presentation doctrine, and verification conventions. Librarian doctrine
  absorbs the literature skill. A visual-review subagent joins the
  catalog. Remote-access design recorded (two doors; gateway unimplemented).
  Port moves to 4657. Propose-first rule for kernel and prompt changes.
- **2026-10-11**: this file renamed from `TODO.md` and shaved (1534 lines
  to this); prompt doctrine, model pins, lab operation, and the typ2docx
  contract graduated to `docs/{prompts,models,lab,typ2docx}.md`; the
  repertoire and pi-era arcs were dropped as superseded by `docs/repertoire/`
  and the history docs. Commit hygiene rule adopted from the owner: a
  change and its documentation land in one commit.
- **2026-10-11**: the harness restructure direction is set: the
  infrastructure (central server, persistent roles, binder) is replaced
  by a skills plus config repo consumed through OpenCode's own discovery
  (`skills` array, `instructions` array, project config, spawn-time agent
  briefs). `v1` tags the pre-restructure state. A survey of Anthropic,
  OpenAI, and community skill publishers and the design judgments on the
  owner's eight points (no central reference shelf, lint to a `staging/`
  area, one `literature` skill, nlpatch merges into a `word` skill, no
  default model pin, subagent defaults as the design surface) live in
  `docs/prompting-2026-10-11.md`.
- **2026-10-11, cutover**: the harness is deleted on branch
  `skills-restructure` (config/, prompts/, the binder and server CLI, the
  retired docs; `v1` preserves it all). The repo is now `kernel.md` +
  `skills/` + `staging/` + `agents/` + `opencode.template.jsonc`, with
  `abstract init <dir>` as the only CLI command (config from template with
  clone-resolved paths, sidekick symlinks under `.opencode/agents/`, notes
  skeleton; verified on a scratch project). `hindsight.json` moved to the
  repo root; the plugin installs globally with `HINDSIGHT_CONFIG` pointing
  here from the shell profile. Repertoire serving fixed for the
  consolidated bucket (`repertoire/md/<doi_id>.md`), and a corpus desync
  surfaced: D1 chunk spans describe the pre-leakfix md generation (probe
  paper: spans to line 1088, served md has 266 lines), so passage
  extraction needs a span rebuild before query.ts works end to end.
