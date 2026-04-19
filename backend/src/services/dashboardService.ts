import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import type { TenantScope } from '../utils/tenantScope';

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

/** JOIN recorrente: assinantes com plano que inclui o publisher */
const SQL_MEDIA_PUBLISHER_SCOPE = `
  FROM medias m
  INNER JOIN subscriber_contracts sc ON sc.subscriber_id = m.subscriber_id
    AND sc.status = 'active'
    AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
    AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
  INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
    AND ppa.publisher_id = ?
    AND ppa.is_allowed = true
    AND COALESCE(ppa.is_active, true) = true
`;

const SQL_PLAYLIST_PUBLISHER_SCOPE = `
  FROM playlists pl
  INNER JOIN subscriber_contracts sc ON sc.subscriber_id = pl.subscriber_id
    AND sc.status = 'active'
    AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
    AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
  INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
    AND ppa.publisher_id = ?
    AND ppa.is_allowed = true
    AND COALESCE(ppa.is_active, true) = true
`;

const SQL_TOTEMS_SUBSCRIBER_NETWORK = `
  FROM totems t
  INNER JOIN locals l ON l.local_id = t.local_id
  INNER JOIN subscriber_contracts sc ON sc.subscriber_id = ?
    AND sc.status = 'active'
    AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
    AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
  INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
    AND ppa.publisher_id = l.publisher_id
    AND ppa.is_allowed = true
    AND COALESCE(ppa.is_active, true) = true
`;

export class DashboardService {
  private get db() {
    return getDatabase();
  }

  private emptyDashboardStats(): DashboardStats {
    return {
      totalMedia: 0,
      totalPlaylists: 0,
      totalPlayers: 0,
      totalUsers: 0,
      activePlayers: 0,
      offlinePlayers: 0
    };
  }

  /**
   * Obter estatísticas do dashboard (escopo opcional; admin sem escopo = global)
   */
  async getDashboardStats(scope?: TenantScope | null): Promise<DashboardStats> {
    try {
      if (scope?.scopedPublisherId != null && scope.scopedPublisherId < 0) {
        return this.emptyDashboardStats();
      }
      if (scope?.scopedSubscriberId != null && scope.scopedSubscriberId < 0) {
        return this.emptyDashboardStats();
      }

      if (!scope) {
        return await this.getDashboardStatsGlobal();
      }
      if (scope.scopedPublisherId != null) {
        return await this.getDashboardStatsForPublisher(scope.scopedPublisherId);
      }
      if (scope.scopedSubscriberId != null) {
        return await this.getDashboardStatsForSubscriber(scope.scopedSubscriberId);
      }
      return await this.getDashboardStatsGlobal();
    } catch (error: any) {
      await logError('Erro ao obter estatísticas do dashboard', error, {});
      throw new Error('Erro interno do servidor');
    }
  }

  private async getDashboardStatsGlobal(): Promise<DashboardStats> {
    const mediaCount = await this.db.findFirst(`
      SELECT COUNT(*) as total FROM medias
    `);

    const playlistCount = await this.db.findFirst(`
      SELECT COUNT(*) as total FROM playlists WHERE is_active = true
    `);

    const playerCount = await this.db.findFirst(`
      SELECT COUNT(*) as total FROM totems WHERE is_active = true
    `);

    const userCount = await this.db.findFirst(`
      SELECT COUNT(*) as total FROM users WHERE is_active = true
    `);

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
      totalMedia: parseInt(String(mediaCount?.total || '0'), 10),
      totalPlaylists: parseInt(String(playlistCount?.total || '0'), 10),
      totalPlayers: parseInt(String(playerCount?.total || '0'), 10),
      totalUsers: parseInt(String(userCount?.total || '0'), 10),
      activePlayers: parseInt(String(activePlayerCount?.total || '0'), 10),
      offlinePlayers: parseInt(String(offlinePlayerCount?.total || '0'), 10)
    };
  }

  private async getDashboardStatsForPublisher(publisherId: number): Promise<DashboardStats> {
    const pid = publisherId;

    const mediaCount = await this.db.findFirst(
      `SELECT COUNT(DISTINCT m.media_id) as total ${SQL_MEDIA_PUBLISHER_SCOPE}
      WHERE COALESCE(m.is_active, true) = true`,
      [pid]
    );

    const playlistCount = await this.db.findFirst(
      `SELECT COUNT(DISTINCT pl.playlist_id) as total ${SQL_PLAYLIST_PUBLISHER_SCOPE}
      WHERE COALESCE(pl.is_active, true) = true`,
      [pid]
    );

    const playerCount = await this.db.findFirst(
      `
      SELECT COUNT(*) as total FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE t.is_active = true AND l.publisher_id = ?
    `,
      [pid]
    );

    const userCount = await this.db.findFirst(
      `
      SELECT COUNT(*) as total FROM users WHERE is_active = true AND publisher_id = ?
    `,
      [pid]
    );

    const activePlayerCount = await this.db.findFirst(
      `
      SELECT COUNT(*) as total 
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE COALESCE(t.is_active, true) = true 
      AND l.publisher_id = ?
      AND t.last_heartbeat IS NOT NULL 
      AND t.last_heartbeat > NOW() - INTERVAL '5 minutes'
    `,
      [pid]
    );

    const offlinePlayerCount = await this.db.findFirst(
      `
      SELECT COUNT(*) as total 
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE COALESCE(t.is_active, true) = true 
      AND l.publisher_id = ?
      AND (
        t.last_heartbeat IS NULL 
        OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes'
      )
    `,
      [pid]
    );

    return {
      totalMedia: parseInt(String(mediaCount?.total || '0'), 10),
      totalPlaylists: parseInt(String(playlistCount?.total || '0'), 10),
      totalPlayers: parseInt(String(playerCount?.total || '0'), 10),
      totalUsers: parseInt(String(userCount?.total || '0'), 10),
      activePlayers: parseInt(String(activePlayerCount?.total || '0'), 10),
      offlinePlayers: parseInt(String(offlinePlayerCount?.total || '0'), 10)
    };
  }

  private async getDashboardStatsForSubscriber(subscriberId: number): Promise<DashboardStats> {
    const sid = subscriberId;

    const mediaCount = await this.db.findFirst(
      `
      SELECT COUNT(*) as total FROM medias WHERE subscriber_id = ? AND COALESCE(is_active, true) = true
    `,
      [sid]
    );

    const playlistCount = await this.db.findFirst(
      `
      SELECT COUNT(*) as total FROM playlists WHERE subscriber_id = ? AND is_active = true
    `,
      [sid]
    );

    const playerCount = await this.db.findFirst(
      `SELECT COUNT(DISTINCT t.totem_id) as total ${SQL_TOTEMS_SUBSCRIBER_NETWORK}
      WHERE COALESCE(t.is_active, true) = true`,
      [sid]
    );

    const userCount = await this.db.findFirst(
      `
      SELECT COUNT(*) as total FROM users WHERE is_active = true AND subscriber_id = ?
    `,
      [sid]
    );

    const activePlayerCount = await this.db.findFirst(
      `SELECT COUNT(DISTINCT t.totem_id) as total ${SQL_TOTEMS_SUBSCRIBER_NETWORK}
      WHERE COALESCE(t.is_active, true) = true
      AND t.last_heartbeat IS NOT NULL 
      AND t.last_heartbeat > NOW() - INTERVAL '5 minutes'`,
      [sid]
    );

    const offlinePlayerCount = await this.db.findFirst(
      `SELECT COUNT(DISTINCT t.totem_id) as total ${SQL_TOTEMS_SUBSCRIBER_NETWORK}
      WHERE COALESCE(t.is_active, true) = true
      AND (
        t.last_heartbeat IS NULL 
        OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes'
      )`,
      [sid]
    );

    return {
      totalMedia: parseInt(String(mediaCount?.total || '0'), 10),
      totalPlaylists: parseInt(String(playlistCount?.total || '0'), 10),
      totalPlayers: parseInt(String(playerCount?.total || '0'), 10),
      totalUsers: parseInt(String(userCount?.total || '0'), 10),
      activePlayers: parseInt(String(activePlayerCount?.total || '0'), 10),
      offlinePlayers: parseInt(String(offlinePlayerCount?.total || '0'), 10)
    };
  }

  /**
   * Obter atividades recentes
   */
  async getRecentActivity(limit: number = 10, scope?: TenantScope | null): Promise<RecentActivity[]> {
    try {
      if (scope?.scopedPublisherId != null && scope.scopedPublisherId < 0) return [];
      if (scope?.scopedSubscriberId != null && scope.scopedSubscriberId < 0) return [];

      const chunk = Math.max(1, Math.floor(limit / 3));
      const activities: RecentActivity[] = [];

      if (!scope) {
        const recentMedia = await this.db.findMany(
          `
        SELECT 
          'upload' as type,
          'Novo arquivo "' || name || '" enviado' as message,
          created_at as timestamp,
          'success' as status,
          media_id::text as id
        FROM medias 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
          [chunk]
        );
        activities.push(...recentMedia);

        const recentPlaylists = await this.db.findMany(
          `
        SELECT 
          'playlist' as type,
          'Playlist "' || name || '" ' || 
          CASE 
            WHEN updated_at > created_at THEN 'atualizada'
            ELSE 'criada'
          END as message,
          GREATEST(created_at, updated_at) as timestamp,
          'success' as status,
          playlist_id::text as id
        FROM playlists 
        WHERE COALESCE(is_active, true) = true
        ORDER BY GREATEST(created_at, updated_at) DESC 
        LIMIT ?
      `,
          [chunk]
        );
        activities.push(...recentPlaylists);

        const recentPlayers = await this.db.findMany(
          `
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
        LIMIT ?
      `,
          [chunk]
        );
        activities.push(...recentPlayers);
      } else if (scope.scopedPublisherId != null) {
        const pid = scope.scopedPublisherId;
        const recentMedia = await this.db.findMany(
          `
        SELECT 
          'upload' as type,
          'Novo arquivo "' || m.name || '" enviado' as message,
          m.created_at as timestamp,
          'success' as status,
          m.media_id::text as id
        ${SQL_MEDIA_PUBLISHER_SCOPE}
        WHERE COALESCE(m.is_active, true) = true
        ORDER BY m.created_at DESC 
        LIMIT ?
      `,
          [pid, chunk]
        );
        activities.push(...recentMedia);

        const recentPlaylists = await this.db.findMany(
          `
        SELECT 
          'playlist' as type,
          'Playlist "' || pl.name || '" ' || 
          CASE 
            WHEN pl.updated_at > pl.created_at THEN 'atualizada'
            ELSE 'criada'
          END as message,
          GREATEST(pl.created_at, pl.updated_at) as timestamp,
          'success' as status,
          pl.playlist_id::text as id
        ${SQL_PLAYLIST_PUBLISHER_SCOPE}
        WHERE COALESCE(pl.is_active, true) = true
        ORDER BY GREATEST(pl.created_at, pl.updated_at) DESC 
        LIMIT ?
      `,
          [pid, chunk]
        );
        activities.push(...recentPlaylists);

        const recentPlayers = await this.db.findMany(
          `
        SELECT 
          'player' as type,
          'Player "' || COALESCE(t.name, t.identifier, 'Totem ' || t.totem_id::text) || '" ' ||
          CASE 
            WHEN t.last_heartbeat IS NULL 
              OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'ficou offline'
            ELSE 'está online'
          END as message,
          COALESCE(t.last_heartbeat, t.updated_at) as timestamp,
          CASE 
            WHEN t.last_heartbeat IS NULL 
              OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'warning'
            ELSE 'success'
          END as status,
          t.totem_id::text as id
        FROM totems t
        INNER JOIN locals l ON l.local_id = t.local_id
        WHERE COALESCE(t.is_active, true) = true AND l.publisher_id = ?
        ORDER BY COALESCE(t.last_heartbeat, t.updated_at) DESC 
        LIMIT ?
      `,
          [pid, chunk]
        );
        activities.push(...recentPlayers);
      } else if (scope.scopedSubscriberId != null) {
        const sid = scope.scopedSubscriberId;
        const recentMedia = await this.db.findMany(
          `
        SELECT 
          'upload' as type,
          'Novo arquivo "' || name || '" enviado' as message,
          created_at as timestamp,
          'success' as status,
          media_id::text as id
        FROM medias 
        WHERE subscriber_id = ?
        ORDER BY created_at DESC 
        LIMIT ?
      `,
          [sid, chunk]
        );
        activities.push(...recentMedia);

        const recentPlaylists = await this.db.findMany(
          `
        SELECT 
          'playlist' as type,
          'Playlist "' || name || '" ' || 
          CASE 
            WHEN updated_at > created_at THEN 'atualizada'
            ELSE 'criada'
          END as message,
          GREATEST(created_at, updated_at) as timestamp,
          'success' as status,
          playlist_id::text as id
        FROM playlists 
        WHERE subscriber_id = ? AND COALESCE(is_active, true) = true
        ORDER BY GREATEST(created_at, updated_at) DESC 
        LIMIT ?
      `,
          [sid, chunk]
        );
        activities.push(...recentPlaylists);

        const recentPlayers = await this.db.findMany(
          `
        SELECT 
          'player' as type,
          'Player "' || COALESCE(t.name, t.identifier, 'Totem ' || t.totem_id::text) || '" ' ||
          CASE 
            WHEN t.last_heartbeat IS NULL 
              OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'ficou offline'
            ELSE 'está online'
          END as message,
          COALESCE(t.last_heartbeat, t.updated_at) as timestamp,
          CASE 
            WHEN t.last_heartbeat IS NULL 
              OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'warning'
            ELSE 'success'
          END as status,
          t.totem_id::text as id
        ${SQL_TOTEMS_SUBSCRIBER_NETWORK}
        WHERE COALESCE(t.is_active, true) = true
        ORDER BY COALESCE(t.last_heartbeat, t.updated_at) DESC 
        LIMIT ?
      `,
          [sid, chunk]
        );
        activities.push(...recentPlayers);
      }

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return activities.slice(0, limit);
    } catch (error: any) {
      await logError('Erro ao obter atividades recentes', error, { limit });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Estatísticas por “cliente” na URL: `subscriber` = o id é subscriber_id (rede de totens via plano);
   * `publisher` = o id é publisher_id (mídia/playlists via plan_publisher_access; totens do publisher).
   */
  async getStatsByClient(
    id: number,
    view: 'subscriber' | 'publisher' = 'subscriber'
  ): Promise<{
    mediaCount: number;
    playlistCount: number;
    playerCount: number;
    activePlayerCount: number;
  }> {
    try {
      if (view === 'publisher') {
        const pid = id;
        const mediaCount = await this.db.findFirst(
          `SELECT COUNT(DISTINCT m.media_id) as total ${SQL_MEDIA_PUBLISHER_SCOPE}
          WHERE COALESCE(m.is_active, true) = true`,
          [pid]
        );
        const playlistCount = await this.db.findFirst(
          `SELECT COUNT(DISTINCT pl.playlist_id) as total ${SQL_PLAYLIST_PUBLISHER_SCOPE}
          WHERE COALESCE(pl.is_active, true) = true`,
          [pid]
        );
        const playerCount = await this.db.findFirst(
          `
          SELECT COUNT(*) as total FROM totems t
          INNER JOIN locals l ON l.local_id = t.local_id
          WHERE COALESCE(t.is_active, true) = true AND l.publisher_id = ?
        `,
          [pid]
        );
        const activePlayerCount = await this.db.findFirst(
          `
          SELECT COUNT(*) as total
          FROM totems t
          INNER JOIN locals l ON l.local_id = t.local_id
          WHERE COALESCE(t.is_active, true) = true
          AND l.publisher_id = ?
          AND t.last_heartbeat IS NOT NULL
          AND t.last_heartbeat > NOW() - INTERVAL '5 minutes'
        `,
          [pid]
        );
        return {
          mediaCount: parseInt(String(mediaCount?.total || '0'), 10),
          playlistCount: parseInt(String(playlistCount?.total || '0'), 10),
          playerCount: parseInt(String(playerCount?.total || '0'), 10),
          activePlayerCount: parseInt(String(activePlayerCount?.total || '0'), 10)
        };
      }

      const sid = id;
      const mediaCount = await this.db.findFirst(
        `
        SELECT COUNT(*) as total FROM medias WHERE subscriber_id = ? AND COALESCE(is_active, true) = true
      `,
        [sid]
      );
      const playlistCount = await this.db.findFirst(
        `
        SELECT COUNT(*) as total FROM playlists WHERE subscriber_id = ? AND is_active = true
      `,
        [sid]
      );
      const playerCount = await this.db.findFirst(
        `SELECT COUNT(DISTINCT t.totem_id) as total ${SQL_TOTEMS_SUBSCRIBER_NETWORK}
        WHERE COALESCE(t.is_active, true) = true`,
        [sid]
      );
      const activePlayerCount = await this.db.findFirst(
        `SELECT COUNT(DISTINCT t.totem_id) as total ${SQL_TOTEMS_SUBSCRIBER_NETWORK}
        WHERE COALESCE(t.is_active, true) = true
        AND t.last_heartbeat IS NOT NULL
        AND t.last_heartbeat > NOW() - INTERVAL '5 minutes'`,
        [sid]
      );

      return {
        mediaCount: parseInt(String(mediaCount?.total || '0'), 10),
        playlistCount: parseInt(String(playlistCount?.total || '0'), 10),
        playerCount: parseInt(String(playerCount?.total || '0'), 10),
        activePlayerCount: parseInt(String(activePlayerCount?.total || '0'), 10)
      };
    } catch (error: any) {
      await logError('Erro ao obter estatísticas por cliente', error, { id, view });
      throw new Error('Erro interno do servidor');
    }
  }

  /**
   * Obter gráficos de uso
   */
  async getUsageCharts(scope?: TenantScope | null): Promise<{
    mediaByType: { type: string; count: number }[];
    playersByStatus: { status: string; count: number }[];
    activityByDay: { date: string; count: number }[];
  }> {
    try {
      if (scope?.scopedPublisherId != null && scope.scopedPublisherId < 0) {
        return { mediaByType: [], playersByStatus: [], activityByDay: [] };
      }
      if (scope?.scopedSubscriberId != null && scope.scopedSubscriberId < 0) {
        return { mediaByType: [], playersByStatus: [], activityByDay: [] };
      }

      if (!scope) {
        return await this.getUsageChartsGlobal();
      }
      if (scope.scopedPublisherId != null) {
        return await this.getUsageChartsForPublisher(scope.scopedPublisherId);
      }
      if (scope.scopedSubscriberId != null) {
        return await this.getUsageChartsForSubscriber(scope.scopedSubscriberId);
      }
      return await this.getUsageChartsGlobal();
    } catch (error: any) {
      await logError('Erro ao obter gráficos de uso', error, {});
      throw new Error('Erro interno do servidor');
    }
  }

  private async getUsageChartsGlobal(): Promise<{
    mediaByType: { type: string; count: number }[];
    playersByStatus: { status: string; count: number }[];
    activityByDay: { date: string; count: number }[];
  }> {
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
        DATE(dt) as date,
        COUNT(*) as count
      FROM (
        SELECT created_at as dt
        FROM medias 
        WHERE created_at >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT GREATEST(created_at, updated_at) as dt
        FROM playlists 
        WHERE GREATEST(created_at, updated_at) >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT created_at as dt
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      ) activities
      GROUP BY DATE(dt)
      ORDER BY date DESC
      LIMIT 7
    `);

    return {
      mediaByType: mediaByType.map(item => ({ type: item.type, count: parseInt(String(item.count), 10) })),
      playersByStatus: playersByStatus.map(item => ({ status: item.status, count: parseInt(String(item.count), 10) })),
      activityByDay: activityByDay.map(item => ({ date: String(item.date), count: parseInt(String(item.count), 10) })),
    };
  }

  private async getUsageChartsForPublisher(publisherId: number): Promise<{
    mediaByType: { type: string; count: number }[];
    playersByStatus: { status: string; count: number }[];
    activityByDay: { date: string; count: number }[];
  }> {
    const pid = publisherId;

    const mediaByType = await this.db.findMany(
      `
      SELECT 
        m.media_type as type,
        COUNT(DISTINCT m.media_id) as count
      ${SQL_MEDIA_PUBLISHER_SCOPE}
      WHERE COALESCE(m.is_active, true) = true
      GROUP BY m.media_type
      ORDER BY count DESC
    `,
      [pid]
    );

    const playersByStatus = await this.db.findMany(
      `
      SELECT 
        CASE 
          WHEN t.last_heartbeat IS NULL 
            OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'offline'
          ELSE 'online'
        END as status,
        COUNT(*) as count
      FROM totems t
      INNER JOIN locals l ON l.local_id = t.local_id
      WHERE COALESCE(t.is_active, true) = true AND l.publisher_id = ?
      GROUP BY 
        CASE 
          WHEN t.last_heartbeat IS NULL 
            OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'offline'
          ELSE 'online'
        END
    `,
      [pid]
    );

    const activityByDay = await this.db.findMany(
      `
      SELECT 
        DATE(dt) as date,
        COUNT(*) as count
      FROM (
        SELECT m.created_at as dt
        FROM medias m
        INNER JOIN subscriber_contracts sc ON sc.subscriber_id = m.subscriber_id
          AND sc.status = 'active'
          AND (sc.end_date IS NULL OR sc.end_date >= CURRENT_DATE)
          AND (sc.start_date IS NULL OR sc.start_date <= CURRENT_DATE)
        INNER JOIN plan_publisher_access ppa ON ppa.plan_id = sc.plan_id
          AND ppa.publisher_id = ?
          AND ppa.is_allowed = true
          AND COALESCE(ppa.is_active, true) = true
        WHERE COALESCE(m.is_active, true) = true AND m.created_at >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT GREATEST(pl.created_at, pl.updated_at) as dt
        FROM playlists pl
        INNER JOIN subscriber_contracts sc2 ON sc2.subscriber_id = pl.subscriber_id
          AND sc2.status = 'active'
          AND (sc2.end_date IS NULL OR sc2.end_date >= CURRENT_DATE)
          AND (sc2.start_date IS NULL OR sc2.start_date <= CURRENT_DATE)
        INNER JOIN plan_publisher_access ppa2 ON ppa2.plan_id = sc2.plan_id
          AND ppa2.publisher_id = ?
          AND ppa2.is_allowed = true
          AND COALESCE(ppa2.is_active, true) = true
        WHERE COALESCE(pl.is_active, true) = true
          AND GREATEST(pl.created_at, pl.updated_at) >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT u.created_at as dt
        FROM users u
        WHERE u.publisher_id = ? AND u.created_at >= NOW() - INTERVAL '7 days'
      ) activities
      GROUP BY DATE(dt)
      ORDER BY date DESC
      LIMIT 7
    `,
      [pid, pid, pid]
    );

    return {
      mediaByType: mediaByType.map(item => ({ type: item.type, count: parseInt(String(item.count), 10) })),
      playersByStatus: playersByStatus.map(item => ({ status: item.status, count: parseInt(String(item.count), 10) })),
      activityByDay: activityByDay.map(item => ({ date: String(item.date), count: parseInt(String(item.count), 10) })),
    };
  }

  private async getUsageChartsForSubscriber(subscriberId: number): Promise<{
    mediaByType: { type: string; count: number }[];
    playersByStatus: { status: string; count: number }[];
    activityByDay: { date: string; count: number }[];
  }> {
    const sid = subscriberId;

    const mediaByType = await this.db.findMany(
      `
      SELECT 
        media_type as type,
        COUNT(*) as count
      FROM medias 
      WHERE subscriber_id = ? AND COALESCE(is_active, true) = true
      GROUP BY media_type
      ORDER BY count DESC
    `,
      [sid]
    );

    const playersByStatus = await this.db.findMany(
      `
      SELECT 
        CASE 
          WHEN t.last_heartbeat IS NULL 
            OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'offline'
          ELSE 'online'
        END as status,
        COUNT(DISTINCT t.totem_id) as count
      ${SQL_TOTEMS_SUBSCRIBER_NETWORK}
      WHERE COALESCE(t.is_active, true) = true
      GROUP BY 
        CASE 
          WHEN t.last_heartbeat IS NULL 
            OR t.last_heartbeat <= NOW() - INTERVAL '5 minutes' THEN 'offline'
          ELSE 'online'
        END
    `,
      [sid]
    );

    const activityByDay = await this.db.findMany(
      `
      SELECT 
        DATE(dt) as date,
        COUNT(*) as count
      FROM (
        SELECT created_at as dt FROM medias 
        WHERE subscriber_id = ? AND created_at >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT GREATEST(created_at, updated_at) as dt FROM playlists 
        WHERE subscriber_id = ? AND GREATEST(created_at, updated_at) >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT created_at as dt FROM users 
        WHERE subscriber_id = ? AND created_at >= NOW() - INTERVAL '7 days'
      ) activities
      GROUP BY DATE(dt)
      ORDER BY date DESC
      LIMIT 7
    `,
      [sid, sid, sid]
    );

    return {
      mediaByType: mediaByType.map(item => ({ type: item.type, count: parseInt(String(item.count), 10) })),
      playersByStatus: playersByStatus.map(item => ({ status: item.status, count: parseInt(String(item.count), 10) })),
      activityByDay: activityByDay.map(item => ({ date: String(item.date), count: parseInt(String(item.count), 10) })),
    };
  }
}

let dashboardServiceInstance: DashboardService;

export function getDashboardService(): DashboardService {
  if (!dashboardServiceInstance) {
    dashboardServiceInstance = new DashboardService();
  }
  return dashboardServiceInstance;
}
