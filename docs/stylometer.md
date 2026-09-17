# stylometer: deterministic register measurement for the corpus

Dev-facing design doc. The stylometer is the deterministic twin of the
fine-tuned writer model: closed lexicons, regexes, and arithmetic, no neural
components in the measurement path. It (a) profiles the corpus's register per
section, and (b) scores any text's distance to that register. The strategy
report (Sep 2026) seeded this as one eval arm (its ch. 6.2.1); this doc expands
that arm into a first-class instrument. Companion to docs/repertoire/.

Status: design. Pilot evidence below comes from scratch scripts (kept in
repertoire/.cache/stylometer/), run 2026-09-15 on psychometrika 2020+ (n=388)
and a JEM sample (n=150). Numbers are a first fingerprint, not final baselines.

## Why three consumers share one tool

1. **Fine-tune evaluation.** The five-arm protocol's stylometric arm
   (fingerprint vs held-out papers) is this tool's report mode. Style conformity
   measured without a judge, so it cannot be gamed by one.
2. **Writer feedback.** The style-check subagent needs a cheap, explainable read
   on a draft passage ("hedge density 2 sigma below discussion norms; citation
   form is 100% integral, corpus is 85% non-integral").
3. **Corpus QA.** Era drift, LLM contamination of the 2023-2025 slice, converter
   regressions. The same fingerprint run annually is a regression test for the
   corpus itself.

## Design principles

- **Deterministic** = closed word lists, regexes, counting, arithmetic. A POS
  tagger (syntax arm, phase 3) is acceptable only version-pinned, so output is
  bit-reproducible. No LLM judges in the measurement path.
- **Section-conditional.** Register varies more across sections within one paper
  than across papers (pilot: hedges 10.3/1k in methods vs 21.2/1k in
  discussion). Every feature is profiled per section; a draft is scored against
  its claimed section.
- **Distributions, not points.** Report distances to distributions (z-scores,
  Delta, JS divergence). A passage matching the mean sentence length with
  collapsed variance is off-register (pilot: theory sections have sd 20 vs
  abstract's 11; the shape is the signature).
- **Papers are the sampling unit.** Splits, bootstrap CIs, permutation tests all
  at paper level. Paragraph-level statistics leak.
- **Text preparation before statistics.** Citations, inline math, and
  abbreviations are extracted and counted as features, then removed before
  sentence/word statistics. Plaven-Sigray et al. 2017 needed three QC rounds
  before their readability components were trustworthy; naive tokenization of
  scientific text distorts everything.

## What the pilot established (first fingerprint)

Psychometrika 2020+, regex heuristics, no tagger:

| signal                  | abs  | intro | theory | meth | res  | disc |
| ----------------------- | ---- | ----- | ------ | ---- | ---- | ---- |
| sentence length (words) | 23.8 | 23.9  | 21.1   | 21.7 | 22.6 | 24.2 |
| sentence length sd      | 11.2 | 13.3  | 19.8   | 15.4 | 14.7 | 11.3 |
| Flesch Reading Ease     | 15.6 | 17.1  | 30.5   | 29.3 | 28.4 | 19.1 |
| passive / 100 sentences | 36.8 | 36.0  | 33.3   | 40.8 | 32.5 | 33.4 |
| hedges / 1k words       | 15.3 | 15.8  | 17.0   | 10.3 | 13.5 | 21.2 |
| boosters / 1k           | 2.9  | 2.5   | 1.8    | 1.8  | 2.5  | 3.1  |
| math tokens / 1k        | 9.3  | 12.7  | 325.5  | 146  | 124  | 28.6 |
| citations / 1k          | 14.3 | 22.0  | 21.6   | 17.7 | 9.7  | 10.4 |
| nominalizations / 1k    | 56.0 | 54.0  | 51.8   | 48.3 | 51.8 | 55.6 |

Findings, each load-bearing for the design:

1. **Difficulty is lexical, not clausal.** Flesch 15-31 (hard; PubMed abstracts
   sit below 0-20, standard English 60-70), yet the difficulty lives in
   vocabulary and noun-phrase density, not subordinate clauses. This is Biber &
   Gray's compression finding, confirmed here: abstracts score hardest (15.6)
   precisely where prose is densest, while math-heavy sections score "easier"
   (28-31) because clauses are short. Formulas alone would misread this field;
   the syntax arm (complex nominals per clause) is what captures it.
2. **Hedge:booster ratio ~6:1** (science norm ~2.3:1 per Hyland 2015), and
   hedging doubles from methods to discussion. Metadiscourse is the cheapest
   strong axis, and it is section-conditional.
3. **Math density is our most field-unique signature.** Theory sections run one
   inline equation per ~3 words (325/1k). No general-academic contrast corpus
   has this profile; it must be its own feature family, and it is why generic
   readability norms misfire here.
4. **MFW Delta separates the two journals at 83%** (nearest-centroid, 150 most
   frequent words, paper level, same field). Function words carry journal
   register; distance-to-centroid scoring is viable.
5. **Era drift is measurable** (2012 vs 2020 psychometrika): passive -3 to -4
   per 100 sentences, first person rising, math density up, hedges stable.
   Matches published passive decline (social sciences steepest). Profiles must
   be era-aware, and drift itself is a QA signal.
6. **The section taxonomy is the corpus-specific gap.** The current SECTION_MAP
   leaves ~42% of psychometrika words in "other": this field's actual sections
   are "parameter estimation", "identifiability", "real data analysis",
   "Proposition 1", "Corollary 1", "Remark 1". No prior work profiles journal
   register by genre-aware sections; that combination is unclaimed territory.

## Prior art (anchors)

Stylometry: Burrows 2002 (Delta); Evert et al. 2017 (decomposition; cosine
kernel is the robustness factor; MFW band 1,000-2,000); Argamon 2008
(probabilistic grounding); Jockers & Witten 2010 (centroid classification);
Mikros et al. 2026 (Delta-to-reference as a style conformity validator,
structurally our draft-scoring use).

Register analysis: Biber 1988 (MDA, ~67 features, factor dimensions); Biber &
Gray 2010/2013 (academic prose is compressed, not elaborated); Nini 2019 MAT,
biberplus, TAACO (toolkits; mostly wrap statistical taggers, so we port the
closed-class subset by hand).

Keyness: Dunning 1993 (G2); Hardie 2014 (LogRatio effect size); Evert 2022 (LRC,
conservative LogRatio; current best practice); keyperm (document-level
permutation null).

Phraseology: Biber et al. 1999 and Hyland 2008 (lexical bundles; ~3% overlap
across registers); Simpson-Vlach & Ellis 2010 (Academic Formulas List, public);
Shahriari 2017 (bundles differ by IMRaD section).

Metadiscourse: Hyland 1998/2005 (model + cue lists), 1999 (citation form tables
across fields), 2015 (density tables: science hedges 10.25/1k, boosters 4.5/1k,
self-mention 12.1/1k); Farkas et al. CoNLL-2010 (hedge cue taxonomy, multiword
cues).

Mathematics register: Tanswell & Inglis 2023 (proof-language corpus: let 4,523
pmw, suppose 944, note 929, consider 570, assume 556...); Swales et al. 1998
(imperatives across disciplines).

Readability: Flesch 1948; Kincaid 1975; Chall & Dale 1995; Lu 2010 (L2SCA
syntactic complexity indices); Plaven-Sigray et al. 2017 (709k abstracts,
readability declining, QC protocol); Benjamin 2012.

Statistical framing: Olsson-Collentine et al. 2019 (regex extraction of
"marginally significant" phrasing, ~40% of p in (.05,.10]).

Discourse and storyline: Barzilay & Lapata 2005/2008 (entity grid; parser-free
and string-identity ablations licensed in the CL paper), Guinaudeau & Strube
2013/2014 (entity graph; unsupervised, parser-free variants), Foltz, Kintsch &
Landauer 1998 (LSA sentence coherence, local-minima breakdown detection), Laban
et al. 2021 (k-block shuffle test as the honest validation baseline), Crossley
et al. 2016/2019 TAACO and Graesser et al. Coh-Metrix (cohesion indices; expert
raters reward paragraph-level overlap, not sentence-level -- the reverse
cohesion effect), Morris & Hirst 1991 / Galley et al. 2003 (lexical chains,
LCseg), Hearst 1997 (TextTiling; vocabulary-introduction score), Zhao et al.
2023 DiscoScore (focus frequency; machine text repeats foci), Vinkers et al.
2015 (positive-word lexicon with 40-year baselines), Reilly et al. 2019
(section-conditional cohesion: discussion > method), RAAMove 2024 (annotated
abstract-move corpus). LLM coherence findings: global-coherence deficit of AI
abstracts d_z = -0.47, human editing does not close it (arXiv 2511.12529;
topic-continuity index raised by human editors); cohesion decline in 823k
LLM-era arXiv abstracts (arXiv 2505.12218); LongEval 2025 (redundancy; listing
without argumentation; models treat sections as independent); Laban et al. 2024
semantic drift (plausible but tangential material appended).

LLM contrast: Kobak et al. 2024/2025 (excess vocabulary; frequency-gap plane,
pre-LLM years as negative controls; published style-word lists); Juzek et al.
2025 (why LLMs delve; RLHF-driven); Reinhart et al. 2025 PNAS (instruction-tuned
LLM style measured on 66 Biber features; noun-heavy, informationally dense;
effects larger after instruction tuning; GPT-4o: participial clauses 5.3x,
that-subjects 2.6x, nominalizations 2.1x human rates); Desaire et al. 2023 (20
features, 99-100% human vs ChatGPT on science prose; paragraph-length SD alone
AUC 0.98); TextPulse 2026 (paired rewrites N=60,779: human sentence-CV 0.449 vs
AI 0.376, 79.3% flatter); Zaitsu & Jin 2023; Zou et al. 2026; Dentella et al.
2025 (ChatGPT register adaptation narrower than humans; noun-over-verb
backbone).

Training-data composition: Gao et al. 2020 (Pile), Touvron et al. 2023 (LLaMA
mix + epochs), Hoffmann et al. 2022 (Chinchilla), Soldaini et al. 2024 (Dolma),
Penedo et al. 2024 (FineWeb), Muennighoff et al. 2023 (epochs over repeats
nearly free to ~4x), Longpre et al. 2024 (quality filters are Wikipedia/book
classifiers), Dodge et al. 2021 (C4 = patents/news/encyclopedic), Emigh &
Herring 2005 and Stvilia et al. (Wikipedia register = print-encyclopedia
formality), Biber & Egbert 2016 (web register map; how-to pages a distinct
register), Padmakumar & He 2024 (RLHF reduces diversity), Sharma et al. 2023
(sycophancy), Singhal et al. 2024 (reward-model length bias), Do et al. 2025
(format bias).

Citation practice: Hyland 1999 (hard fields 83-90% non-integral, biology ceiling
15.5 citations/1k); Thomas & Hawes 1994 (129 reporting verbs by assertiveness);
Taylor 1995 (tense by section).

## Feature families

Each family names: what, how computed, anchor. All profiled per (journal, era,
section).

**F0 text preparation** (prerequisite, not a feature). Journal-specific citation
grammars normalized to one CITATION token (psychometrika md carries Cambridge
anchor form "(Junker & Sijtsma, Reference Junker and Sijtsma2001)"; JEM carries
APA "(Glas & Van der Linden, 2003)" plus integral "Author (2024)"). Inline math
and eq tokens counted then removed; abbreviation-aware sentence splitting (et
al., e.g., Fig., Eq., Sect.); table blocks and asset refs excluded from prose
stats but counted as callouts. Corpus-specific lexicons live here, versioned.

**F1 surface mechanics.** Sentence-length distribution (mean, sd, deciles; the
sd is a feature, not noise: theory 20 vs abstract 11); paragraph length;
punctuation densities (semicolon, colon, parenthesis, em dash); display/inline
math density; figure/table/equation callouts. Anchor: universal
corpus-stylistics practice.

**F2 readability pair.** Flesch Reading Ease plus its raw components
(words/sentence, syllables/word, % polysyllabic), and New Dale-Chall % difficult
words. Two orthogonal arms only (r = -0.72 at scale); FKGL and Fog are linear
transforms of the same inputs and are dropped. Grade units are extrapolations
above ~16, so components are primary. Anchor: Flesch 1948, Chall & Dale 1995,
Plaven-Sigray 2017.

**F3 interactional metadiscourse.** Hedges (split by class: modal aux, lexical
verb, adverb; CoNLL-2010 taxonomy), boosters, attitude markers, self-mention
(we/our/us plus following-verb collocation), engagement markers. Closed cue
lists, lemma matching, per 1k. Anchor: Hyland 1998/2005; density anchors
Hyland 2015.

**F4 interactive metadiscourse.** Transitions (moreover, therefore), frame
markers (first, we aim to), endophoric markers (see Table 1, as noted above),
code glosses (namely, in other words). Same machinery as F3. Anchor:
Hyland 2005.

**F5 math-register imperatives.** Rate of let, suppose, assume, define, denote,
fix, observe, recall, note, consider, choose, take, write (sentence-initial or
after semicolon, to avoid "note" as noun). Marks theory/derivation passages;
near-zero outside them. Anchor: Tanswell & Inglis 2023 per-million rates; Swales
et al. 1998.

**F6 citation practice.** Density per 1k and per sentence; integral vs
non-integral ratio; reporting-verb lemma mix by epistemic class (factive
show/demonstrate/establish, tentative suggest/indicate/appear, argumentative
argue/claim/maintain). Regex-deterministic because citations are mechanically
formatted (F0). Anchor: Hyland 1999.

**F7 statistical framing.** Regex/n-gram families: "was statistically
significant", "marginally significant", evidence-strength phrases, fit-the-well
family, outperform/comparable-to comparatives, estimator-verb collocations
(propose, derive, estimate, simulate). Inventory derived corpus-internally by
keyness (F9), seeded from Olsson-Collentine et al. 2019 and reporting-verb
taxonomies.

**F8 MFW Delta profile** (the scoring engine core). Top 500-2,000 words
(function words included, obviously), per-section relative frequencies, z-scored
against the section corpus; draft scored by cosine Delta and Manhattan Delta to
the section centroid; top contributing words reported (explainable report: which
words carry the distance). Anchor: Burrows 2002, Evert et al. 2017, Mikros 2026.
Pilot: 83% journal separation at 150 MFW, untuned.

**F9 keyness / house vocabulary.** LRC (conservative LogRatio) per section vs
rest-of-corpus, per journal and per era; document-level permutation null. Yields
the interpretable "house vocabulary" and the draft report ("these section-key
items over/under-used"). Pilot abstract: propose/models/article; theory:
assume/theorem/define; results: simulation/RMSE/conditions; discussion:
future/limitations. Anchor: Hardie 2014, Evert 2022.

**F10 syntax arm** (phase 3; pinned tagger). Passive per clause with agentless
share (exclusion rules for adjectival and "based on"); tense mix by section
(past methods/results, present intro/discussion, Taylor 1995); L2SCA indices
MLC, DC/C, CN/C (complex nominals per clause, the compression signature),
words-before-main-verb. Anchor: Lu 2010, Biber & Gray 2010, PassivePy 2023
methodology.

**F11 lexical bundles.** 3-4-grams at frequency + range thresholds (e.g., >=20
per million, >=5 papers), per section; AFL-607 coverage as the comparable.
Anchor: Biber et al. 1999, Hyland 2008, Simpson-Vlach & Ellis 2010,
Shahriari 2017.

**F12 contrast axes.** Fixed style-word rate (Kobak published lists: delve,
pivotal, showcasing, underscore, realm, intricate, meticulously...), per section
and per year; pre-2022 corpus slices must score ~0 (built-in negative control).
Later: the full excess-vocabulary frequency-gap method on any generated text,
against our own pre-2023 baseline. Doubles as corpus QA for 2023-2025 slices.
Design rule from the marker-decay literature (Juzek; the human-LLM coevolution
finding that "delve" receded once flagged): distributional targets are primary
(CV, diversity, stance density, specificity); blacklists are secondary and
versioned. See "Contrast baselines and the correction map" below. Anchor: Kobak
et al. 2024/2025.

**F13 discourse flow.** The zigzag complaint, measured. Adjacent- sentence and
adjacent-paragraph content overlap (binary and proportional; noun/argument
classes once the tagger lands); lag-k overlap decay and the oscillation ratio
(lag2/lag1; focused prose decays monotonically, corpus 0.81-0.86, zigzag shows
lag2 >= lag1); interrupted entity continuations per 100 sentences (entity at i
and i+2, absent at i+1); new-entity/givenness rate (TextTiling
vocabulary-introduction score); shift-signaling rate (fraction of low-cohesion
boundaries opened by an explicit cue; corpus 17-18% in intro/discussion vs 10%
in methods/results); connective-class profile and the causal particle/verb ratio
(Coh-Metrix deep-cohesion anchor: 0.80 low vs 1.21 high). Phase 3 additions:
entity-graph outdegree (Guinaudeau & Strube P_U/P_W: parser-free, unsupervised,
0.87-0.91 ordering discrimination) and LSA adjacent-sentence similarity with
local-minima breakdown detection (Foltz et al. 1998, pinned space). Design rule
from the 2024-2026 literature: LLM text games LOCAL cohesion (formulaic
connectors, referential overlap) while failing GLOBAL coherence (AI abstracts
d_z = -0.47 vs human, unclosed by human editing; cohesion declined across 823k
LLM-era arXiv abstracts). Weight paragraph-level and argument-level indices over
sentence-level ones.

**F14 storyline structure.** The listing-vs-arguing complaint, measured.
Closed-lexicon claim families with per-section density and position: gap cues,
purpose statements, novelty/knowledge-claim bundles ("to the best of our
knowledge", "for the first time"), the Vinkers positive-promotion lexicon
(published 25-word list, 40-year baselines), contribution cues, impact cues.
Corpus distribution (pilot): purpose/novelty/gap concentrate in abstract and
introduction, impact peaks in discussion, results carry almost none,
encyclopedia carries none. Sequence check: Move-2 gap cues followed by Move-3
purpose cues (CARS; positional heuristics alone reach F = 64% on structured
abstracts, Ibekwe-Siskos 2009). Anchors: Vinkers et al. 2015, Hyland 2000
abstract moves, RAAMove corpus for calibration, bundle-position findings ("for
the first time" appears exclusively in abstracts). Full move tagging stays out
of scope (classifiers); the deterministic layer measures cue density, position,
and sequence.

Out of scope overall: full CARS move labeling (classifiers per
Mover/AcaWriter/GPT-4 studies; only cue families enter as F4/F7/F14).
Nominalization suffix rate rides along in F1 until the tagger arrives.

## Contrast baselines and the correction map

The fine-tune moves text from the LLM-default register toward the journal
register; direction requires baselines at both ends. This section stands on
published measurements (our corpus rows are our own, n=388/833 papers; every
other cell cites published work). The scratch LLM samples in
.cache/stylometer/contrast/ are instrument demos only.

### What shaped the LLM default

Filtered web crawl is 60-100% of every mainstream mix (LLaMA-1 82%, Dolma ~82%,
OLMo 2 95%, FineWeb 100%). But the crawl is not neutral: quality filters are
Wikipedia/book classifiers (Longpre et al. 2024), and survivors skew business
16% / tech 15% / news / patents (WaPo C4 domain analysis 2023; Dodge et al.
2021). Wikipedia itself is a 0.1-4.5% raw slice everywhere but the most-repeated
text in training: GPT-3 saw it 3.4 epochs vs 0.44 for the crawl; Chinchilla
3.40; LLaMA 2.45; repeats are nearly free up to ~4 epochs (Muennighoff et al.
2023), so its share of what is internalized is plausibly 5-15x its raw share.
Code + Q&A is 4.5-17% and rising: the imperative, second-person, tutorial
register (mandated by Google/Microsoft doc style guides; "how-to" is a distinct
register in Biber & Egbert 2016). Journal prose is 0-3% of every mainstream mix,
OA slices only (arXiv/PMC/peS2o); paywalled venues are structurally excluded --
expect near-zero base-model exposure to Psychometrika/JEM register. The decisive
shaper is post-training, not data selection: Reinhart et al. (PNAS 2025) find
instruction-tuned LLMs noun-heavy and informationally dense even when prompted
otherwise, with effects LARGER after instruction tuning; RLHF adds verbosity
(Singhal et al. 2024), format bias (Do et al. 2025), marker vocabulary (Juzek et
al. 2025), and homogenization (Padmakumar & He 2024).

Verdict on "LLMs learned from Wikipedia and code documentation": right about the
register attractors, wrong about volume. Volume is filtered crawl whose
effective register is mass-audience expository; Wikipedia is its most-repeated
member; docs add the imperative layer; alignment supplies the surface style.

### Three-register baseline (published numbers)

| axis                | journal prose (ours + anchors)                                           | web / encyclopedic / docs                                                                                                                        | LLM output                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flesch RE           | 12.7-27.5 by section (ours)                                              | Wikipedia mean 51.2 of 1.71M articles (Lucassen 2012); medical pages 29-31 (Sajjon 2018, Sdvirkov 2022); agent/doc files 16.6 (arXiv 2511.12884) | AI abstracts "harder" than human: FRE 11.5 vs 17.0 (Zou 2026)                                                                                                          |
| sentence length     | 23-26 words (ours)                                                       | 19-25 (Elia 2009: 22.1 vs Britannica 22.1; Yasseri 2012: 25.2)                                                                                   | shorter means, flatter tails: fewer <11 and >34-word sentences (Desaire 2023)                                                                                          |
| length CV           | 0.40-0.50 (ours)                                                         | not published                                                                                                                                    | 0.376 vs human 0.449; 79.3% of rewrites flatter than source (TextPulse 2026, N=60,779)                                                                                 |
| passives            | 33-43/100 sent (ours); academic anchor 25% of verbs (Biber 2012)         | not published (gap)                                                                                                                              | present-voice lean; present-for-past tense in abstracts (USask 2024)                                                                                                   |
| hedging             | 10-21/1k by section (ours); sci/eng 10.25/1k (Hyland 2015)               | 18.3% of sentences hedge-bearing, but impersonal/attributional (Vincze 2013)                                                                     | fewer epistemic markers, narrow hedge set (Herbold 2023)                                                                                                               |
| citations           | 10-26/1k by section; hard fields 83-90% non-integral (Hyland 1999)       | attribution by link, near-zero inline author-date                                                                                                | fewer citations, names, et al. (Desaire 2023; Liang 2024 reference effect)                                                                                             |
| math density        | 16-325/1k by section (ours)                                              | 0                                                                                                                                                | ~0 in prose argument                                                                                                                                                   |
| lexical profile     | long7 32-39% (ours)                                                      | lexical density 43.6 (Elia 2009); NE-heavy POS, clusters with expository prose (Yasseri 2012)                                                    | higher density + lower diversity (Zou 2026); nominalizations 2.1x, participials 5.3x human (Reinhart 2025)                                                             |
| register dimensions | research article = MOST argumentative register, D2 1.404 (Sardinha 2021) | encyclopedia D3 0.201, FAQ D2 0.485: informational WITHOUT argument                                                                              | ChatGPT sits at the human-Wikipedia pole on D1 regardless of prompt, and is less variable than humans (Dentella 2025); systematic informational-D1 shift (Cvrcek 2025) |
| specificity         | numbers 7-44/1k, acronyms 19-30/1k (ours)                                | encyclopedia NE-dense                                                                                                                            | fewer numbers, acronyms, proper names (Desaire 2023)                                                                                                                   |
| punctuation         | semicolons 6-16/1k (ours)                                                | not published                                                                                                                                    | fewer semicolons, colons, parens (Desaire 2023)                                                                                                                        |
| marker vocab        | ~0 pre-2022 (built-in negative control)                                  | ~0                                                                                                                                               | delves r=28, potential +5.2pp (Kobak 2025)                                                                                                                             |
| variability         | section-conditional by design                                            | --                                                                                                                                               | stylistically less variable than 100 human texts (Dentella 2025 IQR); outputs cluster by model (O'Sullivan; Zaitsu & Jin 2023)                                         |

Gaps with no published numbers (we measure ourselves): Wikipedia passive rate
and cohesion profile; documentation imperative/second- person densities; any
single study running identical features across web + encyclopedia + journal +
LLM text (Dentella 2025 is closest).

The chain that operationalizes the user's storyline complaint, with citations:
LLM default sits at the encyclopedic pole (Dentella 2025); encyclopedic register
is informational without argumentative stance (encyclopedia vs research-article
dimension scores, Sardinha 2021); therefore LLM default prose lists facts rather
than arguing a storyline. The storyline itself is countable: in our corpus,
purpose/ novelty/gap cues concentrate in abstract and introduction, impact cues
peak in discussion, and results sections carry almost no claims (novelty 0.04,
gap 0.06 per 1k) -- they report, they do not pitch. Wikipedia carries none
(0.01-0.17). This distribution is F14.

### Correction map (fine-tune directions)

Each line is an SFT construction rule plus a stylometer acceptance test. From
the composition and deviation evidence:

1. Keep nominal density. Already matched; spend no budget (Reinhart vs our F1/F3
   profile).
2. Restore evidence-linked hedging at section-calibrated rates (discussion
   20/1k; methods 10/1k; anchors Hyland). The biggest stance gap: Wikipedia bans
   unattributed hedges, alignment rewards confidence.
3. Citation-dense flowing prose: non-integral author-year syntax at intro
   density (~26/1k). No pretraining slice trains this.
4. Math embedded in expository argument at section density (theory 325/1k).
   Pretraining math is arXiv-LaTeX and code, not journal-embedded derivation.
5. Kill the documentation layer: second person, imperatives, bullet/list
   structure, "note that" tics, marker vocabulary. Learnable negatives; small
   fine-tunes remove them if the target text is clean.
6. Restore authorial "we" (we propose / we estimate / our results): a direct
   inversion of both attractors (encyclopedia forbids we, docs address you).
7. De-encyclopedic openings: the present-tense definitional lead ("X is a...")
   is the deep attractor; downweight or contrast.
8. Restore sentence rhythm: CV to corpus distribution means keeping BOTH very
   short and 35+ word sentences (Desaire: humans have more of each extreme);
   restore semicolons.
9. Structural conventions need explicit coverage: sectioning (Theory /
   Estimation / Simulation / Real data), theorem environments, tables referenced
   from prose.
10. Corpus economics: all open base models share this prior, so model choice
    barely changes the correction problem. If the two journals under-supply the
    SFT mix, augment with register-adjacent OA full text (peS2o
    quantitative-methods, JMLR/JASA-class venues).

Design rules: distributional targets are primary (CV, diversity, stance density,
specificity, claim distribution); marker blacklists are secondary and versioned,
because marker words decay culturally ("delve" already receding once flagged,
arXiv 2502.09606).

## Scoring model

- **Corpus profile matrix**: per (journal, era, section) a feature vector
  (means, sds) plus empirical sentence-length quantiles plus the MFW centroid.
  Frozen as versioned JSON in the bucket alongside the corpus it describes.
- **Draft score**: per-feature z against the claimed section's distribution;
  cosine Delta to the MFW centroid; JS divergence on the sentence-length
  histogram; sum reported as percentile against the held-out-paper distance
  distribution (calibration), so "72nd percentile of real papers" is the unit,
  never a raw number.
- **Report**: distance headline plus the top contributing features and words
  (Delta decomposition), section-relative: actionable for the writer, auditable
  by us.
- **Eval mode**: same machinery compares model generations vs held-out papers vs
  base-model generations; the strategy report's acceptance thresholds (e.g.,
  Wasserstein distance down 30%) evaluate against these profiles.

## Validation

- Paper-level leave-one-out: nearest-centroid classification by section and by
  journal (pilot baseline 83% journal, 150 MFW, plain Delta; cosine + section
  conditioning should push higher).
- Coherence indices validated by the k-block shuffle test (k = 3-5):
  sentence-shuffled baselines are trivially separable and flatter a weak index
  (Laban et al. 2021). Segment-quality metrics (Pk / WindowDiff) against the
  corpus's own section boundaries.
- Permutation nulls for keyness (document-level shuffles).
- Bootstrap CIs over papers for every published rate.
- Negative controls: F12 on pre-2022 slices; readability components stable
  across converter versions (same paper, two pipeline eras).
- Annual re-run as corpus regression test; drift deltas reported.

## Build order

**Phase 1, foundation (build first):** F0 + section taxonomy v2 + F1-F7,
F12-lite, the F13 counting subset (overlap, oscillation ratio, shift signaling,
connectives), and F14 claim families. All pure counting, no tagger. Output:
fingerprint JSON + readable report per (journal, era, section). This alone
serves consumers 1 and 3 and gives the style-check subagent its numbers.

Section taxonomy v2 (supersedes the pilot's stopgap; chunk.ts's SECTION_MAP is
tentative and may adopt the same buckets later): IMRaD core (abstract,
introduction, methods, results, discussion, conclusion) plus this field's
genres: theory/derivations (incl. theorem environments: proposition, theorem,
corollary, remark, proof, lemma, definition), estimation/inference, simulation
study, real-data analysis, background/overview. JEM specifics: "Notes"/"Note"
headings are acknowledgments (backmatter), not content; JEM "::::" headings are
converter artifacts to exclude, worth an upstream converter fix when convenient.

**Phase 2, the scoring engine:** F8 + F9 + calibration on held-out papers +
draft-score CLI + style-check integration (repertoire tool or a skill calling
it).

**Phase 3, depth:** F10 (pinned spaCy in the existing python venv), F11 bundles,
the F13 entity-graph/grid roles and LSA adjacent similarity (pinned space), full
excess-vocabulary method, and era-indexed profiles (2012-2019 / 2020-2025 at
minimum).

What to incorporate first, in one line: F0 text preparation and the taxonomy
(everything downstream inherits their errors), then the cheap interpretable
families (F1-F7), then Delta scoring (F8-F9); tagger-dependent syntax and
bundles last.

## Open decisions

- Language split: counting core in TS (harness-callable, same runtime as the
  pipeline) with the phase-3 tagger arm in the existing python venv; or
  all-python for textstat/spaCy adjacency. Recommendation: TS core, since every
  phase-1/2 feature is lexicons and arithmetic.
- Where taxonomy v2 lives if chunk.ts adopts it: shared module or
  stylometer-local with a re-export.
- Era granularity for frozen profiles (two eras vs per-year).
- Per-journal profiles vs pooled field profile: keep both (Delta says the
  journals differ), score drafts against the target journal.
- The phase-3 semantic arm: pinned LSA space vs pinned static embeddings vs
  Voyage (already in the pipeline); whichever is chosen, the reported index is
  the shuffle-normalized margin, never raw cosine.
