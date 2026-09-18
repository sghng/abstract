#!/bin/bash
# job-ocr.sh -- one GPU job: self-stage the whole ocr slice (1,057
# pdfs, ~0.7G) into $TMPDIR, run olmOCR (bake-off invocation), lift md to
# plain files, ship home. Deletes the FP8 model cache only if it
# downloaded it fresh (--release flag, orchestrator decision).
set -u
R="$HOME/parse-run"; W="$R/work"
VENV="$HOME/ocr-bakeoff/venvs/olmocr"
export PATH="$HOME/.bun/bin:$R/bin:$PATH"
export PANDOC="$R/bin/pandoc"
export HF_HOME="$HOME/.cache/huggingface"
export HF_HUB_OFFLINE=1
# uv-managed CPython: the venv python cannot even start without its libpython
# on LD_LIBRARY_PATH, so derive the lib dir from the symlink target in shell.
PYT=$(readlink -f "$VENV/bin/python" 2>/dev/null || true)
[ -z "$PYT" ] && PYT=$(readlink -f "$VENV/bin/python3" 2>/dev/null || true)
if [ -n "$PYT" ]; then
  LP="$(dirname "$(dirname "$PYT")")/lib"
  [ -d "$LP" ] && export LD_LIBRARY_PATH="$LP:$VENV/nvidia/cu13/lib:${LD_LIBRARY_PATH:-}"
fi
cd "$W" || exit 1
# puller: rclone/S3 when S3 keys are configured (no REST rate ceiling),
# otherwise the paced REST puller
set -a; . "$R/.env" 2>/dev/null; set +a
if [ -n "${CF_S3_KEY_ID:-}" ]; then
  PULL="$W/src/cluster-parse/pull-slice-rclone.sh"
else
  PULL="bun $W/src/cluster-parse/pull-slice.ts"
fi


# stage the ocr queue into TMPDIR
python3 - <<'PYEOF' > "$TMPDIR/ocr-keys.txt"
import json, os
R = os.path.expanduser("~/parse-run")
for l in open(f"{R}/queue/ocr.queue.jsonl"):
    if l.strip():
        print(json.loads(l)["doi_id"])
PYEOF
mkdir -p "$TMPDIR/raw-new"
$PULL "$TMPDIR/ocr-keys.txt" pdf

module load cuda/13.2.1 2>/dev/null || true
export CUDA_HOME="${CUDA_HOME:-$(dirname "$(dirname "$(command -v nvcc 2>/dev/null || echo /usr/bin/nvcc)")")}"
# model predownloaded on the login node (compute nodes may lack HF egress)
"$VENV/bin/python" -c "from huggingface_hub import snapshot_download; snapshot_download('allenai/olmOCR-2-7B-1025-FP8'); print('model ready')"

# olmocr over absolute pdf paths (bake-off invocation)
: > "$TMPDIR/ocr-paths.txt"
while read -r id; do
  [ -f "$TMPDIR/raw-new/$id.pdf" ] && echo "$TMPDIR/raw-new/$id.pdf" >> "$TMPDIR/ocr-paths.txt"
done < "$TMPDIR/ocr-keys.txt"
N=$(wc -l < "$TMPDIR/ocr-paths.txt")
echo "ocr inputs: $N"
"$VENV/bin/olmocr" train --workspace "$TMPDIR/ocr-workspace" \
  --model allenai/olmOCR-2-7B-1025-FP8 \
  --pdfs "$TMPDIR/ocr-paths.txt" --markdown-output "$TMPDIR/out-ocr" \
  --workers 4 --max_server_ready_timeout 1800 2>&1 | tail -5

# olmocr names outputs by source pdf; lift to <doi_id>.md
python3 - <<'PYEOF'
import glob, os, re, shutil
TMP = os.environ["TMPDIR"]
R = os.path.expanduser("~/parse-run")
dst = f"{R}/out/md"
os.makedirs(dst, exist_ok=True)
n = 0
for p in glob.glob(f"{TMP}/out-ocr/**/*.md", recursive=True):
    base = os.path.basename(p)
    # workspace results carry the pdf filename stem; map back via raw-new
    stem = re.sub(r"\.(pdf|md)$", "", base)
    src_pdf = f"{TMP}/raw-new/{stem}.pdf"
    if os.path.exists(src_pdf):
        shutil.copyfile(p, f"{dst}/{stem}.md")
        n += 1
print(f"lifted {n} md")
PYEOF
exit 0
