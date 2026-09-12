# Corpus Stylistic Statistics: Psychometrika vs. JEM

## Key quantitative findings

- "we show" is 4.3x as common as "we showed"; "we propose" is 8.9x "we
  proposed"; "we use" is 1.2x "we used" (combined corpus).
- Passive-proxy bigrams: 48 per 10k words in Psychometrika vs. 50 in JEM (4%
  less in Psychometrika).
- "we": 60 per 10k words; "the authors": 0.8 (ratio 73x).
- Top stock phrases (per 10k words): "based on" 14.1, "for example" 7.3, "due
  to" 5.0.
- Top connective sentence openers (per 10k sentences): "however" 219, "thus"
  103, "therefore" 86.
- Top sentence-first words: "the" (1688/10k), "in" (827/10k), "for" (500/10k).
- "e.g." 12.4 and "i.e." 10.6 per 10k words.
- Mean sentence length: 25.7 words (Psy) vs. 29.9 (JEM); p90: 45 vs. 52.
- Top hedges (per 10k words): "may" 16, "suggest(s)" 4.
- 69% of sampled abstracts use "we"/"our".

Sample: 120 Psychometrika papers + 120 JEM papers (seed 42). Psychometrika:
744729 words, 29059 sentences. JEM: 729611 words, 24388 sentences. Rates are per
10,000 units (words or sentences, as marked). Reference lists, tables,
equations, and image/link markup were stripped before analysis.

## 1. Sentence openers

Top 25 first words (rate per 10k sentences):

| first word | Psy    | JEM    | Combined |
| ---------- | ------ | ------ | -------- |
| the        | 1629.1 | 1758.2 | 1688.0   |
| in         | 812.8  | 843.0  | 826.6    |
| we         | 548.2  | 246.0  | 410.3    |
| this       | 471.5  | 450.6  | 462.0    |
| for        | 463.9  | 542.5  | 499.7    |
| as         | 207.5  | 244.8  | 224.5    |
| however    | 197.5  | 243.6  | 218.5    |
| a          | 185.8  | 178.0  | 182.2    |
| to         | 178.9  | 193.9  | 185.8    |
| it         | 178.6  | 183.3  | 180.7    |
| if         | 121.8  | 106.2  | 114.7    |
| these      | 118.4  | 168.1  | 141.1    |
| thus       | 106.7  | 98.4   | 102.9    |
| when       | 103.6  | 151.7  | 125.5    |
| note       | 93.9   | 66.8   | 81.6     |
| table      | 92.9   | 131.6  | 110.6    |
| therefore  | 79.8   | 93.5   | 86.1     |
| let        | 76.4   | 34.9   | 57.4     |
| then       | 74.7   | 35.7   | 56.9     |
| although   | 66.1   | 97.2   | 80.3     |
| our        | 63.0   | 32.4   | 49.0     |
| since      | 60.9   | 22.6   | 43.4     |
| finally    | 60.9   | 61.1   | 61.0     |
| first      | 60.2   | 74.2   | 66.6     |
| an         | 56.4   | 62.7   | 59.3     |

Top 25 two-word openers (combined, rate per 10k sentences):

| two-word opener | count | per 10k sents |
| --------------- | ----- | ------------- |
| in the          | 873   | 163.3         |
| for example     | 666   | 124.6         |
| in this         | 639   | 119.6         |
| for the         | 535   | 100.1         |
| in addition     | 470   | 87.9          |
| it is           | 454   | 84.9          |
| this is         | 403   | 75.4          |
| note that       | 384   | 71.8          |
| however the     | 241   | 45.1          |
| that is         | 235   | 44.0          |
| in contrast     | 228   | 42.7          |
| the results     | 224   | 41.9          |
| on the          | 218   | 40.8          |
| as a            | 210   | 39.3          |
| the first       | 205   | 38.4          |
| in particular   | 204   | 38.2          |
| when the        | 194   | 36.3          |
| we also         | 185   | 34.6          |
| for each        | 184   | 34.4          |
| if the          | 181   | 33.9          |
| based on        | 172   | 32.2          |
| for instance    | 159   | 29.7          |
| thus the        | 141   | 26.4          |
| the second      | 140   | 26.2          |
| there are       | 130   | 24.3          |

Connective openers (per 10k sentences):

| opener        | Psy   | JEM   | Combined |
| ------------- | ----- | ----- | -------- |
| however       | 197.5 | 243.6 | 218.5    |
| thus          | 106.7 | 98.4  | 102.9    |
| therefore     | 79.8  | 93.5  | 86.1     |
| note          | 93.9  | 66.8  | 81.6     |
| first         | 60.2  | 74.2  | 66.6     |
| finally       | 60.9  | 61.1  | 61.0     |
| specifically  | 50.2  | 63.1  | 56.1     |
| furthermore   | 49.6  | 59.0  | 53.9     |
| second        | 47.1  | 61.1  | 53.5     |
| moreover      | 46.8  | 40.6  | 44.0     |
| hence         | 40.3  | 33.6  | 37.2     |
| similarly     | 28.9  | 37.7  | 32.9     |
| also          | 31.7  | 26.2  | 29.2     |
| additionally  | 20.6  | 29.5  | 24.7     |
| consequently  | 22.0  | 23.8  | 22.8     |
| next          | 22.7  | 19.3  | 21.1     |
| third         | 20.3  | 21.7  | 21.0     |
| instead       | 22.0  | 16.4  | 19.5     |
| overall       | 7.9   | 20.5  | 13.7     |
| nevertheless  | 12.0  | 14.4  | 13.1     |
| indeed        | 14.1  | 8.6   | 11.6     |
| again         | 6.5   | 13.9  | 9.9      |
| alternatively | 8.9   | 8.2   | 8.6      |
| interestingly | 8.6   | 6.2   | 7.5      |
| nonetheless   | 5.2   | 6.2   | 5.6      |

## 2. Hedges & boosters (per 10k words)

| term        | Psy  | JEM  | Combined |
| ----------- | ---- | ---- | -------- |
| may         | 13.2 | 18.6 | 15.9     |
| might       | 3.7  | 5.4  | 4.5      |
| could       | 6.8  | 7.6  | 7.2      |
| appears     | 1.1  | 1.4  | 1.3      |
| appear      | 1.0  | 1.5  | 1.3      |
| seems       | 1.2  | 1.3  | 1.2      |
| seem        | 0.7  | 0.9  | 0.8      |
| suggests    | 1.6  | 1.6  | 1.6      |
| suggest     | 1.8  | 2.5  | 2.2      |
| likely      | 2.4  | 4.2  | 3.3      |
| unlikely    | 0.3  | 0.3  | 0.3      |
| tends       | 0.9  | 0.6  | 0.8      |
| tend        | 1.3  | 1.2  | 1.2      |
| generally   | 2.3  | 2.9  | 2.6      |
| typically   | 2.4  | 2.8  | 2.6      |
| often       | 4.1  | 4.5  | 4.3      |
| usually     | 1.8  | 1.5  | 1.7      |
| relatively  | 2.2  | 3.3  | 2.8      |
| somewhat    | 0.7  | 1.1  | 0.9      |
| quite       | 1.5  | 1.4  | 1.4      |
| very        | 4.8  | 6.1  | 5.4      |
| clearly     | 1.3  | 1.0  | 1.1      |
| obviously   | 0.2  | 0.1  | 0.2      |
| certainly   | 0.2  | 0.3  | 0.3      |
| indeed      | 1.2  | 0.9  | 1.0      |
| importantly | 0.6  | 0.4  | 0.5      |
| notably     | 0.2  | 0.5  | 0.3      |

## 3. Person & voice (per 10k words)

| form                     | Psy  | JEM  | Combined |
| ------------------------ | ---- | ---- | -------- |
| we                       | 82.9 | 37.0 | 60.2     |
| our                      | 19.1 | 7.4  | 13.3     |
| I                        | 12.4 | 10.4 | 11.4     |
| the authors              | 0.6  | 1.1  | 0.8      |
| this paper/article/study | 7.2  | 14.4 | 10.7     |

Passive-proxy bigrams: total per 10k words: Psy 48.4, JEM 50.2, Combined 49.3.

Top 25 passive-proxy bigrams (combined, per 10k words):

| bigram          | Psy | JEM | Combined |
| --------------- | --- | --- | -------- |
| be used         | 4.4 | 4.2 | 4.3      |
| is given        | 3.4 | 1.4 | 2.4      |
| is used         | 1.8 | 2.3 | 2.1      |
| was used        | 1.0 | 3.0 | 1.9      |
| were used       | 0.9 | 2.7 | 1.8      |
| is defined      | 1.7 | 1.8 | 1.7      |
| are used        | 1.2 | 2.1 | 1.6      |
| be estimated    | 1.4 | 1.5 | 1.4      |
| be considered   | 1.2 | 1.5 | 1.3      |
| be obtained     | 1.1 | 1.0 | 1.1      |
| is assumed      | 1.2 | 0.8 | 1.0      |
| be applied      | 1.1 | 1.0 | 1.0      |
| are presented   | 1.0 | 1.0 | 1.0      |
| are shown       | 1.2 | 0.8 | 1.0      |
| are given       | 1.2 | 0.6 | 0.9      |
| is obtained     | 1.1 | 0.5 | 0.8      |
| were obtained   | 0.4 | 1.2 | 0.8      |
| is shown        | 1.2 | 0.4 | 0.8      |
| are assumed     | 1.0 | 0.6 | 0.8      |
| are estimated   | 1.1 | 0.4 | 0.7      |
| been proposed   | 0.8 | 0.6 | 0.7      |
| been used       | 0.6 | 0.9 | 0.7      |
| are considered  | 0.7 | 0.7 | 0.7      |
| be noted        | 0.5 | 0.9 | 0.7      |
| were considered | 0.2 | 1.0 | 0.6      |

## 4. Stock phrases (per 10k words)

| phrase                     | Psy  | JEM  | Combined |
| -------------------------- | ---- | ---- | -------- |
| based on                   | 12.3 | 16.0 | 14.1     |
| for example                | 6.7  | 7.9  | 7.3      |
| due to                     | 4.8  | 5.1  | 5.0      |
| note that                  | 5.2  | 3.8  | 4.5      |
| in terms of                | 2.9  | 3.5  | 3.2      |
| with respect to            | 3.1  | 2.6  | 2.9      |
| as follows                 | 2.8  | 2.4  | 2.6      |
| so that                    | 2.5  | 2.6  | 2.5      |
| in order to                | 2.4  | 2.0  | 2.2      |
| such that                  | 2.9  | 1.2  | 2.1      |
| in contrast                | 2.1  | 1.8  | 2.0      |
| in particular              | 2.5  | 1.4  | 1.9      |
| for instance               | 2.4  | 1.1  | 1.8      |
| on the other hand          | 1.4  | 1.4  | 1.4      |
| as shown in                | 1.6  | 1.2  | 1.4      |
| consistent with            | 1.4  | 1.3  | 1.4      |
| in the context of          | 1.5  | 1.3  | 1.4      |
| it should be noted         | 0.3  | 0.6  | 0.5      |
| in the sense that          | 0.6  | 0.2  | 0.4      |
| as described in            | 0.4  | 0.3  | 0.3      |
| it follows that            | 0.5  | 0.2  | 0.3      |
| as can be seen             | 0.4  | 0.3  | 0.3      |
| in line with               | 0.3  | 0.4  | 0.3      |
| it is worth noting         | 0.2  | 0.2  | 0.2      |
| the remainder of this      | 0.2  | 0.2  | 0.2      |
| is organized as follows    | 0.3  | 0.1  | 0.2      |
| without loss of generality | 0.3  | 0.1  | 0.2      |
| it is well known           | 0.2  | 0.0  | 0.1      |
| as mentioned above         | 0.1  | 0.0  | 0.1      |
| it turns out               | 0.1  | 0.0  | 0.1      |

## 5. Reporting patterns (per 10k words)

| pattern  | Psy | JEM | Combined |
| -------- | --- | --- | -------- |
| p <      | 0.3 | 0.4 | 0.3      |
| p =      | 1.4 | 0.7 | 1.1      |
| M =      | 0.5 | 0.1 | 0.3      |
| SD =     | 0.4 | 0.4 | 0.4      |
| SE =     | 0.0 | 0.0 | 0.0      |
| 95% CI   | 0.4 | 0.0 | 0.2      |
| b/beta = | 0.8 | 0.2 | 0.5      |
| chi-sq   | 1.0 | 0.6 | 0.8      |
| t(       | 0.0 | 0.0 | 0.0      |
| F(       | 0.4 | 0.2 | 0.3      |

Table/Figure numbered references (per 10k words): Table: Psy 10.2, JEM 9.7;
Figure: Psy 7.8, JEM 6.8.

"Table/Figure N + verb" constructions (combined counts, per 10k words):

| pattern               | count | per 10k words |
| --------------------- | ----- | ------------- |
| figure ... shows      | 154   | 1.0           |
| table ... shows       | 121   | 0.8           |
| table ... presents    | 59    | 0.4           |
| table ... summarizes  | 37    | 0.3           |
| figure ... presents   | 35    | 0.2           |
| figure ... provides   | 25    | 0.2           |
| figure ... displays   | 23    | 0.2           |
| table ... displays    | 17    | 0.1           |
| table ... gives       | 15    | 0.1           |
| table ... reports     | 14    | 0.1           |
| table ... lists       | 14    | 0.1           |
| table ... provides    | 12    | 0.1           |
| table ... contains    | 11    | 0.1           |
| figure ... gives      | 10    | 0.1           |
| figure ... summarizes | 4     | 0.0           |
| figure ... contains   | 2     | 0.0           |
| figure ... reports    | 1     | 0.0           |

## 6. Tense proxy: "we + verb" (per 10k words; ratio = present/past)

| verb        | we+present | we+past | present/past |
| ----------- | ---------- | ------- | ------------ |
| use         | 1.7        | 1.4     | 1.21         |
| consider    | 1.4        | 0.3     | 4.69         |
| assume      | 1.3        | 0.2     | 6.41         |
| propose     | 1.1        | 0.1     | 8.89         |
| find        | 0.3        | 0.5     | 0.51         |
| present     | 0.7        | 0.1     | 10.60        |
| discuss     | 0.6        | 0.1     | 10.38        |
| conduct     | 0.2        | 0.4     | 0.43         |
| apply       | 0.4        | 0.2     | 1.90         |
| compare     | 0.3        | 0.3     | 0.96         |
| show        | 0.4        | 0.1     | 4.29         |
| examine     | 0.2        | 0.3     | 0.55         |
| demonstrate | 0.3        | 0.1     | 3.25         |
| develop     | 0.2        | 0.1     | 1.38         |
| investigate | 0.2        | 0.1     | 1.69         |
| evaluate    | 0.1        | 0.1     | 0.85         |
| perform     | 0.1        | 0.1     | 0.83         |

Per-journal totals (per 10k words): Psy present 14.6 / past 4.5; JEM present 3.8
/ past 4.6.

## 7. Section headings (normalized; per journal, with combined)

| heading            | Psy | JEM | Combined |
| ------------------ | --- | --- | -------- |
| abstract           | 97  | 102 | 199      |
| results            | 44  | 78  | 122      |
| discussion         | 55  | 60  | 115      |
| introduction       | 68  | 16  | 84       |
| theorem            | 56  | 0   | 56       |
| simulation study   | 23  | 32  | 55       |
| method             | 12  | 39  | 51       |
| appendix           | 1   | 42  | 43       |
| proof              | 42  | 0   | 42       |
| acknowledgments    | 0   | 38  | 38       |
| remark             | 33  | 0   | 33       |
| definition         | 32  | 0   | 32       |
| example            | 26  | 6   | 32       |
| notes              | 0   | 30  | 30       |
| methods            | 9   | 15  | 24       |
| note               | 0   | 24  | 24       |
| proposition        | 21  | 0   | 21       |
| conclusion         | 14  | 7   | 21       |
| authors            | 0   | 21  | 21       |
| simulation studies | 12  | 5   | 17       |
| conclusions        | 12  | 5   | 17       |
| design             | 11  | 5   | 16       |
| data               | 6   | 10  | 16       |
| study              | 9   | 6   | 15       |
| lemma              | 14  | 0   | 14       |

## 8. Abstract patterns (60 random papers per journal)

Abstracts extracted: Psy 55/60, JEM 56/60. Papers whose abstract contains
'we'/'our': Psy 76.4%, JEM 62.5%.

Top 15 abstract opening 3-grams (combined):

| opening 3-gram         | count |
| ---------------------- | ----- |
| the purpose of         | 3     |
| in this paper          | 2     |
| item response theory   | 2     |
| in this article        | 2     |
| hidden markov models   | 1     |
| an unfolding model     | 1     |
| the assumption of      | 1     |
| we develop a           | 1     |
| we consider a          | 1     |
| a speeded item         | 1     |
| studies with sensitive | 1     |
| a multinormal partial  | 1     |
| the axioms of          | 1     |
| whether when and       | 1     |
| the pearson and        | 1     |

## 9. Latin & abbreviations (per 10k words)

| term   | Psy  | JEM  | Combined |
| ------ | ---- | ---- | -------- |
| e.g.   | 12.4 | 12.3 | 12.4     |
| i.e.   | 11.2 | 10.0 | 10.6     |
| cf.    | 0.1  | 0.1  | 0.1      |
| et al. | 23.4 | 21.1 | 22.2     |
| vs.    | 0.8  | 0.7  | 0.7      |
| w.r.t. | 0.2  | 0.0  | 0.1      |
| iff    | 0.1  | 0.0  | 0.0      |
| etc.   | 0.6  | 0.4  | 0.5      |

## 10. Sentence length (words)

| corpus        | mean | median | p90  |
| ------------- | ---- | ------ | ---- |
| Psychometrika | 25.7 | 22.0   | 45.0 |
| JEM           | 29.9 | 25.0   | 52.0 |
| Combined      | 27.7 | 24.0   | 48.0 |

## 11. Structural statistics (sections, paragraphs, sentences, connectivity)

Same 240-paper sample; script `structure_stats.py`. Sections are segmented on
markdown headings; paragraphs are prose blocks of 8+ words; sentences have 3+
words. Section types are classified from heading text.

Sections per paper:

| journal       | top-level sections (mean/median/p90) | all headings (mean/median/p90) |
| ------------- | ------------------------------------ | ------------------------------ |
| Psychometrika | 5.8 / 6 / 8                          | 15.8 / 18 / 28                 |
| JEM           | 7.6 / 7 / 11                         | 15.7 / 15 / 26                 |

Paragraphs per section, by section type (mean / median / p90):

| section type | paragraphs   | sentences      |
| ------------ | ------------ | -------------- |
| Introduction | 6.9 / 6 / 12 | 36.5 / 32 / 65 |
| Method/model | 5.1 / 4 / 11 | 18.7 / 14 / 39 |
| Simulation   | 4.0 / 3 / 9  | 17.5 / 12 / 38 |
| Results      | 4.1 / 3 / 10 | 19.8 / 15 / 44 |
| Application  | 4.3 / 3 / 9  | 21.3 / 16 / 43 |
| Discussion   | 5.6 / 5 / 9  | 31.2 / 31 / 56 |

Sentences per paragraph: Psychometrika mean 4.0, median 3, p90 8; JEM mean 4.5,
median 4, p90 8.

Sentence length in words (this pass, prose only):

| journal       | mean | p10 | p25 | median | p75 | p90 | p99 | pct >= 40 words |
| ------------- | ---- | --- | --- | ------ | --- | --- | --- | --------------- |
| Psychometrika | 22.7 | 9   | 14  | 20     | 29  | 39  | 66  | 9.4%            |
| JEM           | 24.7 | 11  | 16  | 23     | 31  | 41  | 65  | 11.1%           |

By section type (mean/median/p90, combined): Introduction 25.3/22/43; Method
23.0/21/39; Simulation 23.3/21/38; Results 23.9/22/39; Application 23.1/21/39;
Discussion 25.6/24/41. Introductions and discussions run the longest sentences.

Connectivity:

| measure                                                    | Psychometrika             | JEM                       |
| ---------------------------------------------------------- | ------------------------- | ------------------------- |
| sentences opening with a connective                        | 13.5%                     | 14.5%                     |
| sentences opening with this/these/such                     | 6.0%                      | 6.6%                      |
| paragraphs opening with a connective                       | 6.2%                      | 5.8%                      |
| paragraph-closing sentences opening with a connective      | 14.2%                     | 15.0%                     |
| adjacent-sentence lexical overlap (Jaccard, content words) | 0.071 mean / 0.050 median | 0.082 mean / 0.061 median |

Paragraph opening types (combined, n = 15161): plain topical 85%, connective
6.0%, display pointer 4.2%, anaphoric this/these 2.6%, locative "in this ..."
2.1%.
