import { getDatabase } from '../config/database';
import { getMediaService } from './mediaService';
import { getMenuCatalogService } from './menuCatalogService';
import { renderPublishBoardPng, PublishBoardPresetType } from './publishBoardRenderService';
import { renderPublishBoardHtml } from './publishBoardHtmlRenderService';
import { findPublishPreset } from '../config/publishBoardDefaults';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export interface PublishBoardLayout {
  subscriberId: number;
  preset: PublishBoardPresetType;
  boardTitle: string;
  accentColor: string;
  preferredOrientation: 'portrait' | 'landscape';
  content: Record<string, string>;
  blockOrder: string[];
  productOrder: number[];
  showPrices: boolean;
}

const VALID_PRESETS: PublishBoardPresetType[] = ['menu', 'promotion', 'ad', 'announcement', 'institutional'];

function normalizePreset(value: string): PublishBoardPresetType {
  return VALID_PRESETS.includes(value as PublishBoardPresetType)
    ? (value as PublishBoardPresetType)
    : 'ad';
}

function parseJsonArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function parseProductOrder(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(Number).filter((n) => n > 0);
}

function escapeSvgText(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function generateHtmlBoardThumbnail(
  htmlFilePath: string,
  boardTitle: string,
  accentColor: string,
  presetLabel: string
): Promise<string | null> {
  try {
    const thumbPath = htmlFilePath.replace(/\.[^/.]+$/, '_thumb.jpg');
    const accent = accentColor && /^#[0-9a-fA-F]{3,8}$/.test(accentColor) ? accentColor : '#ff9800';
    const title = escapeSvgText(boardTitle.slice(0, 48) || 'Conteúdo HTML');
    const label = escapeSvgText(presetLabel.slice(0, 32));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${accent}"/>
      <stop offset="100%" style="stop-color:#0d1117"/>
    </linearGradient>
  </defs>
  <rect width="360" height="640" fill="url(#bg)"/>
  <text x="180" y="290" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">${title}</text>
  <text x="180" y="340" font-family="Arial,Helvetica,sans-serif" font-size="15" fill="#f0f0f0" text-anchor="middle" opacity="0.9">${label}</text>
  <text x="180" y="580" font-family="Arial,Helvetica,sans-serif" font-size="13" fill="#cccccc" text-anchor="middle">HTML ao vivo</text>
</svg>`;
    const dir = path.dirname(thumbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await (sharp as any)(Buffer.from(svg))
      .resize(360, 640, { fit: 'cover' })
      .jpeg({ quality: 86, progressive: true })
      .toFile(thumbPath);
    return thumbPath;
  } catch {
    return null;
  }
}

function parseContent(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = String(v ?? '');
  }
  return out;
}

export class PublishBoardService {
  private get db() {
    return getDatabase();
  }

  async getLayout(subscriberId: number, presetInput: string): Promise<PublishBoardLayout> {
    const preset = normalizePreset(presetInput);
    const defaults = findPublishPreset(preset);

    const row = await this.db.findFirst(`
      SELECT * FROM publish_board_layouts
      WHERE subscriber_id = $1 AND preset = $2
    `, [subscriberId, preset]);

    if (!row) {
      return {
        subscriberId,
        preset,
        boardTitle: defaults.defaultTitle,
        accentColor: defaults.accentColor,
        preferredOrientation: defaults.preferredOrientation,
        content: { ...defaults.defaultContent },
        blockOrder: [...defaults.defaultBlockOrder],
        productOrder: [],
        showPrices: preset === 'menu',
      };
    }

    return {
      subscriberId,
      preset,
      boardTitle: row.board_title || defaults.defaultTitle,
      accentColor: row.accent_color || defaults.accentColor,
      preferredOrientation:
        row.preferred_orientation === 'portrait' ? 'portrait' : 'landscape',
      content: { ...defaults.defaultContent, ...parseContent(row.content) },
      blockOrder: parseJsonArray(row.block_order).length
        ? parseJsonArray(row.block_order)
        : [...defaults.defaultBlockOrder],
      productOrder: parseProductOrder(row.product_order),
      showPrices: row.show_prices !== false,
    };
  }

  async saveLayout(layout: PublishBoardLayout): Promise<PublishBoardLayout> {
    const preset = normalizePreset(layout.preset);
    await this.db.executeRaw(`
      INSERT INTO publish_board_layouts (
        subscriber_id, preset, board_title, accent_color, preferred_orientation,
        content, block_order, product_order, show_prices
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)
      ON CONFLICT (subscriber_id, preset) DO UPDATE SET
        board_title = $3,
        accent_color = $4,
        preferred_orientation = $5,
        content = $6::jsonb,
        block_order = $7::jsonb,
        product_order = $8::jsonb,
        show_prices = $9,
        updated_at = CURRENT_TIMESTAMP
    `, [
      layout.subscriberId,
      preset,
      layout.boardTitle,
      layout.accentColor,
      layout.preferredOrientation,
      JSON.stringify(layout.content || {}),
      JSON.stringify(layout.blockOrder || []),
      JSON.stringify(layout.productOrder || []),
      layout.showPrices !== false,
    ]);
    return this.getLayout(layout.subscriberId, preset);
  }

  private async buildMenuLines(
    subscriberId: number,
    layout: PublishBoardLayout
  ): Promise<{ name: string; price: number | null; description?: string | null }[]> {
    const menuService = getMenuCatalogService();
    const categories = await menuService.listCategories(subscriberId);
    const products = (await menuService.listProducts(subscriberId)).filter((p) => p.isAvailable);
    const categoryMap = new Map(categories.map((c) => [c.categoryId, c.name]));
    const byId = new Map(products.map((p) => [p.productId, p]));
    const orderedIds =
      layout.productOrder.length > 0
        ? layout.productOrder.filter((id) => byId.has(id))
        : products.map((p) => p.productId);
    const missing = products.map((p) => p.productId).filter((id) => !orderedIds.includes(id));
    return [...orderedIds, ...missing].map((id) => {
      const p = byId.get(id)!;
      return {
        name: p.name,
        price: p.price,
        description: p.description,
        categoryName: p.categoryId ? categoryMap.get(p.categoryId) : null,
      };
    });
  }

  async previewHtml(subscriberId: number, presetInput: string): Promise<string> {
    const preset = normalizePreset(presetInput);
    const layout = await this.getLayout(subscriberId, preset);
    let menuLines: { name: string; price: number | null; description?: string | null }[] | undefined;
    if (preset === 'menu') {
      menuLines = await this.buildMenuLines(subscriberId, layout);
    }
    return renderPublishBoardHtml({
      preset,
      boardTitle: layout.boardTitle,
      accentColor: layout.accentColor,
      orientation: layout.preferredOrientation,
      showPrices: layout.showPrices,
      content: layout.content,
      blockOrder: layout.blockOrder,
      menuLines,
      subscriberId,
      productOrder: layout.productOrder,
    });
  }

  async renderToMediaHtml(
    subscriberId: number,
    presetInput: string,
    userId: number,
    isAdmin: boolean,
    replaceMediaId?: number
  ): Promise<{ mediaId: number; name: string; mediaType: string; replaced?: boolean }> {
    const preset = normalizePreset(presetInput);
    const layout = await this.getLayout(subscriberId, preset);
    const presetMeta = findPublishPreset(preset);

    let menuLines: { name: string; price: number | null; description?: string | null }[] | undefined;

    if (preset === 'menu') {
      menuLines = await this.buildMenuLines(subscriberId, layout);
      if (!menuLines.length) {
        throw new Error('Cadastre ao menos um produto disponível no cardápio');
      }
    } else {
      const hasText = Object.values(layout.content).some((v) => String(v).trim());
      if (!hasText) {
        throw new Error('Preencha ao menos um campo de texto do template antes de gerar a animação');
      }
    }

    const html = renderPublishBoardHtml({
      preset,
      boardTitle: layout.boardTitle,
      accentColor: layout.accentColor,
      orientation: layout.preferredOrientation,
      showPrices: layout.showPrices,
      content: layout.content,
      blockOrder: layout.blockOrder,
      menuLines,
      subscriberId,
      productOrder: layout.productOrder,
      forTotemDelivery: true,
    });

    const htmlBuffer = Buffer.from(html, 'utf-8');
    const mediaName = `${layout.boardTitle} — ${presetMeta.label} (HTML)`;
    const filePayload = {
      buffer: htmlBuffer,
      originalname: `board-${preset}-${subscriberId}-${Date.now()}.html`,
      mimetype: 'text/html',
      size: htmlBuffer.length,
    };

    let targetMediaId = replaceMediaId;
    if (targetMediaId) {
      const row = await this.db.findFirst(
        `SELECT media_id FROM medias WHERE media_id = $1 AND subscriber_id = $2`,
        [targetMediaId, subscriberId]
      );
      if (!row) targetMediaId = undefined;
    }

    if (!targetMediaId) {
      const byName = await this.db.findFirst(
        `
        SELECT media_id FROM medias
        WHERE subscriber_id = $1 AND name = $2 AND media_type = 'html'
        ORDER BY media_id DESC
        LIMIT 1
      `,
        [subscriberId, mediaName]
      );
      targetMediaId = byName?.media_id;
    }

    if (!targetMediaId) {
      const candidates = await this.db.findMany(
        `
        SELECT media_id, tags FROM medias
        WHERE subscriber_id = $1 AND media_type = 'html'
        ORDER BY updated_at DESC NULLS LAST, media_id DESC
        LIMIT 50
      `,
        [subscriberId]
      );
      const match = (candidates || []).find((row: { tags?: string[] }) => {
        const tags = Array.isArray(row.tags) ? row.tags.map(String) : [];
        return tags.includes('publish-board') && tags.includes(preset);
      });
      targetMediaId = match?.media_id;
    }

    if (targetMediaId) {
      const media = await getMediaService().replaceMediaFileContent(
        targetMediaId,
        filePayload,
        subscriberId,
        isAdmin
      );
      await this.db.executeRaw(
        `
        UPDATE medias
        SET status = 'approved',
            approval_status = 'approved',
            approved_by = $2,
            approved_at = CURRENT_TIMESTAMP,
            media_type = 'html',
            name = $3,
            description = $4,
            tags = $5
        WHERE media_id = $1
      `,
        [
          media.id,
          userId > 0 ? userId : null,
          mediaName,
          `Animação HTML ao vivo (${presetMeta.label}) — Publicar em Tela`,
          ['publish-board', preset, 'html-live', 'auto-generated'],
        ]
      );

      const filePath = media.filePath;
      if (filePath) {
        await generateHtmlBoardThumbnail(
          filePath,
          layout.boardTitle,
          layout.accentColor,
          presetMeta.label
        );
      }

      return { mediaId: media.id, name: mediaName, mediaType: 'html', replaced: true };
    }

    const media = await getMediaService().createMedia(
      {
        name: mediaName,
        description: `Animação HTML ao vivo (${presetMeta.label}) — Publicar em Tela`,
        tags: ['publish-board', preset, 'html-live', 'auto-generated'],
        file: filePayload,
        subscriberId,
        createdBy: userId,
      },
      subscriberId,
      isAdmin
    );

    await this.db.executeRaw(`
      UPDATE medias
      SET status = 'approved',
          approval_status = 'approved',
          approved_by = $2,
          approved_at = CURRENT_TIMESTAMP,
          media_type = 'html'
      WHERE media_id = $1
    `, [media.id, userId > 0 ? userId : null]);

    const filePath = media.filePath;
    if (filePath) {
      await generateHtmlBoardThumbnail(
        filePath,
        layout.boardTitle,
        layout.accentColor,
        presetMeta.label
      );
    }

    return { mediaId: media.id, name: media.name, mediaType: 'html', replaced: false };
  }

  async renderToMedia(
    subscriberId: number,
    presetInput: string,
    userId: number,
    isAdmin: boolean
  ): Promise<{ mediaId: number; name: string }> {
    const preset = normalizePreset(presetInput);
    const layout = await this.getLayout(subscriberId, preset);
    const presetMeta = findPublishPreset(preset);

    let menuLines: { name: string; price: number | null; description?: string | null }[] | undefined;

    if (preset === 'menu') {
      menuLines = await this.buildMenuLines(subscriberId, layout);
      if (!menuLines.length) {
        throw new Error('Cadastre ao menos um produto disponível no cardápio');
      }
    } else {
      const hasText = Object.values(layout.content).some((v) => String(v).trim());
      if (!hasText) {
        throw new Error('Preencha ao menos um campo de texto do template antes de gerar a mídia');
      }
    }

    const pngBuffer = await renderPublishBoardPng({
      preset,
      boardTitle: layout.boardTitle,
      accentColor: layout.accentColor,
      orientation: layout.preferredOrientation,
      showPrices: layout.showPrices,
      content: layout.content,
      blockOrder: layout.blockOrder,
      menuLines,
    });

    const media = await getMediaService().createMedia(
      {
        name: `${layout.boardTitle} — ${presetMeta.label}`,
        description: `Gerado automaticamente (${presetMeta.label}) — Studio`,
        tags: ['publish-board', preset, 'auto-generated'],
        file: {
          buffer: pngBuffer,
          originalname: `board-${preset}-${subscriberId}-${Date.now()}.png`,
          mimetype: 'image/png',
          size: pngBuffer.length,
        },
        subscriberId,
        createdBy: userId,
      },
      subscriberId,
      isAdmin
    );

    await this.db.executeRaw(`
      UPDATE medias
      SET status = 'approved',
          approval_status = 'approved',
          approved_by = $2,
          approved_at = CURRENT_TIMESTAMP
      WHERE media_id = $1
    `, [media.id, userId > 0 ? userId : null]);

    return { mediaId: media.id, name: media.name };
  }
}

let instance: PublishBoardService | null = null;

export function getPublishBoardService(): PublishBoardService {
  if (!instance) instance = new PublishBoardService();
  return instance;
}
