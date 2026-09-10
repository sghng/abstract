#!/usr/bin/env python3
"""repertoire merge-tables: splice docling PDF tables into HTML-derived md.

The HTML pipeline rasterizes psychometrika tables (tokens `![cap](tabNN)`
in md/). Docling recovers table interiors from the publisher PDFs. For
each paper with both a pdf/ and an md/ file, ALIGN BY TABLE NUMBER (the
publisher caption number), never by position:

  - docling TableItems are grouped in reading order: a captioned item
    ("Table 3 ...") starts a group; uncaptioned items that follow are
    continuation fragments (page splits) appended to it
  - md token tabNN expects publisher number N; the group with that
    number is the splice source
  - simple table (no row/col spans) -> caption + inline GFM
  - complex table -> keep the image ref in md, write attachment
    assets/{doi_id}:tabNN.html and record it for the assets table
  - no group for a number -> keep the image ref, report "pdf-missing"
    (fail-open: a missing table is better than a wrong splice)
  - two groups claim one number -> keep the image ref, report
    "pdf-ambiguous" (same fail-open)

Checkpointed by report entry. Report: .cache/merge-report.json.
Usage: .venv/bin/python repertoire/psychometrika/merge-tables.py
         [--limit N] [--only doi_id ...] [--diagnose doi_id]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    AcceleratorDevice,
    AcceleratorOptions,
    PdfPipelineOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc.document import TableItem

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pdf"
MD_DIR = ROOT / "md"
ASSET_DIR = ROOT / "assets"
REPORT = ROOT / ".cache" / "merge-report.json"

TOKEN_RE = re.compile(r"^!\[(?P<cap>[^\]]*)\]\((?P<id>tab(?P<num>\d+))\)$", re.M)
# caption numbers sit at the START of the caption ("TABLE 3. ..."); an
# unanchored search would also match references inside prose captions
# ("Blockmodels #3 ... from Table 1")
TABNUM_RE = re.compile(r"^\s*table\s+(\d+)\b", re.I)
SUBNUM_RE = re.compile(r"^(\d+)[a-z]\.", re.I)  # "9a. ..." = sub-table of Table 9


def is_complex(table: TableItem) -> bool:
    for row in table.data.grid:
        for cell in row:
            if cell.row_span > 1 or cell.col_span > 1:
                return True
    return False


def table_to_markdown(table: TableItem, doc) -> str:
    df = table.export_to_dataframe(doc=doc)
    cols = [str(c) for c in df.columns]
    lines = [
        "| " + " | ".join(cols) + " |",
        "| " + " | ".join("---" for _ in cols) + " |",
    ]
    for _, r in df.iterrows():
        cells = [str(v).replace("|", "\\|").replace("\n", " ") for v in r]
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def caption(item, doc) -> str:
    try:
        return " ".join(item.caption_text(doc=doc).split())
    except Exception:
        return ""


def tabnum(text: str) -> int | None:
    m = TABNUM_RE.match(text)
    if m:
        return int(m.group(1))
    m = SUBNUM_RE.match(text.strip())
    if m:
        return int(m.group(1))  # sub-table belongs to its parent number
    return None


class Fragment:
    """One docling TableItem (or a continuation thereof)."""

    def __init__(self, item: TableItem):
        self.item = item

    def rows(self) -> int:
        return len(self.item.data.grid)


def read_tables(pdf_path: Path, converter: DocumentConverter):
    """Return ordered [(num|None, TableItem)] from the PDF."""
    doc = converter.convert(str(pdf_path)).document
    out = []
    for it, _ in doc.iterate_items():
        if isinstance(it, TableItem):
            out.append(it)
    return doc, out


def ncols(t: TableItem) -> int:
    try:
        return len(t.data.grid[0]) if t.data.grid else 0
    except Exception:
        return 0


def group_by_number(tables, doc):
    """Group captioned tables with their continuation fragments.

    Returns {number: [TableItem, ...]} where the list is the captioned
    fragment first, continuations after. An EMPTY caption means the item
    is a page-split continuation of the previous table. A captioned but
    unnumbered item (e.g. "Appendix C ...") starts its own unnumbered
    group, which matching ignores. Uncaptioned tables before any
    captioned one also go to None.
    """
    groups: dict[int | None, list[TableItem]] = {}
    order: list[tuple[TableItem, int | None]] = []
    current: int | None = None
    first_caption_seen = False
    for t in tables:
        cap = caption(t, doc)
        n = tabnum(cap)
        if n is not None:
            current = n
            if TABNUM_RE.match(cap):
                first_caption_seen = True
        elif cap:  # captioned but unnumbered: not a continuation
            current = None
        elif (
            current is not None
            and groups.get(current)
            and ncols(groups[current][0]) != ncols(t)
        ):
            # empty caption but different column count: not a continuation
            # of the current table (likely an uncaptioned neighbor)
            current = None
        groups.setdefault(current, []).append(t)
        order.append((t, current))

    # uncaptioned pool after the first captioned table (candidates for the
    # positional fallback); items before any caption are page furniture
    seen = False
    pool: list[TableItem] = []
    for t, g in order:
        if g is None and seen and not caption(t, doc):
            pool.append(t)
        elif g is not None:
            seen = True
    groups.pop(None, None)
    return groups, pool


def merge(pdf_path: Path, converter: DocumentConverter) -> dict:
    doi_id = pdf_path.stem
    md_path = MD_DIR / f"{doi_id}.md"
    md = md_path.read_text()

    tokens = list(TOKEN_RE.finditer(md))
    if not tokens:
        return {"status": "no-tokens"}

    stats: dict = {"status": "merged", "inline": 0, "html": 0, "missing": [], "ambiguous": []}
    doc, tables = read_tables(pdf_path, converter)
    groups, pool = group_by_number(tables, doc)

    tokens = list(TOKEN_RE.finditer(md))
    missing_nums = [
        int(m.group("num"))
        for m in tokens
        if int(m.group("num")) not in groups
    ]
    # positional fallback: exact count match between uncaptioned pool and
    # missing numbers, in reading order (any mismatch stays fail-open)
    if missing_nums and len(missing_nums) == len(pool):
        for num, t in zip(missing_nums, pool):
            groups[num] = [t]
    out = md
    for tok in tokens:
        num = int(tok.group("num"))
        frag = groups.get(num)
        if not frag:
            stats["missing"].append(num)
            continue
        if len(frag) > 1 and TABNUM_RE.match(caption(frag[1], doc) or "") and tabnum(caption(frag[1], doc)) == num:
            # two independently captioned tables claim the number
            # (a "9a." sub-caption on a later fragment is a legit
            # continuation of Table 9, not an ambiguity)
            stats["ambiguous"].append(num)
            continue
        # merge continuation fragments by row concatenation via html/gfm
        # of the primary fragment; continuations append rows
        primary = frag[0]
        items = frag
        if is_complex(primary) or any(is_complex(t) for t in items):
            html = "\n".join(t.export_to_html(doc=doc) for t in items)
            (ASSET_DIR / f"{doi_id}:tab{num:02d}.html").write_text(html)
            stats["html"] += 1
        else:
            gfm = "\n\n".join(table_to_markdown(t, doc) for t in items)
            cap = tok.group("cap")
            repl = f"**{cap}**\n\n{gfm}" if cap else gfm
            out = out.replace(tok.group(0), repl, 1)
            stats["inline"] += 1
    if stats["missing"] or stats["ambiguous"]:
        stats["pdf_missing"] = stats.pop("missing")
        stats["pdf_ambiguous"] = stats.pop("ambiguous")
    else:
        stats.pop("missing")
        stats.pop("ambiguous")
    if stats["inline"] or stats["html"]:
        md_path.write_text(out)
    if not (stats["inline"] or stats["html"]):
        stats["status"] = "pdf-missing" if "pdf_missing" in stats else "pdf-ambiguous"
    return stats


def diagnose(pdf_path: Path, converter: DocumentConverter) -> None:
    doi_id = pdf_path.stem
    md = (MD_DIR / f"{doi_id}.md").read_text()
    print(f"== {doi_id}")
    print("md tokens:", [int(m.group("num")) for m in TOKEN_RE.finditer(md)])
    doc, tables = read_tables(pdf_path, converter)
    for i, t in enumerate(tables):
        cap = caption(t, doc)
        try:
            rows = len(t.data.grid)
        except Exception:
            rows = "?"
        print(f"  pdf[{i}] rows={rows} num={tabnum(cap)} cap={cap[:90]!r}")


def main() -> None:
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    only = []
    if "--only" in sys.argv:
        i = sys.argv.index("--only") + 1
        while i < len(sys.argv) and not sys.argv[i].startswith("--"):
            only.append(sys.argv[i])
            i += 1
    if "--diagnose" in sys.argv:
        target = sys.argv[sys.argv.index("--diagnose") + 1]

        options = PdfPipelineOptions()
        options.accelerator_options = AcceleratorOptions(device=AcceleratorDevice.MPS)
        options.do_formula_enrichment = False
        converter = DocumentConverter(
            format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
        )
        diagnose(PDF_DIR / f"{target}.pdf", converter)
        return

    ASSET_DIR.mkdir(exist_ok=True)
    REPORT.parent.mkdir(exist_ok=True)
    report = json.loads(REPORT.read_text()) if REPORT.exists() else {}

    options = PdfPipelineOptions()
    options.accelerator_options = AcceleratorOptions(device=AcceleratorDevice.MPS)
    options.do_formula_enrichment = False
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    )

    if only:
        pdfs = [PDF_DIR / f"{d}.pdf" for d in only]
    else:
        pdfs = [
            p
            for p in sorted(PDF_DIR.glob("*.pdf"))
            if p.stem not in report and (MD_DIR / f"{p.stem}.md").exists()
        ][:limit]
    print(f"{len(pdfs)} papers to merge")
    for i, pdf in enumerate(pdfs, 1):
        try:
            stats = merge(pdf, converter)
        except Exception as e:
            stats = {"status": "error", "error": str(e)[:200]}
        report[pdf.stem] = stats
        if i % 10 == 0 or stats["status"] != "merged":
            print(f"[{i}/{len(pdfs)}] {pdf.stem}: {json.dumps(stats)[:220]}", flush=True)
        if i % 25 == 0:
            REPORT.write_text(json.dumps(report, indent=2))
    REPORT.write_text(json.dumps(report, indent=2))
    print(f"report -> {REPORT}")


if __name__ == "__main__":
    main()
