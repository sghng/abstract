#!/bin/bash
# job-small.sh -- one job for the three small routes (docx 697,
# xml 1,451, html 884): self-stage into $TMPDIR, convert, ship. jem/bjmsp
# xml via jemxml2md (dir-glob), jebs xml/html via jebs2md mini-manifests,
# psy html via html2md, psyarxiv docx via docx2md.
set -u
R="$HOME/parse-run"; W="$R/work"
export PATH="$HOME/.bun/bin:$R/bin:$PATH"
export PANDOC="$R/bin/pandoc"
export REP_ROOT="$W"
cd "$W" || exit 1
export RAW_DIR="$TMPDIR/raw-new"
mkdir -p "$TMPDIR/raw-new" "$TMPDIR/stage/xml-jem" "$TMPDIR/stage/html-psy"
# puller: rclone/S3 when S3 keys are configured (no REST rate ceiling),
# otherwise the paced REST puller
set -a; . "$R/.env" 2>/dev/null; set +a
if [ -n "${CF_S3_KEY_ID:-}" ]; then
  PULL="$W/src/cluster-parse/pull-slice-rclone.sh"
else
  PULL="bun $W/src/cluster-parse/pull-slice.ts"
fi


# ---- slice files per sub-route (from the queues) ----
python3 - <<'PYEOF'
import json, os
R = os.path.expanduser("~/parse-run")
T = os.environ["TMPDIR"]
def dump(route, fams, path):
    ids = []
    for l in open(f"{R}/queue/{route}.queue.jsonl"):
        if not l.strip(): continue
        q = json.loads(l)
        if fams is None or q["fam"] in fams:
            ids.append(q["doi_id"])
    open(path, "w").write("\n".join(ids) + "\n")
    return len(ids)
TMP = T
n_docx = dump("docx", None, f"{TMP}/ids-docx.txt")
n_xmlj = dump("xml", {"jem", "bjmsp"}, f"{TMP}/ids-xml-jem.txt")
n_xmle = dump("xml", {"jebs"}, f"{TMP}/ids-xml-jebs.txt")
n_htmlp = dump("html", {"psychometrika"}, f"{TMP}/ids-html-psy.txt")
n_htmle = dump("html", {"jebs"}, f"{TMP}/ids-html-jebs.txt")
print(f"slices: docx={n_docx} xml-jem={n_xmlj} xml-jebs={n_xmle} html-psy={n_htmlp} html-jebs={n_htmle}")
PYEOF

pull() { $PULL "$TMPDIR/$1" "$2" || true; }
# docx + jebs xml + jebs html pull straight to raw-new
pull ids-docx.txt docx
pull ids-xml-jebs.txt xml
pull ids-html-jebs.txt html

# jem/bjmsp xml -> stage dir (pull-slice writes raw-new; move into place)
pull ids-xml-jem.txt xml
while read -r id; do mv "$TMPDIR/raw-new/$id.xml" "$TMPDIR/stage/xml-jem/$id.xml" 2>/dev/null; done < "$TMPDIR/ids-xml-jem.txt"
# psy html -> stage dir
pull ids-html-psy.txt html
while read -r id; do mv "$TMPDIR/raw-new/$id.html" "$TMPDIR/stage/html-psy/$id.html" 2>/dev/null; done < "$TMPDIR/ids-html-psy.txt"

# ---- convert ----
[ -s "$TMPDIR/ids-docx.txt" ] && bun "$W/src/families/psyarxiv/docx2md.ts" --batch --out "$TMPDIR/out-docx" $(cat "$TMPDIR/ids-docx.txt") 2>&1 | tail -8
[ "$(ls "$TMPDIR/stage/xml-jem" 2>/dev/null | wc -l)" -gt 0 ] && \
  bun "$W/src/families/jem/jemxml2md.ts" --xml-dir "$TMPDIR/stage/xml-jem" --md-dir "$TMPDIR/out-xml-jem" \
    --ndjson "$R/out/report/xml-jem-assets.ndjson" --skipped "$TMPDIR/xml-jem-skipped.jsonl" 2>&1 | tail -2

python3 - <<'PYEOF'
import json, os
R = os.path.expanduser("~/parse-run"); T = os.environ["TMPDIR"]
def mini(route, ids_file, fmt, out):
    rows = {json.loads(l)["doi_id"]: json.loads(l) for l in open(f"{R}/queue/{route}.queue.jsonl") if l.strip()}
    with open(out, "w") as w:
        for i in open(ids_file):
            i = i.strip()
            if not i or i not in rows: continue
            q = rows[i]
            w.write(json.dumps({"doi": i.replace(":", "/"), "doi_id": i, "journal": "jebs",
                                "year": q["year"], "format": fmt,
                                "file": f"{T}/raw-new/{i}.{fmt}", "bytes": q.get("bytes")}) + "\n")
mini("xml", f"{T}/ids-xml-jebs.txt", "xml", f"{T}/jebs-xml.mini.jsonl")
mini("html", f"{T}/ids-html-jebs.txt", "html", f"{T}/jebs-html.mini.jsonl")
PYEOF
[ -s "$TMPDIR/jebs-xml.mini.jsonl" ] && \
  bun "$W/src/families/jebs/jebs2md.ts" --manifest "$TMPDIR/jebs-xml.mini.jsonl" --md-dir "$TMPDIR/out-xml-jebs" \
    --ndjson "$R/out/report/jebs-xml-assets.ndjson" --downloads "$TMPDIR/jebs-xml-dl.jsonl" --skipped "$TMPDIR/jebs-xml-skipped.jsonl" 2>&1 | tail -2
[ -s "$TMPDIR/jebs-html.mini.jsonl" ] && \
  bun "$W/src/families/jebs/jebs2md.ts" --manifest "$TMPDIR/jebs-html.mini.jsonl" --md-dir "$TMPDIR/out-html-jebs" \
    --ndjson "$R/out/report/jebs-html-assets.ndjson" --downloads "$TMPDIR/jebs-html-dl.jsonl" --skipped "$TMPDIR/jebs-html-skipped.jsonl" 2>&1 | tail -2
[ "$(ls "$TMPDIR/stage/html-psy" 2>/dev/null | wc -l)" -gt 0 ] && \
  bun "$W/src/families/psy/html2md.ts" --html-dir "$TMPDIR/stage/html-psy" --md-dir "$TMPDIR/out-html-psy" \
    --sql "$R/out/report/psy-html-assets.sql" 2>&1 | tail -2

# ---- ship (docx writes <safe>.md; others write <doi_id>.md) ----
python3 - <<'PYEOF'
import os, shutil
R = os.path.expanduser("~/parse-run"); T = os.environ["TMPDIR"]
dst = f"{R}/out/md"
os.makedirs(dst, exist_ok=True)
n = 0
for d in ("out-xml-jem", "out-xml-jebs", "out-html-jebs", "out-html-psy"):
    p = f"{T}/{d}"
    if not os.path.isdir(p): continue
    for f in os.listdir(p):
        if f.endswith(".md"):
            shutil.copyfile(f"{p}/{f}", f"{dst}/{f}")
            n += 1
ids = [l.strip() for l in open(f"{T}/ids-docx.txt") if l.strip()]
safe = lambda i: "".join(c if c.isalnum() or c in "._-" else "_" for c in i)
for i in ids:
    s = f"{T}/out-docx/{safe(i)}.md"
    if os.path.exists(s) and os.path.getsize(s) > 0:
        shutil.copyfile(s, f"{dst}/{i}.md")
        n += 1
print(f"shipped {n} md")
PYEOF
for f in "$TMPDIR"/*skipped.jsonl; do
  [ -f "$f" ] && cat "$f" >> "$R/out/report/small-skipped.jsonl"
done
[ -f "$TMPDIR/miss.jsonl" ] && cat "$TMPDIR/miss.jsonl" >> "$R/out/report/miss-small.jsonl"
exit 0
