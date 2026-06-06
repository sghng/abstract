---
name: research
description: Academic research skill set.
---

# Academic Research

This skill bundle describes how to work on an academic workflow. It comprises
the following modules:

- `presentation`: How to do good academic presentations. This includes
  preparation of presentation, story telling planning, making slides, and
  `story.md`.
- `engineering`: The implementation side of things. This includes how to run
  experiments, preferred tech stack, conventions regarding writing code,
  organizing data, collecting results, generating plots, and relevant file
  structure.
- `literature`: Things related to managing references/papers.
- `manuscript`: How to write a manuscript for academic publication.
- `grants-and-fellowship`: How to write applications/proposals for grants and
  fellowships. (WIP)
- `typst.md`: Cross-module Typst notes (syntax reminders, common mistakes,
  package policy).

Under each module, there will be a sub-skill file `<module>/SKILL.md` to
introduce you to content in that skill module. You are always welcome to read
more files if you need it.

> [!IMPORTANT]
>
> When you are using this skill bundle, if you encountered anything that's
> unexpected and you think the solutions/clarifications should be documented
> into the skills, do not hesitate to inform the user.

## Skills, Roles, and Delegation

### Delegation Philosophy

All agents, primary and subagents alike, have access to all skill modules.
Delegation is not about knowledge boundaries. Every agent can read every skill,
and having the full picture actually helps you understand when and how to
delegate and communicate.

Instead, delegation is about **responsibility boundaries and context
management**. The skill modules are split to reflect structure: "when I assumed
this role, I mostly care about this skill module; I know the other skills, but
they're not super relevant right now, and I choose to delegate instead of doing
them on my own." It's like a senior researcher who _could_ do the literature
search while writing, but treats it as a separate task so they don't lose their
thread.

The practical reasons to delegate are:

- **Context preservation.** The task would consume significant context (e.g.
  reading full papers, reviewing many slides) and degrade your ability to
  continue your primary work.
- **Attention focus.** The task deserves someone's full, undivided attention
  rather than being a side quest from your main thread.
- **Parallelism.** The task is independent and can run concurrently with your
  current work or other delegated tasks.

Conversely, if a task is a quick lookup, a small action, or tightly coupled with
what you're already doing, just do it inline.

### Orchestration

We do not designate roles for any agents. Instead, we only delegate a task, and
the agent assigned this task will decide on what specific skill modules to use.

As primary agent, you coordinate and orchestrate subagents. Currently, subagents
cannot spawn sub-subagents, so all fan-out must originate from you. If a task
has natural hierarchy (e.g. reviewing a presentation section by section, then
slide by slide), you are responsible for flattening that into parallel subagent
calls, each scoped to a manageable slice.

You will also likely assume different roles at different times. When user is
discussing implementations, you assume the "engineer" role implicitly. When the
focus shifts to manuscript drafting, your role morphs accordingly. If an ad-hoc
task arises that is substantially different from your current work, the rational
choice is to delegate it to a subagent, who will then assume an appropriate role
implicitly.

The key is: always know what you're doing right now, and choose wisely whether
you do this task yourself or delegate it.

### Handoff and Feedback

When delegating, provide the subagent with enough context to work independently:
the task description, relevant file paths, any guiding artifacts (like
`story.md`), and specific questions you need answered. The exact protocol will
vary by task, so use your judgment.

Subagents should return not just the deliverable, but also their honest
assessment of the task itself: what went well, what was unclear, what was harder
than expected, and any suggestions for how the work could have been scoped or
instructed better. As primary agent, you should surface these observations to
the user, so that our workflows and skills can improve over time.

Do not wait to be asked. If you notice workflow friction or skill gaps during
execution, report it alongside your deliverable.

### Pre-task and Post-task Checks

Treat reflection as part of execution, not an extra step.

Before starting a substantial task, do a quick pre-task check:

- Is the scope clear enough to proceed?
- Do I have the needed context/files/artifacts?
- Is there any ambiguity, risk, or missing instruction that can affect quality?

If something is unclear but non-blocking, proceed with your best judgment and
note it. If something is materially unclear, ask the user early.

After finishing a task, do a quick post-task check:

- What went well?
- What was unclear, inefficient, or unexpectedly hard?
- What should be improved in skill guidance or task scoping next time?

When delegating, subagents should report these observations to the primary
agent. The primary agent should surface meaningful improvement notes to the
user.

## Repository Structure

This section documents the conventional repo structure used in a typical
research project. Detailed description about them may be found in other skill
modules. The exact repo structure may vary slightly in different projects.

- `data`: data files reused across experiments
- `src`: core code that is reused across experiments
- `scripts`: one-off scripts
- `draft`: files related to the drafting of publications and presentations
- `experiments`: files related to the experiments. Read `engineering/` skill
  module to know more.

Inside each folder, also look for instructional files such as `README.md` to
help you understand the structure of that directory.
