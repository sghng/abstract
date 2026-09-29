# Prompt Hierarchy

How the lab's prompts are layered, and the rules for where a line of prompt text
lives. Think of it as onboarding employees. `abstract context [role]` prints
every role's actual assembly; keep it honest.

## The Layers

The system prompt is reassembled on every model request, so it survives
compaction by construction; what compaction takes is message history. Order per
request: the OpenCode base prompt, then the native instruction baseline
(environment and date, the kernel, the skills index, and MCP guidance), then the
hook-assembled binder pieces (layers 2 and 3, each headed
`Instructions from: <path>`, then the binder footer), then tool schemas. The
layer numbers below are conceptual tiers, not the on-the-wire order: the skills
index rides the native baseline, ahead of the binder.

1. **The kernel (`config/AGENTS.md`, auto-loaded).** The shared rules, for every
   session: the six roles and every subagent alike. Membership test: forgetting
   a rule would be silent and costly. It is the only AGENTS.md the lab loads:
   the server runs with project config disabled
   (`OPENCODE_DISABLE_PROJECT_CONFIG` in `src/cli.ts`), so no project AGENTS.md
   or `.opencode/` can leak foreign doctrine, agents, or plugins into lab
   sessions. OpenCode watches the file natively: an edit broadcasts a diff to
   every live session at its next step boundary, and the text is re-baselined
   fresh at each compaction.

2. **Shared prompts (the all-hands meeting).** Doctrine two roles must reason
   about together earns a file listed in both binders: `style-guide` (writer +
   editor; a standard with one holder is not a standard), `story-doctrine`
   (orchestrator maintains the story, writer instantiates it).

3. **Role prompts (the one-on-one).** One role's always-on doctrine, craft,
   workflow. Single-function roles (writer, engineer, librarian) inline what
   they always need; a probabilistic gate on content with a near-certain
   invocation rate is pure overhead and pure risk.

4. **The skills index (the reference shelf).** Episodic, task-matched
   procedures: one line of description per skill, always present; the body is
   read on demand. Uncertainty is acceptable here because invocation is
   genuinely occasional.

5. **Subagent prompts (`config/agents/subagents/*.md`).** Born blind,
   self-contained: kernel plus their own prompt, no role prompts, no cue. The
   directory prefix becomes part of the agent ID (`subagents/style-check`), so
   every prose reference uses the full ID. Named agents cover recurring task
   shapes; model pins live in their frontmatter.

Layers 2 and 3 are each role's binder. `prompts/binder.yaml` is the single
source for which prompts a role carries, in order (general --> specific); do not
duplicate the mapping anywhere. The harness re-reads it (and the prompt files)
from disk on every request, so binder surgery goes live on the next turn;
`src/binder.ts` holds the machinery (`loadBinders`, `binderFooter`) and the
roster (`ROLES`). Agent files (`config/agents/<role>.md`) hold registry config
only, and the binder is why: the body is the agent's `system`, which rides in
the cached request prefix (`session/runner/llm.ts`), so editing a body
invalidates the prompt cache, the registry does not reload without a server
restart in the pinned binary (owner-tested on 2.0.18), and a prompt shared by
two roles would have to live in two bodies. `abstract context` reports a
non-empty body as a violation, and `abstract doctor` checks that every binder
stem resolves, because a missing prompt is skipped silently.

## The Rules

- **Always-on membership test** (the binder): a line is always-on iff it is
  needed in most turns of the role, or forgetting it is silent and costly.
- **The test is role-relative.** The same content can be a prompt file for one
  role and a skill (or nothing) for another. Doctrine graduates into exactly the
  scores that always need it; a single-role skill with near-certain invocation
  graduates wholesale (engineering, authoring precedents), and the skill is then
  deleted, not kept as a husk.
- **Ownership places doctrine.** A line of doctrine lives with the role that
  owns the artifact the doctrine governs: story keeping in `story-keeping`
  (orchestrator, owner of `notes/story.md`), writing craft in `writing-craft`
  (writer, owner of `draft/`). When two roles must reason about the same
  doctrine, it becomes a shared prompt. Consumers of an artifact read the
  artifact; roles that shape it share the doctrine.
- **Duplication rule.** Never repeat a statement within one agent's context.
  Repetition across different agents' contexts is acceptable and sometimes
  intended (the style guide shared by writer and editor; the editor's checklist
  restating the writer's detail at recognition grain). When the same fact serves
  two roles, give each the grain it needs: generative detail for the producer,
  checkable items for the judge.
- **Asymmetric detail protects independence.** The editor gets a checklist, not
  the writer's full rationale; an editor inside the writer's frame shares the
  writer's blind spots.
- **Context is equipment.** A role that holds a capability will use it:
  over-presenting invites the role to exercise itself what it should have
  delegated, and the lab's performance degrades quietly. Load only what the role
  itself should exercise; everything else reaches it through a peer cue or a
  subagent brief. The tool surface follows the same rule (a corpus style tool
  belongs to the writing roles; a reference manager to the librarian), as does
  MCP scoping. The current corpus deliberately leaves plugin tools and MCP
  servers ungated while the lab runs; scope by observation, not anticipation.
- **Compaction mechanics.** Always-on text is never compacted away: the kernel
  rides a per-epoch instruction baseline that each compaction re-renders fresh
  (a mid-epoch kernel edit meanwhile arrives as an in-band "The instructions
  from X changed" system message), and the binder is re-read from disk on each
  request. A skill body read into message history compacts away. A "read skill
  X" pointer therefore survives compaction, but the knowledge it pointed at does
  not; hence the re-read-after-compaction lines and the next rule.
- **Pointer discipline.** Role prompts may point to the reference directory or
  skills for episodic procedures ("read logistics.md when creating reports").
  Never put always-on doctrine behind a pointer: a two-hop dependency fails
  silently when the hop is skipped.
- **No dashes as punctuation.** Not in prompts, not in skills, not in the
  kernel: the `--` pattern in context shifts generation toward the same pattern
  in deliverables, and deliverable prose bans dashes outright (with colons and
  semicolons). CLI flags and markdown table separators are syntax and stay.

## Self-amendment

A role may amend its own prompt files and its own binder. The kernel states the
rule once: amend only on the user's direct order, and show the proposed text
before editing. Amend covers editing a prompt file, creating a piece (a new
`prompts/<stem>.md`, kebab-case and descriptive, plus the stem in the role's own
`prompts/binder.yaml` entry), pulling an existing stem into the role's entry,
and removing a piece; deleting a prompt _file_ is sole-carrier only, everything
shared is curator work. The reference directory's files (logistics, templates)
are amendable by any role under the same rule. Scope is named concretely by the
binder footer, the last context piece the hook pushes; `binderFooter()` in
`src/binder.ts` assembles it from the freshly read mapping, so it can never
drift, and shared prompts name their co-carriers there, so a proposer sees whose
context an edit will land in. The orchestrator is the doctrine's curator: its
scope is every prompt file, every mapping entry, and the kernel itself, under
the same rule. Enforcement is the stated rule plus git history, nothing else:
the harness pre-approves role read/write on `prompts/` and `reference/` (both
outside every project directory) via an agent-permission transform at server
start, so not even a permission prompt gates an edit. Subagents keep the default
`external_directory: ask`.

The mapping is data, not code, because the static import was evaluated once at
plugin load: a binder edit would have needed a server restart. The reader is
strict (every role present, known roles only, string stems), because agents
hand-edit the file, and a malformed mapping serves the last good parse plus a
loud error piece in every role's context, self-clearing on fix.

Two placement consequences, settled against pinned 2.0.18:

- **The kernel stays a native AGENTS.md** rather than joining the hook assembly.
  Its loading path contains no lab code, so a plugin failure cannot strip the
  invariants; the watcher broadcasts every kernel edit to live sessions as a
  diff; subagents inherit it for free (born blind: kernel plus own prompt). The
  one channel the lab does not use is per-session instruction entries
  (`api/<key>` over HTTP, keyed `^[a-z0-9][a-z0-9._-]*$`, frozen into the epoch
  baseline with native change narration): surveyed and available for per-session
  dynamic state that has no file home.
- **The binder stays in the hook** because it is the only per-role channel the
  binary offers: user plugins cannot touch instruction discovery, and discovery
  is directory-scoped anyway. Edits land silently on the next request (no native
  diff announcement for hook pieces); a hash-and-announce mechanism is deferred
  until a missed amendment actually hurts.
