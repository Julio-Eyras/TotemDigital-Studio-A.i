import { getDatabase } from '../config/database';
import { getMediaService } from './mediaService';
import { getMenuCatalogService } from './menuCatalogService';
import { renderPublishBoardPng, PublishBoardPresetType } from './publishBoardRenderService';
import { findPublishPreset } from '../config/publishBoardDefaults';

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
      menuLines = [...orderedIds, ...missing].map((id) => {
        const p = byId.get(id)!;
        return {
          name: p.name,
          price: p.price,
          description: p.description,
          categoryName: p.categoryId ? categoryMap.get(p.categoryId) : null,
        };
      });
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

    return { mediaId: media.id, name: media.name };
  }
}

let instance: PublishBoardService | null = null;

export function getPublishBoardService(): PublishBoardService {
  if (!instance) instance = new PublishBoardService();
  return instance;
}
