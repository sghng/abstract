# The Quantitative Psychology Handbook

A pocket handbook for writing like Psychometrika and the Journal of Educational
Measurement. Condensed from `manual.md`; every rule here is corpus-backed (see
`report.md`). When this handbook and instinct disagree, check the manual.

## The shape

Abstract (one paragraph, no citations) --> Introduction --> named model/method
sections --> Simulation Study --> Empirical Example --> Discussion. Proofs to
appendices, algorithms to floats, overflow tables to Supplementary Material.
Sections are named for their content, never "Literature Review". End with
"Discussion".

Dimensions (corpus medians): 6-7 top-level sections, ~16 headings total;
Introduction 6 paragraphs / ~32 sentences; method sections 4 paragraphs / ~14
sentences each; simulation and results sections 3 paragraphs each; Discussion 5
paragraphs / ~31 sentences.

Pick the paper's genotype before drafting: new-method (method + simulation +
application), theory (Theorem/Proof blocks), comparison (methods-review +
simulation + recommendations), multi-study (Study 1, Study 2, general
discussion). Ordering rules: no equations in the introduction; gap before
contribution before roadmap; design before results; limitations before future
work.

## The paragraph

The paragraph is a deductive block of 3-8 sentences (median 3-4; Psychometrika
median 73 words, JEM median 100): topic sentence first, elaboration, closing
consequence or pivot. No suspense. Every paragraph is one of seven genotypes:
literature (one model per paragraph), gap, method/procedure (past passive,
chronological), equation gloss (the one-sentence "where ..." paragraph),
results/display (pointer + headline + exceptions), discussion (finding restated,
then interpreted under hedges), roadmap (one sentence per section). Most
paragraphs (85%) open with a plain topical sentence; only 6% open with a
connective. Open with "In this section", "Note that", a display pointer, or
anaphoric "This + noun"; close with "Thus", "Therefore", "This suggests that",
or a pivoting "However". Link paragraphs with explicit connectives, rotated,
never the same one twice in a row.

## The moves

- **Abstract**: context --> gap --> action --> design --> qualitative results
  --> one payoff. 150-250 words, no numbers, no citations.
- **Opening sentence**: frame the field, define the construct, or state a plain
  fact. Never open with the paper itself.
- **Gap**: concede prior work, then mark its boundary with "However/
  Although/Despite" plus a missing-capability predicate: "has not yet been
  proposed", "little is known", "has not been well studied". Gaps are absences,
  never errors.
- **Contribution**: "In this paper, we propose ..." or "The purpose of this
  study is to ..." (JEM). Enumerate with "First, ... Second, ... Third, ...".
- **Roadmap**: "The remainder of the paper is organized as follows." One
  sentence per section.
- **Limitations**: named plainly, framed as scope, enumerated, converted to
  future work: "Some extensions to relax these assumptions may be considered in
  future research."
- **JEM only**: implications for practice with a named audience, and direct
  recommendations ("we recommend N = 500 or more").

## The sentence

- Mean length in the mid-to-high 20s (median 20-23; about one sentence in ten at
  40+ words); long hypotactic sentences are the norm; short ones are for weight.
- "we" for agency; passive for procedures; never "I", never "the authors".
- Tense by verb: present for propose/present/assume/consider/show; past for
  conduct/find/examine; present perfect to recap in the discussion. Displays are
  always present: "Table 1 shows".
- Signature opener: "However,". Rotate Thus, Therefore, Note that, Specifically,
  Furthermore, In addition, Moreover.
- "i.e.," and "e.g.," comma-flanked; "respectively" for parallel mappings; no
  "cf.", no "w.r.t.".

## The hedge law

Hedge interpretation and generalization; never hedge display facts or
derivations. Hedges: may, could, might, appears to, seems to, tends to, suggests
that, likely, typically, generally, relatively. Boosters are rationed: at most
one "clearly" or "indeed" per paper; never "importantly", "surprisingly", or
"remarkably" about your own results. Superlatives ride on hedges: "may be the
single most effective method".

## Math in prose

Every equation appears twice: symbolic, then verbal. Introduce notation with
"Let X denote ...", "Consider ...", "Suppose ...", "Assume ...". Number
equations, gloss every symbol in a "where"-sentence, restate consequences in
words ("In other words, ..."). Defer proofs: "It can be shown that ...". Name
and abbreviate models at first mention.

## Results

Simulation narration: purpose --> crossed design factors with exact levels -->
generating mechanism (past passive) --> metrics --> replication count -->
findings tied to tables. Justify every level choice, preferably by precedent.
Reference displays with shows/presents/summarizes. Claim-first findings,
trend-shaped, hedged at the inference ("..., suggesting that the method could
yield satisfactory recovery"). Explain anomalies; never hide them. Numbers: 2-4
decimals, leading zero dropped (".80"), percentages with %, thresholds cited.

## Citations and collegiality

Author-year. Narrative for load-bearing work, parenthetical clusters for
territory. Criticism is concessive and targets capability, not persons. Credit
is explicit. Agreement with predecessors is a required discussion move. Ship
software and say so.

## Never

Contractions; "I"; exclamation marks; rhetorical questions; "novel/
groundbreaking/cutting-edge"; "delve/leverage/shed light on/pave the way"; "It
is important to note that"; "In today's world"; bullet-list prose; citations in
the abstract; "Table 1 showed"; unhedged universals about your method;
press-release sentences.

## One-line test

Before shipping, ask of every sentence: is it provable, checkable, or
attributed? If not, cut it.
