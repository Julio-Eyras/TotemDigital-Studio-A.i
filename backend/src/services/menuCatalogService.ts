import { getDatabase } from '../config/database';
import { getPublishBoardService } from './publishBoardService';

export interface MenuBoardLayout {
  subscriberId: number;
  boardTitle: string;
  accentColor: string;
  productOrder: number[];
  showPrices: boolean;
}

export interface MenuCategory {
  categoryId: number;
  subscriberId: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuProduct {
  productId: number;
  subscriberId: number;
  categoryId: number | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  mediaId: number | null;
  sortOrder: number;
  isAvailable: boolean;
  isActive: boolean;
}

export class MenuCatalogService {
  private get db() {
    return getDatabase();
  }

  async listCategories(subscriberId: number): Promise<MenuCategory[]> {
    const rows = await this.db.findMany(`
      SELECT * FROM menu_categories
      WHERE subscriber_id = $1 AND is_active = true
      ORDER BY sort_order ASC, category_id ASC
    `, [subscriberId]);
    return rows.map(this.mapCategory);
  }

  async listProducts(subscriberId: number, categoryId?: number): Promise<MenuProduct[]> {
    const params: unknown[] = [subscriberId];
    let sql = `
      SELECT * FROM menu_products
      WHERE subscriber_id = $1 AND is_active = true
    `;
    if (categoryId != null) {
      params.push(categoryId);
      sql += ` AND category_id = $${params.length}`;
    }
    sql += ' ORDER BY sort_order ASC, product_id ASC';
    const rows = await this.db.findMany(sql, params);
    return rows.map(this.mapProduct);
  }

  async createCategory(subscriberId: number, name: string, sortOrder = 0): Promise<MenuCategory> {
    const result = await this.db.executeRaw(`
      INSERT INTO menu_categories (subscriber_id, name, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [subscriberId, name, sortOrder]);
    return this.mapCategory(result.rows[0]);
  }

  async createProduct(input: {
    subscriberId: number;
    categoryId?: number | null;
    name: string;
    description?: string;
    price?: number;
    currency?: string;
    mediaId?: number | null;
    sortOrder?: number;
    isAvailable?: boolean;
  }): Promise<MenuProduct> {
    const result = await this.db.executeRaw(`
      INSERT INTO menu_products (
        subscriber_id, category_id, name, description, price, currency,
        media_id, sort_order, is_available
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      input.subscriberId,
      input.categoryId ?? null,
      input.name,
      input.description ?? null,
      input.price ?? null,
      input.currency ?? 'BRL',
      input.mediaId ?? null,
      input.sortOrder ?? 0,
      input.isAvailable !== false,
    ]);
    return this.mapProduct(result.rows[0]);
  }

  async updateProduct(
    productId: number,
    subscriberId: number,
    patch: Partial<{
      name: string;
      description: string | null;
      price: number | null;
      categoryId: number | null;
      mediaId: number | null;
      sortOrder: number;
      isAvailable: boolean;
      isActive: boolean;
    }>
  ): Promise<MenuProduct | null> {
    const existing = await this.db.findFirst(`
      SELECT product_id FROM menu_products
      WHERE product_id = $1 AND subscriber_id = $2
    `, [productId, subscriberId]);
    if (!existing) return null;

    const result = await this.db.executeRaw(`
      UPDATE menu_products SET
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        price = COALESCE($5, price),
        category_id = COALESCE($6, category_id),
        media_id = COALESCE($7, media_id),
        sort_order = COALESCE($8, sort_order),
        is_available = COALESCE($9, is_available),
        is_active = COALESCE($10, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $1 AND subscriber_id = $2
      RETURNING *
    `, [
      productId,
      subscriberId,
      patch.name ?? null,
      patch.description ?? null,
      patch.price ?? null,
      patch.categoryId ?? null,
      patch.mediaId ?? null,
      patch.sortOrder ?? null,
      patch.isAvailable ?? null,
      patch.isActive ?? null,
    ]);
    return this.mapProduct(result.rows[0]);
  }

  async deleteProduct(productId: number, subscriberId: number): Promise<boolean> {
    const result = await this.db.executeRaw(`
      UPDATE menu_products SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $1 AND subscriber_id = $2
    `, [productId, subscriberId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getBoardLayout(subscriberId: number): Promise<MenuBoardLayout> {
    const layout = await getPublishBoardService().getLayout(subscriberId, 'menu');
    return {
      subscriberId: layout.subscriberId,
      boardTitle: layout.boardTitle,
      accentColor: layout.accentColor,
      productOrder: layout.productOrder,
      showPrices: layout.showPrices,
    };
  }

  async saveBoardLayout(layout: MenuBoardLayout): Promise<MenuBoardLayout> {
    const saved = await getPublishBoardService().saveLayout({
      subscriberId: layout.subscriberId,
      preset: 'menu',
      boardTitle: layout.boardTitle,
      accentColor: layout.accentColor,
      preferredOrientation: 'portrait',
      content: {},
      blockOrder: [],
      productOrder: layout.productOrder,
      showPrices: layout.showPrices,
    });
    return {
      subscriberId: saved.subscriberId,
      boardTitle: saved.boardTitle,
      accentColor: saved.accentColor,
      productOrder: saved.productOrder,
      showPrices: saved.showPrices,
    };
  }

  async renderBoardToMedia(
    subscriberId: number,
    userId: number,
    isAdmin: boolean
  ): Promise<{ mediaId: number; name: string }> {
    return getPublishBoardService().renderToMedia(subscriberId, 'menu', userId, isAdmin);
  }

  private mapCategory(row: any): MenuCategory {
    return {
      categoryId: row.category_id,
      subscriberId: row.subscriber_id,
      name: row.name,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active !== false,
    };
  }

  private mapProduct(row: any): MenuProduct {
    return {
      productId: row.product_id,
      subscriberId: row.subscriber_id,
      categoryId: row.category_id,
      name: row.name,
      description: row.description,
      price: row.price != null ? Number(row.price) : null,
      currency: row.currency || 'BRL',
      mediaId: row.media_id,
      sortOrder: row.sort_order ?? 0,
      isAvailable: row.is_available !== false,
      isActive: row.is_active !== false,
    };
  }
}

let menuInstance: MenuCatalogService | null = null;

export function getMenuCatalogService(): MenuCatalogService {
  if (!menuInstance) menuInstance = new MenuCatalogService();
  return menuInstance;
}
