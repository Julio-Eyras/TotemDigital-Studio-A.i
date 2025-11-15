import { getDatabase } from '../config/database';

export interface DashboardStats {
  totalMedia: number;
  totalPlaylists: number;
  totalPlayers: number;
  totalUsers: number;
  activePlayers: number;
  offlinePlayers: number;
}

export interface RecentActivity {
  id: string;
  type: 'upload' | 'playlist' | 'player' | 'user' | 'client';
  message: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

export class DashboardService {
  private get db() {
    return getDatabase();
  }

  /**
   * Obter estatísticas do dashboard
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Contar mídia
      const mediaCount = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM medias
      `);

      // Contar playlists
      const playlistCount = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM playlists WHERE is_active = true
      `);

      // Contar players
      const playerCount = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM totems WHERE is_active = true
      `);

      // Contar usuários
      const userCount = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM users WHERE is_active = true
      `);

      // Contar players online
      const activePlayerCount = await this.db.findFirst(`
        SELECT COUNT(*) as total 
        FROM totems 
        WHERE COALESCE(is_active, true) = true 
        AND last_heartbeat IS NOT NULL 
        AND last_heartbeat > NOW() - INTERVAL '5 minutes'
      `);

      const offlinePlayerCount = await this.db.findFirst(`
        SELECT COUNT(*) as total 
        FROM totems 
        WHERE COALESCE(is_active, true) = true 
        AND (
          last_heartbeat IS NULL 
          OR last_heartbeat <= NOW() - INTERVAL '5 minutes'
        )
      `);

      return {
        totalMedia: parseInt(mediaCount?.total || '0'),
        totalPlaylists: parseInt(playlistCount?.total || '0'),
        totalPlayers: parseInt(playerCount?.total || '0'),
        totalUsers: parseInt(userCount?.total || '0'),
        activePlayers: parseInt(activePlayerCount?.total || '0'),
        offlinePlayers: parseInt(offlinePlayerCount?.total || '0'),
      };
    } catch (error: any) {
      console.error('Erro ao obter estatísticas do dashboard:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter atividades recentes
   */
  async getRecentActivity(limit: number = 10): Promise<RecentActivity[]> {
    try {
      // Buscar atividades recentes de diferentes tabelas
      const activities: RecentActivity[] = [];

      // Atividades de mídia (uploads recentes)
      const recentMedia = await this.db.findMany(`
        SELECT 
          'upload' as type,
          'Novo arquivo "' || name || '" enviado' as message,
          COALESCE(created_at, generated_at) as timestamp,
          'success' as status,
          media_id::text as id
        FROM medias 
        ORDER BY COALESCE(created_at, generated_at) DESC 
        LIMIT $1
      `, [Math.floor(limit / 3)]);

      activities.push(...recentMedia);

      // Atividades de playlists
      const recentPlaylists = await this.db.findMany(`
        SELECT 
          'playlist' as type,
          'Playlist "' || name || '" ' || 
          CASE 
            WHEN updated_at > COALESCE(created_at, generated_at) THEN 'atualizada'
            ELSE 'criada'
          END as message,
          GREATEST(
            COALESCE(created_at, generated_at) as created_at,
            updated_at
          ) as timestamp,
          'success' as status,
          playlist_id::text as id
        FROM playlists 
        WHERE COALESCE(is_active, true) = true
        ORDER BY GREATEST(
          COALESCE(created_at, generated_at) as created_at,
          updated_at
        ) DESC 
        LIMIT $1
      `, [Math.floor(limit / 3)]);

      activities.push(...recentPlaylists);

      // Atividades de players (status changes)
      const recentPlayers = await this.db.findMany(`
        SELECT 
          'player' as type,
          'Player "' || COALESCE(name, identifier, 'Totem ' || totem_id::text) || '" ' ||
          CASE 
            WHEN last_heartbeat IS NULL 
              OR last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'ficou offline'
            ELSE 'está online'
          END as message,
          COALESCE(last_heartbeat, updated_at) as timestamp,
          CASE 
            WHEN last_heartbeat IS NULL 
              OR last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'warning'
            ELSE 'success'
          END as status,
          totem_id::text as id
        FROM totems 
        WHERE COALESCE(is_active, true) = true
        ORDER BY COALESCE(last_heartbeat, updated_at) DESC 
        LIMIT $1
      `, [Math.floor(limit / 3)]);

      activities.push(...recentPlayers);

      // Ordenar todas as atividades por timestamp e limitar
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return activities.slice(0, limit);
    } catch (error: any) {
      console.error('Erro ao obter atividades recentes:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter estatísticas por cliente
   */
  async getStatsByClient(clientId: number): Promise<{
    mediaCount: number;
    playlistCount: number;
    playerCount: number;
    activePlayerCount: number;
  }> {
    try {
      // Contar mídia do cliente
      const mediaCount = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM medias WHERE client_id = $1 AND status = 'active'
      `, [clientId]);

      // Contar playlists do cliente
      const playlistCount = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM playlists WHERE client_id = $1 AND is_active = true
      `, [clientId]);

      // Contar players do cliente
      const playerCount = await this.db.findFirst(`
        SELECT COUNT(*) as total FROM totems WHERE client_id = $1 AND is_active = true
      `, [clientId]);

      // Contar players ativos do cliente
      const activePlayerCount = await this.db.findFirst(`
        SELECT COUNT(*) as total 
        FROM totems 
        WHERE client_id = $1 
        AND is_active = true 
        AND last_heartbeat IS NOT NULL 
        AND last_heartbeat > NOW() - INTERVAL '5 minutes'
      `, [clientId]);

      return {
        mediaCount: parseInt(mediaCount?.total || '0'),
        playlistCount: parseInt(playlistCount?.total || '0'),
        playerCount: parseInt(playerCount?.total || '0'),
        activePlayerCount: parseInt(activePlayerCount?.total || '0'),
      };
    } catch (error: any) {
      console.error('Erro ao obter estatísticas por cliente:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter gráficos de uso
   */
  async getUsageCharts(): Promise<{
    mediaByType: { type: string; count: number }[];
    playersByStatus: { status: string; count: number }[];
    activityByDay: { date: string; count: number }[];
  }> {
    try {
      // Mídia por tipo
      const mediaByType = await this.db.findMany(`
        SELECT 
          media_type as type,
          COUNT(*) as count
        FROM medias 
        GROUP BY media_type
        ORDER BY count DESC
      `);

      const playersByStatus = await this.db.findMany(`
        SELECT 
          CASE 
            WHEN last_heartbeat IS NULL 
              OR last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'offline'
            ELSE 'online'
          END as status,
          COUNT(*) as count
        FROM totems 
        WHERE COALESCE(is_active, true) = true
        GROUP BY 
          CASE 
            WHEN last_heartbeat IS NULL 
              OR last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'offline'
            ELSE 'online'
          END
      `);

      const activityByDay = await this.db.findMany(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM (
          SELECT created_at 
          FROM medias 
          WHERE created_at >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT COALESCE(created_at, generated_at) 
          FROM playlists 
          WHERE COALESCE(created_at, generated_at) >= NOW() - INTERVAL '7 days'
          UNION ALL
          SELECT created_at 
          FROM users 
          WHERE created_at >= NOW() - INTERVAL '7 days'
        ) activities
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 7
      `);

      return {
        mediaByType: mediaByType.map(item => ({ type: item.type, count: parseInt(item.count) })),
        playersByStatus: playersByStatus.map(item => ({ status: item.status, count: parseInt(item.count) })),
        activityByDay: activityByDay.map(item => ({ date: item.date, count: parseInt(item.count) })),
      };
    } catch (error: any) {
      console.error('Erro ao obter gráficos de uso:', error.message);
      throw new Error('Erro interno do servidor');
    }
  }
}

// Instância global do serviço
let dashboardServiceInstance: DashboardService;

export function getDashboardService(): DashboardService {
  if (!dashboardServiceInstance) {
    dashboardServiceInstance = new DashboardService();
  }
  return dashboardServiceInstance;
}

