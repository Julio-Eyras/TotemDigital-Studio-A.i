import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  useTheme,
  alpha,
  LinearProgress,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Download,
  Visibility,
  CloudUpload,
  VideoLibrary,
  Image,
  AudioFile,
  MoreVert,
  Refresh,
} from '@mui/icons-material';
import { mediaApi, MediaItem, CreateMediaRequest, clientApi, Client, subscriberApi, Subscriber, MediaInUseConflictPayload, parseMediaInUseConflict } from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import MediaDeleteConflictDialog from '../../components/MediaDeleteConflictDialog/MediaDeleteConflictDialog';
import MediaTransformActions from '../../components/Media/MediaTransformActions';
import { MediaViewDialog } from '../../components/Media/MediaViewDialog';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useMediaRotationTransform, mediaThumbnailPortraitPreviewSx, mediaPortraitPreviewFrameSx, mediaPortraitHoverVideoSx } from '../../hooks/useMediaRotationTransform';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { isDirectTotemMode } from '../../config/directTotemMode';
import { isStudioMode } from '../../config/studioMode';

const compareByDisplayName = (a?: string, b?: string) =>
  String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base', numeric: true });

const Media: React.FC = () => {
  const theme = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mediaViewTarget, setMediaViewTarget] = useState<MediaItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [subscriberFilter, setSubscriberFilter] = useState<number | 'all'>('all');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canSelectSubscriber, setCanSelectSubscriber] = useState(false);
  const [userSubscriberId, setUserSubscriberId] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Cache de thumbnails autorizados (Blob URLs) para evitar 401 em <img src="/api/...">
  const thumbObjectUrlsRef = useRef<Map<number, string>>(new Map());
  const [thumbVersion, setThumbVersion] = useState(0); // força rerender quando adicionamos um blob url
  /** Preview de vídeo ao passar o rato (Blob URL; só ficheiros até ~30 MB). */
  const HOVER_PREVIEW_MAX_BYTES = 30 * 1024 * 1024;
  const videoHoverBlobUrlsRef = useRef<Map<number, string>>(new Map());
  const hoverGenRef = useRef(0);
  const [videoHover, setVideoHover] = useState<{ id: number | null; url: string | null }>({ id: null, url: null });
  const hoverVideoRef = useRef<HTMLVideoElement | null>(null);
  const [processingFitId, setProcessingFitId] = useState<number | null>(null);
  const [mediaDeleteConflict, setMediaDeleteConflict] = useState<MediaInUseConflictPayload | null>(null);
  const [mediaDeleteConflictOpen, setMediaDeleteConflictOpen] = useState(false);
  const [mediaDeleteLoading, setMediaDeleteLoading] = useState(false);
  const [pendingMediaDeleteId, setPendingMediaDeleteId] = useState<number | null>(null);

  /** TotemDigital compacto: inferir subscriber para upload quando não há lista /api/subscribers */
  const uploadFallbackSubscriberId = useMemo(() => {
    if (!isStudioMode()) return undefined;
    if (userSubscriberId) return userSubscriberId;
    const m = mediaItems.find((x: any) => x.subscriberId ?? x.subscriber_id ?? x.clientId);
    if (!m) return undefined;
    return (m as any).subscriberId ?? (m as any).subscriber_id ?? (m as any).clientId;
  }, [userSubscriberId, mediaItems]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || '';
    const userType = user?.userType || '';
    const isTrueAdmin = userRole === 'admin' || userRole === 'admin_sql' || userRole === 'owner_system' || userType === 'system_user';
    const canSelect = isTrueAdmin || userRole === 'gerente_marketing' || userRole === 'editoracao';
    setIsAdmin(isTrueAdmin);
    setCanSelectSubscriber(canSelect);
    setUserSubscriberId(user?.subscriberId ?? user?.subscriber_id ?? user?.clientId);

    if (canSelect && !isStudioMode() && !isDirectTotemMode()) {
      loadSubscribers();
    }
    loadMediaItems();
  }, []);

  // Cleanup de Blob URLs ao desmontar
  useEffect(() => {
    return () => {
      thumbObjectUrlsRef.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch { /* noop */ }
      });
      thumbObjectUrlsRef.current.clear();
      videoHoverBlobUrlsRef.current.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch { /* noop */ }
      });
      videoHoverBlobUrlsRef.current.clear();
    };
  }, []);

  const isProtectedThumbnailUrl = (url?: string) => {
    if (!url) return false;
    // cobre relativo e absoluto; o que importa é o path conter /api/media/:id/thumbnail
    return /\/api\/media\/\d+\/thumbnail(\?|$)/.test(url);
  };

  const getPreviewSrc = (media: any): string | undefined => {
    const id = media?.media_id || media?.id;
    const cached = typeof id === 'number' ? thumbObjectUrlsRef.current.get(id) : undefined;
    if (cached) return cached;
    const url = media?.thumbnailUrl || media?.previewUrl;
    // Evitar que o browser tente carregar /api/media/:id/thumbnail sem Authorization (gera 401)
    if (isProtectedThumbnailUrl(url)) return undefined;
    return url;
  };

  const normalizePublicAssetUrlFromFilePath = (raw?: string | null): string | undefined => {
    const v = (typeof raw === 'string' ? raw.trim() : '');
    if (!v) return undefined;

    // Aceitar apenas caminhos que o backend realmente serve via static (/assets, /uploads).
    // Não tentar carregar paths "demo" do seed como /media/... (isso gera 404 e polui o console).
    if (v.startsWith('/assets/')) return v;
    if (v.startsWith('/uploads/')) return v;
    if (v.startsWith('/opt/smart-signage/public/assets/')) {
      return v.replace('/opt/smart-signage/public/assets/', '/assets/');
    }
    if (v.includes('/public/assets/')) {
      const parts = v.split('/public/assets/');
      if (parts.length > 1) return `/assets/${parts[1]}`.replace(/\/+/g, '/');
    }
    if (v.includes('/assets/')) {
      const parts = v.split('/assets/');
      if (parts.length > 1) return `/assets/${parts[1]}`.replace(/\/+/g, '/');
    }
    return undefined;
  };

  // Prefetch thumbnails protegidos via axios (com token) e usar Blob URL como src
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    if (!Array.isArray(mediaItems) || mediaItems.length === 0) return;

    let cancelled = false;
    const toFetch = mediaItems
      .map((m: any) => ({
        id: m?.media_id || m?.id,
        url: m?.thumbnailUrl || m?.previewUrl,
      }))
      .filter((x) => typeof x.id === 'number')
      .filter((x) => isProtectedThumbnailUrl(x.url))
      .filter((x) => !thumbObjectUrlsRef.current.has(x.id));

    if (toFetch.length === 0) return;

    (async () => {
      for (const { id } of toFetch) {
        try {
          const blob = await mediaApi.getThumbnailBlob(id);
          const objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            try { URL.revokeObjectURL(objectUrl); } catch { /* noop */ }
            continue;
          }
          thumbObjectUrlsRef.current.set(id, objectUrl);
          setThumbVersion((v) => v + 1);
        } catch {
          // Se falhar (ex.: 401 por token inválido), mantém fallback normal.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaItems]);

  const loadSubscribers = async () => {
    if (isStudioMode()) return;
    try {
      // "aptos": apenas subscribers ativos
      const response = await subscriberApi.getAll({ limit: 1000, active_only: true });
      const subs = Array.isArray(response.data) ? [...response.data] : [];
      subs.sort((a: any, b: any) => compareByDisplayName(a?.name, b?.name));
      setSubscribers(subs);

      // Se o usuário não está "preso" a um subscriber e pode escolher, selecionar um padrão (evita erro no upload/listagem)
      if (!userSubscriberId && subs.length > 0 && subscriberFilter === 'all') {
        setSubscriberFilter(subs[0].subscriber_id);
      }
    } catch (error) {
    }
  };

  const loadMediaItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let subscriberId: number | undefined = undefined;
      if (!isDirectTotemMode()) {
        if (isStudioMode()) {
          if (userSubscriberId) {
            subscriberId = userSubscriberId;
          } else if (canSelectSubscriber && subscriberFilter !== 'all' && typeof subscriberFilter === 'number') {
            subscriberId = subscriberFilter;
          }
        } else if (userSubscriberId) {
          subscriberId = userSubscriberId;
        } else if (canSelectSubscriber) {
          if (subscriberFilter !== 'all' && typeof subscriberFilter === 'number') {
            subscriberId = subscriberFilter;
          } else if (!isAdmin) {
            setMediaItems([]);
            setError('É necessário selecionar um subscriber (anunciante)');
            return;
          }
        }
      }
      
      const response = await mediaApi.getAll({
        search: searchTerm || undefined,
        mediaType: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
        subscriberId: subscriberId,
      });
      // mediaApi.getAll já retorna { data: [...], total, page, limit }
      const mediaData = Array.isArray(response?.data) ? [...response.data] : [];
      mediaData.sort((a: any, b: any) => compareByDisplayName(a?.name || a?.title || a?.file_name, b?.name || b?.title || b?.file_name));
      setMediaItems(mediaData);
    } catch (error) {
      setError('Erro ao carregar lista de mídia');
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  };

  const {
    getRotationDraft,
    handleRotatePreview,
    handleConfirmRotation,
    processingRotationId,
  } = useMediaRotationTransform(async () => {
    setThumbVersion((v) => v + 1);
    await loadMediaItems();
  });

  useEffect(() => {
    loadMediaItems();
  }, [searchTerm, mediaTypeFilter, subscriberFilter]);

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    loadMediaItems();
  };

  const [editForm, setEditForm] = useState<{ name: string; description: string; tags: string[]; status: string } | null>(null);

  const handleEditMedia = (media: MediaItem) => {
    setSelectedMedia(media);
    setEditForm({
      name: media.name || '',
      description: media.description || '',
      tags: Array.isArray(media.tags) ? [...media.tags] : (media.tags ? String(media.tags).split(',').map((t: string) => t.trim()).filter(Boolean) : []),
      status: media.status || 'draft',
    });
    setEditDialogOpen(true);
  };

  const handleSaveMedia = async () => {
    if (!selectedMedia || !editForm) return;
    try {
      setError(null);
      
      // Preparar dados de atualização
      const updateData: any = {
        name: editForm.name,
        description: editForm.description || undefined,
        // Converter array de tags para string (backend espera string no validator, mas processa como array)
        tags: Array.isArray(editForm.tags) && editForm.tags.length > 0 
          ? editForm.tags.join(',') 
          : undefined,
        status: isStudioMode() ? 'approved' : editForm.status,
      };

      if (isStudioMode()) {
        updateData.approvalStatus = 'approved';
      } else if (editForm.status === 'approved') {
        updateData.approvalStatus = 'approved';
      } else if (editForm.status === 'rejected') {
        updateData.approvalStatus = 'rejected';
      } else if (editForm.status === 'pending_approval') {
        updateData.approvalStatus = 'pending';
      }
      
      await mediaApi.update(selectedMedia.media_id, updateData);
      setEditDialogOpen(false);
      setSelectedMedia(null);
      setEditForm(null);
      loadMediaItems();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao atualizar mídia'));
    }
  };

  const handleDeleteMedia = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta mídia?')) return;
    try {
      setMediaDeleteLoading(true);
      setError(null);
      await mediaApi.delete(id);
      loadMediaItems();
    } catch (error) {
      const conflict = parseMediaInUseConflict(error);
      if (conflict) {
        setPendingMediaDeleteId(id);
        setMediaDeleteConflict(conflict);
        setMediaDeleteConflictOpen(true);
        return;
      }
      setError(pickApiErrorMessage(error, 'Erro ao excluir mídia'));
    } finally {
      setMediaDeleteLoading(false);
    }
  };

  const handleForceDeleteMedia = async () => {
    if (pendingMediaDeleteId == null) return;
    try {
      setMediaDeleteLoading(true);
      setError(null);
      const result = await mediaApi.delete(pendingMediaDeleteId, { forceDetach: true });
      setMediaDeleteConflictOpen(false);
      setMediaDeleteConflict(null);
      setPendingMediaDeleteId(null);
      loadMediaItems();
      const offlineNote =
        typeof result === 'object' && result && 'offlineTotemWarning' in result
          ? (result as { offlineTotemWarning?: string }).offlineTotemWarning
          : '';
      window.dispatchEvent(
        new CustomEvent('showNotification', {
          detail: {
            type: 'success',
            title: 'Mídia excluída',
            message:
              (typeof result === 'object' && result && 'message' in result
                ? String((result as { message?: string }).message)
                : 'Mídia removida com sucesso') + (offlineNote ? `\n\n${offlineNote}` : ''),
            duration: offlineNote ? 20000 : 8000,
          },
        })
      );
    } catch (error) {
      setError(pickApiErrorMessage(error, 'Erro ao excluir mídia'));
    } finally {
      setMediaDeleteLoading(false);
    }
  };

  const handleFitToPortrait = async (media: MediaItem) => {
    const mediaId = media.media_id;
    if (processingFitId || processingRotationId) return;

    if (!window.confirm('Adequar esta mídia para formato 9:16 (portrait)?')) {
      return;
    }

    try {
      setProcessingFitId(mediaId);
      setError(null);
      await mediaApi.transformToPortrait(mediaId, {
        rotationDegrees: 0,
        fit: '9:16',
      });

      const thumbUrl = thumbObjectUrlsRef.current.get(mediaId);
      if (thumbUrl) {
        try { URL.revokeObjectURL(thumbUrl); } catch { /* noop */ }
        thumbObjectUrlsRef.current.delete(mediaId);
      }
      const hoverUrl = videoHoverBlobUrlsRef.current.get(mediaId);
      if (hoverUrl) {
        try { URL.revokeObjectURL(hoverUrl); } catch { /* noop */ }
        videoHoverBlobUrlsRef.current.delete(mediaId);
      }
      setVideoHover((prev) => (prev.id === mediaId ? { id: null, url: null } : prev));
      setThumbVersion((v) => v + 1);
      await loadMediaItems();
    } catch (error) {
      setError(pickApiErrorMessage(error, 'Erro ao adequar mídia para 9:16'));
    } finally {
      setProcessingFitId(null);
    }
  };

  const getMediaIcon = (mediaType?: string) => {
    if (!mediaType) return <VideoLibrary />;
    switch (mediaType.toLowerCase()) {
      case 'video':
        return <VideoLibrary />;
      case 'image':
        return <Image />;
      case 'audio':
        return <AudioFile />;
      default:
        return <VideoLibrary />;
    }
  };

  const getMediaTypeColor = (mediaType?: string) => {
    if (!mediaType) return theme.palette.primary.main;
    switch (mediaType.toLowerCase()) {
      case 'video':
        return theme.palette.error.main;
      case 'image':
        return theme.palette.success.main;
      case 'audio':
        return theme.palette.warning.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePreviewMouseEnter = async (media: MediaItem) => {
    const id = media.media_id;
    if (!id || !/^video$/i.test(String(media.media_type || ''))) return;
    const bytes = Number((media as any).size_bytes ?? (media as any).fileSizeBytes ?? 0);
    if (bytes > HOVER_PREVIEW_MAX_BYTES) return;
    const gen = ++hoverGenRef.current;
    let url = videoHoverBlobUrlsRef.current.get(id);
    if (!url) {
      try {
        const blob = await mediaApi.getFileBlob(id);
        if (gen !== hoverGenRef.current) return;
        url = URL.createObjectURL(blob);
        videoHoverBlobUrlsRef.current.set(id, url);
      } catch {
        if (gen === hoverGenRef.current) setVideoHover({ id: null, url: null });
        return;
      }
    }
    if (gen !== hoverGenRef.current) return;
    setVideoHover({ id, url: url! });
  };

  const handlePreviewMouseLeave = () => {
    hoverGenRef.current += 1;
    try {
      hoverVideoRef.current?.pause();
    } catch {
      /* noop */
    }
    setVideoHover({ id: null, url: null });
  };

  useEffect(() => {
    const el = hoverVideoRef.current;
    if (!el || !videoHover.url) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  }, [videoHover.id, videoHover.url]);

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando mídia...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      <PageHeader
        title="Biblioteca de Mídia"
        subtitle="Gerencie seus arquivos de mídia"
        breadcrumbs={breadcrumbs}
        actions={
          isStudioMode()
            ? []
            : [
                {
                  label: 'Criar Mídia',
                  icon: <Add />,
                  onClick: () => setUploadDialogOpen(true),
                  variant: 'contained',
                },
              ]
        }
        onRefresh={loadMediaItems}
        loading={loading}
      />

      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Boas práticas para mídia indoor (DOOH)
        </Typography>
        <Typography variant="body2" component="div">
          Prefira <strong>16:9</strong> em TVs horizontais; teste <strong>legibilidade</strong> à distância de visualização
          do local. Vídeos muito longos pesam na rede e no player — use durações compatíveis com o <strong>slot</strong> da
          playlist. Formatos comuns: MP4 (H.264), JPG/PNG. Respeite os limites de upload definidos em{' '}
          <strong>Configurações → Mídias</strong> (tamanho e tipos permitidos).
        </Typography>
      </Alert>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={canSelectSubscriber && !isStudioMode() ? 4 : 6}>
              <TextField
                fullWidth
                placeholder="Buscar mídia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <CloudUpload sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            {canSelectSubscriber && !isStudioMode() && !isDirectTotemMode() && (
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Anunciante</InputLabel>
                  <Select
                    value={subscriberFilter}
                    onChange={(e) => setSubscriberFilter(e.target.value as number | 'all')}
                    label="Anunciante"
                  >
                    {isAdmin && <MenuItem value="all">Todos os Anunciantes</MenuItem>}
                    {subscribers.map((subscriber) => (
                      <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                        {subscriber.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} md={isAdmin && !isStudioMode() ? 2 : 3}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Mídia</InputLabel>
                <Select
                  value={mediaTypeFilter}
                  onChange={(e) => setMediaTypeFilter(e.target.value)}
                  label="Tipo de Mídia"
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="video">Vídeo</MenuItem>
                  <MenuItem value="image">Imagem</MenuItem>
                  <MenuItem value="audio">Áudio</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadMediaItems}
              >
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Media Grid */}
      <Grid container spacing={3}>
        {Array.isArray(mediaItems) && mediaItems.map((media) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={media.media_id}>
            <Card sx={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
              }
            }}>
              <Box
                sx={mediaPortraitPreviewFrameSx()}
                onMouseEnter={() => handlePreviewMouseEnter(media)}
                onMouseLeave={handlePreviewMouseLeave}
              >
                {/* Preview da Mídia */}
                {(() => {
                  // Construir URL do preview/thumbnail
                  let previewUrl = getPreviewSrc(media);
                  const isVideo = /^video$/i.test(String(media.media_type || ''));

                  // Para imagens: fallback em file_path público só sem media_id (evita 404).
                  // Para vídeos: NUNCA usar /assets/ como video src (404 em dev); preferir thumbnail (blob) ou ícone.
                  if (!previewUrl && !isVideo) {
                    const mediaId = media.media_id || media.id;
                    if (!mediaId) {
                      previewUrl = normalizePublicAssetUrlFromFilePath(media.file_path);
                    }
                  } else if (!previewUrl && isVideo) {
                    // Vídeo sem blob: mostrar ícone; não usar /assets/ (geralmente 404)
                    previewUrl = undefined;
                  }

                  const finalPreviewUrl = previewUrl;
                  // Blob URLs (thumbnail) são imagens; só usar <video> para URLs de vídeo (.mp4 etc)
                  const isVideoUrl = isVideo && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(finalPreviewUrl || '');

                  if (finalPreviewUrl) {
                    // Vídeo com URL de ficheiro: não reproduzir no card — só ao passar o rato (camada hover abaixo).
                    if (isVideoUrl) {
                      return (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            width: '100%',
                            bgcolor: 'grey.900',
                          }}
                        >
                          <VideoLibrary sx={{ fontSize: 56, color: 'grey.500', opacity: 0.9 }} />
                        </Box>
                      );
                    }
                    return (
                      <>
                        <Box
                          component="img"
                          key={`${media.media_id || media.id}-${thumbVersion}`}
                          src={finalPreviewUrl}
                          alt={media.name}
                          sx={{
                            ...mediaThumbnailPortraitPreviewSx(getRotationDraft(media.media_id)),
                            opacity:
                              videoHover.id === media.media_id && videoHover.url ? 0 : 1,
                          }}
                          onError={(e: any) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </>
                    );
                  }
                  
                  // Fallback: mostrar ícone centralizado quando não há preview
                  return (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        width: '100%',
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 80,
                          height: 80,
                          backgroundColor: alpha(getMediaTypeColor(media.media_type), 0.1),
                          color: getMediaTypeColor(media.media_type),
                        }}
                      >
                        {getMediaIcon(media.media_type)}
                      </Avatar>
                    </Box>
                  );
                })()}

                {/^video$/i.test(String(media.media_type || '')) &&
                  videoHover.id === media.media_id &&
                  videoHover.url && (
                    <Box
                      component="video"
                      ref={hoverVideoRef}
                      src={videoHover.url}
                      muted
                      loop
                      playsInline
                      sx={mediaPortraitHoverVideoSx(
                        getRotationDraft(media.media_id),
                        media,
                      )}
                    />
                  )}
                
                {/* Overlay com informações */}
                {(() => {
                  const previewUrl = media.thumbnailUrl || media.previewUrl || 
                    (media.media_type === 'image' && media.file_path ? media.file_path.replace('/opt/smart-signage/public/assets/', '/assets/') : null);
                  const videoPreviewUrl = media.media_type === 'video' && !previewUrl && media.file_path
                    ? media.file_path.replace('/opt/smart-signage/public/assets/', '/assets/')
                    : null;
                  const hasPreview = !!(previewUrl || videoPreviewUrl);
                  
                  return (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: 'none',
                        zIndex: 3,
                        background: hasPreview
                          ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)'
                          : 'transparent',
                      }}
                    >
                  <Avatar
                    sx={{
                      position: 'absolute',
                      top: 16,
                      left: 16,
                      backgroundColor: alpha(getMediaTypeColor(media.media_type), 0.8),
                      color: 'white',
                      width: 32,
                      height: 32,
                    }}
                  >
                    {getMediaIcon(media.media_type)}
                  </Avatar>
                  
                  <Chip
                    label={media.media_type ? media.media_type.toUpperCase() : 'MÍDIA'}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      backgroundColor: alpha(getMediaTypeColor(media.media_type), 0.9),
                      color: 'white',
                      fontWeight: 'bold',
                    }}
                  />

                  <Box sx={{ 
                    position: 'absolute', 
                    bottom: 16, 
                    left: 16, 
                    right: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: 'white',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                        fontWeight: 'bold'
                      }}
                    >
                      {formatFileSize(media.size_bytes ?? media.fileSizeBytes)}
                    </Typography>
                    {media.duration_seconds && (
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: 'white',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                          fontWeight: 'bold'
                        }}
                      >
                        {formatDuration(media.duration_seconds)}
                      </Typography>
                    )}
                  </Box>
                    </Box>
                  );
                })()}
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {media.name}
                </Typography>
      
                {media.description && (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }} noWrap>
                    {media.description}
                  </Typography>
                )}

                {media.subscriberName && !isDirectTotemMode() && (
                  <Box sx={{ mb: 1 }}>
                    <Chip
                      label={`Anunciante: ${media.subscriberName}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </Box>
                )}
                {isDirectTotemMode() && (
                  <Box sx={{ mb: 1 }}>
                    <Chip
                      label={`${Number((media as any).totemCount ?? 0)} totem(ns)`}
                      size="small"
                      color="secondary"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </Box>
                )}

                {/* Tags */}
                {media.tags && media.tags.length > 0 && (
                  <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {media.tags.slice(0, 3).map((tag, idx) => (
                      <Chip
                        key={idx}
                        label={tag}
                        size="small"
                        sx={{ fontSize: '0.65rem', height: '20px' }}
                      />
                    ))}
                    {media.tags.length > 3 && (
                      <Chip
                        label={`+${media.tags.length - 3}`}
                        size="small"
                        sx={{ fontSize: '0.65rem', height: '20px' }}
                      />
                    )}
                  </Box>
                )}

                {/* Status e Aprovação */}
                <Box sx={{ mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={media.status || 'draft'}
                    size="small"
                    color={
                      media.status === 'approved' ? 'success' :
                      media.status === 'rejected' ? 'error' :
                      media.status === 'pending_approval' ? 'warning' :
                      'default'
                    }
                    variant="outlined"
                  />
                  {media.approvalStatus && (
                    <Chip
                      label={`Aprovação: ${media.approvalStatus}`}
                      size="small"
                      color={media.approvalStatus === 'approved' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  )}
                </Box>

                {/* Informações de aprovação */}
                {media.approvedByName && (
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                    Aprovado por: {media.approvedByName}
                    {media.approvedAt && ` em ${new Date(media.approvedAt).toLocaleDateString('pt-BR')}`}
                  </Typography>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {(() => {
                      const isTransformable = /^(image|video)$/i.test(String(media.media_type || ''));
                      return (
                        <MediaTransformActions
                          isTransformable={isTransformable}
                          rotationDraft={getRotationDraft(media.media_id)}
                          processingRotation={processingRotationId === media.media_id}
                          processingFit={processingFitId === media.media_id}
                          onRotatePreview={() => handleRotatePreview(media.media_id)}
                          onConfirmRotation={async () => {
                            const err = await handleConfirmRotation(media.media_id);
                            if (err) setError(err);
                          }}
                          onFitPortrait={() => handleFitToPortrait(media)}
                        />
                      );
                    })()}
                    <Tooltip title="Visualizar">
                      <IconButton size="small" onClick={() => setMediaViewTarget(media)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => handleEditMedia(media)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeleteMedia(media.media_id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {mediaItems.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <VideoLibrary sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhuma mídia encontrada
        </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros arquivos de mídia
        </Typography>
            {!isStudioMode() && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Adicionar Primeira Mídia
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <MediaUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
        isAdmin={isAdmin}
        canSelectSubscriber={isDirectTotemMode() ? false : canSelectSubscriber}
        subscribers={isDirectTotemMode() ? [] : subscribers}
        userSubscriberId={userSubscriberId}
        fallbackSubscriberId={isDirectTotemMode() ? undefined : uploadFallbackSubscriberId}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => { setEditDialogOpen(false); setEditForm(null); setError(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Mídia</DialogTitle>
        <DialogContent>
          {editForm && (
            <>
              <TextField
                fullWidth
                label="Nome"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => prev ? { ...prev, name: e.target.value } : null)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Descrição"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => prev ? { ...prev, description: e.target.value } : null)}
                margin="normal"
                multiline
                rows={3}
              />
              <TextField
                fullWidth
                label="Tags (separadas por vírgula)"
                value={editForm.tags.join(', ')}
                onChange={(e) =>
                  setEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          tags: e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean),
                        }
                      : null
                  )
                }
                margin="normal"
                placeholder="tag1, tag2, tag3"
              />
              {!isStudioMode() ? (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editForm.status}
                    onChange={(e) => setEditForm((prev) => (prev ? { ...prev, status: e.target.value } : null))}
                    label="Status"
                  >
                    <MenuItem value="draft">Rascunho</MenuItem>
                    <MenuItem value="pending_approval">Aguardando Aprovação</MenuItem>
                    <MenuItem value="approved">Aprovado</MenuItem>
                    <MenuItem value="rejected">Rejeitado</MenuItem>
                    <MenuItem value="archived">Arquivado</MenuItem>
                  </Select>
                </FormControl>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Modo compacto: a mídia permanece <strong>aprovada</strong> (novos uploads já entram aprovados no servidor).
                </Alert>
              )}
              {selectedMedia?.subscriberName && (
                <TextField fullWidth label="Anunciante" value={selectedMedia.subscriberName} margin="normal" disabled />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setEditDialogOpen(false); setEditForm(null); }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveMedia} disabled={!editForm?.name?.trim()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
      <MediaViewDialog
        open={!!mediaViewTarget}
        media={mediaViewTarget}
        thumbnailSrc={mediaViewTarget ? getPreviewSrc(mediaViewTarget) : undefined}
        onClose={() => setMediaViewTarget(null)}
      />
      <MediaDeleteConflictDialog
        open={mediaDeleteConflictOpen}
        conflict={mediaDeleteConflict}
        mediaLabel={mediaDeleteConflict?.mediaName}
        loading={mediaDeleteLoading}
        onClose={() => {
          if (mediaDeleteLoading) return;
          setMediaDeleteConflictOpen(false);
          setMediaDeleteConflict(null);
          setPendingMediaDeleteId(null);
        }}
        onConfirmForceDelete={handleForceDeleteMedia}
      />
    </Box>
  );
};

export default Media;