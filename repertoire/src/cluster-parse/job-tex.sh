#!/bin/bash
# job-tex.sh -- SGE array task: self-stage a tex slice into $TMPDIR,
# convert, rename safe->doi, ship md home. No login-node staging, no home
# quota impact from raws (md lands in ~/parse-run/out/md).
# args: <slice-file>
set -u
R="$HOME/parse-run"; W="$R/work"
export PATH="$HOME/.bun/bin:$R/bin:$PATH"
export PANDOC="$R/bin/pandoc"
# slice derived from SGE_TASK_ID env (qsub args are not var-substituted)
slice="${1:-}"
[ -z "$slice" ] && slice="$R/slices/tex-${SGE_TASK_ID}.ids"
task="${SLURM_PROCID:-}${SGE_TASK_ID}"
cd "$W" || exit 1
export RAW_DIR="$TMPDIR/raw-new"
# puller: rclone/S3 when S3 keys are configured (no REST rate ceiling),
# otherwise the paced REST puller
set -a; . "$R/.env" 2>/dev/null; set +a
if [ -n "${CF_S3_KEY_ID:-}" ]; then
  PULL="$W/src/cluster-parse/pull-slice-rclone.sh"
else
  PULL="bun $W/src/cluster-parse/pull-slice.ts"
fi

$PULL "$slice" tex || exit 3
out="$TMPDIR/out-tex"; mkdir -p "$out"
bun "$W/src/tex-convert.ts" --batch "$slice" --out "$out" || true
# ship: safe-name -> doi_id name
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
    if os.path.exists(src) and os.path.getsize(src) > 0:
        shutil.move(src, f"{dst}/{i}.md")
        n += 1
rep = f"{out}/report.jsonl"
if os.path.exists(rep):
    with open(f"{R}/out/report/report-tex-{os.path.basename(slice_f)}.jsonl", "a") as w:
        w.write(open(rep).read())
print(f"shipped {n} md")
PYEOF
[ -f "$TMPDIR/miss.jsonl" ] && cat "$TMPDIR/miss.jsonl" >> "$R/out/report/miss-tex.jsonl" || true
exit 0
