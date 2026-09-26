#!/usr/bin/env python3
"""Re-sweep stats for a subset of ids (arg: id file) -> md-stats-fixed.tsv.
Same scoring as md-stats.py."""

import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor

R = os.path.expanduser("~/parse-run")
HDR = re.compile(r"^#{1,6} .", re.M)
DOLLAR = re.compile(r"\$\$")
FORMULA = re.compile(r"\[formula\]")
LTX = re.compile(r"ltx_")
RAW = re.compile(r"<(?:span|div|figure|embed|img|math|table)\b", re.I)


def one(i):
    p = f"{R}/out/md/{i}.md"
    t = open(p, errors="replace").read()
    b = len(t.encode("utf-8", "replace"))
    h = len(HDR.findall(t))
    m = len(DOLLAR.findall(t))
    f = len(FORMULA.findall(t))
    flags = []
    if b < 2048:
        flags.append("tiny")
    if h == 0:
        flags.append("no-headings")
    if f > 20:
        flags.append("formula-heavy")
    if LTX.search(t):
        flags.append("ltx-residual")
    if RAW.search(t):
        flags.append("raw-leak")
    return f"{i}\t{b}\t{h}\t{m}\t{f}\t{'|'.join(flags)}"


ids = [l.strip() for l in open(sys.argv[1]) if l.strip()]
with open(f"{R}/out/report/md-stats-fixed.tsv", "w") as out:
    for i in ids:
        out.write(one(i) + "\n")
print("SUBSWEEP DONE:", len(ids))
