/** URL de thumbnail da API exige Bearer — <img src> direto falha com 401. */
export function isProtectedMediaThumbnailUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\/api\/media\/\d+\/thumbnail(\?|$)/.test(url);
}

export function buildMediaThumbnailApiPath(mediaId: number, version = 0): string {
  const base = process.env.REACT_APP_API_URL || '/api';
  const v = version > 0 ? `?v=${version}` : '';
  return `${base}/media/${mediaId}/thumbnail${v}`;
}

export function normalizePublicMediaAssetUrl(raw?: string | null): string | undefined {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return undefined;
  if (v.startsWith('/assets/')) return v;
  if (v.startsWith('/uploads/')) return v;
  if (v.startsWith('/opt/smart-signage/public/assets/')) {
    return v.replace('/opt/smart-signage/public/assets/', '/assets/');
  }
  if (v.includes('/public/assets/')) {
    const parts = v.split('/public/assets/');
    if (parts.length > 1) return `/assets/${parts[1]}`.replace(/\/+/g, '/');
  }
  if (v.includes('/assets/')) {
    const parts = v.split('/assets/');
    if (parts.length > 1) return `/assets/${parts[1]}`.replace(/\/+/g, '/');
  }
  return undefined;
}

export function resolveMediaListThumbnailUrl(
  media: {
    media_id?: number;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    file_path?: string | null;
  },
  blobUrl?: string | null,
  thumbVersion = 0,
): string | undefined {
  if (blobUrl) return blobUrl;
  const id = media.media_id;
  const fromFields = media.thumbnailUrl || media.previewUrl || undefined;
  if (fromFields && !isProtectedMediaThumbnailUrl(fromFields)) {
    return normalizePublicMediaAssetUrl(fromFields) || fromFields;
  }
  if (id) return buildMediaThumbnailApiPath(id, thumbVersion);
  return normalizePublicMediaAssetUrl(media.file_path);
}

/**
 * URL segura para <img>: nunca expõe /api/media/:id/thumbnail sem blob autenticado.
 * Usado na biblioteca e na lista de mídias do totem.
 */
export function resolveMediaThumbnailDisplayUrl(
  media: {
    media_id?: number;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    file_path?: string | null;
  },
  blobUrl?: string | null,
): string | undefined {
  if (blobUrl) return blobUrl;

  const url = media.thumbnailUrl || media.previewUrl || undefined;
  if (url && !isProtectedMediaThumbnailUrl(url)) {
    return normalizePublicMediaAssetUrl(url) || url;
  }

  if (media.media_id) return undefined;

  return normalizePublicMediaAssetUrl(media.file_path);
}
