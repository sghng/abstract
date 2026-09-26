#!/usr/bin/env python3
"""Merge D1 papers dump + cluster md-stats sweep into parse_report DDL+DML,
and print tallies for the human doc. Inputs (local):
  .cache/d1/papers-dump.json  (doi_id, journal, state, parse_source, error)
  .cache/d1/md-stats.tsv      (doi_id, bytes, headings, math_blocks, formula_tokens, flags)
Output: .cache/d1/parse-report.sql
"""

import json
import re
import sys

BASE = "/Users/sghng/dev/agent/abstract/repertoire/.cache/d1"
Q = chr(39)


def categorize(err):
    if not err:
        return "unknown"
    e = err.lower()
    if "docling conversion failed" in e:
        return "docling-pdf-failed"
    if "not enqueued" in e:
        return "no-route-assigned"
    if e.startswith("ocr:"):
        return "ocr-failed"
    if "scan-quality" in e:
        return "scan-quality-terminal"
    if "no main file" in e:
        return "tex-no-main-file"
    if "pandoc ladder exhausted" in e:
        return "tex-ladder-failed"
    if "tex conversion exhausted" in e:
        return "tex-exhausted-no-raw"
    return "other:" + err[:50]


papers = [r for q in json.load(open(f"{BASE}/papers-dump.json")) for r in q["results"]]
stats = {}
for line in open(f"{BASE}/md-stats.tsv"):
    doi_id, b, h, m, f, flags = (line.rstrip("\n").split("\t") + [""])[:6]
    stats[doi_id] = (int(b), int(h), int(m), int(f), flags)

ddl = """create table if not exists parse_report (
  doi_id text primary key,
  journal text not null,
  state text not null,
  parse_source text,
  bytes integer,
  headings integer,
  math_blocks integer,
  formula_tokens integer,
  flags text,
  failure text
);
delete from parse_report;
"""

rows = []
fail_counts = {}
flag_counts = {}
src_counts = {}
missing_stats = 0
for p in papers:
    doi_id = p["doi_id"]
    st = stats.get(doi_id)
    failure = ""
    flags = st[4] if st else "no-md"
    if p["state"] == "parsing-failed":
        failure = categorize(p["error"])
        fail_counts[failure] = fail_counts.get(failure, 0) + 1
        st = st or (None, None, None, None, "")
    elif st is None:
        missing_stats += 1
    if p["state"] == "parsed":
        src_counts[p["parse_source"]] = src_counts.get(p["parse_source"], 0) + 1
    for fl in flags.split("|"):
        if fl:
            flag_counts[fl] = flag_counts.get(fl, 0) + 1
    b, h, m, f = st[:4] if st else (None, None, None, None)

    def n(x):
        return "null" if x is None else str(x)

    rows.append(
        f"({Q}{doi_id}{Q},{Q}{p['journal']}{Q},{Q}{p['state']}{Q},"
        f"{'null' if not p['parse_source'] else Q + p['parse_source'] + Q},"
        f"{n(b)},{n(h)},{n(m)},{n(f)},{Q}{flags}{Q},{Q}{failure}{Q})"
    )

with open(f"{BASE}/parse-report.sql", "w") as out:
    out.write(ddl)
    for k in range(0, len(rows), 400):
        out.write(
            "insert into parse_report (doi_id, journal, state, parse_source, bytes, headings,"
            " math_blocks, formula_tokens, flags, failure) values\n"
            + ",\n".join(rows[k : k + 400])
            + ";\n"
        )

print("rows:", len(rows), "| parsed w/o stats:", missing_stats)
print("parse_source:", dict(sorted(src_counts.items(), key=lambda x: -x[1])))
print("failures:", dict(sorted(fail_counts.items(), key=lambda x: -x[1])))
print("flags:", dict(sorted(flag_counts.items(), key=lambda x: -x[1])))
