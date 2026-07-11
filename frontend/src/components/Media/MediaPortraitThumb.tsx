import React from 'react';
import { Box } from '@mui/material';
import {
  mediaLibraryPreviewSx,
  mediaPortraitHoverVideoSx,
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
  videoSrc?: string;
  media?: MediaDeliveryPreviewFields & {
    media_type?: string;
    width?: number;
    height?: number;
  };
  width?: number;
};

/** Mini preview 9:16 alinhada à biblioteca de mídias (thumbnail ou vídeo de entrega totem). */
export function MediaPortraitThumb({ src, videoSrc, media, width = 52 }: MediaPortraitThumbProps) {
  const frameSx = { ...mediaPortraitListThumbFrameSx(width), mr: 1.5 };

  if (videoSrc && /^video$/i.test(String(media?.media_type || ''))) {
    return (
      <Box sx={frameSx}>
        <Box
          component="video"
          src={videoSrc}
          muted
          playsInline
          preload="metadata"
          sx={mediaPortraitHoverVideoSx(0, media)}
        />
      </Box>
    );
  }

  if (src) {
    return (
      <Box sx={frameSx}>
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

  return (
    <Box
      sx={{
        ...frameSx,
        bgcolor: 'grey.900',
        border: '1px solid',
        borderColor: 'divider',
      }}
    />
  );
}
