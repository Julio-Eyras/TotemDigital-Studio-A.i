import React, { useState, useEffect, useRef } from 'react';
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
import { mediaApi, MediaItem, CreateMediaRequest, clientApi, Client, subscriberApi, Subscriber } from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';

const Media: React.FC = () => {
  const theme = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
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
  const [videoLoadFailed, setVideoLoadFailed] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Verificar se é admin e carregar subscribers
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || '';
    const userType = user?.userType || '';
    const isTrueAdmin = userRole === 'admin' || userRole === 'admin_sql' || userRole === 'owner_system' || userType === 'system_user';
    const canSelect = isTrueAdmin || userRole === 'gerente_marketing' || userRole === 'editoracao';
    setIsAdmin(isTrueAdmin);
    setCanSelectSubscriber(canSelect);
    // Compat: user no localStorage pode vir em snake_case ou camelCase
    setUserSubscriberId(user?.subscriberId ?? user?.subscriber_id ?? user?.clientId);

    if (canSelect) {
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
    try {
      // "aptos": apenas subscribers ativos
      const response = await subscriberApi.getAll({ limit: 1000, active_only: true });
      const subs = response.data || [];
      setSubscribers(subs);

      // Se o usuário não está "preso" a um subscriber e pode escolher, selecionar um padrão (evita erro no upload/listagem)
      if (!userSubscriberId && subs.length > 0 && subscriberFilter === 'all') {
        setSubscriberFilter(subs[0].subscriber_id);
      }
    } catch (error) {
      console.error('Erro ao carregar subscribers:', error);
    }
  };

  const loadMediaItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Determinar subscriberId para filtro
      let subscriberId: number | undefined = undefined;
      if (userSubscriberId) {
        // Usuário "travado" em um subscriber (ex.: subscriber_user)
        subscriberId = userSubscriberId;
      } else if (canSelectSubscriber) {
        // Usuário pode escolher subscriber (ex.: gerente_marketing/editoracao/admin)
        if (subscriberFilter !== 'all' && typeof subscriberFilter === 'number') {
          subscriberId = subscriberFilter;
        } else if (!isAdmin) {
          // Não-admin não pode listar sem subscriber definido (evita erro do backend)
          setMediaItems([]);
          setError('É necessário selecionar um subscriber (anunciante)');
          return;
        }
      }
      
      const response = await mediaApi.getAll({
        search: searchTerm || undefined,
        mediaType: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
        subscriberId: subscriberId,
      });
      // mediaApi.getAll já retorna { data: [...], total, page, limit }
      setMediaItems(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar mídia:', error);
      setError('Erro ao carregar lista de mídia');
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  };

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
        status: editForm.status,
      };
      
      // Se o status for "approved", também atualizar approvalStatus
      if (editForm.status === 'approved') {
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
      console.error('Erro ao atualizar mídia:', e);
      setError(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Erro ao atualizar mídia');
    }
  };

  const handleDeleteMedia = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta mídia?')) {
      try {
        await mediaApi.delete(id);
        loadMediaItems();
      } catch (error) {
        console.error('Erro ao excluir mídia:', error);
        setError('Erro ao excluir mídia');
      }
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
        actions={[
          {
            label: 'Adicionar Mídia',
            icon: <Add />,
            onClick: () => setUploadDialogOpen(true),
            variant: 'contained',
          },
        ]}
        onRefresh={loadMediaItems}
        loading={loading}
      />

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={canSelectSubscriber ? 4 : 6}>
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
            {canSelectSubscriber && (
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Subscriber (Anunciante)</InputLabel>
                  <Select
                    value={subscriberFilter}
                    onChange={(e) => setSubscriberFilter(e.target.value as number | 'all')}
                    label="Subscriber (Anunciante)"
                  >
                    {isAdmin && <MenuItem value="all">Todos os Subscribers</MenuItem>}
                    {subscribers.map((subscriber) => (
                      <MenuItem key={subscriber.subscriber_id} value={subscriber.subscriber_id}>
                        {subscriber.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} md={isAdmin ? 2 : 3}>
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
            <Grid item xs={12} md={isAdmin ? 3 : 3}>
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
              <Box sx={{ position: 'relative', height: 200, backgroundColor: theme.palette.grey[100], overflow: 'hidden' }}>
                {/* Preview da Mídia */}
                {(() => {
                  // Construir URL do preview/thumbnail
                  let previewUrl = getPreviewSrc(media);
                  const isVideo = /^video$/i.test(String(media.media_type || ''));

                  // Para imagens: fallback em file_path público quando disponível.
                  // Para vídeos: NUNCA usar /assets/ como video src (404 em dev); preferir thumbnail (blob) ou ícone.
                  if (!previewUrl && !isVideo) {
                    previewUrl = normalizePublicAssetUrlFromFilePath(media.file_path);
                  } else if (!previewUrl && isVideo) {
                    // Vídeo sem blob: mostrar ícone; não usar /assets/ (geralmente 404)
                    previewUrl = undefined;
                  }

                  const finalPreviewUrl = previewUrl;
                  // Blob URLs (thumbnail) são imagens; só usar <video> para URLs de vídeo (.mp4 etc)
                  const isVideoUrl = isVideo && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(finalPreviewUrl || '');

                  if (finalPreviewUrl) {
                    const mediaId = media.media_id || media.id;
                    const videoFailed = typeof mediaId === 'number' && videoLoadFailed.has(mediaId);
                    // Vídeos com URL de arquivo: usar <video>; com blob (thumbnail): usar <img>
                    // Se vídeo falhou ao carregar (404 em /assets/...), mostrar ícone
                    if (isVideoUrl && videoFailed) {
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                          <Avatar sx={{ width: 80, height: 80, backgroundColor: alpha(getMediaTypeColor(media.media_type), 0.1), color: getMediaTypeColor(media.media_type) }}>
                            {getMediaIcon(media.media_type)}
                          </Avatar>
                        </Box>
                      );
                    }
                    if (isVideoUrl && !videoFailed) {
                      return (
                        <Box
                          component="video"
                          key={`${mediaId}-${thumbVersion}`}
                          src={finalPreviewUrl}
                          muted
                          playsInline
                          preload="metadata"
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                          }}
                          onError={() => {
                            if (typeof mediaId === 'number') {
                              setVideoLoadFailed((prev) => new Set(prev).add(mediaId));
                            }
                          }}
                        />
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
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            position: 'absolute',
                            top: 0,
                            left: 0,
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

                {/* Dados do Subscriber */}
                {media.subscriberName && (
                  <Box sx={{ mb: 1 }}>
                    <Chip
                      label={`Subscriber: ${media.subscriberName}`}
                      size="small"
                      color="primary"
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
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Visualizar">
                      <IconButton size="small">
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
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Adicionar Primeira Mídia
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <MediaUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
        isAdmin={isAdmin}
        canSelectSubscriber={canSelectSubscriber}
        subscribers={subscribers}
        userSubscriberId={userSubscriberId}
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
              {selectedMedia?.subscriberName && (
                <TextField fullWidth label="Subscriber" value={selectedMedia.subscriberName} margin="normal" disabled />
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
    </Box>
  );
};

export default Media;