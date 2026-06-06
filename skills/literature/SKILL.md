# Literature

This skill describes managing literature (research papers).

## Overview

Literature management involves extensive reading of papers, which can clutter
context significantly. **Recommendation**: Delegate literature tasks to a
subagent unless it's a quick lookup or the current session is primarily focused
on literature work.

## Zotero MCP Tools

We use Zotero MCP tools for all literature operations.

### Discovery and Search

**Search items** (`search_items`):
- Search by title, author, year, or abstract content
- Use short, simple queries: "Author Year" (e.g., "Brewer 2011")
- Each additional word narrows the match, not broadens it

**Advanced search** (`advanced_search`):
- Multi-field queries: keyword + itemType + date ranges
- Example: itemType = "preprint" AND date > "2024-01-01"

**Browse collections** (`get_collections`, `get_collection_items`):
- Navigate hierarchical collections
- Access curated reading lists

**Search by tag** (`search_by_tag`):
- Find papers by topic tags
- Boolean: use "OR" for alternatives, "-" for exclusions

**Search notes** (`search_notes`):
- Search across all highlights and annotations
- Find where you discussed specific concepts

### Reading and Understanding

**Get metadata** (`get_item_metadata`):
- Retrieve title, authors, abstract, DOI, citation info
- Formats: markdown (default), JSON, BibTeX
- Always includes abstract for assessing relevance

**Read PDF pages** (`read_pdf_pages`):
- Extract text from specific page ranges
- Returns full content (can be 10K+ tokens for large papers)
- Use with restraint; extract only needed pages

**Get PDF outline** (`get_pdf_outline`):
- Extract table of contents/bookmarks from PDF
- Only works if PDF has embedded outline metadata
- Returns hierarchical section list with page numbers

**Get annotations** (`get_annotations`):
- Retrieve highlights and attached notes from PDFs
- Filter by parent item or search across library

### Citation Analysis

**Scite enrichment** (`scite_enrich_item`):
- Get citation counts: supporting, contrasting, mentioning
- Check for retraction notices
- **No API key required** — uses free public endpoints
- May occasionally be unavailable (transient network issues)

**Check retractions** (`scite_check_retractions`):
- Scan collections or tags for retracted papers
- Vet reading lists before citing

### Adding Literature

**By DOI** (`add_by_doi`):
- Cleanest metadata; resolves via CrossRef
- Use as first choice when DOI is available

**By URL** (`add_by_url`):
- arXiv: gets metadata + PDF
- DOI URLs: treated as DOI
- General URLs: creates webpage item (avoid for citations)

**By BibTeX** (`add_by_bibtex`):
- Bulk import from .bib files
- Preserves citation keys in Extra field

## Caveats and Gotchas

### Search Behavior

- **Search narrows with more words**: Adding terms reduces results, not expands
- **Author-year format works best**: "Smith 2020" better than full title
- **Fallback semantics**: If search finds nothing, tool auto-falls back to
  simplified queries

### PDF Handling

- **Outline extraction requires metadata**: Many PDFs lack embedded TOC
- **Attachment paths depend on storage mode**: WebDAV/cloud-stored items may
  not return local paths
- **Full text extraction is heavy**: `read_pdf_pages` returns entire content;
  use page ranges to limit

### Scite Integration

- **Free but public**: Uses Scite's public endpoints; no key needed
- **Transient failures occur**: "Could not reach Scite API" — retry later
- **Limited to cited papers**: Only papers with DOIs get Scite data

### Semantic Search

- **Requires setup**: Needs Better BibTeX plugin + embedding provider config
- **Not available by default**: Check `get_search_database_status` first
- **Update required**: Run `update_search_database` after adding new items

### Context Management

- **Delegate heavy tasks**: Full-text reading, multi-paper searches, annotation
  reviews should be subagent tasks
- **Quick lookups stay inline**: Author names, single paper metadata, citation
  counts

## Documentation

Keep a `notes/literature.md` with:
- Key papers grouped by relevance (background, methods, gaps, etc.)
- How each reference relates to your research
- Not every reference — just those that matter to your narrative

## Adding Papers

When you need to save new items:
- Use `add_by_doi` for clean metadata
- `add_by_url` for arXiv or DOI links
- Avoid generic URLs — they create "webpage" items, not proper citations
- For bulk import: provide BibTeX via `add_by_bibtex`

**Note on saving**: MCP has limitations on directly saving to Zotero. If saving
fails, provide user a list of DOIs/URLs to add manually.
