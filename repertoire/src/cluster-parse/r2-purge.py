#!/usr/bin/env python3
"""Purge pass on the migrated `repertoire` bucket:
  1. spot-check 5 leakfix objects vs local sizes
  2. delete all raw/*.tex (the purged tier, 140k objects)
  3. delete legacy bare top-level .md/.html/.xml objects
Prints tallies; refuses to touch md/ and raw/ non-tex."""

import os
import sys

import boto3

BASE = "/Users/sghng/dev/agent/abstract/repertoire/.cache"
env = {}
with open("/Users/sghng/dev/agent/abstract/.env") as f:
    for line in f:
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.strip().partition("=")
            env[k] = v.strip().strip('"').strip("'")

s3 = boto3.client(
    "s3",
    endpoint_url=env["CF_S3_ENDPOINT"],
    aws_access_key_id=env["CF_S3_KEY_ID"],
    aws_secret_access_key=env["CF_S3_SECRET"],
    region_name="auto",
)
B = "repertoire"

# 1. spot check
bad = 0
for fn in [l.strip() for l in open(f"{BASE}/d1/leakfix-redo.txt")][:5]:
    local = os.path.getsize(f"{BASE}/md/{fn}")
    head = s3.head_object(Bucket=B, Key=f"md/{fn}")
    if head["ContentLength"] != local:
        bad += 1
        print("SIZE MISMATCH", fn, local, head["ContentLength"])
print(f"spot-check 5 leakfix objects: {'OK' if bad == 0 else f'{bad} BAD'}")


def delete_batches(keys, label):
    n = 0
    for i in range(0, len(keys), 1000):
        chunk = keys[i : i + 1000]
        r = s3.delete_objects(
            Bucket=B, Delete={"Objects": [{"Key": k} for k in chunk], "Quiet": True}
        )
        errs = [
            e for e in (r.get("Errors") or []) if e.get("Code") not in ("NoSuchKey",)
        ]
        if errs:
            print("DELETE ERRORS", errs[:2])
            sys.exit(1)
        n += len(chunk)
        if (i // 1000) % 20 == 0:
            print(f"  {label}: {n} deleted...", flush=True)
    print(f"{label}: {n} deleted")


# 2. tex purge under raw/
tex = []
tok = None
while True:
    kw = dict(Bucket=B, Prefix="raw/", MaxKeys=1000)
    if tok:
        kw["ContinuationToken"] = tok
    r = s3.list_objects_v2(**kw)
    tex += [o["Key"] for o in r.get("Contents", []) if o["Key"].endswith(".tex")]
    if not r.get("IsTruncated"):
        break
    tok = r["NextContinuationToken"]
print(f"tex objects found: {len(tex)}")
if "--go" in sys.argv:
    delete_batches(tex, "tex purge")

# 3. legacy top-level (no slash in key) with the old extensions
legacy = []
tok = None
while True:
    kw = dict(Bucket=B, Prefix="", MaxKeys=1000, Delimiter="/")
    if tok:
        kw["ContinuationToken"] = tok
    r = s3.list_objects_v2(**kw)
    legacy += [
        o["Key"]
        for o in r.get("Contents", [])
        if o["Key"].endswith((".md", ".html", ".xml"))
    ]
    if not r.get("IsTruncated"):
        break
    tok = r["NextContinuationToken"]
print(f"legacy top-level objects found: {len(legacy)}")
if "--go" in sys.argv:
    delete_batches(legacy, "legacy purge")
