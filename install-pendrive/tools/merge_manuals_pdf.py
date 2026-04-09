from pathlib import Path
from datetime import date

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


ROOT = Path(r"C:\SmartSignage-Pro\install-pendrive")
DOCS = ROOT / "docs"

TECH_PDF = DOCS / "MANUAL-INSTALACAO-PLAYER-AD.pdf"
USER_PDF = DOCS / "MANUAL-USUARIO-PLAYER-AD.pdf"
OUT_PDF = DOCS / "MANUAL-COMPLETO-PLAYER-AD.pdf"
COVER_PDF = DOCS / "_cover_tmp.pdf"


def make_cover(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=A4)
    w, h = A4

    c.setFont("Helvetica-Bold", 24)
    c.drawString(60, h - 110, "SmartSignage Player-AD")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(60, h - 145, "Manual Completo")

    c.setFont("Helvetica", 12)
    c.drawString(60, h - 190, f"Data: {date.today().isoformat()}")

    c.setFont("Helvetica-Bold", 14)
    c.drawString(60, h - 240, "Indice")
    c.setFont("Helvetica", 12)
    c.drawString(80, h - 270, "1. Manual tecnico de instalacao (ADB + Pendrive)")
    c.drawString(80, h - 292, "2. Manual do utilizador final")

    c.setFont("Helvetica-Oblique", 10)
    c.drawString(60, 60, "Arquivo gerado automaticamente.")
    c.showPage()
    c.save()


def append_pdf(writer: PdfWriter, pdf_path: Path) -> None:
    reader = PdfReader(str(pdf_path))
    for page in reader.pages:
        writer.add_page(page)


def main() -> None:
    if not TECH_PDF.exists():
        raise FileNotFoundError(f"Nao encontrado: {TECH_PDF}")
    if not USER_PDF.exists():
        raise FileNotFoundError(f"Nao encontrado: {USER_PDF}")

    make_cover(COVER_PDF)

    writer = PdfWriter()
    append_pdf(writer, COVER_PDF)
    append_pdf(writer, TECH_PDF)
    append_pdf(writer, USER_PDF)

    with OUT_PDF.open("wb") as f:
        writer.write(f)

    try:
        COVER_PDF.unlink(missing_ok=True)
    except Exception:
        pass

    print(f"PDF combinado gerado: {OUT_PDF}")


if __name__ == "__main__":
    main()
