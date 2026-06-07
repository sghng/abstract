# Literature

This skill describes managing literature (research papers).

## Context Management

Literature work involves extensive reading of papers, which can clutter context
significantly. **Delegate literature tasks to a subagent** unless:

- It's a quick lookup (single paper metadata, citation count)
- The current session is primarily focused on literature work

## Zotero Workflow

We use Zotero MCP tools for all literature operations. Tools have built-in
descriptions — this section covers conventions, not capabilities.

### Discovery

- Use short, simple queries: "Author Year" (e.g., "Brewer 2011")
- Each additional word **narrows** the match, not broadens it
- For topic exploration, `semantic_search` is better than keyword search
- Browse collections and tags for curated lists

### Reading

- Get abstracts first via `get_item_metadata` to assess relevance
- Use `read_pdf_pages` for targeted extraction — specify page ranges
- `get_pdf_outline` works only if the PDF has embedded TOC metadata
- `get_annotations` retrieves your highlights for efficient review

### Citation Analysis

- `scite_enrich_item` and `scite_enrich_search` — **no API key required**
- Check retractions before citing: `scite_check_retractions`
- Scite may be intermittently unavailable (transient, retry later)

### Adding Papers

- **By DOI**: Cleanest metadata; use as first choice
- **By URL**: Works for arXiv and DOI links; avoid generic URLs
- **By BibTeX**: For bulk import

## Caveats and Gotchas

- **Search narrows with more words**: Adding terms reduces results
- **Metadata depends on source**: "webpage" items from generic URLs cannot be
  cited properly
- **PDF outlines are optional**: Not all PDFs have them
- **Attachment paths vary**: WebDAV/cloud items may not return local paths
- **Full text is heavy**: 10K+ tokens; use page ranges
- **Semantic search needs setup**: Requires Better BibTeX + embedding config
- **Saving limitations**: MCP sometimes can't save to Zotero; if so, provide
  user a list of DOIs/URLs to add manually

## Documentation

Keep a `notes/literature.md` with:
- Key papers grouped by relevance (background, methods, gaps, etc.)
- How each reference relates to your research
- Not every reference — just those that matter to your narrative
