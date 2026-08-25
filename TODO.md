# TODO — Design Rationale and Roadmap

This file records *why* the harness is designed the way it is, so the
reasoning survives compaction and session boundaries. Read it before changing
the architecture. Status markers: ✅ done / 🔵 next / ⚪ deferred.

## Goal

An agentic harness for academic research: a small team of long-running agents
with persistent, per-role context, whose interactions and context management
we can iteratively fine-tune. Niche: academic research (not coding).

## Core Principles (and why)

1. **Files are memory; sessions are attention.**
   "Long-running agent" = a persistent session file (pi JSONL), not a
   long-running process. Durable understanding must live in `notes/`
   artifacts (tickets, reports, memos, literature.md, story.md); session
   context is a lossy cache that *will* be compacted. Anything that matters
   gets written down before the turn ends.

2. **Consultations are tool calls; artifacts are files.**
   A consultation reply is ephemeral (returns into the asker's context);
   anything with lasting value must additionally land in `notes/` (memo,
   ticket "Because", literature.md). This keeps contexts clean and the record
   complete, and preserves the manifesto's Corollary A (visibility) — all
   coordination is human-readable.

3. **Three tiers of knowledge.**
   - *Kernel* (`AGENTS.md`, always loaded, survives compaction): invariants
     only — layout, naming, stack, roster. Membership test: "if forgotten,
     would the failure be silent and costly?"
   - *Index* (skill descriptions in the system prompt): trigger-style, one
     line each — tells agents a skill exists and when to read it.
   - *Modules* (skills, on-demand): procedures and templates, written to be
     self-contained and re-enterable cold after compaction.
   The pre-restructure failure mode (agent placing files wrong after
   compaction) happened because tier-1 knowledge lived in tier-3 files.

4. **Roles are responsibility boundaries, not knowledge boundaries.**
   (From the skill bundle's delegation note.) Split a role only when context
   pressure demands it, not for taxonomy. Per-artifact ownership prevents
   races when sessions run concurrently: orchestrator owns story.md +
   tickets, engineer owns experiments/ + reports, librarian owns
   literature.md + memos.

5. **Only the orchestrator fans out.**
   Hub-and-spoke assignment of work; peer *consultation* is allowed
   (engineer ↔ librarian) but must produce a memo artifact.

## The Team

- **Orchestrator** — strategy, story.md, tickets, user contact. Was
  `supervisor.md`.
- **Engineer** — executes tickets, owns experiments + reports. Was `phd.md`.
- **Librarian** — literature expertise; *consultant* (query → memo), not a
  pipeline stage. New.
- **Narrator — ⚪ deferred.** Owning "the story" was rejected: the story *is*
  the strategy, so it stays with the orchestrator (an orchestrator that must
  ask another agent what the story is has drifted). If narrative work
  (manuscripts, presentations, proposals — the `draft/` world) overloads the
  orchestrator's context, split out a narrator as owner of *outward-facing
  artifacts*, including taste/conventions of academic publishing — not as
  keeper of the story.

## Interaction Protocol

Rhythm: **converge → compile → execute → synthesize**.

- Tickets are **co-designed**: orchestrator consults librarian (background)
  and engineer (feasibility) before finalizing; a few rounds are normal.
  During drafting, redraft freely; after delegation, changes are amendments.
- Consultations must **converge**: finalize, or escalate to the user with a
  decision. Cap rounds; unbounded dialogue is a token sink.
- Consultations on independent aspects (background vs. feasibility) may fan
  out in parallel — the one place parallelism buys pure latency.
- Parallel *workstreams* are not a near-term concern; the core loop is a
  dependency chain. Intra-role map-reduce (librarian triaging papers,
  section-by-section review) is fine via fire-and-forget subagents.

## Why a Harness (SDK), Not Just Config

The consult primitive — one session programmatically prompting another
persistent session and getting a reply — requires in-process session control.
Only the pi SDK provides it. CLI-level alternatives are simulations: headless
`pi -p` subprocess calls (process spawn per consult, session-file locking) or
RPC plumbing. Hence the phased plan:

1. ✅ **Restructure repo as pi agent directory** (this layout). Roles, kernel,
   skills are harness *inputs* regardless of how the harness is built.
2. 🔵 **Extension-harness**: a pi extension that imports the SDK, holds
   persistent `AgentSession`s for engineer + librarian (session files under
   the project's `.pi/sessions/`), and registers `consult_engineer` /
   `consult_librarian` tools on the interactive (orchestrator) session.
   Session files per role per project; the user talks to the orchestrator in
   the normal pi TUI. Iterate on the *protocol* here.
3. ⚪ **Standalone binary** (SDK `createAgentSession` + custom
   `ResourceLoader` loading this repo): when the interaction model stabilizes
   and we need our own UI/command surface or long-running orchestration.
   Compile via `bun build --compile`.

Until the harness exists, the `bin/` launchers + file-mediated consult relay
(human or headless `pi -p`) are the prototype.

## Open Questions / Deferred Ideas

- **Convention enforcement by code**: a pi extension hooking `tool_call` to
  warn/block writes that violate layout conventions (manifesto Corollary B:
  express as code what can be expressed as code). Deletes a whole class of
  silent post-compaction failures.
- **Role-scoped skills**: `bin/` launchers could pass `--no-skills --skill …`
  per role if all-skills-visible proves distracting. Start simple.
- **Role-aware compaction**: custom `session_before_compact` instructions per
  role (preserve role-relevant context verbatim).
- **Session-file locking** if headless consults ever touch a session that is
  open interactively.
- **nlpatch agent**: currently a prompt; becomes an SDK sub-session or tool.
- **Parallel workstreams**: multiple in-flight tickets with per-artifact
  ownership; revisit after the single-workstream protocol is solid.

## Canonical Decisions Log

- `notes/story.md` is the story location (per the later logistics refinement;
  older docs said project root — consolidated in the restructure).
- Experiment dirs: `experiments/NN-name/` (not `exp-NNN-`).
- Numbering: `NNN` (three digits) for tickets, reports, memos.
- Repo doubles as `$PI_CODING_AGENT_DIR`; state files are gitignored, never
  committed.
- `AGENTS.md` briefs agents *developing this repo* only. Lab invariants live
  in `motif.md` (package naming follows a musical theme) and are injected
  into the system prompt by the `bin/` launchers.
- Lab agents run with `--no-context-files`: no ambient AGENTS.md/CLAUDE.md,
  neither this repo's dev briefing nor the research project's own. The SDK
  harness must set the equivalent (`noContextFiles: true` in loader options).
