import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mediaApi } from '../services/api';
import {
  isProtectedMediaThumbnailUrl,
  normalizePublicMediaAssetUrl,
} from '../utils/mediaPreviewUrl';

export function useMediaThumbnailUrls(
  mediaItems: Array<{ media_id?: number; thumbnailUrl?: string | null; previewUrl?: string | null }>,
) {
  const thumbObjectUrlsRef = useRef<Map<number, string>>(new Map());
  const [thumbVersion, setThumbVersion] = useState(0);

  const mediaIdsKey = useMemo(
    () =>
      mediaItems
        .map((m) => m.media_id)
        .filter((id): id is number => typeof id === 'number' && id > 0)
        .join(','),
    [mediaItems],
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !mediaIdsKey) return;

    let cancelled = false;
    const ids = mediaIdsKey
      .split(',')
      .map((id) => Number(id))
      .filter((id) => id > 0 && !thumbObjectUrlsRef.current.has(id));

    if (ids.length === 0) return;

    (async () => {
      for (const id of ids) {
        try {
          const regenKey = `media-thumb-regen-v3:${id}`;
          const shouldRegen = typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(regenKey);
          const blob = await mediaApi.getThumbnailBlob(id, { regenerate: shouldRegen });
          if (shouldRegen) {
            try {
              sessionStorage.setItem(regenKey, '1');
            } catch {
              /* noop */
            }
          }
          const objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            try {
              URL.revokeObjectURL(objectUrl);
            } catch {
              /* noop */
            }
            continue;
          }
          thumbObjectUrlsRef.current.set(id, objectUrl);
          setThumbVersion((v) => v + 1);
        } catch {
          /* mantém fallback */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaIdsKey]);

  useEffect(() => {
    return () => {
      thumbObjectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      });
      thumbObjectUrlsRef.current.clear();
    };
  }, []);

  const getThumbnailSrc = useCallback(
    (media: {
      media_id?: number;
      thumbnailUrl?: string | null;
      previewUrl?: string | null;
      file_path?: string | null;
    }): string | undefined => {
      const id = media.media_id;
      const cached = typeof id === 'number' ? thumbObjectUrlsRef.current.get(id) : undefined;
      if (cached) return cached;

      const url = media.thumbnailUrl || media.previewUrl || undefined;
      if (url && !isProtectedMediaThumbnailUrl(url)) {
        return normalizePublicMediaAssetUrl(url) || url;
      }
      // Não expor URL /api/media/:id/thumbnail em <img> — aguardar blob autenticado
      if (id) return undefined;
      return normalizePublicMediaAssetUrl(media.file_path);
    },
    [thumbVersion],
  );

  const invalidateThumbnail = useCallback(async (mediaId: number) => {
    const existing = thumbObjectUrlsRef.current.get(mediaId);
    if (existing) {
      try {
        URL.revokeObjectURL(existing);
      } catch {
        /* noop */
      }
      thumbObjectUrlsRef.current.delete(mediaId);
    }
    try {
      sessionStorage.removeItem(`media-thumb-regen-v3:${mediaId}`);
    } catch {
      /* noop */
    }
    try {
      const blob = await mediaApi.getThumbnailBlob(mediaId, { regenerate: true });
      const objectUrl = URL.createObjectURL(blob);
      thumbObjectUrlsRef.current.set(mediaId, objectUrl);
      try {
        sessionStorage.setItem(`media-thumb-regen-v3:${mediaId}`, '1');
      } catch {
        /* noop */
      }
    } catch {
      /* refetch falhou — efeito tenta de novo se id ainda na lista */
    }
    setThumbVersion((v) => v + 1);
  }, []);

  const bumpThumbVersion = useCallback(() => setThumbVersion((v) => v + 1), []);

  return { getThumbnailSrc, thumbVersion, bumpThumbVersion, invalidateThumbnail };
}
