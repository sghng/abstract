# Manifesto

## Observation: the work of a researcher differs from _research_

_Research_, in its purest form, is the generation of knowledge. The work of a
researcher is a job held inside an institution, characterized by the
satisfaction of a chain of human evaluators: advisors, reviewers, editors,
committees, department chairs, grant officers.

The institution, not the ideal, determines what counts as good work. A tool
serving the researcher must therefore serve the institution's criteria.

This project is built to make the life of a researcher easier, not to produce
good _research_. Where the two diverge, we follow the researcher. Hereafter,
un-italicized "research" means the work of a researcher.

We do not attempt to reform the institution, and we do not campaign for the
adoption of agent-centric workflows. We build to meet its boundaries.

## Conjecture: all as code

"Code" here means any structured text: not only Turing-complete languages, but
markup, Markdown, Typst and LaTeX, diagram DSLs, configuration, and sufficiently
precise natural-language instruction. The unit of interest is not executability
but structure a machine can read, diff, verify, and regenerate.

**A.** Language models are trained on text, and a substantial portion of that
text is code and its documentation — the largest and most consistently verified
structured corpus humans have produced.

**B.** Code is therefore close to the mother tongue of these models. Coding is
where agents first became useful and where they remain most competent.

**C.** More things are represented as code every year. Representation is
admission: what can be expressed as code can be read, checked, revised, and
composed by agents. The non-representable does not belong to the agentic era.

## Limits: all as code?

The conjecture is a direction, not a description of the present. Three barriers
stand against it.

**A. Some things resist reduction.** The preferences of editors, reviewers, and
grant officers cannot be collapsed into concrete criteria. Judgment of
significance, of narrative flow, of whether a claim has cleared the threshold
that removes doubt — this is what the evaluators are for.

**B. Academia is conservative.** New representations diffuse slowly, if at all:
Typst, LaTeX, version control, collaborative editing. The barrier is the
coordination cost of any productivity technology in a field with no incentive to
switch. An advisor who wants tracked changes in Word is a fact to be met.

**C. Some barriers are economic.** Publishers paywall the literature and
distribute PDF rather than HTML. Programmatic access is against their interest,
and no demonstration of productivity will change it.

## Corollary A: the process is the deliverable, so visibility is mandatory

Parts of this work cannot be automated end to end. An advisor expects weekly
reports. A submission must arrive as Word, not Typst. A committee will ask you
to defend, in a room, what was done and why. If only the final state exists,
none of this is possible.

The intermediate representations — tickets, reports, drafts, notes — are the
artifact, equal in standing to the manuscript. The system keeps them legible and
inspectable at every point, so a human can enter the process at any moment: to
review, to intervene, to take over, or to defend.

## Corollary B: express as much as possible as code

Every representation gained extends the reach of the system. We adopt the
representations that exist and invent them where they do not.

NL Patch is one such invention. An advisor requires a Word document with tracked
changes; the agent cannot produce one, and the advisor will not be moved. The
revision is therefore expressed as a structured natural-language diff between
draft versions — machine-generated, human-applied. It sits where the code world
ends and the institutional world begins, and lets work cross without requiring
either side to change.

Push representation as far as it goes; where it stops, build the crossing.

## Corollary C: borrow from software engineering

Agents are most competent at code, and the agentic coding community is far more
active than its academic counterpart. Its abstractions, tools, and
methodologies, are a mine we draw from rather than reinvent. That being said,
each borrowed abstraction is adopted only where it survives the preceding
sections.
