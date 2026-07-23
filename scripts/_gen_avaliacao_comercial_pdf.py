# -*- coding: utf-8 -*-
from pathlib import Path
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

md_path = Path('docs/AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md')
pdf_path = Path('docs/AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.pdf')
text = md_path.read_text(encoding='utf-8')

YELLOW = HexColor('#f3ad13')
DARK = HexColor('#061113')
MUTED = HexColor('#44555a')
LIGHT_BG = HexColor('#f7f4ea')
BORDER = HexColor('#d8d0b8')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name='CoverTitle', fontName='Helvetica-Bold', fontSize=22, leading=26,
    textColor=DARK, alignment=TA_CENTER, spaceAfter=8
))
styles.add(ParagraphStyle(
    name='CoverSub', fontName='Helvetica', fontSize=11, leading=15,
    textColor=MUTED, alignment=TA_CENTER, spaceAfter=4
))
styles.add(ParagraphStyle(
    name='H1Doc', fontName='Helvetica-Bold', fontSize=14, leading=18,
    textColor=DARK, spaceBefore=16, spaceAfter=8
))
styles.add(ParagraphStyle(
    name='H2Doc', fontName='Helvetica-Bold', fontSize=12, leading=15,
    textColor=DARK, spaceBefore=12, spaceAfter=6
))
styles.add(ParagraphStyle(
    name='H3Doc', fontName='Helvetica-Bold', fontSize=10.5, leading=13,
    textColor=MUTED, spaceBefore=8, spaceAfter=4
))
styles.add(ParagraphStyle(
    name='BodyDoc', fontName='Helvetica', fontSize=9.5, leading=13,
    textColor=black, alignment=TA_JUSTIFY, spaceAfter=6
))
styles.add(ParagraphStyle(
    name='QuoteDoc', fontName='Helvetica-Oblique', fontSize=10, leading=14,
    textColor=DARK, leftIndent=10, rightIndent=10, spaceBefore=6, spaceAfter=8
))
styles.add(ParagraphStyle(
    name='CodeDoc', fontName='Courier', fontSize=8, leading=11,
    textColor=DARK, backColor=LIGHT_BG, leftIndent=4, spaceBefore=4, spaceAfter=6
))
styles.add(ParagraphStyle(
    name='BulletDoc', fontName='Helvetica', fontSize=9.5, leading=12.5,
    textColor=black, leftIndent=12, spaceAfter=2
))
styles.add(ParagraphStyle(
    name='Cell', fontName='Helvetica', fontSize=8, leading=10, textColor=black
))
styles.add(ParagraphStyle(
    name='CellHead', fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=DARK
))


def esc(s: str) -> str:
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    s = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'\*(.+?)\*', r'<i>\1</i>', s)
    s = re.sub(r'`([^`]+)`', r'<font face="Courier" size="8">\1</font>', s)
    s = s.replace('→', '-&gt;').replace('×', 'x')
    return s


def parse_table(rows_raw):
    header_cells = []
    raw_header = [c.strip() for c in rows_raw[0].strip().strip('|').split('|')]
    for c in raw_header:
        header_cells.append(Paragraph(esc(c), styles['CellHead']))
    body = []
    for line in rows_raw[1:]:
        if re.match(r'^\|?\s*-+', line):
            continue
        cols = [c.strip() for c in line.strip().strip('|').split('|')]
        while len(cols) < len(header_cells):
            cols.append('')
        body.append([Paragraph(esc(c), styles['Cell']) for c in cols[:len(header_cells)]])
    data = [header_cells] + body
    col_count = len(header_cells)
    usable = 17 * cm
    col_w = [usable / col_count] * col_count
    t = Table(data, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#ffe9a8')),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_BG]),
    ]))
    return t


story = []
story.append(Spacer(1, 2.2 * cm))
story.append(HRFlowable(width='100%', thickness=3, color=YELLOW, spaceAfter=12))
story.append(Paragraph('TotemDigital Studio', styles['CoverTitle']))
story.append(Paragraph('Avaliação Comercial e de Produto', styles['CoverTitle']))
story.append(Spacer(1, 0.4 * cm))
story.append(Paragraph('Capacidades · Objetivos · Público-alvo · Forças e riscos', styles['CoverSub']))
story.append(Paragraph('Plano de divulgação · Venda · Focos comerciais', styles['CoverSub']))
story.append(Spacer(1, 0.6 * cm))
story.append(HRFlowable(width='100%', thickness=1, color=BORDER, spaceAfter=12))
story.append(Paragraph('Versão 1.0 — 23 de julho de 2026', styles['CoverSub']))
story.append(Paragraph('Repositório: Julio-Eyras/TotemDigital-Studio', styles['CoverSub']))
story.append(Paragraph('Branch: SmartSignage-direc-totem', styles['CoverSub']))
story.append(Spacer(1, 1.2 * cm))
story.append(Paragraph(
    esc('Veredito: produto tecnicamente **forte** (painel + Player-AD + kit de campo); comercialmente o ganho está em focar a oferta monousuário + kit hardware, sem diluir a mensagem com toda a complexidade multi-tenant.'),
    styles['QuoteDoc']
))
story.append(PageBreak())

lines = text.splitlines()
i = 0
while i < len(lines) and not lines[i].startswith('## 1.'):
    i += 1

in_code = False
code_buf = []
table_buf = []


def flush_table():
    global table_buf
    if table_buf:
        story.append(parse_table(table_buf))
        story.append(Spacer(1, 6))
        table_buf = []


def flush_code():
    global code_buf, in_code
    if code_buf:
        story.append(Paragraph(esc('<br/>'.join(code_buf)), styles['CodeDoc']))
        code_buf = []
    in_code = False


while i < len(lines):
    line = lines[i]
    if line.startswith('```'):
        if in_code:
            flush_code()
        else:
            flush_table()
            in_code = True
            code_buf = []
        i += 1
        continue
    if in_code:
        code_buf.append(line)
        i += 1
        continue
    if line.strip().startswith('|'):
        table_buf.append(line)
        i += 1
        continue
    else:
        flush_table()

    if line.startswith('---'):
        story.append(HRFlowable(width='100%', thickness=0.6, color=BORDER, spaceBefore=6, spaceAfter=6))
        i += 1
        continue
    if line.startswith('## '):
        story.append(Paragraph(esc(line[3:]), styles['H1Doc']))
        i += 1
        continue
    if line.startswith('### '):
        story.append(Paragraph(esc(line[4:]), styles['H2Doc']))
        i += 1
        continue
    if line.startswith('#### '):
        story.append(Paragraph(esc(line[5:]), styles['H3Doc']))
        i += 1
        continue
    if re.match(r'^\s*>\s*', line):
        q = re.sub(r'^\s*>\s*', '', line)
        story.append(Paragraph(esc(q), styles['QuoteDoc']))
        i += 1
        continue
    if re.match(r'^[-*]\s+', line) or re.match(r'^\d+\.\s+', line):
        content = re.sub(r'^[-*]\s+', '', line)
        content = re.sub(r'^\d+\.\s+', '', content)
        story.append(Paragraph('• ' + esc(content), styles['BulletDoc']))
        i += 1
        continue
    if not line.strip():
        story.append(Spacer(1, 4))
        i += 1
        continue
    if line.startswith('# '):
        i += 1
        continue
    story.append(Paragraph(esc(line), styles['BodyDoc']))
    i += 1

flush_table()
flush_code()


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(YELLOW)
    canvas.rect(0, A4[1] - 6, A4[0], 6, fill=1, stroke=0)
    canvas.setFillColor(MUTED)
    canvas.setFont('Helvetica', 8)
    canvas.drawString(1.8 * cm, 1.1 * cm, 'TotemDigital Studio — Avaliação Comercial')
    canvas.drawRightString(A4[0] - 1.8 * cm, 1.1 * cm, f'{doc.page}')
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(pdf_path),
    pagesize=A4,
    leftMargin=1.8 * cm,
    rightMargin=1.8 * cm,
    topMargin=1.6 * cm,
    bottomMargin=1.8 * cm,
    title='TotemDigital Studio — Avaliação Comercial e de Produto',
    author='TotemDigital Studio',
)
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print('PDF_OK', pdf_path.resolve(), pdf_path.stat().st_size)
