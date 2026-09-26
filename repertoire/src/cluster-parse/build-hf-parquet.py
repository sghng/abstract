#!/usr/bin/env python3
"""Build the HF dataset parquet set from local stores.

Inputs:
  .cache/backup/repertoire-2026-09-25.sqlite  (papers, sources, parse_report)
  .cache/md/<doi_id>.md                        (post-cleanup text)
Output:
  .cache/hf/{md,meta}/part-*.parquet

md config: one row per parsed paper. meta: papers (all states, ledger
merged) and sources (provenance). Run after the leakfix delta lands.
"""

import os
import sqlite3
import sys

import pyarrow as pa
import pyarrow.parquet as pq

BASE = "/Users/sghng/dev/agent/abstract/repertoire/.cache"
DB = f"{BASE}/backup/repertoire-2026-09-25.sqlite"
MD = f"{BASE}/md"
OUT = f"{BASE}/hf"

con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row

# --- md config: parsed papers with text ------------------------------------
rows = con.execute(
    """select p.doi, p.doi_id, p.journal, p.title, p.authors, p.year,
              p.parse_source, r.flags
       from papers p join parse_report r on r.doi_id = p.doi_id
       where p.state = 'parsed' order by p.doi_id"""
).fetchall()
schema = pa.schema(
    [
        ("doi", pa.string()),
        ("doi_id", pa.string()),
        ("journal", pa.string()),
        ("title", pa.string()),
        ("authors", pa.string()),
        ("year", pa.int32()),
        ("parse_source", pa.string()),
        ("flags", pa.string()),
        ("md", pa.string()),
    ]
)
SHARD_ROWS = 1000
os.makedirs(f"{OUT}/md", exist_ok=True)
n = 0
for k in range(0, len(rows), SHARD_ROWS):
    chunk = []
    for r in rows[k : k + SHARD_ROWS]:
        p = f"{MD}/{r['doi_id']}.md"
        text = open(p, errors="replace").read() if os.path.exists(p) else None
        chunk.append(
            (
                r["doi"],
                r["doi_id"],
                r["journal"],
                r["title"],
                r["authors"],
                r["year"],
                r["parse_source"],
                r["flags"],
                text,
            )
        )
        if text is None:
            print("MISSING MD:", r["doi_id"], file=sys.stderr)
    t = pa.Table.from_pylist([dict(zip(schema.names, c)) for c in chunk], schema=schema)
    pq.write_table(
        t, f"{OUT}/md/part-{k // SHARD_ROWS:05d}.parquet", compression="zstd"
    )
    n += len(chunk)
print("md rows:", n, "shards:", (len(rows) + SHARD_ROWS - 1) // SHARD_ROWS)

# --- meta: papers ledger + sources -----------------------------------------
os.makedirs(f"{OUT}/meta", exist_ok=True)
meta = con.execute(
    """select p.doi, p.doi_id, p.journal, p.title, p.authors, p.year,
              p.state, p.parse_source, p.error, r.bytes, r.headings,
              r.math_blocks, r.formula_tokens, r.flags, r.failure
       from papers p join parse_report r on r.doi_id = p.doi_id order by p.doi_id"""
).fetchall()
t = pa.Table.from_pylist([dict(m) for m in meta])
pq.write_table(t, f"{OUT}/meta/papers.parquet", compression="zstd")
print("meta papers rows:", t.num_rows)

src = con.execute(
    """select s.doi, s.format, s.key, s.bytes, s.sha256, s.fetched_at from sources s
       where s.format != 'tex' order by s.key"""
).fetchall()
t = pa.Table.from_pylist([dict(s) for s in src])
pq.write_table(t, f"{OUT}/meta/sources.parquet", compression="zstd")
print("meta sources rows:", t.num_rows)
