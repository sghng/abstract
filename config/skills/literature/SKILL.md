---
name: literature
description:
  Literature operations - Zotero conventions, triage and the import relay,
  reading and claim-verification mechanics, notes/literature.md upkeep. Use for
  literature searches, citation checks, or maintaining notes/literature.md.
---

# Literature

Zotero operations and the reading workflow. The verification standard (every
cited claim carries a verbatim supporting passage) is in your prompt; this skill
is the how.

## Context Management

Deep reading passes fill a context fast. For anything beyond a quick lookup,
delegate the reading to the `subagents/literature-review` agent and keep your
own session for queries, triage, and verification.

## Search

Search Zotero first: short simple queries ("Brewer 2011"; each added word
narrows the match), `semantic_search` for topic exploration, collections and
tags for curated lists. Papers not in Zotero: web search (the Tavily MCP) to
find candidates. Broad discovery passes over the project's `references/` corpus
go to `subagents/literature-review`.

**Hard blocker:** if the Zotero MCP is unreachable, do not improvise around it
(no skipping the already-in-library check); surface the blocker to the
orchestrator and stop. Duplicates and missing items are costly to fix later.

## Triage Before Import

Before proposing any paper, verify it supports the claim you want to make.

- Read abstracts first (`get_item_metadata` or web snippets), then the paper's
  actual conclusion, not isolated excerpts. A paper whose overall finding is
  positive cannot be cited for a limitation claim.
- Verify the evidence type: peer-reviewed journal over arXiv preprint over
  technical report; note preprint status as a caveat.
- Check model and year: a 2024 finding about GPT-3.5 is weaker than a 2025
  finding about GPT-4. Frame accordingly.
- Qualify model-dependent claims: "three of five LLMs fail at X" is accurate;
  "LLMs fail at X" is misleading.

## Import Relay

Import is a human action with the Zotero browser extension (clean metadata,
institutional PDF access). The MCP add tools (`add_by_doi`, `add_by_url`) are
unreliable: wrong item types, missing PDFs, bare URLs as titles. Never add
papers yourself.

1. Triage candidates, then report them to the orchestrator: title, authors,
   venue, URL/DOI, and a one-sentence statement of what each supports.
2. The user imports via the browser extension; the orchestrator cues you when
   the import is done.
3. Run post-import verification below.

## Post-Import Verification

1. **Correct collection.** Check `zotero_search_collections` for the project
   collection. Never assume a collection key; verify what it maps to.
2. **Correct item type.** "webpage" for a paper is the bad default; fix with
   `zotero_update_item` and the `item_type` field.
3. **Complete metadata.** Check title, authors, date, venue. If incomplete,
   extract from the title page with `zotero_read_pdf_pages`.
4. **PDF attached.** Verify with `zotero_get_item_children`.
5. **No duplicates.** `zotero_find_duplicates` scoped to the project collection;
   merge old into new with `zotero_merge_duplicates` (dry run first, then
   confirm), keeping the browser-imported version.
6. **Update notes.** Record the settled entries in `notes/literature.md` with
   their Zotero keys.

## Reading

- Abstracts first (`get_item_metadata`) to assess relevance.
- `read_pdf_pages` for targeted extraction; specify page ranges. Full text is
  heavy (10K+ tokens per paper).
- `get_pdf_outline` only works when the PDF has embedded TOC metadata.
- `get_annotations` retrieves existing highlights.

## Claim-Verification Mechanics

The standard (what needs a passage, flagging ambiguity) is in your prompt. The
mechanics:

1. **Locate the exact sentence(s)** with `read_pdf_pages` targeting the relevant
   section (theorem statement, results paragraph). Never cite from memory or the
   abstract for a specific factual claim.
2. **Record the passage as a block quote** in `notes/literature.md`: verbatim
   text, page number, section or theorem number.

Format:

> "Any triangulation of a set P of n points in the plane, not all collinear, and
> with k points on the convex hull, has 2n - 2 - k triangles and 3n - 3 - k
> edges." (de Berg et al. 2008, Theorem 9.1, p. 193)

## Citation Analysis

- `scite_enrich_item` and `scite_enrich_search` need no API key.
- Check retractions before citing: `scite_check_retractions`.
- Scite is intermittently unavailable; transient, retry later.

## notes/literature.md

One file, `notes/literature.md`, holding:

- **Citation plan**: which papers are cited, in which paragraph, for what claim.
  The single source of truth during drafting.
- **Inventory**: papers reviewed, grouped by relevance, with Zotero keys; cited
  vs backup vs dropped, with reasons.
- **Decision log**: why papers were dropped or qualified, so the decision is not
  re-litigated.
- **Verification status**: abstract-only vs full text, and for confirmed claims
  the supporting passage with page number.

Only papers relevant to the narrative go in; the rest stay in Zotero.

## Caveats and Gotchas

- More search words narrows; start short.
- MCP add-by-DOI is flaky (CrossRef SSL errors); never retry endlessly, the
  browser extension is the path.
- "webpage" is the bad default type for URL imports; always check and fix.
- Never assume collection keys: `V2YHYTDY` might be "aig-diversity," not your
  project.
- PDF outlines are optional; attachment paths vary under WebDAV.
- Search summaries mislead: verify the paper's actual conclusion, not the
  excerpts a search report highlights. Chan et al. (2025) was summarized as
  documenting errors but actually concludes CoT prompting _solves_ quality
  problems.
