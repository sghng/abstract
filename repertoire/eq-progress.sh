#!/usr/bin/env bash
# Live progress of the equation splice (and tail chain after it).
# Splice rewrites each touched md file (even all-fail papers), so mtime
# marks done; @@eq token count alone would lie (fails keep tokens).
cd "$(dirname "$0")"
python3 - <<'EOF'
import glob, os, re, time
start = None
for line in open(".cache/tail.log"):
    m = re.search(r"done at (.+)$", line.strip())
    if m:
        try:
            start = time.mktime(time.strptime(m.group(1), "%a %b %d %H:%M:%S %Z %Y"))
        except ValueError:
            pass
tok, done, remaining = [], 0, []
for d in ["md", "jem/md"]:
    for f in glob.glob(f"{d}/*.md"):
        try:
            has = "@@eq" in open(f, errors="ignore").read()
        except OSError:
            continue
        if not has:
            continue
        tok.append(f)
        if start is not None and os.path.getmtime(f) > start:
            done += 1
        else:
            remaining.append(f)
print(f"eq papers: {len(tok)}  spliced-or-kept: {done}  remaining: {len(remaining)}")
if remaining:
    remaining.sort()
    print(f"next up: {remaining[0]}")
EOF
echo "--- tail chain:"; tail -3 .cache/tail.log 2>/dev/null
echo "--- live processes: $(ps aux | grep -E '[i]mg2latex|[r]un-tail' | grep -v grep | wc -l | tr -d ' ')"
