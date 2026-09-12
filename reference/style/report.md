# How Quantitative Psychology Writes: A Corpus Report

A detailed report on the collective linguistic and semantic patterns of
research articles in *Psychometrika* (2011-2025) and the *Journal of
Educational Measurement* (JEM, 2005-2025). This report is the evidence base
for the companion documents: `manual.md` (comprehensive writing manual for AI
agents), `handbook.md` (condensed field handbook), and `zen.md` (one-screen
distillation).

## 0. Corpus and method

- **Corpus**: 833 Psychometrika papers (`repertoire/md/`) and 583 JEM papers
  (`repertoire/jem/md/`), converted from journal PDFs to Markdown.
- **Close reading sample**: 32 papers drawn, stratified across both journals
  and eras (2005-2025). Of these, 26 are research articles analyzed in
  depth; two book reviews and one rejoinder were retained as register
  contrasts; one erratum and one empty conversion were excluded.
- **Quantitative sample**: 120 + 120 randomly drawn papers (seed 42),
  reference lists and display math stripped, ~1.47M words analyzed. Full
  numbers in `corpus_stats.md`; script in `corpus_stats.py`.
- **Caveats**: Markdown conversion mangles some inline math and citation
  links; all verbatim quotations below were checked against intact prose.
  Frequency counts from close reading are exact grep counts over the sampled
  files; corpus rates are per 10,000 words or sentences as marked.

## 1. The genre in one paragraph

The quantitative psychology research article is a formal, impersonal, highly
conventionalized genre. Its prose is long-sentence hypotactic (mean 26-30
words), present-tense for facts and past-tense for procedures, plural
first-person or passive but never singular first-person. It hedges
interpretation and generalization aggressively while reporting display facts
(tables, figures) with unhedged confidence. It advertises novelty only
through what it does ("we propose", "is presented"), never through
self-praise. Its two house dialects differ mainly in audience: Psychometrika
writes to methodologists with theorem-proof machinery and shorter sentences;
JEM writes to measurement practitioners with longer, plainer sentences and
obligatory implications for practice.

## 2. Document architecture

### 2.1 The skeleton

Both journals converge on one skeleton:

```
Abstract (one paragraph, 150-250 words, no keywords, no citations)
Introduction
  ... [Psychometrika: usually titled "1. Introduction"; JEM: often untitled
       before ~2021, titled "Introduction" after]
Named content sections (model/theory/method, the bulk of the paper)
Simulation study        [if the paper has one]
Empirical application   [real data; order with simulation varies]
Discussion / Conclusion / Concluding Remarks
Back matter (footnotes, appendices, supplementary material, references)
```

Deviations are genre-marked: pure theory papers interleave numbered
`Theorem / Lemma / Proposition / Definition / Remark / Proof` blocks
(Psychometrika only: "theorem" 56, "proof" 42, "proposition" 21 heading hits
in the quantitative sample, versus zero in JEM). JEM multi-study papers use
`Study 1: ...` headings with internal Methods/Results and a run-in
"Discussion of results of Study 1." paragraph.

Verbatim heading habits:

- Content sections are named for their object, never generic: "The Gibbs
  Sampling Algorithm", "Item Calibration Procedures", "The Nonparametric
  Approach to Estimate CA and CC", "Regression in the population space".
- Simulation sections: "Simulation Study" (23 Psy + 32 JEM heading hits),
  with "Design"/"Method"/"Results" subsections; JEM adds "Evaluation
  Criteria".
- Application sections: "An Empirical Illustration", "Empirical Data
  Example", "Real Data Analysis", "Illustrative Applications", "Application".
- Closing sections: "Discussion" (55 + 60 hits) dominates; variants
  "Conclusion", "Concluding Remarks", "Conclusion and Discussion" are all
  attested. "Discussion" alone is always safe.
- Subsection titles are Title Case descriptive noun phrases and may contain
  notation or even a claim: "Coefficient alpha Cannot Be a Reliability Point
  Estimate Without Additional Assumptions".
- JEM methods use bold run-in paragraph headers ("**Data.** ", "**MH
  procedure** ") where Psychometrika would use numbered subsections.
- Recent-era JEM papers add back matter: Acknowledgments with grant numbers,
  Conflict of Interest, Declaration; recent Psychometrika papers add
  Supplementary Material with S-numbered tables.

### 2.2 The two-part empirical architecture

The default shape of a new-method paper in both journals is now:
**simulation study + empirical application**, each with its own design and
results narration. JEM's newest papers often reverse the order (empirical
illustration first, simulation second). A paper that proposes a method
without both is under-elaborated by current convention.

### 2.3 Structural dimensions in numbers

From the 240-paper quantitative sample (script `structure_stats.py`; full
tables in `corpus_stats.md` Section 11):

- **Sections per paper**: 6 top-level sections is the Psychometrika median
  (mean 5.8, p90 8); 7 for JEM (mean 7.6, p90 11). Counting all heading
  levels, both journals run about 16 headings per paper (p90 26-28).
- **Paragraphs per section** (mean / median / p90): Introduction 6.9 / 6 /
  12; Method/model 5.1 / 4 / 11; Simulation 4.0 / 3 / 9; Results 4.1 / 3 /
  10; Application 4.3 / 3 / 9; Discussion 5.6 / 5 / 9.
- **Sentences per section** (mean / median / p90): Introduction 36.5 / 32 /
  65; Method 18.7 / 14 / 39; Simulation 17.5 / 12 / 38; Results 19.8 / 15 /
  44; Application 21.3 / 16 / 43; Discussion 31.2 / 31 / 56. The
  introduction and the discussion are the two long-form sections; body
  sections are short and segmented by subheadings.

## 3. Rhetorical moves

### 3.1 Abstracts

One unlabeled, unstructured paragraph of 150-250 words. Fixed move order:

1. Context/problem (one or two sentences).
2. Gap or limitation of existing approaches.
3. What was done ("we propose", "a simulation study was conducted").
4. Design or data (one sentence).
5. Headline results, usually qualitative orderings rather than numbers
   ("the power of CDR was consistently higher than that of LR across all
   forms of DIF").
6. One applied payoff or implication.

69% of sampled abstracts contain "we"/"our" (Psychometrika 76%, JEM 63%);
post-2021 abstracts increasingly open with "We develop/We consider".
Abstracts carry no citations and almost no numbers.

### 3.2 Introduction openings

The first sentence frames the phenomenon or method family as important; it
never opens with the paper itself, a citation, a statistic, or a hook.
Five attested opening strategies:

- **Field frame**: "In item response theory (IRT), inferences are made about
  the ordering of subjects' latent scores on the basis of their responses to
  multiple test items."
- **Definition**: "Classification accuracy (CA) is the rate at which observed
  scores from a test classify examinees into the correct category."
- **Plain practical fact**: "Most achievement tests are administered within
  an allocated time." / "Dealing with missing values is an integral part of
  modern statistical analysis."
- **Practice anchor**: "For a certification, licensure, or placement exam,
  the pass rate is a key statistic that is closely monitored."
- **Concessive history**: "Though the origin of unfolding analysis for
  attitude measurement is often credited to Coombs (1950), ..."

### 3.3 The gap

The gap is always marked by an adversative ("However", "Although",
"Despite", "but") attached to a *missing capability*, never to an error.
Credit precedes the turn: the concessive clause praises prior work, the main
clause marks its boundary. Verbatim patterns:

- "Despite the successful applications of ESEM, they are based on
  factor-based SEM, and an exploratory procedure for component-based SEM has
  not yet been proposed."
- "However, sample size formulas based on confidence interval width are not
  available in the extant literature."
- "Although a variety of statistical procedures have been developed for
  detecting DIF, no single method is effective for detecting both uniform
  and nonuniform DIF."
- "However, the impact of the number of test retaking attempts on the pass
  rate itself, a crucially important statistic for many testing programs,
  has not been well studied."
- "Once a differential item functioning (DIF) item has been identified,
  little is known about the examinees for whom the item functions
  differentially."

Stock gap predicates: "has not yet been proposed", "is yet to be proposed",
"are not available", "has not been well studied", "little is known", "no
further work has been reported", "very little guidance appears in the
literature", "it is still unknown whether". Novelty-of-first claims are
always hedged: "It appears that the PKLM-test is the first MCAR test with
such a guarantee"; "To the best of our knowledge, there exists no study
that ...".

### 3.4 Contribution and purpose

Psychometrika favors two voices, both idiomatic:

- Impersonal: "In this paper, the gap that exists between the polytomous IRT
  models and the SOL property is bridged by proposing an additional
  constraint to the nonparametric PCM."
- Agentive: "In this paper, we prove that under mild regularity conditions,
  PVs are random variables of the form ..."

JEM favors an explicit purpose statement, often with "Therefore":

- "Therefore, the purpose of this study is to investigate, through
  simulations, the relative performance of five item calibration procedures
  ... under various testing conditions."
- "The purpose of the current study is to systematically explore the impacts
  of ignoring rater effects on student achievement estimates in mixed-format
  tests ..."

Contribution enumeration uses "The contribution of this article is
threefold. First, ... Second, ... Third, ..." or, in abstracts, the
"First, we defined ... Second, we conducted ... Third, we discussed ...
Finally, we applied ..." sequence. Research questions in JEM appear as
colon-led prose ("We focused on the following research question: ...") or,
newest era, as a terminal "Purpose" subsection; the numbered "RQ1:" format
is not used.

### 3.5 The roadmap

Every Psychometrika introduction closes with a one-paragraph roadmap, one
sentence per section: "The paper is organized as follows: ...", "The
remainder of the paper is organized as follows.", "The structure of this
paper is as follows." JEM roadmaps are optional and pedestrian when present
("The remaining sections of the article are laid out as follows."). Note the
"as follows" formula recurs everywhere in the genre: model formulations,
contribution lists, protocols ("We formulate the DINA Bayesian model as
follows:").

### 3.6 Limitations and future work

Limitations appear late in the discussion, are named plainly, and are framed
as *scope*, never as failure. They convert immediately into future-work
directives. Verbatim pivots:

- "Although the results of this study indicate that CDR was the single most
  effective method ..., there are several limitations of these results that
  deserve recognition. First, ... Second, ... Finally, ..."
- "One limitation of this study is that we have not fully investigated
  different possible parameterizations of SIRT-MM models."
- "With that said, the study is limited in several aspects."
- "In other words, the current study merely serves as a first attempt to
  realize the LHL mechanism by formulating the parametric model in the
  simplest way."

Future work is hedged and directional: "Some extensions to relax these
assumptions may be considered in future research." / "More research is
needed to see how useful this feature can be in applied studies." /
"Therefore, one direction for future research would be the derivation of
necessary and sufficient generic identifiability conditions ...".

JEM adds a generalization-caution idiom: "We advise caution regarding
generalization of results from this study, especially results from the
simulation study, as testing programs differ substantially in their
policy ...".

### 3.7 Implications for practice (JEM, obligatory)

JEM discussions address named practitioners directly and issue direct
recommendations:

- "Our findings have several implications for researchers and practitioners
  who work with mixed-format assessments."
- "Since checking the parametric assumptions is a nontrivial task, we
  recommend using the nonparametric approach as a safer, if not better,
  method to estimate CA and CC."
- "For a simple SIRT-MM model, we recommend N = 500 or more."

Psychometrika issues recommendations more rarely and more abstractly; when it
does, the same "we recommend" formula applies.

## 4. Paragraph patterns

Paragraphs are long, uniform blocks: Psychometrika runs a median of 73
words per paragraph (mean 92, p90 194), JEM a median of 100 (mean 110, p90
206). In sentences: median 3-4 per paragraph (Psychometrika mean 4.0, JEM
4.5), p90 at 8. One-sentence paragraphs run at 16% corpus-wide, but they are
almost all equation glosses (the "where ..." sentence standing alone after
a display). In running prose a one-sentence paragraph is a register
violation.

Paragraphs are deductive: topic sentence first, elaboration, then a closing
sentence that summarizes or pivots. No suspense structure, no delayed
reveals. Recurring paragraph genotypes:

- **Literature paragraph**: opens by naming one model or study ("Masters'
  (1982) partial credit model (PCM) is a polytomous IRT model which ..."),
  elaborates, evaluates in a closing sentence that feeds the next paragraph.
- **Method paragraph**: opens with a passive-past procedural sentence
  ("Responses to an artificial test were generated according to a
  three-parameter logistic model (Lord, 1980).") and proceeds
  chronologically.
- **Results paragraph**: opens with a display pointer plus headline ("Table 4
  presents the rejection rates for MH, BD, CDR, and LR ... as a function of
  sample size ..."), then moves from the most important pattern to
  exceptions.
- **Discussion paragraph**: restates one finding in plain words, then
  interprets under hedges.

How paragraphs open (240-paper sample, n = 15,161): 85% open with a plain
topical sentence (subject-first, no connective); 6.0% open with a
connective; 4.2% with a display pointer; 2.6% with anaphoric
"this/these"; 2.1% with a locative "in this ...". The most frequent
paragraph-initial trigrams: "in this section" 66, "in addition to" 63,
"in this paper" 61, "in this study" 53, "figure/table shows the" 48/46,
"in order to" 46, "note that the" 34, "the purpose of" 33, "the results of"
32, "as shown in" 28. Anaphoric "This + noun" is the primary cohesion
device: "this study" 47, "this article" 35, "this paper" 25, "this section"
21, "this approach/result/model" recurring.

How paragraphs close: 14-15% of paragraph-final sentences open with a
connective; the most frequent first words of closing sentences are
"this/these" (1025 combined), "however" (284), "thus" (246), "therefore"
(193), "finally" (130). The closing sentence states a consequence, an
interpretation, or a pivot; it never ends on a question or a bare number.

How sentences connect within the paragraph: 13.5-14.5% of all sentences
open with an explicit connective ("However", "Thus", "For example", ...);
6.0-6.6% open with anaphoric "this/these/such". The remaining ~80% connect
through lexical repetition: adjacent sentences share content words at a
mean Jaccard of 0.07-0.08, i.e., roughly one content word in twelve carried
over verbatim. The genre's glue is repeated terminology plus sparse,
well-placed connectives, not dense transitional scaffolding.

Inter-paragraph connectives (per 10k sentences, combined): "However" 219,
"Thus" 103, "Therefore" 86, "Note (that)" 82, "Specifically" 56,
"Furthermore" 54, "Moreover" 44, "Hence" 37, "Similarly" 33, "Additionally"
25, "Consequently" 23, "Nevertheless"/"Nonetheless" 19 combined. The
contrast turn "However," is the single most characteristic sentence opener
of the genre. Enumeration inside paragraphs uses "First, ... Second, ...
Third, ... Finally, ..." or "(i) ... (ii) ... (iii) ..."; whole simulation
protocols are narrated this way.

## 5. Sentence-level grammar

### 5.1 Person and voice

- "we": 82.9 per 10k words in Psychometrika, 37.0 in JEM. It marks agency
  for procedures and claims. First-person singular "I": zero in research
  articles (the only occurrences are in book reviews). "The authors": 0.8
  per 10k, over 70 times rarer than "we"; avoid.
- Passive voice concentrates where the actor is irrelevant: procedures, data
  genesis, received facts ("were generated", "was collected", "is assumed",
  "is defined"). Passive-proxy bigram rate: ~49 per 10k words in both
  journals; the journals differ not in passivization but in how much "we"
  they mix in.
- Generic "one" is a live Psychometrika device: "one can distinguish", "one
  could argue" (76 hits in six older articles).
- "This paper/article/study" as agent of findings: 10.7 per 10k ("this study
  found that ...").

### 5.2 Tense by section

The single most quantitative finding: tense choice is verb-specific, not
section-specific, and each verb has a conventional default. Present/past
ratios for "we + verb" (combined corpus):

- Strongly present: *present* 10.6x, *discuss* 10.4x, *propose* 8.9x,
  *assume* 6.4x, *consider* 4.7x, *show* 4.3x, *demonstrate* 3.3x.
- Mixed: *apply* 1.9x, *investigate* 1.7x, *develop* 1.4x, *use* 1.2x,
  *compare* 1.0x.
- Strongly past: *find* 0.51x, *examine* 0.55x, *conduct* 0.43x,
  *perform* 0.83x, *evaluate* 0.85x.

The underlying rule: present tense for the paper's standing acts and for
settled knowledge ("we propose", "the PCM imposes", "the MH chi-square
yields", "Table 1 shows"); past tense for completed study events ("we
conducted the simulation study", "the data were collected", "1000
replications were generated"); present perfect in discussions to recap the
paper's own arc ("We have investigated a Bayesian finite PL mixture ...").

### 5.3 Sentence shape

Long and hypotactic. The full distribution (240-paper sample, prose
sentences; words): Psychometrika mean 22.7, p10 9, p25 14, median 20, p75
29, p90 39, p99 66, with 9.4% of sentences at 40+ words; JEM mean 24.7,
p10 11, p25 16, median 23, p75 31, p90 41, p99 65, with 11.1% at 40+
words. (The `corpus_stats.py` pass, with slightly different cleaning, gives
means of 25.7 and 29.9; either way, the practical target is a mean in the
mid-to-high 20s with a long right tail.) Length varies by section:
introductions (mean 25.3) and discussions (25.6) run the longest sentences,
method and simulation sections the shortest (~23). Mathematical symbols
appear mid-sentence as grammatical constituents ("letting K be the total
number of answer choices and assuming the examinee does not have any
knowledge of a test item, the probability of guessing the correct response
... is 1/K"). Stacked subordination with "such that", "so that", "in the
sense that" is normal in theory sections. Short sentences are used
sparingly and carry weight when they appear.

### 5.4 Hedging and boosting

Hedges per 10k words (combined): *may* 15.9, *could* 7.2, *might* 4.5,
*likely* 3.3, *often* 4.3, *typically* 2.6, *generally* 2.6, *relatively*
2.8, *suggest(s)* 3.8 combined, *tend(s) to* 2.0, *appears/appear* 2.6,
*seems/seem* 2.0. Boosters are scarce: *clearly* 1.1, *indeed* 1.0,
*importantly* 0.5, *notably* 0.3, *obviously* 0.2, *certainly* 0.3.

The distributional law matters more than the inventory: **hedges attach to
interpretation and generalization; display facts and derivations are
unhedged.** "Table 1 shows that power exceeded .80" (no hedge) but "the
results suggest that the procedure may be robust to ..." (double hedge).
Signature hedge forms: "may be restrictive", "seems to suggest", "appears to
be", "would appear to" (JEM), "tends to", "to the best of our knowledge",
"suggest(s) that" (44 hits in one seven-paper JEM batch). JEM's own hedge of
record is "warrant(s)": "warrant additional consideration", "warrants
further study".

## 6. Lexicon

### 6.1 Verbs

Field verbs in order of centrality: estimate, propose, derive, formulate,
assume, present, evaluate, assess, examine (the JEM workhorse, 239 hits in
seven papers), investigate, demonstrate, illustrate, extend, generalize,
yield, impose, recover (as in "parameter recovery"), fit, conduct, simulate,
address, account for, incorporate, outperform. Reporting verbs are
indicate/show/suggest; "prove" is reserved for theorems.

Absent from the corpus entirely or nearly: *leverage*, *delve*, *shed light
on*, *pave the way*, *harness*, *unveil*, *revolutionize*. Self-applied
*novel* does not occur; the corpus says "new" at most, usually just
"proposed".

### 6.2 Nouns and adjectives

Nouns: model, assumption, property, parameter, estimate, (latent) variable,
distribution, procedure, framework, formulation, setting(s), condition(s),
scenario, replication, simulation study, sample size, test length, power,
Type I error rate, model-data fit, special case, consequence,
restriction(s)/constraint(s); JEM adds examinee, testing program,
operational administration, large-scale assessment, cut score, pass rate,
equating/linking/concordance, rater effects, validity, fairness,
practitioners, score users.

Adjectives: parsimonious, feasible, nonparametric, distribution-free,
robust, weakly/noninformative (priors), satisfactory, substantial,
considerable, salient, nonnegligible, systematic, computationally
prohibitive, cumbersome, easy-to-use, powerful. Evaluative adjectives stay
technical: "attractive alternative", "computationally simple", "conceptually
appealing", "realistic", "meaningful".

### 6.3 Stock phrases

Per 10k words (combined): "based on" 14.1, "for example" 7.3, "due to" 5.0,
"note that" 4.5, "in terms of" 3.2, "with respect to" 2.9, "as follows" 2.6,
"so that" 2.5, "in order to" 2.2, "such that" 2.1, "in contrast" 2.0, "in
particular" 1.9, "for instance" 1.8, "on the other hand" 1.4, "as shown in"
1.4, "consistent with" 1.4, "in the context of" 1.4. Rare but marked:
"it should be noted" 0.5, "it follows that" 0.3, "without loss of
generality" 0.2, "it is well known" 0.1, "as can be seen" 0.3, "it turns
out" 0.1.

"Respectively" is the signature sentence-final tag (33-61 hits per close
batch). "i.e." (10.6 per 10k) and "e.g." (12.4 per 10k) are the dominant
clarification devices, comma-flanked inside parentheses; "cf." is nearly
extinct (0.1). "et al." runs at 22.2 per 10k.

## 7. Math in prose

The genre's most distinctive discipline: **every equation effectively
appears twice, once symbolic and once verbal.**

1. Notation is introduced with present-tense imperative frames: "Let X
   denote ...", "Let Y = (Y1, ..., Yk)' be the random vector of item
   scores.", "Consider a situation in which a set of k items is administered
   to a sample of ...", "Suppose that ...", "Assume that ...". Index
   conventions are stated once ("We use subscript i = 1, ..., N to index
   subjects, j = 1, ..., J to index items").
2. Display equations are numbered and referred to as "Equation (5)", "Eq.
   (4)", "in (1)"; derivation steps are narrated with yield-verbs:
   "Substituting Equations (2) and (3) into Equation (1) gives ...",
   "Expanding Equation 4 and setting the result equal to zero yields ...".
3. Every display is followed by a "where"-sentence glossing each symbol in
   order, then a plain-language interpretation: "If there is no DIF, only
   beta0 and beta1 should be nonzero. The extent to which beta2 differs from
   zero provides evidence of uniform DIF."
4. Consequences are restated in words immediately after algebra: "In other
   words, examinees with ability higher than the cut will pass the test with
   probability 1 ...".
5. Models are named and abbreviated at first mention ("hereinafter
   abbreviated as BNPPLM"; "which we call the 'SIRT-MM' models").
6. Heavy formalism is quarantined: proofs to lettered appendices ("It can be
   shown that ..." defers the proof), algorithms to numbered floats
   ("Algorithm 2 summarizes the testing procedure."), code to supplements.
7. Recent papers add a dedicated "Notation" section with a summary table.

## 8. Reporting results

### 8.1 Display references

"Table/Figure N + verb" is a fixed formula. Verb ranking from the corpus:
*shows* (dominant: 121 table + 154 figure constructions), then *presents*,
*summarizes*, *displays*, *gives*, *provides*, *reports*, *lists*,
*contains*. Displays are present-tense agents: "Table 1 shows", never
"showed". Alternate frame: "As shown in Table 6, all parameters are well
recovered in the four conditions ...".

### 8.2 Simulation narration grammar

Fixed sequence: purpose ("The first study aims to evaluate ... The second
study examines ...") --> design factors with exact levels, fully crossed
("Crossing the two levels each of sample size and ability distribution
equality yielded four conditions.") --> data-generating mechanism -->
evaluation metrics defined by formula --> replication count ("Each condition
was replicated 200 times.") --> findings tied to tables. Every level choice
is justified, usually by precedent: "These distributions were chosen to
resemble values observed in previous simulation studies."

### 8.3 Findings language

Claim-first, trend-shaped, hedged at the inference: "The results show that,
as N gets larger, the SE and RMSE for the item parameter estimates decrease
and the bias quickly converges to zero in all the conditions, suggesting
that our estimation method could yield satisfactory item parameter
recovery ...". Stock verdicts: "well recovered", "good parameter and score
recovery", "precisely estimated", "maintained Type I error rates at or below
the nominal level of .05". Interpretation rides on implying/indicating
clauses: "implying that both models performed well in terms of classifying
examinees ...". Anomalies are explained, never hidden: "For n >= 500, some
of the 1000 replications encountered difficulties with the estimation of the
Bayes factor (empty cells in Table 1), as the constraints were so unlikely
that ...". Non-interpretation is announced: "Therefore, we did not interpret
the results for these effects in detail." Space-saving is declared: "we only
present results of Items 1 and 2 to save space."

### 8.4 Number style

Decimals to 2-4 places; leading zero dropped for bounded statistics (".80",
".05", "-.22") in most papers, retained in some post-2024 JEM papers
("0.038") as APA 7 pushes retention; the field is visibly mixed. Percentages
with %; inline parenthetical pairs for comparison ("(.75 for the CDR vs. .42
for LR-C)"); inline ranges ("(.30 <= MAE <= .77)"); inline statistics in
italic shorthand ("(M = .98, SD = 1.06)", "(p < .01)"). Thresholds are
justified by citation: "We used 0.06 as a cutoff for a salient effect
(Cohen, 1988)." Recent papers report computation time and hardware: "The
computation time in total was 8 seconds. We used a laptop."

## 9. Citation practices

Author-year throughout, narrative and parenthetical mixed. Narrative
citations carry load-bearing predecessors ("Swaminathan and Rogers (1990)
applied the LR model to the detection of both uniform and nonuniform DIF");
parenthetical clusters map territory ("(e.g., Lord, 1980; Thissen,
Steinberg, & Wainer, 1988, 1993)"). "e.g." introduces citation clusters;
"cf." is nearly extinct. Pin cites accompany quotations.

Criticism is concessive, capability-focused, and attributed to work, not
persons: "Their test is completely nonparametric and shown to be consistent.
... An application area where their proposed test struggles is for
higher-dimensional data ...". Agreement with predecessors is a required
discussion move: "The results of this study were consistent with those of
previous research. First, in agreement with Narayanan and Swaminathan's
(1996) study ...". Credit is generous and explicit: "Following Tijmstra et
al. (2013), we chose ..."; "The code for the Q-test was kindly provided to
us by the authors."

## 10. Register, tone, taboos

Formal, impersonal, compressed, unironic. Across all close-read research
articles: zero contractions, zero exclamation marks, zero first-person
singular, zero rhetorical questions in prose (rare, admitted only in
conceptual JEM papers), zero humor, zero reader address. No
"interestingly"/"surprisingly" openers ("interestingly" runs at 7.5 per 10k
*sentences* corpus-wide but is absent from the tightest prose; treat it as
marked). No hype adjectives about the authors' own work beyond
"powerful/flexible/easy-to-use", and those only in discussions, with
demonstrated comparison behind them. The outer bound of color is a cited
allusion ("One may say they are searching for a holy grail (Davies, 2010).").

The genre's own book reviews break every one of these rules (humor,
evaluation, first person), which confirms the research article is a
distinct, tighter dialect. Non-native small grammar errors pass into print;
the register rewards precision over polish.

## 11. Journal differences at a glance

| Dimension | Psychometrika | JEM |
|---|---|---|
| Audience | methodologists | measurement practitioners |
| "we" rate | 82.9 / 10k words | 37.0 / 10k words |
| Mean sentence length | 25.7 words | 29.9 words |
| Formal apparatus | Theorem/Lemma/Proof blocks | quarantined derivations, verbal gloss |
| Purpose statement | contribution sentence | obligatory "The purpose of this study is ..." |
| Implications for practice | rare | obligatory, named audience |
| Signature hedge | "to the best of our knowledge" | "warrant(s)", "would appear to" |
| Intro heading | always "1. Introduction" | untitled before ~2021 |
| Sentence openers | Let/Then/If/Since high | Table/Figure pointers high |

## 12. Era drift (2011-2016 --> 2021-2025)

1. Abstracts open with "We develop/We consider" instead of third-person
   topic sentences.
2. "we" saturates methods narration where older papers leaned passive.
3. Software availability becomes near-mandatory: R package + GitHub + CRAN,
   announced in abstract or contributions ("Finally, we make our test
   available through the R-package PKLMtest, available on ... and on
   CRAN.").
4. Supplementary Material with S-numbered tables displaces appendices for
   results overflow.
5. Transparency tics: hardware and computation time reported; exact package
   names given; reviewer-requested analyses disclosed in prose ("As
   suggested by a reviewer, interactions between such factors should also be
   evaluated.").
6. JEM back matter professionalizes: Conflict of Interest, Declaration,
   grant numbers; "available upon request" dies out.
7. Explicit "Introduction" heading becomes standard in JEM.
8. Number style begins to retain leading zeros under APA 7; still mixed.

## 13. What would look out of place

A sentence-level shibboleth list, distilled from everything above:

- Any contraction, exclamation mark, or first-person singular.
- "Novel", "groundbreaking", "cutting-edge", "state-of-the-art" applied to
  one's own work.
- "Leverage", "delve", "shed light on", "pave the way", "In today's world",
  "It is important to note that" (the corpus's formula is "Note that" or
  "It should be noted that").
- Journalism ledes, rhetorical questions, bullet-list prose, second person.
- Unhedged universals about data ("this proves the method works"); hedged
  display facts ("Table 1 may show ...").
- Past-tense display references ("Table 1 showed").
- Singular "this paper proposes" mixed with plural "we" in the same
  paragraph without need (both are fine alone).
- Citations or numbers in the abstract.
- A "Literature Review" heading; an "RQ1:" numbered list; a structured
  abstract with labeled subheadings.

## 14. Source documents

- `sources/psychometrika-2012-2016.md`: close reading, 6 articles + 2 book
  reviews.
- `sources/jem-2005-2014.md`: close reading, 6 articles + 1 book review.
- `sources/jem-2014-2025.md`: close reading, 7 articles with era analysis.
- `sources/psychometrika-2016-2025.md`: close reading, 7 articles + 1
  rejoinder, with era analysis.
- `corpus_stats.md` / `corpus_stats.py`: quantitative statistics over 240
  papers (120 per journal).
