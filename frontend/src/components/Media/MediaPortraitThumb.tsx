import React from 'react';
import { Box } from '@mui/material';

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
  width?: number;
  title?: string;
};

/**
 * Thumbnail 9:16 estático e leve (object-fit cover).
 * Sem transforms de rotação — evita flicker na lista.
 */
export function MediaPortraitThumb({ src, width = 52, title }: MediaPortraitThumbProps) {
  const frameSx = { ...mediaPortraitListThumbFrameSx(width), mr: 1.5 };

  if (!src) {
    return (
      <Box
        sx={{
          ...frameSx,
          bgcolor: 'grey.900',
          border: '1px solid',
          borderColor: 'divider',
        }}
        title={title}
      />
    );
  }

  return (
    <Box sx={frameSx} title={title}>
      <Box
        component="img"
        src={src}
        alt=""
        decoding="async"
        loading="lazy"
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
          bgcolor: '#000',
        }}
      />
    </Box>
  );
}
