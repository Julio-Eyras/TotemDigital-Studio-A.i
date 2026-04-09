from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer


DOCS = Path(r"C:\SmartSignage-Pro\Player-AD\docs")
md_path = DOCS / "RESUMO-EXECUTIVO-PLAYER-AD.md"
pdf_path = DOCS / "RESUMO-EXECUTIVO-PLAYER-AD.pdf"


def parse_markdown(lines):
    blocks = []
    for raw in lines:
        line = raw.rstrip("\n")
        if not line.strip():
            blocks.append(("blank", ""))
            continue
        if line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("- "):
            blocks.append(("li", line[2:].strip()))
        else:
            blocks.append(("p", line.strip()))
    return blocks


def esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main():
    blocks = parse_markdown(md_path.read_text(encoding="utf-8").splitlines())
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title="Resumo Executivo Player-AD",
        author="SmartSignage",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, spaceAfter=10)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=16, spaceBefore=8, spaceAfter=5)
    p = ParagraphStyle("P", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=13.5, spaceAfter=4)
    li = ParagraphStyle("LI", parent=p, leftIndent=14, bulletIndent=4)

    story = []
    for typ, txt in blocks:
        if typ == "blank":
            story.append(Spacer(1, 4))
        elif typ == "h1":
            story.append(Paragraph(esc(txt), h1))
        elif typ == "h2":
            story.append(Paragraph(esc(txt), h2))
        elif typ == "li":
            story.append(Paragraph(esc(txt), li, bulletText="•"))
        else:
            story.append(Paragraph(esc(txt), p))

    doc.build(story)
    print(f"PDF gerado: {pdf_path}")


if __name__ == "__main__":
    main()
