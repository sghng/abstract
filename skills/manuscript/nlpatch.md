<!-- markdownlint-disable line-length  -->

# Natural Language Patch (NLPatch)

NLPatch is a plain-text, diff-inspired format for revising natural-language
documents. It is designed for **human review and manual application**, not
machine patching.

NLPatch is very useful when file formats that are not machine editable such as
Microsoft Word is used in the paper revision process. A typical use case is:

- You receive a revised document with tracked changes and comments.
- Delegate the `review-reader` subagent to extract and synthesize the feedback
  into NLPatch format. The subagent reads both the tracked-changes view
  (`pandoc --track-changes=all`) and the clean accepted-text view, groups
  atomic edits into semantic hunks, and extracts comments.
- You review the NLPatch, discuss changes, and decide what to implement.
- The NLPatch is then manually applied to the document (e.g. in Microsoft Word)
  by a human.

## Specification

- A file consists of one or more **hunks**.
- Each hunk begins with a semantic header. Since this file is for human, not
  machine, the hunk header is also in natural language.

```diff
@@ Abstract @@
@@ Method > Neural Networks > Math @@
```

- Line prefixes:
  - context line: no prefix or optional leading space
  - `-` removed/replaced text
  - `+` added/replacement text
  - `#` brief rationale for the hunk
  - `>` review comment block
- Changes should mark only the wording that changes.
- Unchanged text may be factored out into context lines.
- Multiple related edits in one subsection may be grouped into a single hunk.

An example looks like this:

```diff
# We swap brown fox and lazy dog.

A quick
- brown fox
+ lazy dog
jumps over a
- lazy dog
+ brown fox.

# More changes...
```

INSTEAD OF:

```diff
- A quick brown fox jumps over a lazy dog.
+ A quick lazy dog jumps over a brown fox.
```

We extract/factor out the context line, so that the user can apply NLPatch with
clean tracked changes.

A review comment block starts with a quoted raw text where the comment is
attached to, following by the content of the comment. User will manually attach
this to the document. You may want to use comment block to give notes to other
colleagues/advisor on things you're not sure, or reply to their review.

```diff
> "raw text goes here"
>
> comment goes here
```

IMPORTANT: since NLPatch is for human, not machine, you should NOT split lines.
Even if a line added or a comment is long, you don't split them into multiple
lines. Otherwise, when user copy the addition, they will copy several line
prefixes.

Use `#` prefix wisely to explain the rationale. This is important for user to
validate the patch and for other agents to understand.

## Example

```diff
@@ Method > Participants @@

# Improve reporting precision by distinguishing enrollment, outcome
# availability, and assignment procedure.

Participants were undergraduate students recruited from a large public
university. A total of 180 students
- participated in the study.
+ were enrolled in the study; 172 provided complete outcome data at posttest. Participants were randomly assigned
- to the intervention or control group.
+ in a 1:1 ratio to the intervention or control condition.

# responding to advisor's comment, because...

> "172 provided complete outcome data at posttest"
>
> Consider also reporting attrition by condition and whether dropout was associated with baseline covariates or outcome-relevant variables.
```
