# -*- coding: utf-8 -*-
"""Gera one-pager comercial TotemDigital (1 página A4)."""
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor, white, black
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

OUT = Path('docs/ONE-PAGER-COMERCIAL-TOTEMDIGITAL-2026-07.pdf')

YELLOW = HexColor('#ffd21c')
GOLD = HexColor('#f3ad13')
DARK = HexColor('#061113')
MUTED = HexColor('#6a7a7e')
LIGHT = HexColor('#f7f4ea')
ROW = HexColor('#fff8e0')
BORDER = HexColor('#e0d6b8')


def P(text, style):
    return Paragraph(text, style)


def main():
    styles = {
        'brand': ParagraphStyle(
            'brand', fontName='Helvetica-Bold', fontSize=18, leading=20,
            textColor=DARK, alignment=TA_CENTER, spaceAfter=2,
        ),
        'tag': ParagraphStyle(
            'tag', fontName='Helvetica-Oblique', fontSize=10, leading=13,
            textColor=MUTED, alignment=TA_CENTER, spaceAfter=6,
        ),
        'h': ParagraphStyle(
            'h', fontName='Helvetica-Bold', fontSize=10, leading=12,
            textColor=DARK, spaceBefore=7, spaceAfter=3,
        ),
        'body': ParagraphStyle(
            'body', fontName='Helvetica', fontSize=8.5, leading=11,
            textColor=black, alignment=TA_LEFT, spaceAfter=2,
        ),
        'cell': ParagraphStyle(
            'cell', fontName='Helvetica', fontSize=7.5, leading=9.5, textColor=black,
        ),
        'cellh': ParagraphStyle(
            'cellh', fontName='Helvetica-Bold', fontSize=7.5, leading=9.5, textColor=DARK,
        ),
        'cta': ParagraphStyle(
            'cta', fontName='Helvetica-Bold', fontSize=9.5, leading=12,
            textColor=DARK, alignment=TA_CENTER, spaceBefore=4, spaceAfter=2,
        ),
        'foot': ParagraphStyle(
            'foot', fontName='Helvetica', fontSize=7.5, leading=9,
            textColor=MUTED, alignment=TA_CENTER,
        ),
        'step': ParagraphStyle(
            'step', fontName='Helvetica', fontSize=8.5, leading=11,
            textColor=black, alignment=TA_CENTER,
        ),
    }

    story = []
    story.append(HRFlowable(width='100%', thickness=4, color=YELLOW, spaceAfter=6))
    story.append(P('TotemDigital', styles['brand']))
    story.append(P('Telas que vendem sozinhas — publique no totem em minutos.', styles['tag']))
    story.append(HRFlowable(width='100%', thickness=0.8, color=BORDER, spaceAfter=4))

    story.append(P('O QUE É', styles['h']))
    story.append(P(
        'Plataforma de <b>sinalização digital</b> para totens e TVs: painel web + player Android '
        '(<b>Player-AD</b>) 24/7 em portrait 9:16, com publicação remota, cache offline e controlo da tela. '
        'Ideal para restaurantes, lojas, receções e operadores de mídia indoor.',
        styles['body'],
    ))

    story.append(P('O QUE RESOLVE', styles['h']))
    pain = [
        [P('Dor do negócio', styles['cellh']), P('Com TotemDigital', styles['cellh'])],
        [P('Pen drive e visita ao local', styles['cell']), P('Publicação remota pelo painel', styles['cell'])],
        [P('Cardápio / promo desatualizados', styles['cell']), P('Atualiza em minutos', styles['cell'])],
        [P('Tela “morta” sem internet', styles['cell']), P('Cache + fallback local', styles['cell'])],
        [P('Dependência de técnico', styles['cell']), P('Biblioteca → publicar (simples)', styles['cell'])],
    ]
    tw = 17 * cm
    t1 = Table(pain, colWidths=[tw * 0.48, tw * 0.52])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#ffe9a8')),
        ('BACKGROUND', (0, 1), (-1, -1), LIGHT),
        ('GRID', (0, 0), (-1, -1), 0.35, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, ROW]),
    ]))
    story.append(t1)

    story.append(P('COMO FUNCIONA', styles['h']))
    steps = [[
        P('<b>1.</b> Enviar mídia<br/>para a biblioteca', styles['step']),
        P('<b>2.</b> Publicar no totem<br/>(selecionar e ordenar)', styles['step']),
        P('<b>3.</b> A tela atualiza<br/>(cache e exibição)', styles['step']),
    ]]
    t2 = Table(steps, colWidths=[tw / 3.0] * 3)
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.6, GOLD),
        ('INNERGRID', (0, 0), (-1, -1), 0.35, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(t2)

    story.append(P('DIFERENCIAIS', styles['h']))
    diffs = (
        '• Player nativo Android (kiosk, portrait, 24/7) &nbsp;&nbsp; '
        '• Cache offline &nbsp;&nbsp; '
        '• Controlo remoto e horário de tela<br/>'
        '• Kit de instalação (pendrive / TV box) &nbsp;&nbsp; '
        '• Escala: 1 tela → rede multi-loja'
    )
    story.append(P(diffs, styles['body']))

    story.append(P('PARA QUEM', styles['h']))
    who = (
        '<b>Food &amp; bebida</b> (cardápio/promo) · '
        '<b>Lojas locais</b> (ofertas/vitrine) · '
        '<b>Recepções</b> (comunicação) · '
        '<b>Instaladores</b> (kit + margem)'
    )
    story.append(P(who, styles['body']))

    story.append(P('PACOTES (REFERÊNCIA)', styles['h']))
    packs = [
        [P('Pacote', styles['cellh']), P('Inclui', styles['cellh']), P('Modelo', styles['cellh'])],
        [P('<b>Starter</b>', styles['cell']), P('1 tela + painel + suporte básico', styles['cell']), P('Assinatura mensal', styles['cell'])],
        [P('<b>Kit Pronto</b>', styles['cell']), P('Starter + TV box + instalação + treino', styles['cell']), P('Setup + assinatura', styles['cell'])],
        [P('<b>Rede</b>', styles['cell']), P('Multi-loja, monitorização, papéis', styles['cell']), P('Por org. / telas', styles['cell'])],
    ]
    t3 = Table(packs, colWidths=[tw * 0.18, tw * 0.52, tw * 0.30])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#ffe9a8')),
        ('GRID', (0, 0), (-1, -1), 0.35, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, ROW]),
    ]))
    story.append(t3)
    story.append(P('<i>Valores sob consulta — ajuste por região e volume.</i>', styles['foot']))

    story.append(Spacer(1, 4))
    story.append(HRFlowable(width='100%', thickness=2, color=YELLOW, spaceBefore=2, spaceAfter=4))
    story.append(P('PRÓXIMO PASSO', styles['h']))
    story.append(P('Demo de 15 minutos (ao vivo) ou orçamento do <b>Kit Pronto</b>.', styles['cta']))
    story.append(P(
        'Site: <b>totemdigital.site</b> &nbsp;·&nbsp; Produto: TotemDigital · SmartSignage Studio &nbsp;·&nbsp; Player-AD (Android)',
        styles['foot'],
    ))
    story.append(Spacer(1, 3))
    story.append(P('TotemDigital — telas que vendem sozinhas.', styles['foot']))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(DARK)
        canvas.rect(0, 0, A4[0], 8 * mm, fill=1, stroke=0)
        canvas.setFillColor(YELLOW)
        canvas.setFont('Helvetica-Bold', 7)
        canvas.drawCentredString(A4[0] / 2, 3.2 * mm, 'ONE-PAGER COMERCIAL  ·  JUL/2026  ·  CONFIDENCIAL PARA CLIENTES E PARCEIROS')
        canvas.restoreState()

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.0 * cm,
        bottomMargin=1.4 * cm,
        title='TotemDigital — One-pager comercial',
        author='TotemDigital',
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print('PDF_OK', OUT.resolve(), OUT.stat().st_size)


if __name__ == '__main__':
    main()
