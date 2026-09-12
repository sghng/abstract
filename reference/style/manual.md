# The Quantitative Psychology Writing Manual

A comprehensive manual for AI agents composing academic prose in
quantitative psychology (psychometrics, educational measurement, and
neighboring methodological fields). Every rule below is grounded in a corpus
analysis of 833 Psychometrika and 583 JEM articles (2005-2025); see
`report.md` for the evidence and `corpus_stats.md` for the numbers. Where a
rule has a corpus frequency, the frequency is given.

The manual is organized in three levels, matching how a paper is actually
built:

- **Level 1, the paper** (Sections 1-6): architecture, dimensions,
  planning, and each section's playbook, from abstract to discussion.
- **Level 2, the paragraph** (Section 7): shape, genotypes, openings,
  closings, transitions, cohesion.
- **Level 3, the sentence** (Sections 8-12): person, voice, tense, length,
  connectives, hedging, numbers, citations.

Then: Section 13 lists the failure modes that will expose you as an AI, and
Section 14 is the pre-submission checklist. When in doubt, imitate a
template: every template in this manual is a verbatim sentence from a
published paper, with only notation simplified.

---

# LEVEL 1: THE PAPER

## 1. Architecture: build the skeleton first

The research article in this field has one skeleton. Do not innovate on it.

```
Abstract            one paragraph, 150-250 words
Introduction
[Content sections]  the model/method/theory; the bulk of the paper
Simulation study    if applicable
Empirical example   real data; order with simulation may be reversed
Discussion
[Back matter]       appendices, supplementary material, references
```

Rules:

1. Use titled, content-named sections, not generic ones. "The Gibbs Sampling
   Algorithm", "Item Calibration Procedures", "A Simulation Study". Never
   "Literature Review", never "Background", never "Methodology" (it is
   "Method" or "Methods").
2. Title the introduction "Introduction" (Psychometrika always; JEM after
   ~2021). An untitled introduction is a defensible JEM archaism; prefer the
   title.
3. Name the simulation section "Simulation Study" and give it "Design" and
   "Results" subsections. Name the application "An Empirical Illustration",
   "Empirical Example", "Real Data Analysis", or "Application".
4. End with "Discussion" (the safest title; 115 corpus heading hits) or
   "Conclusion and Discussion". Include limitations inside it; do not create
   a separate "Limitations" top-level section unless the journal's recent
   papers do (recent JEM tolerates it as a subsection).
5. Put proofs in lettered appendices, algorithms in numbered floats, overflow
   tables in "Supplementary Material" with S-numbered labels.
6. Subsection titles are Title Case noun phrases and may carry content:
   "Coefficient alpha Cannot Be a Reliability Point Estimate Without
   Additional Assumptions" is a real subsection title.
7. If the paper has a theorem apparatus, use numbered Theorem / Lemma /
   Proposition / Definition / Remark / Proof blocks (Psychometrika dialect).
   In JEM dialect, quarantine derivations in prose walked step by step, with
   formal results in an appendix.

## 2. Dimensions: how big everything is

Corpus medians over 240 papers (full distributions in `corpus_stats.md`
Section 11). Use these as sanity bounds; a draft that lands far outside
them reads wrong before anyone notices why.

**Sections per paper**: 6 top-level sections (Psychometrika median; mean
5.8, p90 8), 7 for JEM (mean 7.6, p90 11). Counting subsections, about 16
headings total (p90 26-28).

**Paragraphs per section** (mean / median / p90):

| section | paragraphs | sentences |
|---|---|---|
| Introduction | 6.9 / 6 / 12 | 36.5 / 32 / 65 |
| Method/model | 5.1 / 4 / 11 | 18.7 / 14 / 39 |
| Simulation | 4.0 / 3 / 9 | 17.5 / 12 / 38 |
| Results | 4.1 / 3 / 10 | 19.8 / 15 / 44 |
| Application | 4.3 / 3 / 9 | 21.3 / 16 / 43 |
| Discussion | 5.6 / 5 / 9 | 31.2 / 31 / 56 |

The introduction and the discussion are the two long-form sections; body
sections are short, segmented by subheadings, and equation-dense.

**Proportion rules of thumb**:

- Introduction: 10-15% of the body.
- Method/content sections: the largest share; in the new-method genotype
  often half.
- Simulation + application together: roughly a third.
- Discussion: 10-15%; shorter than the introduction is a warning sign.
- Abstract: 150-250 words regardless of paper length.

## 3. Planning: paper genotypes

Before drafting, identify the paper's genotype; each has a stable section
map in the corpus.

**Genotype A: the new-method paper** (the default in both journals).
Introduction --> method sections presenting the model/estimator/test -->
simulation study --> empirical application --> discussion. The method
sections are the bulk. Simulation and application each carry their own
design and results narration; a new method without both is under-elaborated
by current convention. Newest JEM papers sometimes reverse the order
(empirical illustration first, simulation second); either order is safe.

**Genotype B: the theory paper** (Psychometrika). Introduction --> axioms/
definitions --> numbered Theorem/Lemma/Proof blocks with Remarks -->
generalizations and extensions --> (optional) small numerical example -->
discussion. Proofs may be deferred to appendices with "It can be shown that
..." left in the body. Examples are numbered floats ("Example 1").

**Genotype C: the comparison/evaluation paper** (common in JEM).
Introduction --> a methods-review section that presents the competing
procedures (equations live here) --> simulation study comparing them under
fully crossed conditions --> empirical illustration --> discussion with
recommendations. Attested review-section titles: "Description of Relevant
DIF Detection Procedures", "Item Calibration Procedures", "The
Nonparametric Approach to Estimate CA and CC".

**Genotype D: the multi-study paper** (JEM). Introduction --> "Study 1:
[descriptive title]" with internal Methods/Results and a run-in "Discussion
of results of Study 1." paragraph --> "Study 2: ..." --> general discussion.

Ordering rules inside the paper:

- Equations do not appear in the introduction; they wait for the method or
  methods-review section.
- The gap is stated before the contribution, which is stated before the
  roadmap, which closes the introduction.
- Design before results, always; a results paragraph never introduces a
  condition the design section did not name.
- Limitations before future work; future work ends the discussion; nothing
  follows future work except back matter.

## 4. The abstract

One paragraph. No citations. Almost no numbers. No keywords block unless the
journal requires one. Follow the six-move sequence:

1. **Context**: one or two sentences framing the problem. Post-2021, opening
   directly with "We develop ..." / "We consider ..." is fully idiomatic
   (69% of abstracts use "we"/"our").
2. **Gap**: one sentence on what existing approaches cannot do.
3. **Action**: what you did ("we propose", "a simulation study was
   conducted").
4. **Design**: data or simulation setup in one sentence.
5. **Results**: qualitative orderings, not statistics. Template: "the power
   of CDR was consistently higher than that of LR across all forms of DIF."
6. **Payoff**: one implication sentence. Template: "Our findings suggest
   that the predictive utility analysis offers practical guidance for
   enhancing the use of linked scores as well as supporting institutional
   accountability."

Templates (verbatim, notation simplified):

- "We develop a fully nonparametric, easy-to-use, and powerful test for the
  missing completely at random (MCAR) assumption on the missingness
  mechanism of a dataset."
- "The elicitation of an ordinal judgment on multiple alternatives is often
  required in many psychological and behavioral experiments to investigate
  preference/choice orientation of a specific population."

Never: a citation, a p-value, "This paper is structured as follows", or the
words "novel" and "importantly".

## 5. The introduction

The introduction is a funnel with five mandatory moves. Budget: 6
paragraphs, about 32 sentences (corpus medians; p90 at 12 paragraphs / 65
sentences).

**Move 1: Opening frame (first sentence).** Establish the phenomenon or
method family as important. Never open with the paper, a citation, a
statistic, or a question. Five sanctioned openings:

- Field frame: "In item response theory (IRT), inferences are made about the
  ordering of subjects' latent scores on the basis of their responses to
  multiple test items."
- Definition: "Classification accuracy (CA) is the rate at which observed
  scores from a test classify examinees into the correct category."
- Plain practical fact: "Most achievement tests are administered within an
  allocated time."
- Practice anchor: "For a certification, licensure, or placement exam, the
  pass rate is a key statistic that is closely monitored."
- Concessive history: "Though the origin of unfolding analysis for attitude
  measurement is often credited to Coombs (1950), ..."

**Move 2: Literature paragraphs.** One model or study per paragraph, opened
by naming it: "Masters' (1982) partial credit model (PCM) is a polytomous
IRT model which ...". Elaborate, then evaluate in the closing sentence, and
let that evaluation feed the next paragraph. Chain with contrastive frames:
"Based on the idea of mixture models, Cao and Stokes (2008) propose ..." /
"Instead of comparing the threshold to item ordering ..., the IRT
difficulty-based guessing model ... compares ...". Every citation here is
load-bearing; prune any that is not.

**Move 3: The gap.** Credit, then turn. The gap is a missing capability,
never someone's error. Concessive clause first, adversative marker,
capability predicate. Sanctioned predicates: "has not yet been proposed",
"is yet to be proposed", "are not available in the extant literature", "has
not been well studied", "little is known", "no further work has been
reported", "very little guidance appears in the literature", "it is still
unknown whether". Templates:

- "Despite the successful applications of ESEM, they are based on
  factor-based SEM, and an exploratory procedure for component-based SEM has
  not yet been proposed."
- "Although several approaches have been proposed to account for test
  speededness, each using a real data set, no further work has been reported
  comparing these various approaches."

If you claim to be first, hedge it: "It appears that the PKLM-test is the
first MCAR test with such a guarantee." / "To the best of our knowledge,
there exists no study that ...".

**Move 4: Contribution / purpose.** Psychometrika dialect, two sanctioned
voices:

- Impersonal: "In this paper, the gap that exists between X and Y is bridged
  by proposing Z."
- Agentive: "In this paper, we prove that under mild regularity conditions,
  ..."

JEM dialect, explicit purpose statement:

- "Therefore, the purpose of this study is to investigate, through
  simulations, the relative performance of five item calibration procedures
  ... under various testing conditions."
- "The purpose of the current study is to systematically explore the impacts
  of ignoring rater effects on student achievement estimates in mixed-format
  tests under conditions that reflect operational large-scale mixed-format
  assessments."

Enumerate contributions with "The contribution of this article is threefold.
First, ... Second, ... Third, ...". State research questions as colon-led
prose ("We focused on the following research question: ..."), never as a
numbered "RQ1:" list.

**Move 5: Roadmap.** One paragraph, one sentence per section, always with an
"as follows" formula: "The remainder of the paper is organized as follows."
Omit only in JEM, where the roadmap is optional.

## 6. The body sections and the discussion

### 6.1 Content/method sections

Budget: about 4 paragraphs and 14 sentences per (sub)section (corpus
medians); a subsection rarely exceeds 11 paragraphs.

- Open each section with a framing sentence ("In this section, we ..."),
  then proceed deductively.
- Introduce notation with present-tense imperative frames: "Let X denote
  ...", "Consider a situation in which ...", "Suppose that ...", "Assume
  that ...". State index conventions once: "We use subscript i = 1, ..., N
  to index subjects, j = 1, ..., J to index items."
- Every display equation gets: a number, a following "where"-sentence
  glossing each symbol in order, and a plain-language interpretation. The
  equation appears twice: symbolic, then verbal. Template gloss: "If there
  is no DIF, only beta0 and beta1 should be nonzero. The extent to which
  beta2 differs from zero provides evidence of uniform DIF."
- Narrate derivations with yield-verbs: "Substituting Equations (2) and (3)
  into Equation (1) gives ...". Defer proofs: "It can be shown that ...".
- Name and abbreviate models at first mention: "which we call the 'SIRT-MM'
  models", "hereinafter abbreviated as BNPPLM". Use the acronym thereafter.
- Restate algebraic consequences in words immediately: "In other words,
  examinees with ability higher than the cut will pass the test with
  probability 1 ...".

### 6.2 The simulation study

Budget: about 3 paragraphs in the design subsection, 3 in results (corpus
medians); up to 9-10 at p90. Narrate in the fixed grammar:

1. Purpose: "This section reports the results of the two numerical
   simulation studies. The first study aims to evaluate ... The second study
   examines ...".
2. Design factors with exact levels, fully crossed: "Crossing the two levels
   each of sample size and ability distribution equality yielded four
   conditions. Each condition was replicated 200 times."
3. Data-generating mechanism in past passive: "Responses to an artificial
   test were generated according to a three-parameter logistic model (Lord,
   1980)."
4. Evaluation metrics, defined by formula: "we report the average element-
   wise accuracy rate (EAR) ... Furthermore, we compute the average root
   mean squared error (RMSE) ...".
5. Justify every level choice, ideally by precedent: "These distributions
   were chosen to resemble values observed in previous simulation studies."
6. Findings tied to tables: "Simulation results for assessing the accuracy
   ... are reported in Tables 1-5."

Recent-era additions: name the software and packages, report computation
time and hardware ("The computation time in total was 8 seconds. We used a
laptop."), declare space-saving ("we only present results of Items 1 and 2
to save space."), and announce non-interpretation ("Therefore, we did not
interpret the results for these effects in detail.").

### 6.3 The empirical application

Budget: about 3-4 paragraphs (median 3, p90 9).

- Open with an application sentence: "In this section, we apply Algorithm 1
  to the Problems in Elementary Probability Theory data set (Heller &
  Wickelmaier, 2013)."
- Describe data collection in past tense: "The data were collected between
  May 2023 and March 2024."
- Interpret findings concretely, with decision consequences where possible:
  "Say, if an institution requires its instructors who scored below -1 ...,
  then based on the three models, 85, 102, and 76 instructors would need to
  take the additional training."

### 6.4 The discussion

Budget: about 5 paragraphs and 31 sentences (corpus medians). Five moves,
in order:

1. **Recap** in present perfect: "We have investigated a Bayesian finite PL
   mixture ..." / "This article has proposed and formally derived a family
   of new sequential item response models ...".
2. **Findings restated in plain words**, one per paragraph, interpreted
   under hedges. In JEM with research questions, restate each question as
   the paragraph frame: "For the first research question, how effectively
   does the TTM account for local dependence for CR items in testlets, this
   study found that ...".
3. **Agreement with predecessors** (a required move): "The results of this
   study were consistent with those of previous research. First, in
   agreement with Narayanan and Swaminathan's (1996) study ...".
4. **Limitations**, framed as scope, enumerated: "Although the results of
   this study indicate that CDR was the single most effective method ...,
   there are several limitations of these results that deserve recognition.
   First, ... Second, ... Finally, ...". Add the JEM caution idiom where
   applicable: "We advise caution regarding generalization of results from
   this study ...".
5. **Future work**, hedged and directional: "Some extensions to relax these
   assumptions may be considered in future research." / "Therefore, one
   direction for future research would be the derivation of necessary and
   sufficient generic identifiability conditions ...".

For JEM, insert between moves 4 and 5 an **implications for practice**
move with a named audience: "Our findings have several implications for
researchers and practitioners who work with mixed-format assessments." Issue
direct recommendations: "we recommend using the nonparametric approach as a
safer, if not better, method to estimate CA and CC." / "For a simple
SIRT-MM model, we recommend N = 500 or more."

---

# LEVEL 2: THE PARAGRAPH

## 7. The paragraph

### 7.1 Shape and length

Paragraphs in this genre are long, uniform blocks: Psychometrika runs a
median of 73 words (mean 92, p90 194), JEM a median of 100 words (mean 110,
p90 206). In sentences: median 3-4 per paragraph (Psychometrika mean 4.0,
JEM 4.5), p90 at 8. One-sentence paragraphs run at 16% corpus-wide, but
almost all of them are equation glosses (the "where ..." sentence standing
alone after a display) or display-adjacent fragments. In running prose, a
one-sentence paragraph is a register violation; an eight-sentence paragraph
is normal.

The governing contract is **deductive**: the topic sentence comes first and
states the paragraph's claim or organizational fact; the body elaborates,
defines, derives, or cites; the final sentence delivers the consequence or
pivots to the next paragraph. No suspense structure, no delayed reveals, no
paragraph that withholds its point to the end. A reader who reads only the
first sentence of every paragraph should recover the paper's argument.

### 7.2 The seven paragraph genotypes

Just as the paper has genotypes, so does the paragraph. Nearly every
paragraph in the corpus is one of these seven.

1. **Literature paragraph** (introductions, review sections). Opens by
   naming one model or study, elaborates it, evaluates it in the closing
   sentence, and hands the evaluation to the next paragraph. Template:
   "Masters' (1982) partial credit model (PCM) is a polytomous IRT model
   which, like the Rasch (1960) model, has the sum scores as a sufficient
   statistic for the latent scores." Chain with contrast: "Based on the idea
   of mixture models, Cao and Stokes (2008) propose ...". One model per
   paragraph; never two studies in one paragraph's topic sentence.

2. **Gap paragraph** (introductions). Concedes the literature's achievement
   in one or two sentences, then turns on "However"/"Although"/"Despite" to
   the missing capability. Often the shortest prose paragraph in the
   introduction. Template: "Although several approaches have been proposed
   to account for test speededness, each using a real data set, no further
   work has been reported comparing these various approaches."

3. **Method/procedure paragraph** (method sections). Opens with a passive-
   past procedural sentence and proceeds chronologically. Template:
   "Responses to an artificial test were generated according to a three-
   parameter logistic model (Lord, 1980)." Condition paragraphs enumerate
   levels inside sentences: "We conducted the simulation study under
   different sample size (i.e., N = 500, 1000, and 2000), numbers of
   attributes (i.e., K = 3, 4, and 5), ...".

4. **Equation-gloss paragraph** (method sections). The "where ..." sentence
   after a display, often standing alone as a short paragraph, defining
   every symbol in order, followed when needed by the plain-language
   reading. This is the one genotype where a one-sentence paragraph is
   idiomatic.

5. **Results/display paragraph** (results sections). Opens with the display
   pointer plus the headline pattern, then moves from the most important
   pattern to condition-level numbers to exceptions, and closes with an
   interpreting "implying/indicating" clause. Template opener: "Table 4
   presents the rejection rates for MH, BD, CDR, and LR ... as a function of
   sample size and equality of the reference and focal group ability
   distributions." One display per paragraph is the default rhythm.

6. **Discussion/interpretation paragraph** (discussions). Restates one
   finding in plain words, then interprets under hedges, then connects to
   prior work or practice. Template frame (JEM, by research question): "For
   the first research question, [question restated], this study found that
   ...".

7. **Roadmap paragraph** (end of introduction). One sentence per section,
   in order, under an "as follows" formula. Template: "The remainder of the
   paper is organized as follows. Section 2 introduces ...".

### 7.3 Openings

Most paragraphs open plainly: 85% of corpus paragraphs begin with a topical
subject-first sentence, no connective at all. The remaining openings:
connective 6.0%, display pointer 4.2%, anaphoric "this/these" 2.6%,
locative "in this ..." 2.1%. Do not over-produce connective openings; the
genre's default paragraph starts with its subject.

Corpus paragraph-initial trigrams, with counts over the 240-paper sample:
"in this section" 66, "in addition to" 63, "in this paper" 61, "in this
study" 53, "figure/table shows the" 48/46, "in order to" 46, "in this
article" 38, "note that the" 34, "the purpose of" 33, "the results of" 32,
"as shown in" 28, "table presents the" 26, "based on the" 24, "it should
be" 24.

Sanctioned opening moves:

- **Topical (default)**: the paragraph's subject, straight: "The partial
  credit model is ...", "Parameter recovery was assessed by ...".
- **Locative**: "In this section, we ...", "In this paper, ..." (the
  section-internal orienter; use at most once per section).
- **Anaphoric "This + noun"**: "This study ...", "This article ...", "This
  approach ...", "This result ...", "This model ..." (the genre's primary
  cohesion device; the noun carries the backward link).
- **Display pointer**: "Table 3 shows ...", "Figure 2 presents ...", "As
  shown in Table 6, ...".
- **Additive**: "In addition, ...", "Additionally, ...", "Furthermore, ...".
- **Concessive**: "Although the ...", which commits the paragraph to a turn.
- **Orienting restatement**: "The above simulation studies are based on the
  assumption that ...".

### 7.4 Closings

The last sentence of a paragraph does one of three jobs: state the
consequence ("Thus, ...", "Therefore, ..."), evaluate or interpret ("This
suggests that ...", "These results indicate ..."), or pivot to the next
paragraph's subject. 14-15% of paragraph-closing sentences in the corpus
open with a connective; the most common closing first words are
"this/these" (1025 combined), "however" (284), "thus" (246), "therefore"
(193), "finally" (130). A closing "However," sets up the next paragraph's
contrast; a closing "Thus" seals the current one. Never close a paragraph
with a question, a quotation, or a naked statistic with no interpretation.

### 7.5 Connectivity: how sentences and paragraphs link

The genre's cohesion recipe, measured over 64,000 sentences:

- **14% of sentences** (13.5% Psychometrika, 14.5% JEM) open with an
  explicit connective. That is roughly one in seven; the other six carry
  their logic through content, not scaffolding. If a third of your sentences
  open with transitions, you are over-signaling.
- **6% of sentences** open with anaphoric "this/these/such", usually with a
  noun attached ("This result", "These findings", "This specification").
- **Lexical repetition is the glue**: adjacent sentences share content words
  at a mean Jaccard of 0.07-0.08; about one content word in twelve carries
  over verbatim. Repeat key terms exactly ("the isotonic PCM", "the isotonic
  PCM"); the genre prefers repetition to elegant variation.
- **Connectives are denser at seams**: only 6% of paragraph-opening
  sentences but 14-15% of paragraph-closing sentences carry a connective.
  Transitions do their work at paragraph boundaries, especially at the
  close.

The connective taxonomy, with sentence-opener rates per 10k sentences:

- Contrast: "However," 219 (the signature turn), "In contrast" 43,
  "Nevertheless"/"Nonetheless" 19, "Instead" 20.
- Consequence: "Thus" 103, "Therefore" 86, "Hence" 37, "Consequently" 23,
  "As a consequence".
- Additive: "In addition" 88 (bigram rate), "Furthermore" 54, "Moreover" 44,
  "Additionally" 25, "Similarly" 33.
- Specification: "For example" 125, "Specifically" 56, "In particular" 38,
  "For instance" 30.
- Restatement: "That is" 44, "In other words" (9 in one JEM batch alone).
- Summary: "In sum", "In summary", "Taken together", "Overall" 14.

Rotate connectives; never open two consecutive paragraphs with the same one;
never open a sentence with "And", "But", "So", or "Also" alone.

### 7.6 Cohesion inside the paragraph

- One idea per paragraph. If a sentence introduces a second claim, it starts
  a new paragraph.
- Repeat key terms verbatim; do not vary them for style.
- Use "This/These + noun" to carry the thread; bare "This is" without a
  noun is marked.
- Enumerate inside sentences: "First, ... Second, ... Third, ... Finally,
  ..." or "(i) ... (ii) ... (iii) ...". Displayed bullet lists are confined
  to contribution summaries and condition lists.
- Refer backward explicitly: "As mentioned above", "As described in Section
  3", "the above simulation studies".

### 7.7 Paragraph taboos

- No suspense or delayed-point paragraphs.
- No one-sentence prose paragraphs (equation glosses excepted).
- No ending on a question, a quotation, or an uninterpreted number.
- No bullet fragments in place of sentences.
- No paragraph whose first sentence could not serve as a summary of the
  whole paragraph.
- No consecutive paragraphs opened by the same connective.
- No more than about one connective-initial sentence in three.
- No "Firstly". The genre writes "First,".

---

# LEVEL 3: THE SENTENCE

## 8. Person, voice, tense

**Person.** Use "we" for agency, procedures, and claims (Psychometrika runs
83 "we" per 10k words; JEM 37). Never "I", even if you are simulating a
single author (the corpus's single-author papers write "this article" and
"the author's knowledge"). Never "the authors" (over 70 times rarer than "we").
Generic "one" is idiomatic in Psychometrika theory prose: "one can
distinguish", "one could argue".

**Voice.** Active with "we" for moves and claims; passive for procedures
where the actor is irrelevant ("were generated", "was collected", "is
assumed", "is defined"). Do not purge the passive; the genre runs ~49
passive bigrams per 10k words and reads wrong without them. Do not
over-passivate either; if the actor is the paper's authors, prefer "we".

**Tense.** Learn the verb-specific defaults (corpus present/past ratios for
"we + verb"):

- Present by convention: propose (8.9x), present (10.6x), discuss (10.4x),
  assume (6.4x), consider (4.7x), show (4.3x), demonstrate (3.3x). These are
  the paper's standing acts; they happen now, on the page.
- Past by convention: conduct (0.43x), find (0.51x), examine (0.55x),
  perform (0.83x), evaluate (0.85x). These are completed study events.
- Mixed: use, compare, apply, develop, investigate. Choose by semantics.

Section-level rules: settled knowledge and displays are present ("the PCM
imposes constraints", "Table 1 shows"); study conduct is past ("we conducted
the simulation study", "1000 replications were generated"); the discussion
recaps in present perfect ("we have shown"). Display references are never
past: "Table 1 shows", never "showed".

## 9. The sentence

- Length distribution (words, prose sentences): Psychometrika mean 22.7,
  p25 14, median 20, p75 29, p90 39, p99 66; JEM mean 24.7, median 23, p90
  41. About one sentence in ten runs 40+ words. Target a mean in the
  mid-to-high 20s with real variance and a long right tail: long hypotactic
  sentences with stacked subordination are the norm, and a short sentence
  lands with weight precisely because it is rare. Introductions and
  discussions run the longest sentences (means 25.3, 25.6); method and
  simulation sections the shortest (~23).
- Openers: the contrast turn "However," is the genre's signature opener (219
  per 10k sentences). Other sanctioned openers with corpus rates per 10k
  sentences: "Thus" 103, "Therefore" 86, "Note that" 82, "First/Second/
  Finally" ~55-67 each, "Specifically" 56, "Furthermore" 54, "Moreover" 44,
  "Hence" 37, "Similarly" 33, "Additionally" 25, "Consequently" 23,
  "Nevertheless"/"Nonetheless" 19. Remember the 14% ceiling: at most one
  sentence in seven opens with a connective.
- Enumeration: "First, ... Second, ... Third, ... Finally, ..." or
  "(i) ... (ii) ... (iii) ..." inside a sentence.
- Embed math symbols as grammatical constituents: "letting K be the total
  number of answer choices ..., the probability of guessing the correct
  response is 1/K".
- Use "respectively" for parallel mappings; it is the genre's signature
  sentence-final tag.
- Clarify with comma-flanked "i.e.," and "e.g.," inside parentheses (10.6
  and 12.4 per 10k words). Do not use "cf." (nearly extinct, 0.1) or
  "w.r.t." or "iff".

## 10. Hedging and boosting

The law: **hedge interpretation and generalization; never hedge display
facts or derivations.** "Table 1 shows that power exceeded .80" is bare;
"The results suggest that the procedure may be robust to ..." carries two
hedges.

Hedge inventory with corpus rates (per 10k words): may 15.9, could 7.2,
might 4.5, often 4.3, likely 3.3, relatively 2.8, generally 2.6, typically
2.6, appears/appear 2.6, suggest(s) 3.8, tend(s) to 2.0, seems/seem 2.0,
somewhat 0.9. Signature forms: "may be restrictive", "seems to suggest",
"appears to be", "would appear to" (JEM), "to the best of our knowledge",
"warrant(s) further study" (JEM), "suggests that".

Boosters are rationed: clearly 1.1, indeed 1.0, importantly 0.5, notably
0.3, obviously 0.2, certainly 0.3 per 10k words. If your draft uses
"importantly" or "crucially" more than once, delete. Never write
"surprisingly", "remarkably", or "interestingly" as an opener about your own
results.

Superlatives ride on hedges: "CDR may be the single most effective method
for simultaneously detecting both uniform and nonuniform DIF." A bare
superlative is a register violation.

## 11. Reporting numbers

- Decimals to 2-4 places. Drop the leading zero for bounded statistics
  (".80", ".05", "-.22"); retaining it ("0.038") is an emerging post-2024
  variant under APA 7, not yet dominant. Pick one convention per paper;
  dropping is the safer default for this corpus.
- Percentages with the % sign; comparisons as parenthetical pairs ("(.75 for
  the CDR vs. .42 for LR-C)"); ranges inline ("(.30 <= MAE <= .77)").
- Inline statistics in italic-letter shorthand: "(M = .98, SD = 1.06)",
  "(p < .01)".
- Justify thresholds by citation: "We used 0.06 as a cutoff for a salient
  effect (Cohen, 1988)."
- Explain anomalies; never hide them: "For n >= 500, some of the 1000
  replications encountered difficulties with the estimation of the Bayes
  factor (empty cells in Table 1), as the constraints were so unlikely that
  ...".
- Reference displays with sanctioned verbs, ranked by corpus frequency:
  shows >> presents > summarizes > displays > gives > provides > reports >
  lists > contains. Alternate frame: "As shown in Table 6, ...".

## 12. Citations and collegiality

- Author-year. Narrative citations for load-bearing predecessors
  ("Swaminathan and Rogers (1990) applied the LR model to the detection of
  both uniform and nonuniform DIF"); parenthetical clusters for territory
  ("(e.g., Lord, 1980; Thissen, Steinberg, & Wainer, 1988, 1993)").
- Criticize the work, concede first, target the capability: "Their test is
  completely nonparametric and shown to be consistent. ... An application
  area where their proposed test struggles is for higher-dimensional data
  ...".
- Credit generously and explicitly: "Following Tijmstra et al. (2013), we
  chose ..."; "The code for the Q-test was kindly provided to us by the
  authors."
- Recent-era transparency: ship software and say so ("Finally, we make our
  test available through the R-package PKLMtest, available on ... and on
  CRAN."); disclose reviewer-requested analyses ("As suggested by a
  reviewer, interactions between such factors should also be evaluated.").
- Confirm against predecessors in the discussion; agreement is a required
  move, disagreement is "Somewhat different from Kolen and Tong (2010), this
  study found that ...".

---

## 13. AI failure modes

These patterns will mark prose as machine-generated or amateur. Each is
absent from, or vanishingly rare in, the corpus.

1. **Hype vocabulary**: novel, groundbreaking, cutting-edge, state-of-the-
   art, revolutionary, game-changing, delve, leverage, harness, unlock,
   unveil, shed light on, pave the way, embark, navigate (metaphorical),
   landscape (metaphorical), realm, testament, crucial/vital (more than
   once), importantly/notably/remarkably (more than once per paper).
2. **Throat-clearing**: "It is important to note that" (the corpus writes
   "Note that" or "It should be noted that"), "It is worth mentioning",
   "In today's world", "Since the dawn of", "In the era of".
3. **Metronome sentences**: uniform 15-20 word sentences, no hypotaxis. The
   genre's mean is 23-25 with 10% of sentences at 40+ words; write long,
   and vary.
4. **Fragmented paragraphs**: one- or two-sentence paragraphs in running
   prose, or a new paragraph for every claim. The genre's paragraph is a
   3-8 sentence, 70-110 word deductive block.
5. **Hedge miscalibration**: hedging tables ("Table 1 may suggest"),
   under-hedging generalization ("this proves the method works"), stacking
   boosters ("clearly and undoubtedly").
6. **Wrong tense**: "Table 1 showed", "we propose" in past tense,
   present-tense data collection.
7. **Bullet-list prose**: the genre enumerates inside sentences
   ("First, ... Second, ..."). Displayed bullet lists appear only in
   contribution summaries and condition lists.
8. **Rhetorical furniture**: questions to the reader, exclamation marks,
   em-dash flourishes (the corpus punctuates parentheticals with commas;
   JEM's occasional em-dash pair is the outer bound, not a license), second
   person, contractions.
9. **Self-congratulation**: evaluating your own contribution ("This
   represents a significant advance"). The genre demonstrates; it does not
   applaud. "powerful, flexible and easy-to-use" is the ceiling, and only
   after the evidence.
10. **Abstract violations**: citations, statistics, or structure narration
    in the abstract.
11. **Genre imports**: "RQ1:" lists, structured abstracts, "Literature
    Review" headings, PRISMA-style language, "This study employed a
    mixed-methods approach".
12. **Fake precision**: statistics without a table, thresholds without a
    citation, level choices without justification.
13. **Over-transitioning**: opening a third of your sentences or every
    paragraph with a connective (the corpus ceiling is 14% of sentences,
    6% of paragraph openings), or using "Moreover" as the default additive
    (it ranks below "In addition" in the corpus).
14. **Suspense writing**: withholding the point of a paragraph or section to
    the end. This genre states first, then supports.
15. **Dimension drift**: an introduction of two paragraphs, a discussion of
    one, a results section with no display pointers, a twelve-section
    paper. Check your structure against Section 2's table before polishing
    prose.

## 14. Pre-submission checklist

Paper level:

- [ ] One-paragraph abstract, 150-250 words, no citations, six moves.
- [ ] Paper genotype identified (new-method / theory / comparison /
      multi-study); section map matches it.
- [ ] 6-7 top-level sections; about 16 headings with subsections.
- [ ] Section dimensions near the Section 2 table: introduction ~6
      paragraphs / ~32 sentences; discussion ~5 / ~31; body sections ~3-4
      paragraphs each.
- [ ] No "Literature Review" heading; sections named for content.
- [ ] Introduction has all five moves, ending in an "as follows" roadmap.
- [ ] No equations in the introduction; gap before contribution before
      roadmap; design before results; limitations before future work.
- [ ] Simulation section follows the six-step narration grammar.
- [ ] Discussion has recap, plain-word findings, agreement with
      predecessors, limitations-as-scope, future work; JEM adds
      implications for practice.

Paragraph level:

- [ ] Prose paragraphs run 3-8 sentences (median 3-4) and 70-110 words; no
      one-sentence paragraphs except equation glosses.
- [ ] Every paragraph's first sentence could summarize the paragraph.
- [ ] Every paragraph is a recognizable genotype (literature, gap, method,
      gloss, results, discussion, roadmap).
- [ ] Most paragraphs open with a plain topical sentence (corpus: 85%);
      connective openings stay near 6%.
- [ ] Each paragraph closes on a consequence, an interpretation, or a
      pivot; none closes on a question or a bare number.
- [ ] No two consecutive paragraphs open with the same connective.
- [ ] "This/These + noun" carries the thread; key terms repeated verbatim.

Sentence level:

- [ ] No contractions, no "I", no "the authors", no exclamation marks, no
      questions to the reader.
- [ ] "we propose/present/assume/show" in present; "we conducted/found" in
      past; displays present.
- [ ] Mean sentence length in the mid-20s; about one sentence in ten at
      40+ words; no metronome rhythm.
- [ ] At most ~14% of sentences open with a connective; no sentence opens
      with bare "And"/"But"/"So".
- [ ] Hedges on interpretation, none on display facts; boosters rationed
      (zero or one "importantly").
- [ ] "i.e.,"/"e.g.," comma-flanked; "respectively" for parallel mappings;
      no "cf."/"w.r.t."/"iff".

Content:

- [ ] Every equation glossed with a "where"-sentence and a verbal
      restatement.
- [ ] Every design level justified; every threshold cited; every anomaly
      explained.
- [ ] Tables/Figures referenced with shows/presents/summarizes, never
      past-tense.
- [ ] Criticism concessive and capability-focused; credit explicit.
- [ ] Software availability stated if software exists.
- [ ] Numbers: leading-zero convention consistent; 2-4 decimals.

Final sweep: delete any sentence that could appear in a press release. What
remains should be provable, checkable, or attributed. That is the register.
