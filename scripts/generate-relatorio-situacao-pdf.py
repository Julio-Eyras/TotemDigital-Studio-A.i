#!/usr/bin/env python3
"""Gera PDF do relatório de situação funcional — TotemDigital / Smart Signage Studio."""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "RELATORIO_SITUACAO_FUNCIONALIDADES_2026-06.pdf"


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "DocTitle",
            parent=base["Title"],
            fontSize=18,
            leading=22,
            alignment=TA_CENTER,
            spaceAfter=10,
            textColor=colors.HexColor("#1a237e"),
        ),
        "subtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base["Normal"],
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            spaceAfter=16,
            textColor=colors.HexColor("#455a64"),
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontSize=13,
            leading=16,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.HexColor("#1565c0"),
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontSize=11,
            leading=14,
            spaceBefore=8,
            spaceAfter=4,
            textColor=colors.HexColor("#283593"),
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            leftIndent=12,
            bulletIndent=0,
            spaceAfter=3,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#607d8b"),
            alignment=TA_CENTER,
        ),
    }


def table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e3f2fd")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1565c0")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#b0bec5")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return t


def bullets(st, items):
    return [Paragraph(f"• {item}", st["bullet"]) for item in items]


def build_story(st):
    story = []
    today = date.today().strftime("%d/%m/%Y")

    story.append(Paragraph("Relatório de Situação", st["title"]))
    story.append(
        Paragraph(
            "TotemDigital / Smart Signage Studio<br/>"
            f"Análise de funcionalidades, mocks, incompletos e bugs — {today}",
            st["subtitle"],
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#90caf9")))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("1. Resumo executivo", st["h1"]))
    story.append(
        table(
            [
                ["Área", "Situação"],
                ["Núcleo operacional", "Funcional — anunciantes, mídias, playlists, campanhas, dispatcher, Player-AD"],
                ["Modo Studio compacto", "Perfil de produção atual (TOTEMDIGITAL_COMPACT=true)"],
                ["Modo Pro", "Código preservado; SmartDisplayFX desligado no compacto"],
                ["Players", "Player-AD Android = referência; webOS/Linux imaturos"],
                ["IA / Ondas B e C", "Backend OK; env vars não no instalador"],
                ["Testes", "Parcial (~73 testes backend); homologação campo pendente"],
                ["Documentação docs/", "Parcialmente desatualizada"],
                ["Staging", "Git à frente do servidor; deploy pendente"],
            ],
            col_widths=[4.5 * cm, 12.5 * cm],
        )
    )
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("2. Feature flags principais", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "TOTEMDIGITAL_COMPACT — UI Studio, faturamento anunciante+exibidor",
                "DISABLE_DIRECT_CAMPAIGN_TOTEM — forma 2 campanha↔totem (padrão: ativa)",
                "isStudioRuntime() / isStudioMode() — perfil single_publisher",
                "SMARTDISPLAYFX_ENABLED — false no compacto",
            ],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("3. Funcionalidades maduras (Studio)", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "CRUD anunciantes: mídias, playlists (add/reorder/duração), campanhas, contratos",
                "CampaignFullEditorDialog: contrato → rede do plano → totens",
                "Dispatcher + Playlist Mix + workers financeiros",
                "Upload mídia com ffprobe; dispatch duration:null para vídeo",
                "Player-AD v1.18 — ExoPlayer + fallback local",
                "Publicar em Tela Onda A; cardápio por cliente (código)",
                "Faturamento anunciante/exibidor (config SMTP/PIX manual)",
            ],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("4. Parcial — depende de configuração", st["h1"]))
    story.append(
        table(
            [
                ["Módulo", "O que falta"],
                ["Onda B cardápio ao vivo", "MENU_LIVE_REFRESH_SECONDS no .env"],
                ["Onda C vídeo IA", "AI_VIDEO_PROVIDER, AI_VIDEO_API_URL, AI_VIDEO_API_KEY"],
                ["Textos IA", "AI_PROVIDER configurado"],
                ["Vídeos antigos", "display_seconds=10 na BD — corrigir dados"],
                ["Campanhas", "Contrato deve estar Ativo + vigência"],
                ["Stripe / SMTP", "Config manual pós-install"],
            ],
            col_widths=[5 * cm, 12 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("5. Mock, stub ou incompleto", st["h1"]))
    story.append(
        table(
            [
                ["Módulo", "Tipo", "Detalhe"],
                ["Reconhecimento facial", "MOCK", "Primeira pessoa, confiança 0.7"],
                ["QR scans histórico", "VAZIO", "Array sempre vazio"],
                ["Backup restore", "STUB", "Sucesso falso"],
                ["totemEncryption decrypt", "STUB", "Retorna null"],
                ["AI Context gráficos", "MOCK", "Dados inventados no frontend"],
                ["Dashboard widgets", "PLACEHOLDER", "Recharts pendente"],
                ["Validação técnica dispatcher", "STUB", "Sempre válido"],
                ["webOS / Linux players", "IMATURO", "Não produção"],
                ["RFID TagReader", "NÃO IMPL.", "Hardware não suportado"],
                ["Prometheus/Grafana", "ROADMAP", "Não implementado"],
            ],
            col_widths=[4.5 * cm, 2.5 * cm, 10 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("6. Player e dispositivos", st["h1"]))
    story.append(
        table(
            [
                ["Player", "Estado", "Uso"],
                ["Player-AD", "v1.18", "Produção — TV BOX Android"],
                ["player-web", "Variável", "Depende staging"],
                ["webOS / Linux", "Experimental", "Não homologado"],
            ],
            col_widths=[4 * cm, 3 * cm, 10 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("7. Bugs e riscos operacionais", st["h1"]))
    story.append(
        table(
            [
                ["Sintoma", "Causa provável"],
                ["502 /api/*", "Backend parado ou Nginx"],
                ["Contrato vazio na campanha", "Rascunho ou fora vigência"],
                ["Sem totens na campanha", "plan_local_access incompleto"],
                ["Vídeo ~10s", "Dados antigos ou staging desatualizado"],
                ["401", "Sessão expirada"],
            ],
            col_widths=[5.5 * cm, 11.5 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("8. Testes e documentação", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "~73 ficheiros de teste backend; E2E Playwright com mocks B/C",
                "Checklist fiável: CHECKLIST_STUDIO_STAGING.md, ROTEIRO_TESTES_MANUAIS_INTEGRAIS.md",
                "Desatualizados: ESTADO_ATUAL_CRUD_ASSINANTE.md, O_QUE_FALTA_IMPLEMENTAR.md",
            ],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("9. Commits recentes (deploy pendente)", st["h1"]))
    story.append(
        table(
            [
                ["Commit", "Conteúdo"],
                ["7ca24aa", "Duração real vídeo — playlist, dispatch, ffprobe, Player-AD 1.18"],
                ["5d8464c", "Campanha: contratos rascunho visíveis, Abrir Contratos"],
                ["92db5ce", "Editor campanha completo, totens por defeito"],
            ],
            col_widths=[3 * cm, 14 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("10. Prioridades sugeridas", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "Deploy staging: bash scripts/deploy-staging-vx5.sh",
                "Homologar Publicar em Tela §11 e campanha fim-a-fim",
                "Incluir MENU_LIVE_* e AI_VIDEO_* no instalador",
                "Atualizar documentação desatualizada em docs/",
                "Corrigir vídeos legados com display_seconds=10",
            ],
        )
    )
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("11. Conclusão", st["h1"]))
    story.append(
        Paragraph(
            "O caminho principal Studio está implementado: anunciante → contrato → mídia/playlist → "
            "campanha → totens → dispatcher → Player-AD. A distância para produção formal deve-se "
            "sobretudo à homologação em campo não concluída, staging desatualizado, env vars premium "
            "ausentes no instalador, módulos satélite em mock e documentação contraditória.",
            st["body"],
        )
    )
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cfd8dc")))
    story.append(
        Paragraph(
            f"TotemDigital — branch Smart-Signage-Studio-Vx5 — gerado em {today}<br/>"
            "Versão Markdown: docs/RELATORIO_SITUACAO_FUNCIONALIDADES_2026-06.md",
            st["small"],
        )
    )
    return story


def main():
    st = build_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title="Relatório Situação Funcionalidades TotemDigital",
        author="TotemDigital",
    )
    doc.build(build_story(st))
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    main()
