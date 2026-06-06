# Literature

This skill describes managing literature (research papers).

<!-- TODO: details on literature note taking with Obsidian -->

Managing literature often involves extensive reading of papers, which can
clutter the context significantly. Therefore it's usually recommended to do
literature related tasks in a subagent, unless the current session is primarily
focusing on literature work.

A `notes/literature.md` should be used to keep literature related notes, such as
what each reference is about, which ones are more important, and how do they
relate to our research. No need to include every reference, it's mostly a
guidance on how references relate to our research. They should be grouped by
they way they relate to our project (e.g. background? methods? theory
foundation? research gap? etc.)

## Zotero

- We primarily use Zotero MCP tools to interact with literature.
- There is a known limitation on saving literature to Zotero via MCP. Therefore,
  you are allowed to call `perplexity`/`tavily` for literature search, but when
  you need to reuse them and feel like saving new items, give user a list of
  links so that user can add them manually.
