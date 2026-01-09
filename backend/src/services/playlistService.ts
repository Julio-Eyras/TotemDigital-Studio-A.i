import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { getCacheService } from './cacheService';

export interface PlaylistItem {
  playlist_id: number;
  name: string;
  description?: string;
  subscriber_id: number; // OBRIGATÓRIO: Playlist pertence a um subscriber
  subscriber_name?: string; // Nome do subscriber
  is_active: boolean;
  created_at: string;
  updated_at: string;
  media_count?: number;
  total_duration?: number;
  // Mantido para compatibilidade com frontend (deprecated)
  client_id?: number;
}

export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  subscriberId?: number; // NOVO: Use subscriberId
  clientId?: number; // DEPRECATED: Mantido para compatibilidade
}

export interface UpdatePlaylistRequest {
  name?: string;
  description?: string;
  subscriberId?: number; // NOVO: Use subscriberId
  clientId?: number; // DEPRECATED: Mantido para compatibilidade
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
   * @param params Parâmetros de busca
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para isolamento de dados)
   * @param isAdmin Se o usuário é admin (pode ver todas as playlists)
   */
  async getAllPlaylists(params: {
    page?: number;
    limit?: number;
    search?: string;
    subscriberId?: number; // NOVO: Use subscriberId
    clientId?: number; // DEPRECATED: Mantido para compatibilidade
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    createdFrom?: string;
    createdTo?: string;
  }, requestSubscriberId?: number, isAdmin: boolean = false): Promise<PlaylistListResponse> {
    try {
      const { page = 1, limit = 10, search } = params;
      // Priorizar subscriberId, depois clientId (compatibilidade)
      const subscriberId = params.subscriberId || params.clientId;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE COALESCE(p.is_active, true) = true';
      const queryParams: any[] = [];

      // Isolamento de dados: não-admin só vê playlists do seu subscriber
      if (!isAdmin && requestSubscriberId) {
        whereClause += ' AND p.subscriber_id = $' + (queryParams.length + 1);
        queryParams.push(requestSubscriberId);
      } else if (subscriberId) {
        // Admin pode filtrar por subscriber específico
        whereClause += ' AND p.subscriber_id = $' + (queryParams.length + 1);
        queryParams.push(subscriberId);
      }

      if (search) {
        whereClause += ' AND (p.name ILIKE $' + (queryParams.length + 1) + ' OR p.description ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      // Filtros de data de criação
      if (params.createdFrom) {
        whereClause += ' AND p.created_at >= $' + (queryParams.length + 1);
        queryParams.push(params.createdFrom);
      }
      if (params.createdTo) {
        whereClause += ' AND p.created_at <= $' + (queryParams.length + 1);
        queryParams.push(params.createdTo);
      }

      // Validação de campo de ordenação
      const validSortFields: { [key: string]: string } = {
        'name': 'p.name',
        'created_at': 'p.created_at',
        'updated_at': 'p.updated_at',
        'media_count': 'media_count',
        'total_duration': 'total_duration'
      };
      const sortBy = params.sortBy || 'created_at';
      const sortField = validSortFields[sortBy] || 'p.created_at';
      const orderDirection = (params.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Buscar playlists
      const playlists = await this.db.findMany(`
        SELECT 
          p.playlist_id,
          p.name,
          p.description,
          p.subscriber_id,
          s.name as subscriber_name,
          COALESCE(p.is_active, true) as is_active,
          p.created_at,
          p.updated_at as updated_at,
          COUNT(pi.item_id) as media_count,
          COALESCE(SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)), 0) as total_duration
        FROM playlists p
        LEFT JOIN subscribers s ON p.subscriber_id = s.subscriber_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        ${whereClause}
        GROUP BY 
          p.playlist_id, 
          p.name, 
          p.description, 
          p.subscriber_id, 
          COALESCE(p.is_active, true),
          p.created_at,
          p.updated_at,
          s.name
        ORDER BY ${sortField} ${orderDirection}
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Mapear para incluir client_id (compatibilidade) e subscriber_id
      const mappedPlaylists = playlists.map(p => ({
        ...p,
        client_id: p.subscriber_id, // Compatibilidade
      }));

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(DISTINCT p.playlist_id) as total
        FROM playlists p
        ${whereClause}
      `, queryParams);

      return {
        data: mappedPlaylists,
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
   * @param id ID da playlist
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin (pode ver todas as playlists)
   */
  async getPlaylistById(id: number, requestSubscriberId?: number, isAdmin: boolean = false): Promise<PlaylistItem | null> {
    try {
      const playlist = await this.db.findFirst(`
        SELECT 
          p.playlist_id,
          p.name,
          p.description,
          p.subscriber_id,
          s.name as subscriber_name,
          COALESCE(p.is_active, true) as is_active,
          p.created_at,
          p.updated_at as updated_at,
          COUNT(pi.item_id) as media_count,
          COALESCE(SUM(COALESCE(pi.display_seconds, m.duration_seconds, 0)), 0) as total_duration
        FROM playlists p
        LEFT JOIN subscribers s ON p.subscriber_id = s.subscriber_id
        LEFT JOIN playlist_items pi ON p.playlist_id = pi.playlist_id
        LEFT JOIN medias m ON pi.media_id = m.media_id
        WHERE p.playlist_id = $1
        GROUP BY 
          p.playlist_id, 
          p.name, 
          p.description, 
          p.subscriber_id, 
          COALESCE(p.is_active, true),
          p.created_at,
          p.updated_at,
          s.name
      `, [id]);

      if (!playlist) {
        return null;
      }

      // Validar ownership: não-admin só pode ver playlists do seu subscriber
      if (!isAdmin && requestSubscriberId && playlist.subscriber_id !== requestSubscriberId) {
        throw new Error('Acesso negado: Você não tem permissão para ver esta playlist');
      }

      // Mapear para incluir client_id (compatibilidade)
      return {
        ...playlist,
        client_id: playlist.subscriber_id, // Compatibilidade
      };
    } catch (error: any) {
      await logError('Erro ao obter playlist', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar nova playlist
   * @param data Dados da playlist
   * @param requestSubscriberId ID do subscriber do usuário autenticado (obrigatório para não-admin)
   * @param isAdmin Se o usuário é admin
   */
  async createPlaylist(data: CreatePlaylistRequest, requestSubscriberId?: number, isAdmin: boolean = false): Promise<PlaylistItem> {
    try {
      let { name, description } = data;
      // Priorizar subscriberId, depois clientId (compatibilidade)
      let subscriberId = data.subscriberId || data.clientId;

      // Se não fornecido e não é admin, usar subscriber do usuário autenticado
      if (!subscriberId) {
        if (!isAdmin && requestSubscriberId) {
          subscriberId = requestSubscriberId;
        } else if (isAdmin) {
          // Admin pode criar sem subscriber, buscar primeiro ativo
          const firstSubscriber = await this.db.findFirst(`
            SELECT subscriber_id FROM subscribers WHERE is_active = true LIMIT 1
          `);
          if (firstSubscriber) {
            subscriberId = firstSubscriber.subscriber_id;
          } else {
            throw new Error('Nenhum subscriber (anunciante) ativo encontrado. É necessário ter pelo menos um subscriber para criar playlists.');
          }
        } else {
          throw new Error('subscriberId é obrigatório para criar playlists');
        }
      }

      // Validar: não-admin só pode criar playlists para seu próprio subscriber
      if (!isAdmin && requestSubscriberId && subscriberId !== requestSubscriberId) {
        throw new Error('Acesso negado: Você só pode criar playlists para seu próprio subscriber');
      }

      // Verificar se playlist já existe para este subscriber
      const existingPlaylist = await this.db.findFirst(`
        SELECT playlist_id FROM playlists WHERE name = $1 AND subscriber_id = $2
      `, [name, subscriberId]);

      if (existingPlaylist) {
        throw new Error('Playlist com este nome já existe para este subscriber');
      }

      // Criar playlist
      const result = await this.db.executeRaw(`
        INSERT INTO playlists (name, description, subscriber_id, is_active)
        VALUES ($1, $2, $3, true)
        RETURNING playlist_id
      `, [name, description, subscriberId]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar playlist');
      }

      const playlistId = result.rows[0].playlist_id;
      const newPlaylist = await this.getPlaylistById(playlistId, requestSubscriberId, isAdmin);

      if (!newPlaylist) {
        throw new Error('Erro ao buscar playlist criada');
      }

      // Invalidar cache
      await getCacheService().invalidateEntity('playlist', playlistId).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', subscriberId).catch(() => {});

      return newPlaylist;
    } catch (error: any) {
      await logError('Erro ao criar playlist', error, { name: data.name, subscriberId: data.subscriberId || data.clientId });
      throw error;
    }
  }

  /**
   * Atualizar playlist
   * @param id ID da playlist
   * @param data Dados para atualizar
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async updatePlaylist(id: number, data: UpdatePlaylistRequest, requestSubscriberId?: number, isAdmin: boolean = false): Promise<PlaylistItem> {
    try {
      const { name, description, isActive } = data;
      // Priorizar subscriberId, depois clientId (compatibilidade)
      const subscriberId = data.subscriberId || data.clientId;

      // Verificar se playlist existe e validar ownership
      const existingPlaylist = await this.getPlaylistById(id, requestSubscriberId, isAdmin);
      if (!existingPlaylist) {
        throw new Error('Playlist não encontrada');
      }

      // Validar: não-admin não pode mudar subscriber_id
      if (!isAdmin && subscriberId !== undefined && subscriberId !== existingPlaylist.subscriber_id) {
        throw new Error('Acesso negado: Você não pode transferir playlists para outro subscriber');
      }

      // Validar: não-admin só pode atualizar suas próprias playlists
      if (!isAdmin && requestSubscriberId && existingPlaylist.subscriber_id !== requestSubscriberId) {
        throw new Error('Acesso negado: Você só pode atualizar suas próprias playlists');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingPlaylist.name) {
        const playlistWithSameName = await this.db.findFirst(`
          SELECT playlist_id FROM playlists WHERE name = $1 AND subscriber_id = $2 AND playlist_id != $3
        `, [name, existingPlaylist.subscriber_id, id]);

        if (playlistWithSameName) {
          throw new Error('Playlist com este nome já existe para este subscriber');
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

      if (subscriberId !== undefined && isAdmin) {
        // Apenas admin pode mudar subscriber_id
        updateFields.push(`subscriber_id = $${paramIndex}`);
        updateParams.push(subscriberId);
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

      const updatedPlaylist = await this.getPlaylistById(id, requestSubscriberId, isAdmin);
      if (!updatedPlaylist) {
        throw new Error('Erro ao buscar playlist atualizada');
      }

      // Invalidar cache
      await getCacheService().invalidateEntity('playlist', id).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', updatedPlaylist.subscriber_id).catch(() => {});

      return updatedPlaylist;
    } catch (error: any) {
      await logError('Erro ao atualizar playlist', error, { id, updateData: data });
      throw error;
    }
  }

  /**
   * Excluir playlist (soft delete)
   * @param id ID da playlist
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async deletePlaylist(id: number, requestSubscriberId?: number, isAdmin: boolean = false): Promise<void> {
    try {
      // Verificar se playlist existe e validar ownership
      const existingPlaylist = await this.getPlaylistById(id, requestSubscriberId, isAdmin);
      if (!existingPlaylist) {
        throw new Error('Playlist não encontrada');
      }

      // Validar: não-admin só pode excluir suas próprias playlists
      if (!isAdmin && requestSubscriberId && existingPlaylist.subscriber_id !== requestSubscriberId) {
        throw new Error('Acesso negado: Você só pode excluir suas próprias playlists');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE playlists 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE playlist_id = $1
      `, [id]);

      // Invalidar cache
      await getCacheService().invalidateEntity('playlist', id).catch(() => {});
      await getCacheService().invalidateEntity('subscriber', existingPlaylist.subscriber_id).catch(() => {});
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
   * @param playlistId ID da playlist
   * @param mediaId ID da mídia
   * @param orderIndex Ordem na playlist (opcional)
   * @param duration Duração de exibição em segundos (opcional)
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async addMediaToPlaylist(
    playlistId: number, 
    mediaId: number, 
    orderIndex?: number, 
    duration?: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<void> {
    try {
      // Verificar se playlist existe e validar ownership
      const playlist = await this.getPlaylistById(playlistId, requestSubscriberId, isAdmin);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Validar: não-admin só pode adicionar mídias às suas próprias playlists
      if (!isAdmin && requestSubscriberId && playlist.subscriber_id !== requestSubscriberId) {
        throw new Error('Acesso negado: Você só pode adicionar mídias às suas próprias playlists');
      }

      // Verificar se mídia existe e validar ownership
      const media = await this.db.findFirst(`
        SELECT media_id, subscriber_id, status 
        FROM medias 
        WHERE media_id = $1 AND status = 'active'
      `, [mediaId]);

      if (!media) {
        throw new Error('Mídia não encontrada ou inativa');
      }

      // VALIDAÇÃO CRÍTICA: Mídia deve pertencer ao mesmo subscriber da playlist
      if (media.subscriber_id !== playlist.subscriber_id) {
        throw new Error(`Mídia pertence a outro subscriber. A playlist pertence ao subscriber ${playlist.subscriber_id}, mas a mídia pertence ao subscriber ${media.subscriber_id}`);
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

      // Invalidar cache
      await getCacheService().invalidateEntity('playlist', playlistId).catch(() => {});
    } catch (error: any) {
      await logError('Erro ao adicionar mídia à playlist', error, { playlistId, mediaId, orderIndex, duration });
      throw error;
    }
  }

  /**
   * Remover mídia da playlist
   * @param playlistId ID da playlist
   * @param itemId ID do item
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async removeMediaFromPlaylist(
    playlistId: number, 
    itemId: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<void> {
    try {
      // Verificar se playlist existe e validar ownership
      const playlist = await this.getPlaylistById(playlistId, requestSubscriberId, isAdmin);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Validar: não-admin só pode remover mídias das suas próprias playlists
      if (!isAdmin && requestSubscriberId && playlist.subscriber_id !== requestSubscriberId) {
        throw new Error('Acesso negado: Você só pode remover mídias das suas próprias playlists');
      }

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

      // Invalidar cache
      await getCacheService().invalidateEntity('playlist', playlistId).catch(() => {});
    } catch (error: any) {
      await logError('Erro ao remover mídia da playlist', error, { itemId });
      throw error;
    }
  }

  /**
   * Atualizar duração de um item da playlist
   * @param playlistId ID da playlist
   * @param itemId ID do item
   * @param duration Duração em milissegundos
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async updatePlaylistItemDuration(
    playlistId: number,
    itemId: number,
    duration: number,
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<void> {
    try {
      // Verificar se playlist existe e validar ownership
      const playlist = await this.getPlaylistById(playlistId, requestSubscriberId, isAdmin);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Validar: não-admin só pode atualizar suas próprias playlists
      if (!isAdmin && requestSubscriberId && playlist.subscriber_id !== requestSubscriberId) {
        throw new Error('Acesso negado: Você só pode atualizar suas próprias playlists');
      }

      // Validar duração (mínimo 1 segundo = 1000ms, máximo 5 minutos = 300000ms)
      if (duration < 1000 || duration > 300000) {
        throw new Error('Duração deve estar entre 1 e 300 segundos');
      }

      // Verificar se item existe
      const item = await this.db.findFirst(`
        SELECT item_id FROM playlist_items WHERE item_id = $1 AND playlist_id = $2
      `, [itemId, playlistId]);

      if (!item) {
        throw new Error('Item não encontrado na playlist');
      }

      // Atualizar duração
      await this.db.executeRaw(`
        UPDATE playlist_items 
        SET display_seconds = $1, updated_at = CURRENT_TIMESTAMP
        WHERE item_id = $2 AND playlist_id = $3
      `, [duration, itemId, playlistId]);

      // Invalidar cache
      await getCacheService().invalidateEntity('playlist', playlistId).catch(() => {});
    } catch (error: any) {
      await logError('Erro ao atualizar duração do item da playlist', error, { playlistId, itemId, duration });
      throw error;
    }
  }

  /**
   * Reordenar mídia da playlist
   * @param playlistId ID da playlist
   * @param items Array de itens com nova ordem
   * @param requestSubscriberId ID do subscriber do usuário autenticado (para validação de ownership)
   * @param isAdmin Se o usuário é admin
   */
  async reorderPlaylistMedia(
    playlistId: number, 
    items: { itemId: number; orderIndex: number }[],
    requestSubscriberId?: number,
    isAdmin: boolean = false
  ): Promise<void> {
    try {
      // Verificar se playlist existe e validar ownership
      const playlist = await this.getPlaylistById(playlistId, requestSubscriberId, isAdmin);
      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Validar: não-admin só pode reordenar suas próprias playlists
      if (!isAdmin && requestSubscriberId && playlist.subscriber_id !== requestSubscriberId) {
        throw new Error('Acesso negado: Você só pode reordenar suas próprias playlists');
      }

      // Atualizar ordem de cada item
      for (const item of items) {
        await this.db.executeRaw(`
          UPDATE playlist_items 
          SET order_index = $1
          WHERE item_id = $2 AND playlist_id = $3
        `, [item.orderIndex, item.itemId, playlistId]);
      }

      // Invalidar cache
      await getCacheService().invalidateEntity('playlist', playlistId).catch(() => {});
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
