#!/usr/bin/env python3
"""Download the irreplaceable raw artifacts (journal families + psyarxiv)
from R2 to .cache/raw-backup/, mirroring bucket keys. Sources of truth:
the local sqlite snapshot (journal != 'arxiv'). Resumable: skips files
that already exist with the right size."""

import os
import sqlite3
import sys

import boto3

BASE = "/Users/sghng/dev/agent/abstract/repertoire/.cache"
DB = f"{BASE}/backup/repertoire-2026-09-25.sqlite"

env = {}
with open("/Users/sghng/dev/agent/abstract/.env") as f:
    for line in f:
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.strip().partition("=")
            env[k] = v.strip().strip('"').strip("'")

# cluster .env carried S3 creds; repo .env may use different names
key = (
    env.get("CF_S3_KEY_ID")
    or env.get("R2_ACCESS_KEY_ID")
    or env.get("AWS_ACCESS_KEY_ID")
)
sec = (
    env.get("CF_S3_SECRET")
    or env.get("R2_SECRET_ACCESS_KEY")
    or env.get("AWS_SECRET_ACCESS_KEY")
)
acct = env.get("CF_ACCOUNT")
endpoint = env.get("CF_S3_ENDPOINT") or (
    f"https://{acct}.r2.cloudflarestorage.com" if acct else None
)
bucket = env.get("R2_BUCKET", "repertoire")
if not (key and sec and endpoint):
    sys.exit("no S3 creds found in .env: " + ",".join(env))

s3 = boto3.client(
    "s3",
    endpoint_url=endpoint,
    aws_access_key_id=key,
    aws_secret_access_key=sec,
    region_name="auto",
)

con = sqlite3.connect(DB)
rows = con.execute(
    """select s.key, s.bytes from sources s join papers p on p.doi = s.doi
       where p.journal != 'arxiv' and s.key is not null order by s.key"""
).fetchall()
print(
    f"irreplaceable raws: {len(rows)} objects, {sum(b or 0 for _, b in rows) / 2**30:.1f} GiB"
)

done = skipped = 0
for n, (key_name, size) in enumerate(rows):
    dst = f"{BASE}/raw-backup/{key_name}"
    if os.path.exists(dst) and os.path.getsize(dst) == (size or -1):
        skipped += 1
        continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    for attempt in range(4):
        try:
            s3.download_file(bucket, key_name, dst)
            done += 1
            break
        except Exception as e:
            if attempt == 3:
                print("FAIL", key_name, str(e)[:120], flush=True)
    if (n + 1) % 1000 == 0:
        print(f"{n + 1}/{len(rows)} downloaded={done} skipped={skipped}", flush=True)
print(f"RAW BACKUP DONE: downloaded={done} skipped={skipped} of {len(rows)}")
