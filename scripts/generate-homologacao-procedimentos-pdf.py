#!/usr/bin/env python3
"""Gera PDF com procedimentos de homologação — Publicar em Tela (Ondas A/B/C)."""

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
OUTPUT = ROOT / "docs" / "PROCEDIMENTOS_HOMOLOGACAO_PUBLICAR_EM_TELA_Vx5.pdf"


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "DocTitle",
            parent=base["Title"],
            fontSize=20,
            leading=24,
            alignment=TA_CENTER,
            spaceAfter=12,
            textColor=colors.HexColor("#1a237e"),
        ),
        "subtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base["Normal"],
            fontSize=11,
            leading=14,
            alignment=TA_CENTER,
            spaceAfter=20,
            textColor=colors.HexColor("#455a64"),
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontSize=14,
            leading=18,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#1565c0"),
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontSize=12,
            leading=15,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#283593"),
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontSize=10,
            leading=13,
            leftIndent=14,
            bulletIndent=0,
            spaceAfter=4,
        ),
        "mono": ParagraphStyle(
            "Mono",
            parent=base["Code"],
            fontSize=8.5,
            leading=11,
            fontName="Courier",
            backColor=colors.HexColor("#f5f5f5"),
            borderPadding=6,
            spaceAfter=8,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontSize=8,
            textColor=colors.grey,
            alignment=TA_CENTER,
        ),
    }


def table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e3f2fd")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0d47a1")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b0bec5")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def add_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawString(2 * cm, 1.2 * cm, "TotemDigital / Smart Signage Studio — Procedimentos Vx5")
    canvas.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Página {doc.page}")
    canvas.restoreState()


def main():
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="Procedimentos de Homologação — Publicar em Tela Vx5",
        author="TotemDigital",
    )

    story = []
    today = date.today().strftime("%d/%m/%Y")

    story.append(Paragraph("Procedimentos de Homologação", styles["title"]))
    story.append(Paragraph("Publicar em Tela — Opção C (Ondas A, B e C)", styles["subtitle"]))
    story.append(Paragraph(f"Branch: <b>Smart-Signage-Studio-Vx5</b> · Gerado em: {today}", styles["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1565c0")))
    story.append(Spacer(1, 0.3 * cm))

    # --- 1. Contexto ---
    story.append(Paragraph("1. Contexto da conversa e do projeto", styles["h1"]))
    story.append(
        Paragraph(
            "Este documento consolida o trabalho realizado na branch <b>Smart-Signage-Studio-Vx5</b> "
            "para o fluxo <b>Publicar em Tela (Opção C)</b>: abas Rápido e Criar, HTML offline, "
            "assistência de IA para textos, cardápio dinâmico ao vivo e vídeo IA Premium. "
            "O núcleo <i>quickPublishService</i> foi preservado; playlist e campanha não são expostas na UI.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Commits recentes no remoto:</b>",
            styles["body"],
        )
    )
    commits = [
        ["Commit", "Conteúdo"],
        ["c669af0", "Ondas B e C — cardápio ao vivo (catalogRevision) e vídeo IA Premium (adapter HTTP)"],
        ["68202d5", "Onda A — Gerar e publicar agora (auto-publish orchestrator)"],
        ["9b7e22d", "Preview da mídia selecionada após upload"],
        ["e344333", "Fix build Linux — ResponsiveSectionNav"],
        ["fbd6bdb", "Anti-duplo-clique, flags ai_text_assist/ai_video, E2E modo Criar"],
    ]
    story.append(table(commits, [3.2 * cm, 12.3 * cm]))
    story.append(Spacer(1, 0.2 * cm))

    # --- 2. Ondas implementadas ---
    story.append(Paragraph("2. O que já está implementado (código)", styles["h1"]))

    story.append(Paragraph("2.1 Onda A — Gerar e publicar agora (semi-automático)", styles["h2"]))
    for item in [
        "Serviço autoPublishOrchestratorService: layout → IA opcional → render HTML → quickPublish.",
        "Rota POST /api/subscribers/:id/publish-board/:preset/auto-publish.",
        "Botão「Gerar e publicar agora」+ checkbox IA textos no CreatePublishPanel.",
        "Testes unitários e de integração.",
    ]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph("2.2 Onda B — Triggers automáticos (cardápio ao vivo)", styles["h2"]))
    for item in [
        "menuCatalogTriggerService: catalogRevision, audit log, MENU_LIVE_REFRESH_SECONDS (5–300s, default 30).",
        "Triggers em create/update/delete de produto no menuCatalogService.",
        "API pública GET /api/publish-board/public-menu/:subscriberId com meta.catalogRevision e refreshSeconds.",
        "HTML do cardápio faz poll inteligente (refresh rápido de 2s quando revision muda).",
        "Aviso verde no MenuCatalog após salvar preço/produto.",
        "Sem republicação de campanha — telas HTML consultam a API periodicamente.",
    ]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph("2.3 Onda C — Vídeo IA real (Premium)", styles["h2"]))
    for item in [
        "aiVideoConfig em env.ts: AI_VIDEO_PROVIDER, AI_VIDEO_API_URL, AI_VIDEO_API_KEY, AI_VIDEO_TIMEOUT_MS.",
        "httpAiVideoAdapter: POST no provedor → { videoUrl | url }.",
        "publishVideoAiProcessorService: checa Premium, gera, importa vídeo, cria mídia aprovada.",
        "Rotas queue-video-ai (201/202/403) e GET video-ai-jobs/:jobId.",
        "UI seleciona mediaId automaticamente quando status === completed.",
    ]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(PageBreak())

    # --- 3. O que falta ---
    story.append(Paragraph("3. O que ainda falta", styles["h1"]))
    gaps = [
        ["Área", "Situação", "Impacto"],
        ["Homologação em campo", "Checklist §11 inteiro por marcar", "Bloqueia release"],
        ["Deploy staging", "git pull + rebuild + restart com c669af0", "Bloqueia todos os testes"],
        ["Env vars", "MENU_LIVE_*, AI_VIDEO_* não no instalador", "B/C não funcionam plenamente"],
        ["Provedor vídeo real", "Adapter genérico; falta API externa configurada", "C só parcial na prática"],
        ["Vídeo assíncrono", "Geração síncrona; UI não faz poll de job", "Provedores lentos quebram UX"],
        ["E2E B/C", "Sem mocks public-menu / queue-video-ai", "Risco de regressão"],
        ["Merge main", "Adiado pelo usuário", "Produção formal"],
        ["Roadmap futuro", "Framework propaganda automática, triggers extras", "Evolução, não urgente"],
    ]
    story.append(table(gaps, [4 * cm, 5.5 * cm, 6 * cm]))
    story.append(Spacer(1, 0.3 * cm))

    # --- 4. Ordem de dependência ---
    story.append(Paragraph("4. Ordem de importância e dependência", styles["h1"]))
    story.append(
        Paragraph(
            "Execute nesta sequência. Cada passo desbloqueia o seguinte; pular etapas gera falsos negativos nos testes.",
            styles["body"],
        )
    )
    order = [
        ["P", "Passo", "Depende de", "Desbloqueia"],
        ["P0", "Deploy c669af0 no staging (pull, rebuild, restart)", "—", "Tudo"],
        ["P1", "Homologação manual §11 (Rápido → Criar → auto-publish)", "P0", "Confiança para release"],
        ["P2", "Configurar env (MENU_LIVE, AI_PROVIDER, AI_VIDEO_*)", "P0", "Testes reais B e C"],
        ["P3", "Cardápio ao vivo no totem físico", "P1 + P2", "Valor de negócio Onda B"],
        ["P4", "Provedor vídeo IA + teste Premium", "P2 + plano Premium", "Valor de negócio Onda C"],
        ["P5", "Fila assíncrona + poll na UI (se provedor lento)", "P4", "C em escala"],
        ["P6", "E2E automatizado Ondas B/C", "P1 estável", "CI sem regressão"],
        ["P7", "Instalador / env.example com novas vars", "P2 + P4 validados", "Novas instalações"],
        ["P8", "Merge main + release formal", "P1 mín.; ideal P3+P4", "Produção"],
        ["P9", "Roadmap futuro (triggers, framework auto)", "P8", "Evolução"],
    ]
    story.append(table(order, [1 * cm, 5.5 * cm, 3.5 * cm, 5.5 * cm]))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("4.1 Diagrama de dependências", styles["h2"]))
    story.append(
        Paragraph(
            "P0 (Deploy) → P1 (Homologação) e P2 (Env) → P3 (Cardápio totem) e P4 (Vídeo IA) → "
            "P5 (Async, se necessário) → P6 (E2E) → P7 (Instalador) → P8 (Release) → P9 (Futuro).",
            styles["body"],
        )
    )

    story.append(PageBreak())

    # --- 5. Procedimento deploy ---
    story.append(Paragraph("5. Procedimento P0 — Deploy no staging", styles["h1"]))
    story.append(Paragraph("<b>Pré-requisitos</b>", styles["body"]))
    for item in [
        "Acesso SSH ao servidor de staging (ex.: 217.216.91.135).",
        "Postgres com schema v6 e seed aplicados.",
        "Node/npm disponíveis no servidor.",
    ]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    story.append(Paragraph("<b>Comandos (ajustar caminhos conforme instalação)</b>", styles["body"]))
    deploy_cmds = """cd /caminho/TotemDigital
git fetch origin
git checkout Smart-Signage-Studio-Vx5
git pull origin Smart-Signage-Studio-Vx5
git log -1 --oneline
# Confirmar commit c669af0 ou posterior

cd backend && npm ci && npm run build
cd ../frontend && npm ci
# Frontend Studio:
export REACT_APP_TOTEMDIGITAL_COMPACT=true
npm run build

# Reiniciar serviços (systemd, pm2 ou script local)
sudo systemctl restart smartsignage-backend smartsignage-frontend
# ou: pm2 restart all"""
    story.append(Paragraph(deploy_cmds.replace("\n", "<br/>"), styles["mono"]))

    story.append(Paragraph("<b>Verificação pós-deploy</b>", styles["body"]))
    for item in [
        "GET /health → studioMode: true.",
        "Login admin funciona; menu sem credenciais expostas.",
        "Logs: Smart Signage Studio + single_publisher.",
    ]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    # --- 6. Env vars ---
    story.append(Paragraph("6. Procedimento P2 — Variáveis de ambiente", styles["h1"]))
    story.append(Paragraph("Adicionar no .env do backend (e reiniciar):", styles["body"]))
    env_block = """TOTEMDIGITAL_COMPACT=true
MENU_LIVE_REFRESH_SECONDS=30

# IA textos (Onda A / suggest-copy)
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b

# Vídeo IA Premium (Onda C) — opcional até ter provedor
AI_VIDEO_PROVIDER=http
AI_VIDEO_API_URL=https://seu-provedor/video/generate
AI_VIDEO_API_KEY=sua-chave
AI_VIDEO_TIMEOUT_MS=120000"""
    story.append(Paragraph(env_block.replace("\n", "<br/>"), styles["mono"]))
    story.append(
        Paragraph(
            "<b>Ordem de configuração:</b> primeiro MENU_LIVE_REFRESH e AI_PROVIDER; "
            "depois AI_VIDEO_* quando houver URL de provedor real.",
            styles["body"],
        )
    )

    # --- 7. Homologação §11 ---
    story.append(Paragraph("7. Procedimento P1 — Homologação manual (Checklist §11)", styles["h1"]))
    story.append(
        Paragraph(
            "Referência: docs/CHECKLIST_STUDIO_STAGING.md. Marque cada item após pass/fail documentado.",
            styles["body"],
        )
    )

    homolog = [
        ["#", "Teste", "Passos", "Critério OK", "Dep."],
        [
            "1.1",
            "Modo Rápido",
            "/quick-publish?mode=quick → upload MP4/imagem → Publicar",
            "Mídia aprovada; publicação no totem sem erro",
            "P0",
        ],
        [
            "1.2",
            "Modo Criar + HTML",
            "?mode=create → preset → preview → Gerar animação HTML → Publicar",
            "Mídia html selecionada; campanha automática (não visível na UI)",
            "1.1",
        ],
        [
            "1.3",
            "Gerar e publicar agora",
            "Botão「Gerar e publicar agora」com contrato e totens",
            "HTML gerado e publicado em um clique",
            "1.2",
        ],
        [
            "1.4",
            "IA textos",
            "Sugerir textos com IA (AI_PROVIDER configurado)",
            "Botão ativo ou aviso claro se indisponível",
            "1.2 + env",
        ],
        [
            "1.5",
            "Cardápio ao vivo",
            "Publicar cardápio HTML → alterar preço em Cardápio por cliente",
            "Aviso verde na UI; totem atualiza em ~30s sem republicar",
            "1.2 + P2",
        ],
        [
            "1.6",
            "Vídeo IA Premium",
            "Plano base → mensagem Premium; Premium + AI_VIDEO_* → vídeo",
            "mediaId selecionado ou fila 202 sem provedor",
            "P2 + Premium",
        ],
        [
            "1.7",
            "Redirect",
            "/publish-board → ?mode=create",
            "URL redireciona corretamente",
            "P0",
        ],
    ]
    story.append(table(homolog, [0.8 * cm, 2.8 * cm, 4.5 * cm, 4.5 * cm, 1 * cm]))
    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "<b>Critério mínimo para merge (P8):</b> itens 1.1, 1.2, 1.3 e 1.5 verificados; "
            "sem regressão no fluxo Rápido.",
            styles["body"],
        )
    )

    story.append(PageBreak())

    # --- 8. Cardápio ao vivo detalhado ---
    story.append(Paragraph("8. Procedimento P3 — Cardápio ao vivo (Onda B)", styles["h1"]))
    steps_b = [
        "1. No modo Criar, preset Cardápio: escolher anunciante, configurar layout, Gerar animação HTML.",
        "2. Publicar no totem de teste (contrato + totem válidos).",
        "3. Confirmar que o player exibe o cardápio HTML (media_type: html).",
        "4. Abrir Cardápio por cliente (/menu-catalog?subscriber=ID).",
        "5. Editar preço de um produto e salvar — deve aparecer aviso verde de atualização ao vivo.",
        "6. Aguardar até MENU_LIVE_REFRESH_SECONDS (default 30s) no totem.",
        "7. Verificar novo preço na tela sem republicar campanha.",
        "8. (Opcional) GET /api/publish-board/public-menu/:subscriberId — conferir meta.catalogRevision.",
    ]
    for s in steps_b:
        story.append(Paragraph(s, styles["bullet"]))

    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("<b>Se falhar — verificar:</b>", styles["body"]))
    for item in [
        "Totem acessa a mesma origem da API (CORS/rede).",
        "Mídia publicada é HTML com script de poll (não PNG estático).",
        "Cache: resposta public-menu com Cache-Control: no-cache.",
        "Produto isAvailable = true após edição.",
    ]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    # --- 9. Vídeo IA ---
    story.append(Paragraph("9. Procedimento P4 — Vídeo IA Premium (Onda C)", styles["h1"]))
    steps_c = [
        "1. Confirmar plano do anunciante com feature ai_video: true (seed Premium).",
        "2. Configurar AI_VIDEO_PROVIDER=http e AI_VIDEO_API_URL no backend.",
        "3. Provedor deve aceitar POST { brief, preset, subscriberId } e retornar { videoUrl } ou { url }.",
        "4. No modo Criar, clicar no botão de Vídeo IA.",
        "5. Plano base: esperar HTTP 403 e mensagem Premium.",
        "6. Plano Premium sem provedor: HTTP 202, fila informativa.",
        "7. Plano Premium com provedor: HTTP 201, mediaId na resposta; mídia selecionada na UI.",
        "8. Consultar job: GET /api/subscribers/:id/publish-board/video-ai-jobs/:jobId.",
    ]
    for s in steps_c:
        story.append(Paragraph(s, styles["bullet"]))

    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "<b>P5 (se geração &gt; timeout):</b> implementar worker assíncrono e polling na UI "
            "usando getVideoAiJob — só após medir tempo real do provedor em P4.",
            styles["body"],
        )
    )

    # --- 10. Arquitetura preservada ---
    story.append(Paragraph("10. Regras de arquitetura (preservadas)", styles["h1"]))
    for item in [
        "quickPublishService.ts — núcleo não alterado.",
        "Playlist/campanha não expostas na UI do Studio.",
        "Schema como fonte da verdade (sem migrations temporárias).",
        "Alterações mínimas e consistentes com convenções existentes.",
    ]:
        story.append(Paragraph(f"• {item}", styles["bullet"]))

    # --- 11. Comandos úteis ---
    story.append(Paragraph("11. Comandos úteis (validação local)", styles["h1"]))
    cmds = """# Testes backend Ondas A/B/C
cd backend
npm test -- --testPathPattern="publish-board|publishBoardHtml|httpAiVideo|menuCatalogTrigger"

# Validar seed v6
cd database && node validate-v6.js

# E2E (com mocks)
cd e2e && npx playwright test quick-publish-create.spec.ts"""
    story.append(Paragraph(cmds.replace("\n", "<br/>"), styles["mono"]))

    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.lightgrey))
    story.append(
        Paragraph(
            f"Documento gerado automaticamente a partir da conversa de implementação "
            f"Publicar em Tela Vx5 · {today}",
            styles["footer"],
        )
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    main()
