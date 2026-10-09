# Remote access: attach and the A2A gateway

Who reaches the lab from outside this machine. Two populations, two doors:

1. The owner, working directly: a plain OpenCode attach. Full client, full
   authority, every session and permission surface.
2. The owner's assistant agent, peer grade: an A2A gateway that exposes each
   project's orchestrator as one addressable agent. Messaging, task lifecycle,
   and provenance, nothing more.

Not goals: public internet exposure, unknown third-party agents, a capability
catalog in the card, principal authority over A2A. If any of those arrive,
reopen this document.

Parameters settled in design discussion (2026-10-06): tailnet as the network
ring, one agent card per project, peer-only gateway, degenerate skills.

## Door 1: attach over the tailnet

The lab server already speaks everything this door needs: it binds
127.0.0.1:4657 with HTTP basic auth (`OPENCODE_PASSWORD`, a 48-char hex in
`~/.local/share/abstract/server.pw`, mode 0600). The plan keeps that bind and
fronts the port with Tailscale:

```
tailscale serve --bg 4657
```

That publishes `https://<machine>.<tailnet>.ts.net` with a tailnet certificate,
reachable only inside the tailnet (node ACLs gate who may connect). From any
machine in the tailnet:

```
OPENCODE_PASSWORD=<pw> opencode --server https://<machine>.<tailnet>.ts.net
```

That is the full TUI against the remote lab, the same `--server` attach
`src/cli.ts` uses for the local one; `--session <id>` lands directly on a role
session (the orchestrator for working sessions), `-c` continues the last. For
scripted turns, `opencode run --server <url> "..."` (flags for agent, model,
json output, auto-approve), and `opencode api --server <url> <method path>` is a
curl-grade client over the raw server API. The attaching client gets the same
surface the local TUI has: all sessions in all projects, live streaming,
permission replies (`session.permission.reply`), interrupt.

Why `tailscale serve` rather than binding the server to the tailscale interface:
the server's bind stays a lab-owned constant (loopback, no interface discovery
at boot, no listener that moves when Tailscale reconfigures); serve adds TLS and
tailnet identity for free; and closing the door is `tailscale serve off`,
touching nothing in the lab.

Auth is two rings: tailnet identity decides who reaches the port, the password
decides what they can do once there. The password is still one shared secret,
all or nothing. That is acceptable for a lab of one owner; the door with
per-client policy is Door 2.

Password handling: copy `server.pw` to the client machine once. A convenience
subcommand that prints the attach line (`abstract attach-line`, say) is a later
nicety, not built yet.

Nothing in this door is code, with one caution: ground truth is the pinned
binary, and 2.0.21 has no `attach` subcommand (the opencode.ai docs describe
one, so it is newer than the pin or parked; watch for it at upgrade time and
take the shorter command when it lands). The mechanism today is the `--server`
flag, accepted by every subcommand and used by the harness itself for the local
TUI attach.

## Door 2: the A2A gateway

A second Bun process beside the server, managed by the same `abstract` lifecycle
(`ensureGateway` beside `ensureServer`; `abstract stop` reaps both; pid file
like the server's). Not a plugin: the pinned server binary owns its HTTP
surface, and plugins get tools, commands, context hooks, and TUI RPC, not
routes. Ground truth is the published binary, so the gateway is a sibling client
of the server, exactly like the TUI, speaking `@opencode/client`.

### Why A2A and not an SDK script

The assistant agent could also just be a Door 1 client with a copy of the
password. The gateway exists to avoid exactly that:

- The assistant never holds the master password; it holds its own key, and the
  gateway is the policy layer (routing, size caps, revocation).
- Every remote message arrives with provenance, as a synthetic message, never a
  forged user turn. This is the same fix cues needed when peer traffic was
  indistinguishable from the principal.
- Routing to the orchestrator is enforced by construction: the gateway literally
  cannot address a peer session. This carries the ledger-era principle forward
  (director traffic routes only to the orchestrator), and the older one that MCP
  is our ingestion format, never our publishing format. A2A is the publishing
  door those decisions anticipated.

### The card stays degenerate

The card says who the caller is talking to, not what the lab can do:

```json
{
  "name": "<project name>",
  "description": "Principal investigator of <project>: the orchestrator of a six-role research lab (strategy, tickets, reports, manuscripts).",
  "url": "https://<host>.<tailnet>.ts.net/a2a/<project>",
  "preferredTransport": "JSONRPC",
  "protocolVersion": "<pinned>",
  "capabilities": { "streaming": true, "pushNotifications": false },
  "securitySchemes": { "labKey": { "description": "Gateway bearer key" } },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {
      "id": "conversation",
      "name": "Conversation",
      "description": "Direct line to the project's orchestrator. State the request in plain language; the orchestrator routes work inside the lab and reports back."
    }
  ]
}
```

Capability discovery is not the card's job. The orchestrator's binder (kernel,
prompts, tools, roster) is the capability surface, and it changes too fast and
too internally for a catalog to track honestly. A caller that wants a menu can
ask for one in conversation. The single generic skill exists only because some
framework clients require at least one; an empty array is the fallback if the
chosen SDK tolerates it.

The card URL is handed to the assistant explicitly. Discovery by URL, not by DNS
convention; inside a tailnet that is natural.

### Delivery and authority

Peer-only, by construction and by delivery choice:

- Every A2A message lands as `session.synthetic` with `delivery: "queue"` on the
  project's orchestrator session, text prefixed `[a2a from <client>]`,
  description and metadata `{from, to}` mirroring cue's provenance pattern.
- `queue`, not `steer`: each task is its own follow-up turn, and the server
  inbox (`session.inbox.*`) holds a message that arrives mid-turn, so tasks
  never merge into one another's turns. `steer` stays cue's mid-turn channel.
  A2A's abort story is `CancelTask`, which maps to `session.interrupt`, a real
  abort rather than a merge.
- The orchestrator sees the caller as a peer, never the principal. A relayed
  request ("the user says X") is not the user's direct order under the kernel's
  amendment rule; anything needing the user's decision goes on the desk. The
  principal works through Door 1, where their typing is a genuine user turn.
  Authority never crosses Door 2.

### Mapping

| A2A concept                                                | Lab mechanism                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| card                                                       | one per project, degenerate (above)                                                                                                                                                                              |
| client auth                                                | gateway keys (`a2a.keys` beside `server.pw`, name + hex, 0600); the card advertises the bearer scheme; the gateway translates to the single server password internally, so `server.pw` never crosses the tailnet |
| contextId                                                  | the project's orchestrator session, persistent; context continuity is the session, which survives both endpoints                                                                                                 |
| SendMessage                                                | synthetic, delivery queue, on the orchestrator session                                                                                                                                                           |
| working / terminal                                         | `session.execution.started` / `.succeeded` / `.failed`, filtered by session id; the turn's last assistant message becomes the task's reply                                                                       |
| artifacts                                                  | files written during the task window, from `session.diff`, as FileParts, capped in count and size; oversize or overflow referenced by path                                                                       |
| CancelTask                                                 | `session.interrupt`                                                                                                                                                                                              |
| message/stream                                             | SSE; `session.text.delta` and status events mapped to status updates and part deltas                                                                                                                             |
| pushNotifications, gRPC and REST bindings, card signatures | off, non-goals for now                                                                                                                                                                                           |

The desk is deliberately absent from the table for now. A turn that ends with
desk items pending gets them recited in the task's final status message (the
assistant relays them to the user); mapping desk items to the `input-required`
state properly needs a desk-readable surface on the server side, since plugin
storage has no public read endpoint. Deferred, listed below.

### Task store

In memory only. Files are memory; a task object is an envelope. If the gateway
restarts mid-task, the work is not lost (it is the session turn plus whatever
landed in `notes/`), only the handle. Acceptable for a single assistant-agent
caller. Task ids are UUIDs.

### Message flow

1. Assistant fetches the card with its bearer key.
2. `message/send` with text parts; the gateway validates key and enforces the
   cue-grade size cap (32 KB of text; anything larger travels as a file saved
   under `<project>/.a2a/inbound/` and referenced by path in the synthetic
   text).
3. Synthetic queued on the orchestrator session; task `submitted`.
4. `session.execution.started` fires; task `working`; deltas stream if the
   client asked for it.
5. `session.execution.succeeded`; task `completed`; reply is the turn's last
   assistant message; artifacts from `session.diff`.
6. `GetTask` returns task and bounded history; `CancelTask` interrupts.

### Layout and lifecycle

- `src/a2a/card.ts` (card per project; the project roster comes from the server
  itself, `session.list` grouped by directory with an orchestrator role; unknown
  projects 404, so the gateway invents no state)
- `src/a2a/server.ts` (`Bun.serve`; routing, JSON-RPC dispatch, SSE)
- `src/a2a/translate.ts` (A2A objects to and from client SDK calls)
- `src/a2a/keys.ts` (key file; the door exists iff keys exist: no keys, no
  listener, so Door 2 is opt-in by minting one)
- CLI: `abstract a2a key <name>` mints and prints; `abstract` ensures the
  gateway during launch when keys exist; `abstract stop` reaps it
- Port 4658 beside 4657, loopback, fronted by a second `tailscale serve` rule
  (or a `/a2a/` path rule on the same host)

### Verification

A contract-test client exercises card fetch, `message/send`, streaming, cancel,
and artifact retrieval against a scratch project (never a live one). Hand-rolled
JSON-RPC on Bun keeps the runtime dependency-free; the official a2a-js SDK joins
as a dev-only interop check, the same way the house treats rented mechanics:
outside the runtime, inside the test.

### Phases

1. Card, keys, `message/send` (synthetic queue), wait, terminal states, reply
   text. No streaming, no artifacts.
2. SSE streaming, artifacts from `session.diff`, `CancelTask`, `GetTask`
   history.
3. Deferred until wanted: desk as `input-required`, FilePart inbound, push
   notifications, REST and gRPC bindings, card signatures.

### Open questions

- Queue waits out the orchestrator's current turn. A time-sensitive relay ("the
  user says stop") may deserve a steer-flavored send later; it would be an
  explicit metadata flag, never the default.
- Desk readability from the gateway (above).
- Several assistants at once: inbox FIFO serializes their tasks; probably fine,
  untested.
