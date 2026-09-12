# Writing Like Psychometrika: A Corpus Style Report (2012-2016)

Corpus: 9 assigned files under `repertoire/md/`. Usable research articles: 6
(`s11336-012-9272-6`, `s11336-012-9277-1`, `s11336-013-9336-2`,
`s11336-013-9361-1`, `s11336-015-9475-8`, `s11336-016-9497-x`). Two assigned
files (`s11336-013-9351-3`, `s11336-013-9389-2`) are book reviews, used here
only as register contrast. One file (`s11336-012-9279-z`) is an empty
conversion (11 bytes, one image tag). Citation strings like "Reference
Rasch1960" are conversion artifacts of the author-date style; mentally read
them as "(Rasch, 1960)".

## 1. Document Architecture

Every article follows the same skeleton:

`Abstract` --> `1. Introduction` --> 2..n-2 named content sections -->
simulation section --> empirical section --> `N. Discussion` --> References.
Appendices occur in 4 of 6 articles; footnotes are rare (5 total).

Verbatim top-level headings observed:

- `1. Introduction` (always; numbered, never named otherwise)
- `2. Theory`; `2. An Extension of the Dutch Identity`; `2. An Interpolation
  Response Mechanism`; `2. Relevant Competing Hypotheses`;
  `2. Leave-the-Harder-till-Later Speeded Item Response Model`
- `3. The Gibbs Sampling Algorithm`; `3. Bayes Factors`;
  `3. Estimation Procedure`; `4. Parameter Estimation`;
  `4. Maximum Likelihood Estimation`; `5. Generalizations`;
  `6. Multi-group Extensions`
- `3.3. Simulation Study` / `4. Simulation Study` / `5. A Simulation Study`
  (with `4.1. Method`, `4.2. Results`, sometimes `3.3.3. Conclusion`)
- `7. An Empirical Data Example` / `5. Empirical Example` / `5. Application` /
  `6. Application on Real Data`
- `4. Discussion` / `6. Discussion` / `7. Discussion` / `8. Discussion`
  (always last, always titled exactly "Discussion")

Subsections are titled by content, numbered hierarchically (`3.3.1. Method`).
Theory-heavy papers interleave displayed blocks headed `Theorem 1`, `Lemma`,
`Proof`, `Definition`, `Example 1`. One paper (9497-x) uses question headings:
`5.1. What can we learn from Plausible Values?`, `5.3. What if we miss a
covariate?` -- the only questions anywhere in the corpus.

Content map: the Introduction is a self-contained literature review ending in
gap + contribution + (usually) a roadmap; no separate "Literature Review"
section exists. Middle sections define notation, the model, estimation, and
properties. Simulation and Application sections report evidence. Discussion
restates what was done, interprets, lists limitations, suggests extensions.

## 2. Rhetorical Moves

### 2.1 Introduction openings (first-sentence strategies)

- Frame the field: "In item response theory (IRT), inferences are made about
  the ordering of subjects' latent scores on the basis of their responses to
  multiple test items." (9272-6)
- State what a class of models does: "Multidimensional item response models
  can be used for factor analysis of polytomously scored items." (9277-1)
- State a mundane practical fact: "Most achievement tests are administered
  within an allocated time." (9336-2)
- Open with history, concessively: "Though the origin of unfolding analysis
  for attitude measurement is often credited to Coombs (1950), who coined the
  term, its history could be traced back to Thurstone's (1927) works on
  attitude measurement." (9361-1)
- Spotlight an assumption: "In item response theory (IRT) for dichotomously
  scored items, the assumption of latent monotonicity is shared by most
  parametric and nonparametric models." (9475-8)

Nobody opens with a hook, anecdote, or question.

### 2.2 Gap-marking (verbatim)

- "Hence, there seems to be a mismatch between the polytomous IRT models and
  the SOL property." (9272-6)
- "However, they also found that none of these models imply the SOL property."
  (9272-6)
- "However, in practice the interest is frequently in the moments of latent
  variables, and for the purpose of estimating these moments CMLE cannot be
  used." (9277-1)
- "no probabilistic model exists (as far as we know) to unfold continuous
  bounded responses (CBR) in an item response theory framework." (9361-1)
- "This specification is very simple but may be restrictive for some real
  cases." (9336-2)
- "Bejar (1985) uses this mechanism to explain certain discrepancies between
  the data and the traditional IRT model fittings, but does not formulate this
  mechanism by a parametric model." (9336-2)
- "The discussed frequentist approaches do not provide this kind of
  confirmatory support." (9475-8)

Pattern: concede the value of prior work, then mark its boundary with
"However", "but", "although"; the gap is always a missing capability, never a
predecessor's error.

### 2.3 Contribution announcements (verbatim)

- "In this paper, the gap that exists between the polytomous IRT models and
  the SOL property is bridged by proposing an additional constraint to the
  nonparametric PCM." (9272-6)
- "In the present paper, an extension of the Dutch Identity is presented in a
  form convenient for application under the multidimensional partial credit
  model." (9277-1)
- "In the present study, a new speeded IRT model is proposed based on the
  mechanism that examinees answer the easier items first and retain the harder
  ones to a later test period in order to achieve higher scores." (9336-2)
- "This article proposes a Bayesian approach to evaluating manifest
  monotonicity for dichotomous item scores, in line with the Bayesian
  informative hypothesis testing framework discussed by Hoijtink (2012)."
  (9475-8)
- "In this paper, we prove that under mild regularity conditions, PVs are
  random variables of the form ..." (9497-x)

Two house voices: impersonal passive ("In this paper, X is proposed/presented/
derived") and first-person plural ("we prove", "we show", "We propose").

### 2.4 Roadmaps (verbatim)

- "The paper is organized as follows: ..." (9361-1)
- "Details for the proposed model are presented in the next section. ... An
  application to the entrance examination data is illustrated in Section 5,
  followed by some concluding remarks in Section 6." (9336-2)
- "First, several hypotheses that are relevant for latent monotonicity are
  discussed. Second, ... Third, ... Fourth, ... The article concludes with a
  discussion." (9475-8)
- "The paper ends with a discussion." (9497-x)

### 2.5 Limitations and future work (verbatim)

- "In closing, we mention a limitation of our results." (9497-x)
- "There are several strong assumptions in LHL-IRT, such as the same
  speededness rate lambda for all the examinees and not allowing for guessing.
  In other words, the current study merely serves as a first attempt to
  realize the LHL mechanism by formulating the parametric model in the
  simplest way." (9336-2)
- "However, this approach runs the risk of masking violations for a particular
  item if the other items are monotone, ..." (9475-8)
- "That the isotonic PCM is more flexible than the PCM does not mean that the
  isotonic PCM will almost surely hold for a given data set." (9272-6)
- "Some extensions to relax these assumptions may be considered in future
  research." (9336-2)
- "It remains an issue to incorporate the nonresponse ..." (9336-2)
- "One possible extension of the isotonic PCM is to include such an item
  ordering, ..." (9272-6)
- "More research is needed to see how useful this feature can be in applied
  studies." (9361-1)
- "This possibility is still to be explored." (9361-1)

Limitations are framed as scope, not failure: assumptions are "strong", the
study is a "first attempt", features are "still to be explored".

## 3. Paragraph Patterns

Introduction paragraphs are long (8-15 lines) and monographic: one model or
one approach per paragraph, opened by naming it ("Masters' (1982) partial
credit model (PCM) is a polytomous IRT model which ..."; "Bolt, Cohen, and
Wollack (2002) utilize the mixture Rasch model ..."), then elaborated, then
evaluated in a closing sentence that feeds the next paragraph. Literature
paragraphs chain via contrast: "Based on the idea of mixture models, Cao and
Stokes (2008) propose ...", "Following the idea of examinee-specific
thresholds ..., Goegebeur et al. (2008) propose ...", "Instead of comparing
the threshold to item ordering such as that in HYBRID and IRT-GPC, the IRT
difficulty-based guessing model ... compares ...". Discussion paragraphs open
with restatement ("In this paper, ...", "In this study, ...", "This article
proposed ...") or with a substantive claim, then hedge. Transition devices, by
frequency in the corpus: "However" (ubiquitous), "In addition" (16),
"Furthermore" (14), "In contrast/By contrast" (13), "Moreover" (11), "As a
consequence", "Consequently", "Therefore", "Thus", "Hence" (28), "For
example", "For instance".

## 4. Sentence-Level Grammar

Person: "we/We" 159 occurrences in the six articles; first-person singular
zero; "the authors" zero; impersonal "it is/It is" 63; existential "there is/
are" 31; generic "one" 76 ("one can distinguish", "one could argue"). Passive
is heavy in methods and math: "is proposed", "are assumed", "were generated",
"was applied", "has been fitted to the data".

Tense by section: present for facts, model properties, and table/figure
commentary ("the PCM imposes constraints", "Table 1 shows"); past for
procedures and simulations ("conditions similar to those discussed by Tijmstra
et al. (2013) were used", "1000 replications were generated", "the posterior
mean was calculated"); present perfect in discussions for the paper's own
actions ("we have proved", "We have used this result").

Sentence length: long and hypotactic; 30-50 word sentences with stacked
subordinate clauses are normal, especially in theory sections ("By introducing
the Dutch Identity, Holland showed how the marginal likelihood function of an
item response model for dichotomously scored items can be expressed such that
it does not involve an integral.").

Hedges (corpus counts): may 78, could 35, might 21, likely 15, appear(s) 13,
suggest(s) 13, often 12, seem(s) 9, tend(s) to 9, usually 7, in general 6,
approximately 3, relatively 14, somewhat 1, possibly 1, probably 2, perhaps 0,
roughly 1. Signature hedged verbs: "may be restrictive", "might be more
appropriate", "seems to suggest", "appeared to be close to 0", "could lead
to", "is likely to". Boosters are scarce: clearly 4, indeed 4, of course 4,
obviously 1, crucial 2, substantial 1; "importantly", "notably", "remarkably"
essentially absent. The house tone understates.

## 5. Lexicon

Characteristic verbs (corpus counts): estimat* 233, assum* 53, propos* 50,
denot* 39, simulat* 37, present* 33, assess* 27, evaluat* 27, illustrat* 24,
extend* 23, generaliz* 21, yield(s) 21, apply/applied 19, impose* 18, deriv*
15, introduc* 13, investigat* 13, demonstrat* 10, recover* 8, address 1,
outperform 1, tackle 0. Note what is missing: trendy verbs ("leverage",
"delve", "shed light on", "pave the way", "crucial role") never appear.

Characteristic nouns: model, assumption, property, parameter, estimate,
(latent) variable, distribution, procedure, simulation study, replications,
(item) response, sum score, fit / model-data fit, power, Type I error rate,
sample size, test length, special case, consequence, restriction(s)/
constraint(s).

Stock phrases and collocations (verbatim, with counts across the 6 articles):
"i.e." 39, "respectively" 33, "e.g." 23, "note that/Note that" 17, "in
practice" 16, "in this paper" 13, "in the present paper/study" 12, "it
follows" 11, "straightforward" 6, "as follows" 6, "in general" 6, "cf." 5,
"as such" 4, "more specifically" 4, "in particular" 3, "in principle" 2,
"without loss of generality" 2, "for brevity" 2, "it should be noted" 2, "in
plain words" 2, "it is well known that" 1, "as far as we know" 1, "in the
spirit of" 1, "ad hoc" 1, "in line with" 1, "on the other hand", "with
respect to", "so-called", "in favor of", "take into account/consideration".

## 6. Math in Prose

Notation is introduced ceremonially, with present-tense imperative frames:

- "Let A denote the set of subjects taking the test J." (9272-6)
- "Let Y = (Y1, Y2, ..., Yk)' be the random vector of item scores." (9277-1)
- "Consider a situation in which a set of k items is administered to a sample
  of ..." (9277-1)
- "Suppose that element-wise MLR holds for item i." (9272-6)
- "Denote by v(D) ..." (9272-6)
- "Assume that for each item j, subject i implicitly assesses these three
  components." (9361-1)

Equations are numbered and referred to as "Equation (5)" (or "Eq."): "inserting
Equation (5) in Equation (4) yields", "from Equation (9) ... yields an",
"Substituting Equations (2) and (3) into Equation (1) gives", "as detailed in
Equation 7", "can be given by Equation (15)". Theorems and lemmas are
announced, then proved: "It can be shown that in such a case the LR test
statistic follows a chi-bar-square distribution." (9277-1). Models are
described verbally before or after formal definition ("A favorable consequence
of this is that person parameter estimates can be easily obtained."). Greek
letters are glossed on first use: "where beta1i, beta2i, and beta3i influence
the difficulty of the item and alpha1i ... influence the slope of the IRF."
(9475-8). Algorithms are presented as numbered estimation procedures with an
appendix for the sampling scheme ("The Bayesian analysis was implemented via
MCMC schemes detailed in the Appendix", 9336-2).

## 7. Reporting Results

Reference formulas: "Table 1 shows that ...", "Table 1 reports the proportion
of replications in which ...", "Table 1 contains the Type I error rates and
power for ...", "The parameter estimation results are given in Table 1.",
"Figure 10 shows that, for the same item, subjects did use the whole range of
the response scale ...", "Figure 2 shows the ecdf of ...", "as can be seen in
...". Verbs used: show, report, contain, give, display, summarize, plot.

Numbers: reported inline with thin precision, decimals without leading zero
(".80", ".1"), percentages with spaced percent sign ("0.1 %"), counts as
numerals ("1000 replications", "n = 100, 200, 500, and 1000"). Design factors
narrated before results: "Sample sizes (n) of 100, 200, 500, and 1000 were
used to study the effect sample size had on the values of the Bayes factors
..." (9475-8). Result narration is claim-first, hedged: "The results show that
also for small samples the proposed procedure had a high power to correctly
reject latent monotonicity; except for k = 5 and n = 100, the observed power
levels exceeded .80 for all other conditions." (9475-8); "Our simulation
results showed that parameters were recovered well through the proposed
Bayesian estimation procedure." (9336-2); "Table 2 seems to suggest ..."
(9497-x). Anomalies are explained, not hidden: "For n >= 500, some of the 1000
replications encountered difficulties with the estimation of the Bayes factor
(empty cells in Table 1), as the constraints were so unlikely that ..."
(9475-8).

## 8. Citation Practices

Author-date, both narrative and parenthetical, often mixed in one sentence:
"Masters' (1982) partial credit model (PCM) is a polytomous IRT model which,
like the Rasch (1960) model, has the sum scores as a sufficient statistic for
the latent scores." (9272-6). Narrative cites carry the literature review:
"Tijmstra, Hessen, Van der Heijden, and Sijtsma (2013) showed how the property
of manifest monotonicity can be evaluated ...". Parenthetical cites cluster
for support: "(see, e.g., Rosenbaum, 1984)", "(see, for instance, Samejima,
1973, 1974)", "(MMLE; Bock & Lieberman, 1970; Bock & Aitkin, 1981)", "(for
example, Bridgeman & Cline, 2004; ...)". "e.g." is always comma-flanked inside
parentheses; "cf." appears 5 times; "i.e." 39 times. Criticism is oblique and
capability-focused, never personal: "However, they also found that none of
these models imply the SOL property."; "The discussed frequentist approaches
do not provide this kind of confirmatory support."; "this null hypothesis is
highly implausible in most practical settings." Credit is generous and exact:
"in line with the Bayesian informative hypothesis testing framework discussed
by Hoijtink (2012)", "in the spirit of", "Following Tijmstra et al. (2013), we
chose ...".

## 9. Tone and Taboos

Register: formal, impersonal, compressed, unironic. Across the six articles:
zero contractions, zero exclamation marks, zero first-person singular, zero
rhetorical questions in prose (questions only as section headings in 9497-x),
zero humor, zero direct address to the reader, no "the present authors", no
signposting adverbs like "interestingly" or "surprisingly". Abstracts never
exceed one paragraph and never cite. The book reviews in the corpus (9351-3,
9389-2) break every one of these rules -- contractions ("does not" vs review
prose like "he is talking about statistics, not necessarily writing about
them"), evaluation ("delightfully written manifesto", "this is no puff
piece"), humor -- which confirms the research-article register is a distinct,
tighter dialect. Anything that would look out of place: exclamation, joke,
metaphor extended beyond "vehicle/bridge/gap", "In today's world", "It goes
without saying", bullet lists in prose sections, second person, contractions,
superlatives about one's own contribution ("novel", "groundbreaking" -- the
corpus says "new" at most, and usually just "proposed").

## 10. Golden Sentences (verbatim, tagged)

1. "In item response theory (IRT), inferences are made about the ordering of
   subjects' latent scores on the basis of their responses to multiple test
   items." (9272-6) -- field-framing opener.
2. "Most achievement tests are administered within an allocated time."
   (9336-2) -- plain-fact opener.
3. "Many IRT models have been proposed to describe test data, and these models
   differ from each other with respect to the restrictions they impose on the
   data." (9272-6) -- literature framing.
4. "However, they also found that none of these models imply the SOL
   property." (9272-6) -- gap statement.
5. "Hence, there seems to be a mismatch between the polytomous IRT models and
   the SOL property." (9272-6) -- hedged gap statement.
6. "The discussed frequentist approaches do not provide this kind of
   confirmatory support." (9475-8) -- polite criticism of prior work.
7. "In this paper, the gap that exists between the polytomous IRT models and
   the SOL property is bridged by proposing an additional constraint to the
   nonparametric PCM." (9272-6) -- contribution, impersonal.
8. "This article proposes a Bayesian approach to evaluating manifest
   monotonicity for dichotomous item scores, in line with the Bayesian
   informative hypothesis testing framework discussed by Hoijtink (2012)."
   (9475-8) -- contribution with lineage.
9. "In this paper, we prove that under mild regularity conditions, PVs are
   random variables of the form ..." (9497-x) -- contribution, we-voice.
10. "The paper is organized as follows: ..." (9361-1) -- roadmap.
11. "A favorable property of MMLE is that it yields consistent parameter
    estimates when the data are generated by the specified model." (9277-1) --
    property appraisal.
12. "An advantage of CMLE over MMLE is that it can be applied without the
    assumption that the latent variables have a multivariate distribution in
    the population of examinees." (9277-1) -- method comparison.
13. "Let A denote the set of subjects taking the test J." (9272-6) --
    notation introduction.
14. "Consider a situation in which a set of k items is administered to a
    sample of ..." (9277-1) -- setup for formalism.
15. "It is well known that the empirical cumulative distribution function
    (ecdf) of the PVs is a consistent estimator of g as the number of persons
    goes to infinity." (9497-x) -- established-fact appeal.
16. "Note that the KL and EKL divergences that we use in this paper are
    non-symmetric in their arguments, yet their values are always non-negative
    ..." (9497-x) -- technical caveat.
17. "It can be shown that in such a case the LR test statistic follows a
    chi-bar-square distribution." (9277-1) -- deferred proof claim.
18. "For each design condition, 1000 replications were generated." (9475-8) --
    simulation procedure, past passive.
19. "Table 1 reports the proportion of replications in which strong support is
    found against manifest monotonicity relative to its complement." (9475-8)
    -- table reference.
20. "The results show that also for small samples the proposed procedure had a
    high power to correctly reject latent monotonicity; except for k = 5 and
    n = 100, the observed power levels exceeded .80 for all other conditions."
    (9475-8) -- result narration with qualification.
21. "Our simulation results showed that parameters were recovered well through
    the proposed Bayesian estimation procedure." (9336-2) -- result summary.
22. "This problem can only occur if there is overwhelming evidence against
    H_MM, and only happens when the estimate of the Bayes factor approximately
    equals 0." (9475-8) -- anomaly explanation.
23. "In other words, the current study merely serves as a first attempt to
    realize the LHL mechanism by formulating the parametric model in the
    simplest way." (9336-2) -- limitation framing.
24. "Some extensions to relax these assumptions may be considered in future
    research." (9336-2) -- future work.
25. "More research is needed to see how useful this feature can be in applied
    studies." (9361-1) -- future work, hedged.
26. "In closing, we mention a limitation of our results." (9497-x) --
    discussion coda.
