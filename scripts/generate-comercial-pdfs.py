#!/usr/bin/env python3
"""
Copyright (c) 2026 Julio Cesar Eyras (J.C.E.)
Eyras Sistemas e Soluções — Todos os direitos reservados.

Gera PDFs dos documentos comerciais:
  python scripts/generate-comercial-pdfs.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from md_to_pdf import md_to_pdf

REPO = Path(__file__).resolve().parents[1]

DOCS = [
    (
        REPO / "docs" / "AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md",
        REPO / "docs" / "AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.pdf",
        "TotemDigital Studio — Avaliação Comercial e de Produto (v1.1.3)",
    ),
    (
        REPO / "docs" / "manuais" / "06-APRESENTACAO-COMERCIAL-SAAS.md",
        REPO / "docs" / "manuais" / "06-APRESENTACAO-COMERCIAL-SAAS.pdf",
        "TotemDigital Studio — Apresentação Comercial (Software + SaaS)",
    ),
    (
        REPO / "docs" / "manuais" / "12-ROTEIRO-DEMO-15-MIN.md",
        REPO / "docs" / "manuais" / "12-ROTEIRO-DEMO-15-MIN.pdf",
        "TotemDigital Studio — Roteiro demo 15 min (Direct)",
    ),
    (
        REPO / "docs" / "DOCUMENTACAO-COMERCIAL-TECNICA.md",
        REPO / "docs" / "DOCUMENTACAO-COMERCIAL-TECNICA.pdf",
        "Smart Signage Pro — Documentação Comercial e Técnica (arquivo histórico)",
    ),
]


def main() -> None:
    for md, pdf, title in DOCS:
        if not md.is_file():
            print(f"FALTA {md}")
            continue
        md_to_pdf(md, pdf, title=title)
        print(f"OK {pdf.relative_to(REPO)} ({pdf.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
