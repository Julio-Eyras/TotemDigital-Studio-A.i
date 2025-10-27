/**
 * Playlist Service - Smart Signage v2.0
 * Serviço de gerenciamento de playlists
 */

import { getDatabase } from '../config/database';
import { AuditService } from './auditService';

export interface CreatePlaylistRequest {
  totemId: number;
  campaignId: number;
  name?: string;
  description?: string;
  isDefault?: boolean;
  loop?: boolean;
  config?: any;
  items: PlaylistItemRequest[];
}

export interface UpdatePlaylistRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
  loop?: boolean;
  config?: any;
  items?: PlaylistItemRequest[];
}

export interface PlaylistItemRequest {
  mediaId: number;
  orderIndex: number;
  displaySeconds?: number;
  transition?: string;
  startTimeOffsetSeconds?: number;
}

export interface PlaylistResponse {
  id: number;
  totemId: number;
  campaignId: number;
  name?: string;
  description?: string;
  isDefault: boolean;
  medias: any; // Legacy field
  loop: boolean;
  config?: any;
  isActive: boolean;
  generatedAt: string;
  updatedAt: string;
  totemName?: string;
  campaignName?: string;
  items: PlaylistItemResponse[];
  totalDuration?: number;
  mediaCount?: number;
}

export interface PlaylistItemResponse {
  id: number;
  playlistId: number;
  mediaId: number;
  orderIndex: number;
  displaySeconds?: number;
  transition?: string;
  startTimeOffsetSeconds?: number;
  createdAt: string;
  updatedAt: string;
  media: {
    id: number;
    name: string;
    title?: string;
    mediaType: string;
    durationSeconds?: number;
    filePath: string;
    mimeType: string;
    width?: number;
    height?: number;
  };
}

export interface PlaylistStats {
  total: number;
  active: number;
  inactive: number;
  byTotem: { totemId: number; totemName: string; count: number }[];
  byCampaign: { campaignId: number; campaignName: string; count: number }[];
  totalDuration: number;
  averageDuration: number;
}

export class PlaylistService {
  private db = getDatabase();
  
  // Lazy initialization - só criar quando necessário
  private getAuditService(): AuditService {
    if (!(global as any).auditServiceInstance) {
      (global as any).auditServiceInstance = new AuditService();
    }
    return (global as any).auditServiceInstance;
  }

  /**
   * Lista todas as playlists (alias para getPlaylists)
   */
  async getAllPlaylists(filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    clientId?: number;
  }): Promise<any> {
    const result = await this.getPlaylists(
      filters.page || 1,
      filters.limit || 1000,
      {
        isActive: filters.status === 'active',
        search: filters.search
      }
    );
    return result;
  }

  /**
   * Lista playlists com paginação e filtros
   */
  async getPlaylists(
    page: number = 1,
    limit: number = 20,
    filters: {
      totemId?: number;
      campaignId?: number;
      isActive?: boolean;
      search?: string;
    } = {}
  ): Promise<{ playlists: PlaylistResponse[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.totemId) {
        whereClause += ' AND p.totem_id = ?';
        params.push(filters.totemId);
      }

      if (filters.campaignId) {
        whereClause += ' AND p.campaign_id = ?';
        params.push(filters.campaignId);
      }

      if (filters.isActive !== undefined) {
        whereClause += ' AND p.is_active = ?';
        params.push(filters.isActive ? 1 : 0);
      }

      if (filters.search) {
        whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      // Buscar playlists
      const playlists = await this.db.findMany(`
        SELECT 
          p.playlist_id as id,
          p.totem_id as totemId,
          p.campaign_id as campaignId,
          p.name,
          p.description,
          p.is_default as isDefault,
          p.medias,
          p.loop,
          p.config,
          p.is_active as isActive,
          p.generated_at as generatedAt,
          p.updated_at as updatedAt,
          t.identifier as totemName,
          c.title as campaignName
        FROM playlists p
        LEFT JOIN totems t ON p.totem_id = t.totem_id
        LEFT JOIN campaigns c ON p.campaign_id = c.campaign_id
        ${whereClause}
        ORDER BY p.generated_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM playlists p
        ${whereClause}
      `, params);

      const total = totalResult?.total || 0;

      // Buscar items e estatísticas para cada playlist
      const playlistsWithDetails = await Promise.all(
        playlists.map(async (playlist) => {
          const items = await this.getPlaylistItems(playlist.id);
          const stats = await this.getPlaylistStats(playlist.id);
          return { ...playlist, items, ...stats };
        })
      );

      return {
        playlists: playlistsWithDetails,
        total,
        page,
        limit
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar playlists:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca playlist por ID
   */
  async getPlaylistById(playlistId: number): Promise<PlaylistResponse | null> {
    try {
      const playlist = await this.db.findFirst(`
        SELECT 
          p.playlist_id as id,
          p.totem_id as totemId,
          p.campaign_id as campaignId,
          p.name,
          p.description,
          p.is_default as isDefault,
          p.medias,
          p.loop,
          p.config,
          p.is_active as isActive,
          p.generated_at as generatedAt,
          p.updated_at as updatedAt,
          t.identifier as totemName,
          c.title as campaignName
        FROM playlists p
        LEFT JOIN totems t ON p.totem_id = t.totem_id
        LEFT JOIN campaigns c ON p.campaign_id = c.campaign_id
        WHERE p.playlist_id = ?
      `, [playlistId]);

      if (!playlist) {
        return null;
      }

      // Buscar items e estatísticas
      const items = await this.getPlaylistItems(playlistId);
      const stats = await this.getPlaylistStats(playlistId);

      return { ...playlist, items, ...stats };

    } catch (error: any) {
      console.error('❌ Erro ao buscar playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Cria nova playlist
   */
  async createPlaylist(data: CreatePlaylistRequest, createdBy: number): Promise<PlaylistResponse> {
    try {
      const { totemId, campaignId, name, description, isDefault = false, loop = true, config, items } = data;

      // Verificar se totem existe
      const totem = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE totem_id = ? AND active = 1
      `, [totemId]);

      if (!totem) {
        throw new Error('Totem não encontrado ou inativo');
      }

      // Verificar se campanha existe
      const campaign = await this.db.findFirst(`
        SELECT campaign_id FROM campaigns WHERE campaign_id = ? AND is_active = 1
      `, [campaignId]);

      if (!campaign) {
        throw new Error('Campanha não encontrada ou inativa');
      }

      // Se for padrão, desmarcar outras playlists padrão do totem
      if (isDefault) {
        await this.db.executeRaw(`
          UPDATE playlists 
          SET is_default = 0 
          WHERE totem_id = ? AND is_default = 1
        `, [totemId]);
      }

      // Criar playlist
      const result = await this.db.executeRaw(`
        INSERT INTO playlists (
          totem_id, campaign_id, name, description, is_default, 
          medias, loop, config, is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        totemId,
        campaignId,
        name,
        description,
        isDefault ? 1 : 0,
        JSON.stringify([]), // Legacy field
        loop ? 1 : 0,
        config ? JSON.stringify(config) : null
      ]);

      if (!result.lastInsertRowid) {
        throw new Error('Erro ao criar playlist');
      }

      const playlistId = result.lastInsertRowid;

      // Adicionar items da playlist
      if (items && items.length > 0) {
        await this.addPlaylistItems(playlistId, items);
      }

      // Buscar playlist criada
      const newPlaylist = await this.getPlaylistById(playlistId);
      if (!newPlaylist) {
        throw new Error('Erro ao buscar playlist criada');
      }

      // Log de auditoria
      await this.getAuditService().log('playlist', 'created', createdBy, {
        playlistId: newPlaylist.id,
        totemId: newPlaylist.totemId,
        campaignId: newPlaylist.campaignId,
        itemCount: items?.length || 0
      });

      return newPlaylist;

    } catch (error: any) {
      console.error('❌ Erro ao criar playlist:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza playlist
   */
  async updatePlaylist(playlistId: number, data: UpdatePlaylistRequest, updatedBy: number): Promise<PlaylistResponse> {
    try {
      // Verificar se playlist existe
      const existingPlaylist = await this.getPlaylistById(playlistId);
      if (!existingPlaylist) {
        throw new Error('Playlist não encontrada');
      }

      // Construir query de atualização
      const updates: string[] = [];
      const params: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.isDefault !== undefined) {
        updates.push('is_default = ?');
        params.push(data.isDefault ? 1 : 0);
      }

      if (data.loop !== undefined) {
        updates.push('loop = ?');
        params.push(data.loop ? 1 : 0);
      }

      if (data.config !== undefined) {
        updates.push('config = ?');
        params.push(JSON.stringify(data.config));
      }

      if (updates.length === 0 && !data.items) {
        return existingPlaylist;
      }

      // Se for padrão, desmarcar outras playlists padrão do totem
      if (data.isDefault) {
        await this.db.executeRaw(`
          UPDATE playlists 
          SET is_default = 0 
          WHERE totem_id = ? AND is_default = 1 AND playlist_id != ?
        `, [existingPlaylist.totemId, playlistId]);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(playlistId);

        // Atualizar playlist
        await this.db.executeRaw(`
          UPDATE playlists 
          SET ${updates.join(', ')}
          WHERE playlist_id = ?
        `, params);
      }

      // Atualizar items se fornecidos
      if (data.items) {
        await this.updatePlaylistItems(playlistId, data.items);
      }

      // Buscar playlist atualizada
      const updatedPlaylist = await this.getPlaylistById(playlistId);
      if (!updatedPlaylist) {
        throw new Error('Erro ao buscar playlist atualizada');
      }

      // Log de auditoria
      await this.getAuditService().log('playlist', 'updated', updatedBy, {
        playlistId,
        changes: data
      });

      return updatedPlaylist;

    } catch (error: any) {
      console.error('❌ Erro ao atualizar playlist:', error.message);
      throw error;
    }
  }

  /**
   * Remove playlist
   */
  async deletePlaylist(playlistId: number, deletedBy: number): Promise<void> {
    try {
      // Verificar se playlist existe
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Remover items da playlist
      await this.db.executeRaw(`
        DELETE FROM playlist_items WHERE playlist_id = ?
      `, [playlistId]);

      // Remover playlist
      await this.db.executeRaw(`
        DELETE FROM playlists WHERE playlist_id = ?
      `, [playlistId]);

      // Log de auditoria
      await this.getAuditService().log('playlist', 'deleted', deletedBy, {
        playlistId,
        totemId: playlist.totemId,
        campaignId: playlist.campaignId
      });

    } catch (error: any) {
      console.error('❌ Erro ao remover playlist:', error.message);
      throw error;
    }
  }

  /**
   * Busca items de uma playlist
   */
  async getPlaylistItems(playlistId: number): Promise<PlaylistItemResponse[]> {
    try {
      const items = await this.db.findMany(`
        SELECT 
          pi.item_id as id,
          pi.playlist_id as playlistId,
          pi.media_id as mediaId,
          pi.order_index as orderIndex,
          pi.display_seconds as displaySeconds,
          pi.transition,
          pi.start_time_offset_seconds as startTimeOffsetSeconds,
          pi.created_at as createdAt,
          pi.updated_at as updatedAt,
          m.name,
          m.title,
          m.media_type as mediaType,
          m.duration_seconds as durationSeconds,
          m.file_path as filePath,
          m.mime_type as mimeType,
          m.width,
          m.height
        FROM playlist_items pi
        JOIN medias m ON pi.media_id = m.media_id
        WHERE pi.playlist_id = ?
        ORDER BY pi.order_index ASC
      `, [playlistId]);

      return items.map(item => ({
        id: item.id,
        playlistId: item.playlistId,
        mediaId: item.mediaId,
        orderIndex: item.orderIndex,
        displaySeconds: item.displaySeconds,
        transition: item.transition,
        startTimeOffsetSeconds: item.startTimeOffsetSeconds,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        media: {
          id: item.mediaId,
          name: item.name,
          title: item.title,
          mediaType: item.mediaType,
          durationSeconds: item.durationSeconds,
          filePath: item.filePath,
          mimeType: item.mimeType,
          width: item.width,
          height: item.height
        }
      }));

    } catch (error: any) {
      console.error('❌ Erro ao buscar items da playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Adiciona item à playlist
   */
  async addPlaylistItem(playlistId: number, itemData: any): Promise<any> {
    try {
      await this.addPlaylistItems(playlistId, [itemData]);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao adicionar item à playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Adiciona items à playlist
   */
  async addPlaylistItems(playlistId: number, items: PlaylistItemRequest[]): Promise<void> {
    try {
      for (const item of items) {
        // Verificar se mídia existe
        const media = await this.db.findFirst(`
          SELECT media_id FROM medias WHERE media_id = ?
        `, [item.mediaId]);

        if (!media) {
          throw new Error(`Mídia ${item.mediaId} não encontrada`);
        }

        // Inserir item
        await this.db.executeRaw(`
          INSERT INTO playlist_items (
            playlist_id, media_id, order_index, display_seconds, 
            transition, start_time_offset_seconds
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          playlistId,
          item.mediaId,
          item.orderIndex,
          item.displaySeconds,
          item.transition,
          item.startTimeOffsetSeconds
        ]);
      }

    } catch (error: any) {
      console.error('❌ Erro ao adicionar items à playlist:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza item da playlist
   */
  async updatePlaylistItem(playlistId: number, itemId: number, itemData: any): Promise<any> {
    try {
      await this.updatePlaylistItems(playlistId, [itemData]);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar item da playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Remove item da playlist
   */
  async removePlaylistItem(playlistId: number, itemId: number): Promise<boolean> {
    try {
      await this.db.executeRaw(`
        DELETE FROM playlist_items 
        WHERE playlist_id = ? AND item_id = ?
      `, [playlistId, itemId]);
      
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao remover item da playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Reordena items da playlist
   */
  async reorderPlaylistItems(playlistId: number, items: any[]): Promise<any> {
    try {
      for (let i = 0; i < items.length; i++) {
        await this.db.executeRaw(`
          UPDATE playlist_items 
          SET order_index = ? 
          WHERE playlist_id = ? AND item_id = ?
        `, [i + 1, playlistId, items[i].id]);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao reordenar items da playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Duplica playlist
   */
  async duplicatePlaylist(playlistId: number, name: string): Promise<any> {
    try {
      const originalPlaylist = await this.getPlaylistById(playlistId);
      if (!originalPlaylist) {
        throw new Error('Playlist não encontrada');
      }
      
      const newPlaylist = await this.createPlaylist({
        name: name,
        description: originalPlaylist.description,
        totemId: 1, // Default totem
        campaignId: 1, // Default campaign
        items: []
      }, 1); // Default user
      
      return newPlaylist;
    } catch (error: any) {
      console.error('❌ Erro ao duplicar playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Busca duração da playlist
   */
  async getPlaylistDuration(playlistId: number): Promise<number> {
    try {
      const result = await this.db.findFirst(`
        SELECT SUM(m.duration_seconds) as totalDuration
        FROM playlist_items pi
        INNER JOIN medias m ON pi.media_id = m.media_id
        WHERE pi.playlist_id = ?
      `, [playlistId]);
      
      return result.totalDuration || 0;
    } catch (error: any) {
      console.error('❌ Erro ao buscar duração da playlist:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Atualiza items da playlist
   */
  async updatePlaylistItems(playlistId: number, items: PlaylistItemRequest[]): Promise<void> {
    try {
      // Remover items existentes
      await this.db.executeRaw(`
        DELETE FROM playlist_items WHERE playlist_id = ?
      `, [playlistId]);

      // Adicionar novos items
      if (items.length > 0) {
        await this.addPlaylistItems(playlistId, items);
      }

    } catch (error: any) {
      console.error('❌ Erro ao atualizar items da playlist:', error.message);
      throw error;
    }
  }

  /**
   * Busca estatísticas de uma playlist
   */
  async getPlaylistStats(playlistId: number): Promise<{
    totalDuration: number;
    mediaCount: number;
  }> {
    try {
      // Contar mídia
      const mediaCountResult = await this.db.findFirst(`
        SELECT COUNT(*) as count FROM playlist_items WHERE playlist_id = ?
      `, [playlistId]);

      // Calcular duração total
      const durationResult = await this.db.findFirst(`
        SELECT SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)) as total
        FROM playlist_items pi
        JOIN medias m ON pi.media_id = m.media_id
        WHERE pi.playlist_id = ?
      `, [playlistId]);

      return {
        totalDuration: durationResult?.total || 0,
        mediaCount: mediaCountResult?.count || 0
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas da playlist:', error.message);
      return {
        totalDuration: 0,
        mediaCount: 0
      };
    }
  }

  /**
   * Busca estatísticas gerais de playlists
   */
  async getPlaylistsStats(): Promise<PlaylistStats> {
    try {
      // Total de playlists
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM playlists
      `);

      // Playlists ativas
      const activeResult = await this.db.findFirst(`
        SELECT COUNT(*) as active FROM playlists WHERE is_active = 1
      `);

      // Playlists inativas
      const inactiveResult = await this.db.findFirst(`
        SELECT COUNT(*) as inactive FROM playlists WHERE is_active = 0
      `);

      // Por totem
      const byTotem = await this.db.findMany(`
        SELECT 
          p.totem_id as totemId,
          t.identifier as totemName,
          COUNT(*) as count
        FROM playlists p
        LEFT JOIN totems t ON p.totem_id = t.totem_id
        GROUP BY p.totem_id, t.identifier
        ORDER BY count DESC
        LIMIT 10
      `);

      // Por campanha
      const byCampaign = await this.db.findMany(`
        SELECT 
          p.campaign_id as campaignId,
          c.title as campaignName,
          COUNT(*) as count
        FROM playlists p
        LEFT JOIN campaigns c ON p.campaign_id = c.campaign_id
        GROUP BY p.campaign_id, c.title
        ORDER BY count DESC
        LIMIT 10
      `);

      // Duração total
      const totalDurationResult = await this.db.findFirst(`
        SELECT SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)) as total
        FROM playlist_items pi
        JOIN medias m ON pi.media_id = m.media_id
      `);

      // Duração média
      const averageDurationResult = await this.db.findFirst(`
        SELECT AVG(COALESCE(pi.display_seconds, m.duration_seconds, 0)) as average
        FROM playlist_items pi
        JOIN medias m ON pi.media_id = m.media_id
      `);

      return {
        total: totalResult?.total || 0,
        active: activeResult?.active || 0,
        inactive: inactiveResult?.inactive || 0,
        byTotem: byTotem.map(t => ({ totemId: t.totemId, totemName: t.totemName, count: t.count })),
        byCampaign: byCampaign.map(c => ({ campaignId: c.campaignId, campaignName: c.campaignName, count: c.count })),
        totalDuration: totalDurationResult?.total || 0,
        averageDuration: averageDurationResult?.average || 0
      };

    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas gerais:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Gera playlist para totem
   */
  async generatePlaylistForTotem(totemId: number, campaignId?: number): Promise<PlaylistResponse | null> {
    try {
      // Buscar campanhas ativas para o totem
      let whereClause = 'WHERE ct.totem_id = ? AND c.is_active = 1';
      const params: any[] = [totemId];

      if (campaignId) {
        whereClause += ' AND c.campaign_id = ?';
        params.push(campaignId);
      }

      const campaigns = await this.db.findMany(`
        SELECT 
          c.campaign_id,
          c.title,
          c.priority,
          ct.priority as totem_priority
        FROM campaigns c
        JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
        ${whereClause}
        ORDER BY c.priority DESC, ct.priority DESC
      `, params);

      if (campaigns.length === 0) {
        return null;
      }

      // Usar a campanha com maior prioridade
      const campaign = campaigns[0];

      // Buscar mídia da campanha
      const media = await this.db.findMany(`
        SELECT DISTINCT m.*
        FROM medias m
        JOIN playlist_items pi ON m.media_id = pi.media_id
        JOIN playlists p ON pi.playlist_id = p.playlist_id
        WHERE p.campaign_id = ? AND m.status = 'published'
        ORDER BY pi.order_index ASC
      `, [campaign.campaign_id]);

      if (media.length === 0) {
        return null;
      }

      // Criar playlist
      const playlistData: CreatePlaylistRequest = {
        totemId,
        campaignId: campaign.campaign_id,
        name: `Auto-generated for ${campaign.title}`,
        description: `Playlist gerada automaticamente para a campanha ${campaign.title}`,
        isDefault: true,
        loop: true,
        items: media.map((m, index) => ({
          mediaId: m.media_id,
          orderIndex: index,
          displaySeconds: m.duration_seconds || 10
        }))
      };

      return await this.createPlaylist(playlistData, 1); // System user

    } catch (error: any) {
      console.error('❌ Erro ao gerar playlist para totem:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Ativa playlist
   */
  async activatePlaylist(playlistId: number, activatedBy: number): Promise<void> {
    try {
      // Verificar se playlist existe
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      if (playlist.isActive) {
        throw new Error('Playlist já está ativa');
      }

      // Ativar playlist
      await this.db.executeRaw(`
        UPDATE playlists 
        SET is_active = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE playlist_id = ?
      `, [playlistId]);

      // Log de auditoria
      await this.getAuditService().log('playlist', 'activated', activatedBy, {
        playlistId,
        totemId: playlist.totemId,
        campaignId: playlist.campaignId
      });

    } catch (error: any) {
      console.error('❌ Erro ao ativar playlist:', error.message);
      throw error;
    }
  }

  /**
   * Desativa playlist
   */
  async deactivatePlaylist(playlistId: number, deactivatedBy: number): Promise<void> {
    try {
      // Verificar se playlist existe
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      if (!playlist.isActive) {
        throw new Error('Playlist já está inativa');
      }

      // Desativar playlist
      await this.db.executeRaw(`
        UPDATE playlists 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE playlist_id = ?
      `, [playlistId]);

      // Log de auditoria
      await this.getAuditService().log('playlist', 'deactivated', deactivatedBy, {
        playlistId,
        totemId: playlist.totemId,
        campaignId: playlist.campaignId
      });

    } catch (error: any) {
      console.error('❌ Erro ao desativar playlist:', error.message);
      throw error;
    }
  }
}
