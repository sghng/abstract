#!/usr/bin/env python3
"""Build raw/* parquet configs from .cache/raw-backup/ (journal families +
psyarxiv). One row per artifact: identity, provenance from sources, and
the blob. sha256-verified against the sources ledger; mismatches are
reported and dropped. Output: .cache/hf/raw/<fmt>/part-*.parquet"""

import hashlib
import os
import sqlite3
import sys

import pyarrow as pa
import pyarrow.parquet as pq

BASE = "/Users/sghng/dev/agent/abstract/repertoire/.cache"
RAW = f"{BASE}/raw-backup/raw"
con = sqlite3.connect(f"{BASE}/backup/repertoire-2026-09-25.sqlite")
con.row_factory = sqlite3.Row

schema = pa.schema(
    [
        ("doi", pa.string()),
        ("doi_id", pa.string()),
        ("journal", pa.string()),
        ("format", pa.string()),
        ("key", pa.string()),
        ("sha256", pa.string()),
        ("fetched_at", pa.string()),
        ("data", pa.large_binary()),
    ]
)
SHARD_BYTES = 256 * 2**20

by_fmt = {}
src = con.execute(
    """select s.*, p.doi_id, p.journal from sources s
       join papers p on p.doi = s.doi
       where p.journal != 'arxiv' and s.key is not null"""
).fetchall()
for r in src:
    by_fmt.setdefault(r["format"], []).append(r)

total = bad = 0
for fmt, rows in sorted(by_fmt.items()):
    outdir = f"{BASE}/hf/raw/{fmt}"
    os.makedirs(outdir, exist_ok=True)
    shard, shard_bytes, n_shards = [], 0, 0
    for r in rows:
        p = f"{RAW}/{r['key'].split('/', 1)[1]}"
        if not os.path.exists(p):
            print("MISSING", r["key"], file=sys.stderr)
            continue
        blob = open(p, "rb").read()
        h = hashlib.sha256(blob).hexdigest()
        if r["sha256"] and h != r["sha256"]:
            print("SHA MISMATCH", r["key"], file=sys.stderr)
            bad += 1
            continue
        shard.append(
            {
                "doi": r["doi"],
                "doi_id": r["doi_id"],
                "journal": r["journal"],
                "format": r["format"],
                "key": r["key"],
                "sha256": h,
                "fetched_at": r["fetched_at"],
                "data": blob,
            }
        )
        shard_bytes += len(blob)
        total += 1
        if shard_bytes > SHARD_BYTES:
            pq.write_table(
                pa.Table.from_pylist(shard, schema=schema),
                f"{outdir}/part-{n_shards:04d}.parquet",
                compression="zstd",
            )
            n_shards += 1
            shard, shard_bytes = [], 0
    if shard:
        pq.write_table(
            pa.Table.from_pylist(shard, schema=schema),
            f"{outdir}/part-{n_shards:04d}.parquet",
            compression="zstd",
        )
        n_shards += 1
    print(f"{fmt}: {n_shards} shards")
print(f"RAW PARQUET DONE: rows={total} sha_bad={bad}")
