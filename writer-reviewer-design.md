# Writer + Reviewer Harness Design

Plan artifact: agreed design for adding the **writer** and **reviewer** roles to
`abstract`. Created after a grill round with the PI.

## New Roles

- **Writer** -- owns `draft/`; executes writing tickets from the orchestrator;
  produces publishable artifacts (grants, proposals, manuscripts); cues the
  reviewer directly for review rounds.
- **Reviewer** -- the writer's devil's-advocate consultant; reviews `draft/`
  artifacts for writing quality and "nodding head" flow; returns review memos to
  `notes/memos/`; does not own or edit `draft/` files.

## Communication Topology

- Cue targets remain **unrestricted** at the extension level. Any role may cue
  any other role. The preferred workflow is **convention, not code**:
  - writer owns the review cycle;
  - orchestrator initiates and approves;
  - engineer and librarian are consulted as needed.

## tmux Layout

- Session name: `abs-<project-basename>`.
- Two tmux windows:
  - Window `core`: `orchestrator | engineer | librarian` (three even-horizontal
    panes).
  - Window `writing`: `writer | reviewer` (two even-horizontal panes).
- `abstract` attaches to window `core` by default. User switches with tmux
  prefix + window number.
- Reattach checks both windows/pane counts and recreates the whole session if
  the layout is stale.

## Writing Workflow

1. Orchestrator creates a writing ticket.
2. Writer reads `notes/story.md` and relevant reports/literature memos.
3. Writer drafts in `draft/`.
4. Writer cues reviewer for review.
5. Reviewer writes `notes/memos/memo-NNN-review-*.md`.
6. Writer revises in place.
7. Repeat review/revise rounds as needed.
8. Writer reports completion to orchestrator.
9. Orchestrator approves externalization or sends an amendment.

The writer may ask the orchestrator conceptual-integrity questions so that
`story.md` flows into drafts.

## File Conventions

- `draft/artifact-v0.md` is the working draft. Internal reviewer-agent rounds
  edit it in place.
- When sent externally, no rename or snapshot is made.
- External feedback returns as `draft/artifact-v0-<source>-edited.md` (or
  similar suffix).
- After incorporating external feedback, the working draft advances to
  `draft/artifact-v1.md`, then `v2`, etc. Version increments only on external
  cycles.
- Internal review memos live in `notes/memos/memo-NNN-review-*.md`.
- `notes/reviews/` is reserved for future external-review tracking; not used by
  the reviewer agent now.
- Engineer reports stay in `notes/reports/`; the writer does not rewrite them.

## Orchestrator's Role in Writing

- Initiates writing tickets.
- Approves whether a draft leaves the lab.
- Wraps up and informs the user when the writer finishes.
- Points the writer to files/agents when needed.
- Provides conceptual-integrity guidance so `story.md` flows into drafts.

## Shared Context

- Add/update a team roster section in `motif.md` describing all five roles
  (orchestrator, engineer, librarian, writer, reviewer) so every agent knows
  what every other agent owns and can be consulted for.

## Implementation Surfaces

- `motif.md`: expand team table; add writer/reviewer rows.
- `agents/orchestrator.md`: mention writer/reviewer and writing-approval
  workflow.
- `agents/writer.md` (new): role prompt.
- `agents/reviewer.md` (new): role prompt.
- `src/cli.ts`: update `ROLES` and tmux window creation.
- `extensions/cue/index.ts`: update `ROLES` array.
- `docs/multi-agent.md` / `docs/harness.md`: update role counts and examples.
- `docs/writing.md` (new): standalone writing workflow documentation.
- `TODO.md`: record decision that deferred "narrator" is now implemented as
  "writer"; log new design decisions.

## Appendix: Intended content for `docs/writing.md`

Create `docs/writing.md` with the following content during implementation.

```markdown
# Writing Workflow

How the lab produces publishable artifacts -- grants, proposals, manuscripts,
and similar deliverables. This doc is dev-facing; invariants live in
`motif.md` and role behavior lives in `agents/writer.md` and
`agents/reviewer.md`.

## Roles

- **Writer** -- owns `draft/` and executes writing tickets.
- **Reviewer** -- consultant to the writer; reviews drafts and writes memos.
- **Orchestrator** -- assigns writing work, approves externalization, keeps
  drafts aligned with `notes/story.md`.
- **Librarian** -- consulted by the writer for citations, claims, and
  background.
- **Engineer** -- not directly involved in writing, but the writer reads
  engineer reports for source material.

## Workflow Overview

```txt
Orchestrator creates writing ticket
              |
              v
Writer reads story.md + reports + memos
              |
              v
Writer drafts in draft/<artifact>-v0.md
              |
              v
Writer cues Reviewer
              |
              v
Reviewer writes notes/memos/memo-NNN-review-<artifact>.md
              |
              v
Writer revises in place (still v0)
              |
              v
Writer cues Orchestrator: draft ready for externalization
              |
              v
Orchestrator approves or requests amendment
              |
              v
Artifact sent out as v0
              |
              v
External feedback returns as draft/<artifact>-v0-<source>-edited.md
              |
              v
Writer incorporates feedback, advances to v1
```

## Tickets

Writing tickets follow the same `notes/tickets/ticket-NNN-*.md` convention as
engineering tickets, but with writing-specific fields:

- **Context** -- where we are in the story and why this artifact matters.
- **Audience** -- who will read it (panel, program officer, journal readers).
- **Venue / Format** -- grant, proposal, manuscript, page limits, required
  sections, citation style.
- **Key Claims** -- the argument the artifact must make, grounded in story.md
  and reports.
- **Required Sections** -- explicit structural requirements.
- **Deliverable** -- the file path in `draft/` and the target version to reach.
- **Review Plan** -- how many review rounds are expected and what the reviewer
  should focus on.
- **Discovery Zone** -- permission to surface unexpected framing opportunities.

The writer treats the ticket as the assignment and reports back to the
orchestrator when the work is complete.

## File Conventions

`draft/` holds working drafts and externally-edited feedback files. The lab
keeps one current working file per artifact. Internal reviewer-agent rounds
edit that file in place; external feedback is what drives version increments.

| File | Meaning |
|------|---------|
| `draft/artifact-v0.md` | current working draft; all internal editing happens here |
| `draft/artifact-v0-advisor-edited.md` | external feedback on v0 from advisor |
| `draft/artifact-v0-pi-edited.md` | external feedback on v0 from PI |
| `draft/artifact-v1.md` | next working draft after v0 feedback is incorporated |

Rules:

- `v0` is the first working draft.
- Internal reviewer rounds do not change the version number.
- When the artifact is sent externally, no rename or snapshot is made.
- External feedback returns as `draft/artifact-vN-<source>-edited.md`.
- After incorporating external feedback, advance to `draft/artifact-v(N+1).md`.
- Internal review memos live in `notes/memos/`, not in `draft/`.
- `notes/reviews/` is reserved for future external-review tracking; it is not
  used by the reviewer agent.

## Review Cycle

The writer owns the review cycle. The writer decides when a draft is ready for
review and what the reviewer should focus on. A typical cue:

```txt
[cue to reviewer] Please review draft/proposal-v0.md for "nodding reader"
flow, jargon leakage, and disproportionate paragraphs. The target venue is
NSF IIS with a 15-page limit.
```

The reviewer returns a memo at `notes/memos/memo-NNN-review-proposal-v0.md`.
The memo follows the standard memo template (see the logistics skill) and
includes:

- summary of the draft's current state;
- concrete issues with file paths, line references, or wiki links where
  possible;
- prioritized recommendations;
- anything that risks the artifact leaving the lab in a worse state.

The writer reads the memo, revises `draft/proposal-v0.md` in place, and either
asks for another review round or reports completion to the orchestrator.

The reviewer does not edit `draft/` files. The reviewer is a consultant, not a
co-author or a gate. If the writer repeatedly ignores serious reviewer
concerns, that is a conversation for the orchestrator, not a harness-level
block.

## Externalization

Only the orchestrator approves whether a draft leaves the lab. When the
writer reports completion, the orchestrator either:

- approves, and the current working draft is sent out; or
- requests amendments and creates a new ticket or cues the writer with
  high-level feedback.

The version that is sent out is the current working version. If the working
file is `draft/proposal-v1.md`, then `v1` is what leaves the lab.

## Example: From Story to Grant Proposal

1. Orchestrator updates `notes/story.md` after a series of reports shows a
   promising direction.
2. Orchestrator creates `notes/tickets/ticket-023-nsf-iis-proposal.md` with
   audience, venue, key claims, and required sections.
3. Writer reads `notes/story.md`, relevant `notes/reports/`, and literature
   memos; cues librarian for missing citations.
4. Writer produces `draft/nsf-iis-proposal-v0.md`.
5. Writer cues reviewer. Reviewer writes
   `notes/memos/memo-042-review-nsf-iis-proposal-v0.md`.
6. Writer revises `draft/nsf-iis-proposal-v0.md` and repeats review until
   satisfied.
7. Writer cues orchestrator: proposal ready for externalization.
8. Orchestrator approves; the user sends `draft/nsf-iis-proposal-v0.md` to
   the NSF.
9. External feedback returns as `draft/nsf-iis-proposal-v0-po-comments.md`.
10. Writer incorporates comments and advances to
    `draft/nsf-iis-proposal-v1.md`.

## Relationship to Other Roles

- **Engineer** -- reports live in `notes/reports/`. The writer reads them but
  does not rewrite them. If a report contains prose that belongs in the final
  artifact, the writer adapts it in `draft/` and cites the report via wiki link.
- **Librarian** -- writer can cue the librarian for citations, claim
  verification, and background. The librarian returns memos in
  `notes/memos/`.
- **Orchestrator** -- the writer can always ask the orchestrator questions,
  especially about conceptual integrity between `notes/story.md` and the draft.
  The orchestrator may relay the question or point the writer to the right
  file/agent.
- **Reviewer** -- only engaged by the writer. The orchestrator does not
  micromanage review rounds, but may request a specific review angle in the
  original writing ticket.

## Open Questions

- Should there be a dedicated **writing** skill covering manuscript conventions,
  grant sections, and citation hygiene? Currently these are scattered across
  the philosophy and manuscript skills.
- Should the reviewer ever be engaged for non-draft artifacts (e.g., polishing
  an engineer report)? The harness does not forbid it, but the convention is that
  the reviewer is the writer's right-hand.
- How many review rounds are normal before externalization? The writer decides
  for now; if the number grows, add a convention or lightweight checklist.
```
