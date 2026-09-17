# Handling `.docx` Format

Sometimes we have to use Microsoft Word to deliver or receive a manuscript. The
proprietary `.docx` format is notorious for machine readability; this module is
the tooling for the nlpatch cycle's Word boundary.

## Read

- Convert with `pandoc` to HTML; split the HTML into multiple files by heading
  tag when large.
- Use the `--track-changes` flag to include revision marks. This is how a
  revised manuscript from an advisor or colleague arrives: `--track-changes all`
  shows every revision someone made; `--track-changes accept` yields the clean
  accepted version we work on (accept-by-default is the nlpatch rule).
- For Typst syntax conventions and common pitfalls, read the **typst** skill.
