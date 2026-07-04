# Hardware — Totem Digital / TV box

Índice da documentação de hardware e operação de totem.

---

## Documentos operacionais (prontos)

| Documento | Markdown | PDF |
|-----------|----------|-----|
| Manual operacional TV box | [MANUAL-OPERACIONAL-TVBOX.md](../../Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md) | [MANUAL-OPERACIONAL-TVBOX.pdf](./MANUAL-OPERACIONAL-TVBOX.pdf) |
| Ficha TV_BOX_3 | [TV_BOX_3-SPEC.md](./TV_BOX_3-SPEC.md) | [TV_BOX_3-SPEC.pdf](./TV_BOX_3-SPEC.pdf) |
| SoC boot paths | [SOC-BOOT-PATHS.md](./SOC-BOOT-PATHS.md) | [SOC-BOOT-PATHS.pdf](./SOC-BOOT-PATHS.pdf) |
| Importação Brasil | [IMPORTACAO-BRASIL.md](./IMPORTACAO-BRASIL.md) | [IMPORTACAO-BRASIL.pdf](./IMPORTACAO-BRASIL.pdf) |
| 1-pager executivo | [1-PAGER-EXECUTIVO.md](./1-PAGER-EXECUTIVO.md) | [1-PAGER-EXECUTIVO.pdf](./1-PAGER-EXECUTIVO.pdf) |
| Status projeto | [STATUS-PROJETO-TVBOX.md](./STATUS-PROJETO-TVBOX.md) | (incluído no PDF completo) |
| Spec ODM v1 | [TOTEM-ODM-SPEC-v1.md](./TOTEM-ODM-SPEC-v1.md) | [TOTEM-ODM-SPEC-v1.pdf](./TOTEM-ODM-SPEC-v1.pdf) |
| E-mails outreach | [../procurement-emails/](../procurement-emails/) | 5 arquivos .txt prontos |
| **Kit completo (TUDO)** | — | **[../TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf](../TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf)** |

## Procurement (pesquisa de mercado)

| Documento | Markdown | PDF |
|-----------|----------|-----|
| Fornecedores + catálogo | [../TVBOX-PROCUREMENT-FORNECEDORES.md](../TVBOX-PROCUREMENT-FORNECEDORES.md) | [../TVBOX-PROCUREMENT-FORNECEDORES.pdf](../TVBOX-PROCUREMENT-FORNECEDORES.pdf) |
| Planilha comparativa | [../TVBOX-PROCUREMENT-COMPARISON.csv](../TVBOX-PROCUREMENT-COMPARISON.csv) | — |

### Regenerar PDFs

```powershell
python scripts/generate-hardware-docs-pdf.py
```

Um único Markdown → PDF:

```powershell
python scripts/md_to_pdf.py Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md -o docs/hardware/MANUAL-OPERACIONAL-TVBOX.pdf
```

## Player-AD (desenvolvimento)

| Documento | Conteúdo |
|-----------|----------|
| [../Player-AD/docs/MANUAL-ARQUITETURA-DESENVOLVIMENTO.md](../Player-AD/docs/MANUAL-ARQUITETURA-DESENVOLVIMENTO.md) | Arquitetura código |
| [../Player-AD/scripts/](../Player-AD/scripts/) | Scripts install, boot, diagnóstico |

---

## Plano de documentação

| # | Item | Status |
|---|------|--------|
| 2 | Spec ODM + SoC boot + manual operacional | **Feito** |
| 3 | Manual arquitetura (boot, mídia v1.33) | **Feito** |
| 4 | Índice hardware | **Feito** |
| 5 | Importação BR / custo landed | **Feito** — [IMPORTACAO-BRASIL.md](./IMPORTACAO-BRASIL.md) |
| 6 | PDF / 1-pager executivo | **Feito** |
| 1 | Cotações / amostras | E-mails prontos: [procurement-emails/](../procurement-emails/) |

---

## Fluxo operacional (sem procurement)

```
install-player-adb.ps1 → config portrait → boot custom → Player-AD em produção
                              ↓
              MANUAL-OPERACIONAL-TVBOX.md (troubleshooting)
```

## Fluxo procurement (quando retomar etapa 1)

```
CSV + guia → e-mail fornecedor → amostra → install-player-adb.ps1 → decisão lote
```
