# Presentation Content Preparation

When user started a request to make a presentation, you should first work on
preparing the content before diving into creating the slideshow.

User will usually give you direct instructions on what the presentation is
about, or point you to the files that are related, you may also perform a
explore task using a subagent to get relevant info in the working dir.

## Prerequisites

Before preparing presentation content:

- Review `story.md` in `notes/narrative/`
- Understand the audience and occasion
- Clarify the key message (usually 1-3 take-home points)

**Read `notes/story.md` itself; its format is owned by the orchestrator.**

## The Story Document

Use `story.md` or a presentation-specific story file, following the shape of the
project's `notes/story.md`:

- **One-Line Summary**: What this talk is about
- **Three-Act Narrative**: Hook, approach, discovery
- **Key Facts**: 3-5 key findings to present
- **Audience**: Who are we speaking to and what do they care about?
- **Occasion**: Conference talk? Group meeting? Job interview?

## Mapping Story to Presentation

| Story Section     | Presentation Element  | Purpose                                    |
| :---------------- | :-------------------- | :----------------------------------------- |
| Act 1 (Hook)      | Opening slide(s)      | Grab attention, establish why this matters |
| Research Question | Agenda/Overview slide | Preview what you will cover                |
| Act 2 (Approach)  | Methods slides        | How you tackled the problem                |
| Act 3 (Discovery) | Results slides        | What you found                             |
| Key Facts         | Key Takeaway slides   | What the audience should remember          |
| Open Questions    | Future Work slide     | What's next                                |

## Principles

### Know Your Audience

**The goal of a presentation is to please our audience, make them feel
informed.**

- Conference talk: Emphasize novelty and contribution
- Group meeting: Focus on methods and challenges
- Job interview: Highlight skills and problem-solving

### Less is More

- One key message per slide
- One presentation = one story
- Cut ruthlessly: if it doesn't serve the story, remove it

### The Rule of Three

Structure around three main points:

- Three acts of the story
- Three key findings
- Three takeaways

## The Process

1. **Gather context**: Read story.md, understand research
2. **Define audience**: Who, where, what do they care about?
3. **Draft the story**: One-line summary, three-act structure, key facts
4. **Create outline**: Map story sections to slides
5. **Iterate with user**: Get feedback before creating slides
6. **Move to slide creation**: Hand off to slide-making phase

## For Short or Casual Talks

For very short/casual talks, the full `story.md` process might be overkill.
Having in-file comments in the presentation source will be enough. When in
doubt, consult the user.

## Deliverables

When content preparation is complete, you should have:

- [ ] Clear one-line summary
- [ ] Defined audience and occasion
- [ ] Three-act narrative documented
- [ ] 3-5 key facts identified
- [ ] Slide-by-slide outline
- [ ] User approval on direction

Then proceed to `slides.md` for slide creation.
