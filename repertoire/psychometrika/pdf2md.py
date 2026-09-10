#!/usr/bin/env python3
"""repertoire convert: PDF -> Markdown + assets via docling.

Walks the DoclingDocument in reading order and renders:
  section headers  -> ATX headings
  text/list items  -> paragraphs / list lines
  simple tables    -> inline GFM Markdown tables
  complex tables   -> assets/{doi_id}-tabNN.html (docling HTML) + caption line
  pictures         -> assets/{doi_id}-figNN.png + caption as alt text

Complexity rule: any cell with row_span > 1 or col_span > 1 => complex.
Usage: .venv/bin/python repertoire/src/psy-convert.py [--limit N]
       (run from repo root; .venv lives at repo root)
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    AcceleratorDevice,
    AcceleratorOptions,
    PdfPipelineOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc.document import (
    FormulaItem,
    ListItem,
    PictureItem,
    SectionHeaderItem,
    TableItem,
    TextItem,
)

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "pdf"
MD_DIR = ROOT / "md"
ASSET_DIR = ROOT / "assets"
REPORT = ROOT / ".cache" / "convert-report.json"


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


def captions(item, doc) -> str:
    try:
        text = item.caption_text(doc=doc)
        return " ".join(text.split())
    except Exception:
        return ""


def convert(pdf_path: Path, converter: DocumentConverter) -> dict:
    doi_id = pdf_path.stem
    result = converter.convert(str(pdf_path))
    doc = result.document

    md_lines: list[str] = []
    stats = {"tables_md": 0, "tables_html": 0, "figures": 0, "formulas": 0, "pages": 0}
    tab_no = 0
    fig_no = 0

    try:
        stats["pages"] = len(doc.pages)
    except Exception:
        pass

    for item, _level in doc.iterate_items():
        if isinstance(item, SectionHeaderItem):
            md_lines.append(f"\n## {item.text.strip()}\n")
        elif isinstance(item, TableItem):
            cap = captions(item, doc)
            if is_complex(item):
                tab_no += 1
                name = f"{doi_id}-tab{tab_no:02d}.html"
                (ASSET_DIR / name).write_text(item.export_to_html(doc=doc))
                stats["tables_html"] += 1
                ref = f"[complex table: ../assets/{name}]"
                md_lines.append(f"\n**Table.** {cap} {ref}\n" if cap else f"\n{ref}\n")
            else:
                stats["tables_md"] += 1
                body = table_to_markdown(item, doc)
                md_lines.append(f"\n**Table.** {cap}\n\n{body}\n" if cap else f"\n{body}\n")
        elif isinstance(item, PictureItem):
            cap = captions(item, doc) or None
            try:
                img = item.get_image(doc)
                w, h = img.size
                # icons/badges (ORCID, journal banner, check-updates): any
                # dimension under 32px is never a real figure
                if w < 32 or h < 32:
                    continue
                fig_no += 1
                name = f"{doi_id}-fig{fig_no:02d}.png"
                img.save(ASSET_DIR / name)
                md_lines.append(f"\n![{cap or f'Figure {fig_no}'}](../assets/{name})\n")
                stats["figures"] += 1
            except Exception as e:  # image extraction can fail on odd encodings
                md_lines.append(f"\n[figure {fig_no}: extraction failed: {e}]\n")
        elif isinstance(item, FormulaItem):
            stats["formulas"] += 1
            text = getattr(item, "text", "").strip()
            if text:
                md_lines.append(f"\n$$\n{text}\n$$\n")
        elif isinstance(item, ListItem):
            md_lines.append(f"- {item.text.strip()}")
        elif isinstance(item, TextItem):
            md_lines.append(f"\n{item.text.strip()}\n")

    md_path = MD_DIR / f"{doi_id}.md"
    md_path.write_text("\n".join(md_lines))
    stats["md_bytes"] = md_path.stat().st_size
    stats["md_sha256"] = hashlib.sha256(md_path.read_bytes()).hexdigest()
    return stats


def main() -> None:
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    MD_DIR.mkdir(exist_ok=True)
    ASSET_DIR.mkdir(exist_ok=True)
    REPORT.parent.mkdir(exist_ok=True)

    options = PdfPipelineOptions()
    options.accelerator_options = AcceleratorOptions(device=AcceleratorDevice.MPS)
    # formula enrichment runs a CPU-only VLM per display equation: 10+ min for
    # a math-dense paper. Off by default; inline math survives via the text
    # layer. Opt in per-paper with --formulas for a slow enrichment pass.
    options.do_formula_enrichment = "--formulas" in sys.argv
    options.generate_picture_images = True
    # render pictures from the page raster at 2x: default 1.0 is screen
    # resolution and visibly fuzzy on print PDFs
    options.images_scale = 2.0
    converter = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)}
    )

    pdfs = sorted(PDF_DIR.glob("*.pdf"))[:limit]
    report = {}
    for i, pdf in enumerate(pdfs, 1):
        try:
            stats = convert(pdf, converter)
            report[pdf.stem] = stats
            print(f"[{i}/{len(pdfs)}] {pdf.stem}: {json.dumps(stats)}", flush=True)
        except Exception as e:
            report[pdf.stem] = {"error": str(e)}
            print(f"[{i}/{len(pdfs)}] {pdf.stem}: FAILED {e}", flush=True)

    REPORT.write_text(json.dumps(report, indent=2))
    print(f"report -> {REPORT}")


if __name__ == "__main__":
    main()
