#!/usr/bin/env python3
"""repertoire merge-tables: splice docling PDF tables into HTML-derived Markdown.

The HTML pipeline rasterizes tables (image tokens `![cap](doi-tabNN)` in md/).
Docling recovers table interiors from the PDFs. For each paper with both a
pdf/ and an md/ file:

  - walk docling tables in reading order; they must align 1:1 with the md's
    tabNN tokens (caption "Table N." numbers must match, else skip the paper)
  - simple table  -> replace the token line with caption + GFM table
  - complex table (any row/col span) -> keep the token, write
    assets/{doi_id}-tabNN.html

Checkpointed: papers whose report entry exists are skipped. Report at
.cache/merge-report.json. Usage: .venv/bin/python repertoire/src/psy-merge-tables.py [--limit N]
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

TOKEN_RE = re.compile(r"^!\[(?P<cap>[^\]]*)\]\((?P<id>10\.[^)]+-tab\d+)\)$", re.M)
TABNUM_RE = re.compile(r"Table\s+(\d+)")


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


def tabnum(text: str) -> str | None:
    m = TABNUM_RE.search(text)
    return m.group(1) if m else None


def merge(pdf_path: Path, converter: DocumentConverter) -> dict:
    doi_id = pdf_path.stem
    md_path = MD_DIR / f"{doi_id}.md"
    md = md_path.read_text()

    tokens = list(TOKEN_RE.finditer(md))
    if not tokens:
        return {"status": "no-tokens"}

    doc = converter.convert(str(pdf_path)).document
    tables = [it for it, _ in doc.iterate_items() if isinstance(it, TableItem)]

    if len(tables) != len(tokens):
        return {"status": "count-mismatch", "md": len(tokens), "pdf": len(tables)}

    # validate alignment by caption table-number
    for tok, tbl in zip(tokens, tables):
        a, b = tabnum(tok.group("cap")), tabnum(caption(tbl, doc))
        if a and b and a != b:
            return {"status": "caption-mismatch", "md_cap": tok.group("cap")[:80]}

    stats = {"status": "merged", "inline": 0, "html": 0}
    out = md
    for tok, tbl in zip(tokens, tables):
        asset_id = tok.group("id")
        if is_complex(tbl):
            (ASSET_DIR / f"{asset_id}.html").write_text(tbl.export_to_html(doc=doc))
            stats["html"] += 1
        else:
            gfm = table_to_markdown(tbl, doc)
            cap = tok.group("cap")
            repl = f"**{cap}**\n\n{gfm}" if cap else gfm
            out = out.replace(tok.group(0), repl, 1)
            stats["inline"] += 1
    md_path.write_text(out)
    return stats


def main() -> None:
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    ASSET_DIR.mkdir(exist_ok=True)
    REPORT.parent.mkdir(exist_ok=True)
    report = json.loads(REPORT.read_text()) if REPORT.exists() else {}

    options = PdfPipelineOptions()
    options.accelerator_options = AcceleratorOptions(device=AcceleratorDevice.MPS)
    options.do_formula_enrichment = False
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    )

    pdfs = [p for p in sorted(PDF_DIR.glob("*.pdf"))
            if p.stem not in report and (MD_DIR / f"{p.stem}.md").exists()][:limit]
    print(f"{len(pdfs)} papers to merge")
    for i, pdf in enumerate(pdfs, 1):
        try:
            stats = merge(pdf, converter)
        except Exception as e:
            stats = {"status": "error", "error": str(e)}
        report[pdf.stem] = stats
        if i % 10 == 0 or stats["status"] != "merged":
            print(f"[{i}/{len(pdfs)}] {pdf.stem}: {json.dumps(stats)}", flush=True)
        if i % 25 == 0:
            REPORT.write_text(json.dumps(report, indent=2))
    REPORT.write_text(json.dumps(report, indent=2))
    print(f"report -> {REPORT}")


if __name__ == "__main__":
    main()
