---
name: story-keeping
description:
  The central narrative: what makes the story good and how to keep
  notes/story.md current. Use when a report lands, when the narrative shifts,
  when the phase changes, before framing a ticket, when judging whether a
  finding strengthens the story, or when a draft might fork it.
---

# Story Doctrine

The doctrine of the lab's narrative. The story is a distilled paper; the
paper is an instantiated story. What the story cannot answer, the paper
cannot either.

## Keywords Are Questions

Readers read a title and abstract as a set of keywords, and every keyword
raises a question. "Template-Based Automatic Item Generation with Agentic
Large Language Model Assistance" is read as: template-based (what is it? why
template-based?), agentic (what is it? why agentic?), LLM assistance (what
does the model actually do? why can it do that?).

The story answers every keyword question as early as possible: the abstract
and introduction first, the method next; and it re-supports the answers
wherever the keyword recurs. Throw the questions at the reader, then answer
them. A reader whose questions are answered the moment they arise keeps
nodding.

## The Five Questions

A good story always delivers, as early as it can:

1. What did we do?
2. Why did we do it?
3. How did we do it?
4. Why is this important?
5. How is it different from previous work?

## Big Story First

Start big to show impact and draw attention; then narrow. The field is big
and important; here is why. A problem troubles it; here is the problem. We
have one solution to that one problem; here it is. Layer the argument:
general importance --> specific gap --> approach --> findings --> concrete
guidance.

Research advances step by step, so the contribution is usually small, and
that is fine. Never open with the small thing. The opening earns the small
thing its significance. Even readers who lose the details absorb most of the
paper.

# Story Keeping

`notes/story.md` is the lab's single narrative spine, and every act of
orchestration aligns with it: tickets are framed as contributions to the
current stage, consultations and reports are checked against it, and the
principal investigator hears the story's current truth.

The story evolves through the primary session. When a draft, report, or
finding exposes drift, the primary decides: revise the story or correct the
work. A draft never silently forks the story.

Keep the story short (one to two pages), living, narrative-first,
impact-oriented, wiki-linked.

## When to Update

- After any report lands: add key findings to Key Facts.
- When the narrative shifts: rewrite the affected sections.
- When the phase changes: update Current Stage.
- Before creating tickets: confirm the ticket advances the current stage.
- When a critical decision is made: record it with its rationale.

## Judgment Framework

When reviewing reports or weighing findings, two passes:

1. **Story flow**: did you nod, or did you pause anywhere? A pause marks a
   narrative problem.
2. **External reader**: would a colleague from a neighboring subfield parse
   every term and step on first reading? This catches jargon leakage and
   insider assumptions.

Report what strengthens the narrative; flag what weakens it internally under
Known Risks in `story.md` rather than broadcasting it. Raise with the user
only what is lethal: what any competent reviewer would catch that
invalidates a central claim.

## Standard Format

```markdown
# Story: [Project Name]

## One-Line Summary

A single sentence capturing the essence of the research.

## Three-Act Narrative

### Act 1: [The Hook/Problem]

The context and motivation. What gap or problem does this research address?

### Act 2: [The Approach]

The methodology and investigation. How did we tackle this problem?

### Act 3: [The Discovery/Solution]

The key findings and implications. What did we learn?

## Research Question

The central research question being investigated.

## Key Facts

- Finding 1: brief statement with supporting data reference
- Finding 2: brief statement with supporting data reference

## Current Stage

**Phase**: [Number] - [Stage Name]

Where we are in the research process and what we are working on now.

## Critical Decisions

1. **Decision**: what we decided
   - **Rationale**: why we made this choice

## Known Risks

1. **Risk**: a known fragility or deliberate omission, who flagged it, and
   what a determined critic would say

## Open Questions

1. Question 1

## Next Steps

- [ ] Immediate next step
- [ ] Following step

## Related Work

- [[ticket-001-name]] - brief description
- [[report-001-name]] - brief description
```
