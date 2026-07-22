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
  /** Dimensões reais da mídia — landscape usa contain (sem zoom/corte). */
  mediaWidth?: number | null;
  mediaHeight?: number | null;
};

function isLandscapeMedia(mediaWidth?: number | null, mediaHeight?: number | null): boolean {
  const w = Number(mediaWidth ?? 0);
  const h = Number(mediaHeight ?? 0);
  return w > 0 && h > 0 && w > h;
}

/**
 * Thumbnail 9:16 estático.
 * Portrait: cover. Landscape: contain (letterbox) para não amplificar/cortar.
 */
export function MediaPortraitThumb({
  src,
  width = 52,
  title,
  mediaWidth,
  mediaHeight,
}: MediaPortraitThumbProps) {
  const frameSx = { ...mediaPortraitListThumbFrameSx(width), mr: 1.5 };
  const landscape = isLandscapeMedia(mediaWidth, mediaHeight);

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
          objectFit: landscape ? 'contain' : 'cover',
          objectPosition: 'center',
          display: 'block',
          bgcolor: '#000',
        }}
      />
    </Box>
  );
}
