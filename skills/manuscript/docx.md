# Handling `.docx` Format

Sometimes we have to use Microsoft Word to deliver or receive a manuscript. The
proprietary `.docx` format is notorious for machine readability. This skill
module explains how to handle it.

## Read

- To read a `.docx` document, we use `pandoc` to convert it into HTML.
- Depending on the size of the resulting HTML, you may want to split the HTML
  multiple files via heading tag.
- You may want to use the `--track-changes` flag to include the revision notes.
  This is especially helpful when the document is a revised manuscript sent from
  advisor or colleague. `--track-changes all` helps you see all the revisions
  someone made; `--track-changes accept` is helpful for creating a clean
  starting point to work on since we default to accept advisor's all revisions.

## Write

In general, we never intend to write a `.docx` file via XML directly. We may
need to convert from other formats.

If the source draft is in Typst, also read `../typst.md` for syntax conventions
and common pitfalls.

<!-- TODO: Typst to docx -->
