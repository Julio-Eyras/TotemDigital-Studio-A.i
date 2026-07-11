import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mediaApi } from '../services/api';
import { isTotemDeliveryMedia } from './useMediaRotationTransform';

export const TOTEM_VIDEO_PREVIEW_MAX_BYTES = 30 * 1024 * 1024;

export function shouldUseTotemDeliveryVideoPreview(media: {
  media_type?: string;
  width?: number;
  height?: number;
  size_bytes?: number;
  fileSizeBytes?: number;
}): boolean {
  if (!/^video$/i.test(String(media.media_type || ''))) return false;
  if (!isTotemDeliveryMedia(media)) return false;
  const bytes = Number(media.size_bytes ?? media.fileSizeBytes ?? 0);
  if (bytes > TOTEM_VIDEO_PREVIEW_MAX_BYTES) return false;
  return true;
}

/** Pré-carrega blobs de vídeo de entrega totem para preview estático (mesma lógica da biblioteca). */
export function useTotemDeliveryVideoPreviewUrls(
  mediaItems: Array<{
    media_id?: number;
    media_type?: string;
    width?: number;
    height?: number;
    size_bytes?: number;
    fileSizeBytes?: number;
  }>,
) {
  const blobUrlsRef = useRef<Map<number, string>>(new Map());
  const [version, setVersion] = useState(0);

  const previewSignature = useMemo(
    () =>
      mediaItems
        .map((m) =>
          [
            m.media_id ?? '',
            m.media_type ?? '',
            m.width ?? '',
            m.height ?? '',
            m.size_bytes ?? '',
            m.fileSizeBytes ?? '',
          ].join(':'),
        )
        .join('|'),
    [mediaItems],
  );

  useEffect(() => {
    if (!Array.isArray(mediaItems) || mediaItems.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const media of mediaItems) {
        if (!shouldUseTotemDeliveryVideoPreview(media)) continue;
        const id = media.media_id;
        if (!id || blobUrlsRef.current.has(id)) continue;
        try {
          const blob = await mediaApi.getFileBlob(id);
          if (cancelled) return;
          blobUrlsRef.current.set(id, URL.createObjectURL(blob));
          setVersion((v) => v + 1);
        } catch {
          /* mantém fallback thumbnail */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [previewSignature]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      });
      blobUrlsRef.current.clear();
    };
  }, []);

  const getVideoPreviewUrl = useCallback(
    (mediaId?: number): string | undefined => {
      if (typeof mediaId !== 'number') return undefined;
      void version;
      return blobUrlsRef.current.get(mediaId);
    },
    [version],
  );

  const invalidateVideoPreview = useCallback((mediaId: number) => {
    const existing = blobUrlsRef.current.get(mediaId);
    if (existing) {
      try {
        URL.revokeObjectURL(existing);
      } catch {
        /* noop */
      }
      blobUrlsRef.current.delete(mediaId);
    }
    setVersion((v) => v + 1);
  }, []);

  return { getVideoPreviewUrl, videoPreviewVersion: version, invalidateVideoPreview };
}
