#!/usr/bin/env python3
"""
Gera PDFs da documentação hardware / operacional Totem Digital.

PDF único completo: docs/TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf
"""

from __future__ import annotations

import csv
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from md_to_pdf import md_to_pdf

REPO = Path(__file__).resolve().parents[1]

COMPLETE_DOC_SECTIONS: list[tuple[Path, str]] = [
    (REPO / "docs" / "hardware" / "1-PAGER-EXECUTIVO.md", "1-pager executivo"),
    (REPO / "docs" / "hardware" / "STATUS-PROJETO-TVBOX.md", "Status do projeto"),
    (REPO / "docs" / "hardware" / "README.md", "Índice e estrutura da documentação"),
    (REPO / "Player-AD" / "docs" / "MANUAL-OPERACIONAL-TVBOX.md", "Player-AD — Manual operacional TV box"),
    (REPO / "docs" / "hardware" / "TV_BOX_3-SPEC.md", "Ficha técnica — TV_BOX_3 (referência)"),
    (REPO / "docs" / "hardware" / "SOC-BOOT-PATHS.md", "SoC — caminhos de boot (logo + animation)"),
    (REPO / "docs" / "hardware" / "TOTEM-ODM-SPEC-v1.md", "Spec ODM v1 — requisitos para fornecedor"),
    (REPO / "docs" / "hardware" / "IMPORTACAO-BRASIL.md", "Importação Brasil — guia rápido"),
    (REPO / "docs" / "TVBOX-PROCUREMENT-FORNECEDORES.md", "Procurement — catálogo, contatos e protocolo"),
]

COMPLETE_PDF = REPO / "docs" / "TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf"
CSV_PATH = REPO / "docs" / "TVBOX-PROCUREMENT-COMPARISON.csv"
LEGACY_KIT_PDF = REPO / "docs" / "hardware" / "TOTEM-DIGITAL-HARDWARE-KIT.pdf"
PAGER_PDF = REPO / "docs" / "hardware" / "1-PAGER-EXECUTIVO.pdf"

INDIVIDUAL_DOCS = [
    (REPO / "docs" / "hardware" / "1-PAGER-EXECUTIVO.md", PAGER_PDF, "Totem Digital — 1-pager"),
    (REPO / "Player-AD" / "docs" / "MANUAL-OPERACIONAL-TVBOX.md", REPO / "docs" / "hardware" / "MANUAL-OPERACIONAL-TVBOX.pdf", "Manual Operacional TV Box"),
    (REPO / "docs" / "hardware" / "TOTEM-ODM-SPEC-v1.md", REPO / "docs" / "hardware" / "TOTEM-ODM-SPEC-v1.pdf", "Spec ODM v1"),
    (REPO / "docs" / "hardware" / "SOC-BOOT-PATHS.md", REPO / "docs" / "hardware" / "SOC-BOOT-PATHS.pdf", "SoC Boot Paths"),
    (REPO / "docs" / "hardware" / "TV_BOX_3-SPEC.md", REPO / "docs" / "hardware" / "TV_BOX_3-SPEC.pdf", "Ficha TV_BOX_3"),
    (REPO / "docs" / "hardware" / "IMPORTACAO-BRASIL.md", REPO / "docs" / "hardware" / "IMPORTACAO-BRASIL.pdf", "Importação Brasil"),
    (REPO / "docs" / "TVBOX-PROCUREMENT-FORNECEDORES.md", REPO / "docs" / "TVBOX-PROCUREMENT-FORNECEDORES.pdf", "Procurement Fornecedores"),
]


def csv_to_markdown_table(csv_path: Path) -> str:
    if not csv_path.is_file():
        return "*Planilha CSV não encontrada.*\n"
    with csv_path.open(encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f, delimiter=";"))
    if not rows:
        return "*Planilha vazia.*\n"
    header, *body = rows
    key_names = [
        "Modelo", "Fornecedor", "SoC", "Android", "RAM GB", "Ethernet",
        "Score est.", "Prioridade", "Status Player-AD",
    ]
    indices = [header.index(n) for n in key_names if n in header]
    lines = [
        "# Anexo — Planilha comparativa TV box (resumo)\n",
        f"\n*Planilha completa: `{csv_path.relative_to(REPO).as_posix()}`*\n\n",
        "| " + " | ".join(key_names) + " |",
        "| " + " | ".join("---" for _ in key_names) + " |",
    ]
    for row in body:
        cells = []
        for i in indices:
            val = row[i] if i < len(row) else ""
            cells.append(val.replace("|", "/")[:40])
        lines.append("| " + " | ".join(cells) + " |")
    emails_dir = REPO / "docs" / "procurement-emails"
    if emails_dir.is_dir():
        lines.append("\n\n## E-mails preparados\n\n")
        for f in sorted(emails_dir.glob("*.txt")):
            lines.append(f"- `{f.relative_to(REPO).as_posix()}`\n")
    return "\n".join(lines) + "\n"


def build_structure_overview() -> str:
    return f"""
# Totem Digital — Documentação completa (TV box / Player-AD)

**Gerado em:** {date.today().isoformat()}  
**PDF único:** `docs/TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf`

---

## Estrutura de arquivos

```
docs/
├── TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf
├── TVBOX-PROCUREMENT-FORNECEDORES.md
├── TVBOX-PROCUREMENT-COMPARISON.csv
├── procurement-emails/          (5 e-mails prontos)
└── hardware/
    ├── README.md
    ├── STATUS-PROJETO-TVBOX.md
    ├── 1-PAGER-EXECUTIVO.md
    ├── IMPORTACAO-BRASIL.md
    ├── TV_BOX_3-SPEC.md
    ├── SOC-BOOT-PATHS.md
    └── TOTEM-ODM-SPEC-v1.md
Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md
scripts/generate-hardware-docs-pdf.py
scripts/collect-tvbox-spec-adb.ps1
```

---

"""


def build_complete_pdf(output: Path) -> None:
    parts: list[str] = [build_structure_overview()]
    for md_path, title in COMPLETE_DOC_SECTIONS:
        if not md_path.is_file():
            continue
        parts.append(f"\n\n# {title}\n\n*Fonte: `{md_path.relative_to(REPO).as_posix()}`*\n\n---\n\n")
        parts.append(md_path.read_text(encoding="utf-8"))
        parts.append("\n\n---\n\n")
    parts.append(csv_to_markdown_table(CSV_PATH))
    merged = REPO / "docs" / "hardware" / ".documentacao-completa-merge.md"
    merged.write_text("".join(parts), encoding="utf-8")
    try:
        md_to_pdf(merged, output, title="Totem Digital Documentacao Completa")
        print(f"OK {output}")
        md_to_pdf(merged, LEGACY_KIT_PDF, title="Totem Digital Hardware Kit")
        print(f"OK {LEGACY_KIT_PDF}")
    finally:
        if merged.exists():
            merged.unlink()


def main() -> None:
    for md_path, pdf_path, title in INDIVIDUAL_DOCS:
        if not md_path.is_file():
            print(f"SKIP: {md_path}")
            continue
        md_to_pdf(md_path, pdf_path, title=title)
        print(f"OK {pdf_path}")
    build_complete_pdf(COMPLETE_PDF)


if __name__ == "__main__":
    main()
