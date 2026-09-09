#!/usr/bin/env bash
# Pre-deletion verification (grill Q6a):
#   1. every local derived source file is in the upload checkpoint
#      (=> exists in repertoire-docs, since upload-derived exits nonzero
#      on any failed put)
#   2. raw checkpoint covers the raw/ tree
#   3. spot-get N random keys from repertoire-docs and verify nonzero size
#   4. object-count census per prefix
# Only after all four pass do we consider the old buckets deletable.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ../.env; set +a

echo "== 1. derived coverage (local files vs checkpoint)"
miss=0
for pair in "md:@md" "jem/md:@jem" "html:@html" "jem/html:@jem" "assets:@assets"; do
  dir="${pair%%:*}"; rest="${pair#*:}"
  for f in "$dir"/*.html "$dir"/*.md; do
    [ -e "$f" ] || continue
    grep -qxF "$(basename "$f")" .cache/r2-derived-state.txt || { echo "MISSING from checkpoint: $f"; miss=$((miss+1)); }
  done
done
echo "uncovered files: $miss"

echo "== 2. raw coverage"
rm -f /tmp/raw-count; touch /tmp/raw-count
for f in raw/*; do grep -qxF "raw/$(basename "$f")" .cache/r2-raw-state.txt || echo "$f" >> /tmp/raw-count; done
echo "raw uncovered: $(wc -l < /tmp/raw-count | tr -d ' ')"

echo "== 3. spot-gets (5 random keys)"
for f in $(ls md | shuf -n 2) $(ls jem/md | shuf -n 2) $(ls .cache/eqimg | shuf -n 1); do
  case "$f" in
    *.md) key="$f";;
    *.png) key="assets/$f";;
  esac
  npx wrangler r2 object get "repertoire-docs/$key" --file /tmp/spot --remote >/dev/null 2>&1
  size=$(stat -f%z /tmp/spot)
  [ "$size" -gt 0 ] && echo "OK ($size B) $key" || echo "ZERO-BYTE $key"
done

echo "== 4. census"
echo "raw state lines:      $(wc -l < .cache/r2-raw-state.txt | tr -d ' ')"
echo "derived state lines:  $(wc -l < .cache/r2-derived-state.txt | tr -d ' ')"
echo "eq assets state:      $(wc -l < .cache/eq-asset-state.txt | tr -d ' ')"
