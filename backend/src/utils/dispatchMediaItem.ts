import { DispatchMediaItem } from '../types/dispatcherTotem.types';
import { resolveDispatchCacheBucket } from '../services/dispatchMediaBucket';
import { resolveDispatchItemDurationSeconds, positiveIntOrNull } from './dispatchItemDuration';
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
}

export function extractFileNameFromPath(filePath: string | null | undefined): string | undefined {
  if (!filePath?.trim()) return undefined;
  const base = filePath.replace(/\\/g, '/').split('/').pop()?.split('?')[0]?.trim();
  return base || undefined;
}

export function buildDispatchMediaItem(input: BuildDispatchMediaItemInput): DispatchMediaItem {
  const mediaType = String(input.mediaType || 'image');
  const fileName = input.fileName?.trim() || extractFileNameFromPath(input.filePath) || undefined;
  const mediaName = input.name?.trim() || fileName;
  const filePath = input.filePath ?? undefined;

  return {
    mediaId: input.mediaId,
    order: input.order,
    duration: resolveDispatchItemDurationSeconds({
      displaySeconds: input.displaySeconds,
      mediaType: input.mediaType,
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
    },
  };
}
