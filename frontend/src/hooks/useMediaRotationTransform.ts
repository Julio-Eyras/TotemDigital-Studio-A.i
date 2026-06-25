import { useState, useCallback } from 'react';
import { mediaApi } from '../services/api';
import { pickApiErrorMessage } from '../utils/apiErrorMessage';

export function normalizeMediaRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function mediaPreviewRotationSx(degrees: number) {
  return {
    transform: `rotate(${degrees}deg)`,
    transformOrigin: 'center',
    transition: 'transform 0.2s ease',
  } as const;
}

/**
 * Pré-visualização local de rotação (90°) + confirmação grava no servidor em 9:16.
 */
export function useMediaRotationTransform(onTransformed: () => Promise<void> | void) {
  const [rotationDrafts, setRotationDrafts] = useState<Record<number, number>>({});
  const [processingRotationId, setProcessingRotationId] = useState<number | null>(null);

  const getRotationDraft = useCallback(
    (mediaId: number) => rotationDrafts[mediaId] || 0,
    [rotationDrafts]
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
    [getRotationDraft, onTransformed, processingRotationId]
  );

  return {
    getRotationDraft,
    handleRotatePreview,
    handleConfirmRotation,
    processingRotationId,
  };
}
