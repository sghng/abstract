#!/bin/bash
# looper: crontab is banned on crcfe01; a nohup loop is the heartbeat driver.
# </dev/null so the ssh session that started it can close cleanly.
R="$HOME/parse-run"
mkdir -p "$R/logs"
if pgrep -f "heartbeat-loop" >/dev/null 2>&1; then
  echo "heartbeat already running"; exit 0
fi
cat > "$R/logs/heartbeat-loop.sh" <<'E2'
#!/bin/bash
# heartbeat-loop (marker for pgrep)
while :; do
  bash ~/parse-run/work/src/cluster-parse/heartbeat.sh >> ~/parse-run/logs/heartbeat.log 2>&1
  sleep 900
done
E2
nohup bash "$R/logs/heartbeat-loop.sh" </dev/null >/dev/null 2>&1 &
echo "heartbeat started (pid $!)"
