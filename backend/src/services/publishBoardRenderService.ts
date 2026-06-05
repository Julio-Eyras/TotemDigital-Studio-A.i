import sharp from 'sharp';

export type PublishBoardPresetType = 'menu' | 'promotion' | 'ad' | 'announcement' | 'institutional';

export interface MenuRenderLine {
  name: string;
  price: number | null;
  description?: string | null;
}

export interface PublishBoardRenderInput {
  preset: PublishBoardPresetType;
  boardTitle: string;
  accentColor?: string;
  orientation?: 'portrait' | 'landscape';
  showPrices?: boolean;
  content?: Record<string, string>;
  blockOrder?: string[];
  menuLines?: MenuRenderLine[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatPrice(price: number | null): string {
  if (price == null || Number.isNaN(price)) return '';
  return `R$ ${Number(price).toFixed(2).replace('.', ',')}`;
}

function textLine(x: number, y: number, text: string, size: number, weight = 700, fill = '#ffffff'): string {
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(text)}</text>`;
}

function wrapContentLines(
  content: Record<string, string>,
  blockOrder: string[],
  keys: string[]
): string[] {
  const order = blockOrder.length > 0 ? blockOrder : keys;
  const lines: string[] = [];
  for (const key of order) {
    const val = String(content[key] || '').trim();
    if (val) lines.push(val);
  }
  return lines;
}

function buildSvg(input: PublishBoardRenderInput): string {
  const portrait = input.orientation !== 'landscape';
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  const accent = input.accentColor || '#1976d2';
  const title = escapeXml(input.boardTitle || 'Publicação');
  const content = input.content || {};
  const blockOrder = input.blockOrder || [];

  const bodyLines: string[] = [];
  let y = portrait ? 200 : 160;

  if (input.preset === 'menu' && input.menuLines?.length) {
    const showPrices = input.showPrices !== false;
    for (const product of input.menuLines.slice(0, 24)) {
      const price = showPrices ? formatPrice(product.price) : '';
      const pricePart = price ? ` — ${price}` : '';
      bodyLines.push(textLine(80, y, `${product.name}${pricePart}`, portrait ? 36 : 40));
      y += portrait ? 52 : 48;
      if (product.description) {
        bodyLines.push(textLine(96, y, String(product.description).slice(0, 80), 24, 400, '#f0e6d8'));
        y += 34;
      }
      if (y > height - 100) break;
    }
  } else if (input.preset === 'promotion') {
    const headline = content.headline || 'Oferta em destaque';
    const offer = content.offer || '';
    const price = content.price || '';
    const urgency = content.urgency || '';
    bodyLines.push(textLine(80, y, headline, portrait ? 52 : 64, 800));
    y += portrait ? 80 : 90;
    if (offer) {
      bodyLines.push(textLine(80, y, offer, portrait ? 40 : 48, 600));
      y += portrait ? 60 : 70;
    }
    if (price) {
      bodyLines.push(textLine(80, y, price, portrait ? 72 : 96, 800, '#ffe082'));
      y += portrait ? 90 : 110;
    }
    if (urgency) {
      bodyLines.push(textLine(80, height - 120, urgency, portrait ? 32 : 36, 700, '#ffecb3'));
    }
  } else if (input.preset === 'ad') {
    const keys = ['headline', 'brand', 'message', 'cta'];
    const lines = wrapContentLines(content, blockOrder, keys);
    bodyLines.push(textLine(80, y, lines[0] || 'Anúncio', portrait ? 56 : 72, 800));
    y += portrait ? 90 : 100;
    if (lines[1]) {
      bodyLines.push(textLine(80, y, lines[1], portrait ? 36 : 42, 600, '#e3f2fd'));
      y += portrait ? 50 : 60;
    }
    if (lines[2]) {
      bodyLines.push(textLine(80, y, lines[2], portrait ? 30 : 34, 400, '#ffffff'));
      y += portrait ? 70 : 80;
    }
    if (lines[3]) {
      bodyLines.push(textLine(80, height - 100, lines[3], portrait ? 34 : 40, 700, '#bbdefb'));
    }
  } else if (input.preset === 'announcement') {
    const keys = ['headline', 'message', 'eventInfo'];
    const lines = wrapContentLines(content, blockOrder, keys);
    bodyLines.push(textLine(80, y, lines[0] || 'Comunicado', portrait ? 52 : 64, 800));
    y += portrait ? 80 : 90;
    if (lines[1]) {
      bodyLines.push(textLine(80, y, lines[1], portrait ? 32 : 36, 400));
      y += portrait ? 100 : 110;
    }
    if (lines[2]) {
      bodyLines.push(textLine(80, y, lines[2], portrait ? 28 : 32, 600, '#e1bee7'));
    }
  } else {
    const keys = ['headline', 'message', 'line1', 'line2', 'line3'];
    const lines = wrapContentLines(content, blockOrder, keys);
    bodyLines.push(textLine(80, y, lines[0] || 'Institucional', portrait ? 52 : 64, 800));
    y += portrait ? 80 : 90;
    if (lines[1]) {
      bodyLines.push(textLine(80, y, lines[1], portrait ? 30 : 34, 400));
      y += portrait ? 70 : 80;
    }
    for (let i = 2; i < lines.length; i++) {
      bodyLines.push(textLine(100, y, `• ${lines[i]}`, portrait ? 28 : 32, 600));
      y += portrait ? 44 : 48;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:${accent}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="100%" height="${portrait ? 140 : 120}" fill="rgba(0,0,0,0.35)"/>
  <text x="80" y="${portrait ? 95 : 80}" font-family="Arial, Helvetica, sans-serif" font-size="${portrait ? 56 : 48}" font-weight="800" fill="#ffffff">${title}</text>
  ${bodyLines.join('\n  ')}
</svg>`;
}

export async function renderPublishBoardPng(input: PublishBoardRenderInput): Promise<Buffer> {
  const svg = buildSvg(input);
  return new sharp(Buffer.from(svg)).png().toBuffer();
}

/** @deprecated use renderPublishBoardPng */
export async function renderMenuBoardPng(options: {
  boardTitle: string;
  accentColor?: string;
  showPrices?: boolean;
  products: MenuRenderLine[];
}): Promise<Buffer> {
  return renderPublishBoardPng({
    preset: 'menu',
    boardTitle: options.boardTitle,
    accentColor: options.accentColor,
    orientation: 'portrait',
    showPrices: options.showPrices,
    menuLines: options.products,
  });
}
