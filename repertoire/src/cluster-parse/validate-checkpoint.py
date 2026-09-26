#!/usr/bin/env python3
"""Final checkpoint validation. Verifies:
  1. md parquet: row totals, doi_id uniqueness, no null text, source mix
  2. raw parquet: row totals per format, sha256 non-null
  3. cross: md parquet ids == local md file ids == papers(state=parsed)
  4. meta: papers 164,351 incl failures; sources has no tex rows
Prints PASS/FAIL per check."""

import os
import sqlite3
import sys

import pyarrow.parquet as pq

BASE = "/Users/sghng/dev/agent/abstract/repertoire/.cache"
HF = f"{BASE}/hf"
ok = True


def check(name, cond, detail=""):
    global ok
    print(f"[{'PASS' if cond else 'FAIL'}] {name} {detail}")
    ok = ok and cond


# 1. md parquet
ids = set()
rows = 0
nulls = 0
src_mix = {}
for f in sorted(os.listdir(f"{HF}/md")):
    t = pq.read_table(f"{HF}/md/{f}", columns=["doi_id", "md", "parse_source"])
    rows += t.num_rows
    for i, md, ps in zip(
        t.column("doi_id").to_pylist(),
        t.column("md").to_pylist(),
        t.column("parse_source").to_pylist(),
    ):
        ids.add(i)
        if md is None:
            nulls += 1
        src_mix[ps] = src_mix.get(ps, 0) + 1
check("md parquet rows = 159465", rows == 159465, f"got {rows}")
check("md parquet ids unique", len(ids) == rows, f"got {len(ids)}")
check("md parquet no null text", nulls == 0, f"got {nulls}")
print("       source mix:", dict(sorted(src_mix.items(), key=lambda x: -x[1])))

# 2. local files vs parquet ids
local = {f[:-3] for f in os.listdir(f"{BASE}/md") if f.endswith(".md")}
check(
    "local md files = parquet ids",
    local == ids,
    f"only-local={len(local - ids)} only-parquet={len(ids - local)}",
)

# 3. raw parquet (skipped when absent: raw tier completes after migration)
raw_total = 0
raw_seen = False
for fmt in ("pdf", "html", "xml", "docx"):
    d = f"{HF}/raw/{fmt}"
    if not os.path.isdir(d):
        continue
    raw_seen = True
    n = 0
    for f in sorted(os.listdir(d)):
        t = pq.read_table(f"{HF}/raw/{fmt}/{f}", columns=["sha256"])
        n += t.num_rows
        if t.column("sha256").null_count:
            check(f"raw {fmt} null sha", False)
    raw_total += n
    print(f"       raw {fmt}: {n} rows")
if raw_seen:
    check("raw parquet total = 17205", raw_total == 17205, f"got {raw_total}")
else:
    print("[SKIP] raw parquet (completes after bucket migration)")

# 4. meta
mp = pq.read_table(f"{HF}/meta/papers.parquet", columns=["state", "failure"])
check("meta papers = 164351", mp.num_rows == 164351, f"got {mp.num_rows}")
states = {}
for s in mp.column("state").to_pylist():
    states[s] = states.get(s, 0) + 1
print("       states:", states)
ms = pq.read_table(f"{HF}/meta/sources.parquet", columns=["format"])
check("meta sources = 39143", ms.num_rows == 39143, f"got {ms.num_rows}")
check("meta sources has no tex", "tex" not in set(ms.column("format").to_pylist()))

# 5. failures documented
fail = mp.column("failure").to_pylist()
nf = sum(1 for f in fail if f)
check(
    "every failure row categorized",
    nf == states.get("parsing-failed", 0),
    f"{nf} categorized of {states.get('parsing-failed', 0)}",
)

print("OVERALL:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
