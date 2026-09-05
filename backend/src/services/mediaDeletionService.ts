/**
 * Exclusão de mídia com detecção de uso, forceDetach e limpeza em totens.
 */

import { getDatabase } from '../config/database';
import { getCacheService } from './cacheService';
import { getPlaylistEngineServiceInstance } from './playlistEngineService';
import { getMediaTotemSyncService } from './mediaTotemSyncService';
import { StorageService } from './storageService';
import { AuditService } from './auditService';
import { logError, logInfo } from '../utils/loggerHelper';

export interface MediaUsageDetailPlaylist {
  id: number;
  name: string;
}

export interface MediaUsageDetailCampaign {
  id: number;
  title: string;
}

export interface MediaUsageDetailTotem {
  totemId: number;
  identifier: string;
  campaignTitle?: string | null;
  online?: boolean;
}

export interface MediaUsagePayload {
  playlists: string[];
  campaigns: string[];
  totemPlaylists: string[];
  playlistDetails: MediaUsageDetailPlaylist[];
  campaignDetails: MediaUsageDetailCampaign[];
  totemPlaylistDetails: MediaUsageDetailTotem[];
}

export interface MediaInUseConflictPayload {
  error: string;
  mediaId: number;
  mediaName: string;
  usage: MediaUsagePayload;
  canForceDelete: boolean;
  forceDeleteHint: string;
  offlineTotemWarning: string;
}

export class MediaInUseError extends Error {
  readonly payload: MediaInUseConflictPayload;

  constructor(payload: MediaInUseConflictPayload) {
    super(payload.error);
    this.name = 'MediaInUseError';
    this.payload = payload;
  }
}

export interface ForceDeleteMediaResult {
  message: string;
  mediaId: number;
  mediaName: string;
  detached: {
    playlistItemsRemoved: number;
    campaignMediasRemoved: number;
    totemPlaylistItemsRemoved: number;
    playlistsDeleted: MediaUsageDetailPlaylist[];
    campaignsReordered: number[];
    playlistsReordered: number[];
  };
  totemsNotified: Array<{ totemId: number; identifier: string; online: boolean; commandQueued: boolean }>;
  offlineTotemWarning: string;
}

const OFFLINE_TOTEM_WARNING =
  'Totens offline só removerão a mídia do cache local quando voltarem a contactar o servidor (heartbeat).';

export class MediaDeletionService {
  private get db() {
    return getDatabase();
  }

  private getStorageService() {
    return new StorageService();
  }

  private getAuditService() {
    return new AuditService();
  }

  hasUsage(usage: MediaUsagePayload): boolean {
    return (
      usage.playlistDetails.length > 0 ||
      usage.campaignDetails.length > 0 ||
      usage.totemPlaylistDetails.length > 0
    );
  }

  async getMediaUsage(mediaId: number): Promise<MediaUsagePayload> {
    const playlistRows = await this.db.findMany(
      `
      SELECT DISTINCT p.playlist_id, p.name
      FROM playlist_items pi
      JOIN playlists p ON p.playlist_id = pi.playlist_id
      WHERE pi.media_id = $1
        AND COALESCE(pi.is_active, true) = true
        AND COALESCE(p.is_active, true) = true
      ORDER BY p.name ASC
    `,
      [mediaId]
    );

    const campaignRows = await this.db.findMany(
      `
      SELECT DISTINCT c.campaign_id, c.title
      FROM campaign_medias cm
      JOIN campaigns c ON c.campaign_id = cm.campaign_id
      WHERE cm.media_id = $1
        AND COALESCE(cm.is_active, true) = true
        AND COALESCE(c.is_active, true) = true
      ORDER BY c.title ASC
    `,
      [mediaId]
    );

    const totemRows = await this.db.findMany(
      `
      SELECT DISTINCT
        t.totem_id,
        t.identifier,
        c.title AS campaign_title,
        t.last_heartbeat
      FROM (
        SELECT DISTINCT tp.totem_id, tpi.campaign_id
        FROM totem_playlist_items tpi
        JOIN totem_playlists tp ON tp.totem_playlist_id = tpi.totem_playlist_id
        WHERE tpi.media_id = $1 AND COALESCE(tpi.is_active, true) = true
        UNION
        SELECT DISTINCT ct.totem_id, cm.campaign_id
        FROM campaign_medias cm
        JOIN campaign_totems ct ON ct.campaign_id = cm.campaign_id
        WHERE cm.media_id = $1 AND COALESCE(cm.is_active, true) = true AND COALESCE(ct.is_active, true) = true
        UNION
        SELECT DISTINCT ct.totem_id, cp.campaign_id
        FROM playlist_items pi
        JOIN campaign_playlists cp ON cp.playlist_id = pi.playlist_id
        JOIN campaign_totems ct ON ct.campaign_id = cp.campaign_id
        WHERE pi.media_id = $1
          AND COALESCE(pi.is_active, true) = true
          AND COALESCE(cp.is_active, true) = true
          AND COALESCE(ct.is_active, true) = true
      ) affected
      JOIN totems t ON t.totem_id = affected.totem_id
      LEFT JOIN campaigns c ON c.campaign_id = affected.campaign_id
      WHERE COALESCE(t.is_active, true) = true
      ORDER BY t.identifier ASC
    `,
      [mediaId]
    );

    const playlistDetails: MediaUsageDetailPlaylist[] = (playlistRows || []).map((r: any) => ({
      id: Number(r.playlist_id),
      name: String(r.name || '').trim() || `(playlist ${r.playlist_id})`,
    }));

    const campaignDetails: MediaUsageDetailCampaign[] = (campaignRows || []).map((r: any) => ({
      id: Number(r.campaign_id),
      title: String(r.title || '').trim() || `(campanha ${r.campaign_id})`,
    }));

    const totemPlaylistDetails: MediaUsageDetailTotem[] = (totemRows || []).map((r: any) => ({
      totemId: Number(r.totem_id),
      identifier: String(r.identifier || '').trim() || `totem-${r.totem_id}`,
      campaignTitle: r.campaign_title ? String(r.campaign_title) : null,
      online: getMediaTotemSyncService().isTotemOnline(r.last_heartbeat),
    }));

    return {
      playlists: playlistDetails.map((p) => p.name),
      campaigns: campaignDetails.map((c) => c.title),
      totemPlaylists: totemPlaylistDetails.map((t) => t.identifier),
      playlistDetails,
      campaignDetails,
      totemPlaylistDetails,
    };
  }

  buildConflictPayload(
    mediaId: number,
    mediaName: string,
    usage: MediaUsagePayload
  ): MediaInUseConflictPayload {
    return {
      error: 'Não é possível remover mídia em uso',
      mediaId,
      mediaName,
      usage,
      canForceDelete: true,
      forceDeleteHint:
        'Confirme a exclusão forçada para remover referências, reorganizar playlists/campanhas, apagar o arquivo e invalidar cache nos totens afetados.',
      offlineTotemWarning: OFFLINE_TOTEM_WARNING,
    };
  }

  async forceDetachAndDelete(params: {
    mediaId: number;
    mediaName: string;
    filePath?: string | null;
    subscriberId: number;
    deletedBy: number;
  }): Promise<ForceDeleteMediaResult> {
    const { mediaId, mediaName, filePath, subscriberId, deletedBy } = params;

    const usageBefore = await this.getMediaUsage(mediaId);
    const affectedPlaylistIds = usageBefore.playlistDetails.map((p) => p.id);
    const affectedCampaignIds = new Set<number>(usageBefore.campaignDetails.map((c) => c.id));

    for (const pl of usageBefore.playlistDetails) {
      const camps = await this.db.findMany(
        `
        SELECT DISTINCT cp.campaign_id
        FROM campaign_playlists cp
        WHERE cp.playlist_id = $1 AND COALESCE(cp.is_active, true) = true
      `,
        [pl.id]
      );
      for (const row of camps || []) {
        affectedCampaignIds.add(Number((row as unknown as Record<string, unknown>).campaign_id));
      }
    }

    const affectedTotemPlaylistIds = await this.findTotemPlaylistIdsForMedia(mediaId);
    const totemTargets = await getMediaTotemSyncService().findAffectedTotems(mediaId);

    const playlistItemsRemoved = await this.deletePlaylistItemsForMedia(mediaId);
    const playlistsReordered: number[] = [];
    const playlistsDeleted: MediaUsageDetailPlaylist[] = [];

    const campaignsToRecompactPlaylists = new Set<number>();

    for (const playlistId of affectedPlaylistIds) {
      await this.recompactPlaylistOrder(playlistId);
      playlistsReordered.push(playlistId);

      const remaining = await this.db.findFirst(
        `SELECT COUNT(*)::int AS count FROM playlist_items WHERE playlist_id = $1`,
        [playlistId]
      );
      const count = Number((remaining as unknown as Record<string, unknown>)?.count || 0);
      if (count === 0) {
        const pl = usageBefore.playlistDetails.find((p) => p.id === playlistId);
        const linkedCampaigns = await this.db.findMany(
          `SELECT campaign_id FROM campaign_playlists WHERE playlist_id = $1`,
          [playlistId]
        );
        for (const row of linkedCampaigns || []) {
          campaignsToRecompactPlaylists.add(Number((row as unknown as Record<string, unknown>).campaign_id));
        }
        await this.hardDeleteEmptyPlaylist(playlistId);
        if (pl) playlistsDeleted.push(pl);
      }
    }

    for (const campaignId of campaignsToRecompactPlaylists) {
      await this.recompactCampaignPlaylistPriority(campaignId);
    }

    const campaignMediasRemoved = await this.deleteCampaignMediasForMedia(mediaId);
    const campaignsReordered = Array.from(affectedCampaignIds);
    for (const campaignId of campaignsReordered) {
      await this.recompactCampaignMediaOrder(campaignId);
    }

    const totemPlaylistItemsRemoved = await this.deleteTotemPlaylistItemsForMedia(mediaId);
    for (const tpId of affectedTotemPlaylistIds) {
      await this.recompactTotemPlaylistOrder(tpId);
    }

    if (filePath) {
      await this.getStorageService().deleteMediaFile(filePath);
    }

    await this.db.executeRaw(`DELETE FROM medias WHERE media_id = $1`, [mediaId]);

    const notifyResult = await getMediaTotemSyncService().notifyAffectedTotems(mediaId, {
      reason: 'file_content',
      updatedBy: deletedBy,
      totemTargets,
    });
    const totemsNotified: ForceDeleteMediaResult['totemsNotified'] = notifyResult.totems.map((t) => ({
      totemId: t.totemId,
      identifier: t.identifier,
      online: t.online,
      commandQueued: t.commandQueued,
    }));

    const engine = getPlaylistEngineServiceInstance();
    for (const campaignId of campaignsReordered) {
      await engine.regeneratePlaylistsForCampaign(campaignId).catch((e) =>
        logError('Regeneração pós-delete de mídia (campanha)', e, { campaignId, mediaId })
      );
    }

    await this.getAuditService().log('media', 'force_deleted', deletedBy, {
      mediaId,
      name: mediaName,
      subscriberId,
      playlistItemsRemoved,
      campaignMediasRemoved,
      totemPlaylistItemsRemoved,
      playlistsDeleted: playlistsDeleted.map((p) => p.id),
      campaignsReordered,
      totemsNotified: totemsNotified.map((t) => t.totemId),
    });

    await getCacheService().invalidateEntity('media', mediaId).catch(() => {});
    await getCacheService().invalidateEntity('subscriber', subscriberId).catch(() => {});

    await logInfo('Mídia excluída com forceDetach', {
      mediaId,
      playlistItemsRemoved,
      campaignMediasRemoved,
      playlistsDeleted: playlistsDeleted.length,
    });

    const hasOffline = totemsNotified.some((t) => !t.online);

    return {
      message: 'Mídia excluída; referências removidas e totens notificados',
      mediaId,
      mediaName,
      detached: {
        playlistItemsRemoved,
        campaignMediasRemoved,
        totemPlaylistItemsRemoved,
        playlistsDeleted,
        campaignsReordered,
        playlistsReordered,
      },
      totemsNotified,
      offlineTotemWarning: hasOffline ? OFFLINE_TOTEM_WARNING : '',
    };
  }

  private async deletePlaylistItemsForMedia(mediaId: number): Promise<number> {
    const result = await this.db.executeRaw(
      `DELETE FROM playlist_items WHERE media_id = $1`,
      [mediaId]
    );
    return result.rowCount ?? 0;
  }

  private async deleteCampaignMediasForMedia(mediaId: number): Promise<number> {
    const result = await this.db.executeRaw(
      `DELETE FROM campaign_medias WHERE media_id = $1`,
      [mediaId]
    );
    return result.rowCount ?? 0;
  }

  private async deleteTotemPlaylistItemsForMedia(mediaId: number): Promise<number> {
    const result = await this.db.executeRaw(
      `DELETE FROM totem_playlist_items WHERE media_id = $1`,
      [mediaId]
    );
    return result.rowCount ?? 0;
  }

  private async findTotemPlaylistIdsForMedia(mediaId: number): Promise<number[]> {
    const rows = await this.db.findMany(
      `
      SELECT DISTINCT tpi.totem_playlist_id
      FROM totem_playlist_items tpi
      WHERE tpi.media_id = $1
    `,
      [mediaId]
    );
    return (rows || []).map((r: any) => Number(r.totem_playlist_id)).filter((id) => id > 0);
  }

  private async recompactPlaylistOrder(playlistId: number): Promise<void> {
    await this.db.executeRaw(
      `
      WITH ordered AS (
        SELECT item_id,
               ROW_NUMBER() OVER (ORDER BY order_index ASC, item_id ASC) - 1 AS new_idx
        FROM playlist_items
        WHERE playlist_id = $1
      )
      UPDATE playlist_items pi
      SET order_index = o.new_idx, updated_at = CURRENT_TIMESTAMP
      FROM ordered o
      WHERE pi.item_id = o.item_id
    `,
      [playlistId]
    );
    await getCacheService().invalidateEntity('playlist', playlistId).catch(() => {});
  }

  private async recompactCampaignMediaOrder(campaignId: number): Promise<void> {
    await this.db.executeRaw(
      `
      WITH ordered AS (
        SELECT campaign_id, media_id,
               ROW_NUMBER() OVER (ORDER BY order_index ASC, media_id ASC) - 1 AS new_idx
        FROM campaign_medias
        WHERE campaign_id = $1
      )
      UPDATE campaign_medias cm
      SET order_index = o.new_idx, updated_at = CURRENT_TIMESTAMP
      FROM ordered o
      WHERE cm.campaign_id = o.campaign_id AND cm.media_id = o.media_id
    `,
      [campaignId]
    );
    await getCacheService().invalidateEntity('campaign', campaignId).catch(() => {});
  }

  private async recompactTotemPlaylistOrder(totemPlaylistId: number): Promise<void> {
    await this.db.executeRaw(
      `
      WITH ordered AS (
        SELECT item_id,
               ROW_NUMBER() OVER (ORDER BY order_index ASC, item_id ASC) - 1 AS new_idx
        FROM totem_playlist_items
        WHERE totem_playlist_id = $1
      )
      UPDATE totem_playlist_items tpi
      SET order_index = o.new_idx, updated_at = CURRENT_TIMESTAMP
      FROM ordered o
      WHERE tpi.item_id = o.item_id
    `,
      [totemPlaylistId]
    );
  }

  private async recompactCampaignPlaylistPriority(campaignId: number): Promise<void> {
    await this.db.executeRaw(
      `
      WITH ordered AS (
        SELECT campaign_id, playlist_id,
               ROW_NUMBER() OVER (ORDER BY priority ASC, playlist_id ASC) AS new_pri
        FROM campaign_playlists
        WHERE campaign_id = $1
      )
      UPDATE campaign_playlists cp
      SET priority = o.new_pri
      FROM ordered o
      WHERE cp.campaign_id = o.campaign_id AND cp.playlist_id = o.playlist_id
    `,
      [campaignId]
    );
    await getCacheService().invalidateEntity('campaign', campaignId).catch(() => {});
  }

  private async hardDeleteEmptyPlaylist(playlistId: number): Promise<void> {
    await this.db.executeRaw(`DELETE FROM campaign_playlists WHERE playlist_id = $1`, [playlistId]);
    await this.db.executeRaw(`DELETE FROM playlist_items WHERE playlist_id = $1`, [playlistId]);
    await this.db.executeRaw(`DELETE FROM playlists WHERE playlist_id = $1`, [playlistId]);
    await getCacheService().invalidateEntity('playlist', playlistId).catch(() => {});
  }
}

let mediaDeletionServiceInstance: MediaDeletionService | null = null;

export function getMediaDeletionService(): MediaDeletionService {
  if (!mediaDeletionServiceInstance) {
    mediaDeletionServiceInstance = new MediaDeletionService();
  }
  return mediaDeletionServiceInstance;
}
