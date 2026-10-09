# Presentations

The doctrine behind `reference/deck.typ`. It binds every deck that leaves
the lab, alongside the style guide. The style guide rules on tone and words
apply; this file holds what is specific to slides.

## Voice

- Academic, never product. Descriptive slide titles; no slogans, no
  questions anywhere (titles, captions, body), no addressing the audience.
- Full sentences in bullets. No telegraphic fragments, no internal
  shorthand; an audience member must parse every phrase on first contact.
- Bold is permitted on slides for defined terms and key numbers. The
  manuscript no-bold rule does not apply to decks.

## Structure

- Introduction, Method, Results, Discussion. Work-in-progress internal decks
  may add Status and Future work; never "Outlook".
- One framework, one narrative. Pose research questions; never split the
  talk into "Study 1" and "Study 2", which reads as fragmented.
- The introduction runs several slides and is built from the manuscript's
  introduction. The pipeline or system is never the third slide; why the
  work matters comes first.
- Method carries definitions, criteria, and formalization; equations are
  welcome when there is time. A metric is defined before any slide quotes
  its values. Results slides report; they do not define.
- Order results for the argument: measurement validity (for example
  inter-rater reliability) precedes substantive findings.

## Captions and metrics

- Every metric is defined in plain language where it is used: what it
  measures, what the values mean, and what test produced a p value.
- A caption states the finding in words first; statistics are parenthetical
  evidence, never the headline.

## Figures

- Categorical axes follow one logical, consistent order across every figure
  in a deck (for example generators by performance, reviewers by leniency),
  and the caption states the ordering.
- No in-figure title when the slide title already carries the message.
- Figures carry data; the caption carries the point.

## Audience discipline

- Peer researchers: no cost figures, no venue or conference mentions, no
  investor framing.
- Anonymize people: Reviewer 1–6, never names.
- Frame tools as objects of study, not as decision-makers. Report how
  models evaluate; never imply their output decides outcomes.
- No citations on the slide that presents the contribution; they read as
  derivative. A references slide is optional and usually dropped for
  internal talks.

## Fit and layout

- Trim words before shrinking type. Overflow warnings are answered with
  deletion, never with smaller text.
- One idea per slide. The template centers sparse content vertically and
  leaves dense slides top-anchored; do not hand-tune spacing per slide.

## Workflow

- The presenter reviews renders personally; the writer does not compile the
  deck. Settle Typst behavior questions with isolated probes in a scratch
  file, never by compiling the deck and never by assertion.
- Surface every change to an interpretation, not only to numbers, to the
  presenter explicitly before the talk. A new explanation that ships
  unflagged leaves the presenter unprepared.
