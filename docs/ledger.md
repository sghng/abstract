# The Lab Ledger

Design spec and migration roadmap for the lab ledger: the semantic event layer.
Dev-facing. Status: accepted, Phase 1 not yet implemented. Tracking: issue #35.

## Context

The lab runs unsupervised for long stretches; the director interfaces through
the orchestrator and briefings, not through transcripts. Visibility therefore
cannot depend on reading session logs. Session JSONL already captures all
traffic verbatim; what it cannot capture is _meaning_ (this write was a ticket
close; this bash was a failed search). The ledger is the semantic annotation on
traffic we already have.

Decisions this design encodes (TODO.md decisions log):

- **Own semantics, rent mechanics.** The ledger is semantics; it is ours.
- **Kernel/skin split.** The ledger schema is domain-neutral; nothing academic
  appears in it.
- **Reproducibility principle.** The director addresses the lab through the
  orchestrator; corrections flow through the audit loop (complaints, findings,
  prompt diffs), never through direct intervention in a peer's session.
- **Ticket = unit of dispatched intent.** Granularity matches the director's
  bandwidth; spans bracket execution; artifact transitions are in-span events.
- **Portability at the code level, not the protocol level.** The ledger core is
  a runtime-agnostic TypeScript module. Lab agents get it as native pi extension
  tools; everyone else (the director, OpenClaw, scripts) gets it as `abstract`
  CLI subcommands. MCP is our ingestion format for third-party tools (see
  `extensions/mcp`), never our publishing format; if a future consumer ever
  requires the protocol, an MCP facade over the core is an afternoon of work and
  remains an option.
- **Event sourcing.** The ledger is the state; per-role ticket state is a
  replay, not a file.
- **Fail-closed where cheap.** The tools enforce transition validity and the
  director's routing rule in code, not in prose.

## Architecture

Three surfaces over one core:

- **`src/ledger.ts`** -- the core module. Schema, append, replay, transition
  validation, ticket Status-line writer, complaint queue, cue logging. No pi
  imports; no I/O beyond the event files. This is the portable asset.
- **`extensions/ledger/index.ts`** -- the pi extension. Registers `ticket` and
  `complaint` as native tools for every lab role (self-configures from
  `HARNESS_ROLE`, no-op otherwise), delegating to the core. The existing cue
  extension keeps its `cue` tool and gains one call into the core to log each
  send.
- **`abstract` CLI subcommands** -- `abstract ticket`, `abstract cue`,
  `abstract complaint`, `abstract complaints`. Same core, for external callers:
  the director's shell, OpenClaw (which needs only an executable entry point),
  scripts, and tests. `--as <role>` sets the caller; `director` is valid here
  and only here.

No server, no daemon, no config. Cue _delivery_ to pi sessions stays with the
cue extension's filesystem watcher, untouched.

### File layout (all under `<project>/.pi/`)

| File                    | Writer                           | Content                             |
| ----------------------- | -------------------------------- | ----------------------------------- |
| `ledger.jsonl`          | core                             | All span events: ticket + cue       |
| `complaints.jsonl`      | core                             | Complaint queue (open/acked)        |
| `harness/inbox/<role>/` | core (send), cue extension (ack) | Cue envelopes in flight (unchanged) |
| `subagents.jsonl`       | subagents extension              | Spawn telemetry (unchanged)         |
| `sessions/<role>.jsonl` | pi                               | Raw traces (unchanged)              |

Note: `harness/inbox/` prunes processed envelopes after 100, so inboxes are
transport, not history. `ledger.jsonl` is the durable message record.

### Event schema (v1)

One JSON object per line. Common envelope:

```json
{ "v": 1, "ts": "2026-09-05T14:32:07.104Z", "role": "writer", "kind": "ticket" }
```

`ts` is ISO 8601 UTC (matches `subagents.jsonl`). Kinds:

```json
{ "kind": "ticket", "ticket": "042", "action": "enter|park|done|reopen|note",
  "note": "bumped proposal v2 -> v3", "preempted": "038" }
{ "kind": "cue", "id": "a1b2c3", "to": "editor", "preview": "first 160 chars" }
```

- `preempted`: set on an auto-park event emitted when `enter` arrives while
  another ticket is active.
- Cue events carry a `preview`, not the full message; the envelope in the
  target's inbox holds the full text, correlated by `id` and timestamp.

Complaints live in `complaints.jsonl`:

```json
{
  "v": 1,
  "ts": "...",
  "role": "librarian",
  "id": "9f3e21",
  "summary": "one line",
  "detail": "optional",
  "status": "open"
}
```

Size estimate: ~5 roles x ~50 events/day x ~200 B = ~50 KB/day, ~18 MB/yr. JSONL
holds for years; if auditing ever outgrows it, the `v` field and append-only
shape migrate cleanly to SQLite/D1. Not before.

## Tool semantics

Inside pi sessions the caller is `HARNESS_ROLE`; on the CLI the caller is `--as`
(validated against the roster plus `director`).

### `ticket(action, ticket, note?)`

Actions: `enter`, `park`, `done`, `reopen`, `note`.

- State is derived by replaying `ledger.jsonl`: each role has at most one active
  ticket. There is no state file.
- `enter`: the ticket file `notes/tickets/ticket-<NNN>-*.md` must exist (exactly
  one glob match). If the role has an active ticket, it is auto-parked first (a
  `park` event with `preempted` pointing at the new ticket -- the housekeeper
  reads this as a possible finding).
- `park`, `done`: require the ticket to be the role's active one.
- `reopen`: requires the ticket's last transition to be `done` (by any role).
  Sets it active for the caller. Reopen frequency per ticket is a first-class
  metric (premature doneness).
- `note`: requires the ticket to be the role's active one; records an in-span
  event (artifact transitions, version bumps, amendments).
- **Status line**: the core is the sole writer of a `Status: wip|parked|done`
  line in the ticket file, inserted directly under the H1 (created if absent,
  replaced if present). Doctrine forbids hand-editing it; the housekeeper can
  detect drift by comparing the line against ledger-replayed state.
- Invalid transitions return an error stating the current state and the valid
  actions. Errors teach; they never corrupt the log.

### `cue(target, message)`

- Extension path: the cue extension's existing tool, plus a core call that
  appends a `cue` event to `ledger.jsonl`. CLI path:
  `abstract cue --as <role> --to <target> -m <message>`.
- **Director routing is enforced in the core**: when the caller is `director`,
  `target` must be `orchestrator`. The director's only wire into the lab is the
  orchestrator, in code.
- Envelope write is unchanged (atomic tmp+rename, 32 KB cap, "put it in a file
  and cue the path" discipline). Cues to `director` land in
  `harness/inbox/director/`; see Director Channel.

### `complaint(summary, detail?)`

- Appends to `complaints.jsonl` with `status: "open"` and a short id.
- Returns a confirmation that names the audience: the complaint landed with the
  director, not with any peer. (This phrasing is deliberate; it teaches the
  channel.)
- Doctrine delineation: system problems (prompt ambiguity, missing docs, broken
  tools, contradictory doctrine) are complaints; task problems cue the
  orchestrator. Complaint abuse is itself a finding.
- Acks: `abstract complaints` lists open complaints;
  `abstract complaints ack <id>` sets `status: "acked"` (Phase 3; until then the
  file is append-only and the director reads it directly).

## Director channel

`director` is a virtual peer: a valid cue source/target and the complaint
audience, with no pi session.

- **Inbound**: `abstract cue --as director --to orchestrator -m "..."`. OpenClaw
  runs exactly this; voice/chat becomes text at the OpenClaw layer. The
  orchestrator's existing watcher delivers it.
- **Outbound**: the orchestrator cues `director`; envelopes accumulate in
  `harness/inbox/director/`. Until the OpenClaw relay exists (Phase 4),
  `abstract` prints pending director mail on launch and the directory can be
  tailed.
- **Briefings**: doctrine in `orchestrator.md` (Phase 3): on a director cue
  containing "briefing" (and later on a schedule), produce a ~150-word briefing
  assembled from the ledger: open tickets and their spans, activity since last
  briefing, open complaints, detector flags. The health window of the earlier
  design demotes into this; the ledger was always the briefing's data source.

## pi-side migration

- New `extensions/ledger/index.ts`: registers `ticket` and `complaint` for all
  roles.
- `extensions/cue/index.ts`: one added line -- after `sendCue`, call the core's
  cue logger. Everything else untouched; no registration changes, no collision
  hazard.
- `src/cli.ts`: subcommand routing for `ticket`, `cue`, `complaint`,
  `complaints` (and `complaints ack`).
- `extensions/subagents/`: unchanged. Subagents are born blind; their telemetry
  stays in `subagents.jsonl`, joined to spans by timestamp at audit time.

## Doctrine changes (Phase 1, one or two lines each)

- `invariants.md`: ticket work is bracketed by `ticket` calls (enter; park/done;
  reopen resumes); system problems are complaints, task problems are cues; the
  roster gains a `director` row marked "virtual" (addressed through the
  orchestrator); the Status line in a ticket is tool-written, never hand-edited.
- `orchestrator.md`: briefing duty (Phase 3 adds the cadence and format).
- `skills/logistics/SKILL.md`: ticket template gains the `Status:` line under
  the H1, marked tool-managed; lifecycle (wip/parked/done, reopen) documented.
- `AGENTS.md`: layout gains the core module and extension; decisions logged in
  `TODO.md`.

## Consumers (later phases; not Phase 1 scope)

- `abstract dump --ticket NNN` (#13 revision): intersect the ticket's spans (all
  of them, across reopens) with session JSONL, cue events, and `subagents.jsonl`
  by role + timestamp.
- Detectors + `abstract health`: flailing metrics (failed-search bursts,
  write-then-move, long spans with no activity, reopen rate) computed from
  sessions + ledger.
- Housekeeper (#16): unbracketed ticket mentions in traces, Status-line drift,
  complaint velocity, ticket volume vs. director bandwidth.
- Auditor subagent: weekly sweep brief = ledger + detector exhibits + complaint
  log.
- OpenClaw integration: exec the CLI (`abstract cue --as director ...`), poll
  `inbox/director/` for outbound.

## Testing (Phase 1)

- Unit (bun test) against the core in a temp project dir: replay and transition
  validation; Status-line writer (insert, replace, idempotent); schema shape;
  director routing enforcement.
- Integration: CLI end-to-end in a temp dir -- enter, note, park, enter-other
  (auto-preempt), done, reopen; cue routing into the right inbox; complaint
  append and list/ack.
- Live smoke: restart one role (librarian) after deploy; bracket a real ticket;
  inspect `ledger.jsonl`.
- Watch items: glob ambiguity when two files match `ticket-NNN-*`; cue logging
  must never break cue sending (log failure is swallowed, send stands).

## Roadmap

Each phase is independently useful and independently revertible (additive files;
the only edit to an existing tool is one logging line).

- **Phase 1 -- the ledger** (issue #35): core module, extension, CLI
  subcommands, cue logging, doctrine lines, tests, TODO log. Existing sessions
  pick the tools up on next ensemble restart.
- **Phase 2 -- observation** (1-2 weeks): run the lab normally. Watch bracket
  adoption and complaint quality manually. Calibrate before building
  enforcement.
- **Phase 3 -- director channel**: `abstract complaints` (list/ack),
  director-mail printout on launch, briefing doctrine in orchestrator.md, manual
  briefings on director cue.
- **Phase 4 -- OpenClaw**: outbound push, inbound voice/chat, scheduled briefing
  cadence.
- **Phase 5 -- audit consumers**: `dump --ticket` (#13), detectors, housekeeper
  checks (#16), auditor sweep. These issues are revised to consume the ledger
  rather than raw traces alone.

## Deferred questions

- An MCP facade over the core (only if a future consumer requires the protocol;
  the architecture deliberately does not).
- Whether cue ledger events should ever carry full text (v1: preview only; inbox
  envelope + session traces hold the rest).
- Complaint ack via OpenClaw reply (Phase 4 concern).
