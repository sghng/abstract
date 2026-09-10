#!/usr/bin/env bash
# Current tail-chain stage + live progress line.
cd "$(dirname "$0")"
echo "=== stages completed ==="
grep "done at\|FAILED\|COMPLETE" .cache/tail.log 2>/dev/null
echo "=== newest stage log ==="
LOG=$(ls -t .cache/tail-*.log 2>/dev/null | head -1)
echo "$LOG"
tail -2 "$LOG" 2>/dev/null
echo "=== live: $(ps aux | grep -E '[b]un src|[r]un-tail' | grep -v grep | wc -l | tr -d ' ') processes ==="
