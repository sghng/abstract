"""Structural statistics for the style-guide corpus: sections, paragraphs,
sentences, and connectivity. Same 240-paper sample as corpus_stats.py."""
import re, random, glob, statistics
from collections import Counter, defaultdict

random.seed(42)
PSY = sorted(glob.glob('repertoire/md/*.md'))
JEM = sorted(glob.glob('repertoire/jem/md/*.md'))
SAMPLE = [('psy', p) for p in random.sample(PSY, 120)] + \
         [('jem', p) for p in random.sample(JEM, 120)]

CONNECTIVES = ["however","thus","therefore","moreover","furthermore","in addition",
  "additionally","specifically","note that","first","second","third","finally",
  "for example","for instance","in particular","in contrast","by contrast",
  "similarly","consequently","as a consequence","hence","also","indeed",
  "nevertheless","nonetheless","overall","in sum","in summary","in other words",
  "that is","instead","next","again","alternatively","as expected","to summarize"]
ANAPHORA = ("this","these","such")
LOCATIVE = ("in this","in the present","in the following","in section")

def classify(head):
    h = head.lower()
    if 'introduc' in h: return 'intro'
    if 'simulation' in h or 'numerical' in h or 'monte carlo' in h: return 'simulation'
    if 'discussion' in h or 'conclusion' in h or 'concluding' in h: return 'discussion'
    if 'result' in h: return 'results'
    if 'method' in h or 'design' in h or 'procedure' in h or 'estimat' in h: return 'method'
    if 'empirical' in h or 'application' in h or 'real data' in h or 'illustrat' in h or 'example' in h or 'stud' in h: return 'application'
    if 'model' in h or 'theor' in h or 'framework' in h or 'approach' in h or 'analysis' in h: return 'method'
    return 'other'

def sentences_of(text):
    return [s for s in re.split(r'(?<=[.!?])\s+', text.strip()) if len(re.findall(r"[A-Za-z']+", s)) >= 3]

def words_of(s): return re.findall(r"[A-Za-z']+", s)

secs_per_paper = defaultdict(list)
subs_per_paper = defaultdict(list)
sec_paras = defaultdict(list)     # sectiontype -> [paragraph counts]
sec_sents = defaultdict(list)     # sectiontype -> [sentence counts]
para_sents = defaultdict(list)    # journal -> [sentences per paragraph]
sent_len = defaultdict(list)      # journal -> [words]
sent_len_sec = defaultdict(list)  # sectiontype -> [words]
conn_sent = Counter(); total_sent = Counter()
ana_sent = Counter()
conn_para_open = Counter(); para_open_type = Counter(); total_para = Counter()
conn_para_close = Counter()
jacc = defaultdict(list)

for jrnl, path in SAMPLE:
    t = open(path, encoding='utf-8', errors='ignore').read()
    t = re.sub(r'(?im)^#*\s*references\s*$.*', '', t, count=1)
    t = re.sub(r'\$\$.*?\$\$', ' ', t, flags=re.S)
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', t)
    blocks = re.split(r'(?m)^(#{1,4})\s+(.*?)\s*$', t)
    # blocks: [pre, level, head, body, level, head, body, ...]
    heads = [(blocks[i], blocks[i+1]) for i in range(1, len(blocks)-2, 3)]
    top = [h for h in heads if len(h[0]) <= 2]
    secs_per_paper[jrnl].append(len(top))
    subs_per_paper[jrnl].append(len(heads))
    segments = [(blocks[0], 'pre')]
    for i in range(1, len(blocks)-2, 3):
        segments.append((blocks[i+2], blocks[i+1]))
    for body, head in segments:
        stype = classify(head) if head != 'pre' else 'intro'
        paras = []
        for p in re.split(r'\n\s*\n', body):
            p = p.strip()
            if not p or p.startswith('#') or p.startswith('|') or p.startswith('>') or p.startswith('- ') or p.startswith('* '):
                continue
            if len(words_of(p)) < 8: continue
            paras.append(p)
        if not paras: continue
        n_sent = 0
        for p in paras:
            sents = sentences_of(p)
            para_sents[jrnl].append(len(sents))
            n_sent += len(sents)
            total_para[jrnl] += 1
            wl = [w.lower() for w in words_of(p)]
            if not wl: continue
            fw2 = ' '.join(wl[:2]); fw3 = ' '.join(wl[:3])
            if any(fw2.startswith(c) or fw3.startswith(c) for c in CONNECTIVES):
                conn_para_open[jrnl] += 1; para_open_type['connective'] += 1
            elif wl[0] in ANAPHORA:
                para_open_type['anaphora'] += 1
            elif any(fw2.startswith(l) or fw3.startswith(l) for l in LOCATIVE):
                para_open_type['locative'] += 1
            elif re.match(r'(table|figure|algorithm)\b', ' '.join(wl)):
                para_open_type['display'] += 1
            else:
                para_open_type['other'] += 1
            last = [w.lower() for w in words_of(sents[-1])]
            if last and any(' '.join(last[:2]).startswith(c) or ' '.join(last[:3]).startswith(c) for c in CONNECTIVES):
                conn_para_close[jrnl] += 1
            prev = None
            for s in sents:
                w = words_of(s); lw = [x.lower() for x in w]
                if not lw: continue
                sent_len[jrnl].append(len(w)); sent_len_sec[stype].append(len(w))
                total_sent[jrnl] += 1
                j2 = ' '.join(lw[:2]); j3 = ' '.join(lw[:3])
                if any(j2.startswith(c) or j3.startswith(c) for c in CONNECTIVES):
                    conn_sent[jrnl] += 1
                if lw[0] in ANAPHORA:
                    ana_sent[jrnl] += 1
                if prev is not None:
                    a, b = set(x for x in prev if len(x) > 4), set(x for x in lw if len(x) > 4)
                    if a or b: jacc[jrnl].append(len(a & b) / max(1, len(a | b)))
                prev = lw
        sec_paras[stype].append(len(paras))
        sec_sents[stype].append(n_sent)

def dist(v):
    v = sorted(v); n = len(v)
    return dict(n=n, mean=round(statistics.mean(v),1), median=int(statistics.median(v)),
                p10=v[n//10], p25=v[n//4], p75=v[3*n//4], p90=v[9*n//10], p99=v[min(n-1,int(n*0.99))])

print('== sections per paper (top-level / all headings) ==')
for j in ('psy','jem'):
    print(j, 'top:', dist(secs_per_paper[j]), '\n   all:', dist(subs_per_paper[j]))
print('\n== paragraphs per section, by section type ==')
for st in ('intro','method','simulation','results','application','discussion','other'):
    print(st, dist(sec_paras[st]))
print('\n== sentences per section, by section type ==')
for st in ('intro','method','simulation','results','application','discussion','other'):
    print(st, dist(sec_sents[st]))
print('\n== sentences per paragraph ==')
for j in ('psy','jem'):
    v = sorted(para_sents[j]); n=len(v)
    print(j, 'mean %.1f median %d p10 %d p90 %d' % (statistics.mean(v), statistics.median(v), v[n//10], v[9*n//10]))
print('\n== sentence length (words) ==')
for j in ('psy','jem'):
    d = dist(sent_len[j])
    over40 = 100*sum(1 for x in sent_len[j] if x>=40)/len(sent_len[j])
    print(j, d, 'pct>=40w: %.1f' % over40)
print('\n== sentence length by section type ==')
for st in ('intro','method','simulation','results','application','discussion'):
    d = dist(sent_len_sec[st]); print(st, d['mean'], d['median'], d['p90'])
print('\n== connectivity ==')
for j in ('psy','jem'):
    print(j, 'sentences opening with connective: %.1f%%  with anaphoric this/these/such: %.1f%%' %
          (100*conn_sent[j]/total_sent[j], 100*ana_sent[j]/total_sent[j]))
    print(j, 'paragraphs opening with connective: %.1f%%  closing sentence connective: %.1f%%' %
          (100*conn_para_open[j]/total_para[j], 100*conn_para_close[j]/total_para[j]))
    print(j, 'adjacent-sentence lexical Jaccard: mean %.3f median %.3f' %
          (statistics.mean(jacc[j]), statistics.median(jacc[j])))
print('paragraph opening types (combined):', dict(para_open_type.most_common()))
