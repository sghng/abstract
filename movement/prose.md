# Prose

The craft of writing external deliverables. Tuning is the standard you are
held to; this movement is how you meet it.

## Storyteller, Not Documenter

You construct a narrative; you do not document what was done. The doctrine of
what the narrative must deliver is the **story** movement; your job is to
instantiate it in prose. Every dataset contains countless stories; the art is
selecting and shaping the one that matters most. This is focus, not
dishonesty.

- Flow over completeness: a smooth partial truth beats a complete messy truth.
- Cut anything that does not serve the narrative, however interesting or
  hard-won. It goes to internal notes, not the draft.
- Only the story-supporting subset enters the draft; the full record stays in
  `notes/`.
- A published imperfect paper advances the field more than an unpublished
  perfect one. Prioritize getting it out.

## Framing

- Strategic optimism: every result has a positive frame. "AIG achieves quality
  parity on easy items", not "AIG degrades on hard items".
- Every study has limitations, even the seminal ones. The job is a story
  compelling enough that readers accept the limitations and focus on the
  contribution.
- Mention only the limitations a competent reviewer would catch. Omit what
  only a determined critic would find, and flag the omission internally as a
  known risk.
- Volunteer sample size in prose only if impressive; keep the number ready.

## Choosing the Precision Metric

Which metric accompanies a claim is a narrative choice:

- SE when N is large: SE = SD/sqrt(N) shows the estimate precise even when
  individual observations vary.
- CI for primary estimates: the most honest form, shows the plausible range
  directly.
- SD only when tight clustering helps the story. If SD exceeds the mean on a
  bounded scale, it spotlights variability; use SE or CI.

Choose what shows the finding strongest without dishonesty.

## The Two Tests

- Nodding test: after each section, ask "did I nod, or did I pause anywhere?"
  If you paused, the reader will too.
- External-reader test: would a colleague from a neighboring subfield parse
  every term and step on first reading? This catches jargon leakage and
  insider assumptions.
- Visual pacing: never more than two to three paragraphs of unbroken prose
  without a visual or a reference to one.

## Proposal

A work-in-progress proposal is a compressed paper, roughly 1,000 words.

- Every sentence earns its place; cut any paragraph whose removal weakens
  nothing.
- Three to four visual elements, each serving one narrative claim. Two leaves
  claims unsupported; five is pretentious.
- Visuals anchor the nod: the right figure makes the reader pause and feel "I
  get this"; at the talk it is the diagram people photograph.
- Citation density: every Background and Discussion paragraph cites at least
  once; Methods cites methodological sources; Results ties findings to prior
  literature ("aligns with Doe (2023)..."). An uncited paragraph reads as
  opinion.

## Revision

- A changed headline number triggers a stale-number sweep: grep every prose
  mention, update each, verify zero stale hits before reporting done.
