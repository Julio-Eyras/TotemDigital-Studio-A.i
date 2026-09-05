/**
 * Sincronização de totens quando o conteúdo ou metadados de mídia mudam
 * (rotação, adequação 9:16, CRC/conteúdo do ficheiro, updated_at).
 */

import crypto from 'crypto';
import fs from 'fs';
import { getDatabase } from '../config/database';
import { getCacheService } from './cacheService';
import { getRemoteCommandService } from './remoteCommandService';
import { logError, logInfo } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export const OFFLINE_HEARTBEAT_MS = 5 * 60 * 1000;

export type MediaChangeReason =
  | 'transform'
  | 'file_content'
  | 'process'
  | 'metadata';

export interface AffectedTotemTarget {
  totemId: number;
  identifier: string;
  online: boolean;
}

export interface NotifyMediaChangeOptions {
  reason: MediaChangeReason;
  updatedBy?: number;
  contentVersion?: string;
  updatedAt?: string | Date;
  filePath?: string | null;
  fileSizeBytes?: number | null;
  totemTargets?: AffectedTotemTarget[];
}

export interface MediaTotemNotifyResult {
  mediaId: number;
  reason: MediaChangeReason;
  contentVersion: string;
  totemsAffected: number;
  commandsQueued: number;
  dispatchCachesCleared: number;
  totems: Array<AffectedTotemTarget & { commandQueued: boolean }>;
}

export function buildMediaContentVersion(input: {
  updatedAt?: string | Date | null;
  fileSizeBytes?: number | null;
  filePath?: string | null;
  fileCrc?: string | null;
}): string {
  const updatedAt =
    input.updatedAt != null
      ? new Date(input.updatedAt).toISOString()
      : '';
  const size = input.fileSizeBytes != null ? String(input.fileSizeBytes) : '';
  const path = input.filePath != null ? String(input.filePath) : '';
  const crc = input.fileCrc != null ? String(input.fileCrc) : '';
  return [updatedAt, size, path, crc].join('|');
}

export class MediaTotemSyncService {
  private get db() {
    return getDatabase();
  }

  isTotemOnline(lastHeartbeat: unknown): boolean {
    if (!lastHeartbeat) return false;
    const ts = new Date(String(lastHeartbeat)).getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts <= OFFLINE_HEARTBEAT_MS;
  }

  async findAffectedTotems(mediaId: number): Promise<AffectedTotemTarget[]> {
    const rows = await this.db.findMany(
      `
      SELECT DISTINCT t.totem_id, t.identifier, t.last_heartbeat
      FROM (
        SELECT DISTINCT tp.totem_id
        FROM totem_playlist_items tpi
        JOIN totem_playlists tp ON tp.totem_playlist_id = tpi.totem_playlist_id
        WHERE tpi.media_id = $1
        UNION
        SELECT DISTINCT ct.totem_id
        FROM campaign_medias cm
        JOIN campaign_totems ct ON ct.campaign_id = cm.campaign_id
        WHERE cm.media_id = $1 AND COALESCE(ct.is_active, true) = true
        UNION
        SELECT DISTINCT ct.totem_id
        FROM playlist_items pi
        JOIN campaign_playlists cp ON cp.playlist_id = pi.playlist_id
        JOIN campaign_totems ct ON ct.campaign_id = cp.campaign_id
        WHERE pi.media_id = $1
          AND COALESCE(cp.is_active, true) = true
          AND COALESCE(ct.is_active, true) = true
      ) affected
      JOIN totems t ON t.totem_id = affected.totem_id
      WHERE COALESCE(t.is_active, true) = true
      ORDER BY t.identifier ASC
    `,
      [mediaId]
    );

    return (rows || []).map((r: any) => ({
      totemId: Number(r.totem_id),
      identifier: String(r.identifier || '').trim() || `totem-${r.totem_id}`,
      online: this.isTotemOnline(r.last_heartbeat),
    }));
  }

  async computeFileCrc(filePath?: string | null): Promise<string | null> {
    if (!filePath) return null;
    try {
      if (!fs.existsSync(filePath)) return null;
      const hash = crypto.createHash('sha256');
      await new Promise<void>((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });
      return hash.digest('hex');
    } catch {
      return null;
    }
  }

  async resolveContentVersion(
    mediaId: number,
    overrides: Pick<NotifyMediaChangeOptions, 'contentVersion' | 'updatedAt' | 'filePath' | 'fileSizeBytes'> = {}
  ): Promise<string> {
    if (overrides.contentVersion) {
      return overrides.contentVersion;
    }

    const row = await this.db.findFirst(
      `
      SELECT file_path, file_size_bytes, updated_at
      FROM medias
      WHERE media_id = $1
    `,
      [mediaId]
    );

    const filePath = overrides.filePath ?? row?.file_path ?? null;
    const fileSizeBytes =
      overrides.fileSizeBytes != null
        ? overrides.fileSizeBytes
        : row?.file_size_bytes != null
          ? Number(row.file_size_bytes)
          : null;
    const updatedAt = overrides.updatedAt ?? row?.updated_at ?? null;
    const fileCrc = await this.computeFileCrc(filePath);

    return buildMediaContentVersion({
      updatedAt,
      fileSizeBytes,
      filePath,
      fileCrc,
    });
  }

  async invalidateTotemDispatchCaches(totemIds: number[]): Promise<number> {
    if (!totemIds.length) return 0;
    const cache = getCacheService();
    let cleared = 0;
    for (const totemId of totemIds) {
      cleared += await cache.deletePattern(`dispatcher:totem:${totemId}:*`);
      cleared += await cache.deletePattern(`mix_rule:totem:${totemId}*`);
      cleared += await cache.deletePattern(`totem_mix:${totemId}:*`);
    }
    return cleared;
  }

  async notifyAffectedTotems(
    mediaId: number,
    options: NotifyMediaChangeOptions
  ): Promise<MediaTotemNotifyResult> {
    const totemTargets =
      options.totemTargets && options.totemTargets.length > 0
        ? options.totemTargets
        : await this.findAffectedTotems(mediaId);
    const contentVersion = await this.resolveContentVersion(mediaId, options);
    const updatedAtIso =
      options.updatedAt != null
        ? new Date(options.updatedAt).toISOString()
        : contentVersion.split('|')[0] || new Date().toISOString();

    const dispatchCachesCleared = await this.invalidateTotemDispatchCaches(
      totemTargets.map((t) => t.totemId)
    );

    await getCacheService().invalidateEntity('media', mediaId).catch(() => {});

    const remoteCommandService = getRemoteCommandService();
    const actorId = options.updatedBy && options.updatedBy > 0 ? options.updatedBy : 0;
    const totems: MediaTotemNotifyResult['totems'] = [];
    let commandsQueued = 0;

    for (const totem of totemTargets) {
      let commandQueued = false;
      try {
        await remoteCommandService.createCommand(
          {
            totemId: totem.totemId,
            commandType: 'invalidate_media',
            commandData: {
              mediaIds: [mediaId],
              mediaId,
              reason: options.reason,
              contentVersion,
              updatedAt: updatedAtIso,
              refreshPlaylist: true,
            },
          },
          actorId
        );
        commandQueued = true;
        commandsQueued += 1;
} catch (rawErr: unknown) {
        const e = normalizeError(rawErr);
        await logError('Falha ao enfileirar invalidate_media após alteração de mídia', e, {
          mediaId,
          totemId: totem.totemId,
          reason: options.reason,
        });
      }
      totems.push({ ...totem, commandQueued });
    }

    await logInfo('Totens notificados por alteração de mídia', {
      mediaId,
      reason: options.reason,
      contentVersion,
      totemsAffected: totemTargets.length,
      commandsQueued,
      dispatchCachesCleared,
    });

    return {
      mediaId,
      reason: options.reason,
      contentVersion,
      totemsAffected: totemTargets.length,
      commandsQueued,
      dispatchCachesCleared,
      totems,
    };
  }
}

let mediaTotemSyncServiceInstance: MediaTotemSyncService | null = null;

export function getMediaTotemSyncService(): MediaTotemSyncService {
  if (!mediaTotemSyncServiceInstance) {
    mediaTotemSyncServiceInstance = new MediaTotemSyncService();
  }
  return mediaTotemSyncServiceInstance;
}
