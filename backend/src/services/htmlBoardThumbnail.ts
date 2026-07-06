import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export interface HtmlBoardThumbnailInput {
  boardTitle: string;
  accentColor?: string;
  presetLabel?: string;
  footerLabel?: string;
}

function escapeSvgText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Quebra título longo em linhas para SVG (evita corte nos cards Mídias). */
export function wrapTitleForSvg(title: string, maxCharsPerLine = 22, maxLines = 3): string[] {
  const words = String(title || 'Conteúdo HTML')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return ['Conteúdo HTML'];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxCharsPerLine ? `${word.slice(0, maxCharsPerLine - 1)}…` : word;
    if (lines.length >= maxLines - 1) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length > maxLines) return lines.slice(0, maxLines);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > maxCharsPerLine - 1
      ? `${last.slice(0, maxCharsPerLine - 1)}…`
      : `${last}…`;
  }
  return lines.length ? lines : ['Conteúdo HTML'];
}

export function buildHtmlBoardThumbnailSvg(input: HtmlBoardThumbnailInput): string {
  const accent =
    input.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(input.accentColor)
      ? input.accentColor
      : '#ff9800';
  const titleLines = wrapTitleForSvg(input.boardTitle);
  const label = escapeSvgText((input.presetLabel || 'HTML').slice(0, 32));
  const footer = escapeSvgText(input.footerLabel || 'HTML ao vivo');
  const lineHeight = 32;
  const startY = 300 - ((titleLines.length - 1) * lineHeight) / 2;
  const titleSvg = titleLines
    .map((line, i) => {
      const y = startY + i * lineHeight;
      return `<text x="180" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeSvgText(line)}</text>`;
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${accent}"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="360" height="640" fill="url(#bg)"/>
  ${titleSvg}
  <text x="180" y="380" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="#f0f0f0" text-anchor="middle" opacity="0.9">${label}</text>
  <text x="180" y="580" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#cccccc" text-anchor="middle">${footer}</text>
</svg>`;
}

export async function writeHtmlBoardThumbnail(
  outputPath: string,
  input: HtmlBoardThumbnailInput
): Promise<string | null> {
  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const svg = buildHtmlBoardThumbnailSvg(input);
    await (sharp as any)(Buffer.from(svg))
      .resize(360, 640, { fit: 'cover' })
      .jpeg({ quality: 86, progressive: true })
      .toFile(outputPath);
    return fs.existsSync(outputPath) ? outputPath : null;
  } catch {
    return null;
  }
}

export function htmlBoardThumbPathForFile(htmlFilePath: string): string {
  return htmlFilePath.replace(/\.[^/.]+$/, '_thumb.jpg');
}
