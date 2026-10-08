# Desk

The desk is the user's persistent review queue: the items the orchestrator has
asked the user to review, confirm, or decide, kept visible until settled. It
answers a concrete failure mode: the orchestrator posts a review request in the
thread, a cue arrives, the thread moves on, and the request is lost to
scrollback, or survives only in the orchestrator's (compactable) memory.

## Architecture

One store, three surfaces. The store is plugin storage on the lab server, keyed
`desk/<projectID>` so per-location scoping is explicit rather than assumed from
plugin instance lifetime. Each item is `{ title, detail }`: the title is one
line, the detail is the note telling the user what to examine.

| Surface      | Where                               | Role                                  |
| ------------ | ----------------------------------- | ------------------------------------- |
| `desk` tool  | `config/plugin/harness.ts`          | the orchestrator rewrites the desk    |
| context part | same file, a `session.context` hook | the orchestrator always sees its desk |
| RPC          | same file, `ctx.rpc.register`       | the TUI reads the desk                |
| sidebar + UI | `config/plugin/desk/tui.tsx`        | the user always sees the desk         |

The RPC contract (`src/desk.ts`, an `Rpc.define`) is shared by both plugin
entries. It lives outside `config/plugin/` because every file directly under
that directory must itself be a loadable plugin; shared code stays in `src/`,
the same pattern as `src/binder.ts`. The `changed` event carries the full desk
so subscribers never refetch.

## Write semantics: whole-list replace

Borrowed from OpenCode V1's `todowrite` (read at v1.18.33): the tool takes the
FULL list and replaces the desk atomically, then echoes the resulting desk as
its output. Raise means including the item, settle means omitting it, clear
means an empty list. No item IDs, no deltas, so the model can never drift from
the stored state, and the transcript always shows the desk's true contents after
each call.

## The cache argument: tail injection, not system

The orchestrator must see its desk on every request (that is what makes it
survive compaction without leaning on memory), but placement matters because
provider prompt caches are prefix-based: reuse ends at the first changed token.
A system part, even pushed last, still precedes every message, so any desk
change there would drop the whole conversation from cache.

The desk note is therefore appended as a synthetic text part at the TAIL of the
last user message, the same pattern as V1's `SessionReminders`:

- On a fresh user turn the note is at the very tail of the prompt, the uncached
  frontier, so a desk change costs nothing.
- During a tool chain the note rides on the turn's initiating user message;
  while the desk is unchanged the bytes are identical and every cache breakpoint
  still hits. A mid-chain settle invalidates from that message onward, which is
  semantically unavoidable (the model must see the change) and happens only on
  real mutations.
- Hook edits affect only the outgoing call, never persisted history, so the note
  is re-rendered from storage on every request and compaction never fossilizes
  stale desk text into a summary.

Only titles enter the context; the detail notes are for the user, and keeping
them out holds the injection small.

## Access control

Enforced in the tool executor, independent of doctrine:

- `context.agent !== "orchestrator"` is rejected (the executor context carries
  the calling agent). Peers cue the orchestrator, which raises the item,
  consistent with the kernel's user-contact rule.
- Forked sessions are rejected (checked via `session.fork`, the same invariant
  cue uses): a reflection fork inherits the orchestrator agent but must never
  rewrite the live user's desk.

The context hook injects for the orchestrator agent only.

## Loading

The desk is always on: the tool, context hook, and RPC are registered by
`abstract-harness` (`config/plugin/harness.ts`), exactly like cue, so there is
no separate plugin to enable or disable for the server side.

`config/plugin/desk/` remains a discovered plugin package (`package.json` with
`.` and `./tui` exports), but the server-side entry is now a no-op. The CLI
fetches the connected server's active plugin list and loads the `./tui`
entrypoint itself, so the sidebar works against the lab server with no
`cli.json` entry and nothing touches the daily install.

The TUI half is read-only by design: the user settles items by replying in the
thread, and the orchestrator rewrites the desk. The sidebar section follows the
builtin MCP section: a bold "Desk" header, one dot row per item (the title wraps
to show the whole thing; click opens the detail dialog), and a fold caret once
the desk holds more than two items, with a muted count when folded. The detail
dialog renders the detail note as Markdown (the `<markdown>` renderable), sits
at the large width (88 columns, a comfortable prose measure, capped by the
terminal) and centers itself vertically
(`ui.dialog.set({ centered: true, size: "large" })` from inside the render
factory, the same spot the host's own dialogs set their presentation, because
every show resets it; anchored a quarter from the top, a long note reads off).
The dialog frame bounds width only, so the note body must bound itself, and an
OpenTUI scrollbox cannot fit its content under a yoga-level cap: any definite
bound in the tree becomes the effective height, so a capped scrollbox always
renders at its cap and a short note floats in a near-fullscreen dialog. The
plugin therefore measures the markdown (`onSizeChange` fires on every layout,
rewrap included) and sets the scrollbox height explicitly: the note's own height
plus its bottom padding row when it fits, the terminal cap (rows minus chrome
and breathing room) when it does not. With the height following the content, the
frame's centered anchoring places short notes mid-screen and long notes with
margin above and below, scrolling when capped (the host-themed scrollbar shows
then). The wheel and the scrollbar scroll natively; the keys ride a modal-mode
keymap layer created inside the dialog component's tree (up/k and down/j one
line, pgup/pgdn one viewport, g/home and shift+g/end the ends), so they die with
the dialog and can never leak into the prompt. The renderable linkifies URLs
already and emits OSC 8 hyperlinks where the terminal supports them; a plain
click opens the link anyway, by resolving `renderer.getLinkAt(x, y)` at the
pointer's cell (mouse events carry screen coordinates) and spawning the platform
opener, skipping clicks that ended a text selection. One subtlety: markdown
styling resolves through `markup.*` scopes in the renderable's `SyntaxStyle`, so
an empty style renders one plain string; the plugin builds the TUI's own markup
rule set from the ambient theme (`packages/theme/tui/syntax.ts` is the
reference). The dialog title is plain: bold and word-wrapped, no syntax styling.
Interactions beyond the rows: `<leader>d` (free among the default leader
bindings), the palette, or `/desk` for a select list then detail. One loader
constraint learned the loud way: `keymap.layer` needs the Keymap provider from
the UI tree, so it registers inside an `app` slot render; calling it at setup
top level fails with "Keymap.Provider is missing".

One location lesson, also learned the loud way. The desk RPC is location-scoped
on the server (plugin storage keys by project), and an RPC call that carries no
location routes to the server's default location, not the viewed project: the
sidebar then boots empty on every reattach, and only looks alive while attached
because the `changed` event (which does carry its location) papers over the
broken initial fetch. Every TUI-side call therefore carries the viewed session's
project directory, and the event handler filters by `event.location.directory`
so another project's desk can never land in this sidebar. The default location
has no desk at all; a desk exists only where a project's orchestrator runs.

## Doctrine

`prompts/orchestrator.md` carries the standing rule: anything that needs the
user's review, confirmation, or decision goes on the desk; raise promptly,
settle promptly; the desk holds only what waits on the user. The tool
description repeats the write semantics so the contract rides with the tool.

## Verification

By hand: verify that the sidebar section appears after a desk raise, that
`<leader>d` opens the detail, that a short note sits snug and vertically
centered, that a long note caps below the terminal height with margin above and
below and scrolls (wheel, scrollbar, up/k, down/j, pgup/pgdn, and g/home plus
shift+g/end reach the note's head and tail), that a click on a URL in the note
opens it in the browser, and that a settle clears the section.

One discovery note, learned the hard way. When the orchestrator first met the
desk it concluded the tool did not exist: it searched the Code Mode catalog
(desk is `codemode: false`, so it is never there, exactly like cue, repertoire,
and tuning), trusted its own belief over the doctrine, and never attempted a
native call. The request's tool surface was never the problem:
`SessionContext.select` rebuilds the snapshot from the live registry on every
step, and two hook-side dumps proved it end to end: `event.tools` in the context
hook carries desk, and the actual provider request body (an `http.request` hook
dump of the 600 KB wire payload) carries `"desk"` too. A compelled native call
executed (the fork got the executor's refusal, not an unknown-tool error). The
provider is plain OpenAI-compatible chat over HTTP, stateless per request, so
there is no server-side pinning either. A model's self-reported function list is
a belief, not introspection: k3 denied desk while it was in the request,
kimi-for-coding called it without fuss, and a compaction "fixed" k3's belief by
rebasing the context, not the tool surface. The doctrine now states explicitly
that desk is a direct function like cue, never in the Code Mode catalog.

## Deferred

- Item timestamps and age display in the sidebar.
- A hard doctor check that the executor rejects a non-orchestrator agent (needs
  a live turn; currently covered by code inspection).
- Desktop notification on raise (`context.attention.notify`), if the sidebar
  alone proves too quiet.
