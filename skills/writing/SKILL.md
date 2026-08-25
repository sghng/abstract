---
name: writing
description: Academic writing conventions for external deliverables — manuscripts, proposals, cover letters. Use when writing or revising anything that leaves the lab.
---

# Academic Writing Conventions

> [!IMPORTANT]
> These conventions apply to **external deliverables only**: manuscripts,
> proposals, cover letters, personal statements, conference papers — anything
> that leaves the lab and enters the academic world.
>
> For internal documents (notes, tickets, dev docs, internal reports), use
> whatever Markdown makes things clearest. Callouts, bullet points, tables,
> Mermaid diagrams, wiki links, bold, italic — all are welcome and encouraged.
> These rules are for the outside world, not for us.

---

## General Principles

Academia is dominated by oldies who don't want to change. Your formatting
should be so conservative it's boring. No creativity. No flair. No
"readability improvements." If it feels like you're formatting a document from
1995, you're doing it right.

### Headings

- **H1 (`#`) is the title.** There is exactly one title per document. It's
  always appropriate — even in personal statements and cover letters — because
  every document has a title.
- **H2 (`##`) is for major sections.** You can have as many as you need.
  When submission guidelines explicitly ask for sections (Background, Methods,
  Results, Conclusions), use H2 for those.
- **Minimize H3 (`###`).** Only use when genuinely necessary.
- **Avoid H4 (`####`) completely.** If you need four levels of headings, your
  structure is too nested. Flatten it.

### No Bolded Text

Never use bolded text in paragraphs. Not for emphasis, not for structure, not
for "improving scannability." Academia has survived centuries without bold —
it'll survive your paper too.

In particular, never use bolded labels at the start of paragraphs like
`**Background.**` or `**Methods.**`. This pattern screams "AI-generated" to
anyone who's seen ChatGPT output, and academia is absolutely AI-phobic right
now. Write normal prose transitions instead.

### No Bullet Points

Don't use bulleted or numbered lists in academic prose. They feel like a slide
deck, not a paper.

When you need to enumerate items — recommendations, steps, categories — use
one of these two forms in running prose:

- **"First, ... Second, ... Third, ..."** — the conventional academic form.
  Works well for flowing recommendations and logical sequences.

- **"1) ... 2) ... 3) ..."** — an inline alternative that preserves the
  clarity and conciseness of a list without breaking prose flow. Especially
  useful when the enumerated items are parallel in structure.

Do not use tables as a workaround for the bullet-point ban. Tables are for
**data** — results, survey instruments, prediction targets — things where
side-by-side comparison demands precise alignment. A table of advice or
recommendations feels like a policy document; prose advice feels like a
colleague who knows what they're talking about.

### Define on First Use

Every specialized term must be explained at its first occurrence in the text.
A reader from a different subfield should never hit a word they cannot parse
from context. What's obvious to you — methodological shorthand, system
components, analytical metrics — is opaque to anyone outside your project. If
you hesitate even slightly about whether a term needs definition, it does.

---

## Language

- Make the language feel human. No em-dash is allowed.
- Avoid AI-sounding constructions. If it reads like it could be copy-pasted
  from a GPT response, rewrite it.
- Sentence variety matters. Don't start three consecutive sentences the same
  way.
- Prefer active voice where it doesn't sound forced.

### Integrated Citations

Never use a parenthetical citation as the grammatical subject or object of a
sentence. Write "Gierl and Haladyna (2012) established..." not "(Gierl &
Haladyna, 2012) established..." The parenthetical form `(Author, Year)` is
for supplementary citation at the end of a claim, not for carrying the grammar.

### No Colon Explanations

Avoid the pattern "X showed that Y is fragile: performance drops..." where a
colon introduces an explanatory fragment. Write an integrated sentence
instead: "X found the fragility of Y, showing that performance declined..."
The colon construction reads like a lecture slide, not a paper.

---

## Reporting Conventions

### What to Always Report

Every reported effect must be accompanied by a precision metric. Choose
whichever best supports the narrative:

- **Standard error (SE).** Preferred when N is large and SD would appear
  inflated. SE = SD / sqrt(N), so it accounts for sample size and shows the
  mean estimate is precise even when individual observations vary.
- **Confidence intervals.** The most honest metric; shows the plausible range
  directly. Especially effective for primary estimates.
- **p-values.** Required for any claim using the word "significant." Report
  the test statistic alongside.
- **Standard deviation (SD).** Report when it helps the narrative (e.g.,
  showing tight clustering around the mean). If SD exceeds the mean on a
  bounded scale, it draws attention to variability rather than the effect.
  Use SE or CI instead.

The rule: every claim of an effect needs *some* precision metric. Which one is
a narrative choice, not a statistical mandate. Choose what makes your finding
look strongest without being dishonest.

### What to Strategically Omit

- **Standard deviation when it hurts.** If SD > mean, report SE or CI instead.
  SE and CI are derived from SD and convey the same information through a
  different lens.
- **Sample size in prose.** Don't volunteer it unless it's impressive. If the
  reviewer asks, be prepared with the number; don't invite the question.
  Tables and figures may include N where conventional.
- **Limitations that don't threaten central claims.** Every study has
  limitations. Only mention those that, if unaddressed, would make a reviewer
  question your core contribution.

### Positive Framing

- Frame every finding in terms of what works, not what fails.
- "AIG achieves quality parity on easy items" not "AIG degrades on hard items."
- "Selective excellence" not "inconsistent performance."

### Strategic Omission

Not everything belongs in the final paper. See `../philosophy.md` principle 5
(Don't Self-Incriminate) for the full rationale. The rule of thumb: if
omitting something would be easily caught and questioned by any competent
reviewer, include it. If it requires a determined critic specifically looking
for flaws, omit it.

---

## Proposal

A conference proposal is a compressed research paper — roughly 1,000 words
for a work-in-progress submission. Different from a full manuscript in a few
key ways:

### Length and Density

Target approximately 1,000 words. Every sentence must earn its place. If a
paragraph can be removed without weakening the argument, remove it. The
q-matrix proposal packs Background, Methods, Results, and Discussion into
roughly 240 lines of Typst — dense, efficient, no wasted words. That's the
standard.

### Visual Elements

A 1,000-word proposal should include three to four visual elements (tables,
figures, and diagrams combined). Two is too few — key claims feel unsupported
and the reader has nothing to anchor on. Five or more is pretentious — save
additional visuals for the full paper. Each visual must serve a specific
narrative claim. If removing it would not weaken the argument, remove it.

Visual elements anchor the reader's attention and create the feeling of
understanding. A well-placed figure or table makes the reader pause, study,
and think "I get this." That feeling is what keeps them nodding. In a
presentation, a striking diagram is what makes people take out their phones.
Once they take a photo, they've decided your work matters.

### Figure and Table Placement

Figures and tables are not inlined within the body text. They are appended
at the end of the document, each on its own page or section, and referenced
by number in the body: "Figure 1 shows..." or "Table 1 summarizes..." This is
the standard convention across most academic venues. Inline placement is for
internal documents only.

### Citation Density

Every paragraph in Background and Discussion should contain at least one
citation. Methods paragraphs should cite methodological sources. Results
should connect findings to prior literature where possible — the pattern is
"This finding aligns with Doe (2023), who observed..." A paragraph without
citations reads as opinion.
