import { useState, useCallback } from 'react';
import { mediaApi } from '../services/api';
import { pickApiErrorMessage } from '../utils/apiErrorMessage';

export function normalizeMediaRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export interface MediaPreviewDimensions {
  width?: number;
  height?: number;
  /** Vídeo sem width/height na API — assumir 16:9 horizontal (como no totem). */
  assumeLandscapeIfUnknown?: boolean;
}

export function mediaPreviewDims(
  media: { width?: number; height?: number; media_type?: string },
  forVideoHover = false,
): MediaPreviewDimensions {
  return {
    width: media.width,
    height: media.height,
    assumeLandscapeIfUnknown:
      forVideoHover && /^video$/i.test(String(media.media_type || '')),
  };
}

/** Desfaz rotação de entrega na UI — inverso do valor gravado no ficheiro/tag. */
export const TOTEM_DELIVERY_UI_PREVIEW_ROTATION_LEGACY = 270;
const DELIVERY_ROTATION_TAG_PREFIX = '_delivery_rotation:';

export function parseDeliveryRotationFromTags(tags?: string[] | null): number | null {
  if (!tags?.length) return null;
  for (const tag of tags) {
    if (!String(tag).startsWith(DELIVERY_ROTATION_TAG_PREFIX)) continue;
    const raw = Number(String(tag).slice(DELIVERY_ROTATION_TAG_PREFIX.length));
    if (Number.isFinite(raw)) return normalizeMediaRotation(raw);
  }
  return null;
}

export function getMediaUiPreviewUndoRotation(media?: {
  tags?: string[] | null;
  width?: number;
  height?: number;
}): number {
  const delivery = parseDeliveryRotationFromTags(media?.tags);
  if (delivery != null) {
    return normalizeMediaRotation(360 - delivery);
  }
  return TOTEM_DELIVERY_UI_PREVIEW_ROTATION_LEGACY;
}

export function resolveTotemDeliveryUiRotation(
  rotationDraft: number,
  media?: { tags?: string[] | null; width?: number; height?: number },
): number {
  return normalizeMediaRotation(rotationDraft + getMediaUiPreviewUndoRotation(media));
}

/** Rotação efectiva: draft do utilizador + auto 90° para landscape em moldura 9:16. */
export function resolvePortraitPreviewRotation(
  rotationDraft: number,
  dims?: MediaPreviewDimensions,
): number {
  const draft = normalizeMediaRotation(rotationDraft);
  const w = dims?.width ?? 0;
  const h = dims?.height ?? 0;
  if (w > 0 && h > 0) {
    if (w > h) return normalizeMediaRotation(draft + 90);
    return draft;
  }
  if (dims?.assumeLandscapeIfUnknown) {
    return normalizeMediaRotation(draft + 90);
  }
  return draft;
}

export function mediaPortraitPreviewSx(
  rotationDegrees: number,
  dims?: MediaPreviewDimensions,
) {
  return buildRotatedPortraitPreviewSx(resolvePortraitPreviewRotation(rotationDegrees, dims));
}

function buildRotatedPortraitPreviewSx(deg: number) {
  const sideways = deg === 90 || deg === 270;

  const base = {
    position: 'absolute' as const,
    display: 'block',
    objectFit: 'cover' as const,
    transformOrigin: 'center center',
    transition: 'transform 0.2s ease',
  };

  if (sideways) {
    return {
      ...base,
      top: '50%',
      left: '50%',
      width: '178%',
      height: '100%',
      maxWidth: 'none',
      maxHeight: 'none',
      transform: `translate(-50%, -50%) rotate(${deg}deg)`,
    };
  }

  return {
    ...base,
    inset: 0,
    width: '100%',
    height: '100%',
    transform: deg !== 0 ? `rotate(${deg}deg)` : undefined,
  };
}

export const TOTEM_DELIVERY_WIDTH = 1920;
export const TOTEM_DELIVERY_HEIGHT = 1080;

export function isTotemDeliveryMedia(media?: { width?: number; height?: number }): boolean {
  const w = Number(media?.width ?? 0);
  const h = Number(media?.height ?? 0);
  if (w === TOTEM_DELIVERY_WIDTH && h === TOTEM_DELIVERY_HEIGHT) return true;
  return w > h && w > 0 && h > 0;
}

/** Preview na UI: ficheiro 16:9 de entrega precisa rotação CSS; thumbnail já vem em pé. */
export function mediaTotemUiPreviewSx(
  rotationDegrees: number,
  media?: { width?: number; height?: number },
) {
  if (isTotemDeliveryMedia(media)) {
    return buildRotatedPortraitPreviewSx(resolveTotemDeliveryUiRotation(rotationDegrees, media));
  }
  return mediaThumbnailPortraitPreviewSx(rotationDegrees);
}

export function mediaTotemHoverVideoSx(
  rotationDegrees: number,
  media?: { width?: number; height?: number },
) {
  return {
    ...mediaTotemUiPreviewSx(rotationDegrees, media),
    zIndex: 3,
    pointerEvents: 'none' as const,
  };
}

/** Thumbnail 9:16 na UI — sem rotação automática quando já vem em pé do servidor. */
export function mediaThumbnailPortraitPreviewSx(rotationDegrees: number) {
  const deg = normalizeMediaRotation(rotationDegrees);
  return {
    position: 'absolute' as const,
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
    transformOrigin: 'center center',
    transform: deg !== 0 ? `rotate(${deg}deg)` : undefined,
  };
}

/** Vídeo cru na UI: sem rotação automática (ficheiro 16:9 de entrega). */
export function mediaVideoPortraitPreviewSx(rotationDraft = 0) {
  const deg = normalizeMediaRotation(rotationDraft);
  return {
    position: 'absolute' as const,
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    display: 'block',
    transformOrigin: 'center center',
    transform: deg !== 0 ? `rotate(${deg}deg)` : undefined,
    zIndex: 3,
    pointerEvents: 'none' as const,
  };
}

export function mediaPortraitHoverVideoSx(
  rotationDegrees: number,
  media?: { width?: number; height?: number },
) {
  return mediaTotemHoverVideoSx(rotationDegrees, media);
}

/** @deprecated use mediaPortraitPreviewSx */
export function mediaPreviewRotationSx(degrees: number) {
  return mediaPortraitPreviewSx(degrees);
}

/** Moldura 9:16 — mesma lógica do totem (cover + rotação landscape). */
export function mediaPortraitPreviewFrameSx() {
  return {
    position: 'relative' as const,
    width: '100%',
    aspectRatio: '9 / 16',
    bgcolor: '#000',
    overflow: 'hidden',
  };
}

/**
 * Pré-visualização local de rotação (90° à esquerda) + confirmação grava no servidor em 9:16 em pé.
 * Após gravar, o card mostra thumbnail/ficheiro final (sem CSS draft) — WYSIWYG com o totem.
 */
export function useMediaRotationTransform(onTransformed: () => Promise<void> | void) {
  const [rotationDrafts, setRotationDrafts] = useState<Record<number, number>>({});
  const [processingRotationId, setProcessingRotationId] = useState<number | null>(null);

  const getRotationDraft = useCallback(
    (mediaId: number) => rotationDrafts[mediaId] || 0,
    [rotationDrafts],
  );

  const handleRotatePreview = useCallback((mediaId: number) => {
    setRotationDrafts((prev) => ({
      ...prev,
      [mediaId]: normalizeMediaRotation((prev[mediaId] || 0) - 90),
    }));
  }, []);

  const handleConfirmRotation = useCallback(
    async (mediaId: number): Promise<string | null> => {
      const rotation = getRotationDraft(mediaId);
      if (!rotation || processingRotationId) {
        return null;
      }

      if (!window.confirm('Rotacionar e converter esta mídia para 9:16?')) {
        return null;
      }

      try {
        setProcessingRotationId(mediaId);
        await mediaApi.transformToPortrait(mediaId, {
          rotationDegrees: rotation,
          fit: '9:16',
        });
        setRotationDrafts((prev) => {
          const next = { ...prev };
          delete next[mediaId];
          return next;
        });
        await onTransformed();
        return null;
      } catch (error: unknown) {
        return pickApiErrorMessage(error, 'Erro ao rotacionar e converter mídia');
      } finally {
        setProcessingRotationId(null);
      }
    },
    [getRotationDraft, onTransformed, processingRotationId],
  );

  return {
    getRotationDraft,
    handleRotatePreview,
    handleConfirmRotation,
    processingRotationId,
  };
}
