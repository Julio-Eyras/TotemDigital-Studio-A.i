import React from 'react';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { RotateLeft, CheckCircle, CropPortrait } from '@mui/icons-material';

export interface MediaTransformActionsProps {
  isTransformable: boolean;
  rotationDraft: number;
  processingRotation: boolean;
  processingFit: boolean;
  onRotatePreview: () => void;
  onConfirmRotation: () => void;
  onFitPortrait: () => void;
}

/** Botões: girar 90° (prévia), confirmar rotação+9:16, adequar 9:16 sem rotação. */
const MediaTransformActions: React.FC<MediaTransformActionsProps> = ({
  isTransformable,
  rotationDraft,
  processingRotation,
  processingFit,
  onRotatePreview,
  onConfirmRotation,
  onFitPortrait,
}) => {
  const rotationChanged = rotationDraft !== 0;
  const busy = processingRotation || processingFit;

  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      <Tooltip title={isTransformable ? 'Girar 90° à esquerda' : 'Rotação disponível para imagens e vídeos'}>
        <span>
          <IconButton size="small" disabled={!isTransformable || busy} onClick={onRotatePreview}>
            <RotateLeft />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip
        title={
          rotationChanged
            ? 'Confirmar rotação e converter para 9:16'
            : 'Gire a mídia antes de confirmar'
        }
      >
        <span>
          <IconButton
            size="small"
            color="success"
            disabled={!rotationChanged || busy}
            onClick={onConfirmRotation}
          >
            {processingRotation ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={
          isTransformable
            ? 'Adequar para 9:16 em pé (roda landscape automaticamente se necessário)'
            : 'Disponível para imagens e vídeos'
        }>
        <span>
          <IconButton
            size="small"
            color="primary"
            disabled={!isTransformable || busy}
            onClick={onFitPortrait}
          >
            {processingFit ? <CircularProgress size={20} color="inherit" /> : <CropPortrait />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

export default MediaTransformActions;
