import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { isStudioRuntime } from '../config/installationRuntime';
import { userMayCreateTotem } from '../utils/totemCreateRoles';

export interface Player {
  totem_id: number;
  name: string;
  location?: string; // pode vir do local (locals.name) ou descrição
  publisher_id?: number; // NOVO: Totem pertence a publisher via local_id
  client_id?: number; // DEPRECADO: Mantido para compatibilidade
  is_active: boolean;
  last_heartbeat?: string;
  current_playlist_id?: number;
  status: 'online' | 'offline' | 'error' | 'pending_approval' | 'maintenance' | 'syncing';
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

      // Totem não tem client_id mais - filtrar via local_id -> publisher_id
      if (clientId) {
        // Se clientId fornecido, mapear para publisher_id via locals
        whereClause += ' AND t.local_id IN (SELECT local_id FROM locals WHERE publisher_id = $' + (queryParams.length + 1) + ')';
        queryParams.push(clientId); // clientId mapeado para publisher_id
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
          COALESCE(t.description, l.name) as location,
          l.name as local_name,
          t.identifier,
          t.uin,
          l.publisher_id,
          l.publisher_id as client_id, -- Mantido para compatibilidade
          t.is_active,
          t.last_heartbeat,
          NULL::integer as current_playlist_id,
          t.status,
          t.created_at,
          t.updated_at,
          p.name as publisher_name,
          p.name as client_name -- Mantido para compatibilidade
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
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
      await logError('Erro ao listar players', error, { params });
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
          COALESCE(t.description, l.name) as location,
          l.name as local_name,
          t.identifier,
          t.uin,
          l.publisher_id,
          l.publisher_id as client_id, -- Mantido para compatibilidade
          t.is_active,
          t.last_heartbeat,
          NULL::integer as current_playlist_id,
          t.status,
          t.created_at,
          t.updated_at,
          p.name as publisher_name,
          p.name as client_name -- Mantido para compatibilidade
        FROM totems t
        LEFT JOIN locals l ON t.local_id = l.local_id
        LEFT JOIN publishers p ON l.publisher_id = p.publisher_id
        WHERE t.totem_id = $1
      `, [id]);

      return player;
    } catch (error: any) {
      await logError('Erro ao obter player', error, { id });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Criar novo player
   */
  async createPlayer(data: CreatePlayerRequest, creatorRole?: string): Promise<Player> {
    try {
      if (creatorRole !== undefined && !userMayCreateTotem(creatorRole)) {
        throw new Error('Acesso negado: criação de totem não permitida para este perfil');
      }

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
      
      // Totem não tem client_id mais - precisa de local_id
      // Se clientId fornecido, buscar local_id via publisher_id
      let localId: number | null = null;
      if (clientId) {
        // Buscar primeiro local deste publisher
        const local = await this.db.findFirst(`
          SELECT local_id FROM locals 
          WHERE publisher_id = $1 AND is_active = true 
          ORDER BY local_id ASC 
          LIMIT 1
        `, [clientId]);
        localId = local?.local_id || null;
        
        if (!localId) {
          throw new Error('Publisher não possui nenhum local ativo. Crie um local antes de criar o totem.');
        }
      }

      const initialStatus = isStudioRuntime() ? 'offline' : 'pending_approval';
      const result = await this.db.executeRaw(`
        INSERT INTO totems (
          name,
          identifier,
          description,
          local_id,
          is_active,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, true, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING totem_id
      `, [name, identifier, location || null, localId, initialStatus]);

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
      await logError('Erro ao criar player', error, { data });
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

      // Totem não tem client_id mais - usar local_id via publisher_id
      if (clientId !== undefined) {
        // Buscar local_id deste publisher
        const local = await this.db.findFirst(`
          SELECT local_id FROM locals 
          WHERE publisher_id = $1 AND is_active = true 
          ORDER BY local_id ASC 
          LIMIT 1
        `, [clientId]);
        
        if (!local) {
          throw new Error('Publisher não possui nenhum local ativo');
        }
        
        updateFields.push(`local_id = $${paramIndex}`);
        updateParams.push(local.local_id);
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
      await logError('Erro ao atualizar player', error, { id, data });
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
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE totem_id = $1
      `, [id]);
    } catch (error: any) {
      await logError('Erro ao excluir player', error, { id });
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
      await logError('Erro ao atribuir playlist', error, { playerId, playlistId });
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
      await logError('Erro ao obter status do player', error, { id });
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

