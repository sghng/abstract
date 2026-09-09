#!/usr/bin/env bash
# Post-merge tail: runs after the corpus-wide merge-tables finishes.
# 1. repair any eq splices clobbered by concurrent merge writes
# 2. md-format -> chunk -> embed -> insert (fresh index) -> upload -> smoke
# Each step logs to repertoire/.cache/tail-<step>.log; first failure stops
# the chain loudly.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ../.env; set +a

echo "[tail] waiting for merge-tables to finish..."
while pgrep -f "merge-tables.py" > /dev/null; do sleep 60; done
echo "[tail] merge done at $(date)"

bun src/img2latex.ts --no-download > .cache/tail-resplice.log 2>&1 || { echo "RESPLICE FAILED"; exit 1; }
echo "[tail] resplice done at $(date)"

npx prettier --write "md/*.md" "jem/md/*.md" > .cache/tail-mdformat.log 2>&1 || { echo "MD-FORMAT FAILED"; exit 1; }
echo "[tail] md-format done at $(date)"

bun src/chunk.ts > .cache/tail-chunk.log 2>&1 || { echo "CHUNK FAILED"; exit 1; }
echo "[tail] chunk done at $(date)"

rm -rf .cache/vectors .cache/batches .cache/insert-state.txt
bun src/embed.ts > .cache/tail-embed.log 2>&1 || { echo "EMBED FAILED"; exit 1; }
echo "[tail] embed done at $(date)"

bun src/insert-vectors.ts --fresh-index > .cache/tail-insert.log 2>&1 || { echo "INSERT FAILED"; exit 1; }
echo "[tail] insert done at $(date)"

bun src/upload-derived.ts > .cache/tail-upload.log 2>&1 || { echo "UPLOAD FAILED"; exit 1; }
echo "[tail] upload done at $(date)"

set +a
set -a; source ../.env; set +a
bun src/query.ts --smoke > .cache/tail-smoke.log 2>&1 || { echo "SMOKE FAILED"; exit 1; }
echo "[tail] smoke done at $(date) -- PIPELINE COMPLETE"
