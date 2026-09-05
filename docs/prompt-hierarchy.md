# Prompt Hierarchy

How the lab's prompts are layered, and the rules for where a line of prompt
text lives. Think of it as onboarding employees.

## The Three Layers

1. **The all-hands meeting (shared movements).** Everyone hears everyone's
   role, so each agent knows both its own job and what it can ask of peers.
   `motif` (invariants, roster, layout) for all; `tuning` (the prose standard)
   for the two roles that judge prose. A standard earns sharing precisely
   because a standard with one holder is not a standard.

2. **The one-on-one (role movements).** Specific expectations for one role,
   always-on in that role's context: doctrine, craft, workflow. Single-
   function roles (writer, reviewer) inline everything they always need;
   a probabilistic gate on content with a near-certain invocation rate is
   pure overhead and pure risk.

3. **The reference manual (skills).** Episodic, task-matched procedures:
   docx handling, journal review, presentations, literature search, Typst
   syntax. The agent is pointed at their existence and loads one when its
   description matches the task. Uncertainty is acceptable here because
   invocation is genuinely occasional.

## The Rules

- **Always-on membership test** (score.ts): a line is always-on iff it is
  needed in most turns of the role, or forgetting it is silent and costly.
- **The test is role-relative.** The same content can be a movement for one
  role and a skill (or nothing) for another. Doctrine graduates into exactly
  the scores that always need it.
- **Ownership places doctrine.** A line of doctrine lives with the role that
  owns the artifact the doctrine governs: story-keeping in `theme`
  (orchestrator, owner of `notes/story.md`), prose craft in `prose` (writer,
  owner of `draft/`). When two roles must reason about the same doctrine, it
  becomes a shared movement: `tuning` (prose standard, writer + reviewer),
  `story` (narrative doctrine: the orchestrator maintains the story, the
  writer instantiates it). Consumers of an artifact read the artifact; roles
  that shape it share the doctrine.
- **Duplication rule.** Never repeat a statement within one agent's context.
  Repetition across different agents' contexts is acceptable and sometimes
  intended (tuning shared by writer and reviewer; the reviewer's checklist
  restating the writer's detail at recognition grain). When the same fact
  serves two roles, give each the grain it needs: generative detail for the
  producer, checkable items for the judge.
- **Asymmetric detail protects independence.** The reviewer gets a checklist,
  not the writer's full rationale; a reviewer inside the writer's frame
  shares the writer's blind spots.
- **Pointer discipline.** Movements may point to skills for episodic
  procedures ("read the logistics skill when creating reports"). Never put
  always-on doctrine behind a skill pointer: a two-hop dependency fails
  silently when the hop is skipped.
