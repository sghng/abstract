#!/bin/bash
# self-staging via the R2 S3 API (rclone, SigV4). Same interface and
# output contract as pull-slice.ts: <slice-file> <fmt>, fills
# $TMPDIR/raw-new/<doi_id>.<fmt>, writes $TMPDIR/miss.jsonl, prints
# "pull-slice done: N/M present". Selected automatically by the job
# scripts when CF_S3_KEY_ID is present in ~/parse-run/.env.
# The S3 API is not subject to the REST 1,200 req/5 min ceiling, so
# transfers can be wide here.
set -u
slice="$1"; fmt="$2"
R="$HOME/parse-run"; TMP="${TMPDIR:-/tmp}"
set -a; . "$R/.env"; set +a
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$CF_S3_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$CF_S3_SECRET"
# jurisdiction-specific endpoint when provided (R2 EU/etc accounts)
export RCLONE_CONFIG_R2_ENDPOINT="${CF_S3_ENDPOINT:-https://$CF_ACCOUNT.r2.cloudflarestorage.com}"
mkdir -p "$TMP/raw-new"
# files-from entries are relative to the raw/ source prefix
awk -v f=".$fmt" 'NF { print $0 f }' "$slice" > "$TMP/keys.txt"
n=$(grep -c . "$slice" || true)
rclone copy "R2:$R2_BUCKET/raw" "$TMP/raw-new" \
  --files-from "$TMP/keys.txt" \
  --transfers "${S3_TRANSFERS:-8}" --checkers 4 --no-traverse \
  --retries 5 --low-level-retries 10 \
  --log-file "$TMP/rclone.log" --log-level ERROR
: > "$TMP/miss.jsonl"
while read -r id; do
  [ -s "$TMP/raw-new/$id.$fmt" ] || printf '{"doi_id":"%s"}\n' "$id" >> "$TMP/miss.jsonl"
done < "$slice"
present=$(find "$TMP/raw-new" -maxdepth 1 -type f | wc -l)
echo "pull-slice done: $present/$n present, misses logged to $TMP/miss.jsonl"
[ "$present" -gt 0 ] || exit 1
