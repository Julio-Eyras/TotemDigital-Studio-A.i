#!/usr/bin/env python3
"""Converte Markdown simples (docs Totem Digital) para PDF via ReportLab."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPO = Path(__file__).resolve().parents[1]


def esc(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # bold **text**
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # inline code `x`
    text = re.sub(r"`([^`]+)`", r"<font face='Courier' size='9'>\1</font>", text)
    return text


def parse_table_row(line: str) -> list[str]:
    parts = [c.strip() for c in line.strip().strip("|").split("|")]
    return parts


def is_table_sep(line: str) -> bool:
    s = line.strip()
    if not s.startswith("|"):
        return False
    return bool(re.match(r"^\|[\s\-:|]+\|$", s))


def parse_markdown(lines: list[str]) -> list[tuple[str, object]]:
    blocks: list[tuple[str, object]] = []
    i = 0
    in_code = False
    code_buf: list[str] = []

    while i < len(lines):
        line = lines[i].rstrip("\n")
        stripped = line.strip()

        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_buf = []
            else:
                in_code = False
                blocks.append(("code", "\n".join(code_buf)))
            i += 1
            continue

        if in_code:
            code_buf.append(line)
            i += 1
            continue

        if not stripped:
            blocks.append(("blank", ""))
            i += 1
            continue

        if stripped == "---":
            blocks.append(("hr", ""))
            i += 1
            continue

        if stripped.startswith("|") and "|" in stripped[1:]:
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                if not is_table_sep(lines[i]):
                    rows.append(parse_table_row(lines[i]))
                i += 1
            if rows:
                blocks.append(("table", rows))
            continue

        if line.startswith("#### "):
            blocks.append(("h4", line[5:].strip()))
        elif line.startswith("### "):
            blocks.append(("h3", line[4:].strip()))
        elif line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("- [ ] "):
            blocks.append(("li", "☐ " + line[6:].strip()))
        elif line.startswith("- [x] ") or line.startswith("- [X] "):
            blocks.append(("li", "☑ " + line[6:].strip()))
        elif line.startswith("- "):
            blocks.append(("li", line[2:].strip()))
        elif re.match(r"^\d+\.\s", line):
            blocks.append(("ol", re.sub(r"^\d+\.\s", "", line).strip()))
        else:
            blocks.append(("p", stripped))
        i += 1

    return blocks


def build_styles():
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"], fontName="Helvetica-Bold",
            fontSize=17, leading=21, spaceAfter=10, textColor=colors.HexColor("#1a237e"),
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName="Helvetica-Bold",
            fontSize=13, leading=17, spaceBefore=10, spaceAfter=6,
            textColor=colors.HexColor("#1565c0"),
        ),
        "h3": ParagraphStyle(
            "H3", parent=base["Heading3"], fontName="Helvetica-Bold",
            fontSize=11, leading=14, spaceBefore=6, spaceAfter=4,
            textColor=colors.HexColor("#283593"),
        ),
        "h4": ParagraphStyle(
            "H4", parent=base["Heading3"], fontName="Helvetica-Bold",
            fontSize=10, leading=13, spaceBefore=4, spaceAfter=3,
        ),
        "p": ParagraphStyle(
            "P", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.5, leading=13, spaceAfter=4,
        ),
        "li": ParagraphStyle(
            "LI", parent=base["BodyText"], fontName="Helvetica",
            fontSize=9.5, leading=13, leftIndent=14, bulletIndent=4, spaceAfter=2,
        ),
        "code": ParagraphStyle(
            "CODE", parent=base["Code"], fontName="Courier",
            fontSize=8.5, leading=10.5, leftIndent=6, backColor=colors.HexColor("#f5f5f5"),
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=base["Normal"], fontSize=11, leading=14,
            alignment=1, spaceAfter=20, textColor=colors.HexColor("#455a64"),
        ),
    }


def table_flowable(rows: list[list[str]], styles) -> Table:
    data = [[Paragraph(esc(c), styles["p"]) for c in row] for row in rows]
    col_count = max(len(r) for r in rows)
    width = 17 * cm
    col_w = width / col_count if col_count else width
    t = Table(data, colWidths=[col_w] * col_count, repeatRows=1)
    t.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eaf6")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1a237e")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#bdbdbd")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ])
    )
    return t


def md_to_pdf(md_path: Path, pdf_path: Path, title: str | None = None) -> None:
    content = md_path.read_text(encoding="utf-8").splitlines()
    blocks = parse_markdown(content)
    styles = build_styles()

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=1.8 * cm,
        leftMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
        title=title or md_path.stem,
        author="Totem Digital",
    )

    story = []
    for typ, txt in blocks:
        if typ == "blank":
            story.append(Spacer(1, 4))
        elif typ == "hr":
            story.append(Spacer(1, 6))
            story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#bdbdbd")))
            story.append(Spacer(1, 6))
        elif typ == "h1":
            story.append(Paragraph(esc(str(txt)), styles["h1"]))
        elif typ == "h2":
            story.append(Paragraph(esc(str(txt)), styles["h2"]))
        elif typ == "h3":
            story.append(Paragraph(esc(str(txt)), styles["h3"]))
        elif typ == "h4":
            story.append(Paragraph(esc(str(txt)), styles["h4"]))
        elif typ == "li":
            story.append(Paragraph(esc(str(txt)), styles["li"], bulletText="•"))
        elif typ == "ol":
            story.append(Paragraph(esc(str(txt)), styles["li"], bulletText="–"))
        elif typ == "code":
            story.append(Preformatted(str(txt), styles["code"]))
            story.append(Spacer(1, 4))
        elif typ == "table":
            story.append(table_flowable(txt, styles))
            story.append(Spacer(1, 6))
        else:
            story.append(Paragraph(esc(str(txt)), styles["p"]))

    doc.build(story)


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera PDF a partir de Markdown")
    parser.add_argument("input", type=Path, help="Arquivo .md")
    parser.add_argument("-o", "--output", type=Path, help="Arquivo .pdf de saída")
    parser.add_argument("--title", type=str, default="")
    args = parser.parse_args()

    md = args.input.resolve()
    pdf = args.output.resolve() if args.output else md.with_suffix(".pdf")
    md_to_pdf(md, pdf, title=args.title or md.stem)
    print(f"OK {pdf}")


if __name__ == "__main__":
    main()
