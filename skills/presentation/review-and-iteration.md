# Review and Iteration of Slides

A crucial step in creating a slides, is "looking" at it to make sure the visual
aligns with your expectation.

To achieve so, you will need to first compile it to PDF, then convert it to
JPEG, and delegate it to a subagent to read it -- because we usually have a lot
of slides, the most robust solution is having a subagent (or multiple subagents)
reading it.

The following code block is an example of how to do this.

```sh
# you may need to clear older png files first
typst compile slide.typ -o slide-{p}.jpg
# the files will be in slide-1.jpg, slide-2.jpg, etc
```

## Subagent Reviewing Delegation

- You delegate one section to a subagent.
- That subagent, should again delegate each slide to another subagent.
- All subagents should read from `story.md` for a coherent story telling.
  Specifically, the subagent in charge of the section should review based on
  what this section is about, those reviewing a slide should be based on what
  that slide is about.
- Subagents shouldn't be modifying the slides directly. They should be only
  responsible for giving review feedback.

Therefore, when you delegate tasks to subagents (and when subagents delegate to
sub-subagents), these information should be made available.

- Purpose of the review. Usually it's something like "observing this slide,
  check for visual problems and report." Be detailed if needed.
- The content in the slide. You should also tell the subagent about the content,
  ideally the Typst source code. That way the subagent is able to check if
  anything is missing or broken.
- If syntax-level issues are suspected, consult `../typst.md`.
- Since the source code is provided, you may also ask subagent to give source
  code improvement advice, if you think you need it -- but they shouldn't be
  modifying it directly.

Subagents should also be allowed to "ask questions" to their peer subagents. For
example, a section agent can ask about "is this information covered in the
section before me?", or "how is this concept going to be developed in the coming
section?" The primary agent will be in charge of triaging these information in
the iterations.

Such review and revision should happen for several iterations, allowing full
exchange of information.

If needed, for example, in final proof read, or per the request of the user, you
may want to read the images as primary agent, to have a wholistic understanding.

> [!TIP]
>
> When compiling a slides into PDF for review, you should **enable handout
> mode**, so that the content is not duplicated in multiple pages:
> `#show: my-theme.with(config-common(handout: true))`. It's safe to add this in
> slides during introspection. If user doesn't want it, user will comment it
> out.

## Visual Review

Again, visual review is very important. Do not overlook the visual issues
reported back by the subagents. You may want to check on your own and have them
fixed. A few common issues are:

- Content overflow
- A mostly empty slide with little content, likely also due to overflow.
- A diagram not in proportion with the the text in the adjacent column (diagram
  too big or too small)
