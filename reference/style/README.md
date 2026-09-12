# style-guide/

A corpus-grounded style system for academic writing in quantitative
psychology (psychometrics, educational measurement), built from 833
Psychometrika and 583 JEM articles (2005-2025) in `../repertoire/`.
Audience: AI agents composing or editing journal prose in this field.

Read in this order, depending on budget:

1. **zen.md**: one screen. The dialect's soul. Read every time.
2. **handbook.md**: five minutes. The rules, no evidence. Read before
   drafting.
3. **manual.md**: the comprehensive manual, organized in three levels: the
   paper (genotypes, architecture, section playbooks, move library with
   verbatim templates), the paragraph (shape, genotypes, openings, closings,
   transitions, cohesion), and the sentence (person, tense, length,
   connectives, hedging law, number style, citation practice), plus AI
   failure modes and a pre-submission checklist. Consult while drafting.
4. **report.md**: the evidence: collective linguistic and semantic
   patterns of the corpus, with quantitative tables and verbatim examples.
   Consult when a rule needs justification.

Supporting material:

- **corpus_stats.md**: quantitative statistics over 240 randomly sampled
  papers (sentence openers, hedges, person/voice, tense ratios, stock
  phrases, headings, sentence length), plus structural statistics (sections
  and paragraphs per paper, sentences per section and per paragraph,
  sentence-length distribution, connectivity).
- **corpus_stats.py**, **structure_stats.py**: the analysis scripts; rerun
  to extend or audit.
- **sources/**: the four close-reading reports behind the synthesis
  (Psychometrika 2012-2016, Psychometrika 2016-2025, JEM 2005-2014,
  JEM 2014-2025), including ~95 verbatim golden sentences tagged by
  rhetorical function.

Method in brief: stratified close reading of 26 research articles (32
papers drawn) by four analysts plus a 240-paper quantitative pass (seed 42,
~1.47M words). Caveats and full method in `report.md` Section 0.
