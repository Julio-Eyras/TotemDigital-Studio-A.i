import { getDatabase } from '../config/database';
import { isDirectTotemMode } from '../config/directTotemMode';
import { DispatchMediaItem, DispatchPlan } from '../types/dispatcherTotem.types';
import { buildDispatchMediaItem } from '../utils/dispatchMediaItem';
import { sumDispatchMediaItemsPlanDuration } from '../utils/dispatchItemDuration';
import { hasVinhetaGlobalTag, hasVinhetaTag, VINHETA_GLOBAL_TAG, VINHETA_TAG } from '../utils/vinhetaTags';

export interface GlobalVinhetaRow {
  media_id: number;
  name: string | null;
  file_name: string | null;
  file_path: string | null;
  media_type: string | null;
  mime_type: string | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  tags: unknown;
  updated_at?: string | Date | null;
  file_size_bytes?: number | null;
}

/**
 * Vinhetas globais do anunciante (tags `vinheta` + `vinheta_global`), aprovadas e ativas.
 */
export async function fetchGlobalVinhetasForSubscriber(
  subscriberId: number
): Promise<GlobalVinhetaRow[]> {
  if (!Number.isFinite(subscriberId) || subscriberId <= 0) return [];
  const db = getDatabase();
  const rows = await db.findMany(
    `
    SELECT
      m.media_id,
      m.name,
      m.file_name,
      m.file_path,
      m.media_type,
      m.mime_type,
      m.duration_seconds,
      m.width,
      m.height,
      m.tags,
      m.updated_at,
      m.file_size_bytes
    FROM medias m
    WHERE m.subscriber_id = $1
      AND COALESCE(m.is_active, true) = true
      AND m.status IN ('approved', 'published')
      AND COALESCE(m.tags, '{}') @> ARRAY[$2, $3]::text[]
    ORDER BY m.media_id ASC
  `,
    [subscriberId, VINHETA_TAG, VINHETA_GLOBAL_TAG]
  );
  return (rows || []).filter((row: GlobalVinhetaRow) => {
    const tags = row.tags;
    return hasVinhetaTag(tags) && hasVinhetaGlobalTag(tags);
  });
}

/**
 * Anexa vinhetas globais ao plano (cacheBucket vinhetas). O Player-AD separa propagandas/vinhetas e faz o mix N:1.
 * Não duplica media_id já presente no plano.
 */
export function appendGlobalVinhetasToDispatchPlan(
  plan: DispatchPlan,
  globalRows: GlobalVinhetaRow[]
): DispatchPlan {
  if (!globalRows.length) return plan;

  const existingIds = new Set(plan.mediaItems.map((i) => i.mediaId));
  const appended: DispatchMediaItem[] = [];
  let order = plan.mediaItems.length;

  for (const row of globalRows) {
    const mediaId = Number(row.media_id);
    if (!Number.isFinite(mediaId) || mediaId <= 0 || existingIds.has(mediaId)) continue;
    existingIds.add(mediaId);
    order += 1;
    appended.push(
      buildDispatchMediaItem({
        mediaId,
        order,
        displaySeconds: 0,
        mediaType: row.media_type,
        durationSeconds: row.duration_seconds,
        filePath: row.file_path,
        name: row.name,
        fileName: row.file_name,
        width: row.width,
        height: row.height,
        mimeType: row.mime_type,
        tags: row.tags,
        updatedAt: row.updated_at,
        fileSizeBytes: row.file_size_bytes,
      })
    );
  }

  if (!appended.length) return plan;

  const mediaItems = [...plan.mediaItems, ...appended];
  return {
    ...plan,
    mediaItems,
    totalDuration: sumDispatchMediaItemsPlanDuration(mediaItems),
    metadata: {
      ...plan.metadata,
      globalVinhetasAppended: appended.length,
      globalVinhetasMediaIds: appended.map((i) => i.mediaId),
    },
  };
}

export async function enrichDispatchPlanWithGlobalVinhetas(
  plan: DispatchPlan,
  subscriberIds: number[]
): Promise<DispatchPlan> {
  if (isDirectTotemMode()) return plan;

  const unique = [...new Set(subscriberIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (!unique.length) return plan;

  const allRows: GlobalVinhetaRow[] = [];
  const seen = new Set<number>();
  for (const sid of unique) {
    const rows = await fetchGlobalVinhetasForSubscriber(sid);
    for (const row of rows) {
      const id = Number(row.media_id);
      if (seen.has(id)) continue;
      seen.add(id);
      allRows.push(row);
    }
  }

  return appendGlobalVinhetasToDispatchPlan(plan, allRows);
}
