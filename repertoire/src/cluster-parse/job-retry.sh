#!/bin/bash
# job-retry.sh <retry.ids> -- final sweep: jsonl rows {doi_id, route,
# fmt} that still lack md. One batched pull up front (rclone/S3 when keys
# are configured, else paced REST), then convert by route, ship. Serial
# conversion is fine, the set is small by construction.
set -u
R="$HOME/parse-run"; W="$R/work"
export PATH="$HOME/.bun/bin:$R/bin:$PATH"
export PANDOC="$R/bin/pandoc"
export REP_ROOT="$W"
PY="$R/venv-docling/bin/python"
export HF_HUB_OFFLINE=1 HF_HOME="$R/hf-cache"
cd "$W" || exit 1
RETRY="$1"
set -a; . "$R/.env" 2>/dev/null; set +a

# ---- one batched pull of everything still missing ----
python3 - "$RETRY" <<'PYEOF'
import json, os, re, subprocess, sys, urllib.parse, urllib.request
TMP = os.environ.get("TMPDIR", "/tmp")
R = os.path.expanduser("~/parse-run")
os.makedirs(f"{TMP}/raw-new", exist_ok=True)
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
need = []
for r in rows:
    i, fmt = r["doi_id"], r["fmt"]
    dst = f"{R}/out/md/{i}.md"
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        continue
    src = f"{TMP}/raw-new/{i}.{fmt}"
    if os.path.exists(src) and os.path.getsize(src) > 0:
        continue
    need.append((i, fmt))
print(f"retry: {len(rows)} rows, {len(need)} to pull")
if need and os.environ.get("CF_S3_KEY_ID"):
    kf = f"{TMP}/retry-keys.txt"
    open(kf, "w").write("".join(f"{i}.{fmt}\n" for i, fmt in need))
    env = dict(os.environ)
    env.update({
        "RCLONE_CONFIG_R2_TYPE": "s3",
        "RCLONE_CONFIG_R2_PROVIDER": "Cloudflare",
        "RCLONE_CONFIG_R2_ACCESS_KEY_ID": os.environ["CF_S3_KEY_ID"],
        "RCLONE_CONFIG_R2_SECRET_ACCESS_KEY": os.environ["CF_S3_SECRET"],
        "RCLONE_CONFIG_R2_ENDPOINT": os.environ.get("CF_S3_ENDPOINT")
        or f"https://{os.environ['CF_ACCOUNT']}.r2.cloudflarestorage.com",
    })
    subprocess.run(
        ["bash", "-c",
         f'rclone copy "R2:{os.environ["R2_BUCKET"]}/raw" "{TMP}/raw-new" '
         f'--files-from "{kf}" --transfers "{os.environ.get("S3_TRANSFERS", "8")}" '
         f'--checkers 4 --no-traverse --retries 5 --low-level-retries 10 '
         f'--log-level ERROR'],
        env=env)
elif need:
    env = open(f"{R}/.env").read()
    tok = re.search(r'CF_API_TOKEN="?([^"\n]+)"?', env).group(1)
    acct = re.search(r'CF_ACCOUNT="?([^"\n]+)"?', env).group(1)
    buck = re.search(r'R2_BUCKET="?([^"\n]+)"?', env).group(1)
    for i, fmt in need:
        src = f"{TMP}/raw-new/{i}.{fmt}"
        try:
            key = urllib.parse.quote(f"raw/{i}.{fmt}", safe="")
            req = urllib.request.Request(
                f"https://api.cloudflare.com/client/v4/accounts/{acct}/r2/buckets/{buck}/objects/{key}",
                headers={"Authorization": f"Bearer {tok}"})
            open(src, "wb").write(urllib.request.urlopen(req, timeout=120).read())
        except Exception as e:
            print(f"PULLFAIL {i} {e}")

# ---- convert by route ----
ok = fail = 0
for r in rows:
    i, route, fmt = r["doi_id"], r["route"], r["fmt"]
    dst = f"{R}/out/md/{i}.md"
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        ok += 1
        continue
    src = f"{TMP}/raw-new/{i}.{fmt}"
    if not (os.path.exists(src) and os.path.getsize(src) > 0):
        print(f"NOPULL {i}"); fail += 1
        continue
    try:
        if route == "tex":
            p = subprocess.run(["bun", f"{W}/src/tex-convert.ts", i],
                               capture_output=True, text=True, timeout=600)
            md = p.stdout
        elif route == "pdf":
            p = subprocess.run([PY, "-c", """
import os,sys
os.environ.setdefault("HF_HUB_OFFLINE","1")
from docling.document_converter import DocumentConverter
print(DocumentConverter().convert(sys.argv[1]).document.export_to_markdown())
""", src], capture_output=True, text=True, timeout=1800)
            raw = p.stdout
            import tempfile
            tf = tempfile.NamedTemporaryFile("w", suffix=".md", delete=False)
            tf.write(raw); tf.close()
            wr = tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False)
            wr.write(json.dumps({"doi_id": i, "in": tf.name, "journal": "", "year": 0}) + "\n")
            wr.close()
            q = subprocess.run(["bun", f"{W}/src/pdf-wrap.ts", "--batch", wr.name,
                                "--out", f"{TMP}/retry-out"],
                               capture_output=True, text=True, timeout=600)
            os.makedirs(f"{TMP}/retry-out", exist_ok=True)
            safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in i)
            md = open(f"{TMP}/retry-out/{safe}.md").read() if os.path.exists(f"{TMP}/retry-out/{safe}.md") else ""
        else:
            md = ""  # small routes are retried by rerunning job-small.sh
        if md:
            open(dst, "w").write(md); ok += 1
        else:
            fail += 1
    except Exception as e:
        print(f"CONVFAIL {i} {str(e)[:120]}"); fail += 1
print(f"retry: {ok} ok, {fail} failed")
PYEOF
exit 0
