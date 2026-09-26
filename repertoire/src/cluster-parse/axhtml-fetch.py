#!/usr/bin/env python3
"""Fetch arXiv HTML for tex-failed papers. Phase 1: arxiv.org/html
(official, distributed). Phase 2: ar5iv (labs service, single paced
stream). Saves ~/parse-run/raw-html/<id>.html only for real LaTeXML
pages; ledger in ~/parse-run/raw-html/<phase>-miss.ids.
Usage: axhtml-fetch.py <phase> <slice-file>
"""

import os
import socket
import sys
import time
import urllib.error
import urllib.request

# compute nodes have broken IPv6 egress: urllib waits out the v6 timeout
# (~80s) per request before v4 fallback. Force v4 (curl-fast parity).
_orig_getaddrinfo = socket.getaddrinfo
socket.getaddrinfo = lambda *a, **k: [
    r for r in _orig_getaddrinfo(*a, **k) if r[0] == socket.AF_INET
]

phase, slice_f = sys.argv[1], sys.argv[2]
R = os.path.expanduser("~/parse-run")
OUT = f"{R}/raw-html"
os.makedirs(OUT, exist_ok=True)
DELAY = {"1": 2.5, "2": 3.0}[phase]
BASE = {"1": "https://arxiv.org/html/", "2": "https://ar5iv.labs.arxiv.org/html/"}[
    phase
]

ids = [l.strip() for l in open(slice_f) if l.strip()]
ok = miss = have = 0
for i in ids:
    dst = f"{OUT}/{i}.html"
    if os.path.exists(dst) and os.path.getsize(dst) > 20000:
        have += 1
        continue
    arx = i.split(":")[1].replace("arxiv.", "", 1)
    try:
        req = urllib.request.Request(
            BASE + arx,
            headers={"User-Agent": "corpus-fetch/0.1 (contact: ghuang3@nd.edu)"},
        )
        t = urllib.request.urlopen(req, timeout=40).read().decode("utf-8", "replace")
        # accept only genuine LaTeXML renders, not abs-page redirects
        if len(t) > 20000 and ("ltx_page_main" in t or "ltx_document" in t):
            open(dst, "w").write(t)
            ok += 1
        else:
            miss += 1
            open(f"{OUT}/{phase}-miss.ids", "a").write(i + "\n")
    except Exception:
        miss += 1
        open(f"{OUT}/{phase}-miss.ids", "a").write(i + "\n")
    if (ok + miss) % 50 == 0:
        print(f"{phase}: {ok + miss + have}/{len(ids)} ok={ok} miss={miss}", flush=True)
    time.sleep(DELAY)
print(f"PHASE {phase} DONE: ok={ok} miss={miss} already={have}", flush=True)
