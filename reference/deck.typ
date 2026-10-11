// Starter slide deck — touying simple theme. Copy to draft/<artifact>/ and
// fill in. The doctrine behind these conventions: reference/presentation.md.
//
// Conventions (settled; change only on directive):
// 1. `header: none` — no section indicator; a slide title and nothing else.
// 2. Every image centered (the show rule below).
// 3. Every table centered (the show rule below).
// 4. `breakable: false, detect-overflow: true` — one source slide, one output
//    page; overflow warns at compile time. Answer warnings by trimming words,
//    never by shrinking type.
// 5. `config-page(margin: (top: 1em, ...))` — reduces only the gap above the
//    slide title; every other margin stays at the theme default.
// 6. `#let section-dividers = false` — title-only divider slides off; flip to
//    true to restore them.
// 7. Font sizes come only from the theme's built-in roles (body, slide title,
//    footnote). The theme exports no size tokens; never write a raw size in
//    a slide.
// 8. Secondary text (captions, dense exhibits) uses `#small`, the theme's
//    footnote size. Reference it by name.
// 9. Slide content is centered vertically in the space after the title: the
//    fixed 0.75em spacer guarantees the title gap, the v(1fr) slack centers
//    content that fits, and over-tall content stays top-anchored so overflow
//    detection still fires. Toggle: `center-content`.
// 10. Bold is permitted on slides (defined terms, key numbers), unlike
//     manuscripts.

#import "@preview/touying:0.7.4": *
#import themes.simple: *

#let small(body) = text(size: 0.6em, body)
#let section-dividers = false
#let center-content = true

#show: simple-theme.with(
  aspect-ratio: "16-9",
  header: none,
  config-common(
    breakable: false,
    detect-overflow: true,
    new-section-slide-fn: if section-dividers { new-section-slide } else {
      none
    },
    default-composer: if center-content {
      (..bodies) => {
        v(0.75em)
        v(1fr)
        bodies.pos().sum(default: none)
        v(1fr)
      }
    } else {
      auto
    },
  ),
  config-page(margin: (top: 1em, bottom: 2em, left: 2em, right: 2em)),
  config-info(
    title: [Presentation Title],
  ),
)

#show image: align.with(center)
#show table: align.with(center)

#title-slide[
  #title[Presentation Title]
  Author · Date
]

== Outline
#components.adaptive-columns(outline(title: none, indent: 1em, depth: 1))

= Introduction

== Context and motivation
- The problem the field cares about, in full sentences, with citations.

== The present work
- The approach in one sentence, then the research questions. No citations
  here: this slide sells originality.

= Method

== Design
- Corpus, instruments, criteria, blinding. Every metric used later is
  defined here first.

= Results

== First result
- Lead with the measurement validity (for example reliability), then the
  substantive findings.

= Discussion

== Conclusions
+ One numbered point per contribution.

= Status

== Status of the work
// For work-in-progress decks; delete the section otherwise.
- Where things stand today.

= Future work

== Future work
- Concrete next steps.

#focus-slide[Thank you for listening.]
