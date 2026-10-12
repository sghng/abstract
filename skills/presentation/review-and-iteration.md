# Review and Iteration of Slides

A crucial step in creating slides is "looking" at them to make sure the visual
aligns with your expectation. Compile to PDF, convert to JPEG, and have a
subagent read the images; the deck is usually too long for one context.

```sh
# you may need to clear older jpg files first
typst compile slide.typ -o slide-{p}.jpg
# the files will be slide-1.jpg, slide-2.jpg, etc
```

## Delegating the Review

Delegate flat, one subagent per section or per slide batch, each briefed
directly by you. Subagents have no peers and no cues, so no subagent coordinates
with another; you are the coordination point and triage every report yourself.

Each brief carries everything the reader needs:

- Purpose of the review: "look at this slide, check for visual problems,
  report." Be specific about what to check.
- The content: the slide image path plus the Typst source, so the reader can see
  both the render and the intent.
- Scope of the section or slide in the story: what `notes/story.md` says this
  part is for.
- Read-only: subagents report feedback and may suggest source changes; you apply
  every edit yourself.

If syntax-level issues are suspected, consult the **typst** skill.

Iterate: revise, recompile, re-delegate the affected slides. For the final
proofread, read the images yourself for a holistic pass.
