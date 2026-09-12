#!/usr/bin/env python3
"""Quantitative stylistic analysis of Psychometrika + JEM corpora.

Samples 120 papers per journal (seed 42), lightly cleans markdown, and
computes sentence openers, hedges/boosters, person/voice, stock phrases,
reporting patterns, tense proxies, headings, abstract patterns,
Latin/abbreviations, and sentence length statistics. Prints a markdown
report to stdout.
"""

import re
import random
from collections import Counter
from pathlib import Path

PSY_DIR = Path("/Users/sghng/dev/agent/abstract/repertoire/md")
JEM_DIR = Path("/Users/sghng/dev/agent/abstract/repertoire/jem/md")
N_SAMPLE = 120
SEED = 42

# ---------------------------------------------------------------- cleaning

REF_HEAD_RE = re.compile(r"^#*\s*references\s*$", re.IGNORECASE)
IMG_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")
BOLD_RE = re.compile(r"\*\*|__")

ABBREVS = (
    "e.g.", "i.e.", "cf.", "et al.", "vs.", "viz.", "fig.", "dr.", "mr.",
    "mrs.", "prof.", "st.", "approx.", "no.", "inc.", "ltd.", "jr.",
    "sr.", "resp.", "rev.", "ed.", "eds.", "vol.", "pp.", "p.", "sec.",
    "eq.", "eqs.", "w.r.t.", "al.", "etc.", "ca.",
)
SENT_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(])")
WORD_RE = re.compile(r"[a-z][a-z'\-]*")


def strip_refs(text):
    lines = text.splitlines()
    for i, ln in enumerate(lines):
        if REF_HEAD_RE.match(ln.strip()):
            return "\n".join(lines[:i])
    return text


def skip_line(ln):
    """Skip table rows, equation lines, and mostly-symbol lines."""
    s = ln.strip()
    if not s:
        return True
    if s.startswith("|") or s.count("|") >= 2:
        return True
    if s.startswith("$") or s.startswith("\\["):
        return True
    if re.match(r"^[#>\-*\s]*$", s):
        return True
    alnum = sum(c.isalnum() for c in s)
    if len(s) >= 20 and alnum / len(s) < 0.45:
        return True
    return False


def clean(text):
    text = strip_refs(text)
    text = IMG_RE.sub(" ", text)
    text = LINK_RE.sub(r"\1", text)
    text = BOLD_RE.sub("", text)
    text = re.sub(r"\$\$?[^$]*\$\$?", " ", text)  # inline math
    text = re.sub(r"`[^`]*`", " ", text)
    lines = [ln for ln in text.splitlines() if not skip_line(ln)]
    text = " ".join(ln.strip() for ln in lines)
    text = re.sub(r"\s+", " ", text)
    return text


def split_sentences(text):
    # protect abbreviations
    protected = text
    for ab in ABBREVS:
        protected = protected.replace(ab, ab.replace(".", "\x00"))
    # protect "Table 3." style trailing-period numbers mid-sentence? leave as is
    parts = SENT_SPLIT_RE.split(protected)
    sents = [p.replace("\x00", ".") for p in parts]
    sents = [s.strip() for s in sents if len(s.strip()) > 2]
    return sents


def tokens(text):
    return WORD_RE.findall(text.lower())


# ---------------------------------------------------------------- analysis

def per10k(count, total):
    return 10000.0 * count / total if total else 0.0


HEDGE_TERMS = [
    "may", "might", "could", "appears", "appear", "seems", "seem",
    "suggests", "suggest", "likely", "unlikely", "tends", "tend",
    "generally", "typically", "often", "usually", "relatively",
    "somewhat", "quite", "very", "clearly", "obviously", "certainly",
    "indeed", "importantly", "notably",
]

STOCK_PHRASES = [
    "it is worth noting", "it should be noted", "note that",
    "it is well known", "as mentioned above", "as described in",
    "in the sense that", "with respect to", "in terms of",
    "on the other hand", "in contrast", "in particular",
    "for example", "for instance", "such that", "so that",
    "in order to", "due to", "based on", "as follows",
    "the remainder of this", "is organized as follows",
    "without loss of generality", "it turns out", "it follows that",
    "as can be seen", "as shown in", "in line with", "consistent with",
    "in the context of",
]

PASSIVE_AUX = ["is", "are", "was", "were", "been", "be"]
PASSIVE_PPS = [
    "estimated", "assumed", "defined", "given", "obtained", "used",
    "proposed", "considered", "noted", "shown", "derived", "computed",
    "fitted", "fit", "modeled", "modelled", "specified", "presented",
    "discussed", "described", "developed", "applied",
]

TENSE_VERBS = [
    "propose", "present", "consider", "use", "assume", "show",
    "develop", "examine", "investigate", "evaluate", "compare",
    "conduct", "perform", "apply", "discuss", "find", "demonstrate",
]
PAST_FORMS = {
    "propose": "proposed", "present": "presented", "consider": "considered",
    "use": "used", "assume": "assumed", "show": "showed",
    "develop": "developed", "examine": "examined",
    "investigate": "investigated", "evaluate": "evaluated",
    "compare": "compared", "conduct": "conducted", "perform": "performed",
    "apply": "applied", "discuss": "discussed", "find": "found",
    "demonstrate": "demonstrated",
}

CONNECTIVE_OPENERS = {
    "however", "moreover", "furthermore", "nevertheless", "nonetheless",
    "therefore", "thus", "hence", "consequently", "additionally",
    "specifically", "notably", "importantly", "interestingly",
    "alternatively", "finally", "second", "third", "first", "next",
    "note", "indeed", "clearly", "obviously", "instead", "similarly",
    "likewise", "also", "again", "overall", "briefly",
}

REPORT_PATTERNS = [
    ("p <", re.compile(r"p\s*<")),
    ("p =", re.compile(r"p\s*=")),
    ("M =", re.compile(r"\bM\s*=")),
    ("SD =", re.compile(r"\bSD\s*=")),
    ("SE =", re.compile(r"\bSE\s*=")),
    ("95% CI", re.compile(r"95\s*%\s*CI", re.IGNORECASE)),
    ("b/beta =", re.compile(r"\bb\s*=|\bbeta\s*=", re.IGNORECASE)),
    ("chi-sq", re.compile(r"chi-?square|chi-?squared|χ2", re.IGNORECASE)),
    ("t(", re.compile(r"\bt\s*\(")),
    ("F(", re.compile(r"\bF\s*\(")),
]

TABFIG_VERBS = [
    "shows", "presents", "reports", "displays", "summarizes",
    "summarises", "contains", "lists", "gives", "provides",
]

LATIN_TERMS = ["e.g.", "i.e.", "cf.", "et al.", "vs.", "w.r.t.", "iff", "etc."]


class JournalStats:
    def __init__(self, name):
        self.name = name
        self.n_papers = 0
        self.n_words = 0
        self.n_sents = 0
        self.sent_lens = []
        self.opener1 = Counter()
        self.opener2 = Counter()
        self.connective_opener_counts = Counter()
        self.word_freq = Counter()
        self.passive_bigrams = Counter()
        self.passive_total = 0
        self.stock = Counter()
        self.person = Counter()  # we, our, i, the authors, this paper/article/study
        self.report = Counter()
        self.tabfig_refs = Counter()  # "Table"/"Figure" mention counts
        self.tabfig_verb = Counter()  # "Table 1 shows" style
        self.tense = {v: Counter() for v in TENSE_VERBS}
        self.headings = Counter()
        self.abstract_open3 = Counter()
        self.abstract_we_papers = 0
        self.abstract_papers = 0
        self.latin = Counter()

    def add_paper(self, raw_text):
        self.n_papers += 1
        text = clean(raw_text)
        # pre-math-stripping text for reporting patterns (p-values live in $$)
        pre_math = strip_refs(raw_text)
        pre_math = IMG_RE.sub(" ", pre_math)
        pre_math = LINK_RE.sub(r"\1", pre_math)
        words = tokens(text)
        self.n_words += len(words)
        self.word_freq.update(words)
        sents = split_sentences(text)
        self.n_sents += len(sents)

        for s in sents:
            w = tokens(s)
            if not w:
                continue
            self.sent_lens.append(len(w))
            self.opener1[w[0]] += 1
            if len(w) >= 2:
                self.opener2[(w[0], w[1])] += 1
            if w[0] in CONNECTIVE_OPENERS:
                self.connective_opener_counts[w[0]] += 1

        # person & voice on raw lowercased text ("I" case-sensitive on pre_math)
        low = text.lower()
        self.person["we"] += len(re.findall(r"\bwe\b", low))
        self.person["our"] += len(re.findall(r"\bour\b", low))
        self.person["I"] += len(re.findall(r"\bI\b", pre_math))
        self.person["the authors"] += len(re.findall(r"\bthe authors\b", low))
        self.person["this paper/article/study"] += len(
            re.findall(r"\bthis (paper|article|study)\b", low)
        )

        # passive bigrams
        for aux in PASSIVE_AUX:
            for pp in PASSIVE_PPS:
                pat = r"\b%s %s\b" % (aux, pp)
                n = len(re.findall(pat, low))
                if n:
                    self.passive_bigrams["%s %s" % (aux, pp)] += n
                    self.passive_total += n

        # stock phrases
        for ph in STOCK_PHRASES:
            self.stock[ph] += len(re.findall(re.escape(ph) + r"\b", low))

        # reporting patterns (case-sensitive where given; pre-math-strip text)
        for label, pat in REPORT_PATTERNS:
            self.report[label] += len(pat.findall(pre_math))

        # table/figure refs and citation verbs
        self.tabfig_refs["Table"] += len(re.findall(r"\bTable \d+", text))
        self.tabfig_refs["Figure"] += len(re.findall(r"\bFigure \d+", text))
        low2 = low
        for kind in ("table", "figure"):
            for verb in TABFIG_VERBS:
                n = len(re.findall(
                    r"\b%s \d+ %s\b" % (kind, verb), low2))
                if n:
                    self.tabfig_verb["%s ... %s" % (kind, verb)] += n

        # tense proxies
        for v in TENSE_VERBS:
            pres = len(re.findall(r"\bwe %s\b" % v, low))
            past = len(re.findall(r"\bwe %s\b" % PAST_FORMS[v], low))
            self.tense[v]["present"] += pres
            self.tense[v]["past"] += past

        # headings (from raw text, before ref strip? use raw minus refs)
        no_refs = strip_refs(raw_text)
        for ln in no_refs.splitlines():
            m = re.match(r"^(#{1,6})\s+(.+?)\s*$", ln)
            if m:
                h = m.group(2).strip().lower()
                h = re.sub(r"^\d+(\.\d+)*[.\s]*", "", h).strip()
                h = re.sub(r"[^a-z0-9 &/-]", "", h)
                h = re.sub(r"\d+", "", h).strip()
                if h:
                    self.headings[h] += 1

        # latin / abbreviations (on raw lowercased text with dots)
        for t in LATIN_TERMS:
            self.latin[t] += len(re.findall(r"\b" + re.escape(t), low))

    def add_abstract(self, raw_text):
        m = re.search(r"(?i)abstract[:\s]*\n*(.*?)(?=\n\s*#{1,6}\s)", raw_text, re.DOTALL)
        if not m:
            # fall back: text before first heading
            m2 = re.search(r"(?s)^(.*?)(?=\n\s*#{1,6}\s)", raw_text)
            if not m2:
                return
            seg = m2.group(1)
        else:
            seg = m.group(1)
        seg = clean(seg)
        if len(tokens(seg)) < 30:
            return
        self.abstract_papers += 1
        w = tokens(seg)
        if len(w) >= 3:
            self.abstract_open3[tuple(w[:3])] += 1
        low = seg.lower()
        if re.search(r"\bwe\b|\bour\b", low):
            self.abstract_we_papers += 1


def sample_files(directory, n, rng):
    files = sorted(directory.glob("*.md"))
    return rng.sample(files, min(n, len(files)))


def run_journal(name, directory, rng):
    js = JournalStats(name)
    files = sample_files(directory, N_SAMPLE, rng)
    abs_files = set(rng.sample(files, min(60, len(files))))
    for f in files:
        try:
            raw = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        js.add_paper(raw)
        if f in abs_files:
            js.add_abstract(raw)
    return js


def combine(journals):
    c = JournalStats("Combined")
    for js in journals:
        c.n_papers += js.n_papers
        c.n_words += js.n_words
        c.n_sents += js.n_sents
        c.sent_lens.extend(js.sent_lens)
        for attr in ("opener1", "opener2", "connective_opener_counts",
                     "word_freq", "passive_bigrams", "stock", "person",
                     "report", "tabfig_refs", "tabfig_verb", "headings",
                     "abstract_open3", "latin"):
            getattr(c, attr).update(getattr(js, attr))
        c.passive_total += js.passive_total
        c.abstract_we_papers += js.abstract_we_papers
        c.abstract_papers += js.abstract_papers
        for v in TENSE_VERBS:
            c.tense[v].update(js.tense[v])
    return c


# ---------------------------------------------------------------- report

def pct(x):
    return "%.1f" % x


def mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def median(xs):
    if not xs:
        return 0.0
    s = sorted(xs)
    n = len(s)
    return (s[n // 2 - 1] + s[n // 2]) / 2.0 if n % 2 == 0 else s[n // 2]


def p90(xs):
    if not xs:
        return 0.0
    s = sorted(xs)
    return s[min(len(s) - 1, int(0.9 * len(s)))]


def table(rows, headers):
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def report(journals, combined):
    L = []
    a = L.append
    psy, jem = journals

    a("# Corpus Stylistic Statistics: Psychometrika vs. JEM")
    a("")
    a("Sample: %d Psychometrika papers + %d JEM papers (seed 42). "
      "Psychometrika: %d words, %d sentences. JEM: %d words, %d sentences. "
      "Rates are per 10,000 units (words or sentences, as marked). Reference "
      "lists, tables, equations, and image/link markup were stripped before "
      "analysis." % (psy.n_papers, jem.n_papers, psy.n_words, psy.n_sents,
                     jem.n_words, jem.n_sents))
    a("")

    # ---- 1 sentence openers
    a("## 1. Sentence openers")
    a("")
    a("Top 25 first words (rate per 10k sentences):")
    a("")
    rows = []
    psy_top = psy.opener1.most_common(25)
    jem_top = jem.opener1.most_common(25)
    keys = [k for k, _ in psy_top]
    for k, _ in jem_top:
        if k not in keys:
            keys.append(k)
    for k in keys[:25]:
        rows.append([k,
                     pct(per10k(psy.opener1[k], psy.n_sents)),
                     pct(per10k(jem.opener1[k], jem.n_sents)),
                     pct(per10k(combined.opener1[k], combined.n_sents))])
    a(table(rows, ["first word", "Psy", "JEM", "Combined"]))
    a("")
    a("Top 25 two-word openers (combined, rate per 10k sentences):")
    a("")
    rows = []
    for (w1, w2), n in combined.opener2.most_common(25):
        rows.append(["%s %s" % (w1, w2), n,
                     pct(per10k(n, combined.n_sents))])
    a(table(rows, ["two-word opener", "count", "per 10k sents"]))
    a("")
    a("Connective openers (per 10k sentences):")
    a("")
    rows = []
    keys = sorted(combined.connective_opener_counts,
                  key=lambda k: -combined.connective_opener_counts[k])[:25]
    for k in keys:
        rows.append([k,
                     pct(per10k(psy.connective_opener_counts[k], psy.n_sents)),
                     pct(per10k(jem.connective_opener_counts[k], jem.n_sents)),
                     pct(per10k(combined.connective_opener_counts[k],
                                combined.n_sents))])
    a(table(rows, ["opener", "Psy", "JEM", "Combined"]))
    a("")

    # ---- 2 hedges & boosters
    a("## 2. Hedges & boosters (per 10k words)")
    a("")
    rows = []
    for t in HEDGE_TERMS:
        rows.append([t,
                     pct(per10k(psy.word_freq[t], psy.n_words)),
                     pct(per10k(jem.word_freq[t], jem.n_words)),
                     pct(per10k(combined.word_freq[t], combined.n_words))])
    a(table(rows, ["term", "Psy", "JEM", "Combined"]))
    a("")

    # ---- 3 person & voice
    a("## 3. Person & voice (per 10k words)")
    a("")
    rows = []
    for k in ("we", "our", "I", "the authors", "this paper/article/study"):
        rows.append([k,
                     pct(per10k(psy.person[k], psy.n_words)),
                     pct(per10k(jem.person[k], jem.n_words)),
                     pct(per10k(combined.person[k], combined.n_words))])
    a(table(rows, ["form", "Psy", "JEM", "Combined"]))
    a("")
    a("Passive-proxy bigrams: total per 10k words -- Psy %s, JEM %s, "
      "Combined %s." % (pct(per10k(psy.passive_total, psy.n_words)),
                        pct(per10k(jem.passive_total, jem.n_words)),
                        pct(per10k(combined.passive_total, combined.n_words))))
    a("")
    a("Top 25 passive-proxy bigrams (combined, per 10k words):")
    a("")
    rows = []
    for bg, n in combined.passive_bigrams.most_common(25):
        rows.append([bg,
                     pct(per10k(psy.passive_bigrams[bg], psy.n_words)),
                     pct(per10k(jem.passive_bigrams[bg], jem.n_words)),
                     pct(per10k(n, combined.n_words))])
    a(table(rows, ["bigram", "Psy", "JEM", "Combined"]))
    a("")

    # ---- 4 stock phrases
    a("## 4. Stock phrases (per 10k words)")
    a("")
    rows = []
    for ph in STOCK_PHRASES:
        rows.append([ph,
                     pct(per10k(psy.stock[ph], psy.n_words)),
                     pct(per10k(jem.stock[ph], jem.n_words)),
                     pct(per10k(combined.stock[ph], combined.n_words))])
    rows.sort(key=lambda r: -float(r[3]))
    a(table(rows, ["phrase", "Psy", "JEM", "Combined"]))
    a("")

    # ---- 5 reporting patterns
    a("## 5. Reporting patterns (per 10k words)")
    a("")
    rows = []
    for label, _ in REPORT_PATTERNS:
        rows.append([label,
                     pct(per10k(psy.report[label], psy.n_words)),
                     pct(per10k(jem.report[label], jem.n_words)),
                     pct(per10k(combined.report[label], combined.n_words))])
    a(table(rows, ["pattern", "Psy", "JEM", "Combined"]))
    a("")
    a("Table/Figure numbered references (per 10k words): "
      "Table -- Psy %s, JEM %s; Figure -- Psy %s, JEM %s." % (
          pct(per10k(psy.tabfig_refs["Table"], psy.n_words)),
          pct(per10k(jem.tabfig_refs["Table"], jem.n_words)),
          pct(per10k(psy.tabfig_refs["Figure"], psy.n_words)),
          pct(per10k(jem.tabfig_refs["Figure"], jem.n_words))))
    a("")
    a("\"Table/Figure N + verb\" constructions (combined counts, per 10k words):")
    a("")
    rows = []
    for k, n in combined.tabfig_verb.most_common(25):
        rows.append([k, n, pct(per10k(n, combined.n_words))])
    a(table(rows, ["pattern", "count", "per 10k words"]))
    a("")

    # ---- 6 tense proxy
    a("## 6. Tense proxy: \"we + verb\" (per 10k words; ratio = present/past)")
    a("")
    rows = []
    for v in TENSE_VERBS:
        pr = combined.tense[v]["present"]
        pa = combined.tense[v]["past"]
        ratio = "%.2f" % (pr / pa) if pa else ("inf" if pr else "-")
        rows.append([v,
                     pct(per10k(pr, combined.n_words)),
                     pct(per10k(pa, combined.n_words)),
                     ratio])
    rows.sort(key=lambda r: -(float(r[1]) + float(r[2])))
    a(table(rows, ["verb", "we+present", "we+past", "present/past"]))
    a("")
    a("Per-journal totals (per 10k words): Psy present %s / past %s; "
      "JEM present %s / past %s." % (
          pct(per10k(sum(psy.tense[v]["present"] for v in TENSE_VERBS),
                     psy.n_words)),
          pct(per10k(sum(psy.tense[v]["past"] for v in TENSE_VERBS),
                     psy.n_words)),
          pct(per10k(sum(jem.tense[v]["present"] for v in TENSE_VERBS),
                     jem.n_words)),
          pct(per10k(sum(jem.tense[v]["past"] for v in TENSE_VERBS),
                     jem.n_words))))
    a("")

    # ---- 7 headings
    a("## 7. Section headings (normalized; per journal, with combined)")
    a("")
    rows = []
    keys = [k for k, _ in combined.headings.most_common(25)]
    for k in keys:
        rows.append([k, psy.headings[k], jem.headings[k],
                     combined.headings[k]])
    a(table(rows, ["heading", "Psy", "JEM", "Combined"]))
    a("")

    # ---- 8 abstracts
    a("## 8. Abstract patterns (60 random papers per journal)")
    a("")
    a("Abstracts extracted: Psy %d/%d, JEM %d/%d. "
      "Papers whose abstract contains 'we'/'our': Psy %s%%, JEM %s%%." % (
          psy.abstract_papers, 60, jem.abstract_papers, 60,
          pct(100.0 * psy.abstract_we_papers / max(1, psy.abstract_papers)),
          pct(100.0 * jem.abstract_we_papers / max(1, jem.abstract_papers))))
    a("")
    a("Top 15 abstract opening 3-grams (combined):")
    a("")
    rows = []
    for g, n in combined.abstract_open3.most_common(15):
        rows.append([" ".join(g), n])
    a(table(rows, ["opening 3-gram", "count"]))
    a("")

    # ---- 9 latin
    a("## 9. Latin & abbreviations (per 10k words)")
    a("")
    rows = []
    for t in LATIN_TERMS:
        rows.append([t,
                     pct(per10k(psy.latin[t], psy.n_words)),
                     pct(per10k(jem.latin[t], jem.n_words)),
                     pct(per10k(combined.latin[t], combined.n_words))])
    a(table(rows, ["term", "Psy", "JEM", "Combined"]))
    a("")

    # ---- 10 sentence length
    a("## 10. Sentence length (words)")
    a("")
    rows = []
    for js in [psy, jem, combined]:
        rows.append([js.name, pct(mean(js.sent_lens)),
                     pct(median(js.sent_lens)), pct(p90(js.sent_lens))])
    a(table(rows, ["corpus", "mean", "median", "p90"]))
    a("")
    return "\n".join(L)


def findings(journals, combined):
    psy, jem = journals
    pts = []

    def r(num, den):
        return 10000.0 * num / den if den else 0.0

    # tense ratios for notable verbs
    def ratio(v):
        pr = combined.tense[v]["present"]
        pa = combined.tense[v]["past"]
        return (pr / pa) if pa else (float("inf") if pr else 0.0)

    show = ratio("show")
    prop = ratio("propose")
    use = ratio("use")
    pts.append("\"we show\" is %.1fx as common as \"we showed\"; "
               "\"we propose\" is %.1fx \"we proposed\"; \"we use\" is %.1fx "
               "\"we used\" (combined corpus)." % (show, prop, use))

    # passive comparison
    pp = r(psy.passive_total, psy.n_words)
    pj = r(jem.passive_total, jem.n_words)
    if pj:
        diff = 100.0 * (pp - pj) / pj
        word = "more" if diff >= 0 else "less"
        pts.append("Passive-proxy bigrams: %.0f per 10k words in Psychometrika "
                   "vs. %.0f in JEM (%.0f%% %s in Psychometrika)."
                   % (pp, pj, abs(diff), word))

    # we / the authors
    we_c = r(combined.person["we"], combined.n_words)
    ta_c = r(combined.person["the authors"], combined.n_words)
    pts.append("\"we\": %.0f per 10k words; \"the authors\": %.1f "
               "(ratio %.0fx)." % (we_c, ta_c, we_c / ta_c if ta_c else 0))

    # top stock phrases
    top3 = sorted(STOCK_PHRASES,
                  key=lambda p: -combined.stock[p])[:3]
    pts.append("Top stock phrases (per 10k words): " + ", ".join(
        "\"%s\" %.1f" % (p, r(combined.stock[p], combined.n_words))
        for p in top3) + ".")

    # connective openers
    co = sorted(combined.connective_opener_counts,
                key=lambda k: -combined.connective_opener_counts[k])[:3]
    pts.append("Top connective sentence openers (per 10k sentences): " +
               ", ".join("\"%s\" %.0f" % (k, r(combined.connective_opener_counts[k],
                                              combined.n_sents)) for k in co) + ".")

    # first vs this
    t1 = combined.opener1.most_common(3)
    pts.append("Top sentence-first words: " + ", ".join(
        "\"%s\" (%.0f/10k)" % (k, r(v, combined.n_sents)) for k, v in t1) + ".")

    # e.g. / i.e.
    eg = r(combined.latin["e.g."], combined.n_words)
    ie = r(combined.latin["i.e."], combined.n_words)
    pts.append("\"e.g.\" %.1f and \"i.e.\" %.1f per 10k words." % (eg, ie))

    # sentence length
    pts.append("Mean sentence length: %.1f words (Psy) vs. %.1f (JEM); "
               "p90: %.0f vs. %.0f."
               % (mean(psy.sent_lens), mean(jem.sent_lens),
                  p90(psy.sent_lens), p90(jem.sent_lens)))

    # hedges: may / suggests
    mayr = r(combined.word_freq["may"], combined.n_words)
    sug = r(combined.word_freq["suggests"], combined.n_words) + \
        r(combined.word_freq["suggest"], combined.n_words)
    pts.append("Top hedges (per 10k words): \"may\" %.0f, "
               "\"suggest(s)\" %.0f." % (mayr, sug))

    # abstracts first person
    tot_abs = combined.abstract_papers
    we_abs = combined.abstract_we_papers
    if tot_abs:
        pts.append("%.0f%% of sampled abstracts use \"we\"/\"our\"."
                   % (100.0 * we_abs / tot_abs))

    return pts


def main():
    rng = random.Random(SEED)
    psy = run_journal("Psychometrika", PSY_DIR, rng)
    jem = run_journal("JEM", JEM_DIR, rng)
    combined = combine([psy, jem])

    out = []
    out.append("# Corpus Stylistic Statistics: Psychometrika vs. JEM")
    out.append("")
    out.append("## Key quantitative findings")
    out.append("")
    for p in findings([psy, jem], combined):
        out.append("- " + p)
    out.append("")
    body = report([psy, jem], combined)
    # drop duplicated top-level title from body
    body_lines = body.splitlines()
    if body_lines and body_lines[0].startswith("# "):
        body = "\n".join(body_lines[1:]).lstrip("\n")
    out.append(body)
    text = "\n".join(out)
    print(text)
    Path("/Users/sghng/dev/agent/abstract/style-guide/corpus_stats.md").write_text(
        text + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
