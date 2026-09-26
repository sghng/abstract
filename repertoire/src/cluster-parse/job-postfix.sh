#!/bin/bash
# job-postfix.sh -- after leakfix: re-upload changed md, backup-copy md to
# repertoire-backup, pack cluster snapshot. Run after md-stats-sub.py.
set -eu
source $HOME/parse-run/.env
RC=$HOME/parse-run/bin/rclone
[ -x "$RC" ] || RC=$HOME/homebrew/bin/rclone
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ENDPOINT=$CF_S3_ENDPOINT
export RCLONE_CONFIG_R2_ACCESS_KEY_ID=$CF_S3_KEY_ID
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=$CF_S3_SECRET

# 1. refresh changed objects in the live prefix
$RC copy $HOME/parse-run/out/md "r2:$R2_BUCKET/md/" \
  --transfers 64 --checkers 32 --stats-one-line --stats 120s
echo "REUPLOAD DONE"

# 2. mirror md into the backup bucket
$RC copy "r2:$R2_BUCKET/md/" "r2:repertoire-backup/md/" \
  --s3-copy-cutoff 4GiB --transfers 64 --checkers 32 --stats-one-line --stats 120s
echo "MD BACKUP DONE"

# 3. cluster snapshot: md + meta reports, zstd-packed
mkdir -p $HOME/parse-run/backup
tar -C $HOME/parse-run/out -cf - md | zstd -T4 -3 -f -o $HOME/parse-run/backup/md-2026-09-25.tar.zst
cp $HOME/parse-run/out/report/md-stats.tsv $HOME/parse-run/backup/ 2>/dev/null || true
cp $HOME/parse-run/out/report/report-*.jsonl $HOME/parse-run/backup/ 2>/dev/null || true
echo "SNAPSHOT DONE: $(du -h $HOME/parse-run/backup/md-2026-09-25.tar.zst | cut -f1)"
