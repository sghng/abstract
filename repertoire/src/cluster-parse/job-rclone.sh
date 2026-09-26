#!/bin/bash
# job-rclone.sh -- upload a parse-run dir to the R2 bucket. args: <srcdir> <prefix>
# rclone copy is idempotent (size/hash skip); safe to resubmit on partial runs.
set -eu
source $HOME/parse-run/.env
RC=$HOME/parse-run/bin/rclone
[ -x "$RC" ] || RC=$HOME/homebrew/bin/rclone
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT=$CF_S3_ENDPOINT
export RCLONE_CONFIG_R2_ACCESS_KEY_ID=$CF_S3_KEY_ID
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$CF_S3_SECRET
$RC copy "$1" "r2:$R2_BUCKET/$2" \
  --transfers 64 --checkers 32 --stats-one-line --stats 120s
echo "RCLONE DONE: $1 -> $2"
