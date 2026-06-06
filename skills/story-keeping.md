# Story Keeping

This document defines the standard format for `story.md`, the central narrative
document used across all research activities.

## Purpose

The `story.md` file maintains the coherent narrative of a research project. It
serves as the north star for all work: tickets, experiments, reports,
presentations, and manuscripts should all align with the story.

**Location**: `notes/narrative/story.md`

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

State the central research question being investigated.

## Key Facts

- Finding 1: Brief statement with supporting data reference
- Finding 2: Brief statement with supporting data reference
- Finding 3: Brief statement with supporting data reference

## Current Stage

**Phase**: [Number] - [Stage Name]

Brief description of where we are in the research process and what we're
working on right now.

## Critical Decisions

Record key decisions made and their rationale:

1. **Decision**: What we decided
   - **Rationale**: Why we made this choice
   - **Date**: When (optional)

## Open Questions

What we still need to figure out:

1. Question 1
2. Question 2

## Next Steps

- [ ] Immediate next step
- [ ] Following step
- [ ] Future direction

## Related Work

- [[ticket-001-data-analysis]] - Brief description
- [[report-001-results]] - Brief description
- [[paper-draft-v1]] - Brief description
```

## When to Update

Update `story.md`:

- **After completing any report**: Add key findings to Key Facts
- **When narrative shifts**: Rewrite sections of the narrative
- **When phase changes**: Update Current Stage
- **Before creating new tickets**: Ensure narrative coherence
- **When making critical decisions**: Document in Critical Decisions

## Usage Across Activities

### For Tickets

- Reference `story.md` in the ticket's Context section
- Ensure the ticket contributes to the current stage
- Frame tasks in terms of narrative contribution

### For Reports

- Begin with how findings relate to the story
- Update story.md with new key facts
- Flag any narrative complications

### For Presentations

- Use the three-act structure as presentation outline
- Key Facts become talking points
- Current Stage decides what content to include

### For Manuscripts

- The three-act narrative becomes the paper structure
- Research Question becomes the abstract hook
- Key Facts become results and contributions

## Principles

1. **Keep it short**: 1-2 pages maximum
2. **Living document**: Update frequently as research evolves
3. **Narrative focus**: Emphasize story over methodology
4. **Impact-oriented**: Prioritize why this matters
5. **Referenceable**: Use wiki links to connect related work
