#!/bin/bash
# job-ocr.sh -- SGE array task for the ocr route: one GPU, one slice.
# Self-stages its slice into $TMPDIR, preflights the GPU, runs olmOCR with its
# log streamed to the shared FS (progress is visible while it runs), lifts md
# home. The slice is derived from SGE_TASK_ID because qsub args are not
# variable-substituted.
#
# Sharding exists because one A10 needs ~17 GPU-h for the whole queue; N tasks
# on N free GPUs divide that by N. A 2-GPU single job would need vLLM
# tensor/data-parallel and buys nothing over two jobs here.
set -u
R="$HOME/parse-run"; W="$R/work"
VENV="$HOME/ocr-bakeoff/venvs/olmocr"
# $VENV/bin first: olmOCR spawns "vllm" by bare name
export PATH="$VENV/bin:$HOME/.bun/bin:$R/bin:$PATH"
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
slice="${1:-$R/slices/ocr-${SGE_TASK_ID:-0}.ids}"
[ -f "$slice" ] || { echo "no slice: $slice"; exit 2; }
LOG="$R/logs/ocr-${SGE_TASK_ID:-0}.log"

# GPU preflight: the pool also holds 2080ti/P100/V100/RTX6000, which cannot
# run the FP8 model. Require compute >= 8.0 and >= 20GB, else fail fast.
cc=$(nvidia-smi --query-gpu=compute_cap --format=csv,noheader 2>/dev/null | head -1 | tr -d " ")
mem=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d " ")
echo "gpu: compute=${cc:-?} mem=${mem:-?}MiB $(hostname)"
if ! python3 -c "import sys; sys.exit(0 if float('${cc:-0}' or 0)>=8.0 and int('${mem:-0}' or 0)>=20000 else 1)"; then
  echo "GPU unsuitable; exiting without staging"
  exit 42
fi

set -a; . "$R/.env" 2>/dev/null; set +a
if [ -n "${CF_S3_KEY_ID:-}" ]; then
  PULL="$W/src/cluster-parse/pull-slice-rclone.sh"
else
  PULL="bun $W/src/cluster-parse/pull-slice.ts"
fi

# stage this slice into TMPDIR
mkdir -p "$TMPDIR/raw-new"
$PULL "$slice" pdf || exit 3
: > "$TMPDIR/ocr-paths.txt"
while read -r id; do
  [ -f "$TMPDIR/raw-new/$id.pdf" ] && echo "$TMPDIR/raw-new/$id.pdf" >> "$TMPDIR/ocr-paths.txt"
done < "$slice"
N=$(wc -l < "$TMPDIR/ocr-paths.txt")
echo "ocr inputs: $N of $(grep -c . "$slice")"
[ "$N" -eq 0 ] && { echo "nothing staged"; exit 0; }

module load cuda/13.2.1 2>/dev/null || true
export CUDA_HOME="${CUDA_HOME:-$(dirname "$(dirname "$(command -v nvcc 2>/dev/null || echo /usr/bin/nvcc)")")}"
# model predownloaded on the shared FS (HF_HUB_OFFLINE reads it directly)
"$VENV/bin/python" -c "from huggingface_hub import snapshot_download; snapshot_download('allenai/olmOCR-2-7B-1025-FP8'); print('model ready')"

# olmOCR: workspace is POSITIONAL (--workspace would bind to --workspace_profile
# via argparse prefix match and kill the job at boto3). --markdown writes natural
# text under <workspace>/markdown/. Tee to the shared log so progress is visible.
echo "start $(date +%FT%T) workers=${OCR_WORKERS:-4}"
"$VENV/bin/olmocr" "$TMPDIR/ocr-workspace" \
  --model allenai/olmOCR-2-7B-1025-FP8 \
  --pdfs "$TMPDIR/ocr-paths.txt" --markdown \
  --workers "${OCR_WORKERS:-4}" --max_server_ready_timeout 1800 2>&1 \
  | tee -a "$LOG" | tail -5
echo "end $(date +%FT%T)"

# olmOCR names outputs by source pdf path; lift to <doi_id>.md
python3 - "$TMPDIR" "$R" <<'PYEOF'
import glob, os, re, shutil, sys
TMP, R = sys.argv[1], sys.argv[2]
dst = f"{R}/out/md"
os.makedirs(dst, exist_ok=True)
n = 0
for p in glob.glob(f"{TMP}/ocr-workspace/markdown/**/*.md", recursive=True):
    stem = re.sub(r"\.(pdf|md)$", "", os.path.basename(p))
    if os.path.exists(f"{TMP}/raw-new/{stem}.pdf"):
        shutil.copyfile(p, f"{dst}/{stem}.md")
        n += 1
print(f"lifted {n} md")
PYEOF
exit 0
