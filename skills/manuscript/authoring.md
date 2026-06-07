# Manuscript Authoring

This skill module covers the **workflow** of authoring a manuscript for
academic publication — the process from blank page to submission-ready draft.

> [!IMPORTANT]
> Before you write a single word, read two files:
> - **`../philosophy.md`** — the research mindset: nodding reader, strategic
>   optimism, big story first, publication first, don't self-incriminate.
> - **`../writing.md`** — the concrete writing conventions: headings, bold
>   text prohibition, bullet point prohibition, language rules, reporting
>   conventions, positive framing. These apply to all external deliverables.

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
- Use Zotero MCP tools to manage references. You may want to delegate
  literature search to a subagent. Read more in `literature` skill module.

## Story-Driven Authoring

Story telling is the key to a paper. To ensure drafting and reviewing always
follow our story consistently, we maintain a `story.md` file. See
`../story-keeping.md` for the standard format.

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
See `../writing.md` for formatting rules (no bolded labels, heading
conventions, etc.).

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
