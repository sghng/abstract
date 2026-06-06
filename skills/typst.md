# Typst

This file records cross-module guidance on Typst. Read this whenever you write
or review Typst source.

## Syntax Notes and Common Mistakes

- Typst is not LaTeX. Do not write LaTeX commands with backslashes.
- In Typst, commands and functions usually start with `#`.
- Use `[]` content blocks and Typst functions, not LaTeX environments like
  `\begin{}` and `\end{}`.
- Math is written in `$...$`, but inner syntax still follows Typst style.
  Do not assume LaTeX macros exist.
- If you are unsure about syntax, check Typst docs and package docs before
  proceeding.

## Package Policy

- We always use the latest package versions.
- We only use featured packages from Typst Universe:
  https://typst.app/universe/search/?kind=packages&featured
- You are encouraged to use packages when they are helpful. However, always
  communicate with user before adopting a package, and keep a clear mind on what
  problem you are solving.
- Prefer existing packages over ad-hoc reimplementation when package behavior is
  a good fit for the task.
