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
  skeleton; verified on a scratch project). Hindsight keeps working without
  the harness's env injection: the plugin installs per machine (`bun x
  @vectorize-io/hindsight-coding-agents install opencode2`) and its config
  is one user-level file (`~/.hindsight/coding-agent.json`), with
  `hindsight.example.json` holding the lab's stanza (`optInOnly` plus
  `mapPathToBank` routing `~/projects/research` to the shared research
  bank; inert everywhere else). Repertoire serving fixed for the
  consolidated bucket (`repertoire/md/<doi_id>.md`), and a corpus desync
  surfaced: D1 chunk spans describe the pre-leakfix md generation (probe
  paper: spans to line 1088, served md has 266 lines), so passage
  extraction needs a span rebuild before query.ts works end to end.
- **2026-10-12**: two mount repairs. Skill and agent descriptions fold as
  YAML `>-` block scalars (unquoted multiline plain scalars cannot carry a
  colon-space, so 10 of 11 skills and 2 of 6 briefs failed frontmatter
  parsing and OpenCode silently dropped them; typst alone survived). The
  kernel moves off the config `instructions` array (v2 accepts but never
  loads it) onto a tree-level `AGENTS.md` symlink at the research root, the
  same boundary hindsight routes the research bank on; `abstract init`
  writes the config to `.opencode/opencode.jsonc` and checks the
  workspace-to-home walk for the kernel link, printing the `ln -s` fix.
- **2026-10-12**: the story/states split becomes doctrine on the LMAG field
  report. `story.md` is the manuscript's blueprint, narrative only;
  `notes/states.md` is the affirmative counterpart, where the work stands,
  so a fresh session picks up cold. The placement table gains `states.md`,
  `orchestrator.md`, and `scratch/` rows (llm-aig's root-file pollution,
  cleaned by its ticket-017, is the failure the scratch rows answer), and
  the literature row licenses the directory form, matching the kernel. The
  kernel gains the pickup read and the precedence rule (a project's
  AGENTS.md deltas yield to skills unless marked deliberate). Skills name
  the owning skill when they touch its domain, so triggers stay
  predictable; a skill-map paragraph declined, the descriptions are the
  tier-2 index.
- **2026-10-13**: subagent cost routing closes the bare-spawn leak (the
  round the 2026-10-11 survey deferred, point 8). V2 mechanics: unpinned
  subagents inherit the session model, so the built-ins general and explore
  ran the expensive session model, and the kernel routed experiments and
  analysis to bare spawns. Fixes: the engineer sidekick (glm-5.3#max) owns
  experiment and coding execution; template same-ID overrides pin general
  to glm-5.3#max and explore to glm-5.3; the five request.body reasoning
  overlays, which V2 preserves but never sends, migrate to native #max
  variants (provider-native, confirmed by a test spawn). Pattern verified
  against Anthropic's published setup (Opus lead, Sonnet subagents,
  per-agent pins plus a forced default as the cost lever) and OpenAI's
  product tiering (mini positioned for subagents). Session-model choice
  stays the user's.
- **2026-10-13, follow-up**: the statistician sidekick joins as design
  arbiter (the recurring consultation shape; graded-response memos 003,
  008, 009, 010 and q-matrix memo-007 are the trail), pinned to kimi
  k3-256k on the owner's order: its rulings steer the cheap executors, the
  highest-leverage seat for model power. The engineer brief gains the
  cluster-skill clause (loaded when the brief involves compute; its
  credential rules ride along, which covers the secrets concern the field
  report raised) and the smoke-locally rule: a stub-driven smoke passes
  before any cluster submission, simple proof-of-concept compute stays
  local, anything heavier goes to the cluster. Declined by the owner as
  unearned: an explicit secrets rule in the engineer brief, and
  multi-provider spreading of sidekick pins (both hypothetical risks, no
  observed failure).
- **2026-10-15**: the audience doctrine. The record (tickets, reports,
  memos, results.md, states.md, log.md, orchestrator.md) is declared
  agent-facing; the PI steers through conversation, and the surface
  instruments are the briefing and the companion. The field diagnosis, from
  the owner and the three-project audit: the instruments had become of the
  agent, by the agent, for the agent, but the skills framed them as
  PI-facing, so briefings leaked jargon and reports were presented as if
  the PI reads them. New instruments: the briefing (a conversation that
  crystallizes into `notes/briefs/briefing-NNN` at checkpoints: summary,
  supplements, rulings; a follow-up question is a defect signal), the
  companion (a dedicated artifact beside any outward deliverable: the PI's
  defense reference with provenance, assumptions, methods, anticipated
  questions; not a memo, since memos are agent-facing), and `notes/log.md`
  (the append-only event journal; the four memory files divide by tense,
  draining the logging pressure that bloated story.md and
  orchestrator.md). Ticket doctrine reverses "never over-specify how": the
  old rule rested on the PI reading tickets and a long-running engineer
  holding implementation context; with fresh cheaper subagents executing,
  tickets may pin the how. Naming verdicts (kept: ticket, report, memo, PI,
  advisor, orchestrator; "brief" stays reserved for the delegation brief,
  so files are briefing-NNN) are recorded here rather than in doctrine,
  per the owner's note: PI encodes the authority gradient (advisor the
  external oracle, PI the leading investigator, orchestrator the primary
  agent), and correct naming routes agent attention.
- **2026-10-17**: the cluster interface collapsed to its minimum after
  wrapper prototyping. A qsub wrapper (crc run/get-node, Open Terminal
  sessions, idle watchdogs) was built and e2e verified, then dropped by
  PI decision: the interface is the `ssh crc` alias on Centurion (the
  systemd crc-keeper service holds the autossh master, plain text
  credentials in ~/.config/crc/env), frontend for burst compute, plain
  qsub through the alias for real computation, with a per-project job
  ledger (notes/cluster-jobs.md) mandated by the skill. Investigations
  that decided it: frontend and compute nodes are the same EPYC 7543
  silicon; the scheduler is pure fair-share so big asks starve after
  campaigns (16 and 32 core probes pended 4 to 5 minutes); qacct is
  admin-only, which explains every missing accounting record; long
  queue jobs run days routinely, so holding cores is unremarkable. The
  skill was rewritten to the two door form and landed.
- **2026-10-16**: the repertoire span rebuild closes the corpus desync
  from the 2026-10-11 cutover. Owner ruling: the retrieval corpus is
  journal papers only (psychometrika, bjmsp, jebs, jem: 6,985 papers,
  ~298 MB md); repertoire is setting exemplars for the writer, not a
  training index, so preprints stay stored for training but out of the
  index. Full chain rebuilt: md pulled from R2 with the new fetch-md.ts
  (the CF_S3 key pair proved stale, 401; the wrangler token path carried
  6,985 objects with zero failures, and three raw/ probes sha256-verified
  against D1 sources), re-chunked (231,625 chunks, ~74M tokens), D1
  chunks reloaded, re-embedded (voyage-context-4, inside the free
  allowance), Vectorize recreated in place (no consumers post-harness),
  count-verified (231,625; vectorCount in wrangler vectorize info lags
  asynchronously, so verify after a wait, not on the insert's heels), and
  query.ts --smoke passed. Open follow-ups: the repertoire tool behind
  abstract-mcp (surveyed hybrid BM25 via D1 FTS5 plus RRF fusion; owner
  ruling pending), a fresh R2 S3 token, and the raw/ bucket cleanup
  decision parked with the owner.
- **2026-10-17**: repertoire_query lands in abstract-mcp, closing the
  follow-up from the span rebuild. Owner rulings of the day: repertoire
  is academic writing-style assistance, a tool family separate from
  paper_* (which is literature discovery for lit review); the retrieval
  stack stays handmade rather than an industry engine (Elasticsearch et
  al.) because of cost and because the unique use case demands control
  over embedding and reranking choices; the reranker is voyage rerank-3.
  Hosting stays on centurion rather than a Cloudflare Worker: the paper
  half is immovable (campus entitlement is network identity, plus the
  persistent Chromium profile), and splitting families buys nothing.
  Implementation: chunks_fts full-content FTS5 keyed by a stable FNV-1a
  chunk_id shared with chunks; RRF k=60 over 50-per-leg candidates, pool
  of 20 through the reranker; passages served from the FTS text.
  Lessons landed in the corpus manual: D1 FTS5 boolean operators must be
  UPPERCASE (lowercase or is searched as a literal term, silently
  turning OR into AND), FTS text is capped at 16K chars (a 176K atomic
  table tripped SQLITE_TOOBIG), and voyage's rerank REST response wraps
  results in data, not results. Also today: the committed systemd units
  were removed from the repo (host state, not doctrine).
- **2026-10-22**: Linear joins the workflow as the PI-visible surface for
  work status (team SGH, MCP in session, `linear` CLI as the script
  fallback). Owner rulings: the mirror runs at milestone grain, not
  issue-per-ticket; the abstract repo itself maps to the `research`
  catch-all Linear project, not ops; this primary agent signs no comments
  (RA is a supervising entity, the board's signature convention belongs to
  other writers). Placement followed the audience doctrine: `notes/` stays
  the record, Linear is the surface; the kernel carries only the invariant
  (milestone-grain mirror, PI-authored issues are work requests, check at
  pickup), the research skill's logistics carries the mechanics, each
  project's `notes/orchestrator.md` names its Linear project, and the
  template mounts the Linear MCP for every project.
- **2026-10-22**: The convincing doctrine lands lab-wide, from the AI-use
  harness considerations (Slina's raw record of the Oct 19-21 discussion,
  banked in hindsight). Owner's definition: convincing means the direction
  is the outcome of consideration, not whim; every decision names the
  alternatives that were live and how each was eliminated, tried and
  failed empirically, cited out of the running, or shown suboptimal for
  the case. Working is not the bar, because research is not engineering:
  the chosen approach must be shown the only one that works or the best
  for the case, with evidence or citations, and the elimination record is
  the why of the work and the first mine for manuscript drafting. Landed
  as a kernel Never Forget bullet, a Loop paragraph in the research
  skill, a Decisions and Alternatives section in the ticket and report
  templates, smaller extensions in the memo and briefing templates, and
  an executor paragraph in the engineer brief. An earlier
  acceptance-criteria draft (predictions with tolerances, met/refuted
  verdicts) was rejected by the owner as a spec sheet, engineering-shaped;
  predictions with tolerances stay parked with the graded-response
  ruling, and the doubt-attaches-to-artifacts kernel line remains
  deferred.
- **2026-10-22**: The writing skill gains a Drafting from Scratch
  section, closing the process gap the style guide never covered: the
  rules bound revision and review but said nothing about generation, so
  agents defaulted to whole-document composition in one pass. The new
  doctrine builds a manuscript section by section and paragraph by
  paragraph, iterates at the smallest broken unit, runs the nodding
  test after each section before opening the next, and drafts the body
  first (method, results, discussion, introduction, abstract last).
  Owner's order; the body-first drafting order was the assistant's
  addition and survived review.
- **2026-10-22, model routing**: the K3 quota runs out temporarily, so the
  statistician moves off kimi k3-256k to GLM 5.3, the provider the other
  executors already use. Together with the same round's effort change
  (every GLM 5.3 and GLM 5.3 Flash pin drops from #max to the model
  default, on the owner's order), this trades the statistician's
  highest-leverage seat for quota relief: a deliberate, temporary
  departure from the 2026-10-13 follow-up rationale, to be revisited when
  the K3 quota returns. The same round moves every GLM pin off
  zai-coding-plan to the plain zai provider, on the owner's order.
- **2026-10-22, GLM quota**: GLM quota ran out too, so routing moves to
  deepseek-v4.1-flash (`deepseek/deepseek-flash`, default effort) for
  every sidekick and both built-in overrides; the statistician returns to
  kimi k3-256k, matching the 2026-10-13 rationale (its rulings steer the
  cheap executors). reviewer-external leaves deepseek-v4-pro for the same
  cheap model, so the cold read no longer differs by vendor from its
  fellows; restore it when quota allows. The prior routing entry's
  "GLM 5.3 at default effort" holds only for the round it records.
- **2026-10-22**: The repertoire_query deploy on centurion completed.
  The blocker was never code (the unit runs bun against this repo's
  working tree, so a restart picks up commits) but two missing env
  keys; VOYAGE_API_KEY and CLOUDFLARE_API_TOKEN were added to
  ~/.config/abstract-mcp/env, the unit restarted, and the tool verified
  live through https://abstract.sgh.ng/mcp (7 tools listed, on-target
  passages from psychometrika and bjmsp). Lesson: when the session is
  on the deploy host, "user deploys" is stale; deploy is part of
  implementation.
- **2026-10-22**: The writer sidekick lands, pinned to
  kimi-code-plan-global/k3-256k (owner ruling: prose style differs
  sharply by model, so drafting earns a dedicated pin). Drafting was
  the last recurring shape still routed to bare spawns; the kernel's
  drafting pattern now names the writer, and the sidekicks table gains
  its row. The brief carries the writing-skill load, the repertoire
  frequency floor from the same day's wiring, and an explicit
  no-fabrication guard.
- **2026-10-22**: The repertoire wiring lands, closing the gap behind
  the owner's observation that agents rarely consult the corpus. Root
  cause: the project template never mounted the abstract MCP server, so
  research-project agents had no repertoire_query in their toolbelt,
  and the repertoire skill pointed at the CLI two hops away in another
  repo, which is also the dense-only path (the hybrid engine with the
  BM25 leg and rerank lives only in the MCP tool). Fix: the template
  mounts https://abstract.sgh.ng/mcp first in its mcp map, the
  repertoire skill's Invocation leads with the tool and demotes the CLI
  to scripts and bulk passes, and the writing skill's Repertoire
  section gains concrete triggers (section opens, uncertain phrasing,
  numbers and hedges) plus a frequency floor (query every section at
  least once; the corpus check is part of drafting, not of revision).
  Existing research repos still need the mcp entry in their own
  configs, same rollout pattern as the Linear mappings.
