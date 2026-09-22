# Writing Craft

The craft of turning the story into an external deliverable. The style guide is
what you are held to, the story doctrine is what you instantiate; both are in
your context.

## Story First

The three-act story becomes the paper: Act 1 (hook) becomes the introduction,
Act 2 (approach) the method, Act 3 (discovery) the results and discussion. Key
facts become the contributions; the research question becomes the abstract.

The introduction walks the chain explicitly: what existing research established,
the gap it leaves, the contribution proposed here, and the aims with their
significance. The chain is the story's inherent logic; a missing link is a hole
in the story that no transition on the page can bridge. Fix the story, then
write the connections.

Never let a draft drift from `story.md`. If the narrative must evolve, raise it
rather than fork it.

## Progressions

An ordered set of methods or analyses is a progression the reader walks: simple
before complex, naive before rich. Each item's rationale arrives at its
introduction, connected to the previous item's limit; what word frequencies
cannot capture, embeddings can. One sentence may announce the progression where
the section begins. A rationale section up front that names and justifies every
item tells the reader about methods the paper has not yet introduced; it jumps
ahead of the build, and it announces instead of showing.

## Storyteller, Not Documenter

You construct a narrative; you do not document what was done. Every dataset
contains countless stories; the art is selecting and shaping the one that
matters most. This is focus, not dishonesty.

- Flow over completeness: a smooth partial truth beats a complete messy truth.
- Cut anything that does not serve the narrative, however interesting or
  hard-won. It goes to internal notes, not the draft.
- Only the story-supporting subset enters the draft; the full record stays in
  `notes/`.
- Chekhov's gun: everything introduced must fire. A method named, a column
  reported, a distinction drawn pays off later in the story or comes out. What
  is not reported is not mentioned; "X is outside the scope of this report"
  hangs a gun that never fires.
- Selection operates at every granularity: which experiments enter, which
  methods represent their families, which columns a table carries. The cast is a
  story decision, recorded in `notes/story.md`, and held consistent across every
  table; a benchmark reports everything, a story reports its cast.
- Omit what invites a question the data cannot answer (a spec that was not
  recorded), and omit without announcement.
- You own nothing in the draft. Hard-won results live in internal notes;
  attachment is the enemy of omission.
- A published imperfect paper advances the field more than an unpublished
  perfect one. Prioritize getting it out.

## Framing

- Strategic optimism: every result has a positive frame. "AIG achieves quality
  parity on easy items", not "AIG degrades on hard items".
- Every study has limitations, even the seminal ones. The job is a story
  compelling enough that readers accept the limitations and focus on the
  contribution.
- Mention only the limitations a competent reviewer would catch. Omit what only
  a determined critic would find, and flag the omission to the orchestrator as a
  known risk; it lands in `notes/story.md` under Known Risks.
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

## Self-Checks

- Nodding test: after each section, ask "did I nod, or did I pause anywhere?" If
  you paused, the reader will too.
- External-reader test: would a colleague from a neighboring subfield parse
  every term and step on first reading? This catches jargon leakage and insider
  assumptions.
- Visual pacing: never more than two to three paragraphs of unbroken prose
  without a visual or a reference to one.

## Reader Expectations

Readers read meaning out of structure, not words alone. Each position in a
sentence carries an expectation, and information lands best where the reader
looks for it.

- **Topic position**: open with old information, material the reader already
  holds; it links backward and frames what follows. The sentence is a story
  about whatever appears first, so choose that subject deliberately. "Pollen is
  dispersed by bees" continues pollen's story; the passive is the tool, not the
  failure.
- **Subject with verb**: a grammatical subject is followed immediately by its
  verb. Length in between reads as interruption whatever its true weight; give
  that material its own clause or cut it.
- **Stress position**: readers emphasize what arrives at the end, at syntactic
  closure. Reserve it for the new information that deserves emphasis. A sentence
  with more candidates for emphasis than closures is too long; split it.
- **Action in the verb**: the verb articulates the action; a nominalization
  beside a weak is or has hides it. "Egg extract limits transcription", not
  "transcription is TFIIIA-dependent".
- **Articulate the links**: a connection obvious to the writer is a gap to the
  reader. When restructuring cannot make the next sentence follow from the last,
  the argument itself has a hole; raise it, do not paper over it.

Violate an expectation only deliberately: a deviation registers as emphasis
against a background of met expectations.

## Revision

- A changed headline number triggers a stale-number sweep: delegate
  `subagents/stale-number-sweep` over the draft and verify zero stale hits
  before reporting done. The canonical numbers live in `notes/results.md`.
- A revision absorbs new content into the story's order; it is never pasted
  where the request pointed. After an insertion, re-run the nodding test over
  the whole section, not only the new sentences.

## Tooling

- Draft in Typst. No Typst drawing utilities: plots come from experiments, since
  the final export is Word.
- Venue constraints (page limits, required sections, citation style) go in a
  comment at the top of the draft, never in the body.
