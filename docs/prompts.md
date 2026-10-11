# Prompt doctrine

Why the prompt system is shaped the way it is. The live layer mechanics are
in [prompt hierarchy](/prompt-hierarchy); this file records the authoring
rules and the durable placement decisions.

## Layers

| Layer | Home | Loaded |
| ----- | ---- | ------ |
| kernel | `config/AGENTS.md` | native discovery, auto-loaded, shared by all roles |
| binder | `prompts/binder.yaml` + `prompts/*.md` | assembled per role, per model request |
| prompt | one `prompts/<stem>.md` file | the unit of doctrine, one home per text |
| skill | `config/skills/` | on demand, by description match |
| agent body | `config/agents/*.md` | registry config only (model pin, permissions) |

The binder, not the agent body, is the doctrine home: an agent body is
concatenated into the request prefix, so editing it invalidates the prompt
cache without taking effect any sooner than the binder does, and a prompt
shared by two roles would have to be copied into two bodies.

## Authoring rules

- ASCII only. No emoji, no non-ASCII punctuation; arrows as `-->`.
- No dashes as punctuation in agent-facing prose, any form; the pattern in
  context shifts generation. CLI flags and markdown table separators are
  syntax, not prose, and stay.
- Deliverable prose bans colons, semicolons, and dashes in running text (see
  `prompts/style-guide.md`); prompt lists may still use colons after bold
  labels.
- Empiricism: a rule earns its place when its absence produces a failure.
  If a line can be deleted and behavior does not change, it stays deleted.
- Economy: instruct only where the prior is wrong.
- State once: each fact gets one home, chosen by audience. The kernel holds
  the shared layer; a role prompt carries only that role's deviation.
- Positive imperatives: state what to do; cut hedges.
- Recursion: a line is finished when nothing can be deleted, not when
  nothing can be added.
- Naming: nuanced, unusual names are for tokens that live in agent context
  and need markedness against generic prose; file and directory names are
  dev-facing and stay descriptive. Musical names (`binder`, `cue`,
  `repertoire`) apply exactly when the token appears in agent context.
- Post-surgery checklist: after moving or graduating prompt content, grep
  the descriptions, sibling files, and dev docs for the old names; residue
  is the expected failure mode of every graduation round.

## Placement rules

A prompt is always-on (in the binder) iff the role needs it in most turns
or forgetting it is silent and costly; everything else is an on-demand
skill. Graduating a skill means extracting its body into a `prompts/` file
(no frontmatter) and listing its stem in `prompts/binder.yaml`; demoting is
the reverse. Skills delete outright when superseded; git history is the
rollback.

Graduations that set precedent:

- Sole-audience, near-certain invocation graduates wholesale into the role
  prompt (engineering skill into `engineer.md`; literature operations into
  `librarian.md`).
- Continuously-running procedure graduates to the reference shelf, not a
  skill (logistics into `reference/logistics.md`): the on-demand skills
  index was the wrong tier for something read every turn of every role.
- Doctrine rides with the owner of the artifact it governs (story keeping
  with the orchestrator, writing craft with the writer); shared doctrine
  gets its own file listed by both binders.
- Typesetting medium stays a skill (`typst`), not a prompt: it is not the
  writer's constant concern and may change.

## Amendment scope

A role amends its own binder prompts and its own `binder.yaml` entry, plus
the reference shelf, only on the user's direct order and with the proposed
text shown first. File deletion is sole-carrier only. The orchestrator is
the doctrine's curator and may amend any prompt file, any mapping entry,
and the kernel itself, under the same rule. Enforcement is the kernel rule
plus the harness plugin's pre-approved `external_directory` allow rules for
`prompts/*` and `reference/*` plus git history; no tool-mediated gate.

## History

The prompt assembler was `score.ts` with `movement/` files, renamed to the
binder (2026-09-22) when it took over self-amendment. `prose-standard.md`
was renamed and restructured into `style-guide.md` units of the text, and
the density doctrine was retired the day before (saying little is economy,
not density). The full arcs live in git history; the load-bearing outcomes
are the rules above.
