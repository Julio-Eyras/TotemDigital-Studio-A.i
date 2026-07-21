import React from 'react';
import { Box } from '@mui/material';
import {
  mediaLibraryPreviewSx,
  type MediaDeliveryPreviewFields,
} from '../../hooks/useMediaRotationTransform';

export function mediaPortraitListThumbFrameSx(widthPx = 52) {
  return {
    position: 'relative' as const,
    width: widthPx,
    minWidth: widthPx,
    maxWidth: widthPx,
    aspectRatio: '9 / 16',
    bgcolor: '#000',
    overflow: 'hidden',
    borderRadius: 1,
    flexShrink: 0,
  };
}

export type MediaPortraitThumbProps = {
  src?: string;
  media?: MediaDeliveryPreviewFields & {
    media_type?: string;
    width?: number;
    height?: number;
  };
  width?: number;
  /** Clique no thumb (ex.: abrir dialog de visualização). */
  onClick?: () => void;
  title?: string;
};

/** Mini preview 9:16 estático (thumbnail fixo). */
export function MediaPortraitThumb({
  src,
  media,
  width = 52,
  onClick,
  title,
}: MediaPortraitThumbProps) {
  const frameSx = {
    ...mediaPortraitListThumbFrameSx(width),
    mr: 1.5,
    ...(onClick
      ? {
          cursor: 'pointer',
          '&:hover': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
        }
      : {}),
  };

  if (!src) {
    return (
      <Box
        sx={{
          ...frameSx,
          bgcolor: 'grey.900',
          border: '1px solid',
          borderColor: 'divider',
        }}
        onClick={onClick}
        title={title}
        role={onClick ? 'button' : undefined}
      />
    );
  }

  return (
    <Box
      sx={frameSx}
      onClick={(e) => {
        if (!onClick) return;
        e.stopPropagation();
        onClick();
      }}
      title={title}
      role={onClick ? 'button' : undefined}
    >
      <Box
        component="img"
        src={src}
        alt=""
        sx={mediaLibraryPreviewSx(0, media, {
          previewUrl: src,
          previewSource: 'thumbnail',
        })}
      />
    </Box>
  );
}
