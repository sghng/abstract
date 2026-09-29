---
name: typst
description:
  Typst syntax guidance, common mistakes, and math typesetting. Use whenever
  writing or reviewing Typst source or mathematical notation.
---

# Typst

This file records cross-module guidance on Typst. Read this whenever you write
or review Typst source.

## Math

- We prefer using Typst for writing any math. The syntax of Typst is different
  from LaTeX.
- When doing extensive math derivations, it's helpful to compile a Typst
  document to images, then read the images and check whether the derivation
  renders as intended.

## Syntax Notes and Common Mistakes

- Typst is not LaTeX. Do not write LaTeX commands with backslashes.
- In Typst, commands and functions usually start with `#`.
- Use `[]` content blocks and Typst functions, not LaTeX environments like
  `\begin{}` and `\end{}`.
- Math is written in `$...$`, but inner syntax still follows Typst style. Do not
  assume LaTeX macros exist.
- If you are unsure about syntax, check Typst docs and package docs before
  proceeding.

## Package Policy

- We always use the latest package versions.
- Typst has no global package environment. The version in the import line
  (e.g. `#import "@preview/touying:0.7.4"`) is the declaration; the compiler
  fetches exactly that version on demand. A locally cached older version is
  irrelevant — never pin to what happens to be cached, and never blame the
  cache for an API mismatch: a mismatch means you pinned the wrong version
  while recalling a different one's API. Import the current documented
  version, and check its documentation for that version.
- We only use featured packages from Typst Universe:
  <https://typst.app/universe/search/?kind=packages&featured>
- You are encouraged to use packages when they are helpful. However, always
  clear a new package with the orchestrator (the user decides through the
  orchestrator), and keep a clear mind on what problem you are solving.
- Prefer existing packages over ad-hoc reimplementation when package behavior is
  a good fit for the task.
