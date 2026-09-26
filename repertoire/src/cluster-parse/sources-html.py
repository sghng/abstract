#!/usr/bin/env python3
"""Emit D1 sources rows (insert or replace) for the arXiv html tier:
doi declared form 10.48550/arXiv.<id>, key raw/<doi_id>.html, bytes, sha256."""

import hashlib
import os

R = os.path.expanduser("~/parse-run")
Q = chr(39)
rows = []
for fn in sorted(os.listdir(f"{R}/raw-html")):
    if not fn.endswith(".html"):
        continue
    doi_id = fn[:-5]
    prefix, arx = doi_id.split(":", 1)
    if arx.startswith("arxiv."):
        arx = "arXiv." + arx[6:]
    doi = prefix + "/" + arx
    p = f"{R}/raw-html/{fn}"
    b = os.path.getsize(p)
    h = hashlib.sha256(open(p, "rb").read()).hexdigest()
    rows.append((doi, doi_id, b, h))

with open(f"{R}/d1/sources-html.sql", "w") as f:
    f.write(
        "delete from sources where format=%shtml%s and key like %sraw/10.48550%%.html%s;\n"
        % (Q, Q, Q, Q)
    )
    for k in range(0, len(rows), 200):
        chunk = [
            "(%s%s%s,%shtml%s,%sraw/%s.html%s,%d,%s%s%s,datetime())"
            % (Q, doi, Q, Q, Q, Q, doi_id, Q, b, Q, h, Q)
            for doi, doi_id, b, h in rows[k : k + 200]
        ]
        f.write(
            "insert or replace into sources (doi, format, key, bytes, sha256, fetched_at) values\n"
            + ",\n".join(chunk)
            + ";\n"
        )
print("sources html rows:", len(rows))
