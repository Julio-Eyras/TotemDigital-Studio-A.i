from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Preformatted


ROOT = Path(r"C:\SmartSignage-Pro\Player-WOS")
md_path = ROOT / "docs" / "MANUAL-INSTALACAO-LG-WEBOS.md"
pdf_path = ROOT / "docs" / "MANUAL-INSTALACAO-LG-WEBOS.pdf"


def parse_markdown(lines):
    blocks = []
    in_code = False
    code_buf = []
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
        if line.startswith("## "):
            blocks.append(("h2", line[3:].strip()))
        elif line.startswith("# "):
            blocks.append(("h1", line[2:].strip()))
        elif line.startswith("- "):
            blocks.append(("li", line[2:].strip()))
        elif len(line) > 3 and line[0].isdigit() and line[1:3] == ") ":
            blocks.append(("ol", line[3:].strip()))
        else:
            blocks.append(("p", line.strip()))
    return blocks


def esc(text):
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def main():
    blocks = parse_markdown(md_path.read_text(encoding="utf-8").splitlines())
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=1.8 * cm,
        title="Manual Instalacao LG webOS - Player-WOS",
        author="SmartSignage",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=18, leading=22, spaceAfter=10)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13.5, leading=17, spaceBefore=8, spaceAfter=5)
    p = ParagraphStyle("P", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=14, spaceAfter=4)
    li = ParagraphStyle("LI", parent=p, leftIndent=14, bulletIndent=4)
    code = ParagraphStyle("CODE", parent=p, fontName="Courier", fontSize=9.2, leading=11.2, leftIndent=8)

    story = []
    for typ, txt in blocks:
        if typ == "blank":
            story.append(Spacer(1, 5))
        elif typ == "h1":
            story.append(Paragraph(esc(txt), h1))
        elif typ == "h2":
            story.append(Paragraph(esc(txt), h2))
        elif typ == "li":
            story.append(Paragraph(esc(txt), li, bulletText="•"))
        elif typ == "ol":
            story.append(Paragraph(esc(txt), li, bulletText="1."))
        elif typ == "code":
            story.append(Preformatted(txt, code))
            story.append(Spacer(1, 4))
        else:
            story.append(Paragraph(esc(txt), p))

    doc.build(story)
    print(f"PDF gerado: {pdf_path}")


if __name__ == "__main__":
    main()
