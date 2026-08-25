---
name: literature
description: Literature search, validation, and management -- Perplexity-first search, Zotero records, claim verification with supporting passages. Use for literature searches, citation checks, or maintaining notes/literature.md.
---

# Literature

This skill describes managing literature (research papers).

## Context Management

Literature work involves extensive reading of papers, which can clutter context
significantly. **Delegate literature tasks to a subagent** unless:

- It is a quick lookup (single paper metadata, citation count)
- The current session is primarily focused on literature work

## External Deep Search (Perplexity)

For broad literature discovery, use Perplexity as the first pass. This offloads
the heavy searching to an external tool so agents can focus on verification.

**Workflow:**

1. **Agent drafts a comprehensive search prompt.** The prompt must contain:
   - The research context: what problem we're working on, what stage we're at
   - Specific search objectives: exactly what kinds of papers are needed and why
   - Output requirements: the table format below, baked into the prompt

2. **User runs the prompt** in Perplexity and forwards the report back.

3. **Agent validates the report against Zotero**, distinguishing:
   - Papers already in the project collection
   - Papers in the Zotero library but not in the collection
   - Papers not in the library at all

4. **Agent returns a refined table** with a status column showing which papers
   actually need to be added. The user then imports via the browser extension.

### Report Table Format

Every report to the user (both the Perplexity prompt output and the
post-validation refined table) uses this format:

```markdown
| # | Title | Year | Authors | Venue | URL/DOI | One-sentence relevance |
|---|-------|------|---------|-------|---------|------------------------|
| 1 | ...   | 2025 | ...     | ...   | ...     | What it supports ...  |
```

The refined table after Zotero validation adds a status column:

```markdown
| # | Title | Year | Authors | Venue | URL/DOI | Relevance | Status |
|---|-------|------|---------|-------|---------|-----------|--------|
| 1 | ...   | 2025 | ...     | ...   | ...     | ...       | in collection / in library / needs adding |
```

## Zotero Workflow

We use Zotero MCP tools for all literature operations. Tools have built-in
descriptions -- this section covers conventions, not capabilities.

**Hard blocker:** If the Zotero MCP is unreachable (connection refused, desktop
not running), do NOT proceed with Zotero-dependent steps. Surface the blocker to
the user and stop. Do not improvise around it (e.g., skipping the
already-in-library check) -- duplicates and missing items are costly to fix
later. The user may choose to scratch the requirement, but the agent does not
decide that on its own.

### Discovery

- Use short, simple queries: "Author Year" (e.g., "Brewer 2011")
- Each additional word **narrows** the match, not broadens it
- For topic exploration, `semantic_search` is better than keyword search
- Browse collections and tags for curated lists
- For papers not in Zotero, use web search (Tavily) to find candidates

### Triage Before Import

Before asking the user to add any paper, verify it supports the claim you want
to make. Getting this wrong is costly -- the user does manual import, and you
waste a citation slot on a paper that undermines your argument.

- **Read abstracts first** via `get_item_metadata` or web search snippets
- **Check the paper's actual conclusion**, not just isolated excerpts. A paper
  whose overall finding is positive cannot be cited for a limitation claim.
- **Verify the evidence type**: peer-reviewed journal vs arXiv preprint vs
  technical report. Prefer journal articles. Note arXiv status as a caveat.
- **Check the model and year**: a 2024 finding about GPT-3.5 is weaker than a
  2025 finding about GPT-4. Frame accordingly.
- **Qualify model-dependent claims**: "LLMs fail at X" is different from "three
  of five LLMs fail at X." The latter is accurate; the former is misleading.

**After triage, report to the user** with paper title, authors, venue, URL/DOI,
and a one-sentence summary of what it supports. Do not use MCP to add papers
yourself -- the browser extension produces better results.

### Adding Papers (User Does This)

The MCP tools (`add_by_doi`, `add_by_url`) produce unreliable results:
incorrect item types (webpage instead of conferencePaper), missing PDFs, bare
URLs as titles, and incomplete author metadata. The Zotero browser extension
with institutional login is the correct import path.

**Workflow:**
1. Agent searches Zotero + web, triages candidates by reading abstracts
2. Agent reports promising papers to the user: title, authors, venue, URL
3. User imports via browser extension (clean metadata, institutional PDF access)
4. User signals when done

### Post-Import Verification (Agent Does This)

After the user imports papers, the agent must verify:

1. **Correct collection.** Check `zotero_search_collections` to find the right
   project collection. Never assume a collection key -- verify what it maps to.
2. **Correct item type.** If the type is "webpage" for a conference paper or
   journal article, fix with `zotero_update_item`. Use the `item_type` field.
3. **Complete metadata.** Check title, authors, date, and venue. If metadata is
   incomplete (common for reports and web imports), use `zotero_read_pdf_pages`
   to extract from the title page.
4. **PDF attached.** Use `zotero_get_item_children` to verify a PDF exists.
5. **No duplicates.** Use `zotero_find_duplicates` scoped to the project
   collection. Merge old items into new using `zotero_merge_duplicates` (dry run
   first, then confirm). Keep the browser-imported version as keeper.
6. **Update notes.** After merging, update `notes/literature.md` with the
   correct Zotero keys.

### Reading

- Get abstracts first via `get_item_metadata` to assess relevance
- Use `read_pdf_pages` for targeted extraction -- specify page ranges
- `get_pdf_outline` works only if the PDF has embedded TOC metadata
- `get_annotations` retrieves your highlights for efficient review

### Claim Verification (Agent Does This)

**Every paper we plan to cite gets claim verification.** There is no
"abstract-only citation" for a paper that will appear in the manuscript --
before a paper enters the citation plan, the agent extracts the supporting
passage for the specific claim it supports. For each candidate paper:

1. **Locate the exact sentence(s).** Use `read_pdf_pages` to target the relevant
   section (e.g., theorem statement, results paragraph). Do not cite from
   memory or from the abstract alone when making a specific factual claim.

2. **Record the passage as a block quote.** Include the verbatim text, the page
   number, and the section/theorem number. Store this either in the internal
   report (if the claim appears there) or in `notes/literature.md` (in the
   verification status column or a dedicated "Supporting Passages" section).

3. **Minimum standard for key claims.** Every claim that a reviewer might
   challenge -- formulas, theorems, complexity bounds, expected values --
   requires a supporting passage. Background context and general knowledge
   (e.g., "Euler's formula is V - E + F = 2") does not.

4. **If the passage is ambiguous or missing.** Flag it. A paper whose abstract
   seems to support a claim may state something different in the body. Better
   to discover this during verification than during review.

Format example:

> "Any triangulation of a set P of n points in the plane -- not all collinear,
> and with k points on the convex hull -- has 2n - 2 - k triangles and 3n - 3 - k
> edges." -- de Berg et al. (2008), Theorem 9.1, p. 193

This step is not optional for quantitative claims. It is the only mechanism
that builds confidence when neither author nor reviewer can re-derive the
result independently.

### Citation Analysis

- `scite_enrich_item` and `scite_enrich_search` -- **no API key required**
- Check retractions before citing: `scite_check_retractions`
- Scite may be intermittently unavailable (transient, retry later)

## Documentation

Keep a `notes/literature.md` (or `notes/literature/literature.md`) with:

- **Proposal citation plan**: which papers are cited, in which paragraph, for
  what claim. This is the single source of truth during drafting.
- **Full inventory**: all papers reviewed, grouped by relevance, with Zotero
  keys. Mark which are cited vs backup vs dropped (with reasons).
- **Decision log**: why papers were dropped or qualified. Prevents re-litigating
  the same decision later.
- **Verification status**: which papers have been inspected (abstract only vs
  full text) and whether claims are confirmed. For claims confirmed by full
  text, include the supporting passage as a block quote with page number.

Not every paper goes in the note -- only those relevant to your narrative.

## Caveats and Gotchas

- **Search narrows with more words**: Adding terms reduces results
- **MCP add-by-DOI is flaky**: CrossRef SSL errors are common. Do not retry
  endlessly -- hand off to the user for browser import.
- **"webpage" is a bad default type**: Any paper added by URL gets type
  "webpage." Always check and fix post-import.
- **Never assume collection keys**: `V2YHYTDY` might be "aig-diversity," not
  your project. Verify before adding.
- **PDF outlines are optional**: Not all PDFs have them
- **Attachment paths vary**: WebDAV/cloud items may not return local paths
- **Full text is heavy**: 10K+ tokens; use page ranges
- **Perplexity summaries can be misleading**: Always verify the paper's actual
  conclusion, not just the excerpts Perplexity highlights. Chan et al. (2025)
  was summarized as documenting errors but actually concludes CoT prompting
  *solves* quality problems.
