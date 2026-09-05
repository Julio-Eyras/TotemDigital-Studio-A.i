/**
 * Tag Service - Smart Signage Pro v2.1
 * Serviço para gerenciar tags e suas associações
 */

import { getDatabase } from '../config/database';
import { logInfo, logError, logDebug } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export interface Tag {
  id: number;
  tagId: string;
  tagType: 'rfid' | 'nfc' | 'qr_code' | 'barcode';
  name?: string;
  description?: string;
  contentId?: number;
  metadata?: Record<string, any>; // JSONB metadata
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagRequest {
  tagId: string;
  tagType: 'rfid' | 'nfc' | 'qr_code' | 'barcode';
  name?: string;
  description?: string;
  contentId?: number;
  metadata?: Record<string, any>; // JSONB metadata
}

export class TagService {
  private get db() {
    return getDatabase();
  }

  /**
   * Cria ou atualiza uma tag
   */
  async createOrUpdateTag(request: TagRequest): Promise<Tag> {
    try {
      // Verificar se tag já existe
      const existing = await this.db.findFirst(`
        SELECT * FROM tags WHERE tag_id = $1
      `, [request.tagId]);

      if (existing) {
        // Atualizar
        const result = await this.db.executeRaw(`
          UPDATE tags
          SET tag_type = $1, name = $2, description = $3, content_id = $4,
              metadata = $5, updated_at = CURRENT_TIMESTAMP
          WHERE tag_id = $6
          RETURNING *
        `, [
          request.tagType,
          request.name || null,
          request.description || null,
          request.contentId || null,
          request.metadata ? JSON.stringify(request.metadata) : '{}',
          request.tagId
        ]);

        await logInfo('Tag atualizada', { tagId: request.tagId });
        return this.mapToTag(result.rows[0]);
      } else {
        // Criar
        const result = await this.db.executeRaw(`
          INSERT INTO tags (tag_id, tag_type, name, description, content_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [
          request.tagId,
          request.tagType,
          request.name || null,
          request.description || null,
          request.contentId || null,
          request.metadata ? JSON.stringify(request.metadata) : '{}'
        ]);

        await logInfo('Tag criada', { tagId: request.tagId });
        return this.mapToTag(result.rows[0]);
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao criar/atualizar tag', e.error, { tagId: request.tagId });
      throw e.error;
    }
  }

  /**
   * Obtém conteúdo associado a uma tag
   */
  async getContentForTag(tagId: string): Promise<{ contentId: number | null; tag: Tag | null }> {
    try {
      const tag = await this.db.findFirst(`
        SELECT * FROM tags
        WHERE tag_id = $1 AND is_active = true
      `, [tagId]);

      if (!tag) {
        await logDebug('Tag não encontrada', { tagId });
        return { contentId: null, tag: null };
      }

      return {
        contentId: tag.content_id || null,
        tag: this.mapToTag(tag)
      };} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar conteúdo da tag', e.error, { tagId });
      return { contentId: null, tag: null };
    }
  }

  /**
   * Lista todas as tags
   */
  async getAllTags(filters?: {
    tagType?: string;
    isActive?: boolean;
    limit?: number;
  }): Promise<Tag[]> {
    try {
      let query = 'SELECT * FROM tags WHERE 1=1';
      const params: unknown[] = [];

      if (filters?.tagType) {
        query += ' AND tag_type = $' + (params.length + 1);
        params.push(filters.tagType);
      }

      if (filters?.isActive !== undefined) {
        query += ' AND is_active = $' + (params.length + 1);
        params.push(filters.isActive);
      }

      query += ' ORDER BY created_at DESC';

      if (filters?.limit) {
        query += ' LIMIT $' + (params.length + 1);
        params.push(filters.limit);
      }

      const tags = await this.db.findMany(query, params);
      return tags.map(tag => this.mapToTag(tag));} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao listar tags', e.error);
      throw e.error;
    }
  }

  /**
   * Desativa uma tag
   */
  async deactivateTag(tagId: string): Promise<void> {
    try {
      await this.db.executeRaw(`
        UPDATE tags
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE tag_id = $1
      `, [tagId]);

      await logInfo('Tag desativada', {
        tagId });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao desativar tag', e.error, { tagId });
      throw e.error;
    }
  }

  /**
   * Mapeia resultado do banco para Tag
   */
  private mapToTag(row: any): Tag {
    // Parse metadata se for string JSON
    let metadata: Record<string, any> = {};
    if (row.metadata) {
      if (typeof row.metadata === 'string') {
        try {
          metadata = JSON.parse(row.metadata);
} catch (e: unknown) {
          metadata = {};
        }
      } else {
        metadata = row.metadata;
      }
    }

    return {
      id: row.id,
      tagId: row.tag_id,
      tagType: row.tag_type,
      name: row.name,
      description: row.description,
      contentId: row.content_id,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      isActive: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}

// Singleton instance
let tagServiceInstance: TagService | null = null;

export function getTagService(): TagService {
  if (!tagServiceInstance) {
    tagServiceInstance = new TagService();
  }
  return tagServiceInstance;
}

