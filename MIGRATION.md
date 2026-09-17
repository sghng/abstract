# MIGRATION -- Pi to OpenCode v2

Status: IMPLEMENTED 2026-09-17. `abstract doctor` passes all 13 checks
against pin 2.0.5 (config, agents, skills, MCP, credentials, plugin, live
model round trip, cue bus end to end). Remaining before deleting this file:
one real-work session on the current research project (step 6) and any tuning
it surfaces. The decision is recorded in TODO.md (supersedes 2026-09-05).

Ground truth is the published binary (`@opencode/cli`, currently 2.0.5), not
the `../opencode` checkout, which lags it. This bit us once: the checkout's
dev branch showed a v1-shaped plugin API (`experimental.chat.system.transform`)
that does not exist at 2.0.5; the published API is `Plugin.define` with domain
transforms and `session.hook("context")`.

## Implementation findings (2.0.5 specifics, beyond the plan)

- **Plugin API**: `Plugin.define({id, setup})` from `@opencode/plugin`;
  tools register via `ctx.tool.transform((tools) => tools.add({...}))` with
  zod inputs (Standard Schema accepted); score assembly is
  `ctx.session.hook("context", (e) => e.system.push({type:"text", text}))`.
- **`codemode` matters**: tools without `options: {codemode: false}` are only
  reachable through the codemode `execute` wrapper; a direct model call fails
  with "No tool named X is currently available". Both lab tools set it.
- **Credentials live in the DB**, and a fresh DB baselines migrations without
  running them, so legacy auth.json never imports. `abstract` copies
  credential rows from the daily DB (`~/.local/share/opencode/opencode.db`)
  into the lab DB on every launch; daily stays canonical.
- **Server auth**: set `OPENCODE_PASSWORD` on the server; clients send HTTP
  basic (`opencode:<pw>`) or pass `OPENCODE_PASSWORD` env (TUI, `opencode api`).
- **TUI attach**: `opencode <dir> --server <url> --session <id>`; sessions for
  the directory render as tabs.
- **The tab bar is route-driven persisted state**, not a directory listing: a
  tab appears when a client navigates to a session, and tabs persist under
  `<state>/<channel>/tui/tabs.json` keyed by the TUI's process cwd. `abstract`
  seeds that file with the five role tabs (merged, never overwritten) and
  launches the TUI with the project dir as cwd. The TUI process also gets the
  lab `XDG_STATE_HOME` so its local state never touches the daily install.
- **Query serialization gotchas**: `parentID: null` serializes as the literal
  string "null" (omit instead); list filters like `directory` are flat keys,
  but `location`-style params go bracket-encoded (`location[directory]`).
- **Config**: `{env:VAR}` (not `${VAR}`) substitution; `skills` is an array of
  paths; agents discovered from `{agent,agents}/**/*.md` under the config dir;
  plugins from `{plugin,plugins}/`; `<configdir>/AGENTS.md` auto-loads.
- **Fresh-boot discovery is async**: agent/skill/plugin lists race a just-started
  server; `abstract` polls until the role agents surface.
- **Models**: `minimax-cn-coding-plan/MiniMax-M3` (default, test posture),
  `zai-coding-plan/glm-5.3`, `deepseek/deepseek-v4-pro`, `kimi-for-coding/k3`.
- Queued prompts (`delivery: "queue"`) auto-start processing in inactive
  sessions: fire-and-forget cues wake the recipient without any view attached.


## Target Architecture

- **Runtime**: `@opencode/cli` at an exact pinned version. Lab-owned install at
  `~/.local/share/abstract/runtime/` (`bun add @opencode/cli@<pin>`); `abstract`
  spawns server and TUI from there. The user's global install and the lab never
  touch. Upgrades are deliberate (see Upgrade Ritual).
- **Server**: one central per-host "Abstract" server (`opencode serve`,
  detached, fixed port owned by abstract -- not 4096, which the daily daemon
  scans). Server-process env, set by `abstract`:
  - `OPENCODE_CONFIG_DIR=<harness>/lab` (all lab config; see Lab Config Root)
  - `OPENCODE_DISABLE_PROJECT_CONFIG=1` (the `noContextFiles` doctrine: no
    ambient project AGENTS.md or config in lab sessions)
  - `XDG_STATE_HOME=~/.local/state/abstract` (registration, password, state --
    never collides with the daily daemon)
  - `OPENCODE_DB=~/.local/share/abstract/lab.db` (central sessions store;
    per-project isolation deliberately forgone: sessions are a lossy cache, not
    project memory -- durable knowledge lives in `notes/`)
  - `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=1` (fire-and-forget fan-out)
  - `HARNESS_DIR=<harness>` (keeps `$HARNESS_DIR/reference/` pointers in the
    kernel valid)
  - Credentials are shared with the daily install by NOT overriding the data
    dir (spike 4 confirms where auth resolves under a config-dir override).
- **Project footprint**: none. No `.opencode/` in research projects, ever. If
  file state is ever needed project-side, mint `.abstract/` -- entirely ours,
  upstream never reads it, collision-free by construction.
- **Roles**: five persistent sessions per project (orchestrator, engineer,
  librarian, writer, editor), created once by `abstract` with
  `metadata.role` and the project directory, rediscovered via `session.list`
  on every launch. Personas are `lab/agent/<role>.md` (`mode: primary`). Role
  identity comes from the session's agent and metadata; `HARNESS_ROLE` dies.
- **Cues**: plugin tool `cue(target, message)` resolves the target session
  (same project directory, `metadata.role` match) and sends
  `promptAsync("[cue from <role>] ...", delivery: "queue")`. Queue delivery =
  the never-steer doctrine (lands at the next turn boundary). Fire-and-forget;
  no file inbox; SQLite is the record. Panes/views are disposable; server down
  is the only failure mode and restart resumes from the DB.
- **Score assembly**: `movement/` + `src/score.ts` stay the single source. The
  kernel (invariants + delegation, currently in every score) moves to
  `lab/AGENTS.md` (auto-loaded, survives compaction); the two stems leave the
  score. A plugin hook (`experimental.chat.system.transform`) appends the
  role's remaining movements per turn, reading `movement/*.md` from disk each
  time -- edits go live next turn, `/reload` semantics for free. `SYSTEM.md`
  dies; OpenCode's default system prompt already carries the tool-behavior
  identity it existed to preserve.
- **Subagents**: the native `task` tool replaces `extensions/subagents`
  entirely. The catalog ports to `lab/agent/<name>.md` (`mode: subagent`);
  `tier` + `tiers.json` dissolve into pinned `model` fields. Bespoke briefs
  remain `prompt`-parameter calls. Reviewer panels get named agents per model
  family (the `model:` escape hatch is gone; named equipment is the upgrade).
  Telemetry file dies (SQLite has spawn records). "Born blind" is relaxed:
  children see the kernel and skills; `cue` is permission-denied in subagent
  frontmatter so children cannot address peers.
- **MCP**: `extensions/mcp` dies; `servers.ts` content becomes the `mcp` block
  of `lab/opencode.json`. Name shaping and per-role scoping are deferred
  (permissions make both possible later; not MVP).
- **Repertoire**: ports to a plugin tool (`zod`; minor API change from
  `pi.registerTool`). Per-role gating deferred.
- **Skills**: `skills/` stays at the repo root, referenced from
  `lab/opencode.json` skills paths. Frontmatter is compatible (name +
  description). Near drop-in.
- **UI**: one attached TUI (from the pinned install, `--dir <project>`), native
  session tabs = the five role sessions. No tmux: panes were load-bearing only
  when they were process lifelines; sessions now outlive views, so detach is
  "close the TUI, re-run `abstract`". The `core`/`writing` window split
  dissolves into tab order. Traded away: simultaneous transcripts (canon
  detection) -- mitigated by tab activity indicators if 2.0.5 has them
  (spike 2); pressure valve if it bites: a second tmux pane attaching to one
  more role session, no architecture change.
- **Not migrated**: the ledger (`docs/ledger.md`) stays unbuilt; observability
  later = a hook, SQL over the central DB, or the auditor. The auditor, when
  it comes, is centralized and dev-side (launched manually against the
  Abstract server), never a resident in lab sessions.
- **`abstract` CLI**: shrinks to server lifecycle (spawn pinned binary with
  the env above, health check, port bookkeeping), session bootstrap
  (create-if-missing per role per project), TUI launch, `abstract doctor`
  (contract smoke test), and pin bump/update helpers. `__run <role>` dies
  (panes are attaches, not SDK processes).

## Repo Changes

Stays: `movement/`, `skills/`, `src/score.ts` (kernel stems removed),
`repertoire/` (untouched), `reference/`.

New: `lab/` config root --

```text
lab/
+-- AGENTS.md          # kernel: invariants + delegation (moved from movement/)
+-- agent/             # 5 role personas (primary) + subagent catalog + reviewers
+-- plugin/            # harness plugin: score-assembly hook, cue, repertoire
`-- opencode.json      # model default, mcp servers, skills paths, permissions
```

plus a pin file (`lab/runtime.json`: `{"version": "2.0.5"}` or similar).

Dies: `extensions/` (cue, subagents, mcp; repertoire is ported first),
`SYSTEM.md`, `settings.json` (subsumed by `lab/opencode.json`),
`subagents/tiers.json`, tmux code in `src/cli.ts` (rewritten in place).
`.pi/` directories in projects become read-only archives.

## Upgrade Ritual

1. `npm diff @opencode/cli@<old> @opencode/cli@<new>` + release notes -- human
   pass: new features to adopt (bias: yes), breaking changes.
2. `abstract doctor` -- contract smoke test against the candidate version,
   booted headless. Surfaces under contract:
   - `chat.system.transform` fires and rewrites the system array
   - plugin custom tools register and execute (cue, repertoire)
   - `promptAsync` + `delivery: "queue"` semantics end to end
   - `task` tool, `task_id` continuation, background flag
   - session create with `metadata.role` + list-by-metadata
   - skills/agents/plugin discovery from `OPENCODE_CONFIG_DIR`
   - credentials resolve under the config-dir override
3. Dogfood the candidate in daily use; bump the pin only when doctor passes.

## Spikes (day one, against pinned 2.0.5)

1. How the 2.0.5 TUI targets a chosen server (attach to the Abstract server
   instead of its auto-daemon).
2. Tab strip: per-session activity indicators? subagent children tab behavior?
3. `delivery: "queue"` end to end (admission, ordering, no mid-turn steer).
4. Auth/credential file resolution under `OPENCODE_CONFIG_DIR` override
   (fallback: the pi symlink trick into `lab/`).
5. `metadata.role` create + filtered `session.list` as the role-pinning
   mechanism.
6. `experimental.chat.system.transform` present and shaped as expected on the
   published binary (checkout may lag; trust the binary).
7. Skills discovery via config paths from the config dir (not just
   `<config-dir>/skill`).

## Cutover Order

1. Spikes above (~half a day). DONE (folded into the findings above).
2. `lab/` config root: personas, subagent catalog, reviewers, `opencode.json`,
   kernel `AGENTS.md` (kernel stems leave `score.ts`). DONE.
3. Plugin: score-assembly hook, `cue`, `repertoire`. DONE.
4. CLI rewrite: server, bootstrap, launch, `doctor`. DONE.
5. Prompt content pass: kernel rewritten (named agents replace tiers),
   `editor.md` names the reviewer equipment. DONE.
6. Cutover the current project: run `abstract` in the project directory
   (fresh role sessions, one re-grounding turn each: read `notes/story.md`),
   then real work. No session import: files are memory, sessions were cache.
   OPEN.
7. Retire pi: delete `extensions/`, `SYSTEM.md`, `settings.json`,
   `subagents/`, `tools.json`, pi symlinks; DONE. Record the decision in
   TODO.md; DONE. Delete this file after step 6 lands clean.
