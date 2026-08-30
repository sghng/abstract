# TODO -- Design Rationale and Roadmap

This file records *why* the harness is designed the way it is, so the
reasoning survives compaction and session boundaries. Read it before changing
the architecture. Status markers: [done] / [next] / [deferred].

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
   complete, and preserves the manifesto's Corollary A (visibility) -- all
   coordination is human-readable.

3. **Three tiers of knowledge.**
   - *Kernel* (`AGENTS.md`, always loaded, survives compaction): invariants
     only -- layout, naming, stack, roster. Membership test: "if forgotten,
     would the failure be silent and costly?"
   - *Index* (skill descriptions in the system prompt): trigger-style, one
     line each -- tells agents a skill exists and when to read it.
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
   (engineer <--> librarian) but must produce a memo artifact.

## The Team

- **Orchestrator** -- strategy, story.md, tickets, user contact. Was
  `supervisor.md`.
- **Engineer** -- executes tickets, owns experiments + reports. Was `phd.md`.
- **Librarian** -- literature expertise; *consultant* (query --> memo), not a
  pipeline stage. New.
- **Narrator -- [deferred].** Owning "the story" was rejected: the story *is*
  the strategy, so it stays with the orchestrator (an orchestrator that must
  ask another agent what the story is has drifted). If narrative work
  (manuscripts, presentations, proposals -- the `draft/` world) overloads the
  orchestrator's context, split out a narrator as owner of *outward-facing
  artifacts*, including taste/conventions of academic publishing -- not as
  keeper of the story.

## Interaction Protocol

Rhythm: **converge --> compile --> execute --> synthesize**.

- Tickets are **co-designed**: orchestrator consults librarian (background)
  and engineer (feasibility) before finalizing; a few rounds are normal.
  During drafting, redraft freely; after delegation, changes are amendments.
- Consultations must **converge**: finalize, or escalate to the user with a
  decision. Cap rounds; unbounded dialogue is a token sink.
- Consultations on independent aspects (background vs. feasibility) may fan
  out in parallel -- the one place parallelism buys pure latency.
- Parallel *workstreams* are not a near-term concern; the core loop is a
  dependency chain. Intra-role map-reduce (librarian triaging papers,
  section-by-section review) is fine via fire-and-forget subagents.

## Why a Harness (SDK), Not Just Config

The consult primitive -- one session programmatically prompting another
persistent session and getting a reply -- requires in-process session control.
Only the pi SDK provides it. CLI-level alternatives are simulations: headless
`pi -p` subprocess calls (process spawn per consult, session-file locking) or
RPC plumbing. Hence the phased plan:

1. [done] **Restructure repo as pi agent directory** (this layout). Roles, kernel,
   skills are harness *inputs* regardless of how the harness is built.
2. [done] **SDK harness CLI** (`abstract`, Bun-linked, this repo's `package.json`
   bin): replaces the `bin/` shell scripts entirely (deleted; git history is
   the rollback). Design settled in the decisions log below (see "SDK harness
   v1"). Three peer SDK processes, one per tmux pane, each with its own
   `InteractiveMode`; cues stay file-based. v1 is full parity with `bin/`
   plus the custom `SYSTEM.md` prompt.
3. [deferred] **Standalone binary**: compile the same CLI via
   `bun build --compile` once the interaction model stabilizes and we want
   distribution without a Bun install.

(The earlier phase-2 "extension-harness" idea -- one interactive pi process
holding the other roles' `AgentSession`s in-process -- was considered and
rejected for v1: it breaks the three-pane model and fights the one-terminal-
per-process nature of `InteractiveMode`. File-based cues make it unnecessary.
If in-process consult via `prompt()` ever earns its keep, the cue extension
is the interface that survives either way.)

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
- **nlpatch agent**: currently a prompt; becomes an SDK sub-session or tool.
- **Parallel workstreams**: multiple in-flight tickets with per-artifact
  ownership; revisit after the single-workstream protocol is solid.

## Canonical Decisions Log

- `notes/story.md` is the story location (per the later logistics refinement;
  older docs said project root -- consolidated in the restructure).
- Experiment dirs: `experiments/NN-name/` (not `exp-NNN-`).
- Numbering: `NNN` (three digits) for tickets, reports, memos.
- Repo doubles as `$PI_CODING_AGENT_DIR`; state files are gitignored, never
  committed.
- `AGENTS.md` briefs agents *developing this repo* only. Lab invariants live
  in `motif.md` (package naming follows a musical theme) and are injected
  into the system prompt by the harness (bin/ launchers today, the SDK CLI's
  `appendSystemPrompt` paths once it lands).
- Lab agents run with `--no-context-files`: no ambient AGENTS.md/CLAUDE.md,
  neither this repo's dev briefing nor the research project's own. The SDK
  harness must set the equivalent (`noContextFiles: true` in loader options).
- **Multi-agent model (see `docs/multi-agent.md`)**: one conversation
  stretched across context-isolated sessions; turn-taking, not throughput.
  Three peer pi processes (direct live control of every agent is a permanent
  requirement); cues carried brokerlessly by a per-project file inbox under
  `<project>/.pi/harness/` (no daemon; the directory tree is the bus);
  harness extension self-configures from `HARNESS_ROLE`; `bin/lab` opens all
  three roles in tmux. Implementation plan in `docs/harness.md`.
- **One primitive: `cue(target, message)`**. No ids, no subjects, no answer
  tool; initiating and resolving are the same call. Resolution = the
  receiver's next cue back (FIFO, advisory). No target restrictions: anyone
  can cue anyone; consult conventions live in role prompts, not the
  mechanism. Cues are reminders, not records; durable state lives in
  artifacts.
- **Offline cues are durable, not failed**: a cue to a closed session waits
  on disk and delivers on launch; the status line shows pending counts.
- **Cues are always follow-ups; agents never steer each other.** Humans
  steer natively (Enter = steer, Alt+Enter = follow-up, Esc = abort).
- **Multiple outstanding cues allowed; one inbound cue at a time per agent**
  (FIFO over the inbox dir). Fan-out is allowed, not encouraged.
- **No passports, no harness to-do lists in v1**: watch whether agents
  self-track; add structure only where pain is felt.
- Multi-project layering: agent dir = shared lab config; project cwd =
  sessions, notes, `.pi/` overrides; harness anchors child state at cwd.
- **Resource inheritance policy** for the three-layer model (Pi Agent global
  in `~/.pi/agent/`, Abstract global in `$HARNESS_DIR`, project-local in
  `cwd/.pi/`): `auth.json` and `models.json` are symlinked from
  `~/.pi/agent/` into the harness agent dir; `prompts/` and `themes/` are
  loaded from `~/.pi/agent/` via explicit `--prompt-template` and `--theme`
  paths while the harness keeps its own `prompts/` and `themes/` directories
  as the Abstract global layer; `skills/` and MCP *server definitions* are
  *not* inherited from `~/.pi/agent/` -- the harness uses its own `skills/`
  directory and any project-local `.mcp.json` / `.pi/mcp.json`.
- **MCP via our own extension** (`extensions/mcp/`), replacing
  `npm:pi-mcp-adapter` -- and built "by not building it": not an interface
  for hooking random MCPs, but an internal adapter that registers tools we
  don't implement (the implementation hides behind a server URL). Studied
  pi-mcp-adapter (sync registration from a disk cache) and OpenCode (no
  cache; in-memory defs; down server = absent tools) and took the OpenCode
  branch: **no cache, no config file**. Servers are code (`servers.ts`):
  per-role scoping (`roles`, e.g. zotero is librarian-only) and tool-list
  shaping (`map`, e.g. tavily_* --> web_*) are plain functions. On
  session_start we connect, `listTools`, shape, and register flat names
  through the same `registerTool` path as `cue` (no `mcp__` prefix);
  post-bind registration provably survives vanilla `/reload` (probe3).
  Secrets live only in gitignored `mcp.secrets.json` (flat KEY=VALUE),
  expanded into `${VAR}` placeholders. v1 scope: tools only, stdio +
  streamable-HTTP (SSE fallback), no OAuth; failures are loud (ui.notify)
  and never crash the session. `inspect.ts` dumps the shaped tool surface
  as JSON for curation.
- **Cue extension is fire-and-forget for now**: state tracking
  (`awaiting`/`debts`, one-cue-at-a-time gate, status line, reminders) is
  disabled while we test whether agents can self-manage turn-taking with
  human oversight. `cue(target, message)` simply writes to the target
  inbox and delivers as a follow-up; the old state machine is preserved in
  a `DISABLED_STATE_MACHINE` block in `extensions/cue/index.ts` and in git
  history.
- **Writer + reviewer roles**: the deferred "narrator" outward-facing
  artifact role is implemented as **writer**, with a **reviewer** as the
  writer's devil's-advocate consultant. The orchestrator keeps
  `notes/story.md`; the writer owns `draft/` and writing tickets; the
  reviewer writes memos and does not edit `draft/`. Externalization is
  approved by the orchestrator. The CLI opens a `core` window
  (orchestrator | engineer | librarian) and a `writing` window
  (writer | reviewer), attaching to `core` by default.

### SDK harness v1 (settled; supersedes the bin/ prototype)

- **One Bun CLI, one entry point**: `abstract`, linked via this repo's
  `package.json` bin. The CLI computes the tmux session name, creates or
  reattaches the session, and spawns the three role processes into panes
  itself (internal hidden flag, e.g. `abstract __run <role>` -- not a
  user-facing subcommand). `bin/` and the shell launchers are deleted once
  the CLI lands; git history is the rollback.
- **tmux UX unchanged**: three even horizontal panes
  (orchestrator | engineer | librarian). Session name is
  `abs-<project-dir-basename>` -- no state file, no hash; two projects
  sharing a basename collide (accepted; add an override flag if it ever
  bites). Reattach if the session exists with the right layout; otherwise
  recreate. Detach leaves agents running (panes are children of the tmux
  server, not the CLI); if the tmux server died, panes resume the session
  files. Files are memory; processes are attention.
- **Three peer SDK processes**, one per pane: `createAgentSessionRuntime`
  --> `createAgentSessionServices` (agentDir = this repo,
  `noContextFiles: true`, session pinned per role at
  `.pi/sessions/<role>.jsonl` under the project cwd) -->
  `InteractiveMode.run()`. Full pi TUI per pane, including `/reload`.
  One-process-three-TUIs was investigated: `InteractiveMode` accepts an
  injectable terminal, so it is not a hard restriction, but `ProcessTerminal`
  owns process-global state (raw stdin, signal handlers, alternate screen),
  so three TUIs in one process means reimplementing a terminal multiplexer.
  tmux already is the multiplexer; one process per pane is the natural
  boundary.
- **Custom system prompt via pi's native file discovery**: a `SYSTEM.md` in
  the harness dir replaces pi's default prompt. Content: keep the
  "expert coding assistant" identity (it drives correct tool behavior --
  the agents work by exploring directories programmatically) but drop the
  "inside pi" framing and the entire pi-docs pointer block; keep the four
  tool one-liners (read/bash/edit/write) and pi's three default guidelines
  verbatim ("use bash for file ops", "be concise", "show file paths
  clearly") -- they are tool-behavioral, not pi-specific, and "show file
  paths" matters because artifacts are the lab's memory. Motif and role
  description are NOT baked into SYSTEM.md.
- **Per-role assembly as file paths, not strings**: the CLI passes
  `appendSystemPrompt: [<abs path to motif.md>, <abs path to
  agents/<role>.md>]`. `DefaultResourceLoader.resolvePromptInput` reads a
  source from disk when it is an existing path, and `reload()` re-resolves
  on every `/reload` -- so edits to `SYSTEM.md`, `motif.md`, or
  `agents/<role>.md` take effect on `/reload` with zero custom code. (New
  prompt applies from the next turn; history keeps what it was sent with,
  same as vanilla pi.) This is why we do NOT need a custom `ResourceLoader`
  subclass for v1 -- the vanilla mechanism already gives us the reload
  semantics; revisit only when per-role skills or dynamic assembly become
  concrete.
- **Skills block unchanged**: pi renders the `<available_skills>` listing
  from the harness `skills/` dir exactly as before.
- **Communication unchanged**: brokerless cue file inbox under
  `<project>/.pi/harness/`; the extension self-configures from the role.
  Noted potential: with SDK processes, consult could later move to
  in-process `prompt()`; the cue interface survives either way.
- **v1 scope is full parity**: credential symlinks (auth.json/models.json),
  prompts/themes inheritance paths, `HARNESS_ROLE` (becomes the internal
  pane flag), session pinning, cue extension -- all ported to code in the
  CLI. No staged rollout; half a harness means running two harnesses.
