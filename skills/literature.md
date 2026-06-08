# Literature

This skill describes managing literature (research papers).

## Context Management

Literature work involves extensive reading of papers, which can clutter context
significantly. **Delegate literature tasks to a subagent** unless:

- It is a quick lookup (single paper metadata, citation count)
- The current session is primarily focused on literature work

## Zotero Workflow

We use Zotero MCP tools for all literature operations. Tools have built-in
descriptions — this section covers conventions, not capabilities.

### Discovery

- Use short, simple queries: "Author Year" (e.g., "Brewer 2011")
- Each additional word **narrows** the match, not broadens it
- For topic exploration, `semantic_search` is better than keyword search
- Browse collections and tags for curated lists
- For papers not in Zotero, use web search (Tavily) to find candidates

### Triage Before Import

Before asking the user to add any paper, verify it supports the claim you want
to make. Getting this wrong is costly — the user does manual import, and you
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
yourself — the browser extension produces better results.

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
   project collection. Never assume a collection key — verify what it maps to.
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
- Use `read_pdf_pages` for targeted extraction — specify page ranges
- `get_pdf_outline` works only if the PDF has embedded TOC metadata
- `get_annotations` retrieves your highlights for efficient review

### Citation Analysis

- `scite_enrich_item` and `scite_enrich_search` — **no API key required**
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
  full text) and whether claims are confirmed.

Not every paper goes in the note — only those relevant to your narrative.

## Caveats and Gotchas

- **Search narrows with more words**: Adding terms reduces results
- **MCP add-by-DOI is flaky**: CrossRef SSL errors are common. Do not retry
  endlessly — hand off to the user for browser import.
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
