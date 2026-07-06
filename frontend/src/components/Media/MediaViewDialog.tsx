import React, { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography,
} from '@mui/material';
import { mediaApi } from '../../services/api';
import {
  mediaPortraitPreviewFrameSx,
  mediaThumbnailPortraitPreviewSx,
  mediaTotemHoverVideoSx,
} from '../../hooks/useMediaRotationTransform';
import type { MediaItem } from '../../services/api';

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface MediaViewDialogProps {
  open: boolean;
  media: MediaItem | null;
  thumbnailSrc?: string;
  onClose: () => void;
}

export function MediaViewDialog({ open, media, thumbnailSrc, onClose }: MediaViewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !media?.media_id) {
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      try {
        const isVideo = /^video$/i.test(String(media.media_type || ''));
        if (isVideo) {
          const blob = await mediaApi.getFileBlob(media.media_id);
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setPreviewUrl(objectUrl);
        } else if (thumbnailSrc) {
          if (!cancelled) setPreviewUrl(thumbnailSrc);
        } else {
          const blob = await mediaApi.getThumbnailBlob(media.media_id);
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setPreviewUrl(objectUrl);
        }
      } catch {
        if (!cancelled) setPreviewUrl(thumbnailSrc || null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* noop */
        }
      }
      setPreviewUrl(null);
    };
  }, [open, media?.media_id, media?.media_type, thumbnailSrc]);

  if (!media) return null;

  const w = Number(media.width ?? 0);
  const h = Number(media.height ?? 0);
  const sizeBytes = Number((media as any).size_bytes ?? (media as any).fileSizeBytes ?? 0);
  const isVideo = /^video$/i.test(String(media.media_type || ''));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{media.name || 'Visualizar mídia'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box sx={{ ...mediaPortraitPreviewFrameSx(), width: 'min(100%, 220px)' }}>
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress size={32} />
              </Box>
            )}
            {!loading && previewUrl && isVideo && (
              <Box
                component="video"
                src={previewUrl}
                autoPlay
                muted
                loop
                playsInline
                controls
                sx={mediaTotemHoverVideoSx(0, media)}
              />
            )}
            {!loading && previewUrl && !isVideo && (
              <Box
                component="img"
                src={previewUrl}
                alt={media.name}
                sx={mediaThumbnailPortraitPreviewSx(0)}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          <Chip size="small" label={(media.media_type || 'mídia').toUpperCase()} />
          {media.status && <Chip size="small" variant="outlined" label={media.status} />}
          {w > 0 && h > 0 && <Chip size="small" variant="outlined" label={`${w}×${h}`} />}
          <Chip size="small" variant="outlined" label={formatFileSize(sizeBytes)} />
          {media.duration_seconds ? (
            <Chip size="small" variant="outlined" label={formatDuration(media.duration_seconds)} />
          ) : null}
        </Box>

        {media.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {media.description}
          </Typography>
        )}
        {media.approvedByName && (
          <Typography variant="caption" color="text.secondary" display="block">
            Aprovado por {media.approvedByName}
            {media.approvedAt && ` em ${new Date(media.approvedAt).toLocaleDateString('pt-BR')}`}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
