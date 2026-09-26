#!/usr/bin/env python3
"""Repair raw-HTML leaks in finished md: convert each html island through
pandoc (tables become pipe markdown) instead of stripping tags. In place,
only when something changes. Input: id list file. Protected: code fences
and inline code. Ledger: out/report/report-leakfix.jsonl"""

import json
import os
import re
import subprocess
import sys
import tempfile

R = os.path.expanduser("~/parse-run")
PANDOC = f"{R}/bin/pandoc"
ATTRS = r"""(?:"[^"]*"|'[^']*'|[^>"'])*"""
SPLIT = re.compile(r"(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)")
ISLAND = re.compile(
    r"(<(?:table|figure|figcaption|img|span|div|math|svg)\b"
    + ATTRS
    + r">[\s\S]*?</(?:table|figure|figcaption|span|div|math|svg)>"
    r"|<(?:img|embed)\b" + ATTRS + r"/>)",
    re.I,
)


def pandoc(frag):
    with tempfile.NamedTemporaryFile(
        "w", suffix=".html", delete=False, dir="/tmp"
    ) as f:
        f.write(frag)
        p = f.name
    try:
        out = subprocess.run(
            [PANDOC, "-f", "html", "-t", "markdown", "--wrap=none", p],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        return out
    finally:
        os.unlink(p)


def fix(md):
    parts = SPLIT.split(md)
    changed = 0
    for k, part in enumerate(parts):
        if k % 2:  # code fence/inline: untouched
            continue

        def repl(m):
            nonlocal changed
            try:
                conv = pandoc(m.group(0))
            except subprocess.CalledProcessError:
                return m.group(0)
            if conv and conv != m.group(0):
                changed += 1
                return "\n" + conv + "\n"
            return m.group(0)

        parts[k] = ISLAND.sub(repl, part)
    return "".join(parts), changed


ids = [l.strip() for l in open(sys.argv[1]) if l.strip()]
fixed = clean = err = 0
with open(f"{R}/out/report/report-leakfix.jsonl", "w") as rep:
    for i in ids:
        p = f"{R}/out/md/{i}.md"
        try:
            md = open(p, errors="replace").read()
            new, n = fix(md)
            if new != md:
                open(p, "w").write(new)
                fixed += 1
                rec = {"id": i, "status": "fixed", "islands": n}
            else:
                clean += 1
                rec = {"id": i, "status": "no-change", "islands": n}
        except Exception as e:
            err += 1
            rec = {"id": i, "status": "error", "error": str(e)[:200]}
        rep.write(json.dumps(rec) + "\n")
        if (fixed + clean + err) % 200 == 0:
            print(
                f"{fixed + clean + err}/{len(ids)} fixed={fixed} clean={clean} err={err}",
                flush=True,
            )
print(f"LEAKFIX DONE: fixed={fixed} clean={clean} err={err}", flush=True)
