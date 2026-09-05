/**
 * Onda B: revisão do catálogo para cardápio HTML ao vivo (triggers em mudanças de preço/produto).
 * Não republica campanhas — telas com mídia HTML consultam /public-menu periodicamente.
 */

import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface MenuCatalogRevision {
  revision: string;
  productCount: number;
}

export class MenuCatalogTriggerService {
  private get db() {
    return getDatabase();
  }

  getLiveRefreshSeconds(): number {
    const raw = parseInt(String(process.env.MENU_LIVE_REFRESH_SECONDS || '30'), 10);
    if (!Number.isFinite(raw)) return 30;
    return Math.max(5, Math.min(300, raw));
  }

  async getCatalogRevision(subscriberId: number): Promise<MenuCatalogRevision> {
    const row = await this.db.findFirst(`
      SELECT
        COUNT(*)::int AS product_count,
        COALESCE(
          to_char(MAX(updated_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          '0'
        ) AS revision
      FROM menu_products
      WHERE subscriber_id = $1 AND is_active = true
    `, [subscriberId]);

    return {
      revision: String(row?.revision || '0'),
      productCount: Number(row?.product_count || 0),
    };
  }

  async notifyCatalogChanged(
    subscriberId: number,
    trigger: 'product_created' | 'product_updated' | 'product_deleted',
    productId?: number
  ): Promise<void> {
    try {
      const revision = await this.getCatalogRevision(subscriberId);
      await this.db.executeRaw(`
        INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, timestamp)
        VALUES (NULL, 'menu_catalog_changed', 'subscriber', $1, $2::jsonb, CURRENT_TIMESTAMP)
      `, [
        subscriberId,
        JSON.stringify({
          trigger,
          productId: productId ?? null,
          catalogRevision: revision.revision,
          at: new Date().toISOString(),
        }),
      ]);
} catch (error: unknown) {
      await logError('menuCatalogTrigger: falha ao registrar mudança de catálogo', error);
    }
  }
}

let instance: MenuCatalogTriggerService | null = null;

export function getMenuCatalogTriggerService(): MenuCatalogTriggerService {
  if (!instance) instance = new MenuCatalogTriggerService();
  return instance;
}
