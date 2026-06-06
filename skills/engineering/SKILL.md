# Engineering

This skill describes the engineering aspect of academic research. This skill is
relevant to:

- Preferred tech stack.
- How to run experiments.
- Conventions of file organization for code.
- Plotting diagrams for publication or report.
- Writing experiment reports.

## Directory Convention

- `src/`: the code that is heavily reusable across multiple experiments. e.g.
  the core code.
- `scripts/`: one-off generic scripts.
- `experiments/`: the most important directory, where experiments are run.

## Experiment

- An experiment looks like `experiments/01-name_of_the_experiment/`. Each
  experiment has its own folder.
- All experiment related content will be inside this folder. Including code,
  results, and report.
- When user wants to start a new experiment (or when you think an experiment is
  needed), create a new experiment directory with incremented experiment id to
  work on.
- Almost all experiments will come with an report. The report should usually
  include:
  - What this experiment is about.
  - Why we did this experiment.
  - How this experiment relates to previous experiments, e.g. is it extending
    from another one? compliments another one? fixes another one?
  - What are the things we did.
  - What does the result look like, and their implications.
  - What are the next steps that we can do.

There are a few more considerations needed for data and code in experiment:

- We usually put all code and data in the experiment directory.
- However, if we foresee some code/data will be reused over and over by multiple
  experiments, or they become the core of a project, we should extract them into
  `data/` and `src/`.

Additionally, you should keep extensive inline documentation of code. This is
not just explaining how the code is written, it's also about why we do them. For
example, documenting the purpose clearly in the source file, commenting why a
certain choices is made, how it contribute to the experiment, and if needed,
include references via a Zotero cite key, if the idea is borrowed from a paper.
You may want to consult literature module for this.

## Preferred Tech Stack

Unless overridden by repo specific rule, we prefer these tech choices.

- Prefer Python for data analysis. We always use latest Python via `uv`. Usually
  there will be a virtual environment at project root (`.venv`).
- If we need to use JavaScript/TypeScript, we use Bun.
- Avoid using R, but if you have to, try to call the specific R package from
  Python, so that the logic in R is minimized.
- It's okay to use multiple languages, as long as we're using the best of
  different languages.
- Prefer using existing frameworks. Do not reinvent the wheels. When in doubt,
  perform online search to find latest options. Always discuss framework choices
  with user before adopting one.
