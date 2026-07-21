import React, { useEffect, useRef, useState } from 'react';
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

/** Mini preview 9:16: thumbnail estático; vídeo só no hover (sem remontar a lista). */
export function MediaPortraitThumb({ src, videoSrc, media, width = 52 }: MediaPortraitThumbProps) {
  const frameSx = { ...mediaPortraitListThumbFrameSx(width), mr: 1.5 };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hovering, setHovering] = useState(false);

  const canHoverVideo =
    Boolean(videoSrc) && /^video$/i.test(String(media?.media_type || ''));

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !canHoverVideo) return;

    if (hovering) {
      try {
        el.currentTime = 0;
      } catch {
        /* noop */
      }
      void el.play().catch(() => {
        /* autoplay bloqueado — mantém frame */
      });
      return;
    }

    el.pause();
    try {
      el.currentTime = 0;
    } catch {
      /* noop */
    }
  }, [hovering, canHoverVideo, videoSrc]);

  if (!src && !canHoverVideo) {
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

  return (
    <Box
      sx={frameSx}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt=""
          sx={{
            ...mediaLibraryPreviewSx(0, media, {
              previewUrl: src,
              previewSource: 'thumbnail',
            }),
            opacity: hovering && canHoverVideo ? 0 : 1,
            transition: 'opacity 120ms ease',
          }}
        />
      ) : null}

      {canHoverVideo ? (
        <Box
          component="video"
          ref={videoRef}
          src={videoSrc}
          muted
          loop
          playsInline
          preload="metadata"
          sx={{
            ...mediaPortraitHoverVideoSx(0, media),
            opacity: hovering ? 1 : 0,
            transition: 'opacity 120ms ease',
          }}
        />
      ) : null}
    </Box>
  );
}
