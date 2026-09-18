#!/bin/bash
# job-pdf.sh -- SGE array task: self-stage pdf slice -> docling in
# $TMPDIR -> pdf-wrap in $TMPDIR -> ship md home.
# args: <slice-file>
set -u
R="$HOME/parse-run"; W="$R/work"
export PATH="$HOME/.bun/bin:$R/bin:$PATH"
export PANDOC="$R/bin/pandoc"
# slice derived from SGE_TASK_ID env (qsub args are not var-substituted)
slice="${1:-}"
[ -z "$slice" ] && slice="$R/slices/arpdf-${SGE_TASK_ID}.ids"
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

$PULL "$slice" pdf || exit 3

# docling over the slice, working entirely in $TMPDIR
"$PY" - "$slice" <<'PYEOF'
import json, os, sys
TMP = os.environ["TMPDIR"]
R = os.path.expanduser("~/parse-run")
ids = [l.strip() for l in open(sys.argv[1]) if l.strip()]
outdir = f"{TMP}/docling-md"
os.makedirs(outdir, exist_ok=True)
from docling.document_converter import DocumentConverter
conv = DocumentConverter()
ok = fail = 0
with open(f"{TMP}/docling-fail.jsonl", "a") as fails:
    for i in ids:
        dst = f"{outdir}/{i}.md"
        if os.path.exists(dst) and os.path.getsize(dst) > 0:
            ok += 1
            continue
        try:
            res = conv.convert(f"{TMP}/raw-new/{i}.pdf")
            open(dst, "w").write(res.document.export_to_markdown())
            ok += 1
        except Exception as e:
            fails.write(json.dumps({"doi_id": i, "error": str(e)[:300]}) + "\n")
            fail += 1
print(f"docling {ok}/{len(ids)} (fail {fail})")
PYEOF

# wrap: journal/year from the queue
python3 - "$slice" <<'PYEOF' > "$TMPDIR/wrap-rows.jsonl"
import json, os, sys
R = os.path.expanduser("~/parse-run")
q = {}
for l in open(f"{R}/queue/pdf.queue.jsonl"):
    if l.strip():
        r = json.loads(l)
        q[r["doi_id"]] = r
for l in open(sys.argv[1]):
    i = l.strip()
    if not i:
        continue
    src = f"{os.environ['TMPDIR']}/docling-md/{i}.md"
    if os.path.exists(src) and os.path.getsize(src) > 0:
        print(json.dumps({"doi_id": i, "in": src, "journal": q.get(i, {}).get("fam", ""), "year": q.get(i, {}).get("year", 0)}))
PYEOF
out="$TMPDIR/out-pdf"; mkdir -p "$out"
[ -s "$TMPDIR/wrap-rows.jsonl" ] && bun "$W/src/pdf-wrap.ts" --batch "$TMPDIR/wrap-rows.jsonl" --out "$out" || true

# ship (pdf-wrap writes <safe>.md)
python3 - "$out" "$slice" <<'PYEOF'
import os, shutil, sys
out, slice_f = sys.argv[1], sys.argv[2]
R = os.path.expanduser("~/parse-run")
dst = f"{R}/out/md"
os.makedirs(dst, exist_ok=True)
n = 0
for l in open(slice_f):
    i = l.strip()
    if not i:
        continue
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in i)
    src = f"{out}/{safe}.md"
    if not os.path.exists(src) or os.path.getsize(src) == 0:
        continue
    shutil.move(src, f"{dst}/{i}.md")
    n += 1
print(f"shipped {n} md")
PYEOF
for f in "$TMPDIR/docling-fail.jsonl" "$out/report.jsonl"; do
  [ -f "$f" ] && cat "$f" >> "$R/out/report/report-pdf-$(basename "$slice").jsonl"
done
exit 0
