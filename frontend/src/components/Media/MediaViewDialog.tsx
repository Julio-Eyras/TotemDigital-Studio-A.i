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
import { mediaApi, publishBoardApi } from '../../services/api';
import {
  mediaPortraitPreviewFrameSx,
  mediaLibraryPreviewSx,
  mediaTotemHoverVideoSx,
} from '../../hooks/useMediaRotationTransform';
import type { MediaItem } from '../../services/api';
import {
  isPublishBoardHtmlMedia,
  parsePublishBoardPresetFromTags,
} from '../../utils/publishBoardMedia';
import { findPublishPreset } from '../../config/publishTemplates';

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
  const [htmlSrcDoc, setHtmlSrcDoc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !media?.media_id) {
      setPreviewUrl(null);
      setHtmlSrcDoc(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setLoading(true);
      try {
        const mediaType = String(media.media_type || '').toLowerCase();
        const isVideo = mediaType === 'video';
        const isHtml = mediaType === 'html' || isPublishBoardHtmlMedia(media);

        if (isHtml) {
          const sid = Number(media.subscriberId || (media as { subscriber_id?: number }).subscriber_id || 0);
          const boardPreset = parsePublishBoardPresetFromTags(media.tags);
          if (sid > 0 && boardPreset) {
            try {
              const layoutRes = await publishBoardApi.getLayout(sid, boardPreset);
              const preview = await publishBoardApi.previewHtml(sid, boardPreset, layoutRes.data);
              if (!cancelled) {
                setHtmlSrcDoc(preview.data?.html || '');
                setPreviewUrl(null);
              }
            } catch {
              const blob = await mediaApi.getFileBlob(media.media_id);
              const text = await blob.text();
              if (!cancelled) {
                setHtmlSrcDoc(text);
                setPreviewUrl(null);
              }
            }
          } else {
            const blob = await mediaApi.getFileBlob(media.media_id);
            const text = await blob.text();
            if (!cancelled) {
              setHtmlSrcDoc(text);
              setPreviewUrl(null);
            }
          }
        } else if (isVideo) {
          const blob = await mediaApi.getFileBlob(media.media_id);
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setPreviewUrl(objectUrl);
            setHtmlSrcDoc(null);
          }
        } else {
          const blob = await mediaApi.getFileBlob(media.media_id);
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setPreviewUrl(objectUrl);
            setHtmlSrcDoc(null);
          }
        }
      } catch {
        if (!cancelled) {
          setPreviewUrl(thumbnailSrc || null);
          setHtmlSrcDoc(null);
        }
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
      setHtmlSrcDoc(null);
    };
  }, [open, media?.media_id, media?.media_type, media?.tags, thumbnailSrc]);

  if (!media) return null;

  const w = Number(media.width ?? 0);
  const h = Number(media.height ?? 0);
  const sizeBytes = Number((media as any).size_bytes ?? (media as any).fileSizeBytes ?? 0);
  const isVideo = /^video$/i.test(String(media.media_type || ''));
  const isHtml = /^html$/i.test(String(media.media_type || '')) || isPublishBoardHtmlMedia(media);
  const boardPreset = parsePublishBoardPresetFromTags(media.tags);
  const boardLabel = boardPreset ? findPublishPreset(boardPreset).label : null;

  const metaParts = [
    (media.media_type || 'mídia').toUpperCase(),
    boardLabel,
    w > 0 && h > 0 ? `${w}×${h}` : null,
    formatFileSize(sizeBytes),
    media.duration_seconds ? formatDuration(media.duration_seconds) : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{media.name || 'Visualizar mídia'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box sx={{ ...mediaPortraitPreviewFrameSx(true), width: 'min(100%, 180px)' }}>
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <CircularProgress size={32} />
              </Box>
            )}
            {!loading && htmlSrcDoc && (
              <Box
                component="iframe"
                title="preview-html"
                srcDoc={htmlSrcDoc}
                sandbox="allow-scripts"
                sx={{ width: '100%', height: '100%', border: 0, bgcolor: '#000' }}
              />
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
            {!loading && previewUrl && !isVideo && !htmlSrcDoc && (
              <Box
                component="img"
                src={previewUrl}
                alt={media.name}
                sx={mediaLibraryPreviewSx(0, media, { previewSource: 'delivery' })}
              />
            )}
          </Box>
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
          {metaParts.join(' · ')}
        </Typography>

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
        {isHtml && (
          <Chip size="small" label="Animação HTML ao vivo" sx={{ mt: 1 }} color="primary" variant="outlined" />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
