import type { QuickPublishPreset } from '../services/api';

const PUBLISH_BOARD_PRESETS: QuickPublishPreset[] = [
  'menu',
  'promotion',
  'ad',
  'announcement',
  'institutional',
];

export function isPublishBoardHtmlMedia(media?: {
  media_type?: string;
  tags?: string[] | null;
}): boolean {
  if (!media) return false;
  if (!/^html$/i.test(String(media.media_type || ''))) return false;
  const tags = media.tags || [];
  if (tags.includes('publish-board')) return true;
  return PUBLISH_BOARD_PRESETS.some((p) => tags.includes(p));
}

export function parsePublishBoardPresetFromTags(
  tags?: string[] | null,
): QuickPublishPreset | null {
  if (!tags?.length) return null;
  for (const preset of PUBLISH_BOARD_PRESETS) {
    if (tags.includes(preset)) return preset;
  }
  return null;
}

export function buildPublishBoardEditUrl(
  subscriberId: number,
  preset: QuickPublishPreset,
  mediaId?: number,
): string {
  const params = new URLSearchParams({
    mode: 'create',
    subscriber: String(subscriberId),
    preset,
  });
  if (mediaId != null && mediaId > 0) {
    params.set('mediaIds', String(mediaId));
  }
  return `/quick-publish?${params.toString()}`;
}
