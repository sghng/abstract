---
name: research
description: >-
  The lab's project logistics: where notes live, the ticket, report, memo,
  and briefing workflow, co-designing tickets, amendments, versioning, the
  companion rule, and the verification rules for outgoing artifacts. Use
  when creating or updating any note, ticket, report, memo, or briefing,
  when shipping or versioning an artifact, or when unsure where something
  belongs.
---

# Research Project Logistics

The lab's operating system is its notes. This skill holds the workflow; the
templates and long-form references sit beside it.

- Templates (copy, never retype): `assets/ticket.md`, `assets/report.md`,
  `assets/memo.md`, `assets/briefing.md`.
- `references/logistics.md`: placement rules, the notes index, wiki-link
  mechanics, the amendment format, parent and sub-tickets, versioning.
- `references/verification.md`: the standing verification rules for outgoing
  artifacts. Read it before anything leaves the lab.

## The Loop

Ticket, execution, `results.md`, `report-NNN`, briefing. A ticket
crystallizes from an alignment interview with the PI: check the literature
first (the literature skill), expect pushback on feasibility, converge or
escalate with a clear decision, and crystallize the rationale into the
ticket's "Because" statements. The interview is the co-design; the ticket
is its minutes, written once alignment holds, and the PI is not expected
to read it. The ticket may pin the how (paths, seeds, schemas, parameters)
because its executor is a fresh subagent that performs better and cheaper
with specifics embedded. Surface every open question in the ticket; a
question written down is acceptable, a hidden one is not. Permit surprises
explicitly: unexpected findings belong in the report's Discovery Zone.
A ticket names the decisions the work must make and the alternatives
live for each. The report closes them out: for every decision, which
alternatives were tried and failed, which were eliminated by citation
or reason, and why the survivor fits the case. This record is the why
of the work and the first mine for manuscript drafting.

The report is the ticket's closing record, written for future sessions,
not for the PI. What reaches the PI is the briefing: the report distilled.

Amendments append to the original ticket, never a new file (format in
`references/logistics.md`). A ticket spanning domains splits into a parent
plus self-contained sub-tickets.

## Briefings

A briefing is a conversation, not a document: the PI asks, the agent
answers in chat, follow-ups follow. Chat is always the delivery mechanism.
A briefing file (`notes/briefs/briefing-NNN-*.md`, template in
`assets/briefing.md`) crystallizes the conversation when it reaches a
checkpoint: a milestone closes, a deliverable ships, or a ruling with
consequences lands. The file carries an executive summary, supplements,
and the rulings given in response; it is revised in place while the
conversation runs and settles when the business closes. A follow-up
question is a defect signal: if the PI had to ask, the answer joins the
file. Standing rulings are distilled into `notes/orchestrator.md` or the
story's Critical Decisions with a pointer back to the brief.

The summary's audience is the PI, cold: a few paragraphs, no unexplained
acronyms, decisions flagged as decisions. Numbers carry their registry
scope.

## Companions

Any artifact leaving the lab (an advisor document, a submission, a deck,
an abstract) ships with a companion beside it: the PI's defense reference.
The companion holds key numbers with provenance into the record, key
assumptions, methods in a paragraph each, and anticipated questions with
answers. Its genre is the briefing's supplement section, deepened; its
audience is the PI under questioning, not the artifact's recipient.

## Reviewing Reports

The primary question is whether the findings advance the narrative, not
whether the methodology is perfect. The two-pass judgment and the
lethal-versus-acceptable call live in the story-keeping skill.

## The Key-Results Registry

Canonical numbers live in `notes/results.md`. When a report lands a number
the story or a draft will cite, record it: name, value, precision, source,
one line per result. The registry stays short; the primary session arbitrates
what enters it, and audits, sweeps, and reviews read it as the single source
of numeric truth.
