#!/usr/bin/env python3
"""Gera PDF da documentação Publish Board, HTML5, UX e IA — TotemDigital."""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "CONVERSA_PUBLISH_BOARD_IA_ANALISE_2026-06.pdf"


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "DocTitle",
            parent=base["Title"],
            fontSize=17,
            leading=21,
            alignment=TA_CENTER,
            spaceAfter=8,
            textColor=colors.HexColor("#1a237e"),
        ),
        "subtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            spaceAfter=14,
            textColor=colors.HexColor("#455a64"),
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontSize=12,
            leading=15,
            spaceBefore=10,
            spaceAfter=5,
            textColor=colors.HexColor("#1565c0"),
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontSize=10,
            leading=13,
            spaceBefore=6,
            spaceAfter=3,
            textColor=colors.HexColor("#283593"),
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=8.5,
            leading=11,
            alignment=TA_JUSTIFY,
            spaceAfter=4,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontSize=8.5,
            leading=11,
            leftIndent=10,
            spaceAfter=2,
        ),
        "code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontSize=7.5,
            leading=9,
            fontName="Courier",
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["Normal"],
            fontSize=7.5,
            leading=9,
            textColor=colors.HexColor("#607d8b"),
            alignment=TA_CENTER,
        ),
    }


def tbl(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eaf6")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#283593")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#b0bec5")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    return t


def bullets(st, items):
    return [Paragraph(f"• {item}", st["bullet"]) for item in items]


def build_story(st):
    story = []
    today = date.today().strftime("%d/%m/%Y")

    story.append(Paragraph("Publish Board, HTML5, UX e Integração IA", st["title"]))
    story.append(
        Paragraph(
            "TotemDigital / Smart Signage Studio<br/>"
            f"Documentação da conversa e análise conceptual — {today}<br/>"
            "Branch: Smart-Signage-Studio-Vx5 · Commit: bf0b80d (+ hotfix file_size_bytes)",
            st["subtitle"],
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#90caf9")))
    story.append(Spacer(1, 0.25 * cm))

    story.append(Paragraph("1. Resumo executivo", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "Rotação de vídeo painel ↔ servidor ↔ totem: contrato fechado e validado.",
                "UX: previews menores, modo Criar ao editar HTML, thumbs 9:16, metadados nos cards.",
                "HTML totem: rotação +90° e tipografia maior no ficheiro de entrega (sem novo APK).",
                "Republicar HTML substitui mídia existente (replaceMediaId / deteção por nome/tags).",
                "Análise IA: Llama local ou providers do sistema preenchem JSON de layout, não HTML livre.",
            ],
        )
    )
    story.append(Spacer(1, 0.25 * cm))

    story.append(Paragraph("2. Alterações implementadas (bf0b80d)", st["h1"]))
    story.append(Paragraph("2.1 Backend", st["h2"]))
    story.append(
        tbl(
            [
                ["Componente", "Alteração"],
                ["publishBoardHtmlRuntime", "font-size base; rotação +90° entrega totem"],
                ["publishBoardHtmlRenderService", "Tipografia maior; forTotemDelivery"],
                ["publishBoardService", "Thumb HTML; substituir mídia em vez de duplicar"],
                ["mediaService", "replaceMediaFileContent; thumb HTML on-demand"],
                ["auto-publish", "Parâmetro replaceMediaId"],
            ],
            col_widths=[5 * cm, 12 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("2.2 Frontend", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "Subscribers: botão Editar conteúdo (publish-board HTML) → mode=create",
                "QuickPublish: previews ~50%; iframe HTML; preserva mode=create na URL",
                "MediaViewDialog: preview-html; metadados consolidados",
                "publishBoardMedia.ts: utilitários preset/tags/URL",
            ],
        )
    )
    story.append(Spacer(1, 0.25 * cm))

    story.append(Paragraph("3. Armazenamento e cache", st["h1"]))
    story.append(Paragraph("3.1 Servidor", st["h2"]))
    story.append(
        Paragraph(
            "Raiz: /opt/smart-signage/public/assets/uploads (ou media.storage.path). "
            "Mídias: subscriber-{ID}/medias/. Thumb HTML: mesmo nome com sufixo _thumb.jpg (360×640).",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "/opt/.../subscriber-12/medias/Cardapio — Cardapio Digital (HTML).html<br/>"
            "/opt/.../subscriber-12/medias/Cardapio — Cardapio Digital (HTML)_thumb.jpg",
            st["code"],
        )
    )
    story.append(Paragraph("3.2 Totem (Player-AD)", st["h2"]))
    story.append(
        Paragraph(
            "Cache local: {storage_player}/propagandas/ + metadata.json. "
            "HTML descarregado do servidor; WebView reproduz sem thumb. "
            "Player-AD v1.66 não precisa reinstalar para alterações HTML do servidor.",
            st["body"],
        )
    )
    story.append(Spacer(1, 0.25 * cm))

    story.append(Paragraph("4. Fluxo de edição (anunciante)", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "Editar Anunciante → Mídias → mídia HTML (tags publish-board + menu)",
                "Botão estrela: Editar conteúdo → /quick-publish?mode=create&preset=...",
                "Lápis: apenas nome, descrição, tags",
                "Gerar e publicar agora: substitui ficheiro e mantém media_id quando possível",
            ],
        )
    )
    story.append(Spacer(1, 0.25 * cm))

    story.append(PageBreak())
    story.append(Paragraph("5. Problemas identificados e correções", st["h1"]))
    story.append(
        tbl(
            [
                ["Erro", "Causa", "Correção"],
                [
                    "Nome de mídia já existe",
                    "createMedia em cada republicação",
                    "replaceMediaFileContent + deteção (bf0b80d)",
                ],
                [
                    'column "size_bytes" does not exist',
                    "UPDATE usava size_bytes",
                    "Hotfix: file_size_bytes (schema v2)",
                ],
                [
                    "ECONNREFUSED ::1:11434",
                    "Ollama não a correr",
                    "ollama serve; AI_OLLAMA_BASE_URL; useAi=false",
                ],
            ],
            col_widths=[4.2 * cm, 5.5 * cm, 7.3 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("6. Análise IA — arquitetura recomendada", st["h1"]))
    story.append(
        Paragraph(
            "<b>Princípio:</b> A IA autora briefs estruturados (JSON); o sistema autora o HTML de entrega "
            "(templates publishBoardHtmlRenderService). Evita HTML livre no totem (rotação, offline, XSS).",
            st["body"],
        )
    )
    story.append(Paragraph("6.1 Estado atual", st["h2"]))
    story.append(
        Paragraph(
            "publishBriefAiService.suggestCopy preenche campos de texto via AIService (Ollama/OpenAI/Anthropic). "
            "Layout em publish_board_layouts. Render fixo gera .html com forTotemDelivery.",
            st["body"],
        )
    )
    story.append(Paragraph("6.2 Caminhos avaliados", st["h2"]))
    story.append(
        tbl(
            [
                ["Caminho", "Descrição", "Recomendação"],
                ["A — Layout JSON", "IA devolve PublishBoardLayout", "Núcleo v1"],
                ["B — HTML livre", "IA gera HTML completo", "Só sandbox"],
                ["C — Híbrido", "Brief NL → JSON → render → revisão cloud", "Visão produto"],
            ],
            col_widths=[3.2 * cm, 7.5 * cm, 6.3 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("6.3 Llama local vs cloud", st["h2"]))
    story.append(
        tbl(
            [
                ["Critério", "Ollama/Llama", "OpenAI/Anthropic"],
                ["Privacidade", "Alta (servidor local)", "DPA/contrato"],
                ["Copy curto PT-BR", "llama3.2:3b–8b OK", "Excelente"],
                ["JSON estruturado", "Prompt + validação + retry", "Mais estável"],
            ],
            col_widths=[4 * cm, 6.5 * cm, 6.5 * cm],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("6.4 Exemplo conceptual (brief → JSON)", st["h2"]))
    story.append(
        Paragraph(
            'Brief: "Comunicado check-up idosos, tom acolhedor, vertical, terças 14h."<br/>'
            'IA responde JSON: preset=announcement, portrait, content.headline/message/eventInfo. '
            "Nunca HTML bruto para o totem.",
            st["body"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("6.5 Roadmap sugerido", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "Fase 1: Brief NL → layout JSON completo (Ollama)",
                "Fase 2: Provider/modelo IA nas Settings admin",
                "Fase 3: RAG cardápio + marca no prompt",
                "Fase 4: Variantes A/B de copy na UI",
                "Fase 5: Chat de refinamento",
                "Fase 6: HTML custom experimental (opcional)",
            ],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("7. Deploy e operação", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "Servidor: git pull && bash scripts/fix-upload-502-server.sh",
                "Republicar HTML no painel para aplicar rotação/fontes no totem",
                "Totem atualiza cache na próxima descarga da playlist",
                "IA: configurar Ollama ou desmarcar 'Usar IA' ao publicar",
            ],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("8. Ficheiros-chave", st["h1"]))
    story.append(
        tbl(
            [
                ["Área", "Ficheiros"],
                ["Render HTML", "publishBoardHtmlRenderService.ts, publishBoardHtmlRuntime.ts"],
                ["Publish/IA", "publishBoardService.ts, publishBriefAiService.ts, aiService.ts"],
                ["UI", "CreatePublishPanel.tsx, QuickPublish.tsx, Subscribers.tsx"],
                ["Player", "HtmlWebViewPlayback.kt, MediaCacheManager.kt"],
                ["Schema", "publish_board_layouts; medias.file_size_bytes"],
            ],
            col_widths=[3.5 * cm, 13.5 * cm],
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cfd8dc")))
    story.append(
        Paragraph(
            f"TotemDigital — gerado em {today}<br/>"
            "Markdown: docs/CONVERSA_PUBLISH_BOARD_IA_ANALISE_2026-06.md",
            st["small"],
        )
    )
    return story


def main():
    st = build_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=1.7 * cm,
        rightMargin=1.7 * cm,
        topMargin=1.4 * cm,
        bottomMargin=1.4 * cm,
        title="Publish Board HTML5 UX IA — TotemDigital",
        author="TotemDigital",
    )
    doc.build(build_story(st))
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    main()
