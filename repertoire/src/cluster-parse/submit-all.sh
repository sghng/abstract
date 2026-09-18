#!/bin/bash
# submit-all.sh -- build slices, submit every per-source job at once,
# wait for all, run one retry sweep for missing md, print the summary.
# This replaces the v1 coordinator: no staging batches, no state files
# beyond the slices and the md outputs themselves.
set -u
R="$HOME/parse-run"; W="$R/work"
export PATH="$HOME/.bun/bin:$R/bin:$PATH"
export PANDOC="$R/bin/pandoc"
set -a; . "$R/.env" 2>/dev/null; set +a
mkdir -p "$R/out/md" "$R/out/report" "$R/slices"
cd "$W" || exit 1
log() { echo "[$(date '+%FT%T')] $*" | tee -a "$R/logs/submit-all.log"; }

# ---- slices ----
python3 - <<'PYEOF'
import json, os
R = os.path.expanduser("~/parse-run")
S = f"{R}/slices"
os.makedirs(S, exist_ok=True)
def ids_for(route, fam=None):
    out = []
    p = f"{R}/queue/{route}.queue.jsonl"
    for l in open(p):
        if not l.strip(): continue
        q = json.loads(l)
        if fam is None or q["fam"] == fam:
            out.append(q["doi_id"])
    return out
def write(name, items, chunk):
    n = 0
    for i in range(0, len(items), chunk):
        n += 1
        open(f"{S}/{name}-{n}.ids", "w").write("\n".join(items[i:i+chunk]) + "\n")
    open(f"{S}/{name}.count", "w").write(str(n))
    return n
tex = ids_for("tex")
arpdf = ids_for("pdf", "arxiv")
print("tex slices:", write("tex", tex, 5000))
print("arxiv-pdf slices:", write("arpdf", arpdf, 310))
PYEOF

NT=$(cat "$R/slices/tex.count"); NP=$(cat "$R/slices/arpdf.count")
# concurrent-task caps: REST needs 3/2 (~16 conn ceiling); S3 can go wide
TC_TEX=${TC_TEX:-3}; TC_ARPDF=${TC_ARPDF:-2}

# ---- submit everything ----
qsub -q long -N p-small -o "$R/logs/small.out" -e "$R/logs/small.err" "$W/src/cluster-parse/job-small.sh"
qsub -q gpu -l gpu_card=1 -N p-ocr -o "$R/logs/ocr.out" -e "$R/logs/ocr.err" "$W/src/cluster-parse/job-ocr.sh"
qsub -t 1-$NT -tc $TC_TEX -q long -N p-tex -o "$R/logs/tex-\$TASK_ID.out" -e "$R/logs/tex-\$TASK_ID.err" \
  "$W/src/cluster-parse/job-tex.sh"
qsub -t 1-$NP -tc $TC_ARPDF -q long -N p-arpdf -o "$R/logs/arpdf-\$TASK_ID.out" -e "$R/logs/arpdf-\$TASK_ID.err" \
  "$W/src/cluster-parse/job-pdf.sh"
for fam in psychometrika psyarxiv jem bjmsp jebs; do
  qsub -q long -pe smp 16 -N "p-jp-$fam" -o "$R/logs/jp-$fam.out" -e "$R/logs/jp-$fam.err" \
    "$W/src/cluster-parse/job-journal-pdf.sh" "$fam"
done
log "submitted: small, ocr, tex array ($NT), arpdf array ($NP), 5 journal-pdf jobs"

# ---- wait for all our jobs ----
while :; do
  n=$(qstat -u "$USER" 2>/dev/null | awk 'NR>2 && $4=="'"$USER"'"' | wc -l)
  [ "$n" -eq 0 ] && break
  sleep 60
done
log "all jobs finished; md count: $(ls "$R/out/md" | wc -l)"

# ---- retry sweep: any queue id without md gets one more thin pass ----
python3 - <<'PYEOF' > "$R/slices/retry.ids"
import json, os
R = os.path.expanduser("~/parse-run")
have = set(os.listdir(f"{R}/out/md"))
for route in ("tex", "pdf", "ocr", "html", "xml", "docx"):
    p = f"{R}/queue/{route}.queue.jsonl"
    if not os.path.exists(p): continue
    for l in open(p):
        if not l.strip(): continue
        q = json.loads(l)
        if f"{q['doi_id']}.md" not in have:
            print(json.dumps({"doi_id": q["doi_id"], "route": route, "fmt": q["fmt"]}))
PYEOF
NR=$(grep -c . "$R/slices/retry.ids" || true)
log "retry sweep: $NR missing"
[ "$NR" -gt 0 ] && qsub -q long -sync y -N p-retry -o "$R/logs/retry.out" -e "$R/logs/retry.err" \
  "$W/src/cluster-parse/job-retry.sh" "$R/slices/retry.ids"

# ---- summary ----
python3 - <<'PYEOF'
import json, os
R = os.path.expanduser("~/parse-run")
have = set(f[:-3] for f in os.listdir(f"{R}/out/md") if f.endswith(".md"))
tot = miss = 0
for route in ("tex", "pdf", "ocr", "html", "xml", "docx"):
    n = m = 0
    for l in open(f"{R}/queue/{route}.queue.jsonl"):
        if not l.strip(): continue
        q = json.loads(l); n += 1
        if q["doi_id"] not in have: m += 1
    tot += n; miss += m
    print(f"{route}: {n-m}/{n} md ({m} missing)")
print(f"TOTAL: {tot-miss}/{tot}")
PYEOF
log "submit-all complete"
