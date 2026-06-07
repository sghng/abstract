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

## Formatting

Academia is dominated by oldies who don't want to change. Your formatting
should be so conservative it's boring. No creativity. No flair. No
"readability improvements." Just the dullest, most conventional formatting you
can manage. If it feels like you're formatting a document from 1995, you're
doing it right.

### Headings

- **H1 (`#`) is the title.** There is exactly one title per document. It's
  always appropriate — even in personal statements, cover letters, and
  narrative documents — because every document has a title.
- **H2 (`##`) is for major sections.** You can have as many as you need.
- **Minimize H3 (`###`).** Only use when genuinely necessary.
- **Avoid H4 (`####`) completely.** If you need four levels of headings, your
  structure is too nested. Flatten it.

When the submission guidelines explicitly ask for sections (Background,
Methods, Results, Conclusions), use H2 for those. They're the expected
scaffolding. But if you're writing a personal statement or cover letter —
something that's fundamentally a story — don't rely on headings to do the
work. Prose flow and paragraph logic should carry the reader, not a heading
every three paragraphs.

### No Bolded Text

Never use bolded text in paragraphs. Not for emphasis, not for structure, not
for "improving scannability." Academia has survived centuries without bold —
it'll survive your paper too.

In particular, **never use bolded labels at the start of paragraphs** like
this:

```
**Background.** This study examines...
**Methods.** We collected data...
**Results.** The findings show...
```

This pattern screams "AI-generated" to anyone who's seen ChatGPT output, and
academia is absolutely AI-phobic right now. Even if it genuinely improves
readability (and it does), the convention is against you. Write normal prose
transitions instead.

### No Bullet Points

Don't use bulleted or numbered lists in academic prose. Why? Nobody knows.
It's one of those unwritten rules that everyone follows and nobody questions.
Probably because bullet points feel like a slide deck, not a paper. Whatever
the reason, just follow the convention. Write paragraphs instead.

---

## Language

- Make the language feel human. No em-dash is allowed.
- Avoid AI-sounding constructions. If it reads like it could be copy-pasted
  from a GPT response, rewrite it.
- Sentence variety matters. Don't start three consecutive sentences the same
  way.
- Prefer active voice where it doesn't sound forced.

---

## Reporting Conventions

### What to Always Report

Every reported effect must be accompanied by a precision metric. Choose whichever
best supports the narrative from the following:

- **Standard error (SE).** Preferred when N is large and SD would appear
  inflated. SE = SD / sqrt(N), so it naturally accounts for sample size and
  shows the mean estimate is precise even when individual observations vary.
- **Confidence intervals.** The most honest metric; shows the plausible range
  directly. Especially effective for primary estimates.
- **p-values.** Required for any claim using the word "significant." Report
  the test statistic alongside.
- **Standard deviation (SD).** Only report when it helps the narrative (e.g.,
  showing tight clustering around the mean). If SD exceeds the mean on a
  bounded scale, it draws attention to variability rather than the effect.
  Use SE or CI instead.

The rule: every claim of an effect needs *some* precision metric. Which one is
a narrative choice, not a statistical mandate. Journal editors and reviewers
accept SE, CI, or SD interchangeably in most fields. Choose what makes your
finding look strongest without being dishonest.

### What to Strategically Omit

- **Standard deviation when it hurts.** If SD > mean, report SE or CI instead.
  Drug companies do this routinely; academic publishing permits it. You are not
  hiding anything — SE and CI are derived from SD and convey the same
  information through a different lens.
- **Sample size in prose.** Don't volunteer it unless it's impressive. If the
  reviewer asks, be prepared with the number, but don't invite the question.
  Tables and figures may include N where conventional.
- **Limitations that don't threaten central claims.** Every study has
  limitations. Only mention those that, if unaddressed, would make a reviewer
  question your core contribution.

### Positive Framing

- Frame every finding in terms of what works, not what fails.
- "AIG achieves quality parity on easy items" not "AIG degrades on hard items."
- "Selective excellence" not "inconsistent performance."
- "Models show consistent patterns" not "models have high variance."

### Strategic Omission

Not everything belongs in the final paper. See `../philosophy.md` principle 5
(Don't Self-Incriminate) for the full rationale. The rule of thumb: if omitting
something would be easily caught and questioned by any competent reviewer,
include it. If it requires a determined critic specifically looking for flaws,
omit it.
