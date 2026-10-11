# The lab

How the lab actually runs, condensed from the dated decision entries. This
page holds the final states; the full argument arcs live in git history.

## Shape

One central per-host OpenCode server (`abstract` lifecycle, port 4657, own
config/state/DB under `~/.local/share/abstract` and `~/.local/state/abstract`,
credentials synced from the daily install's DB on every launch; loopback bind
with HTTP basic auth via `OPENCODE_PASSWORD`). Six persistent role sessions
per project (`metadata.role`, created once by `abstract`), one attached TUI
with a tab per session. No tmux; the sessions are server state, and files are
memory while sessions are a cache.

Doctrine flows kernel (`config/AGENTS.md`, native discovery) --> binder
(`prompts/binder.yaml` re-read per request, assembled by the harness plugin's
context hook) --> skills on demand. Model pins live in agent-file frontmatter
([models](/models)). Remote access design (tailnet attach, A2A gateway) is
[remote access](/remote-access); the desk is [desk](/desk).

## Cues

`cue` is a plugin tool that delivers `session.synthetic` with
`delivery: "steer"`. Steer injects at the recipient's next step boundary
(mid-turn, no abort; an idle recipient wakes at once) and solved two
problems at once: timely delivery (queue waits out the recipient's whole
turn) and provenance (peer cues were forging user messages; synthetic is
the designated type for injected non-user input, with `[cue from <role>]`
as the model-facing marker plus `{from, to}` metadata).

Cue refuses forked sessions and excludes forks from target lookup. A role
session is a top-level session with no fork lineage (a fork inherits
`metadata.role` verbatim and can shadow the original in lookups), so this
is an invariant, not a convenience.

## Roster history in one paragraph

Three pi-era roles (orchestrator, engineer, librarian) grew the writer plus
the reviewer (2026-09-05, issue #27), the statistician as the sixth role
(2026-09-18; `model/` is the statistician's, `experiments/` the engineer's,
cut by the audience rule: code for the math vs code for the story), and the
reviewer was re-shaped into the editor (2026-09-19) after the q-matrix audit
showed the curator shape had turned the editor into an intentional-state
registry keeper while the blinded reviewer arms were the only fresh eyes.
The editor owns nothing and reads cold; panels of model-family-x-familiarity
reviewer subagents do the fresh-eyed reading.

## Reflection

`/reflect` in the orchestrator session is the owner's direct order made
semi-automatic: snapshot doctrine, fork each non-orchestrator role for
independent reflection, diff, fork the orchestrator for a curation pass
that recommends but never amends on another role's behalf, report, steer
the live orchestrator, and the owner ratifies the diff. Forks (not
children) carry the context-faithful transcript on the same cache prefix.
Design doc: [reflection](/reflection).

## Desk

The user's persistent review queue: desk tool (orchestrator-only rewrite,
V1 todowrite style), context part, sidebar widget via plugin RPC. Cache
decided the injection point: the desk note rides at the tail of the last
user message, re-rendered from storage per request, never persisted.
Read-only for the user on purpose. Design doc: [desk](/desk).

## Hindsight memory

Long-term memory runs through `@vectorize-io/hindsight-coding-agents`,
pinned exact, loaded by v2's plugin discovery via the gitignored
`config/plugin/hindsight` symlink (recreated per machine after `bun
install`). `config/hindsight.json` pins the memory server URL and the
lab-wide bank id `research`. `HINDSIGHT_CONFIG` is injected by
`serverEnv()` and goes live only after a stop/relaunch. One caution on
record: a server spawned from the harness directory let hindsight ingest
the whole harness repo into the bank, since the server cwd anchors its
git-log ingestion; the server always spawns with cwd at the abstract home.

## Upgrades and runtime pins

Deliberate: bump the `@opencode/*` deps in `package.json`, review the
commit range plus tarball `.d.ts` diffs, then `abstract stop` and relaunch;
keep the bump only when the lab comes up and serves turns. `abstract
doctor` was retired (2026-10-06): it had grown into a minutes-long run and
daily use is the better test. The one guard worth keeping moved into
`loadBinders` (strict stem resolution, last-good cache, loud error piece),
which fires per model request instead of per doctor run.

Pin history: 2.0.5 (v2 migration) --> 2.0.10 --> 2.0.14 --> 2.0.15 -->
2.0.18 --> 2.0.20 --> 2.0.21 --> 2.0.24 (current). Every bump in between
was reviewed against the range and kept only after the lab served turns.
Worth remembering across bumps: the plugin session domain, session-create
options, and TUI dialog capabilities are where upstream changes land on
lab surfaces; MCP error self-description and transient retries quieted the
context7/zotero flakiness at 2.0.24.

Open upstream watches: `#51960` system-baseline order (recheck the
perceived piece order on the next bump); an `attach` subcommand (shorter
than `--server`; watch for it and adopt); TUI dialog search and footer
actions (the desk could adopt).

