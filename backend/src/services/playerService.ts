import { getDatabase } from '../config/database';

export interface Player {
  totem_id: number;
  name: string;
  location?: string;
  client_id?: number;
  is_active: boolean;
  last_heartbeat?: string;
  current_playlist_id?: number;
  status: 'online' | 'offline' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CreatePlayerRequest {
  name: string;
  location?: string;
  clientId?: number;
}

export interface UpdatePlayerRequest {
  name?: string;
  location?: string;
  clientId?: number;
  isActive?: boolean;
}

export interface PlayerListResponse {
  data: Player[];
  total: number;
  page: number;
  limit: number;
}

export class PlayerService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar players com paginação e filtros
   */
  async getAllPlayers(params: {
    page?: number;
    limit?: number;
    search?: string;
    clientId?: number;
    status?: string;
  }): Promise<PlayerListResponse> {
    try {
      const { page = 1, limit = 10, search, clientId, status } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE t.is_active = true';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (t.name ILIKE $' + (queryParams.length + 1) + ' OR t.location ILIKE $' + (queryParams.length + 1) + ')';
        queryParams.push(`%${search}%`);
      }

      if (clientId) {
        whereClause += ' AND t.client_id = $' + (queryParams.length + 1);
        queryParams.push(clientId);
      }

      if (status) {
        whereClause += ' AND t.status = $' + (queryParams.length + 1);
        queryParams.push(status);
      }

      // Buscar players
      const players = await this.db.findMany(`
        SELECT 
          t.totem_id,
          t.name,
          t.location,
          t.client_id,
          t.is_active,
          t.last_heartbeat,
          t.current_playlist_id,
          CASE 
            WHEN t.last_heartbeat IS NULL THEN 'offline'
            WHEN t.last_heartbeat < NOW() - INTERVAL '5 minutes' THEN 'offline'
            ELSE 'online'
          END as status,
          t.created_at,
          t.updated_at,
          c.name as client_name
        FROM totems t
        LEFT JOIN clients c ON t.client_id = c.client_id
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Contar total
      const totalResult = await this.db.findFirst(`
        SELECT COUNT(*) as total
        FROM totems t
        ${whereClause}
      `, queryParams);

      return {
        data: players,
        total: parseInt(totalResult?.total || '0'),
        page,
        limit,
      };
    } catch (error: any) {
      console.error('Erro ao listar players:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter player por ID
   */
  async getPlayerById(id: number): Promise<Player | null> {
    try {
      const player = await this.db.findFirst(`
        SELECT 
          t.totem_id,
          t.name,
          t.location,
          t.client_id,
          t.is_active,
          t.last_heartbeat,
          t.current_playlist_id,
          CASE 
            WHEN t.last_heartbeat IS NULL THEN 'offline'
            WHEN t.last_heartbeat < NOW() - INTERVAL '5 minutes' THEN 'offline'
            ELSE 'online'
          END as status,
          t.created_at,
          t.updated_at,
          c.name as client_name
        FROM totems t
        LEFT JOIN clients c ON t.client_id = c.client_id
        WHERE t.totem_id = $1
      `, [id]);

      return player;
    } catch (error: any) {
      console.error('Erro ao obter player:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo player
   */
  async createPlayer(data: CreatePlayerRequest): Promise<Player> {
    try {
      const { name, location, clientId } = data;

      // Verificar se player já existe
      const existingPlayer = await this.db.findFirst(`
        SELECT totem_id FROM totems WHERE name = $1
      `, [name]);

      if (existingPlayer) {
        throw new Error('Player com este nome já existe');
      }

      // Criar player
      const identifier = name.trim();

      const result = await this.db.executeRaw(`
        INSERT INTO totems (
          name,
          identifier,
          location,
          client_id,
          is_active,
          active,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, true, true, 'pending_approval', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING totem_id
      `, [name, identifier, location, clientId]);

      if (!result.rows || result.rows.length === 0) {
        throw new Error('Erro ao criar player');
      }

      const playerId = result.rows[0].totem_id;
      const newPlayer = await this.getPlayerById(playerId);

      if (!newPlayer) {
        throw new Error('Erro ao buscar player criado');
      }

      return newPlayer;
    } catch (error: any) {
      console.error('Erro ao criar player:', error.message);
      throw error;
    }
  }

  /**
   * Atualizar player
   */
  async updatePlayer(id: number, data: UpdatePlayerRequest): Promise<Player> {
    try {
      const { name, location, clientId, isActive } = data;

      // Verificar se player existe
      const existingPlayer = await this.getPlayerById(id);
      if (!existingPlayer) {
        throw new Error('Player não encontrado');
      }

      // Verificar se nome já existe (se mudou)
      if (name && name !== existingPlayer.name) {
        const playerWithSameName = await this.db.findFirst(`
          SELECT totem_id FROM totems WHERE name = $1 AND totem_id != $2
        `, [name, id]);

        if (playerWithSameName) {
          throw new Error('Player com este nome já existe');
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

        updateFields.push(`identifier = $${paramIndex}`);
        updateParams.push(name.trim());
        paramIndex++;
      }

      if (location !== undefined) {
        updateFields.push(`location = $${paramIndex}`);
        updateParams.push(location);
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

        updateFields.push(`active = $${paramIndex}`);
        updateParams.push(isActive);
        paramIndex++;
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      // Executar atualização
      await this.db.executeRaw(`
        UPDATE totems 
        SET ${updateFields.join(', ')}
        WHERE totem_id = $${paramIndex}
      `, [...updateParams, id]);

      const updatedPlayer = await this.getPlayerById(id);
      if (!updatedPlayer) {
        throw new Error('Erro ao buscar player atualizado');
      }

      return updatedPlayer;
    } catch (error: any) {
      console.error('Erro ao atualizar player:', error.message);
      throw error;
    }
  }

  /**
   * Excluir player (soft delete)
   */
  async deletePlayer(id: number): Promise<void> {
    try {
      // Verificar se player existe
      const existingPlayer = await this.getPlayerById(id);
      if (!existingPlayer) {
        throw new Error('Player não encontrado');
      }

      // Soft delete - marcar como inativo
      await this.db.executeRaw(`
        UPDATE totems 
        SET is_active = false, active = false, updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = $1
      `, [id]);
    } catch (error: any) {
      console.error('Erro ao excluir player:', error.message);
      throw error;
    }
  }

  /**
   * Atribuir playlist ao player
   */
  async assignPlaylist(playerId: number, playlistId: number): Promise<void> {
    try {
      // Verificar se player existe
      const player = await this.getPlayerById(playerId);
      if (!player) {
        throw new Error('Player não encontrado');
      }

      // Verificar se playlist existe
      const playlist = await this.db.findFirst(`
        SELECT playlist_id FROM playlists WHERE playlist_id = $1 AND is_active = true
      `, [playlistId]);

      if (!playlist) {
        throw new Error('Playlist não encontrada');
      }

      // Atribuir playlist
      await this.db.executeRaw(`
        UPDATE totems 
        SET current_playlist_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = $2
      `, [playlistId, playerId]);
    } catch (error: any) {
      console.error('Erro ao atribuir playlist:', error.message);
      throw error;
    }
  }

  /**
   * Obter status do player
   */
  async getPlayerStatus(id: number): Promise<{
    status: string;
    lastHeartbeat: string;
    currentPlaylist?: any;
  }> {
    try {
      const player = await this.getPlayerById(id);
      if (!player) {
        throw new Error('Player não encontrado');
      }

      let currentPlaylist = null;
      if (player.current_playlist_id) {
        currentPlaylist = await this.db.findFirst(`
          SELECT playlist_id, name, description
          FROM playlists 
          WHERE playlist_id = $1 AND is_active = true
        `, [player.current_playlist_id]);
      }

      return {
        status: player.status,
        lastHeartbeat: player.last_heartbeat || '',
        currentPlaylist,
      };
    } catch (error: any) {
      console.error('Erro ao obter status do player:', error.message);
      throw error;
    }
  }
}

// Instância global do serviço
let playerServiceInstance: PlayerService;

export function getPlayerService(): PlayerService {
  if (!playerServiceInstance) {
    playerServiceInstance = new PlayerService();
  }
  return playerServiceInstance;
}

