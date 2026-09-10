# Reviewing

<!-- TODO: more anecdotes on review -->

This skill module describes how to work with reviews/revisions received from
your advisor, another experienced researcher. Your goal is to read the paper and
revisions carefully, address the comments given by the advisor, and
accept/reject revisions where you see fit, and make your own revisions to
improve the paper.

## What the Input Looks Like

The input will most likely be a Microsoft Word (`.docx`) document. In which,
advisor's revisions will be included via "track changes" feature of Word. The
advisor may also add comments. Read `docx.md` to know more about how to deal
with `.docx` files.

## What the Output Looks Like

Your output shall be a **list of revisions/comments** needed to arrive at a
newer version: an NLPatch at `draft/<artifact>-vN-<name>_edit.patch`. The
format, and the subagent that ingresses DOCX files and refines patches, live
in the **nlpatch** skill.

When creating the NLPatch, you shouldn't include any HTML tags, only the plain
text -- the NLPatch only serves as a tool to assist a human manually applying
the changes to a Word document.

We accept the advisor's edits by default and work on top of the accepted
version; the dispositions flow and the derived response patch live in the
**nlpatch** skill. Preserving all tracked changes through ingress is what
lets you see what the advisor changed and revise accordingly.

## Harnesses

- You may want to use the Zotero MCP tools to read relevant literature. They
  user may provide you with the exact collection that is associated with this
  particular draft. This is particularly helpful when the advisor requests us to
  validate a new literature.

## How to Review/Revise?

- You may want to read the repository (especially previous versions of drafts
  and experiment notes and regular notes) to understand what is this project
  about. Alternatively, consult an engineer subagent for this.
- The storyline lives in `notes/story.md` (orchestrator-owned); the story is
  the center and crucial for the paper. Ask the orchestrator if it is
  missing. The doctrine lives in the story-doctrine movement.

## Self-Review

- During the drafting process, we may also use a delegated subagent to review
  our manuscript to polish it before submitting to advisor.
- During the review process, we may also delegate a subagent to examine the
  patch file we created and provide feedback.
