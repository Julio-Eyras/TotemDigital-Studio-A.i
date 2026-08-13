#!/usr/bin/env python3
"""
Copyright (c) 2026 Julio Cesar Eyras (J.C.E.)
Eyras Sistemas e Soluções — Todos os direitos reservados.

Gera PDFs dos manuais de telas (Markdown + imagens PNG).
  python scripts/generate-telas-pdf.py
"""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
)

ROOT = Path(__file__).resolve().parent.parent
TELAS = ROOT / "docs" / "manuais" / "telas"
IMG_DIR = TELAS / "imagens"

MANUALS = [
    ("08-TELAS-LOGIN-E-PUBLICAR.md", "08-TELAS-LOGIN-E-PUBLICAR.pdf", "Login e Publicar em Totem"),
    ("09-TELAS-BIBLIOTECA-ORG-USUARIOS.md", "09-TELAS-BIBLIOTECA-ORG-USUARIOS.pdf", "Biblioteca, Org, Usuários"),
    ("10-TELAS-DISPATCHER.md", "10-TELAS-DISPATCHER.pdf", "Dispatcher"),
    ("11-TELAS-CONFIGURACOES.md", "11-TELAS-CONFIGURACOES.pdf", "Configurações do sistema"),
]


def esc(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def parse_md(lines: list[str]):
    blocks = []
    in_code = False
    code_buf: list[str] = []
    for raw in lines:
        line = raw.rstrip("\n")
        if line.strip().startswith("```"):
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
        if not line.strip():
            blocks.append(("blank", ""))
            continue
        if line.startswith("!["):
            # ![alt](imagens/NN.png)
            start = line.find("(")
            end = line.find(")", start)
            rel = line[start + 1 : end] if start >= 0 and end > start else ""
            blocks.append(("img", rel))
            continue
        if line.startswith("|") and "---" not in line:
            blocks.append(("tr", line.strip()))
            continue
        if line.startswith("|"):
            blocks.append(("skip", ""))
            continue
        if line.startswith("### "):
            blocks.append(("h3", line[4:].strip()))
        elif line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("- "):
            blocks.append(("li", line[2:].strip()))
        elif len(line) > 2 and line[0].isdigit() and line[1:3] in (". ", ") "):
            blocks.append(("ol", line.split(" ", 1)[-1].strip()))
        else:
            blocks.append(("p", line.strip()))
    return blocks


def table_row_html(line: str) -> str:
    cells = [c.strip() for c in line.strip("|").split("|")]
    return " · ".join(esc(c) for c in cells if c)


def build_pdf(md_name: str, pdf_name: str, title: str) -> None:
    md_path = TELAS / md_name
    pdf_path = TELAS / pdf_name
    blocks = parse_md(md_path.read_text(encoding="utf-8").splitlines())

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=1.6 * cm,
        leftMargin=1.6 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
        title=title,
        author="Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1t", parent=styles["Heading1"], fontSize=16, leading=20, spaceAfter=8)
    h2 = ParagraphStyle("H2t", parent=styles["Heading2"], fontSize=13, leading=16, spaceBefore=10, spaceAfter=5)
    h3 = ParagraphStyle("H3t", parent=styles["Heading3"], fontSize=11, leading=14, spaceBefore=6, spaceAfter=3)
    p = ParagraphStyle("Pt", parent=styles["BodyText"], fontSize=9.5, leading=13, spaceAfter=3)
    li = ParagraphStyle("LIt", parent=p, leftIndent=12)
    tr = ParagraphStyle("TRt", parent=p, fontSize=8.5, leading=11, leftIndent=4)

    story = []
    max_w = A4[0] - 3.2 * cm
    max_h = 11 * cm

    for kind, val in blocks:
        if kind == "blank":
            story.append(Spacer(1, 4))
        elif kind == "h1":
            story.append(Paragraph(esc(val), h1))
        elif kind == "h2":
            story.append(Paragraph(esc(val), h2))
        elif kind == "h3":
            story.append(Paragraph(esc(val), h3))
        elif kind == "p":
            story.append(Paragraph(esc(val), p))
        elif kind == "li":
            story.append(Paragraph("• " + esc(val), li))
        elif kind == "ol":
            story.append(Paragraph(esc(val), li))
        elif kind == "tr":
            story.append(Paragraph(table_row_html(val), tr))
        elif kind == "code":
            story.append(Preformatted(val, p))
        elif kind == "img":
            img_path = TELAS / val.replace("\\", "/")
            if not img_path.exists():
                story.append(Paragraph(f"[imagem em falta: {esc(val)}]", p))
                continue
            img = Image(str(img_path))
            iw, ih = img.imageWidth, img.imageHeight
            scale = min(max_w / iw, max_h / ih, 1.0)
            img.drawWidth = iw * scale
            img.drawHeight = ih * scale
            story.append(Spacer(1, 6))
            story.append(img)
            story.append(Spacer(1, 8))
        elif kind == "skip":
            continue

    story.append(PageBreak())
    story.append(
        Paragraph(
            "© 2026 Julio Cesar Eyras (J.C.E.) — Eyras Sistemas e Soluções. Todos os direitos reservados.",
            p,
        )
    )
    doc.build(story)
    print(f"OK {pdf_path.relative_to(ROOT)}")


def main() -> None:
    for md, pdf, title in MANUALS:
        build_pdf(md, pdf, title)


if __name__ == "__main__":
    main()
