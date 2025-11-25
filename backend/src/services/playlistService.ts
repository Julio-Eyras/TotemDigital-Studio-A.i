import { getDatabase } from '../config/database';
import { logInfo, logError, logWarn, logDebug } from '../utils/loggerHelper';

export interface PlaylistItem {
  playlist_id: number;
  name: string;
  description?: string;
  client_id?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  media_count?: number;
  total_duration?: number;
}

export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  clientId?: number;
}

export interface UpdatePlaylistRequest {
  name?: string;
  description?: string;
  clientId?: number;
  isActive?: boolean;
}

export interface PlaylistListResponse {
  data: PlaylistItem[];
  total: number;
  page: number;
  limit: number;
}

export interface PlaylistMediaItem {
  item_id: number;
  playlist_id: number;
  media_id: number;
  order_index: number;
  duration: number;
  media: any;
}

export class PlaylistService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar playlists com paginação e filtros
   */
  async getAllPlaylists(params: {
    page?: number;
    limit?: number;
    search?: string;
    clientId?: number;
  }): Promise<PlaylistListResponse> {
    try {
      const { page = 1, limit = 10, search, clientId } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE COALESCE(p.is_active, true) = true';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (p.name ILIKE $' + (queryParams.length + 1) + ' OR p.description ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      if (clientId) {
        whereClause += ' AND p.client_id = $' + (queryParams.length + 1);
        queryParams.push(clientId);
      }

      // Buscar playlists
      const playlists = await this.db.findMany(`
        SELECT 
          p.playlist_id,
          p.name,
          p.description,
          p.client_id,
          COALESCE(p.is_active, true) as is_active,
          p.created_at,
          p.updated_at as updated_at,
          c.name as client_name,
          COUNT(pi.item_id) as media_count,
          COALESCE(SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)), 0) as total_duration
        FROM playlists p
        LEFT JOIN clients c ON p.client_id = c.client_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        ${whereClause}
        GROUP BY 
          p.playlist_id, 
          p.name, 
          p.description, 
          p.client_id, 
          COALESCE(p.is_active, true),
          p.created_at,
          p.updated_at,
          c.name
        ORDER BY p.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT p.playlist_id) as total
        FROM playlists p
        ${whereClause}
      `, queryParams);

      return {
        data: playlists,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      await logError('Erro ao listar playlists', error, { params });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter playlist por ID
   */
  async getPlaylistById(id: number): Promise<PlaylistItem | null> {
    try {
      const playlist = await this.db.findFirst(`
        SELECT 
          p.playlist_id,
          p.name,
          p.description,
          p.client_id,
          COALESCE(p.is_active, true) as is_active,
          COALESCE(p.created_at, p.generated_at) as created_at,
          p.updated_at as updated_at,
          c.name as client_name,
          COUNT(pi.item_id) as media_count,
          COALESCE(SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)), 0) as total_duration
        FROM playlists p
        LEFT JOIN clients c ON p.client_id = c.client_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        WHERE p.playlist_id = $1
        GROUP BY 
          p.playlist_id, 
          p.name, 
          p.description, 
          p.client_id, 
          COALESCE(p.is_active, true),
          COALESCE(p.created_at, p.generated_at),
          p.updated_at,
          c.name
      `, [id]);

      return playlist;
    } catch (error: any) {
      await logError('Erro ao obter playlist', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar nova playlist
   */
  async createPlaylist(data: CreatePlaylistRequest): Promise<PlaylistItem> {
    try {
      const { name, description, clientId } = data;

      // Verificar se playlist já existe
      const existingPlaylist = await this.db.findFirst(`
        SELECT playlist_id FROM playlists WHERE name = $1 AND client_id = $2
      `, [name, clientId]);

      if (existingPlaylist) {
        throw new Error('Playlist com este nome já existe para este cliente');
      }

      // Buscar primeiro totem e campanha ativos para usar como padrão
      // Se não existirem, usar NULL (mas o schema requer NOT NULL, então precisamos criar valores padrão)
      // Buscar totem ativo (pode ter active ou is_active)
      const defaultTotem = await this.db.findFirst(`
        SELECT totem_id FROM totems 
        WHERE (active = true OR is_active = true) 
        LIMIT 1
      `);
      
      // Buscar campanha ativa (is_active = true ou status = 'active')
      const defaultCampaign = await this.db.findFirst(`
        SELECT campaign_id FROM campaigns 
        WHERE (is_active = true OR status = 'active') 
        LIMIT 1
      `);

      // Mapear campos do banco (PostgreSQL retorna snake_case)
      const totemId = defaultTotem?.totem_id || defaultTotem?.totemId || null;
      const campaignId = defaultCampaign?.campaign_id || defaultCampaign?.campaignId || null;

      if (!totemId || !campaignId) {
        await logError('Erro ao criar playlist: Totem ou campanha não encontrados', null, {
          totemId: defaultTotem ? totemId : null,
          campaignId: defaultCampaign ? campaignId : null,
          defaultTotem: defaultTotem ? 'encontrado' : 'não encontrado',
          defaultCampaign: defaultCampaign ? 'encontrada' : 'não encontrada'
        });
        throw new Error('É necessário ter pelo menos um totem e uma campanha ativos para criar playlists');
      }
      
      await logDebug('Totem e campanha encontrados para playlist', {
        totemId,
        campaignId
      });

      // Criar playlist
      const result = await this.db.executeRaw(`
        INSERT INTO playlists (name, description, client_id, totem_id, campaign_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING playlist_id
      `, [name, description, clientId, totemId, campaignId]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar playlist');
      }

      const playlistId = result.rows[0].playlist_id;
      const newPlaylist = await this.getPlaylistById(playlistId);

      if (!newPlaylist) {
        throw new Error('Erro ao buscar playlist criada');
      }

      return newPlaylist;
    } catch (error: any) {
      await logError('Erro ao criar playlist', error, { name: request.name, clientId: request.clientId });
      throw error;
    }
  }

  /**
   * Atualizar playlist
   */
  async updatePlaylist(id: number, data: UpdatePlaylistRequest): Promise<PlaylistItem> {
    try {
      const { name, description, clientId, isActive } = data;

      // Verificar se playlist existe
      const existingPlaylist = await this.getPlaylistById(id);
      if (!existingPlaylist) {
        throw new Error('Playlist não encontrada');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingPlaylist.name) {
        const playlistWithSameName = await this.db.findFirst(`
          SELECT playlist_id FROM playlists WHERE name = $1 AND client_id = $2 AND playlist_id != $3
        `, [name, clientId || existingPlaylist.client_id, id]);

        if (playlistWithSameName) {
          throw new Error('Playlist com este nome já existe para este cliente');
        }
      }

      // Preparar campos para atualização
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        updateParams.push(name);
        paramIndex++;
      }

      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex}`);
        updateParams.push(description);
        paramIndex++;
      }

      if (clientId !== undefined) {
        updateFields.push(`client_id = $${paramIndex}`);
        updateParams.push(clientId);
        paramIndex++;
      }

      if (isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex}`);
        updateParams.push(isActive);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE playlists 
        SET ${updateFields.join(', ')}
        WHERE playlist_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedPlaylist = await this.getPlaylistById(id);
      if (!updatedPlaylist) {
        throw new Error('Erro ao buscar playlist atualizada');
      }

      return updatedPlaylist;
    } catch (error: any) {
      await logError('Erro ao atualizar playlist', error, { id, updateData: request });
      throw error;
    }
  }

  /**
   * Excluir playlist (soft delete)
   */
  async deletePlaylist(id: number): Promise<void> {
    try {
      // Verificar se playlist existe
      const existingPlaylist = await this.getPlaylistById(id);
      if (!existingPlaylist) {
        throw new Error('Playlist não encontrada');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE playlists 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE playlist_id = $1
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir playlist', error, { id });
      throw error;
    }
  }

  /**
   * Obter mídia da playlist
   */
  async getPlaylistMedia(playlistId: number): Promise<PlaylistMediaItem[]> {
    try {
      const media = await this.db.findMany(`
        SELECT 
          pi.item_id,
          pi.playlist_id,
          pi.media_id,
          pi.order_index,
          pi.display_seconds as duration,
          m.media_id,
          m.name,
          m.media_type,
          m.file_path,
          m.mime_type,
          m.duration_seconds,
          m.size_bytes
        FROM playlist_items pi
        JOIN medias m ON pi.media_id = m.media_id
        WHERE pi.playlist_id = $1
        ORDER BY pi.order_index ASC
      `, [playlistId]);

      return media.map(item => ({
        item_id: item.item_id,
        playlist_id: item.playlist_id,
        media_id: item.media_id,
        order_index: item.order_index,
        duration: item.duration || item.display_seconds || 0,
        media: {
          media_id: item.media_id,
          name: item.name,
          media_type: item.media_type,
          file_path: item.file_path,
          mime_type: item.mime_type,
          duration_seconds: item.duration_seconds,
          size_bytes: item.size_bytes,
        }
      }));
    } catch (error: any) {
      await logError('Erro ao obter mídia da playlist', error, { playlistId });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Adicionar mídia à playlist
   */
  async addMediaToPlaylist(playlistId: number, mediaId: number, orderIndex?: number, duration?: number): Promise<void> {
    try {
      // Verificar se playlist existe
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Verificar se mídia existe
      const media = await this.db.findFirst(`
        SELECT media_id FROM medias WHERE media_id = $1 AND status = 'active'
      `, [mediaId]);

      if (!media) {
        throw new Error('Mídia não encontrada');
      }

      // Se não especificado, usar o próximo índice
      if (!orderIndex) {
        const maxOrder = await this.db.findFirst(`
          SELECT MAX(order_index) as max_order FROM playlist_items WHERE playlist_id = $1
        `, [playlistId]);
        orderIndex = (maxOrder?.max_order || 0) + 1;
      }

      // Duração padrão se não especificada
      if (!duration) {
        duration = 10000; // 10 segundos
      }

      // Adicionar mídia à playlist
      await this.db.executeRaw(`
        INSERT INTO playlist_items (playlist_id, media_id, order_index, display_seconds, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [playlistId, mediaId, orderIndex, duration]);
    } catch (error: any) {
      await logError('Erro ao adicionar mídia à playlist', error, { playlistId, mediaId, orderIndex, duration });
      throw error;
    }
  }

  /**
   * Remover mídia da playlist
   */
  async removeMediaFromPlaylist(playlistId: number, itemId: number): Promise<void> {
    try {
      // Verificar se item existe
      const item = await this.db.findFirst(`
        SELECT item_id FROM playlist_items WHERE item_id = $1 AND playlist_id = $2
      `, [itemId, playlistId]);

      if (!item) {
        throw new Error('Item não encontrado na playlist');
      }

      // Remover item
      await this.db.executeRaw(`
        DELETE FROM playlist_items WHERE item_id = $1
      `, [itemId]);
    } catch (error: any) {
      await logError('Erro ao remover mídia da playlist', error, { itemId });
      throw error;
    }
  }

  /**
   * Reordenar mídia da playlist
   */
  async reorderPlaylistMedia(playlistId: number, items: { itemId: number; orderIndex: number }[]): Promise<void> {
    try {
      // Verificar se playlist existe
      const playlist = await this.getPlaylistById(playlistId);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Atualizar ordem de cada item
      for (const item of items) {
        await this.db.executeRaw(`
          UPDATE playlist_items 
          SET order_index = $1
          WHERE item_id = $2 AND playlist_id = $3
        `, [item.orderIndex, item.itemId, playlistId]);
      }
    } catch (error: any) {
      await logError('Erro ao reordenar mídia da playlist', error, { playlistId, items });
      throw error;
    }
  }
}

// Instância global do serviço
let playlistServiceInstance: PlaylistService;

export function getPlaylistService(): PlaylistService {
  if (!playlistServiceInstance) {
    playlistServiceInstance = new PlaylistService();
  }
  return playlistServiceInstance;
}
