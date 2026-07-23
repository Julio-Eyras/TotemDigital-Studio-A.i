import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mediaApi } from '../services/api';

/**
 * Carrega thumbnails autenticados (blob URL) por media_id.
 * Atualiza o Map incrementalmente — só as linhas novas mudam de src.
 */
export function useMediaThumbnailUrls(
  mediaItems: Array<{ media_id?: number; thumbnailUrl?: string | null; previewUrl?: string | null }>,
) {
  const [urlsById, setUrlsById] = useState<Record<number, string>>({});
  const urlsByIdRef = useRef(urlsById);
  urlsByIdRef.current = urlsById;
  const ownedUrlsRef = useRef<Set<string>>(new Set());

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
      .filter((id) => id > 0 && !urlsByIdRef.current[id]);

    if (ids.length === 0) return;

    (async () => {
      for (const id of ids) {
        try {
          // v5: corrige thumbs landscape gerados com +90° (card deitado vs olho certo).
          const regenKey = `media-thumb-regen-v5:${id}`;
          let shouldRegen = false;
          try {
            shouldRegen = !sessionStorage.getItem(regenKey);
          } catch {
            shouldRegen = true;
          }
          const blob = await mediaApi.getThumbnailBlob(id, { regenerate: shouldRegen });
          if (shouldRegen) {
            try {
              sessionStorage.setItem(regenKey, '1');
            } catch {
              /* noop */
            }
          }
          if (cancelled) continue;
          const objectUrl = URL.createObjectURL(blob);
          ownedUrlsRef.current.add(objectUrl);
          setUrlsById((prev) => {
            if (prev[id]) {
              try {
                URL.revokeObjectURL(objectUrl);
                ownedUrlsRef.current.delete(objectUrl);
              } catch {
                /* noop */
              }
              return prev;
            }
            return { ...prev, [id]: objectUrl };
          });
        } catch {
          /* mantém placeholder */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaIdsKey]);

  useEffect(() => {
    return () => {
      ownedUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      });
      ownedUrlsRef.current.clear();
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
      if (typeof id === 'number' && urlsById[id]) return urlsById[id];
      return undefined;
    },
    [urlsById],
  );

  const invalidateThumbnail = useCallback(async (mediaId: number) => {
    const existing = urlsByIdRef.current[mediaId];
    if (existing) {
      try {
        URL.revokeObjectURL(existing);
        ownedUrlsRef.current.delete(existing);
      } catch {
        /* noop */
      }
    }
    setUrlsById((prev) => {
      const next = { ...prev };
      delete next[mediaId];
      return next;
    });
    try {
      const blob = await mediaApi.getThumbnailBlob(mediaId, { regenerate: true });
      const objectUrl = URL.createObjectURL(blob);
      ownedUrlsRef.current.add(objectUrl);
      setUrlsById((prev) => ({ ...prev, [mediaId]: objectUrl }));
    } catch {
      /* refetch falhou */
    }
  }, []);

  const bumpThumbVersion = useCallback(() => {
    setUrlsById((prev) => ({ ...prev }));
  }, []);

  return {
    getThumbnailSrc,
    urlsById,
    thumbVersion: Object.keys(urlsById).length,
    invalidateThumbnail,
    bumpThumbVersion,
  };
}
