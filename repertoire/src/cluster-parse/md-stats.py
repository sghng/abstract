#!/usr/bin/env python3
"""Sweep out/md and emit per-file stats TSV: doi_id, bytes, headings,
math_blocks, formula_tokens, flags (|-joined). Feeds parse_report on D1."""

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


def one(fn):
    p = f"{R}/out/md/{fn}"
    try:
        t = open(p, errors="replace").read()
    except OSError:
        return None
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
    return f"{fn[:-3]}\t{b}\t{h}\t{m}\t{f}\t{'|'.join(flags)}"


if __name__ == "__main__":
    files = sorted(f for f in os.listdir(f"{R}/out/md") if f.endswith(".md"))
    with (
        open(f"{R}/out/report/md-stats.tsv", "w") as out,
        ProcessPoolExecutor(max_workers=8) as ex,
    ):
        for row in ex.map(one, files, chunksize=200):
            if row:
                out.write(row + "\n")
    print(f"SWEEP DONE: {len(files)} files")
