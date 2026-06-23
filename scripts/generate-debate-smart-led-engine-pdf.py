#!/usr/bin/env python3
"""Gera PDF do debate Smart LED Engine — Smart Signage PRO (conversa jun/2026)."""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
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
OUTPUT = ROOT / "docs" / "DEBATE_SMART_LED_ENGINE_2026-06.pdf"


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "DocTitle",
            parent=base["Title"],
            fontSize=18,
            leading=22,
            alignment=TA_CENTER,
            spaceAfter=8,
            textColor=colors.HexColor("#1a237e"),
        ),
        "subtitle": ParagraphStyle(
            "DocSubtitle",
            parent=base["Normal"],
            fontSize=10,
            leading=13,
            alignment=TA_CENTER,
            spaceAfter=14,
            textColor=colors.HexColor("#455a64"),
        ),
        "part": ParagraphStyle(
            "Part",
            parent=base["Heading1"],
            fontSize=14,
            leading=17,
            spaceBefore=14,
            spaceAfter=8,
            textColor=colors.HexColor("#0d47a1"),
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
            spaceBefore=7,
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
        "quote": ParagraphStyle(
            "Quote",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            leftIndent=14,
            rightIndent=8,
            alignment=TA_JUSTIFY,
            spaceAfter=5,
            textColor=colors.HexColor("#37474f"),
            backColor=colors.HexColor("#eceff1"),
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            leftIndent=12,
            spaceAfter=3,
        ),
        "mono": ParagraphStyle(
            "Mono",
            parent=base["Code"],
            fontSize=7.5,
            leading=9.5,
            leftIndent=8,
            spaceAfter=6,
            fontName="Courier",
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
    return [Paragraph(f"• {esc(item)}", st["bullet"]) for item in items]


def diagram(st, lines: str):
    return Paragraph(f"<font face='Courier' size='7'>{esc(lines)}</font>", st["mono"])


def build_story(st):
    today = date.today().strftime("%d de %B de %Y").replace(
        "January", "janeiro"
    ).replace("February", "fevereiro").replace("March", "março").replace(
        "April", "abril"
    ).replace("May", "maio").replace("June", "junho").replace(
        "July", "julho"
    ).replace("August", "agosto").replace("September", "setembro").replace(
        "October", "outubro"
    ).replace("November", "novembro").replace("December", "dezembro")

    story = []
    story.append(Paragraph("Debate técnico — Smart LED Engine", st["title"]))
    story.append(
        Paragraph(
            "Proposta para Smart Signage PRO · Conversa de produto e arquitetura<br/>"
            f"TotemDigital · {today}",
            st["subtitle"],
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1565c0")))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Sobre este documento", st["h1"]))
    story.append(
        Paragraph(
            "Este PDF consolida a conversa realizada antes da implementação de melhorias "
            "pendentes no Studio Vx5. O utilizador apresentou uma proposta de novo módulo "
            "para o Smart Signage PRO; em seguida foi feita uma análise técnica cruzando "
            "a proposta com o estado atual do repositório TotemDigital.",
            st["body"],
        )
    )

    # --- PARTE 1: Proposta do utilizador ---
    story.append(PageBreak())
    story.append(Paragraph("Parte 1 — Proposta original", st["part"]))
    story.append(Paragraph("Módulo Smart LED Engine", st["h1"]))
    story.append(
        Paragraph(
            "Proposta de criar um novo módulo chamado <b>Smart LED Engine</b> no "
            "Smart Signage PRO, com arquitetura em camadas entre o servidor e as "
            "controladoras de painéis LED de diferentes fabricantes.",
            st["body"],
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(
        diagram(
            st,
            "Smart Signage Server\n"
            "        │\n"
            "        ▼\n"
            " Smart LED Engine\n"
            "        │\n"
            " ┌──────┼──────────────┐\n"
            " │      │              │\n"
            " ▼      ▼              ▼\n"
            "NovaStar HUIDU    Colorlight\n"
            " Driver   Driver     Driver\n"
            " │         │           │\n"
            " ▼         ▼           ▼\n"
            " Painéis LED",
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Visão e diferencial comercial", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "Detectar automaticamente controladoras na rede (auto-discovery).",
                "Enviar mídias, atualizar playlists, controlar brilho.",
                "Monitorar temperatura e receber alertas de falha.",
                "Sincronizar múltiplos painéis (visão de longo prazo).",
                "Abstrair fabricantes numa única interface — poucos CMS de sinalização "
                "oferecem integração unificada com LED multi-marca.",
                "Eliminar dependência de PC ou Raspberry Pi em muitos projetos: "
                "a própria controladora executa o papel de player.",
            ],
        )
    )

    story.append(Paragraph("Evolução do hardware LED", st["h2"]))
    story.append(
        Paragraph(
            "<b>Modelo antigo:</b> PC → HDMI → Video Processor → Painel LED.",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Modelo atual:</b> controladora inteligente com CPU ARM, RAM, flash, "
            "Ethernet, Wi-Fi, USB e sistema Linux ou Android — recebe ficheiros pela "
            "rede e reproduz diretamente no painel (como um Android Box integrado).",
            st["body"],
        )
    )

    story.append(Paragraph("Fabricantes e modelos citados", st["h2"]))
    story.append(
        table(
            [
                ["Fabricante", "Modelos / linhas", "SO / notas"],
                [
                    "NovaStar",
                    "Taurus: TB1, TB2, TB30–TB60, TB1-4G, TB2-4G",
                    "Android; Ethernet, Wi-Fi, USB, 4G (alguns)",
                ],
                [
                    "HUIDU",
                    "A3, A4, A5, A6, C16L, C36C, VP Series",
                    "Linux / Android; muito usada no Brasil",
                ],
                [
                    "Xixun",
                    "Centenas de modelos",
                    "Android Box + controladora; comum na China",
                ],
                [
                    "Colorlight",
                    "(mencionado na arquitetura)",
                    "Driver dedicado na proposta",
                ],
            ],
            col_widths=[3.2 * cm, 5.5 * cm, 7.8 * cm],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("Protocolos de comunicação", st["h2"]))
    story.append(
        table(
            [
                ["Protocolo", "Uso típico"],
                ["FTP", "Upload de ficheiros (ex.: propaganda.mp4, playlist.json)"],
                ["HTTP", "Servidor web embutido: status, upload, play, brightness"],
                ["TCP", "Comandos binários: LOGIN, UPLOAD, PLAY, STOP, DELETE, STATUS"],
            ],
            col_widths=[3 * cm, 13.5 * cm],
        )
    )

    story.append(Paragraph("Comparação com o fluxo atual Smart Signage", st["h2"]))
    story.append(
        Paragraph(
            "<b>Hoje (TV / player):</b> Servidor → API → Player → HDMI → TV.",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Proposto (LED):</b> Servidor → API → Driver (HUIDU/NovaStar/…) → "
            "Ethernet → Painel. Não existe HDMI.",
            st["body"],
        )
    )

    story.append(Paragraph("Softwares oficiais dos fabricantes", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "NovaStar: NovaLCT, SmartLCT, ViPlex Express, ViPlex Handy, ViPlex Manager.",
                "HUIDU: HDPlayer, HDSet, HD2020 (gratuitos).",
                "Xixun: LedOK Express, Xixun Player, LedArt.",
                "Esses programas já fazem discovery, envio de mídia, playlist, agendamento "
                "e execução — são mini-CMS só para LED.",
            ],
        )
    )

    story.append(Paragraph("Abordagem proposta", st["h2"]))
    story.append(
        Paragraph(
            "Em vez de substituir esses programas de imediato, o Smart Signage PRO "
            "conversaria diretamente com as controladoras via drivers. Para o utilizador "
            "final não importa se o painel é NovaStar, HUIDU ou Xixun: cadastra o "
            "dispositivo, publica a campanha e o sistema envia ficheiros e comandos "
            "ao driver correto.",
            st["body"],
        )
    )

    story.append(Paragraph("Três cenários de integração", st["h2"]))
    story.append(
        table(
            [
                ["Tipo", "Nível de acesso", "Integração"],
                [
                    "Totalmente aberta",
                    "Android acessível, ADB, instalação de APK",
                    "Excelente — player próprio instalável",
                ],
                [
                    "Semiaberta",
                    "Upload e controle por protocolo, sem instalar apps",
                    "Muito boa — Smart envia ficheiros e comandos via rede",
                ],
                [
                    "Fechada",
                    "Só software do fabricante",
                    "SDK oficial ou engenharia reversa do protocolo",
                ],
            ],
            col_widths=[3.2 * cm, 5.8 * cm, 7.5 * cm],
        )
    )

    story.append(Spacer(1, 0.2 * cm))
    story.append(
        Paragraph(
            "<b>Estratégia sugerida na proposta:</b> começar por HUIDU e Xixun "
            "(mais possibilidades históricas de integração) e depois adicionar "
            "NovaStar Taurus (grande parte do mercado profissional).",
            st["body"],
        )
    )

    # --- PARTE 2: Análise técnica ---
    story.append(PageBreak())
    story.append(Paragraph("Parte 2 — Análise e debate técnico", st["part"]))
    story.append(Paragraph("Leitura da proposta", st["h1"]))
    story.append(
        Paragraph(
            "A direção é coerente estrategicamente e alinha-se ao posicionamento "
            "<b>Smart Signage PRO</b> (multi-dispositivo, integrador, OOH). O diferencial "
            "é real: o mercado está fragmentado em CMS por fabricante, enquanto o "
            "TotemDigital já possui campanha → dispatcher → totem → playback maduro "
            "no Android (Player-AD).",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "O ponto central não é «mais um player», mas <b>mudar o destino do dispatch</b>: "
            "em vez de HDMI → TV, Ethernet → controladora LED, que já é o player.",
            st["body"],
        )
    )

    story.append(Paragraph("Estado atual do repositório TotemDigital", st["h1"]))
    story.append(
        table(
            [
                ["Camada existente", "Reuso para Smart LED Engine"],
                [
                    "totems, campanhas, dispatcher, DispatchPlan",
                    "Alto — lógica de «o que tocar» já existe",
                ],
                [
                    "Player-AD + /api/player/*",
                    "Parcial — modelo pull; LED costuma ser push (FTP/HTTP/TCP)",
                ],
                [
                    "smart_tvs (marca, modelo, plataforma)",
                    "Conceitual — dispositivo físico ligado ao totem",
                ],
                [
                    "OTA por plataforma (android, webos…)",
                    "Baixo — LED não recebe APK da mesma forma",
                ],
                ["Studio compacto", "Nenhum — módulo é claramente PRO"],
                ["NovaStar / HUIDU / Xixun no código", "Não implementado"],
            ],
            col_widths=[6.5 * cm, 10.5 * cm],
        )
    )
    story.append(
        Paragraph(
            "Conclusão: o CMS e o motor de campanha existem; falta uma "
            "<b>camada de adaptadores de hardware</b> entre o dispatch e a controladora.",
            st["body"],
        )
    )

    story.append(Paragraph("Arquitetura recomendada (3 camadas)", st["h1"]))
    story.append(
        diagram(
            st,
            "[CMS existente] Campaign / Playlist / Mídia\n"
            "              ↓\n"
            "         Dispatcher / DispatchPlan\n"
            "              ↓\n"
            "[NOVO] Smart LED Engine\n"
            "  · Device Registry + Discovery\n"
            "  · LED Orchestrator\n"
            "  · Sync / Jobs / Retry\n"
            "              ↓\n"
            "[NOVO] Driver Layer\n"
            "  NovaStar | HUIDU | Xixun | Colorlight\n"
            "              ↓\n"
            "         Painéis LED na rede",
        )
    )
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("Responsabilidades do Smart LED Engine", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "Receber plano já resolvido (DispatchPlan ou LEDDeployJob derivado).",
                "Traduzir para protocolo do fabricante (upload, playlist, schedule, brilho).",
                "Monitorar status (online, temperatura, falha de ficheiro, brilho).",
                "Reportar de volta ao heartbeat/totem para painel unificado.",
                "Não reinventar campanha — reutilizar o que o dispatcher já resolve.",
            ],
        )
    )

    story.append(Paragraph("Cenários de integração — ordem prática", st["h1"]))
    story.append(
        table(
            [
                ["Cenário", "Exemplo", "Estratégia", "Esforço", "Risco"],
                [
                    "A — Android aberto",
                    "NovaStar Taurus TBx",
                    "Instalar Player-AD via ADB",
                    "Baixo",
                    "Firmware fechado",
                ],
                [
                    "B — Semiaberta",
                    "HUIDU A/C, Xixun",
                    "Driver de rede FTP/HTTP/TCP",
                    "Médio",
                    "Protocolo por modelo",
                ],
                [
                    "C — Fechada",
                    "Colorlight antigo",
                    "SDK ou eng. reversa",
                    "Alto",
                    "Suporte contínuo",
                ],
            ],
            col_widths=[2.8 * cm, 2.8 * cm, 4.2 * cm, 2 * cm, 4.7 * cm],
        )
    )
    story.append(
        Paragraph(
            "<b>Recomendação de piloto duplo:</b> (1) Taurus com Player-AD para provar "
            "valor em semanas; (2) um modelo HUIDU com driver nativo para provar integração "
            "sem HDMI nem APK.",
            st["body"],
        )
    )

    story.append(Paragraph("Auto-discovery — expectativa realista", st["h1"]))
    story.append(
        table(
            [
                ["Método", "Uso", "Limitação"],
                ["UDP broadcast", "HDPlayer, Xixun", "VLAN, firewall, Wi-Fi isolado"],
                ["mDNS/Bonjour", "Alguns IoT", "Raro em LED industrial"],
                ["Scan subnet + fingerprint", "ViPlex, HDSet", "Lento; pode exigir credenciais"],
                ["TCP após login", "NovaStar", "Porta e handshake específicos"],
            ],
            col_widths=[3.5 * cm, 4 * cm, 9 * cm],
        )
    )
    story.append(
        Paragraph(
            "Fase 1: scan de subnet + identificação por porta/resposta. "
            "Fase 2: mDNS onde existir + importar IP do software oficial como fallback. "
            "Senha admin da controladora continuará necessária na maioria dos casos.",
            st["body"],
        )
    )

    story.append(Paragraph("Onde Smart Signage pode superar os CMS nativos", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "Um painel para TV + Android box + LED multi-marca.",
                "Playlist ligada a campanha, contrato, plano e mix (OOH comercial).",
                "Alertas no dashboard + diagnostics do dispatcher.",
                "Faturamento anunciante/exibidor já existente no PRO.",
            ],
        )
    )
    story.append(
        Paragraph(
            "MVP do LED Engine não precisa: sync multi-painel frame-perfect, mapa de "
            "pixels, correção de gabarito — isso é v3+.",
            st["body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Riscos antes de implementar", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "Fragmentação de firmware — mesmo modelo pode falar protocolos diferentes.",
                "Suporte pós-venda — integrador culpa o Smart Signage; exigir logs por job.",
                "Engenharia reversa — risco legal em clientes enterprise; priorizar SDK oficial.",
                "Telemetria heterogénea — modelo canônico (brightness, temp, power, storage).",
                "Sync multi-painel — produto à parte (NTP, frame sync); não é MVP.",
                "Manter LED apenas no PRO (feature flag), como SmartDisplayFX no Studio.",
            ],
        )
    )

    story.append(Paragraph("Modelo de dados (esboço conceitual)", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "led_controllers — vendor, model, firmware, ip, driver_id, capabilities.",
                "led_deploy_jobs — totem_id, dispatch_snapshot, status, last_error.",
                "led_telemetry — brightness, temp, disk, last_seen.",
                "Totem continua entidade de negócio no dispatcher; controladora é endpoint de execução.",
            ],
        )
    )

    story.append(Paragraph("Roadmap sugerido no debate", st["h1"]))
    story.append(Paragraph("MVP (8–12 semanas, 1 fabricante + 1 modelo)", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "Cadastro manual (IP + credencial).",
                "Upload vídeo/imagem via driver HUIDU ou Xixun.",
                "Playlist simples (ordem + duração).",
                "Status online/offline + último deploy.",
                "UI PRO: Locais → Painéis LED.",
            ],
        )
    )
    story.append(Paragraph("v2", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "Auto-discovery na LAN.",
                "Brilho remoto + agendamento.",
                "Segundo fabricante (NovaStar protocolo ou Taurus + Player-AD).",
                "Integração dispatcher: campanha ativa → deploy automático.",
            ],
        )
    )
    story.append(Paragraph("v3", st["h2"]))
    story.extend(
        bullets(
            st,
            [
                "Telemetria e alertas avançados.",
                "Sync multi-painel básico.",
                "Colorlight / processadores fechados via SDK.",
            ],
        )
    )

    story.append(Paragraph("Perguntas em aberto (antes de codar)", st["h1"]))
    story.extend(
        bullets(
            st,
            [
                "Público piloto: integrador HUIDU no Brasil ou cliente Taurus?",
                "Servidor na mesma LAN do painel (on-prem) ou cloud com VPN?",
                "Substituir HDPlayer/ViPlex ou conviver em paralelo?",
                "Em Android aberto: sempre Player-AD ou driver nativo mais leve?",
                "MVP só playback de campanha ou já brilho + monitoramento?",
            ],
        )
    )

    story.append(Paragraph("Veredito da análise", st["h1"]))
    story.append(
        Paragraph(
            "A proposta é <b>coerente, diferenciada e alinhada ao PRO</b>. Não se recomenda "
            "começar por auto-discovery + quatro drivers + sync multi-painel em paralelo. "
            "Caminho mais seguro: (1) provar valor com uma controladora real; "
            "(2) ligar ao dispatch existente; (3) escalar drivers e discovery depois.",
            st["body"],
        )
    )
    story.append(
        Paragraph(
            "Próximo passo sugerido na conversa: debater qual fabricante/modelo usar como "
            "piloto e desenhar o contrato do driver "
            "(discover | connect | upload | setPlaylist | setBrightness | getStatus) "
            "sem implementação imediata.",
            st["body"],
        )
    )

    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cfd8dc")))
    story.append(
        Paragraph(
            f"TotemDigital · Smart Signage PRO · documento gerado em {today}<br/>"
            "Script: scripts/generate-debate-smart-led-engine-pdf.py",
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
        title="Debate Smart LED Engine — Smart Signage PRO",
        author="TotemDigital",
    )
    doc.build(build_story(st))
    print(f"PDF gerado: {OUTPUT}")


if __name__ == "__main__":
    main()
