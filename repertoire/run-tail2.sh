#!/usr/bin/env bash
# Serving-stack tail (grill round 2): after embed completes ->
#   insert --fresh-index -> upload-derived -> smoke (query contract).
# Old buckets are NOT deleted here; verify-buckets.sh + explicit deletion
# come after the user reviews smoke output.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ../.env; set +a

echo "[tail2] waiting for embed..."
while pgrep -f "src/embed.ts" > /dev/null; do sleep 60; done
echo "[tail2] embed done at $(date)"

bun src/insert-vectors.ts --fresh-index > .cache/tail-insert.log 2>&1 || { echo "INSERT FAILED"; tail -5 .cache/tail-insert.log; exit 1; }
echo "[tail2] insert done at $(date)"

bun src/upload-derived.ts > .cache/tail-upload.log 2>&1 || { echo "UPLOAD FAILED"; tail -5 .cache/tail-upload.log; exit 1; }
echo "[tail2] upload done at $(date)"

bun src/query.ts --smoke > .cache/tail-smoke.log 2>&1 || { echo "SMOKE FAILED"; tail -15 .cache/tail-smoke.log; exit 1; }
echo "[tail2] smoke done at $(date) -- SERVING STACK COMPLETE"
