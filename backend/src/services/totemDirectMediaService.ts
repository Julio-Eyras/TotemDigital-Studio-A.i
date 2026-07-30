import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { transaction } from '../config/database-pg';
import { isDirectTotemMode } from '../config/directTotemMode';
import { logError, logInfo } from '../utils/loggerHelper';
import { getMediaService } from './mediaService';
import { getMediaTotemSyncService } from './mediaTotemSyncService';
import { getRemoteCommandService } from './remoteCommandService';

export interface TotemDirectMediaItem {
  item_id: number;
  media_id: number;
  order_index: number;
  name: string;
  media_type: string;
  file_path: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  mime_type?: string | null;
  width?: number | null;
  height?: number | null;
  file_size_bytes?: number | null;
  /** Item ativo na playlist deste totem */
  is_active?: boolean;
  /** Mídia ativa na biblioteca */
  media_is_active?: boolean;
  approved_by_name?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
}

export class TotemDirectMediaService {
  private get db() {
    return getDatabase();
  }

  async getTotemPublisherContext(totemId: number): Promise<{
    totem_id: number;
    publisher_id: number;
    subscriber_id: number | null;
  }> {
    const row = await this.db.findFirst(
      `
      SELECT t.totem_id, l.publisher_id
      FROM totems t
      JOIN locals l ON l.local_id = t.local_id
      WHERE t.totem_id = $1
      LIMIT 1
    `,
      [totemId]
    );
    if (!row?.totem_id || !row?.publisher_id) {
      throw new Error('Totem não encontrado');
    }
    const sub = await this.db.findFirst(
      `SELECT subscriber_id FROM subscribers WHERE is_active = true ORDER BY subscriber_id ASC LIMIT 1`
    );
    return {
      totem_id: Number(row.totem_id),
      publisher_id: Number(row.publisher_id),
      subscriber_id: sub?.subscriber_id != null ? Number(sub.subscriber_id) : null,
    };
  }

  async ensureDirectPlaylist(totemId: number): Promise<number> {
    const ctx = await this.getTotemPublisherContext(totemId);
    const existing = await this.db.findFirst(
      `
      SELECT totem_playlist_id, version
      FROM totem_playlists
      WHERE totem_id = $1
        AND smart_tv_id IS NULL
        AND is_active = true
        AND status = 'active'
        AND COALESCE(metadata->>'source', '') = 'direct_totem'
      ORDER BY version DESC
      LIMIT 1
    `,
      [totemId]
    );
    if (existing?.totem_playlist_id) {
      return Number(existing.totem_playlist_id);
    }

    const versionRow = await this.db.findFirst(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM totem_playlists WHERE totem_id = $1`,
      [totemId]
    );
    const nextVersion = Number(versionRow?.next_version || 1);
    const hash = crypto.createHash('sha256').update(`direct-totem-${totemId}-${Date.now()}`).digest('hex');

    const created = await this.db.executeRaw(
      `
      INSERT INTO totem_playlists (
        totem_id, smart_tv_id, publisher_id, playlist_hash, version,
        total_items, total_duration_seconds, status, is_active,
        generated_at, last_updated_at, metadata, generation_log
      )
      VALUES ($1, NULL, $2, $3, $4, 0, 0, 'active', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $5, $6)
      RETURNING totem_playlist_id
    `,
      [
        totemId,
        ctx.publisher_id,
        hash,
        nextVersion,
        JSON.stringify({ source: 'direct_totem', totemId }),
        JSON.stringify({ source: 'direct_totem', createdAt: new Date().toISOString() }),
      ]
    );
    const playlistId = created?.rows?.[0]?.totem_playlist_id;
    if (!playlistId) throw new Error('Falha ao criar playlist direta do totem');
    return Number(playlistId);
  }

  async listTotemMedias(totemId: number): Promise<TotemDirectMediaItem[]> {
    const playlistId = await this.ensureDirectPlaylist(totemId);
    const rows = await this.db.findMany(
      `
      SELECT
        tpi.item_id,
        tpi.media_id,
        tpi.order_index,
        m.name,
        m.media_type,
        m.file_path,
        m.thumbnail_url,
        m.duration_seconds,
        m.mime_type,
        m.width,
        m.height,
        m.file_size_bytes,
        COALESCE(tpi.is_active, true) AS is_active,
        COALESCE(m.is_active, true) AS media_is_active,
        u.username AS approved_by_name,
        m.approved_at,
        m.created_at
      FROM totem_playlist_items tpi
      JOIN medias m ON m.media_id = tpi.media_id
      LEFT JOIN users u ON m.approved_by = u.id
      WHERE tpi.totem_playlist_id = $1
      ORDER BY tpi.order_index ASC, tpi.item_id ASC
    `,
      [playlistId]
    );
    return (rows || []).map((r: any) => ({
      item_id: Number(r.item_id),
      media_id: Number(r.media_id),
      order_index: Number(r.order_index),
      name: String(r.name || ''),
      media_type: String(r.media_type || ''),
      file_path: String(r.file_path || ''),
      thumbnail_url: r.thumbnail_url,
      duration_seconds: r.duration_seconds != null ? Number(r.duration_seconds) : null,
      mime_type: r.mime_type,
      width: r.width != null ? Number(r.width) : null,
      height: r.height != null ? Number(r.height) : null,
      file_size_bytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
      is_active: r.is_active !== false,
      media_is_active: r.media_is_active !== false,
      approved_by_name: r.approved_by_name ? String(r.approved_by_name) : null,
      approved_at: r.approved_at ? String(r.approved_at) : null,
      created_at: r.created_at ? String(r.created_at) : null,
    }));
  }

  async setTotemMediaActive(
    totemId: number,
    mediaId: number,
    isActive: boolean
  ): Promise<TotemDirectMediaItem[]> {
    const playlistId = await this.ensureDirectPlaylist(totemId);
    const row = await this.db.findFirst(
      `
      SELECT item_id, COALESCE(is_active, true) AS is_active
      FROM totem_playlist_items
      WHERE totem_playlist_id = $1 AND media_id = $2
      ORDER BY item_id DESC
      LIMIT 1
    `,
      [playlistId, mediaId]
    );
    if (!row?.item_id) {
      throw new Error('Mídia não está vinculada a este totem');
    }

    if (isActive) {
      const media = await this.db.findFirst(
        `SELECT media_id, COALESCE(is_active, true) AS is_active FROM medias WHERE media_id = $1`,
        [mediaId]
      );
      if (!media?.media_id) throw new Error('Mídia não encontrada');
      if (media.is_active === false) {
        throw new Error('Mídia desativada na biblioteca. Reative-a em Mídias primeiro.');
      }
    }

    await this.db.executeRaw(
      `
      UPDATE totem_playlist_items
      SET is_active = $3, updated_at = CURRENT_TIMESTAMP
      WHERE totem_playlist_id = $1 AND media_id = $2
    `,
      [playlistId, mediaId, isActive]
    );

    await this.refreshPlaylistTotals(playlistId);
    if (isActive) {
      await this.reindexPlaylistItems(playlistId);
    }
    await this.notifyTotemContentChange(totemId, mediaId);
    return this.listTotemMedias(totemId);
  }

  async addMediaToTotem(totemId: number, mediaId: number): Promise<TotemDirectMediaItem[]> {
    const ctx = await this.getTotemPublisherContext(totemId);
    const media = await this.db.findFirst(
      `SELECT media_id, subscriber_id, publisher_id, COALESCE(is_active, true) AS is_active
       FROM medias WHERE media_id = $1`,
      [mediaId]
    );
    if (!media?.media_id) throw new Error('Mídia não encontrada');
    if (media.is_active === false) {
      throw new Error('Mídia desabilitada na biblioteca. Reative-a em Mídias antes de anexar a totens.');
    }
    if (isDirectTotemMode()) {
      if (!media.publisher_id) {
        throw new Error('Mídia não pertence à biblioteca desta organização');
      }
      if (Number(media.publisher_id) !== ctx.publisher_id) {
        throw new Error('Mídia não pertence à biblioteca desta organização');
      }
    }

    const playlistId = await this.ensureDirectPlaylist(totemId);
    const mediaNameRow = await this.db.findFirst(
      `SELECT name FROM medias WHERE media_id = $1`,
      [mediaId]
    );
    const mediaLabel = String(mediaNameRow?.name || `mídia #${mediaId}`).trim();

    const duplicate = await this.db.findFirst(
      `
      SELECT item_id, COALESCE(is_active, true) AS is_active
      FROM totem_playlist_items
      WHERE totem_playlist_id = $1 AND media_id = $2
      ORDER BY item_id DESC
      LIMIT 1
    `,
      [playlistId, mediaId]
    );
    if (duplicate?.item_id && duplicate.is_active !== false) {
      // Idempotente: já na playlist ativa — devolve lista sem erro (evita falso negativo em lote).
      await logInfo('[DirectTotem] Mídia já na playlist — add ignorado', {
        totemId,
        mediaId,
        mediaName: mediaLabel,
      });
      return this.listTotemMedias(totemId);
    }
    if (duplicate?.item_id && duplicate.is_active === false) {
      await this.db.executeRaw(
        `
        UPDATE totem_playlist_items
        SET is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE item_id = $1
      `,
        [duplicate.item_id]
      );
      await this.refreshPlaylistTotals(playlistId);
      await this.reindexPlaylistItems(playlistId);
      await this.notifyTotemContentChange(totemId, mediaId);
      return this.listTotemMedias(totemId);
    }

    const orderRow = await this.db.findFirst(
      `
      SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order
      FROM totem_playlist_items
      WHERE totem_playlist_id = $1 AND COALESCE(is_active, true) = true
    `,
      [playlistId]
    );
    const nextOrder = Number(orderRow?.next_order ?? 0);

    await this.db.executeRaw(
      `
      INSERT INTO totem_playlist_items (
        totem_playlist_id, media_id, campaign_id, subscriber_id, publisher_id,
        order_index, priority, transition_type, transition_duration_ms, is_active
      )
      VALUES ($1, $2, NULL, NULL, $3, $4, 0, 'fade', 500, true)
    `,
      [playlistId, mediaId, ctx.publisher_id, nextOrder]
    );

    await this.refreshPlaylistTotals(playlistId);
    await this.notifyTotemContentChange(totemId, mediaId);
    return this.listTotemMedias(totemId);
  }

  async countActiveMediasForTotem(totemId: number): Promise<number> {
    const row = await this.db.findFirst(
      `
      SELECT COUNT(tpi.item_id)::int AS count
      FROM totem_playlist_items tpi
      JOIN totem_playlists tp ON tp.totem_playlist_id = tpi.totem_playlist_id
      WHERE tp.totem_id = $1
        AND COALESCE(tpi.is_active, true) = true
        AND COALESCE(tp.is_active, true) = true
        AND tp.status = 'active'
    `,
      [totemId]
    );
    return Number(row?.count || 0);
  }

  async invalidateDirectPlaylistsForTotem(totemId: number): Promise<void> {
    await this.db.executeRaw(
      `
      UPDATE totem_playlist_items tpi
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      FROM totem_playlists tp
      WHERE tpi.totem_playlist_id = tp.totem_playlist_id
        AND tp.totem_id = $1
        AND COALESCE(tpi.is_active, true) = true
    `,
      [totemId]
    );
    await this.db.executeRaw(
      `
      UPDATE totem_playlists
      SET is_active = false, status = 'invalidated', last_updated_at = CURRENT_TIMESTAMP
      WHERE totem_id = $1 AND COALESCE(is_active, true) = true
    `,
      [totemId]
    );
  }

  private parseFkReferencingTable(detail: string | undefined): string | null {
    if (!detail) return null;
    const match = detail.match(/referenced from table "([^"]+)"/i);
    return match?.[1] ?? null;
  }

  private quoteSqlIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  /**
   * Remove totem e dependências diretas (modo Publicar em Totem) — exclusão física.
   */
  async purgeDirectTotemAndDependencies(totemId: number): Promise<void> {
    await transaction(async (client) => {
      const run = async (sql: string, params: unknown[] = []) => {
        try {
          await client.query(sql, params);
        } catch (error: any) {
          if (error?.code === '42P01') return; // tabela opcional ausente
          throw error;
        }
      };

      await run(
        `DELETE FROM totem_playlist_items
         WHERE totem_playlist_id IN (SELECT totem_playlist_id FROM totem_playlists WHERE totem_id = $1)`,
        [totemId]
      );
      await run(`DELETE FROM totem_playlist_generation_log WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM totem_playlists WHERE totem_id = $1`, [totemId]);

      await run(
        `DELETE FROM dispatcher_decision_items
         WHERE decision_id IN (SELECT decision_id FROM dispatcher_decisions WHERE totem_id = $1)`,
        [totemId]
      );
      await run(
        `DELETE FROM dispatcher_decision_campaigns
         WHERE decision_id IN (SELECT decision_id FROM dispatcher_decisions WHERE totem_id = $1)`,
        [totemId]
      );
      await run(`DELETE FROM dispatcher_events WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM dispatcher_decisions WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM dispatcher_log WHERE totem_id = $1`, [totemId]);

      await run(`DELETE FROM remote_commands WHERE totem_id = $1`, [totemId]);
      await run(
        `DELETE FROM device_tokens
         WHERE smart_tv_id IN (SELECT smart_tv_id FROM smart_tvs WHERE totem_id = $1)`,
        [totemId]
      );
      await run(`DELETE FROM device_tokens WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM smart_tvs WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM campaign_totems WHERE totem_id = $1`, [totemId]);

      await run(`DELETE FROM playlist_mix_history WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM totem_playlist_mix WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM ai_context_data WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM playlist_mix_rules WHERE totem_id = $1`, [totemId]);

      await run(`DELETE FROM totem_update_status WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM fx_totem_sites WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM fx_telemetry WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM totem_ml_config WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM recognized_persons WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM interaction_logs WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM execution_logs WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM event_logs WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM analytics_emotions WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM analytics_gestures WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM emotion_data WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM gesture_data WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM behavior_data WHERE totem_id = $1`, [totemId]);
      await run(`DELETE FROM analytics_sessions WHERE totem_id = $1`, [totemId]);

      await run(`UPDATE smart_playlists SET totem_id = NULL WHERE totem_id = $1`, [totemId]);
      await run(`UPDATE publisher_billing SET totem_id = NULL WHERE totem_id = $1`, [totemId]);

      let attempts = 0;
      while (attempts < 30) {
        try {
          const deleted = await client.query(
            `DELETE FROM totems WHERE totem_id = $1 RETURNING totem_id`,
            [totemId]
          );
          if (!deleted.rowCount) {
            throw new Error('Totem não encontrado');
          }
          return;
        } catch (error: any) {
          if (error?.code !== '23503' || attempts >= 29) {
            throw error;
          }
          const table = this.parseFkReferencingTable(error?.detail);
          if (!table) {
            throw new Error(
              `Falha ao remover totem: ainda existem registros vinculados (${error?.detail || error?.message})`
            );
          }
          const quoted = this.quoteSqlIdent(table);
          await client.query(`DELETE FROM ${quoted} WHERE totem_id = $1`, [totemId]);
          attempts += 1;
        }
      }
    });

    const stillThere = await this.db.findFirst(
      `SELECT totem_id FROM totems WHERE totem_id = $1`,
      [totemId]
    );
    if (stillThere) {
      throw new Error('Falha ao remover totem: registro ainda existe após exclusão');
    }

    await logInfo('[DirectTotem] Totem e dependências removidos', { totemId });
  }

  async removeMediaFromTotem(
    totemId: number,
    mediaId: number
  ): Promise<{ items: TotemDirectMediaItem[]; mediaUsageCount: number }> {
    const playlistId = await this.ensureDirectPlaylist(totemId);
    // Remove o vínculo deste totem (não apaga o arquivo nem o registro em medias).
    await this.db.executeRaw(
      `
      DELETE FROM totem_playlist_items
      WHERE totem_playlist_id = $1 AND media_id = $2
    `,
      [playlistId, mediaId]
    );
    await this.refreshPlaylistTotals(playlistId);
    await this.reindexPlaylistItems(playlistId);
    await this.notifyTotemContentChange(totemId, mediaId);
    const usage = await this.countActiveTotemUsage(mediaId);
    const items = await this.listTotemMedias(totemId);
    return { items, mediaUsageCount: usage };
  }

  async reorderTotemMedias(totemId: number, mediaIds: number[]): Promise<TotemDirectMediaItem[]> {
    const playlistId = await this.ensureDirectPlaylist(totemId);
    const current = await this.listTotemMedias(totemId);
    const currentIds = new Set(current.map((i) => i.media_id));
    for (const id of mediaIds) {
      if (!currentIds.has(id)) {
        throw new Error(`Mídia ${id} não pertence à playlist deste totem`);
      }
    }
    if (mediaIds.length !== current.length) {
      throw new Error('Lista de reordenação incompleta');
    }

    for (let i = 0; i < mediaIds.length; i++) {
      await this.db.executeRaw(
        `
        UPDATE totem_playlist_items
        SET order_index = $1, updated_at = CURRENT_TIMESTAMP
        WHERE totem_playlist_id = $2 AND media_id = $3 AND COALESCE(is_active, true) = true
      `,
        [i, playlistId, mediaIds[i]]
      );
    }

    await this.refreshPlaylistTotals(playlistId);
    await this.notifyTotemContentChange(totemId);
    return this.listTotemMedias(totemId);
  }

  async countActiveTotemUsage(mediaId: number): Promise<number> {
    const row = await this.db.findFirst(
      `
      SELECT COUNT(DISTINCT tp.totem_id)::int AS count
      FROM totem_playlist_items tpi
      JOIN totem_playlists tp ON tp.totem_playlist_id = tpi.totem_playlist_id
      WHERE tpi.media_id = $1
        AND COALESCE(tpi.is_active, true) = true
        AND COALESCE(tp.is_active, true) = true
        AND tp.status = 'active'
    `,
      [mediaId]
    );
    return Number(row?.count || 0);
  }

  private async refreshPlaylistTotals(playlistId: number): Promise<void> {
    await this.db.executeRaw(
      `
      UPDATE totem_playlists tp
      SET
        total_items = sub.cnt,
        total_duration_seconds = sub.dur,
        last_updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT
          COUNT(*)::int AS cnt,
          COALESCE(SUM(COALESCE(m.duration_seconds, 10)), 0)::int AS dur
        FROM totem_playlist_items tpi
        JOIN medias m ON m.media_id = tpi.media_id
        WHERE tpi.totem_playlist_id = $1 AND COALESCE(tpi.is_active, true) = true
      ) sub
      WHERE tp.totem_playlist_id = $1
    `,
      [playlistId]
    );
  }

  private async reindexPlaylistItems(playlistId: number): Promise<void> {
    const rows = await this.db.findMany(
      `
      SELECT item_id FROM totem_playlist_items
      WHERE totem_playlist_id = $1 AND COALESCE(is_active, true) = true
      ORDER BY order_index ASC, item_id ASC
    `,
      [playlistId]
    );
    for (let i = 0; i < rows.length; i++) {
      await this.db.executeRaw(
        `UPDATE totem_playlist_items SET order_index = $1 WHERE item_id = $2`,
        [i, rows[i].item_id]
      );
    }
  }

  private async notifyTotemContentChange(totemId: number, mediaId?: number): Promise<void> {
    try {
      if (mediaId) {
        // Não bloqueia o HTTP: se o tratamento de entrega ainda corre, o player
        // só é notificado quando completeVideoPortraitNormalization terminar (reason=process).
        if (!(await getMediaService().isTotemDeliveryReadyForPlayer(mediaId))) {
          await logInfo(
            '[DirectTotem] Notify adiado até fim do tratamento de entrega (playlist-ad atualiza quando pronto)',
            { totemId, mediaId }
          );
          return;
        }
        await getMediaTotemSyncService().notifyAffectedTotems(mediaId, {
          reason: 'metadata',
          totemTargets: [{ totemId, identifier: String(totemId), online: true }],
        });
      } else {
        await getMediaTotemSyncService().invalidateTotemDispatchCaches([totemId]);
        try {
          await getRemoteCommandService().createCommand(
            {
              totemId,
              commandType: 'refresh_dispatch',
              commandData: { reason: 'playlist_reorder' },
            },
            0
          );
        } catch (cmdError: any) {
          await logError('[DirectTotem] Falha ao enfileirar refresh_dispatch após reorder', cmdError, { totemId });
        }
        await logInfo('[DirectTotem] Playlist reordenada — cache dispatch invalidado', { totemId });
      }
    } catch (error) {
      await logError('[DirectTotem] Falha ao notificar totem', error, { totemId, mediaId });
    }
  }
}
let instance: TotemDirectMediaService | null = null;

export function getTotemDirectMediaService(): TotemDirectMediaService {
  if (!instance) instance = new TotemDirectMediaService();
  return instance;
}
