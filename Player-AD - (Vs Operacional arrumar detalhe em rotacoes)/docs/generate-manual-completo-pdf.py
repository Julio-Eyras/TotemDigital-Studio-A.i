#!/usr/bin/env python3
"""Gera um único PDF com todos os manuais do Player-AD."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPO = Path(__file__).resolve().parents[2]
PLAYER_DOCS = REPO / "Player-AD" / "docs"
PENDRIVE_DOCS = REPO / "install-pendrive" / "docs"

OUT_NAME = "MANUAL-COMPLETO-PLAYER-AD.pdf"

# Ordem lógica: utilizador → operação → instalação técnica → arquitetura → troubleshooting
SECTIONS: list[tuple[str, Path]] = [
    ("1. Resumo executivo", PLAYER_DOCS / "RESUMO-EXECUTIVO-PLAYER-AD.md"),
    (
        "2. Manual do utilizador — instalação e configuração",
        PLAYER_DOCS / "MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md",
    ),
    ("3. Manual operacional (TV box / totem)", PLAYER_DOCS / "MANUAL-OPERACIONAL-TVBOX.md"),
    (
        "4. Notas técnicas de instalação (kit pendrive / ADB)",
        PENDRIVE_DOCS / "MANUAL-INSTALACAO-PLAYER-AD.md",
    ),
    (
        "5. Manual de arquitetura e desenvolvimento",
        PLAYER_DOCS / "MANUAL-ARQUITETURA-DESENVOLVIMENTO.md",
    ),
    ("6. Troubleshooting — crash", PLAYER_DOCS / "TROUBLESHOOTING-CRASH.md"),
    ("7. Registro operacional", PLAYER_DOCS / "REGISTRO-OPERACIONAL.md"),
]


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def inline_md(text: str) -> str:
    """Converte markdown inline simples para ReportLab XML."""
    import re

    t = esc(text)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r'<font face="Courier" size="9">\1</font>', t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", t)
    return t


def parse_markdown(lines: list[str]):
    blocks: list[tuple] = []
    in_code = False
    code_buf: list[str] = []
    table_buf: list[str] = []

    def flush_table():
        nonlocal table_buf
        if not table_buf:
            return
        rows = []
        for row in table_buf:
            cells = [c.strip() for c in row.strip().strip("|").split("|")]
            if cells and all(set(c) <= set("-: ") for c in cells):
                continue  # separator
            rows.append(cells)
        if rows:
            blocks.append(("table", rows))
        table_buf = []

    for raw in lines:
        line = raw.rstrip("\n")

        if line.strip().startswith("```"):
            flush_table()
            if not in_code:
                in_code = True
                code_buf = []
            else:
                in_code = False
                blocks.append(("code", "\n".join(code_buf)))
            continue

        if in_code:
            code_buf.append(line)
            continue

        if line.strip().startswith("|") and "|" in line.strip()[1:]:
            table_buf.append(line)
            continue
        else:
            flush_table()

        if not line.strip():
            blocks.append(("blank", ""))
            continue
        if line.strip() == "---":
            blocks.append(("hr", ""))
            continue
        if line.startswith("#### "):
            blocks.append(("h4", line[5:].strip()))
        elif line.startswith("### "):
            blocks.append(("h3", line[4:].strip()))
        elif line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("> "):
            blocks.append(("quote", line[2:].strip()))
        elif line.startswith("- ") or line.startswith("* "):
            blocks.append(("li", line[2:].strip()))
        elif len(line) >= 3 and line[0].isdigit() and ". " in line[:4]:
            blocks.append(("ol", line.split(". ", 1)[1].strip()))
        else:
            blocks.append(("p", line.strip()))

    flush_table()
    return blocks


def make_styles():
    styles = getSampleStyleSheet()
    return {
        "cover_title": ParagraphStyle(
            "CoverTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            spaceAfter=12,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=14,
            leading=18,
            spaceAfter=8,
        ),
        "section": ParagraphStyle(
            "Section",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            spaceBefore=4,
            spaceAfter=12,
            textColor=colors.HexColor("#1a1a1a"),
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=19,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "H3",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=14,
            spaceBefore=8,
            spaceAfter=4,
        ),
        "h4": ParagraphStyle(
            "H4",
            parent=styles["Heading4"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=13,
            spaceBefore=6,
            spaceAfter=3,
        ),
        "p": ParagraphStyle(
            "P",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=13.5,
            spaceAfter=4,
        ),
        "li": ParagraphStyle(
            "LI",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=10,
            leading=13.5,
            leftIndent=14,
            bulletIndent=4,
            spaceAfter=2,
        ),
        "quote": ParagraphStyle(
            "Quote",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique",
            fontSize=9.5,
            leading=13,
            leftIndent=12,
            textColor=colors.HexColor("#333333"),
            spaceAfter=6,
        ),
        "code": ParagraphStyle(
            "CODE",
            parent=styles["BodyText"],
            fontName="Courier",
            fontSize=8.5,
            leading=10.5,
            leftIndent=6,
            backColor=colors.HexColor("#f4f4f4"),
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=colors.grey,
        ),
    }


def blocks_to_flowables(blocks, styles):
    story = []
    for typ, txt in blocks:
        if typ == "blank":
            story.append(Spacer(1, 4))
        elif typ == "hr":
            story.append(Spacer(1, 6))
        elif typ == "h1":
            story.append(Paragraph(inline_md(txt), styles["h1"]))
        elif typ == "h2":
            story.append(Paragraph(inline_md(txt), styles["h2"]))
        elif typ == "h3":
            story.append(Paragraph(inline_md(txt), styles["h3"]))
        elif typ == "h4":
            story.append(Paragraph(inline_md(txt), styles["h4"]))
        elif typ == "li":
            story.append(Paragraph(inline_md(txt), styles["li"], bulletText="•"))
        elif typ == "ol":
            story.append(Paragraph(inline_md(txt), styles["li"], bulletText="–"))
        elif typ == "quote":
            story.append(Paragraph(inline_md(txt), styles["quote"]))
        elif typ == "code":
            story.append(Preformatted(txt, styles["code"]))
            story.append(Spacer(1, 4))
        elif typ == "table":
            rows = txt
            data = [
                [Paragraph(inline_md(c), styles["cell"]) for c in row]
                for row in rows
            ]
            col_count = max(len(r) for r in data) if data else 1
            usable = A4[0] - 4 * cm
            col_w = usable / col_count
            t = Table(data, colWidths=[col_w] * col_count, repeatRows=1)
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8e8e8")),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#aaaaaa")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        (
                            "ROWBACKGROUNDS",
                            (0, 1),
                            (-1, -1),
                            [colors.white, colors.HexColor("#fafafa")],
                        ),
                    ]
                )
            )
            story.append(KeepTogether([t, Spacer(1, 8)]))
        else:
            story.append(Paragraph(inline_md(txt), styles["p"]))
    return story


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawString(2 * cm, 1.2 * cm, "SmartSignage Player-AD — Manual completo")
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"{doc.page}")
    canvas.restoreState()


def build_cover(styles, section_titles: list[str]):
    story = [
        Spacer(1, 2.5 * cm),
        Paragraph("SmartSignage Player-AD", styles["cover_title"]),
        Paragraph("Manual completo", styles["cover_sub"]),
        Paragraph(
            "Instalação, configuração, operação, arquitetura e troubleshooting",
            styles["p"],
        ),
        Spacer(1, 0.6 * cm),
        Paragraph(f"Data: {date.today().isoformat()}", styles["p"]),
        Paragraph("Versão de referência do app: 1.67", styles["p"]),
        Spacer(1, 1.2 * cm),
        Paragraph("Índice", styles["h2"]),
    ]
    for title in section_titles:
        story.append(Paragraph(inline_md(title), styles["li"], bulletText="•"))
    story.append(Spacer(1, 2 * cm))
    story.append(
        Paragraph(
            "Documento gerado automaticamente a partir dos ficheiros Markdown do repositório.",
            styles["quote"],
        )
    )
    story.append(PageBreak())
    return story


def build_story(styles):
    story = build_cover(styles, [title for title, _ in SECTIONS])

    for i, (title, path) in enumerate(SECTIONS):
        if i > 0:
            story.append(PageBreak())
        story.append(Paragraph(esc(title), styles["section"]))
        story.append(
            Paragraph(
                f'<font color="#666666" size="8">Fonte: {esc(path.name)}</font>',
                styles["p"],
            )
        )
        story.append(Spacer(1, 8))
        lines = path.read_text(encoding="utf-8").splitlines()
        blocks = parse_markdown(lines)
        story.extend(blocks_to_flowables(blocks, styles))
    return story


def main() -> None:
    styles = make_styles()
    missing = [str(p) for _, p in SECTIONS if not p.exists()]
    if missing:
        raise FileNotFoundError("Ficheiros em falta:\n" + "\n".join(missing))

    primary = PLAYER_DOCS / OUT_NAME
    primary.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(primary),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title="Player-AD — Manual completo",
        author="SmartSignage / Totem Digital",
    )
    doc.build(build_story(styles), onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"PDF gerado: {primary} ({primary.stat().st_size} bytes)")

    secondary = PENDRIVE_DOCS / OUT_NAME
    secondary.parent.mkdir(parents=True, exist_ok=True)
    import shutil

    shutil.copy2(primary, secondary)
    print(f"PDF copiado: {secondary} ({secondary.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
