# Psychometrika Prose Conventions: Corpus Analysis (2016-2025)

Close-reading report from the corpus analysis (subagent batch 2). Corpus
note: of the 9 assigned files, `10.1007:s11336-019-09681-6.md` is an 18-line
erratum notice, not a paper, and is excluded. `10.1007:s11336-021-09807-9.md`
is a rejoinder (Sijtsma and Pfadt replying to discussants), a distinct genre
noted where relevant. The other 7 are standard research articles.
Springer-era files show citation artifacts like `(Reference Marden1995)` --
conversion artifacts of author-year citations; underlying style is APA-like
author-year.

## 1. Document Architecture

Fixed skeleton (all 7 research articles): Abstract (single paragraph,
150-250 words, no keywords visible) --> Introduction --> Model/Method
sections (one or more, often the bulk) --> Simulation study --> Real/
Empirical data application --> Discussion/Conclusion. Proofs and technical
details go to Appendices; extra tables go to Supplementary Material.

Verbatim top-level headings observed:

- Introduction: `1. Introduction`, `Introduction` (unnumbered, 09942-5),
  `1 Introduction` (Cambridge psy papers), or no heading at all --
  022-09854-w's introduction runs untitled after the abstract and section
  numbering starts at `1. Sample Size Determination`.
- Method: `2. The Plackett-Luce Model`, `2. Proposed Method`, `2 Methods`,
  `2 Notation`, `3 Testing framework`, `2 Regression in the population
  space`.
- Simulation: `4.1. Simulation Study`, `4. Monte Carlo Simulation Study`
  (with `4.1. Settings` / `4.2. Results`), `3 Numerical Simulation` (with
  `3.1. Study 1: Parameter Recovery by EGSCA`, `3.1.1. Design`, `3.1.2.
  Results`), `3 Simulation studies` (`3.1 Simulation design`, `3.2
  Results`), `5.1 Simulated data` / `5.2 Real data`.
- Application: `4. Illustrative Applications`, `5. Real Data Analysis`,
  `4. Real Data Example`, `4 Empirical analysis`, `5 Two empirical examples
  and one simulation experiment`, `3. Numerical Examples`.
- Closing: `5. Concluding Remarks and Future Work`, `6. Discussion`,
  `5. Conclusion`, `5 Discussion`, `7 Concluding remarks`, `4. Conclusion
  and Discussion`.

Subsection titles are descriptive noun phrases, sometimes containing
notation: `2.3. Coefficient alpha Cannot Be a Reliability Point Estimate
Without Additional Assumptions`; `1.1.3. Sample Size Formula Based on Wilson
Confidence Interval`. psy.2024.14's introduction has `1.1 Contributions` and
`1.2 Related work`, a recent-era innovation. Footnotes appear as `Footnote
1` markers (9 across the corpus); appendices are lettered ("Appendix A
contains the proofs of all results, while Appendix B adds some additional
details").

## 2. Rhetorical Moves

Introduction openings: first sentences establish the phenomenon or method
family as important, never the paper itself:

- "Choice behavior is a theme of great interest in several research areas,
  such as social and psychological sciences..." (016-9530-0)
- "Traditional direct questioning methods face limitations when socially
  sensitive topics are studied." (022-09854-w)
- "Dealing with missing values is an integral part of modern statistical
  analysis." (psy.2024.14)
- "Hidden Markov models (HMMs) are widely known for their applications to
  finance..." (09904-x)
- "Structural equation modeling (SEM) ... is widely used across various
  fields including Psychology and Sociology..." (09942-5)

Abstracts, by contrast, may open with "we" in the recent era: "We develop a
fully nonparametric, easy-to-use, and powerful test..." (psy.2024.14); "We
consider a test which allows students to attempt a multiple-choice question
multiple times..." (psy.2024.18).

Gap statements (verbatim): "Despite the successful applications of ESEM,
they are based on factor-based SEM, and an exploratory procedure for
component-based SEM has not yet been proposed." (09942-5) / "an appropriate
model is yet to be proposed for a multiple-attempt procedure with
multiple-choice items" (psy.2024.18) / "However, sample size formulas based
on confidence interval width are not available in the extant literature."
(022-09854-w) / "Classical identifiability conditions shown in previous
studies are too strong for practical analysis." (09904-x) / "there has not
been a lot of progress on distribution-free MCAR tests" (psy.2024.14) / "An
application area where their proposed test struggles is for
higher-dimensional data with little or no complete observations."
(psy.2024.14). Pattern: concessive clause crediting prior work plus "has not
yet been proposed / is yet to be proposed / are not available / too strong
for practical analysis".

Contribution announcements: "The purpose of our paper is to contribute to
the body of research on..." (09904-x); "The purpose of this study is to
propose SIRT models for multiple-choice, multiple-attempt items (SIRT-MM).
First, we defined... Second, we conducted... Third, we discussed... Finally,
we applied..." (psy.2024.18, abstract; enumerated First/Second/Third/Finally
is the standard abstract contribution format); "Our contributions can be
summarized as follows:" (psy.2024.14).

Roadmap paragraph closes every introduction, one sentence per section: "The
outline of the article is the following." (016-9530-0) / "The remainder of
the paper is organized as follows." (09904-x) / "This article is organized
as follows." (022-09854-w) / "The paper is structured in the following way."
(psy.2024.14) / "The structure of this paper is as follows." (psy.2024.19) /
"The remaining parts of this article are organized as follows." (09942-5).

Limitations appear late in the discussion, named plainly: "One limitation of
this study is that we have not fully investigated different possible
parameterizations of SIRT-MM models." (psy.2024.18) / "A few additional
limitations should be noted about the current study." / "A restriction of
our proposed sample size formulas relies on the specifications of relative
accurate values of the prevalence rate" (022-09854-w) / "It should be noted
that the EGSCA does not provide an automatic process in model exploration."
(09942-5). Limitations are immediately converted into future work: "Future
work could consider regularization for item parameter estimation or Bayesian
estimation..." (psy.2024.18).

Future work: "A possible future development could be the Bayesian estimation
of the mixture of Extended PL..." (016-9530-0) / "Therefore, one direction
for future research would be the derivation of necessary and sufficient
generic identifiability conditions for discrete time HMMs." (09904-x) /
"Future research may be able to extend their proof technique to..." /
enumerated lists: "To conclude the article, we list some possible directions
for the future study. First, ... Second, ... Third, ..." (09942-5).

## 3. Paragraph Patterns

Paragraphs are long (5-12 lines), deductively organized: topic sentence
first, elaboration, then a closing sentence that either summarizes or
pivots. Standard paragraph openers: "In this section, we...", "In this
paper, we...", "We next report results from...", "To evaluate the formulas
proposed in this article, we consider the following parameter settings", "As
mentioned earlier/above...", "The above simulation studies are based on the
assumption that...". Inter-paragraph transitions are explicit connectives:
However (46 occurrences across 8 papers), Moreover (13), Furthermore (7),
Specifically (12), In particular (10), On the other hand, In contrast, Taken
together, In sum, Overall. Enumeration inside paragraphs uses "(i) ...
(ii) ... (iii) ..." or "First, ... Second, ... Third, ..." (the full
simulation protocol in 022-09854-w is narrated exactly this way).

## 4. Sentence-Level Grammar

Person: "we" is overwhelming (about 650 occurrences). It marks agency for
procedures ("we generated response matrices", "we conducted three simulation
studies") and claims ("we propose", 10x; "we present", 9x; "In this
paper/article/study", 21x). First-person singular "I" never occurs; the
single-author paper (09942-5) uses "the research", "the study", "this
article", and "To the best of the author's knowledge". Passive voice is
reserved for procedures where the actor is irrelevant: "the data matrix Z
was synthesized", "the attribute profile is generated uniformly from all
possible 2^K cases", "responses to two sets of J=12 questions ... observed
before and after some instructions".

Tense: present for paper-internal facts and table/figure commentary ("Table
3 shows", "Section 2 introduces", "the RMSE becomes smaller as the time
period gets longer"); past for completed study procedures ("We conducted the
simulation study", "The data was collected between May 2023 to March 2024",
"305 employees in South Korea answered a questionnaire"); present perfect in
discussions to recap the paper's own arc ("We have investigated a Bayesian
finite PL mixture...", "This article has proposed and formally derived a
family of new sequential item response models").

Sentence shape: long and hypotactic, with mathematical symbols embedded
mid-sentence as grammatical constituents ("letting K be the total number of
answer choices and assuming the examinee does not have any knowledge of a
test item, the probability of guessing the correct response ... is 1/K").

Hedging (verbatim inventory): may (49), might (24), could (68), "appears
to" (6), "seems to" (5), "tends to", "it appears that", "suggests that"
(6), "possibly", "potentially", "generally" (12), "typically" (4),
"usually", "often", "relatively", "approximately", "reasonably", "roughly",
"quite" ("quite satisfactory", "quite close"), "to the best of our
knowledge" (3). Boosters: "clearly", "indeed", "remarkably", "consistently",
"significantly", "crucially", "importantly", "most importantly", "by a wide
margin", "blatant inflation of the type-I error", "grossly inflated", "very
competitive". Boosters attach to results; hedges attach to interpretation
and generalization.

## 5. Lexicon

Field verbs: propose, derive, formulate, estimate, evaluate, assess,
demonstrate (27), illustrate (9), recover ("parameter recovery", 35),
outperform (6), address, account for, incorporate, circumvent, generalize,
extend, fit ("models were fitted to"), conduct, report, summarize. Nouns:
framework, formulation, procedure, setting(s), condition(s), scenario,
replication, coverage probability, assurance probability, identifiability,
heterogeneity, indeterminacy, utility, feasibility, benchmark. Adjectives:
parsimonious, feasible, cumbersome, nonparametric, distribution-free,
weakly/noninformative, satisfactory, substantial, considerable,
computationally prohibitive, easy-to-use, powerful. Stock collocations with
counts: "respectively" (61), the signature sentence-final tag; "i.e.,"
(150) and "(i.e." (50); "e.g.," (41) / "(e.g." (19); "Note that / note
that" (26); "It should be noted that / it is worth noting that" (8); "To
the best of (our/the author's) knowledge" (3); "as follows" (roadmaps,
contribution lists, model formulations: "We formulate the DINA Bayesian
model as follows:"); "in the sense that"; "along the lines of"; "up to a
permutation of states"; "burn-in period".

## 6. Math in Prose

Notation is introduced with "Let X be/denote..." ("Let X_j be a random
variable representing the number of attempts...", psy.2024.18), "We denote
by X...", "by denoting with K the total number of items" (016-9530-0), and
index conventions stated once ("We use subscript i=1,...,N to index
subjects, j=1,...,J to index items...", 09904-x). psy.2024.14 devotes a
whole `2 Notation` section with a summary table. Equations are numbered and
referenced as "in (1)", "Eq. (4)", "Equation (11)", "formulation (1)", "the
criterion in (1) is rewritten as". Models are named, abbreviated at first
mention, and thereafter cited by acronym ("hereinafter abbreviated as
BNPPLM", "we refer to this condition as complete ignorance", "which we call
the 'SIRT-MM' models"). Algorithms are float objects referenced by number:
"The full sampling steps of all parameters are shown in Algorithm 1."
(09904-x); "Algorithm 2 summarizes the testing procedure." (psy.2024.14).
Simulation protocols are given as imperative-free prose step sequences
("First, given the expected prevalence... Second, based on the estimated
sample size..., 10000 random samples are generated... Third, ... we
calculate the proportion...", 022-09854-w) or as enumerated condition lists
("(a) Warner model: (1) p = 0.3, 0.6, 0.8; (2) ...; i.e., a total of
3 x 4 x 2 = 24 parameter combinations.").

## 7. Reporting Results

Simulation narration follows a fixed grammar: purpose ("This section reports
the results of the two numerical simulation studies. The first study aims to
evaluate... The second study examines...", 09942-5) --> design factors with
levels --> data-generating mechanism --> evaluation metrics defined by
formula ("we report the average element-wise accuracy rate (EAR)...
Furthermore, we compute the average root mean squared error (RMSE)...") -->
replication count ("We repeated the simulation study 100 times for each
setting", "Each experiment was rerun nsim=300 times") --> findings tied to
tables ("Simulation results for assessing the accuracy ... are reported in
Tables 1-5"). Findings use trend language: "The results show that, as N gets
larger, the SE and RMSE for the item parameter estimates decrease and the
bias quickly converges to zero in all the conditions, suggesting that our
estimation method could yield satisfactory item parameter recovery for all
conditions given a large enough N." (psy.2024.18). Practical recommendations
are issued directly: "For a simple SIRT-MM model, we recommend N = 500 or
more." Numbers: percentages with % ("an agreement rate of 81%"), decimals to
2-4 places, thousands separators in tables ("17,866.36"), inline math for
statistics. Tables/Figures: "Table 3 shows...", "Figure 2 shows the plot
of...", "see Table 1", boldface conventions explained in prose ("We
boldfaced the results for each row in the tables in the following
manner:"). Computation time is reported as a result: "Table 2 shows the
average computation time for our simulation study using a MacBook Pro with
2.3 GHz Intel Core i5 processor." (09904-x); "The computation time in total
was 8 seconds. We used a laptop." (psy.2024.19).

## 8. Citation Practices

Author-year, both narrative ("Dowling and Shachtman (1975) proved that UQM
usually yields a more reliable sensitive prevalence estimate", "Allman,
Matias, and Rhodes (2009) defined generic identifiability as...") and
parenthetical ("(see e.g., Lehmann and Romano, 2005)", "(for details, see
Fox & Tracy, 1986; ...)"). "cf." is rare; "i.e./e.g." are
parenthetical-workhorses. Credit is polite and precise; criticism is
concessive and attributes to work, not person: "Their test is completely
nonparametric and shown to be consistent. Empirically it is shown to keep
the level... An application area where their proposed test struggles is..."
(psy.2024.14). Help is acknowledged: "The code for the Q-test was kindly
provided to us by the authors." The rejoinder models maximum civility: "We
thank Peter Bentler, Eunseong Cho, and Jules Ellis for their valuable and
instructive comments"; "Bentler (2021) correctly points out that..."; "and
he is right." Open science (recent era): software shipped with the paper --
"Finally, we make our test available through the R-package PKLMtest,
available on https://github.com/missValTeam/PKLMtest and on CRAN."
(psy.2024.14); "We provide the R package on GitHub
https://github.com/luyikei/sirtmm to fit the SIRT-MM models."
(psy.2024.18); "we also developed program codes ... available to readers as
the supplementary material" (022-09854-w); "The program code may be
requested from the first author." (psy.2024.19). Supplementary Material is
referenced by label ("Supplementary Tables S1-S4", "Tables SM-1, SM-2, and
SM-3"). Reviewer-responsive additions are disclosed in prose: "we present
estimations on a simulated data set on request of one of the referees"
(psy.2024.19); "As suggested by a reviewer, interactions between such
factors should also be evaluated." (psy.2024.18).

## 9. Tone and Taboos

Register: formal, impersonal, confident but hedged. These authors never use:
contractions, "I", exclamation marks, rhetorical flourishes, value-laden
adjectives about their own work beyond "powerful/easy-to-use/flexible",
direct reader address. Rhetorical questions and wry asides exist only in the
rejoinder genre ("If you ask a psychometrician for a solution to a problem,
chances are that she will come up with an equation."), out of place in a
research article. Claims of novelty are always hedged ("It appears that the
PKLM-test is the first MCAR test with such a guarantee", "To the best of
the author's knowledge, this is the first research that extends GSCA to
exploratory purpose by rotation"). Non-native-speaker small grammar
irregularities pass into print; prose is judged on precision, not polish.

## 10. Golden Sentences

1. "The elicitation of an ordinal judgment on multiple alternatives is often
   required in many psychological and behavioral experiments to investigate
   preference/choice orientation of a specific population." (016-9530-0,
   abstract opener, importance framing)
2. "We develop a fully nonparametric, easy-to-use, and powerful test for the
   missing completely at random (MCAR) assumption on the missingness
   mechanism of a dataset." (psy.2024.14, abstract opener, we-first
   contribution)
3. "Traditional direct questioning methods face limitations when socially
   sensitive topics are studied." (022-09854-w, introduction opener)
4. "Despite the successful applications of ESEM, they are based on
   factor-based SEM, and an exploratory procedure for component-based SEM
   has not yet been proposed." (09942-5, gap statement)
5. "While existing SIRT models are suitable for a multiple-attempt procedure
   with constructed responses, an appropriate model is yet to be proposed
   for a multiple-attempt procedure with multiple-choice items."
   (psy.2024.18, gap statement)
6. "However, sample size formulas based on confidence interval width are not
   available in the extant literature." (022-09854-w, gap statement)
7. "The purpose of our paper is to contribute to the body of research on the
   identifiability of HMMs with particular focus on conditions for
   identifying parameters of restricted HMMs." (09904-x, purpose statement)
8. "In this paper, we try to circumvent these problems in a data-efficient
   way, by employing a one v.s. all-others approach and using random
   projections in the variable space." (psy.2024.14, approach announcement)
9. "The remainder of the paper is organized as follows." (09904-x, roadmap)
10. "Let X_j be a random variable representing the number of attempts an
    examinee needed to submit a correct answer on item j..." (psy.2024.18,
    notation introduction)
11. "We conducted the simulation study under different sample size (i.e.,
    N=500, 1000, and 2000), numbers of attributes (i.e., K=3, 4, and 5),
    the length of the time period..., and correlations among the
    attributes..." (09904-x, simulation design factors)
12. "We repeated the simulation study 100 times for each setting."
    (09904-x, replication boilerplate)
13. "Simulation results in Table 1 show a good recovery for the Q matrix."
    (09904-x, result narration)
14. "The results show that, as N gets larger, the SE and RMSE for the item
    parameter estimates decrease and the bias quickly converges to zero in
    all the conditions, suggesting that our estimation method could yield
    satisfactory item parameter recovery for all conditions given a large
    enough N." (psy.2024.18, result narration with hedged inference)
15. "For a simple SIRT-MM model, we recommend N = 500 or more."
    (psy.2024.18, practical recommendation)
16. "In this section, we apply Algorithm 1 to the Problems in Elementary
    Probability Theory data set (Heller & Wickelmaier, 2013)." (09904-x,
    application opener)
17. "It appears that the PKLM-test is the first MCAR test with such a
    guarantee." (psy.2024.14, hedged novelty claim)
18. "One limitation of this study is that we have not fully investigated
    different possible parameterizations of SIRT-MM models." (psy.2024.18,
    limitation)
19. "Therefore, one direction for future research would be the derivation of
    necessary and sufficient generic identifiability conditions for discrete
    time HMMs." (09904-x, future work)
20. "A possible future development could be the Bayesian estimation of the
    mixture of Extended PL recently introduced by Mollica and Tardella
    (2014)." (016-9530-0, future work)
21. "Finally, we make our test available through the R-package PKLMtest,
    available on https://github.com/missValTeam/PKLMtest and on CRAN."
    (psy.2024.14, open-science boilerplate)
22. "The code for the Q-test was kindly provided to us by the authors."
    (psy.2024.14, credit/acknowledgment)
23. "In this paper, we presented the powerful, flexible and easy-to-use
    PKLM-test for the MCAR assumption on the missingness mechanism of a
    dataset." (psy.2024.14, conclusion opener)
24. "We have investigated the effectiveness of our estimation algorithms in
    a simulation study with multiple heterogeneity scenarios." (016-9530-0,
    discussion recap, present perfect)

## 11. Drift vs. Older (2011-2016) Conventions

Within this corpus the drift is visible between the Springer 2016-2021
papers and the Cambridge psy.2024.x papers: (1) abstracts increasingly open
with "We develop/We consider" rather than third-person topic sentences; (2)
introductions gain structured Contributions and Related work subsections
(psy.2024.14); (3) software availability (R package + GitHub + CRAN) becomes
near-mandatory and is announced in the abstract and contributions; (4)
Supplementary Material with numbered S-tables/figures replaces appendices
for results overflow; (5) transparency tics appear: disclosing
reviewer-requested analyses, reporting hardware and computation time, naming
the exact packages used; (6) first-person "we" saturates even methods
narration, where older papers leaned passive. Abstracts remain
single-paragraph and unstructured throughout: no structured abstract or
keywords in either era.
