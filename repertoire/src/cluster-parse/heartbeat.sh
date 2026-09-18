#!/bin/bash
# heartbeat.sh -- one-snapshot master status of the parse run.
# Runnable on demand; the nohup looper (start-heartbeat.sh) appends a
# block to logs/heartbeat.log every BEAT_SEC. Signals: STALL (jobs
# running, md frozen), DEAD (queue empty, work remaining), DISK (quota).
set -u
R="$HOME/parse-run"
ts=$(date +%FT%T)
md=$(ls "$R/out/md" 2>/dev/null | wc -l)
mdu=$(du -sh "$R/out/md" 2>/dev/null | cut -f1)

# queue: compact name/state census
qsum=$(qstat -u "$USER" 2>/dev/null | awk 'NR>2{print $3"/"$5}' | sort | uniq -c | sort -rn | tr '\n" " ' '  ' )
nrun=$(qstat -u "$USER" 2>/dev/null | awk 'NR>2 && $5=="r"' | wc -l)

# expected total from the queues (live, not hardcoded)
exp=$(cat "$R"/queue/*.queue.jsonl 2>/dev/null | grep -c . )

# rate vs previous beat (state file)
prev=$(cat "$R/logs/beat.md" 2>/dev/null || echo "$md")
pt=$(cat "$R/logs/beat.ts" 2>/dev/null || date +%s)
now=$(date +%s)
dmin=$(( (now - pt) / 60 )); [ "$dmin" -lt 1 ] && dmin=1
rate=$(( (md - prev) / dmin ))
echo "$md" > "$R/logs/beat.md"; echo "$now" > "$R/logs/beat.ts"

missn=$(cat "$R"/out/report/miss-*.jsonl 2>/dev/null | grep -c .)

# liveness below the md line: last pull counter and crash census per route
# (ship-at-end means md is flat for the whole pull phase; these move)
prog=""
for p in tex arpdf small ocr; do
  last=$(ls -t "$R"/logs/$p-*.out "$R"/logs/$p.out 2>/dev/null | head -1)
  [ -z "$last" ] && continue
  pc=$(grep -o "pull [0-9]*/[0-9]*" "$last" 2>/dev/null | tail -1)
  dn=$(grep -l "pull-slice done" "$R"/logs/$p-*.out 2>/dev/null | wc -l)
  cr=$(grep -l "^error:" "$R"/logs/$p-*.out 2>/dev/null | wc -l)
  prog="$prog $p[${pc:-none} done:$dn crash:$cr]"
done

# flags: STALL only when md is flat AND the pull counters have not moved
# (ship-at-end keeps md flat through a whole pull phase)
prevlive=$(cat "$R/logs/beat.live" 2>/dev/null || echo "")
echo "$prog" > "$R/logs/beat.live"
flags=""
[ "$nrun" -gt 0 ] && [ "$rate" -le 0 ] && [ "$prog" = "$prevlive" ] && flags="$flags STALL"
[ "$nrun" -eq 0 ] && [ "$md" -lt "$exp" ] && flags="$flags DEAD(queue-empty,$((exp-md))-remaining)"

# per-source md census (doi prefix, first 2 fields)
src=$(ls "$R/out/md" 2>/dev/null | awk -F: '{split($1,a,"."); print a[1]":"a[2]}' | sort | uniq -c | sort -rn | head -7 | awk '{printf "%s(%s) ", $2, $1}')

# disk (home)
disk=$(quota -s 2>/dev/null | awk 'END{print $1" used"}')

echo "== $ts md=$md/$exp (${rate}/min, $mdu) run=$nrun miss=$missn disk=$disk$flags"
echo "   live:$prog"
echo "   src: $src"
echo "   q: $qsum"
