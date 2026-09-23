# TODO -- Design Rationale and Roadmap

This file records _why_ the harness is designed the way it is, so the reasoning
survives compaction and session boundaries. Read it before changing the
architecture. Status markers: [done] / [next] / [deferred].

## Goal

An agentic harness for academic research: a small team of long-running agents
with persistent, per-role context, whose interactions and context management we
can iteratively fine-tune. Niche: academic research (not coding).

## Core Principles (and why)

1. **Files are memory; sessions are attention.** "Long-running agent" = a
   persistent session file (pi JSONL), not a long-running process. Durable
   understanding must live in `notes/` artifacts (tickets, reports, memos,
   literature.md, story.md); session context is a lossy cache that _will_ be
   compacted. Anything that matters gets written down before the turn ends.

2. **Consultations are tool calls; artifacts are files.** A consultation reply
   is ephemeral (returns into the asker's context); anything with lasting value
   must additionally land in `notes/` (memo, ticket "Because", literature.md).
   This keeps contexts clean and the record complete, and preserves the
   manifesto's Corollary A (visibility) -- all coordination is human-readable.

3. **Three tiers of knowledge.**
   - _Kernel_ (`AGENTS.md`, always loaded, survives compaction): invariants only
     -- layout, naming, stack, roster. Membership test: "if forgotten, would the
     failure be silent and costly?"
   - _Index_ (skill descriptions in the system prompt): trigger-style, one line
     each -- tells agents a skill exists and when to read it.
   - _Modules_ (skills, on-demand): procedures and templates, written to be
     self-contained and re-enterable cold after compaction. The pre-restructure
     failure mode (agent placing files wrong after compaction) happened because
     tier-1 knowledge lived in tier-3 files.

4. **Roles are responsibility boundaries, not knowledge boundaries.** (From the
   skill bundle's delegation note.) Split a role only when context pressure
   demands it, not for taxonomy. Per-artifact ownership prevents races when
   sessions run concurrently: orchestrator owns story.md + tickets, engineer
   owns experiments/ + reports, librarian owns literature.md + memos.

5. **Only the orchestrator fans out.** Hub-and-spoke assignment of work; peer
   _consultation_ is allowed (engineer <--> librarian) but must produce a memo
   artifact.

## The Team

- **Orchestrator** -- strategy, story.md, tickets, user contact. Was
  `supervisor.md`.
- **Engineer** -- executes tickets, owns experiments + reports. Was `phd.md`.
- **Librarian** -- literature expertise; _consultant_ (query --> memo), not a
  pipeline stage. New.
- **Narrator -- [deferred].** Owning "the story" was rejected: the story _is_
  the strategy, so it stays with the orchestrator (an orchestrator that must ask
  another agent what the story is has drifted). If narrative work (manuscripts,
  presentations, proposals -- the `draft/` world) overloads the orchestrator's
  context, split out a narrator as owner of _outward-facing artifacts_,
  including taste/conventions of academic publishing -- not as keeper of the
  story.

## Interaction Protocol

Rhythm: **converge --> compile --> execute --> synthesize**.

- Tickets are **co-designed**: orchestrator consults librarian (background) and
  engineer (feasibility) before finalizing; a few rounds are normal. During
  drafting, redraft freely; after delegation, changes are amendments.
- Consultations must **converge**: finalize, or escalate to the user with a
  decision. Cap rounds; unbounded dialogue is a token sink.
- Consultations on independent aspects (background vs. feasibility) may fan out
  in parallel -- the one place parallelism buys pure latency.
- Parallel _workstreams_ are not a near-term concern; the core loop is a
  dependency chain. Intra-role map-reduce (librarian triaging papers,
  section-by-section review) is fine via fire-and-forget subagents.

## Why a Harness (SDK), Not Just Config

The consult primitive -- one session programmatically prompting another
persistent session and getting a reply -- requires in-process session control.
Only the pi SDK provides it. CLI-level alternatives are simulations: headless
`pi -p` subprocess calls (process spawn per consult, session-file locking) or
RPC plumbing. Hence the phased plan:

1. [done] **Restructure repo as pi agent directory** (this layout). Roles,
   kernel, skills are harness _inputs_ regardless of how the harness is built.
2. [done] **SDK harness CLI** (`abstract`, Bun-linked, this repo's
   `package.json` bin): replaces the `bin/` shell scripts entirely (deleted; git
   history is the rollback). Design settled in the decisions log below (see "SDK
   harness v1"). Three peer SDK processes, one per tmux pane, each with its own
   `InteractiveMode`; cues stay file-based. v1 is full parity with `bin/` plus
   the custom `SYSTEM.md` prompt.
3. [deferred] **Standalone binary**: compile the same CLI via
   `bun build --compile` once the interaction model stabilizes and we want
   distribution without a Bun install.

(The earlier phase-2 "extension-harness" idea -- one interactive pi process
holding the other roles' `AgentSession`s in-process -- was considered and
rejected for v1: it breaks the three-pane model and fights the one-terminal-
per-process nature of `InteractiveMode`. File-based cues make it unnecessary. If
in-process consult via `prompt()` ever earns its keep, the cue extension is the
interface that survives either way.)

Until the harness exists, the `bin/` launchers + file-mediated consult relay
(human or headless `pi -p`) were the prototype; both are superseded by the
`abstract` CLI (`src/cli.ts`).

## Open Questions / Deferred Ideas

- **Convention enforcement by code**: a pi extension hooking `tool_call` to
  warn/block writes that violate layout conventions (manifesto Corollary B:
  express as code what can be expressed as code). Deletes a whole class of
  silent post-compaction failures.
- **Role-scoped skills**: the CLI could pass per-role skill paths (or use
  `skillsOverride`) if all-skills-visible proves distracting. Start simple.
- **Role-aware compaction**: custom `session_before_compact` instructions per
  role (preserve role-relevant context verbatim).
- **Session-file locking** if headless consults ever touch a session that is
  open interactively.
- **Parallel workstreams**: multiple in-flight tickets with per-artifact
  ownership; revisit after the single-workstream protocol is solid.
- **Hot binder prompts (upstream watch)**: v2 inserts hot edits only for
  SystemContext sources (instructions, skill index, references, env/date). A
  `systemContext` plugin domain, or per-agent instructions, would let binder
  prompts update without a cache re-prefill. Watch for it at upgrades; until
  then editing a prompt costs one re-prefill for the affected roles.

## Canonical Decisions Log

- **Reference stock for Word exports (2026-09-20)**: deliverables converted to
  docx now share one house template, and it lives in the codebase, not the
  global abstract state: `~/.local/share/abstract` is the CLI's runtime
  territory (server state, credentials, DB), while the stock must stay versioned
  beside the patches that generate it (Helium-browser model; the pristine pandoc
  template is never forked, the patches are the source of truth).
  `tools/build-reference.sh` is deliberately minimal: export pandoc's pristine
  reference docx, unpack, apply the named `*.patch` files in `tools/` in
  alphabetical order (each names one concern, so template drift from a pandoc
  upgrade fails at the offending patch; clean apply is the whole contract, no
  smoke test), repack into `reference/reference.docx` where the existing
  `lab-reference` alias already reaches every session (the CLI pins
  `OPENCODE_CONFIG_DIR` to the repo's `config/`, and relative reference paths
  resolve from the config file, so the alias is repo-anchored for all projects).
  The stock carries the house styles: Times New Roman throughout, all heading
  colors black, a 0.5 in first-line indent on every body paragraph with
  inter-paragraph spacing removed (Compact and Block Text suppress it), figures
  and tables centered, captions left, and a three-line table (top and bottom
  rules added; the header rule ships in the stock's firstRow formatting, and the
  stock has no other borders to suppress). The artifact stays a zip (pandoc
  requires a real docx container) and is committed so sessions can export
  without building.
- **Style guide register recalibration (2026-09-20)**: the guide's first pass
  produced eleven false positives, all against the advisor's own edits (utilize,
  dramatically expanding, high-quality, rich, substantially, It is important to
  note, ...). Diagnosis: three wrong equivalences. Plain had been read as
  stripped ("boring" drove it) instead of measured against the field's published
  idiom, whose routine evaluative vocabulary is plain; hedging had been scoped
  to every statement instead of empirical claims; signposting had been swept as
  spoken filler instead of transition. Fixes: Words opens with plain-by-idiom
  plus a positive-voice paragraph (the failure is exaggeration or drama, never
  praise; "boring" retired from the vocabulary rule), Tone holds asymmetric
  confidence (neutral toward the evidence, positive toward the contribution;
  rate others factually, sell your own), Sentences blesses signposting as
  transition, and Repertoire gains the arbiter role (a phrase the venue
  publishes routinely is plain). This realigns the guide with writing-craft
  Framing's strategic optimism: humble toward evidence, positive toward the
  work, factual toward others.
- **Style guide rename and restructure; density doctrine retired (2026-09-19)**:
  `prose-standard.md` renamed `style-guide.md` (the name says what it governs,
  prose level style) and restructured from a failure-modes/conventions grab-bag
  into units of the text (nodding reader, paragraphs, sentences, words,
  formatting, numbers and citations), each rule at its own level. Author edits
  folded in: the opening is now history and background --> field importance -->
  our impact and novelty --> what we did (replacing the vague big/small story);
  fragmented and too-short paragraphs are failure modes (very short usually
  means the logic itself is fragmented); "undefined insider terms" widened to
  nuanced wording, word choice conservative and boring; citations just follow
  APA; the precision metric is usually the SD or the p value; the vague "no
  AI-sounding constructions" bullet removed; new sentence rules (simple
  structure, no clever clauses, natural transition words). AGENTS.md lost the
  Density bullet and Recursion lost "no word made denser" (saying little is
  economy, not density; density made prompts archaic). The rename was swept
  through score.ts, the kernel token ("the style guide"), writing-craft, editor
  aspect 2, the grants skill, and dev docs; historical entries in this log keep
  the old name.
- **Prompt audit round 2: fresh eyes; directory reshape; punctuation bans
  (2026-09-17)**: three subagent audits (cross-reference, cold-reader role
  simulation, rules-compliance) found seam failures, not machinery failures:
  kernel contradictions (Date fields in the logistics templates, a versioned
  ticket example), dangling pointers (three `../typst.md`, an undefined
  `references/` dir, bare Zotero tool names kept deliberately for observation),
  coinages without homes ("the +2 beyond the 10", "keyword questions" outside
  the editor's score, "known risk" with no landing spot, "the grain you
  review"), and routing gaps (the adversarial round had no trigger,
  citation-check was routed by nobody, the writer was taught to hand-run the
  sweep a subagent owns). Reshapes: `lab/` --> `config/`, `movement/` -->
  `prompts/`, skills de-symlinked into `config/skills/`, named subagents nested
  under `config/agents/subagents/` (IDs carry the prefix; doctor and prose
  updated), `$HARNESS_DIR/reference` prose replaced by the OpenCode `references`
  feature (`lab-reference` alias in config/opencode.json), project `references/`
  added to the kernel layout for source PDFs. Punctuation: deliverable prose now
  bans colons, semicolons, and dashes (prose-standard); agent-facing prompt text
  bans `--` in any form (generation shift; swept corpus-wide,
  frontmatter/flags/tables are syntax and stay). Workflow closures: writer cues
  the editor after each revision and both rounds gate externalization along with
  a citation-check the editor now owns as an aspect; "known risks" land in
  story.md (template gained a Known Risks section); the key-results registry
  `notes/results.md` is engineer-owned, orchestrator-arbitrated, and the
  stale-number-sweep's first source; memos completed into the kernel layout, the
  naming rules, and a logistics template (with the frontmatter-date exception to
  the no-dates rule). Skills: logistics slimmed 550 --> 215 lines (templates +
  placement + wiki-links + amendments only); literature rebuilt sans Perplexity
  (search via tavily/web, import relayed through the orchestrator, verification
  standard deferred to the librarian prompt); manuscript dissolved (docx.md -->
  nlpatch skill, journal-review.md --> own skill); typst package policy routes
  through the orchestrator; presentation's peer-subagent choreography rewritten
  flat (stale skill, full rewrite pending; the role question was answered
  piggyback: talks are the writer's artifacts with editor review, no sixth
  role). Model pins: orchestrator + engineer on Kimi K3, librarian on MiniMax
  M3, writer + editor on GLM 5.3; server default stays MiniMax M3 for cheap
  scratch instances. Deliberately deferred: repertoire gating and MCP scoping
  (observe first; the rulebook records scope-by-observation), Zotero tool name
  unification (observe), story-keeping template size (watch). Process rule added
  to AGENTS.md: post-surgery grep of descriptions, siblings, and dev docs after
  every graduation round.
- **Prompt audit round; `abstract context` (2026-09-17)**: the audit became an
  instrument -- `abstract context [role] [--json]` (src/context.ts) prints each
  agent's assembly (kernel, movements with sizes, skills index, subagent
  catalog, tool surface), mirroring the plugin's own assembly; static-first,
  live-enriched, never boots the server. Graduations per the hierarchy rules:
  the engineering skill graduated wholesale into `movement/engineer.md` and was
  deleted (sole single-role audience, near-certain invocation); its
  supervisor-era verification protocol, pre-work checklist, kernel restatements,
  and its positive-framing section (which contradicted the movement's "report
  facts fully; framing happens downstream") died in the merge, while the
  data-discipline core survived. Literature split along the doctrine/ops line:
  the claim-verification standard graduated into `movement/librarian.md`; the
  Zotero/Perplexity operations manual stays a skill. writing-craft's Proposal
  section demoted into the grants skill (episodic artifact type; fills what was
  an empty stub). manuscript/review.md deleted as superseded by the nlpatch
  skill. Dedup: orchestrator.md stopped restating story-keeping's update cadence
  and review passes; librarian.md stopped restating the kernel's
  consultations-are-ephemeral rule; logistics defers layout/naming to the kernel
  (the engineering-skill pattern) and the report template gained the Discovery
  Zone section two prompts referenced but no template had.
  docs/prompt-hierarchy.md rewritten to the real mechanism (kernel auto-load,
  score assembly, skills index, subagent prompts) with two new rules: context is
  equipment (over-presentation invites a role to exercise what it should
  delegate; tool and MCP scoping follow), and compaction mechanics (system
  prompt rebuilt per request, never compacted; skill bodies read into history
  are). The migration commit was rewritten (with owner approval; force-pushed)
  to include the 25 retirement deletions its message claimed but its tree
  lacked; docs/stylometer.md tracked. Open: deny `repertoire` to non-writing
  roles via agent frontmatter permissions (pi-era HARNESS_ROLE gate), and MCP
  scoping (zotero was librarian-only in pi).
- **NLPatch bundled as a subagent; source-first patch derivation (2026-09-10)**:
  `movement/nlpatch.md` was a dead movement (in no score) while the skill and
  orchestrator prompt referenced an `nlpatch` subagent name that resolved to
  nothing. Migrated to `subagents/nlpatch.md` with the spec inlined: children
  are born blind, so the prompt must carry everything, and bundled prompts are
  paid once instead of per spawn. Division of labor: the writer owns Word
  logistics. Ingress (DOCX to patch, faithful, no interpretation) and egress
  (refine a machine word-diff; never hand-authored hunks) both delegate to the
  subagent; the orchestrator only routes (feedback arrives as
  `draft/<artifact>-vN-<name>_edit.docx`, writer parses and proposes
  dispositions, orchestrator arbitrates against the story, never opening the
  DOCX). Egress diffs against the accepted baseline (`--track-changes=accept`),
  not v0, and against rendered text, not raw Typst. Hand-authored patches
  survive only for foreign manuscripts (journal review), where the lab owns no
  source. The spec moved from the manuscript skill to a dedicated `nlpatch`
  skill: grants and proposals round-trip through Word too. Subagents write
  artifacts to task-given paths and report summaries only; the 32k report cap
  would truncate a full-manuscript patch. `_edit` breaks kebab-case
  deliberately: an underscore in `draft/` marks foreign provenance.
- **Subagents; reviewer becomes the editor (2026-09-05, issue #27)**: disposable
  in-process child sessions (`extensions/subagents/`, telemetry in
  `.pi/subagents.jsonl`), voluntary by agent judgment and mandatory for known
  failure modes. Bundled over ad-hoc: tool-call arguments persist verbatim in
  the parent's context until compaction, so per-spawn system prompts are a
  recurring tax; bundled subagents (`subagents/<name>.md`) pin prompt, tier, and
  tools, while bespoke prompts remain for inherently bespoke work, above all the
  editor's reviewer panels. Reviewer role renamed editor: fresh-eyed reading
  moved down into reviewer subagents (vary model family x familiarity); the
  editor curates the panel, collates, and owns the verdict. Tiers are semantic,
  not model SKUs (OmO's categories insight): routine (least capable suffices),
  standard, deep (hard reasoning); mapping lives in `subagents/tiers.json`;
  escape-hatch overrides are logged for observation.
- **The lab ledger; director interface; OpenCode spike shelved (2026-09-05, see
  `docs/ledger.md`, issue #28)**: visibility for an unsupervised lab comes from
  a semantic event layer, not transcript reading. One core module
  (`src/ledger.ts`) owns the event files under `.pi/`; lab agents get
  `ticket`/`cue`/`complaint` as native pi extension tools, external callers (the
  director, OpenClaw, scripts) get `abstract` CLI subcommands over the same
  core. MCP is our ingestion format for third-party tools, never our publishing
  format -- portability lives at the code level. Event sourcing: the ledger IS
  the state; per-role ticket state is a replay. Kernel/skin split: the ledger
  schema is domain-neutral; academia lives in roster, movements, tools. Ticket =
  unit of dispatched intent, granularity set by director bandwidth; spans
  bracket execution; artifact transitions are in-span notes. Reproducibility
  principle: the director addresses the lab through the orchestrator (enforced
  in code: director cues route only to the orchestrator); corrections flow
  through the audit loop, never through direct intervention in a peer's session,
  because session-local fixes die with compaction. OpenCode runtime spike
  shelved as scope creep: the TUI motivation evaporates once the interface is
  briefings-via-gateway, and runtime neutrality is achieved by the MCP layer
  without a migration. OpenClaw's role is presence/transport as a CLIENT of the
  lab server, never the lab's host. Own semantics, rent mechanics; rented
  machinery lives harness-side behind owned interfaces and never enters agent
  context.
- **Prompt hierarchy (2026-09-04, see `docs/prompt-hierarchy.md`)**: three
  layers -- shared movements (the all-hands meeting), role movements (the
  one-on-one), skills (reference manuals). Doctrine lives with the role that
  owns the artifact it governs: story keeping in `story-keeping` (orchestrator,
  owner of story.md), writing craft in `writing-craft` (writer, owner of
  draft/), the shared prose standard in `prose-standard` (writer + editor),
  shared narrative doctrine in `story-doctrine` (orchestrator maintains, writer
  instantiates). Never duplicate within one agent's context; duplication across
  agents is acceptable at audience-chosen grain (editor gets a checklist, not
  the writer's rationale). The `writing`, `philosophy`, and `story-keeping`
  skills graduated into movements and were deleted; `typst` stays a skill
  (typesetting medium is not the writer's constant concern and may change). The
  deprecated "When Supervising" section (dual-session PhD/supervisor era) is
  gone.
- `notes/story.md` is the story location (per the later logistics refinement;
  older docs said project root -- consolidated in the restructure).
- Experiment dirs: `experiments/NN-name/` (not `exp-NNN-`).
- Numbering: `NNN` (three digits) for tickets, reports, memos.
- Repo doubles as `$PI_CODING_AGENT_DIR`; state files are gitignored, never
  committed.
- `AGENTS.md` briefs agents _developing this repo_ only. Lab invariants live in
  `motif.md` (package naming follows a musical theme) and are injected into the
  system prompt by the harness (bin/ launchers today, the SDK CLI's
  `appendSystemPrompt` paths once it lands).
- Lab agents run with `--no-context-files`: no ambient AGENTS.md/CLAUDE.md,
  neither this repo's dev briefing nor the research project's own. The SDK
  harness must set the equivalent (`noContextFiles: true` in loader options).
- **Multi-agent model (see `docs/multi-agent.md`)**: one conversation stretched
  across context-isolated sessions; turn-taking, not throughput. Three peer pi
  processes (direct live control of every agent is a permanent requirement);
  cues carried brokerlessly by a per-project file inbox under
  `<project>/.pi/harness/` (no daemon; the directory tree is the bus); harness
  extension self-configures from `HARNESS_ROLE`; `bin/lab` opens all three roles
  in tmux. Implementation plan in `docs/harness.md`.
- **One primitive: `cue(target, message)`**. No ids, no subjects, no answer
  tool; initiating and resolving are the same call. Resolution = the receiver's
  next cue back (FIFO, advisory). No target restrictions: anyone can cue anyone;
  consult conventions live in role prompts, not the mechanism. Cues are
  reminders, not records; durable state lives in artifacts.
- **Offline cues are durable, not failed**: a cue to a closed session waits on
  disk and delivers on launch; the status line shows pending counts.
- **Cues are always follow-ups; agents never steer each other.** Humans steer
  natively (Enter = steer, Alt+Enter = follow-up, Esc = abort).
- **Multiple outstanding cues allowed; one inbound cue at a time per agent**
  (FIFO over the inbox dir). Fan-out is allowed, not encouraged.
- **No passports, no harness to-do lists in v1**: watch whether agents
  self-track; add structure only where pain is felt.
- Multi-project layering: agent dir = shared lab config; project cwd = sessions,
  notes, `.pi/` overrides; harness anchors child state at cwd.
- **Resource inheritance policy** for the three-layer model (Pi Agent global in
  `~/.pi/agent/`, Abstract global in `$HARNESS_DIR`, project-local in
  `cwd/.pi/`): `auth.json` and `models.json` are symlinked from `~/.pi/agent/`
  into the harness agent dir; `prompts/` and `themes/` are loaded from
  `~/.pi/agent/` via explicit `--prompt-template` and `--theme` paths while the
  harness keeps its own `prompts/` and `themes/` directories as the Abstract
  global layer; `skills/` and MCP _server definitions_ are _not_ inherited from
  `~/.pi/agent/` -- the harness uses its own `skills/` directory and any
  project-local `.mcp.json` / `.pi/mcp.json`.
- **MCP via our own extension** (`extensions/mcp/`), replacing
  `npm:pi-mcp-adapter` -- and built "by not building it": not an interface for
  hooking random MCPs, but an internal adapter that registers tools we don't
  implement (the implementation hides behind a server URL). Studied
  pi-mcp-adapter (sync registration from a disk cache) and OpenCode (no cache;
  in-memory defs; down server = absent tools) and took the OpenCode branch: **no
  cache, no config file**. Servers are code (`servers.ts`): per-role scoping
  (`roles`, e.g. zotero is librarian-only) and tool-list shaping (`map`, e.g.
  tavily__--> web__) are plain functions. On session_start we connect,
  `listTools`, shape, and register flat names through the same `registerTool`
  path as `cue` (no `mcp__` prefix); post-bind registration provably survives
  vanilla `/reload` (probe3). Secrets live only in gitignored `mcp.secrets.json`
  (flat KEY=VALUE), expanded into `${VAR}` placeholders. v1 scope: tools only,
  stdio + streamable-HTTP (SSE fallback), no OAuth; failures are loud
  (ui.notify) and never crash the session. `inspect.ts` dumps the shaped tool
  surface as JSON for curation.
- **Cue extension is fire-and-forget for now**: state tracking
  (`awaiting`/`debts`, one-cue-at-a-time gate, status line, reminders) is
  disabled while we test whether agents can self-manage turn-taking with human
  oversight. `cue(target, message)` simply writes to the target inbox and
  delivers as a follow-up; the old state machine is preserved in a
  `DISABLED_STATE_MACHINE` block in `extensions/cue/index.ts` and in git
  history.
- **Writer + reviewer roles**: the deferred "narrator" outward-facing artifact
  role is implemented as **writer**, with a **reviewer** as the writer's
  devil's-advocate consultant. The orchestrator keeps `notes/story.md`; the
  writer owns `draft/` and writing tickets; the reviewer writes memos and does
  not edit `draft/`. Externalization is approved by the orchestrator. The CLI
  opens a `core` window (orchestrator | engineer | librarian) and a `writing`
  window (writer | reviewer), attaching to `core` by default.

### SDK harness v1 (settled; supersedes the bin/ prototype)

- **One Bun CLI, one entry point**: `abstract`, linked via this repo's
  `package.json` bin. The CLI computes the tmux session name, creates or
  reattaches the session, and spawns the three role processes into panes itself
  (internal hidden flag, e.g. `abstract __run <role>` -- not a user-facing
  subcommand). `bin/` and the shell launchers are deleted once the CLI lands;
  git history is the rollback.
- **tmux UX unchanged**: three even horizontal panes (orchestrator | engineer |
  librarian). Session name is `abs-<project-dir-basename>` -- no state file, no
  hash; two projects sharing a basename collide (accepted; add an override flag
  if it ever bites). Reattach if the session exists with the right layout;
  otherwise recreate. Detach leaves agents running (panes are children of the
  tmux server, not the CLI); if the tmux server died, panes resume the session
  files. Files are memory; processes are attention.
- **Three peer SDK processes**, one per pane: `createAgentSessionRuntime` -->
  `createAgentSessionServices` (agentDir = this repo, `noContextFiles: true`,
  session pinned per role at `.pi/sessions/<role>.jsonl` under the project cwd)
  --> `InteractiveMode.run()`. Full pi TUI per pane, including `/reload`.
  One-process-three-TUIs was investigated: `InteractiveMode` accepts an
  injectable terminal, so it is not a hard restriction, but `ProcessTerminal`
  owns process-global state (raw stdin, signal handlers, alternate screen), so
  three TUIs in one process means reimplementing a terminal multiplexer. tmux
  already is the multiplexer; one process per pane is the natural boundary.
- **Custom system prompt via pi's native file discovery**: a `SYSTEM.md` in the
  harness dir replaces pi's default prompt. Content: keep the "expert coding
  assistant" identity (it drives correct tool behavior -- the agents work by
  exploring directories programmatically) but drop the "inside pi" framing and
  the entire pi-docs pointer block; keep the four tool one-liners
  (read/bash/edit/write) and pi's three default guidelines verbatim ("use bash
  for file ops", "be concise", "show file paths clearly") -- they are
  tool-behavioral, not pi-specific, and "show file paths" matters because
  artifacts are the lab's memory. Motif and role description are NOT baked into
  SYSTEM.md.
- **Per-role assembly as file paths, not strings**: the CLI passes
  `appendSystemPrompt` the role's movements from the score (`src/score.ts` -->
  `movement/<stem>.md`). `DefaultResourceLoader.resolvePromptInput` reads a
  source from disk when it is an existing path, and `reload()` re-resolves on
  every `/reload` -- so edits to `SYSTEM.md` or any movement take effect on
  `/reload` with zero custom code. (New prompt applies from the next turn;
  history keeps what it was sent with, same as vanilla pi.) This is why we do
  NOT need a custom `ResourceLoader` subclass for v1 -- the vanilla mechanism
  already gives us the reload semantics; revisit only when per-role skills or
  dynamic assembly become concrete.
- **Score and movements**: prompt assembly is data, not code -- `src/score.ts`
  maps each role to an ordered list of movement stems; each movement is a
  Markdown file in `movement/`, general --> specific (shared doctrine, role). A
  movement is always-on iff needed in most turns of the role or forgetting is
  silent and costly; everything else stays an on-demand skill. Graduating a
  skill to always-on means extracting its body into a movement (no frontmatter)
  and listing its stem in the score.
- **Empiricism governs placement**: start minimal, observe the agents, add back
  only proven failures. First applications: writer.md dropped its cue-routing
  paragraph (the roster implies who to ask for what), and
  skills/manuscript/authoring.md graduated to `movement/authoring.md` (the
  writer's sole function is authoring); the writer's score is now
  `["motif", "authoring", "writer"]`. The manuscript skill keeps review and
  format tooling.
- **Skills block unchanged**: pi renders the `<available_skills>` listing from
  the harness `skills/` dir exactly as before.
- **Communication unchanged**: brokerless cue file inbox under
  `<project>/.pi/harness/`; the extension self-configures from the role. Noted
  potential: with SDK processes, consult could later move to in-process
  `prompt()`; the cue interface survives either way.
- **v1 scope is full parity**: credential symlinks (auth.json/models.json),
  prompts/themes inheritance paths, `HARNESS_ROLE` (becomes the internal pane
  flag), session pinning, cue extension -- all ported to code in the CLI. No
  staged rollout; half a harness means running two harnesses.
- **repertoire transcribes publisher HTML instead of converting PDF** (2026-09):
  a docling/marker/MinerU bake-off showed every ML converter introduces
  unfixable damage (rasterized equations, flattened tables, OCR-class text
  errors), fatal for a prose-imitation corpus. Cambridge Core serves full-text
  HTML for 395/395 Psychometrika 2020-2025 articles with byte-perfect prose,
  author LaTeX in span.tex-math, and image-based tables with stable CDN URLs.
  Pipeline: list -> fetch-html -> html2md (cheerio + turndown), D1 for
  papers/assets metadata, Vectorize + R2 pending. Details and gotchas in
  docs/repertoire.md.

## 2026-09-08: repertoire exposed as an agent tool

The corpus becomes a tool, not an MCP server: `extensions/repertoire/` registers
`repertoire` (one noun, three verbs -- search/context/outline) via
pi.registerTool for the writer and editor peers only (HARNESS_ROLE gate). search
hits Voyage + Vectorize REST; context/outline read the local chunk cache
(repertoire/.cache/chunks), no vector query needed. Subagents run with
noExtensions, so custom tools are passed by object: extensions/subagents keeps a
CUSTOM_TOOLS registry and subagent frontmatter `tools: [repertoire]` pins it.
First armed prototype: style-check -- the prose analogue of a linter (compares
draft register against the corpus; the writer writes for meaning, the checker
checks for style). Equipment follows persona per editor.md: insiders get
repertoire, outsiders stay blind. Corpus is Psychometrika-only for now: a style
guide, not a venue-alignment claim; the journal metadata field makes multi-venue
a data problem, not a redesign.

## 2026-09-08: JEM joins the corpus; per-journal adapters; R2 preservation

Second journal (JEM, Wiley) validated the adapter pattern: jem-list (Crossref,
because Cloudflare walls Wiley), jem-fetch (headless Chromium passes the
challenge; capture the raw document body, never the MathJax-mutated DOM -- lazy
mjx rendering empties assistive MathML and the live DOM loses TeX), jem2md
(Wiley schema). Equations: 2022+ carry application/x-tex annotations verbatim;
2020-21 are PNG-only and get @@EQIMG placeholders for a later img2latex pass
(asset URLs are Cloudflare-walled too, so the download goes through the browser
session). Complex tables become caption+asset refs, never raw HTML (single-line
100K-char chunks broke the chunker cap). Raw corpus preserved in R2 buckets
repertoire-html / repertoire-md; sync-r2.ts is checkpointed and resumable.

## 2026-09-16: repertoire expansion fetch round (phases 0-1)

Outcome of the audit (2026-09-14) plus the expansion plan
(repertoire-rebuild-expansion.md, D1-D10). Durable state and recipes documented
in docs/repertoire-fetch.md; this entry records the decisions made executing it.

- Family set grew to six: BJMSP 1965+ joined the four planned expansions
  mid-round (owner). All five journal families complete end-to-end (fetch -> R2
  raw/ -> D1 papers+sources -> spot-verify); arxiv stat set on the 7-host fleet,
  one fetcher per host, wave-based centralization.
- Content additions beyond the plan: full-text HTML backfill for every Wiley
  paper lacking JATS XML (era + per-paper gaps; the plan's D2 source-form
  doctrine extended to html-as-raw). EPUB skipped (derivative). JSTOR
  permanently parked (SAGE covers JEBS). PsyArXiv .docx primaries (699) skipped
  pending an owner format-contract call.
- arXiv doctrine held: fetch EVERYTHING with metadata intact (cats primary-first
  from OAI), filter later, never at fetch time. Withheld-source 403s fall back
  to PDF (via:pdf-fallback in the manifest). Observed mix ~91% tex.
- Storage decisions: raw/<doi_id>.<fmt> flat (D6) confirmed at scale (~132k
  arxiv objects, ~160GB projected; R2 limits are nowhere near binding). D1
  gotcha: 100KB statement cap means 50-row insert batches; a 1,000-row batch
  fails SQLITE_TOOBIG with an easily-missed error. Old D1 rows get an explicit
  reset on refetch (state, parse_source, local_path, sha256) so stale parse
  pointers cannot mask fresh bytes.
- Transport (D7): per-object npx wrangler spawns (~2 obj/s) replaced by the
  Cloudflare REST API with the existing CF_API_TOKEN (probe-verified R2
  read/write; no new credentials needed).
- Code/state split enforced: durable fetchers in repertoire/src/families/
  (copied from run dirs; originals stay as run state in .cache/bulk/), ML/pilot
  artifacts moved to repertoire/legacy/, run-tail scripts deleted. Phase 0
  closed.
- Fetcher armor lessons now convention: AbortController inside in-page fetches
  (silent-wedge fix), block-page detection -> clean stop, year-aware validator
  floors, structural (not size) validation, profile-per-family with
  clone-to-parallelize, absolute bun paths in nohup'd gates, and no pkill -f on
  family prefixes (bulk/psy once killed bulk/psyarxiv).
- Open (owner): md/ prefix for derived markdown + lean-html demoted to
  local-only + arxiv uploads both tex and pdf
  (docs/repertoire-layout-2026-09-15.md); PsyArXiv docx format question.

- Owner layout decisions (2026-09-16, final): derived md under md/ prefix;
  pipeline intermediates local-only (revises D6's keep-in-bucket); arxiv one
  artifact per item (no second-format pass); psyarxiv .docx primaries join the
  format contract (sources check extended, live table rebuilt pre-arxiv-apply);
  local copy mandatory (raw-new/ is the canonical flat mirror, manifests
  verbatim-valid forever). Next design pass: whole-storage layout discussion
  (owner-flagged).

## 2026-09-16: docs reorganization; VitePress manual (owner decision)

- Corpus docs concentrate under `docs/repertoire/` as the manual: index (spec),
  fetch, parse, storage, hostfleet, plus dated decision records (audit,
  rebuild-decisions). Manual standard (owner): explains
  what/how/options-compared so anyone can rebuild from zero.
- Manual vs memo split (owner): ephemeral logistics state is NOT docs; working
  memos live on local disk at `repertoire/.cache/notes/` (first residents: the
  expansion plan, the fetch spike note).
- Served as a local VitePress site (`bun run docs:dev`; never deployed):
  `docs/.vitepress/config.ts`. `markdown.html: false` because the docs are
  GFM-only with bare `<family>`/`<doi_id>` tokens in prose that the Vue compiler
  would parse as HTML.

## 2026-09-17: harness migrated to OpenCode v2 (supersedes 2026-09-05 shelving)

The lab now runs on OpenCode v2 (`@opencode/cli`, exact pin in
`lab/runtime.json`) instead of the pi SDK. What changed the calculus since the
shelved spike: daily-driver satisfaction with the v2 TUI, native subagents with
continuation, robust background execution, and builtin plugins/MCP/skills --
most of what this harness handmade in pi now ships upstream. The durable 2.0.5
implementation findings are salvaged below.

Shape of the new harness:

- One central per-host server (`abstract` lifecycle, port 4319, own
  config/state/DB under `~/.local/share/abstract` + `~/.local/state/abstract`);
  credentials synced from the daily install's DB on every launch (fresh DBs
  baseline migrations without running them, so auth.json never imports; the sync
  is one sqlite copy).
- Five persistent role sessions per project (`metadata.role`, created once by
  `abstract`); one attached TUI with a tab per session (`--server`, no tmux).
- Cues are pure HTTP: plugin tool --> `session.synthetic` with
  `delivery: "steer"`; SQLite is the record. The fs inbox is gone.
- Prompts: kernel (old invariants + delegation) lives in `lab/AGENTS.md`; the
  plugin's `session.hook("context")` appends each role's movements from
  `src/score.ts`, re-reading `movement/` from disk per request.
- Subagents: native `task` tool; catalog ported to `lab/agents/*.md` with
  per-file model pins (tiers dissolved); reviewer panels are named per-lineage
  agents (`reviewer-zai|deepseek|kimi|minimax`).
- Default model is MiniMax-M3 (test posture; cheap). `abstract doctor` is the
  contract test over every surface the lab stands on; upgrades go through it.

2.0.5 findings (salvaged from the retired MIGRATION.md):

- Plugin API is `Plugin.define({id, setup})` with domain transforms; tools
  register via `ctx.tool.transform((tools) => tools.add({...}))` (zod input
  accepted), score assembly via `ctx.session.hook("context", ...)`.
- `codemode` matters: a tool without `options: {codemode: false}` is reachable
  only through the codemode wrapper, and a direct model call fails. Both lab
  tools set it.
- Config uses `{env:VAR}` substitution (not `${VAR}`); `skills` is an array of
  paths; agents come from `{agent,agents}/**/*.md`, plugins from
  `{plugin,plugins}/`, and `<configdir>/AGENTS.md` auto-loads.
- Fresh-boot discovery is async: agent/skill/plugin lists race a just-started
  server, so `abstract` polls until the role agents surface.
- Query serialization: `parentID: null` serializes as the string "null" (omit
  it); list filters are flat keys, but `location` params are bracket-encoded.
- TUI attach is `opencode <dir> --server <url> --session <id>`; the tab bar is
  route-driven persisted state at `<state>/<channel>/tui/tabs.json`, keyed by
  the TUI's cwd, which `abstract` seeds with the role tabs.
- Server auth is `OPENCODE_PASSWORD` (HTTP basic); credentials live in the DB
  and are synced from the daily install on every launch.
- Models at migration time: `minimax-cn-coding-plan/MiniMax-M3` (default),
  `zai-coding-plan/glm-5.3`, `deepseek/deepseek-v4-pro`, `kimi-for-coding/k3`.

Retired: `extensions/` (cue, subagents, mcp, repertoire-port), `SYSTEM.md`,
`settings.json`, `subagents/`, `tools.json`, pi symlinks. Git history is the
rollback. Sessions did not migrate: files are memory, sessions were cache.

## 2026-09-17: cues steer as synthetic messages (supersedes never-steer)

The pi-era doctrine "cues are always follow-ups; agents never steer each other"
rested on a misreading of steer vs queue carried out of pi. The need was never
ordering; it was timely delivery: roles drift when new information reaches them
late, and queue waits out the recipient's whole current turn. The cue tool now
sends `session.synthetic` with `delivery: "steer"`. Steer injects at the
recipient's next step boundary: the current tool call or generation segment
completes, then the cue joins the ongoing turn and the model adjusts mid-run. No
work is aborted (abort is the separate interrupt path). An idle recipient wakes
at once. Verified live on 2.0.5: a steer sent mid-turn landed between the
recipient's parallel read batch and its next text segment, same turn, and the
model acted on it.

Synthetic rather than `session.prompt` fixes a second problem the transcript
made visible: peer cues were forging user messages, indistinguishable from the
principal. The protocol's message types are a closed union (user, synthetic,
system, skill, shell, assistant; no custom or role-named types are possible),
and synthetic is the designated type for injected non-user input. The transcript
now records `type: "synthetic"` with description `cue from <role>` and metadata
`{from, to}`; the `[cue from <role>]` text prefix stays as the model-facing
identity marker, since description and metadata are transcript fields the model
does not read.

`abstract doctor` pins the contract: the cue bus check asserts the delivered cue
appears as a synthetic message.

## 2026-09-18: statistician joins the roster (sixth role)

A methodologist role, hybrid by design: consulted for analysis design (turning
unknown unknowns into known unknowns) and executing model-development tickets.
Implementation stays with the engineer, cut by the audience rule: code whose
audience is the math (checks) is the statistician's in `model/`; code whose
audience is the story (findings, citable numbers) is the engineer's in
`experiments/`, including the scale-up simulation the statistician designs.

- **`model/`**: one directory per model, `model/NN-name/`, the experiments
  pattern transposed: `main.typ` grows in place (model, assumptions,
  derivations, estimator, evaluation plan, status); `checks/` and `figures/`
  beside it. In-place evolution, no version numbers; a superseded model gets a
  status line; Typst source is the artifact, PDFs are build products.
- **Check discipline**: a major claim is not done until a check runs in seconds
  on the project `.venv`, names its claim and pass criterion, and has been seen
  to fail (kill test: corrupt the math, watch it go red, restore). Cheapest
  killing check first: special-case reduction --> SymPy symbolic --> derivative
  cross-examination --> score at truth --> parameter recovery --> asymptotic
  probes. A check that outgrows seconds is an experiment and moves to the
  engineer. numpy/scipy plus SymPy now, autodiff on first need; Python via `uv`.
- **Home**: `config/agents/statistician.md`, doctrine in the agent body (the
  OpenCode-native system prompt). No score entry, no `prompts/` file. The five
  existing roles stay on the score untouched this round.
- **Wiring**: the kernel roster routes consultation; no workflow is mandated,
  roster plus cue makes the collaboration. `notes/reports/` becomes the one
  shared artifact type (engineer and statistician, one numbering sequence, each
  owns their own files). `notes/results.md` stays engineer-owned,
  orchestrator-arbitrated; the statistician cues citable numbers in. No new
  subagents.
- **Watch**: a statistician read of methods sections before externalization,
  adopted only if a wrong-math-in-draft failure appears (Open Questions).
- **Pin**: kimi-for-coding/k3, green, matching the engineer's executing hybrid;
  the first real model-development ticket settles it.

## 2026-09-19: expertise roster; memos shared; editor is the fresh eye

The q-matrix R&R audit surfaced the cost of the 2026-09-05 curator shape: two
days of orchestrator briefings (rulings, dispositions, expected end states)
turned the editor into an internal intentional-state registry keeper, while the
blinded reviewer arms were the only true fresh eyes. Inverted.

- **Roster**: "Consulted for" became "Expertise" (who knows what, not a routing
  protocol). The roster offers structure, not choreography; how the roles
  combine expertise is theirs to invent. The editor owns nothing, its expertise
  is a fresh eye on artifacts (bugs, inconsistencies, misalignment with venue,
  audience, style).
- **Editor contract**: reads artifacts cold, a journal editor who knows the
  venue and the field, never the lab. Venue and audience are the whole context.
  If the page alone cannot be followed, that is the finding, never a reason to
  ask for context. The contract lives in the roster cell plus the editor's own
  prompt, nowhere else. Aspects menu: standalone and numbers-as-read replace
  story.md alignment and registry tracing; the editor's own cold read is the
  panel's control arm. Supersedes the 2026-09-05 insider-curator shape from
  issue #27.
- **Memos shared**: `notes/memos/` joins `notes/reports/` as a shared artifact
  type (any role writes `memo-NNN-slug.md` when a cue is too small and a report
  too heavy); librarian and editor memo ownership dropped.
- **Open**: the stale-number-sweep subagent (registry tracing) lost its
  editor-adjacent home; belongs on the writer or orchestrator side. A persistent
  editor session still accretes lab memory across rounds; fresh sessions per
  review round would be the full fix (CLI concern).

## 2026-09-22: the score becomes the binder; the agent body is not the home

The prompt assembler is renamed: `src/score.ts` --> `src/binder.ts`, `SCORE` -->
`BINDERS`. Every player has a binder; a role's binder lists the prompts it
always carries, general --> specific, and two roles share a prompt by listing
the same stem, so the text has exactly one home. The files stay "prompts" in
`prompts/`. Vocabulary now: kernel (native, auto-loaded), binder (assembled per
request), prompt (a `prompts/` file), skill (on demand). The rename was
surgical: `score` in `prompts/statistician.md` (the likelihood score) and the
repertoire similarity score are different words and were left alone.

Why the binder and not the OpenCode-native agent body (supersedes the home
decision in the 2026-09-18 entry; closes issue #38 as not planned): v2 inserts
edits into the conversation without invalidating the cache only for
SystemContext sources (instructions, skill index, references, env/date), which
land as delta messages beside an unchanged baseline. An agent body is `system`,
concatenated into the request prefix (`session/runner/llm.ts`), so editing it
invalidates the prompt cache and takes effect no sooner than the binder does; it
also cannot be shared, since a prompt used by two roles would be copied into two
bodies. The plugin `session.hook("context")` is the documented seam for
assembled system instructions and re-reads `prompts/` per request. Trade
accepted: editing a prompt costs one cache re-prefill for the affected roles.

Two defects fixed alongside the rename. The statistician's doctrine moved from
its agent body into `prompts/statistician.md` with a binder entry, so all six
roles now live in one architecture. And the single-home rule became checked
rather than habitual: `abstract doctor` gained "binder resolves" (every stem has
a file, since the plugin skips a missing prompt silently) and `abstract context`
reports a non-empty agent body as a violation.

## Decisions

- 2026-09-18: first-author QC pinned as committed script; D1
  papers.train_include carries the decision; parse converts everything.
- 2026-09-18: cluster staging pulls from R2 via REST (paced); S3 API upgrade
  stays open.
- 2026-09-18: R2 REST ceiling CORRECTED. The API 429s above the documented 1,200
  requests / 5 min (~4 req/s) account-wide (a 500-request burst at concurrency
  16 is clean, which is why "uncapped" was briefly believed; a 68-task x 4-conn
  fleet collapsed into backoff and crawled). Pacing is now fleet-wide:
  pull-slice one paced connection per task, `qsub -tc` caps concurrent array
  tasks (tex 3, arpdf 2, journal 2500ms). The 163k objects therefore need ~11h
  of pull wall time; S3 credentials + rclone is the only path to faster bulk
  staging and needs a dashboard-minted token.
- 2026-09-18: olmOCR venv is pinned by REPAIRING the bake-off venv (repoint
  pyvenv.cfg and the bin/python symlinks at the current uv CPython). uv
  auto-upgraded its 3.12 base (3.12.13 to 3.12.14), which is what broke the
  venv; a fresh `uv venv`/install loses torch, vllm, and the patched
  pipeline.py. The OCR job carries the full bake-off ops set: cuda/13.2.1
  module + CUDA_HOME, venv nvidia/cu13/lib on LD_LIBRARY_PATH, and an offline
  predownloaded FP8 model.
- 2026-09-18: staging switched to the R2 S3 API (rclone, jurisdiction endpoint)
  once the owner minted keys; measured ~34 objects/s from one client and a
  310-PDF slice in under 45 s, versus the ~4 req/s REST ceiling.
  `pull-slice-rclone.sh` is selected automatically whenever `CF_S3_KEY_ID` is
  present in `.env`; the paced REST puller stays as the fallback. Run knobs
  (`TC_TEX`, `TC_ARPDF`, `S3_TRANSFERS`) live in `.env`.
- 2026-09-18: canonical scripts carry no version suffix; `src/cluster-parse/` is
  the single latest kit (v1/ deleted, `v2/` flattened, `job-*-2.sh` renamed).
  PENDING after the current run's retry sweep finishes: sync the cluster tree to
  the flattened layout and restart the heartbeat looper, whose generated loop
  file still names the old path.
- 2026-09-19: runtime source stays npm (git-tag matching assessed and rejected).
  npm and GitHub tags publish in lockstep and npm's `dev` dist-tag runs ahead of
  tags, so tags buy no currency; a source build would also lose the CI-injected
  version and channel constants that the doctor pin check and the TUI tabs path
  depend on. The 2.0.5 --> 2.0.10 bump surfaced two harness fixes:
  @opencode/client renamed server.status() to server.info() (doctor's health
  probe failed while the server was fine; the SDK ships its own types, so
  typecheck could not catch it), and `abstract upgrade` now installs the new pin
  in-process (the PIN constant was captured at import, so upgrade silently
  deferred the install to the next command).
- 2026-09-20: typ2docx marks changes through two Word mechanisms, chosen by the
  source markup. Typst `highlight` regions become mark divs and spans, rendered
  by pandoc's native handling with the highlight pen (`w:highlight`, yellow
  runs; OMML equations cannot carry it). The manuscript's chg-block and
  chg-inline wrappers (block/box fills) are captured by the reader as
  background-color attributes; `tools/shading.lua` maps them onto the stock
  styles from `04-shading.patch` (ShadingBlock paragraph band, ShadingInline
  character shading, exact names so the writer injects no shadowing
  placeholder), which is Word's own fill-color mechanism and does cover display
  math. A first custom-style attempt failed before the exact-name rule was
  understood: the writer injects a placeholder definition for any custom style
  it cannot find by exact name in the reference stock, and Word resolves the
  duplicate styleId to the empty placeholder. The capture needs the ~/.local/bin
  pandoc build (PRs #11881 and #11884; release 3.11 drops highlighted content
  silently, so keep the symlink ahead of homebrew until the patches land in a
  release).
- 2026-09-21: reference stock series audited and hardened. An exhaustive
  permutation audit (720 orderings) found one hard dependency (the float hunks
  of 03-first-line-indent carry jc="center" context that only exists after
  02-center-figures-tables) and one silent hazard: patch applied with fuzz
  re-anchors a hunk somewhere else and still exits 0, so an exit-code check
  cannot see drift. The series is numbered 01-06 (the audited canonical order),
  the build runs patch with --fuzz=0 and pins the pandoc version (3.11) so drift
  fails loudly, unnumbered patch names are rejected, and --max-patch N bisects
  the series (0 is the pristine export; partial builds write
  reference/reference.debug.docx and never touch the committed stock).
  04-shading anchors on the EOF style close so it is order-independent, drops
  its after-spacing (shaded regions keep the body rhythm), and shading.lua
  hoists a table that ends a shaded region out to the ShadedTable style: left in
  the div, the shading cannot reach the table and the writer leaves the next
  paragraph in BodyText with no margin below it. Styling stays in the stock, not
  in Lua filters: the writer can reference styles but never define them, so
  per-instance formatting through filters would lose inheritance, docDefaults,
  and theme fonts.
- 2026-09-21: typ2docx conversion is stateless; the committed stock is gone.
  Measured cost of a full rebuild (pristine export, six patches, repack) is ~100
  ms warm against ~320 ms for the conversion itself, so the flag and the
  committed reference/reference.docx were removed rather than cached: abstract
  typ2docx rebuilds a fresh stock into a private mktemp dir on every conversion
  and removes it after, making the numbered patch series the single source of
  truth (no dual-source drift, no git timestamp churn). The build script gained
  --out for that, moved its scratch to a per-run mktemp (concurrent conversions
  no longer share work/), and --max-patch stays for bisecting. Built docx
  artifacts are gitignored; the lab-reference alias description no longer
  mentions the stock.
- 2026-09-21: typ2docx filter widened and renamed (shading.lua is typ2docx.lua,
  still paired with 04-shading.patch). Live debugging on the real R&R manuscript
  showed the reported defects shared one root chain: the reader turns comment
  lines, bracket newlines, and unreferenced labels into whitespace-only or
  anchor-only paragraphs; a trailing artifact inside a chg-block defeated the
  table hoist, so the writer left the next paragraph in BodyText at zero margin,
  and the artifacts themselves rendered as blank lines. The filter now drops
  blank paragraphs (Span-empty counts as blank: the labels are letter tooling,
  never cross-referenced), trims regions, and normalizes fills and highlight
  marks onto pandoc's native mark handling, the default text highlight pen (Word
  semantics: the highlighter, not the paint bucket). Two pandoc layers bound
  that choice: block math inside #highlight crashes the reader outright (why
  fills stay the source-side convention for math), and the writer never applies
  the pen to OMML runs (convertMath bypasses the run-property environment), so
  math-bearing paragraphs in marked regions take the pen-yellow ShadingBlock
  band and marked trailing tables take the ShadedTable fill. Spacing model
  revised per owner: BodyText 180/180 (pristine values; only the first-line
  indent differs from pristine) and boundaries (FirstParagraph, TableCaption,
  Figure) before=240; the redundant caption jc=left left the series (captions
  inherit left). A figure wrapping only a table flattens to the table
  (insurance; the reader already flattens them). FigureTable stays undefined in
  the stock on purpose: it is pandoc's borderless layout table for side-by-side
  images, not a data table.
- 2026-09-21: typ2docx drops shading; everything is the pen. The pandoc
  lab-stack build now covers the whole marked surface natively: the reader
  parses multi-paragraph and math-bearing #highlight bodies into mark divs/spans
  (PR #11881), the docx writer pens OMML runs inside marks (PR #11885), and a
  new local writer change labels marked captions inside the mark span so their
  "Table 9:" supplements take the pen too (the raw numbering field carries its
  own w:rPr, since raw XML bypasses the pen). With no run left the pen cannot
  reach, the shading workarounds left: 04-shading.patch and typ2docx-captions.py
  are deleted, the filter no longer bands math paragraphs or tables, and cli.ts
  lost the captions post-pass. Fills still normalize to marks so the
  manuscript's chg-block/chg-inline sources keep converting during the
  transition to #highlight. Caption handling shrinks to the filter's caption_pen
  span, which is now exactly the signal the writer's insertCaptionLabel looks
  for.
- 2026-09-22: Word style lives in the stock, not in the Typst source. Typst
  carries content (pandoc's reader drops presentational directives anyway) plus
  its own PDF styling; the reference stock owns every Word style definition (the
  writer references styles but never defines them); the filter only maps
  semantics. New patches: 07-double-spacing (BodyText double, FirstParagraph
  pinned double since its own w:spacing would shadow the inherited line value,
  Compact pinned single so table cells and tight lists stay tight),
  08-title-14pt-bold (Title/TitleChar 14 pt bold; centered was pristine),
  09-heading-1-body-size-bold, 10-heading-2-body-size-underline (linked Char
  styles mirror their paragraph styles). No filter change was needed for the
  title: the reader routes a #title[...] element to metadata (its BlockHandler
  for "title") and the docx writer emits it with the Title style. A filter-side
  first-paragraph promotion was tried and reverted within the day: with the
  title in metadata, the first real block is the proposal line, which wrongly
  took the Title style.
- 2026-09-22: captions upright and paragraph gaps zeroed. 11-caption-upright
  drops pandoc's italic Caption rPr (Word's built-in Caption is not italic; APA
  italicizes only the title and the "Note." marker, which sources carry as
  emphasis runs regardless). 12-body-paragraph-spacing zeroes BodyText
  before/after (pristine 180/180): double spacing already separates paragraphs
  and the indent marks the break, per APA; boundary blocks (FirstParagraph,
  headings, captions) keep their spacing.
- 2026-09-22: APA pass. Series restructured minimal: 08 is title-bold-centered
  (body size, bold; centered was pristine), 09 is apa-headings (H1 bold
  centered, H2 bold left, H3 bold italic left, all body size; pristine headings
  are NOT bold, verified by rendering, despite Word's built-in defaults), 10
  deleted (the underline was pre-APA), 13 adds the page-number header (a
  header1.xml part with a right-aligned PAGE field; the writer carries headers
  from the stock into the output). 07 now puts double spacing on docDefaults
  with explicit pins where a style's own w:spacing would shadow it (BodyText,
  Title): APA doubles everything, bibliography included. Compact pins single
  spacing (doubled cells inflate tables), headings lose their pristine
  before/after spacing, and FirstParagraph loses its 240 boundary spacing: APA
  adds no gap around headings, and the two stacked into inflated margins. cli.ts
  passes --figure-caption-position=above (APA labels figures above like tables;
  the positions are pandoc writer defaults, not Typst's). Caption shape moved
  into the writer (lab-stack 454b94aa7): the supplement is its own bold
  paragraph, the title paragraph is italicized; a Typst caption separator cannot
  work (the reader drops figure.caption(separator:) and the label exists only at
  write time). Notes stay in the caption block for now (they render above the
  table; distinguishing title from note is deferred per owner). The filter
  starts the references section on a new page with a raw page-break run inside
  the header preceding the refs div. Also fixed on lab-stack (c2daea002): mark
  divs no longer reset the writer's first-paragraph state, so highlighted
  regions stopped taking the FirstParagraph boundary spacing (the reported
  margin regression).
- 2026-09-22: runtime 2.0.10 --> 2.0.14. Reviewed the full commit range (four
  releases, bare tags with no notes) plus tarball-level diffs of
  @opencode/plugin and @opencode/client. Nothing the lab stands on changed;
  everything on our surfaces was additive: the tool execute context gained an
  AbortSignal (cancellation forwarding, #50190), the client types gained an auth
  method field, and the TUI's tabs.enabled setting became tabs.mode with
  in-memory normalization (#50456; the persisted tabs.json that seedTabs writes
  is untouched). The rest is desktop/app/codemode work and models.dev refreshes;
  Console-managed policies (#49729) bind only through remote config, which the
  lab never uses. Doctor passed 12/12 on the new pin, including the live cue bus
  and score assembly round trips.
- 2026-09-23: abstract lint built per the grill plan. edits.yaml lessons are the
  rules, verbatim, one noul per rule keyed by entry id, shared criteria pinning
  true = violates / false = fine or inapplicable; one systemOne call per block
  ({ text, section, role }, pool of 4); scanner is the homegrown provisional
  sketch behind the Block contract (the parser swap stays parked). Baseline on
  manuscript-v0.typ (60 blocks, 46 rules, jev-latest): threshold 0.5 flags every
  block (665 hits, 11.1 per block); inapplicable rules park at p 0.50-0.65
  instead of falling to 0, while precise rules concentrate high (>= 0.75 keeps
  46 hits, and the strongest are exactly the expert's edits: roster lists
  0.83-0.85, implementation constants 0.80-0.83, "promising" 0.79-0.81). Default
  threshold stays 0.5 as planned; the measured spread says the refinement, when
  wanted, is a higher default or per-rule calibration, not neighbor context.
- 2026-09-23: scanner hardened on manuscript-rnr-v1.typ (the R&R generation, a
  different template). #highlight[...] blocks are captured as body blocks (they
  wrap the revised prose; skipping them as code would lint only the old text),
  captures split on blank lines, indented headings inside captures update
  structure instead of leaking as text, label-only lines drop, display math
  closes on "$," (trailing punctuation), fenced raw inside captures is skipped,
  and an H1 named Abstract yields the abstract role so both template generations
  agree. v0 rescans identically (60 blocks). Second baseline, 102 blocks:
  threshold 0.5 flags 101/102 (1001 hits); the strong tier concentrates on real
  patterns (rule 6 on implementation recitations at 0.79-0.85, "highly
  promising" in the Discussion opener at 0.79, metric aliasing at 0.76-0.82),
  while rule 21 (exact counts) fires broadly on exact round simulation
  parameters (5,000 simulees, 80/20), the one clear systematic false-positive
  family so far.
- 2026-09-23: per-rule paradigm tested and dropped. One call per (block, rule)
  pair (1,472 calls) versus one call per block with all 46 rules (32 calls),
  same state, rules, and criteria, on the submit docx. The judgments are
  indistinguishable: across all 323 matched (block, rule) pairs at p >= 0.5, the
  mean probability difference is 0.016, zero pairs differ by 0.10 or more, and
  the p >= 0.75 strong tier is identical pair for pair. This confirms the SDK
  docs' claim that questions in one request are judged independently in
  parallel; isolation buys no precision and costs 46x the requests (roughly 17x
  input tokens, the state resent per call). Wall clock was fine either way (69 s
  for the per-rule run at pool 4). The --per-rule flag was dropped; batching
  stays the only mode. An academic-context framing variant was tried the same
  day and dropped for the same reason (downward recalibration, no sharper
  discrimination).
- 2026-09-23: default threshold 0.5 --> 0.75, rule 1 scoped to introductions.
  Submit-manuscript baseline (32 blocks, 78 rules after the llm-aig batch): 0.5
  flagged all 32 blocks with 581 hits, 74% of them under 0.65, the parked
  inapplicable floor the earlier baselines measured; the 0.75 tier held 45 hits
  from 15 rules and spot checks came back mostly real (subjective praise of
  classifiers 0.86, BERT roster with 67M parameters 0.84 and 0.82, telegraphic
  enumeration 0.79, "Strikingly" 0.79, the abstract's re-drifted "promising
  approach" 0.75 to 0.79). Rule 1 fired section-blind on 28 of 32 blocks;
  qualifying its lesson ("When introducing the research, open at...") cut it to
  one residual hit (0.79, a background paragraph misread as an introduction).
  Rerun at the new default: 46 hits on 20 of 32 blocks. Known residue above
  0.75: rule 67's genre bleed (present tense, a proposal preference, punishing
  journal past-tense methods, 7 hits to 0.80) and the ungated acknowledgment
  block (4 hits). A source re-read then re-sourced rules 9, 10, and 67 to syntax
  and form (comma-bounded inserts, bullet formatting, chained subordinate
  clauses), dissolving the genre and section false-positive families by
  construction; the misplaced "our research" qualifier was tried and reverted (5
  hits on we-voice methods). Entries 2 and 9's twin fell to a shortening edit
  and duplication of the advisor's bullet comment. Keys now 76.
