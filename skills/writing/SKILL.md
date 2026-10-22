---
name: writing
description: >-
  Academic writing craft and the house style guide: order, paragraphs,
  sentences, tone, words, formatting, numbers and citations, revision
  workflow. Use when drafting, revising, or reviewing any prose that leaves
  the lab, even one paragraph, even if nobody said the word style.
---

# Style Guide

This guide binds every deliverable that leaves the lab. The one who writes
and the one who reviews follow the same rules.

## The Nodding Reader

The target reader is a colleague from a neighboring subfield, smart but not
initiated. The draft introduces the field with history and background, shows
why the field is important, shows why our work is impactful and novel, and
only then presents what we did. Transitions are so natural that there is no
place to raise a question; everything makes so much sense that the reader
keeps nodding.

The goal is a coherent story, not a complete record of truth. Content that
does not serve the narrative is removed, not kept for completeness.

## Order

The paper builds piece by piece. Each new piece of information arrives in
its turn, when the reader can hold it, never before. A term is used only
after the sentence that defines it. A result is quoted only after the metric
that gives it meaning, and only where results are discussed; an accuracy
value in the dataset section is noise, not evidence.

Where the story needs a preview, one plain sentence in words the reader
already holds.

## Paragraphs

A paragraph develops one idea, in full, in its place. Once a topic is left,
it is never reopened. Length stays proportional to a point's role in the
story.

Fragmented or very short paragraphs usually mean the logic itself is
fragmented. Merge and develop until each paragraph carries one complete
thought.

Connections on the page cannot repair logic that is not there. Fix the order
of ideas first, then open each paragraph so the link to what precedes it is
explicit. The reader never has to infer why one statement follows another.

## Sentences

Keep sentence structure simple and straightforward. Avoid complicated
clauses, but also avoid punchy short sentences. Simple, not fragmented.

Link sentences with transition words, and keep each transition natural; the
flow is what keeps the reader nodding.

Signposting phrases ("It is important to note...") are transitions; they
signal what deserves attention and keep the flow moving.

Say the thing itself, never a claim about the thing. An opener that
announces importance or drama ("this is a game changer", "this is a plot
twist") is bluffing; a linking transition may open a sentence, a bluff may
not. Show the evidence and let the reader decide.

A dash in running prose, in any form (em dash, en dash, double hyphen),
means the sentence carries two thoughts. Split it. A semicolon also joins
two sentences, so split it there. Fold a colon's explanation into the
sentence.

## Tone

The writer is invisible. Academic prose carries the field's voice, never a
personal one; writing that can be distinguished from anyone else's is a
defect, not a style.

Tone is neutral toward the evidence and positive toward the contribution.
Language is professional and scientific. Hedge what the findings and
generalizations claim, and leave room there; hedging the contribution itself
undersells it. The failure is exaggeration past the evidence, not
confidence.

Describe other researchers' work factually. Report what they did and found;
never rate it, in praise or in disparagement. Your own work is the
exception; sell it.

## Words

Plain is measured against the field's published idiom, not against a
stripped vocabulary. The field's routine words, evaluative words included
("rich", "high-quality", "substantially"), are plain words; a phrase the
journals publish routinely is never a violation. What stays out is nuance,
figurative language, and cleverness outside that idiom. Insider terms that a
neighboring subfield would not share are defined or replaced. Define a term
once, at first use; thereafter the term stands alone. A common word borrowed
for a technical meaning is reinterpreted at its first use; when the audience
brings its own meaning to the word (confidence, significance), say what it
means here before it does any work.

Present the contribution positively. A draft that undersells its own work
cannot sell it; positive emphasis is expected, and the failure is
exaggeration or drama, never praise.

Write in a written register, never a spoken one. No contractions, no
conversational fillers, no rhetorical questions, no addressing the reader.

## Formatting

When a deliverable goes out, it goes out as a plain Word document in a
boring style. There is no need for fancy styling in the source, no flair, no
readability improvements.

- One H1 (the title); H2 for major sections; H3 sparingly; never H4, four
  levels means the structure is too nested.
- No bold in prose, least of all bolded paragraph labels
  (`**Background.**`), which read as AI-generated.
- No lists. Enumerate in running prose: "First, ... Second, ... Third, ..."
  or inline "1) ... 2) ... 3) ...".
- Tables carry data only (results, instruments, targets), never advice.

Every table and figure caption opens with a concise, simple title, and the
title ends with a period. A short note may follow the title, but the note
must stay much shorter than a regular paragraph. Explanation that runs
longer belongs in the prose, not the caption.

A table serves one point of the story. Cut a column that never varies, cut
or fill a column that is empty, and introduce every term the table uses
before or where the table appears.

## Numbers and Citations

Every claim carries its evidence. Effect claims carry a precision metric,
usually the SD or the p value; claims about the literature carry a citation.
Citations follow APA.

Enumeration is not analysis. Each table's prose carries the insight the
table supports, hedged as an interpretation, and the insight moves the
analysis forward.

## Repertoire

Consult the repertoire skill often for style reference while a deliverable
is in generation. Query with the draft prose at hand, filtered to the target
publication and in particular to the section being written, and match the
register of the published passages that come back.

The corpus settles doubt: when unsure whether a word or phrase is plain,
search it; a phrase the target venue publishes routinely is plain.

## References

`references/style/` holds the house style library: the handbook, the manual,
The Science of Scientific Writing, the zen notes, and the venue corpus
statistics. Consult it when a rule here needs depth or when a register
question goes past what the repertoire answers. The calibrated rule set
distilled from expert edits lives at `lint/rules.yaml` in the abstract repo;
consult it when a revision needs the rules verbatim.

# Writing Craft

The craft of turning the story into an external deliverable. The style guide
above is what the prose is held to; the story-keeping skill holds the story
doctrine it instantiates.

## Story First

The three-act story becomes the paper: Act 1 (hook) becomes the
introduction, Act 2 (approach) the method, Act 3 (discovery) the results and
discussion. Key facts become the contributions; the research question
becomes the abstract.

The introduction walks the chain explicitly: what existing research
established, the gap it leaves, the contribution proposed here, and the aims
with their significance. The chain is the story's inherent logic; a missing
link is a hole in the story that no transition on the page can bridge. Fix
the story, then write the connections.

Never let a draft drift from `story.md`. If the narrative must evolve, raise
it rather than fork it.

## Drafting from Scratch

A manuscript is built, not composed. Draft one section at a time and
settle it before moving on; a full-manuscript first pass trades control
for speed and pays both back in revision. Within a section, build
paragraph by paragraph, one idea each, developed in full, in story
order.

Iterate at the smallest unit that is broken. A sentence that stumbles
is rewritten in place; a paragraph that rambles is split or merged; a
section that loses the thread is reordered, never patched with
transitions. Run the nodding test after each section before opening the
next; the self-checks are the iteration loop, not a final gate.

Draft the body first. Method and results are fixed by the record and
carry the fewest choices; the discussion follows, then the
introduction, once what the paper did and found is on the page; the
abstract comes last, when the story the paper tells is final.

## Progressions

An ordered set of methods or analyses is a progression the reader walks:
simple before complex, naive before rich. Each item's rationale arrives at
its introduction, connected to the previous item's limit; what word
frequencies cannot capture, embeddings can. One sentence may announce the
progression where the section begins. A rationale section up front that
names and justifies every item tells the reader about methods the paper has
not yet introduced; it jumps ahead of the build, and it announces instead of
showing.

## Storyteller, Not Documenter

You construct a narrative; you do not document what was done. Every dataset
contains countless stories; the art is selecting and shaping the one that
matters most. This is focus, not dishonesty.

- Flow over completeness: a smooth partial truth beats a complete messy
  truth.
- Cut anything that does not serve the narrative, however interesting or
  hard-won. It goes to internal notes, not the draft.
- Only the story-supporting subset enters the draft; the full record stays
  in `notes/`.
- Chekhov's gun: everything introduced must fire. A method named, a column
  reported, a distinction drawn pays off later in the story or comes out.
  What is not reported is not mentioned; "X is outside the scope of this
  report" hangs a gun that never fires.
- Selection operates at every granularity: which experiments enter, which
  methods represent their families, which columns a table carries. The cast
  is a story decision, recorded in `notes/story.md`, and held consistent
  across every table; a benchmark reports everything, a story reports its
  cast.
- Omit what invites a question the data cannot answer (a spec that was not
  recorded), and omit without announcement.
- You own nothing in the draft. Hard-won results live in internal notes;
  attachment is the enemy of omission.
- A published imperfect paper advances the field more than an unpublished
  perfect one. Prioritize getting it out.

## Framing

- Strategic optimism: every result has a positive frame. "AIG achieves
  quality parity on easy items", not "AIG degrades on hard items".
- Every study has limitations, even the seminal ones. The job is a story
  compelling enough that readers accept the limitations and focus on the
  contribution.
- Mention only the limitations a competent reviewer would catch. Omit what
  only a determined critic would find, and flag the omission to the primary
  session as a known risk; it lands in `notes/story.md` under Known Risks.
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

- Nodding test: after each section, ask "did I nod, or did I pause
  anywhere?" If you paused, the reader will too.
- External-reader test: would a colleague from a neighboring subfield parse
  every term and step on first reading? This catches jargon leakage and
  insider assumptions.
- Visual pacing: never more than two to three paragraphs of unbroken prose
  without a visual or a reference to one.

## Reader Expectations

Readers read meaning out of structure, not words alone. Each position in a
sentence carries an expectation, and information lands best where the reader
looks for it.

- **Topic position**: open with old information, material the reader already
  holds; it links backward and frames what follows. The sentence is a story
  about whatever appears first, so choose that subject deliberately. "Pollen
  is dispersed by bees" continues pollen's story; the passive is the tool,
  not the failure.
- **Subject with verb**: a grammatical subject is followed immediately by
  its verb. Length in between reads as interruption whatever its true
  weight; give that material its own clause or cut it.
- **Stress position**: readers emphasize what arrives at the end, at
  syntactic closure. Reserve it for the new information that deserves
  emphasis. A sentence with more candidates for emphasis than closures is
  too long; split it.
- **Action in the verb**: the verb articulates the action; a nominalization
  beside a weak is or has hides it. "Egg extract limits transcription", not
  "transcription is TFIIIA-dependent".
- **Articulate the links**: a connection obvious to the writer is a gap to
  the reader. When restructuring cannot make the next sentence follow from
  the last, the argument itself has a hole; raise it, do not paper over it.

Violate an expectation only deliberately: a deviation registers as emphasis
against a background of met expectations.

## Revision

- A changed headline number triggers a numbers audit: spawn
  `reviewer-internal` with the numbers aspect over the draft and verify zero
  stale hits before reporting done. The canonical numbers live in
  `notes/results.md`.
- A revision absorbs new content into the story's order; it is never pasted
  where the request pointed. After an insertion, re-run the nodding test
  over the whole section, not only the new sentences.

## Tooling

- Draft in Typst; the typst skill holds syntax and package doctrine. No Typst
  drawing utilities: plots come from experiments, since the final export is
  Word through the word skill's converter.
- Venue constraints (page limits, required sections, citation style) go in a
  comment at the top of the draft, never in the body.
