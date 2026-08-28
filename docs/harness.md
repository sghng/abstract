# Harness Implementation Plan

Concrete build plan for the cue-based message exchange specified in
`docs/multi-agent.md`. Read that first; this doc is the how, that doc is the
why.

> **Current mode (temporary):** the state-tracked cue machine described below
> (`awaiting`/`debts`, one-inbound-cue-at-a-time, reminders, status line) is
> disabled while we test fire-and-forget delivery with human oversight. The
> implementation in `extensions/cue/index.ts` delivers every cue as a follow-up
> and leaves turn management to the agents. The state machine code is
> preserved in a `DISABLED_STATE_MACHINE` block and in git history for easy
> re-enable. See `TODO.md` decisions log.

## Architecture

- **Three vanilla pi SDK processes**, one per role, spawned by the
  `abstract` CLI (`src/cli.ts`, internal `abstract __run <role>`).
  Direct live control of every session is a permanent requirement; nothing
  here changes that.
- **Brokerless.** No daemon, no server. The directory tree under
  `<project>/.pi/harness/` IS the broker: sending is a file write, receiving
  is a directory watch, the ledger is derivable from what sits in the
  inboxes.
- **One pi extension**, `extensions/cue/`, loaded automatically from the
  agent dir into every lab session, self-configuring from the `HARNESS_ROLE`
  env var set by the launcher.
- **`abstract`** (the CLI): opens all three roles in one tmux window
  (session `abs-<project-basename>`; pi has native tmux integration, see
  pi's `docs/tmux.md`).

## File layout

```
<project>/.pi/harness/
  inbox/<role>/<ts>-<from>-<id>.json   # pending cues; filename = FIFO order
  inbox/<role>/processed/              # acked cues; pruned to last ~100
  state/<role>.json                    # per-role ledger (restart survival)
```

Cue envelope (`{ts}-{from}-{id}.json`):

```json
{ "v": 1, "from": "orchestrator", "to": "librarian",
  "message": "prior art on X?", "ts": 1739999999999 }
```

State file (`state/<role>.json`):

```json
{ "awaiting": { "librarian": 1 },
  "debts": [ { "from": "orchestrator", "ts": 1739999999999,
               "preview": "ticket-01 drafted, review..." } ] }
```

**Ownership rules** (no locks needed anywhere):

- An extension only ever *writes* into other roles' `inbox/` dirs
  (atomic tmp-file + rename) and its *own* `state/<role>.json`.
- Inboxes are append-only shared surfaces; state files are single-writer.

## The extension (`extensions/cue/index.ts`)

Two files, split for testability:

- `core.ts` -- pure fs operations (sendCue, scanInbox, ackCue, loadState,
  saveState); unit-tested with bun test against tmp dirs
- `index.ts` -- pi wiring: role config from HARNESS_ROLE, the cue tool,
  the delivery loop (fs.watch + turn_end/agent_settled scans), bookkeeping,
  before_agent_start reminder line, ctx.ui.setStatus footer, shutdown
  cleanup

### Send path (inside the `cue` tool's `execute`)

1. Write `{ts}-{role}-{id}.json` into `inbox/<target>/` (tmp + rename).
2. Increment `awaiting[target]` in own state file.
3. If `debts` contains an entry with `from === target`: remove it (this call
   resolves it) and release the next queued inbound cue if `debts` is now
   empty.
4. Return a short tool result: `cued <target>; awaiting their cue`.

### Delivery loop

Trigger points (belt and suspenders):

- `fs.watch` on own inbox dir (wake-up hint; can miss events).
- `turn_end` / `agent_settled` handlers re-scan (cannot miss).
- `session_start` initial scan.

Delivery rule: inject only when `debts` is empty (**one inbound cue at a
time**; remaining files wait). Injection:

```ts
pi.sendMessage(
  { customType: "cue", display: true,
    content: `[cue from ${from}] ${message}`, details: envelope },
  { triggerTurn: true, deliverAs: "followUp" }   // never steer
);
```

Then: move the file to `processed/`, append `{from, ts, preview}` to
`debts`, save state. A delivered-but-unresolved debt survives restarts via
the state file and is re-announced by the reminder line.

### Reminders (the "bottom line")

`before_agent_start` handler appends to `event.systemPrompt` (transient per
turn, zero transcript spam, survives compaction by construction):

```
## Cues
awaiting: librarian (1)
unanswered: orchestrator -- "ticket-01 drafted, review..." (42m)
```

Only emitted when non-empty. (Position note: system-prompt placement rather
than literal bottom-of-context; revisit if agents demonstrably lose track.)

### Status line (user-facing observability)

`ctx.ui.setStatus("cue", ...)` on every state change and boundary scan,
and only when there is cue activity (cleared to `undefined` when idle):

```
awaiting: librarian | unanswered: orchestrator | queued for engineer:1
```

Role identity is not carried here: each launcher passes `--name <role>`,
so pi's builtin footer shows the role on the cwd line (`~/proj • librarian`)
natively, in the terminal title, and in the session list. Lab-wide cue state
is a read-only peek at all inbox dirs. v1 has no presence detection: a cue
sent to a closed session simply waits on disk (durable queue), and the
pending count tells the user to open that terminal. Offline detection may be
added later via heartbeats if the ambiguity annoys.

## `bin/` changes

(Superseded: the `abstract` CLI now owns everything in this section. Kept
for the rationale.)

- Each launcher gains `HARNESS_ROLE=<role>` in its `env` line and
  `--name <role>` so pi's builtin footer labels the session.
- `bin/lab`: tmux layout -- new session, three panes running
  `bin/orchestrator`, `bin/engineer`, `bin/librarian` in the current
  project directory. Re-running attaches when the session already has three
  panes; otherwise it recreates. No tmux pane titles: role identity lives in
  each pi footer's cwd line via `--name`.
- **Auth gotcha**: `PI_CODING_AGENT_DIR` relocates everything pi reads,
  including `auth.json` and `models.json`. The launchers therefore symlink
  `~/.pi/agent/auth.json` (and `models.json` if present) into the repo root
  (both gitignored). Without the symlink, pi sees zero models ("Model not
  found") because the registry is auth-driven.

## Edge cases

- **Duplicate delivery** after a crash between inject and ack: file still in
  inbox, gets re-injected on next scan; harmless (cues are advisory).
- **Stale `processed/` files**: prune to last 100 on each ack.
- **Message size**: cap at 32KB (OMO's bound); larger content belongs in
  files, with the cue carrying the path.
- **User interludes**: debts persist through user-driven turns; the reminder
  line keeps them salient; nothing special to do.
- **Self-cue / unknown role**: rejected by the tool schema.

## Testing

- **Unit**: the fs core against tmp dirs (ordering, atomic rename, ack,
  pruning, state round-trip). Bun test.
- **Integration**: RPC mode loads extensions too -- spawn two
  `pi --mode rpc` processes with the extension, drive cues via RPC
  `prompt`, assert delivery/resolution via the inbox dirs and
  `get_messages`. This is our automated end-to-end path.
- **Dogfood checklist**: three tmux panes; orchestrator <-> librarian
  consult; engineer ticket flow with mid-task librarian cue; user steering
  interlude while a debt is open; kill a role mid-await and restart it.

## Build order

1. **M1 -- fs core + unit tests** (no pi involved).
2. **M2 -- extension wiring**: cue tool + delivery loop + resolution, one
   role pair (orchestrator <-> librarian) dogfooded manually.
3. **M3 -- reminders + status line**; engineer joins; full triangle.
4. **M4 -- `bin/lab` tmux + dogfood checklist + doc sync.**

## Deliberately not built (yet)

Presence/heartbeats, steer delivery between agents, passports/status fields,
harness-managed to-do lists, message encryption/authz (same-user localhost
trust), socket broker, RPC-driven headless ensemble (phase 3).

## TUI mode: fullscreen (pinned editor/footer)

pi's default `tuiMode` is `"regular"` (main screen, terminal-owned
scrollback): the input editor and footer flow with the content, so on a fresh
session in a tall pane they sit right after the startup header with blank rows
below. The lab wants the standard chat-TUI layout, so `settings.json` sets
`tuiMode: "fullscreen"`: the transcript scrolls in-viewport while the editor
and footer stay fixed at the bottom, and they re-anchor correctly on resize.
(Fullscreen is still marked experimental upstream.)
