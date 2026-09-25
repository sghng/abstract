#!/usr/bin/env python3
"""Convert fetched arXiv LaTeXML html to md, contest vs the docling md.

Per id: sanitize html (drop ltx_ERROR spans, svg, media; unwrap layout
tags keeping <math> for pandoc), pandoc html->md, md-sweep leftovers,
gate (headings/size), then ship only when it beats the existing md on
headings and math density. Ledger: ~/parse-run/out/report/report-axhtml.jsonl
"""

import json
import os
import re
import subprocess
import sys

R = os.path.expanduser("~/parse-run")
PANDOC = f"{R}/bin/pandoc"
TMP = os.environ.get("TMPDIR", "/tmp")

ATTRS = r"""(?:"[^"]*"|'[^']*'|[^>"'])*"""
ERR_SPAN = re.compile(
    r"<span\b(?:"
    + ATTRS
    + r')class="[^"]*ltx_ERROR[^"]*"(?:'
    + ATTRS
    + r")>[\s\S]*?</span>"
)
SVG = re.compile(r"<svg\b(?:" + ATTRS + r")>[\s\S]*?</svg>", re.I)
MEDIA = re.compile(
    r"<(?:embed|img|picture|video|audio|source|track)\b(?:" + ATTRS + r")/?>", re.I
)
UNWRAP = re.compile(
    r"</?(?:div|span|a|abbr|figure|figcaption|aside|footer|header|nav|section|article|main)\b(?:"
    + ATTRS
    + r")/?>",
    re.I,
)
# md stage: leftover tags (math dropped whole: pandoc converts real math
# to $..$; survivors are failures), fenced code protected
MD_DROP = re.compile(
    r"<(?:svg|math)\b(?:"
    + ATTRS
    + r")>[\s\S]*?</(?:svg|math)>|<(?:embed|img|picture|video|audio|source|track)\b(?:"
    + ATTRS
    + r")/?>",
    re.I,
)
MD_UNWRAP = re.compile(
    r"</?(?:p|div|span|a|abbr|figure|figcaption|aside|footer|header|nav|section|article|main|table|thead|tbody|tfoot|tr|td|th|caption|semantics|annotation)\b(?:"
    + ATTRS
    + r")/?>",
    re.I,
)
MD_SPLIT = re.compile(r"(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)")
LTX_ATTR = re.compile(r"\{[#.][^}]*ltx_[^}]*\}")
HDR = re.compile(r"^#{1,6} .+$", re.M)
DOLLAR = re.compile(r"\$\$")


def to_md(i):
    t = open(f"{R}/raw-html/{i}.html", errors="replace").read()
    t = ERR_SPAN.sub("", t)
    t = SVG.sub("", t)
    t = MEDIA.sub("", t)
    t = UNWRAP.sub("", t)
    src, dst = f"{TMP}/{i}.html", f"{TMP}/{i}.md"
    with open(src, "w") as f:
        f.write(t)
    subprocess.run(
        [PANDOC, "-f", "html", "-t", "markdown", "--wrap=none", src, "-o", dst],
        check=True,
    )
    md = open(dst, errors="replace").read()
    parts = MD_SPLIT.split(md)
    md = "".join(
        p if k % 2 else MD_UNWRAP.sub("", MD_DROP.sub("", p))
        for k, p in enumerate(parts)
    )
    md = LTX_ATTR.sub("", md)
    for p in (src, dst):
        os.unlink(p)
    return md


def score(md):
    return len(HDR.findall(md)), len(DOLLAR.findall(md))


ids = [l.strip() for l in open(sys.argv[1]) if l.strip()]
os.makedirs(f"{R}/out/report", exist_ok=True)
rep = open(f"{R}/out/report/report-axhtml.jsonl", "a")
shipped = kept = err = 0
for i in ids:
    try:
        new = to_md(i)
        old_p = f"{R}/out/md/{i}.md"
        old = open(old_p, errors="replace").read() if os.path.exists(old_p) else ""
        hn, mn = score(new)
        ho, mo = score(old)
        gate = len(new) > 2000 and hn > 0
        wins = gate and hn >= ho and (mn > mo or not old)
        if wins:
            open(old_p, "w").write(new)
            shipped += 1
            rec = {
                "id": i,
                "status": "shipped",
                "h": hn,
                "math": mn,
                "old_h": ho,
                "old_math": mo,
            }
        elif not old:
            # no docling md existed (fetch-failed pdfs): html md is the only one
            if gate:
                open(old_p, "w").write(new)
                shipped += 1
                rec = {"id": i, "status": "shipped-orphan", "h": hn, "math": mn}
            else:
                rec = {"id": i, "status": "gate-fail"}
        else:
            kept += 1
            rec = {
                "id": i,
                "status": "kept-docling",
                "h": hn,
                "math": mn,
                "old_h": ho,
                "old_math": mo,
            }
    except Exception as e:
        err += 1
        rec = {"id": i, "status": "error", "error": str(e)[:200]}
    rep.write(json.dumps(rec) + "\n")
    if (shipped + kept + err) % 200 == 0:
        print(
            f"{shipped + kept + err}/{len(ids)} shipped={shipped} kept={kept} err={err}",
            flush=True,
        )
print(f"CONVERT DONE: shipped={shipped} kept={kept} err={err}", flush=True)
