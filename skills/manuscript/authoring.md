# Manuscript Authoring

This skill module explains how to author a manuscript for academic publication.

> [!IMPORTANT]
> **Read `../philosophy.md` before continuing.** The principles there — the
> nodding reader, strategic optimism, big story first, don't self-incriminate —
> are the foundation of all manuscript writing.

## Prerequisites

Before drafting a manuscript, ensure:
- `story.md` is up to date with current findings
- Research question is clearly articulated
- Key facts are documented with supporting data

## Tooling

- We use Typst for the original drafting.
- For Typst syntax conventions and common pitfalls, also read `../typst.md`.
- Do not use Typst specific drawing utilities. Since eventually we export to
  Word, we will need to create plots from other places.
- It's important to use the Zotero MCP tools to understand the references.
  Sometimes, it's also helpful to do online literature search to find
  inspirations and supporting evidences. You may want to delegate this to a
  subagent focusing on literature task. Read more in `literature` skill module.

## Language

It's important to make the language feel more human. For example, no em-dash is
allowed!

## Formatting

Academia is dominated by oldies who don't want to change. Your formatting should
be so conservative it's boring. No creativity. No flair. No "readability
improvements." Just the dullest, most conventional formatting you can manage.

### No Bolded Text. Period.

Never use bolded text in paragraphs. Not for emphasis, not for structure, not
for "improving scannability." Academia has survived centuries without bold —
it'll survive your paper too.

In particular, **never use bolded labels at the start of paragraphs** like this:

```
**Background.** This study examines...
**Methods.** We collected data...
**Results.** The findings show...
```

This pattern screams "AI-generated" to anyone who's seen ChatGPT output, and
academia is absolutely AI-phobic right now. Even if it genuinely improves
readability (and it does), the convention is against you. Write normal prose
transitions instead.

### Heading Levels

- **H1 (`#`) is for expected section names.** If the submission guidelines
  explicitly ask for Background, Methods, Results, Conclusions — use H1. These
  are the scaffolding everyone expects.
- **H2 (`##`) is for subsections within those.**
- **Skip headings entirely in narrative documents.** Personal statements,
  application materials, cover letters — these are stories, not documentation.
  Using H1 in a personal statement makes it feel like a spec sheet, not a human
  being telling their story. Use prose flow and paragraph logic instead.

## Reporting Conventions

These conventions apply to all quantitative reporting in manuscripts and
proposals.

### What to Always Report

- **Standard deviations** alongside means. Reviewers will notice if they're
  missing, especially with large variance. Missing SD is a lethal omission.
- **p-values and effect sizes** for key claims. Statistical significance alone
  is insufficient — report both.
- **Confidence intervals** for primary estimates.

### What to Strategically Omit

- **Sample size in prose.** Don't volunteer it unless it's impressive. If the
  reviewer asks, be prepared with the number, but don't invite the question.
  Tables and figures may include N where conventional.
- **Limitations that don't threaten central claims.** Every study has
  limitations. Only mention those that, if unaddressed, would make a reviewer
  question your core contribution.

### Positive Framing

- Frame every finding in terms of what works, not what fails
- "AIG achieves quality parity on easy items" not "AIG degrades on hard items"
- "Models show consistent patterns" not "models have high variance"
- "Selective excellence" not "inconsistent performance"

### Strategic Omission

Not everything belongs in the final paper. See `../philosophy.md` principle 5
(Don't Self-Incriminate) for the full rationale. The rule of thumb: if omitting
something would be easily caught and questioned by any competent reviewer,
include it. If it requires a determined critic specifically looking for flaws,
omit it.

## Story-Driven Authoring

Story telling is the key to a paper. To ensure drafting and reviewing always
follow our story consistently, we maintain a `story.md` file.

**Read `../story-keeping.md` for the standard story.md format.**

### The Three-Act Structure Becomes Your Paper

| Story Section | Paper Section | Purpose |
|:--------------|:--------------|:--------|
| Act 1 (Hook) | Introduction | Establish the gap, why this matters |
| Act 2 (Approach) | Method | How we tackled the problem |
| Act 3 (Discovery) | Results + Discussion | What we found and what it means |

### Key Facts Become Your Contributions

Each item in the Key Facts section of `story.md` should map to a specific
contribution or result in the paper.

### Research Question Drives the Abstract

The abstract should clearly state the research question and preview the answer.

## Narrative Principles

> Writing a paper is like creating a TikTok short. The goal is to engage people,
> make the reader think they learn a lot, never raise their concern, you have to
> make them nod through all sections and think to themselves: "everything makes
> so much sense!"

### Start with the Big Story

As this advice (translated from Mandarin) emphasizes:

> 你会做 Project，但还是不太会讲故事。
>
> 讲故事和 Project 不同。讲故事一是要有清晰的主线，二是要有分层次。先讲大故事，再讲大故事下面的小故事。如果先讲大故事，比如 formative
> assessment，这是很多人都在研究的话题，很多读者就会觉得「这是我关注的东西，我得看一看」，接下来再讲小故事，那这些领域的人又会说「这是我做的领域呀，可以继续看」。这样，即使他们最后 lose
> track 了，也把文章看了百分之七八十。反之，如果先从小故事讲起，读者看到，就觉得「这不是我研究的问题」，就不会接着看下去了。做 Project 可以从细节开始，但讲故事，要从大故事开始讲起，这样读者才能更好理解你做这个研究的意义何在。

**Translation**: Start with the big picture (why this matters broadly), then
narrow to your specific contribution. Readers who care about the big topic will
stay engaged even if they lose track of the details.

## Drafting Workflow

1. **Consult story.md**: Review the current narrative
2. **Outline from three-act structure**: Map story sections to paper sections
3. **Draft section by section**: Focus on narrative flow
4. **Verify alignment**: Each section should serve the story
5. **Iterate with story updates**: Revise story.md if narrative evolves

## File Organization

- Draft files go in `draft/` directory
- Use descriptive names: `paper-v1.typ`, `proposal-v2.typ`
- Reference `story.md` status at top: `# Based on story.md as of [version]`
