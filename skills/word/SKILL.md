---
name: word
description: >-
  Word interop for the lab's manuscripts: exporting Typst to Word through
  typ2docx, and the NLPatch round-trip for tracked-changes DOCX files from
  collaborators. Use when converting a draft to docx, when an edited DOCX
  with tracked changes or comments arrives, when preparing a response patch
  to apply in Word, or when reviewing a manuscript whose source the lab does
  not own.
---

# Word

Word enters the lab at three points: a deliverable goes out as a docx, a
collaborator returns a tracked-changes DOCX, and a response goes back as
visible edits a human applies in Word.

## Export: Typst to Word

`abstract typ2docx <file.typ>` in the old harness was the command; in the
skills setup, run the converter directly from the abstract repo:

```bash
bun ~/dev/abstract/typ2docx/cli.ts <file.typ>
```

The docx lands beside the source. House policy: every table and figure
floats; the Word style lives in the reference stock (built fresh from the
patch series in `tools/` on every conversion), never in the Typst source.
Revision highlighting uses Typst `#highlight` regions, rendered with the
default yellow pen. The converter's full doctrine and failure modes live in
`docs/typ2docx.md` in the abstract repo; read it before changing the
converter or debugging a layout defect.

## The NLPatch Round-Trip

NLPatch is a plain-text, diff-inspired format for revising natural-language
documents. It exists for human review and manual application in Microsoft
Word, not machine patching.

External edits land as `draft/<artifact>-vN-<name>_edit.docx`; the parsed
form is `draft/<artifact>-vN-<name>_edit.patch`. The underscore marks foreign
provenance. The patch keeps the version of the document it parsed; versions
advance only when feedback is incorporated into the source.

The Word tooling (pandoc conversion, the track-changes flags) lives in
`references/docx.md`.

### Ingress: Reading External Edits

Delegate the `nlpatch` sidekick with the DOCX path and the output patch
path. It extracts faithfully, without interpreting intent. Then:

1. Read the patch. Add `#` rationale to each hunk: what the editor wants and
   why.
2. Agree dispositions with the primary session. Accept is the default;
   rejections carry the burden of proof.
3. Bump the source and derive the response patch (below).

Accept-by-default has an operational meaning: build
`draft/<artifact>-v(N+1)` on the accepted baseline of the `_edit.docx`
(ingress can emit it), never on vN. A rejected edit keeps the original
wording in the source and resurfaces as a reverse hunk in the response
patch: that hunk is how the editor sees the rejection.

### Egress: Responding to External Edits

Never author in patch format: the source is the medium, the patch is a
derived view. The source reaches `draft/<artifact>-v(N+1)` on the accepted
baseline; then:

1. Crude patch: word-diff the accepted baseline against the new version's
   rendered text. The baseline regenerates mechanically:
   `pandoc --track-changes=accept` on the `_edit.docx`. Diff rendered text,
   never raw Typst source; syntax noise must not leak into hunks.
2. Delegate the `nlpatch` sidekick in refine mode with the crude patch and,
   optionally, the target document path.
3. Fill any `# [MISSING RATIONALE]` flags, then hand the patch to the user,
   who applies it in Word manually.

### Foreign Manuscripts

When the lab reviews a manuscript whose source it does not own (journal
review), the patch is the deliverable: compose it hunk by hunk against the
document text, per the specification below. Delegate the sidekick to refine
it before delivery.

### Specification

- A file consists of one or more **hunks**.
- Each hunk begins with a semantic header. Since this file is for humans,
  not machines, the hunk header is also in natural language.

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
- Multiple related edits in one subsection may be grouped into a single
  hunk.
- Factor context so the reader sees the delta, not the paragraph:

```diff
# We swap brown fox and lazy dog.

A quick
- brown fox
+ lazy dog
jumps over a
- lazy dog
+ brown fox.
```

INSTEAD OF:

```diff
- A quick brown fox jumps over a lazy dog.
+ A quick lazy dog jumps over a brown fox.
```

- A review comment block starts with the quoted raw text the comment
  attaches to, followed by the comment. The user attaches it in Word
  manually. Use it for notes to colleagues or advisors, or to reply to their
  review.

```diff
> "raw text goes here"
>
> comment goes here
```

- **Never split a line.** However long an addition or comment, it stays one
  unbroken line. A wrapped `+` line pastes into Word as multiple prefixed
  fragments and becomes unusable.
- Use `#` freely: the rationale lets the user validate the patch and other
  agents understand it.

### Example

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
> Consider also reporting attrition by condition and whether dropout was
> associated with baseline covariates or outcome-relevant variables.
```

Note: the long `+` line above is deliberately unbroken; see the no-split
rule. When composing patches for our own artifacts, prefer the derived
egress flow; hand composition is for foreign manuscripts.

### Synchronization

The operative spec is mirrored, condensed, in `agents/nlpatch.md` so the
sidekick is self-contained. Keep the two in sync.
