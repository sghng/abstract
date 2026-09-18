#!/usr/bin/env bash
# job-journal-pdf.sh <family-slug> -- one smp node per journal family:
# self-stage the family's pdf-route papers, convert with a pool of
# docling workers, wrap, ship. Resume-safe via out/md skip-if-exists.
# family-slug in: psychometrika|psyarxiv|jem|bjmsp|jebs
set -u
R="$HOME/parse-run"; W="$R/work"
FAM="$1"
NPROC="${PDF_WORKERS:-8}"
export PATH="$HOME/.bun/bin:$R/bin:$PATH"
export PANDOC="$R/bin/pandoc"
export REP_ROOT="$W"
PY="$R/venv-docling/bin/python"
export HF_HUB_OFFLINE=1 HF_HOME="$R/hf-cache"
cd "$W" || exit 1
# puller: rclone/S3 when S3 keys are configured (no REST rate ceiling),
# otherwise the paced REST puller
set -a; . "$R/.env" 2>/dev/null; set +a
if [ -n "${CF_S3_KEY_ID:-}" ]; then
  PULL="$W/src/cluster-parse/pull-slice-rclone.sh"
else
  PULL="bun $W/src/cluster-parse/pull-slice.ts"
fi


python3 - "$FAM" > "$TMPDIR/ids.txt" <<'PYEOF'
import json, os, sys
fam = sys.argv[1]
for l in open(os.path.expanduser("~/parse-run/queue/pdf.queue.jsonl")):
    if l.strip():
        q = json.loads(l)
        if q["fam"] == fam:
            print(q["doi_id"])
PYEOF
N=$(grep -c . "$TMPDIR/ids.txt")
echo "journal-pdf $FAM: $N papers, $NPROC workers"
[ "$N" -eq 0 ] && exit 0

$PULL "$TMPDIR/ids.txt" pdf || true
export PULL_CONC=1 PULL_PAUSE_MS=2500

# docling worker pool: NPROC workers consume ids from a shared queue file
"$PY" - "$FAM" "$NPROC" <<'PYEOF'
import json, os, sys, threading, queue
fam, nproc = sys.argv[1], int(sys.argv[2])
TMP = os.environ["TMPDIR"]
R = os.path.expanduser("~/parse-run")
ids = []
for l in open(f"{TMP}/ids.txt"):
    i = l.strip()
    if not i:
        continue
    dst = f"{TMP}/docling-md/{i}.md"
    if not (os.path.exists(f"{R}/out/md/{i}.md") or (os.path.exists(dst) and os.path.getsize(dst) > 0)):
        ids.append(i)
os.makedirs(f"{TMP}/docling-md", exist_ok=True)
q = queue.Queue()
for i in ids:
    q.put(i)
fails = []
def worker():
    from docling.document_converter import DocumentConverter
    conv = DocumentConverter()
    while True:
        try:
            i = q.get_nowait()
        except queue.Empty:
            return
        try:
            res = conv.convert(f"{TMP}/raw-new/{i}.pdf")
            open(f"{TMP}/docling-md/{i}.md", "w").write(res.document.export_to_markdown())
        except Exception as e:
            fails.append({"doi_id": i, "error": str(e)[:300]})
        q.task_done()
ts = [threading.Thread(target=worker) for _ in range(min(nproc, max(1, len(ids))))]
for t in ts:
    t.start()
for t in ts:
    t.join()
with open(f"{R}/out/report/docling-fail-{fam}.jsonl", "a") as f:
    for x in fails:
        f.write(json.dumps(x) + "\n")
print(f"docling {fam}: {len(ids)-len(fails)}/{len(ids)} ok")
PYEOF

# wrap + ship in chunks so progress lands even if the job dies later
python3 - "$FAM" <<'PYEOF' > "$TMPDIR/wrap-rows.jsonl"
import json, os, sys
TMP = os.environ["TMPDIR"]; R = os.path.expanduser("~/parse-run")
q = {json.loads(l)["doi_id"]: json.loads(l) for l in open(f"{R}/queue/pdf.queue.jsonl") if l.strip()}
for i in open(f"{TMP}/ids.txt"):
    i = i.strip()
    if not i:
        continue
    src = f"{TMP}/docling-md/{i}.md"
    if os.path.exists(src) and os.path.getsize(src) > 0:
        print(json.dumps({"doi_id": i, "in": src, "journal": q[i]["fam"], "year": q[i]["year"]}))
PYEOF
out="$TMPDIR/out-pdf"; mkdir -p "$out"
[ -s "$TMPDIR/wrap-rows.jsonl" ] && bun "$W/src/pdf-wrap.ts" --batch "$TMPDIR/wrap-rows.jsonl" --out "$out" || true
python3 - "$out" "$TMPDIR/ids.txt" <<'PYEOF'
import os, shutil, sys
out, ids_f = sys.argv[1], sys.argv[2]
R = os.path.expanduser("~/parse-run"); dst = f"{R}/out/md"
os.makedirs(dst, exist_ok=True)
n = 0
for l in open(ids_f):
    i = l.strip()
    if not i:
        continue
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in i)
    src = f"{out}/{safe}.md"
    if os.path.exists(src) and os.path.getsize(src) > 0:
        shutil.move(src, f"{dst}/{i}.md")
        n += 1
print(f"shipped {n} md")
PYEOF
[ -f "$TMPDIR/miss.jsonl" ] && cat "$TMPDIR/miss.jsonl" >> "$R/out/report/miss-pdf-$FAM.jsonl"
exit 0
