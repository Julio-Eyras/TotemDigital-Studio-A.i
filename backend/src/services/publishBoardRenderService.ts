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

const HEADER_RATIO = 0.11;
const PAD_X_RATIO = 0.05;
const PAD_Y_RATIO = 0.03;

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

function wrapText(text: string, maxChars: number): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars - 1) + '…' : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface TextBlock {
  lines: string[];
  fontSize: number;
  fontWeight?: number;
  fill?: string;
  lineHeightRatio?: number;
}

function textBlockSvg(x: number, startY: number, block: TextBlock): { svg: string; endY: number } {
  const lh = block.lineHeightRatio ?? 1.35;
  const parts: string[] = [];
  let y = startY;
  for (const line of block.lines) {
    parts.push(
      `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${block.fontSize}" font-weight="${block.fontWeight ?? 700}" fill="${block.fill ?? '#ffffff'}">${escapeXml(line)}</text>`
    );
    y += block.fontSize * lh;
  }
  return { svg: parts.join('\n  '), endY: y };
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

function buildMenuBlocks(
  input: PublishBoardRenderInput,
  width: number,
  bodyTop: number,
  bodyHeight: number
): string {
  const portrait = input.orientation !== 'landscape';
  const padX = Math.round(width * PAD_X_RATIO);
  const products = (input.menuLines || []).slice(0, 28);
  const showPrices = input.showPrices !== false;
  const maxChars = portrait ? 28 : 42;

  if (!products.length) {
    const block = textBlockSvg(padX, bodyTop + bodyHeight * 0.2, {
      lines: ['Cadastre produtos no cardápio'],
      fontSize: portrait ? 36 : 40,
      fontWeight: 600,
      fill: '#e0e0e0',
    });
    return block.svg;
  }

  const rowGap = 8;
  let rowHeight = Math.floor((bodyHeight - rowGap) / products.length);
  let nameSize = portrait
    ? Math.min(40, Math.max(22, Math.floor(rowHeight * 0.45)))
    : Math.min(44, Math.max(24, Math.floor(rowHeight * 0.42)));
  let descSize = Math.max(16, Math.floor(nameSize * 0.62));

  const parts: string[] = [];
  let y = bodyTop + Math.round(bodyHeight * PAD_Y_RATIO);

  for (const product of products) {
    if (y > bodyTop + bodyHeight - nameSize) break;
    const price = showPrices ? formatPrice(product.price) : '';
    const pricePart = price ? ` — ${price}` : '';
    const nameLines = wrapText(`${product.name}${pricePart}`, maxChars);
    const nameBlock = textBlockSvg(padX, y, {
      lines: nameLines.slice(0, 2),
      fontSize: nameSize,
      fontWeight: 700,
    });
    parts.push(nameBlock.svg);
    y = nameBlock.endY + 4;

    if (product.description && y < bodyTop + bodyHeight - descSize) {
      const descBlock = textBlockSvg(padX + (portrait ? 12 : 16), y, {
        lines: wrapText(String(product.description), maxChars + 10).slice(0, 2),
        fontSize: descSize,
        fontWeight: 400,
        fill: '#f0e6d8',
        lineHeightRatio: 1.25,
      });
      parts.push(descBlock.svg);
      y = descBlock.endY + rowGap;
    } else {
      y += rowGap;
    }
  }
  return parts.join('\n  ');
}

function buildDistributedBlocks(
  blocks: TextBlock[],
  x: number,
  bodyTop: number,
  bodyHeight: number
): string {
  const totalLines = blocks.reduce((sum, b) => sum + Math.max(1, b.lines.length), 0);
  if (!totalLines) return '';
  const slot = bodyHeight / blocks.length;
  const parts: string[] = [];
  blocks.forEach((block, idx) => {
    const slotTop = bodyTop + slot * idx + slot * 0.12;
    const rendered = textBlockSvg(x, slotTop, block);
    parts.push(rendered.svg);
  });
  return parts.join('\n  ');
}

function buildSvg(input: PublishBoardRenderInput): string {
  const portrait = input.orientation !== 'landscape';
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  const accent = input.accentColor || '#1976d2';
  const title = escapeXml(input.boardTitle || 'Publicação');
  const content = input.content || {};
  const blockOrder = input.blockOrder || [];
  const padX = Math.round(width * PAD_X_RATIO);
  const headerH = Math.round(height * HEADER_RATIO);
  const bodyTop = headerH;
  const bodyHeight = height - headerH;
  const titleSize = portrait ? Math.round(headerH * 0.42) : Math.round(headerH * 0.48);
  const titleY = Math.round(headerH * 0.68);
  const maxChars = portrait ? 22 : 36;

  let bodySvg = '';

  if (input.preset === 'menu' && input.menuLines?.length) {
    bodySvg = buildMenuBlocks(input, width, bodyTop, bodyHeight);
  } else if (input.preset === 'promotion') {
    bodySvg = buildDistributedBlocks(
      [
        {
          lines: wrapText(content.headline || 'Oferta em destaque', maxChars),
          fontSize: portrait ? 56 : 72,
          fontWeight: 800,
        },
        {
          lines: wrapText(content.offer || '', maxChars + 8),
          fontSize: portrait ? 40 : 48,
          fontWeight: 600,
        },
        {
          lines: wrapText(content.price || '', 16),
          fontSize: portrait ? 80 : 104,
          fontWeight: 800,
          fill: '#ffe082',
        },
        {
          lines: wrapText(content.urgency || '', maxChars),
          fontSize: portrait ? 32 : 38,
          fontWeight: 700,
          fill: '#ffecb3',
        },
      ].filter((b) => b.lines.length > 0),
      padX,
      bodyTop,
      bodyHeight
    );
  } else if (input.preset === 'ad') {
    const keys = ['headline', 'brand', 'message', 'cta'];
    const lines = wrapContentLines(content, blockOrder, keys);
    const blocks: TextBlock[] = [];
    if (content.logoUrl?.trim()) {
      blocks.push({
        lines: wrapText(String(content.logoUrl).trim(), maxChars + 20).slice(0, 1),
        fontSize: portrait ? 20 : 22,
        fontWeight: 400,
        fill: '#bbdefb',
      });
    }
    if (lines[0]) {
      blocks.push({ lines: wrapText(lines[0], maxChars), fontSize: portrait ? 60 : 76, fontWeight: 800 });
    }
    if (lines[1]) {
      blocks.push({ lines: wrapText(lines[1], maxChars), fontSize: portrait ? 36 : 44, fontWeight: 600, fill: '#e3f2fd' });
    }
    if (lines[2]) {
      blocks.push({
        lines: wrapText(lines[2], maxChars + 12),
        fontSize: portrait ? 30 : 34,
        fontWeight: 400,
        lineHeightRatio: 1.3,
      });
    }
    if (lines[3]) {
      blocks.push({ lines: wrapText(lines[3], maxChars), fontSize: portrait ? 34 : 40, fontWeight: 700, fill: '#bbdefb' });
    }
    bodySvg = buildDistributedBlocks(blocks, padX, bodyTop, bodyHeight);
  } else if (input.preset === 'announcement') {
    const keys = ['headline', 'message', 'eventInfo'];
    const lines = wrapContentLines(content, blockOrder, keys);
    const blocks: TextBlock[] = [];
    if (lines[0]) {
      blocks.push({ lines: wrapText(lines[0], maxChars), fontSize: portrait ? 52 : 64, fontWeight: 800 });
    }
    if (lines[1]) {
      blocks.push({
        lines: wrapText(lines[1], maxChars + 14),
        fontSize: portrait ? 32 : 36,
        fontWeight: 400,
        lineHeightRatio: 1.35,
      });
    }
    if (lines[2]) {
      blocks.push({ lines: wrapText(lines[2], maxChars + 8), fontSize: portrait ? 28 : 32, fontWeight: 600, fill: '#e1bee7' });
    }
    bodySvg = buildDistributedBlocks(blocks, padX, bodyTop, bodyHeight);
  } else {
    const keys = ['headline', 'message', 'line1', 'line2', 'line3'];
    const lines = wrapContentLines(content, blockOrder, keys);
    const blocks: TextBlock[] = [];
    if (content.logoUrl?.trim()) {
      blocks.push({
        lines: wrapText(String(content.logoUrl).trim(), maxChars + 20).slice(0, 1),
        fontSize: portrait ? 20 : 22,
        fontWeight: 400,
        fill: '#c8e6c9',
      });
    }
    if (lines[0]) {
      blocks.push({ lines: wrapText(lines[0], maxChars), fontSize: portrait ? 52 : 64, fontWeight: 800 });
    }
    if (lines[1]) {
      blocks.push({
        lines: wrapText(lines[1], maxChars + 12),
        fontSize: portrait ? 30 : 34,
        fontWeight: 400,
        lineHeightRatio: 1.3,
      });
    }
    for (let i = 2; i < lines.length; i++) {
      blocks.push({
        lines: [`• ${wrapText(lines[i], maxChars)[0] || lines[i]}`],
        fontSize: portrait ? 28 : 32,
        fontWeight: 600,
      });
    }
    bodySvg = buildDistributedBlocks(blocks, padX, bodyTop, bodyHeight);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117"/>
      <stop offset="100%" style="stop-color:${accent}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${width}" height="${headerH}" fill="rgba(0,0,0,0.38)"/>
  <text x="${padX}" y="${titleY}" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="800" fill="#ffffff">${title}</text>
  ${bodySvg}
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
