# Prompt Hierarchy

How the lab's prompts are layered, and the rules for where a line of prompt text
lives. Think of it as onboarding employees. `abstract context [role]` prints
every role's actual assembly; keep it honest.

## The Layers

The system prompt is reassembled on every model request (kernel auto-load,
plugin score assembly, skills index), so it survives compaction by construction;
what compaction takes is message history. Order per request: OpenCode base
prompt, then the layers below, then tool schemas.

1. **The kernel (`config/AGENTS.md`, auto-loaded).** Invariants plus the
   delegation doctrine, for every session: the five roles and every subagent
   alike. Membership test: forgetting it would be silent and costly.

2. **Shared prompts (the all-hands meeting).** Doctrine two roles must reason
   about together earns a file listed in both scores: `prose-standard` (writer +
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

`src/score.ts` is the single source for which prompts a role assembles, in order
(general --> specific); do not duplicate the mapping anywhere.

## The Rules

- **Always-on membership test** (score.ts): a line is always-on iff it is needed
  in most turns of the role, or forgetting it is silent and costly.
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
  intended (the prose standard shared by writer and editor; the editor's
  checklist restating the writer's detail at recognition grain). When the same
  fact serves two roles, give each the grain it needs: generative detail for the
  producer, checkable items for the judge.
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
- **Compaction mechanics.** The system prompt is rebuilt from disk each request
  and is never compacted away; a skill body read into message history is. A
  "read skill X" pointer therefore survives compaction, but the knowledge it
  pointed at does not; hence the re-read-after-compaction lines and the next
  rule.
- **Pointer discipline.** Role prompts may point to skills for episodic
  procedures ("read the logistics skill when creating reports"). Never put
  always-on doctrine behind a skill pointer: a two-hop dependency fails silently
  when the hop is skipped.
- **No dashes as punctuation.** Not in prompts, not in skills, not in the
  kernel: the `--` pattern in context shifts generation toward the same pattern
  in deliverables, and deliverable prose bans dashes outright (with colons and
  semicolons). CLI flags and markdown table separators are syntax and stay.
