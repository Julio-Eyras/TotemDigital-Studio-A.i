import { DispatchMediaItem } from '../types/dispatcherTotem.types';
import { resolveDispatchCacheBucket } from '../services/dispatchMediaBucket';
import { buildMediaContentVersion } from '../services/mediaTotemSyncService';
import { resolveDispatchItemDurationSeconds, positiveIntOrNull } from './dispatchItemDuration';
import { resolveLogicalMediaType } from './mediaTypeUtils';
import { normalizeDownloadUrl } from './pathHelper';

export interface BuildDispatchMediaItemInput {
  mediaId: number;
  order: number;
  displaySeconds?: number | null;
  mediaType?: string | null;
  durationSeconds?: number | null;
  filePath?: string | null;
  name?: string | null;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  tags?: unknown;
  updatedAt?: string | Date | null;
  fileSizeBytes?: number | null;
  fileCrc?: string | null;
}

export function extractFileNameFromPath(filePath: string | null | undefined): string | undefined {
  if (!filePath?.trim()) return undefined;
  const base = filePath.replace(/\\/g, '/').split('/').pop()?.split('?')[0]?.trim();
  return base || undefined;
}

const DELIVERY_ROTATION_TAG_PREFIX = '_delivery_rotation:';

function normalizeDeliveryRotation(degrees: number): number {
  const n = Number(degrees);
  if (!Number.isFinite(n)) return 0;
  return ((Math.round(n / 90) * 90) % 360 + 360) % 360;
}

export function parseDeliveryRotationFromDispatchTags(tags?: unknown): number | null {
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    const raw = String(tag);
    if (!raw.startsWith(DELIVERY_ROTATION_TAG_PREFIX)) continue;
    const parsed = Number(raw.slice(DELIVERY_ROTATION_TAG_PREFIX.length));
    if (Number.isFinite(parsed)) return normalizeDeliveryRotation(parsed);
  }
  return null;
}

export function buildDispatchMediaItem(input: BuildDispatchMediaItemInput): DispatchMediaItem {
  const fileName = input.fileName?.trim() || extractFileNameFromPath(input.filePath) || undefined;
  const mediaType = resolveLogicalMediaType({
    mediaType: input.mediaType,
    mimeType: input.mimeType,
    filePath: input.filePath,
    fileName,
  });
  const mediaName = input.name?.trim() || fileName;
  const filePath = input.filePath ?? undefined;
  const deliveryRotation = parseDeliveryRotationFromDispatchTags(input.tags);
  const contentVersion = buildMediaContentVersion({
    updatedAt: input.updatedAt,
    fileSizeBytes: input.fileSizeBytes,
    filePath,
    fileCrc: input.fileCrc,
  });
  const hasContentVersion = contentVersion.replace(/\|/g, '').length > 0;

  return {
    mediaId: input.mediaId,
    order: input.order,
    duration: resolveDispatchItemDurationSeconds({
      displaySeconds: input.displaySeconds,
      mediaType,
      mediaDurationSeconds: input.durationSeconds,
    }),
    url: normalizeDownloadUrl(filePath) || '',
    mediaType,
    cacheBucket: resolveDispatchCacheBucket({
      tags: input.tags,
      file_path: filePath,
    }),
    mediaName: mediaName || undefined,
    fileName: fileName || undefined,
    metadata: {
      width: input.width ?? undefined,
      height: input.height ?? undefined,
      mimeType: input.mimeType ?? undefined,
      durationSeconds: positiveIntOrNull(input.durationSeconds) ?? undefined,
      deliveryRotation: deliveryRotation ?? undefined,
      contentVersion: hasContentVersion ? contentVersion : undefined,
    },
  };
}
