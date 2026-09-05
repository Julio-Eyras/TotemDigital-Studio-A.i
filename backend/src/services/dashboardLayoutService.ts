/**
 * Dashboard Layout Service - Smart Signage Pro v3.1
 * Serviço para gerenciar layouts customizáveis de dashboard
 */

import { getDatabase } from '../config/database';
import { logInfo, logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface DashboardLayout {
  id: number;
  userId: number;
  name: string;
  layoutData: {
    widgets: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      config: Record<string, any>;
    }>;
    gridColumns: number;
    gridRows: number;
  };
  isDefault: boolean;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDashboardLayoutRequest {
  userId: number;
  name: string;
  layoutData: DashboardLayout['layoutData'];
  isDefault?: boolean;
  isShared?: boolean;
}

export interface UpdateDashboardLayoutRequest {
  name?: string;
  layoutData?: DashboardLayout['layoutData'];
  isDefault?: boolean;
  isShared?: boolean;
}

export class DashboardLayoutService {
  private get db() {
    return getDatabase();
  }

  /**
   * Criar layout
   */
  async createLayout(data: CreateDashboardLayoutRequest): Promise<DashboardLayout> {
    try {
      // Se for default, desmarcar outros defaults do usuário
      if (data.isDefault) {
        await this.db.executeRaw(`
          UPDATE dashboard_layouts
          SET is_default = false
          WHERE user_id = $1
        `, [data.userId]);
      }

      const query = `
        INSERT INTO dashboard_layouts (user_id, name, layout_data, is_default, is_shared)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const result = await this.db.executeRaw(query, [
        data.userId,
        data.name,
        JSON.stringify(data.layoutData),
        data.isDefault || false,
        data.isShared || false
      ]);

      const layout = this.mapRowToLayout(result.rows[0]);
      await logInfo('Layout de dashboard criado', { layoutId: layout.id, userId: data.userId });
      return layout;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar layout de dashboard', e.error, data);
      throw new Error(`Erro ao criar layout: ${e.message}`);
    }
  }

  /**
   * Listar layouts do usuário
   */
  async getUserLayouts(userId: number, includeShared: boolean = true): Promise<DashboardLayout[]> {
    try {
      let query = `
        SELECT * FROM dashboard_layouts
        WHERE user_id = $1
      `;
      const params: unknown[] = [userId];

      if (includeShared) {
        query += ` OR is_shared = true`;
      }

      query += ` ORDER BY is_default DESC, created_at DESC`;

      const result = await this.db.findMany(query, params);
      return result.map(row => this.mapRowToLayout(row));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar layouts', e.error, { userId });
      throw new Error(`Erro ao listar layouts: ${e.message}`);
    }
  }

  /**
   * Obter layout por ID
   */
  async getLayoutById(layoutId: number): Promise<DashboardLayout | null> {
    try {
      const result = await this.db.findFirst(
        'SELECT * FROM dashboard_layouts WHERE layout_id = $1',
        [layoutId]
      );
      return result ? this.mapRowToLayout(result) : null;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar layout', e.error, { layoutId });
      throw new Error(`Erro ao buscar layout: ${e.message}`);
    }
  }

  /**
   * Obter layout padrão do usuário
   */
  async getDefaultLayout(userId: number): Promise<DashboardLayout | null> {
    try {
      const result = await this.db.findFirst(`
        SELECT * FROM dashboard_layouts
        WHERE user_id = $1 AND is_default = true
        ORDER BY updated_at DESC
        LIMIT 1
      `, [userId]);
      return result ? this.mapRowToLayout(result) : null;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar layout padrão', e.error, { userId });
      return null;
    }
  }

  /**
   * Atualizar layout
   */
  async updateLayout(layoutId: number, data: UpdateDashboardLayoutRequest): Promise<DashboardLayout> {
    try {
      const layout = await this.getLayoutById(layoutId);
      if (!layout) {
        throw new Error(`Layout com ID ${layoutId} não encontrado`);
      }

      // Se for default, desmarcar outros defaults do usuário
      if (data.isDefault) {
        await this.db.executeRaw(`
          UPDATE dashboard_layouts
          SET is_default = false
          WHERE user_id = $1 AND layout_id != $2
        `, [layout.userId, layoutId]);
      }

      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
      }

      if (data.layoutData !== undefined) {
        updates.push(`layout_data = $${paramIndex}`);
        params.push(JSON.stringify(data.layoutData));
        paramIndex++;
      }

      if (data.isDefault !== undefined) {
        updates.push(`is_default = $${paramIndex}`);
        params.push(data.isDefault);
        paramIndex++;
      }

      if (data.isShared !== undefined) {
        updates.push(`is_shared = $${paramIndex}`);
        params.push(data.isShared);
        paramIndex++;
      }

      if (updates.length === 0) {
        return layout;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(layoutId);

      const query = `
        UPDATE dashboard_layouts
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.executeRaw(query, params);
      const updatedLayout = this.mapRowToLayout(result.rows[0]);
      await logInfo('Layout de dashboard atualizado', { layoutId });
      return updatedLayout;} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao atualizar layout', e.error, { layoutId, data });
      throw new Error(`Erro ao atualizar layout: ${e.message}`);
    }
  }

  /**
   * Deletar layout
   */
  async deleteLayout(layoutId: number): Promise<void> {
    try {
      const result = await this.db.executeRaw(
        'DELETE FROM dashboard_layouts WHERE layout_id = $1',
        [layoutId]
      );
      if (result.rowCount === 0) {
        throw new Error(`Layout com ID ${layoutId} não encontrado`);
      }
      await logInfo('Layout de dashboard deletado', {
        layoutId });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao deletar layout', e.error, { layoutId });
      throw new Error(`Erro ao deletar layout: ${e.message}`);
    }
  }

  /**
   * Mapear row do banco para objeto DashboardLayout
   */
  private mapRowToLayout(row: any): DashboardLayout {
    return {
      id: row.layout_id || row.id, // Suporta ambos durante migração
      userId: row.user_id,
      name: row.name,
      layoutData: typeof row.layout_data === 'string'
        ? JSON.parse(row.layout_data)
        : (row.layout_data || { widgets: [], gridColumns: 12, gridRows: 8 }),
      isDefault: row.is_default,
      isShared: row.is_shared,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Singleton
let dashboardLayoutServiceInstance: DashboardLayoutService | null = null;

export function getDashboardLayoutService(): DashboardLayoutService {
  if (!dashboardLayoutServiceInstance) {
    dashboardLayoutServiceInstance = new DashboardLayoutService();
  }
  return dashboardLayoutServiceInstance;
}

