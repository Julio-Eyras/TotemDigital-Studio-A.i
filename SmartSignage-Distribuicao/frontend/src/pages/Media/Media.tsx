import React, { useState, useEffect } from 'react';
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
import { mediaApi, MediaItem, CreateMediaRequest } from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';

const Media: React.FC = () => {
  const theme = useTheme();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMediaItems();
  }, []);

  const loadMediaItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await mediaApi.getAll({
        search: searchTerm || undefined,
        mediaType: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
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

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    loadMediaItems();
  };

  const handleEditMedia = (media: MediaItem) => {
    setSelectedMedia(media);
    setEditDialogOpen(true);
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
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Biblioteca de Mídia
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie seus arquivos de mídia
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setUploadDialogOpen(true)}
          sx={{ 
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Adicionar Mídia
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
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
            <Grid item xs={12} md={3}>
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
              <Box sx={{ position: 'relative', height: 200, backgroundColor: theme.palette.grey[100], overflow: 'hidden' }}>
                {/* Preview da Mídia */}
                {(() => {
                  // Construir URL do preview/thumbnail
                  let previewUrl = media.thumbnailUrl || media.previewUrl;
                  
                  // Se não houver thumbnailUrl, usar file_path
                  if (!previewUrl && media.file_path) {
                    // Garantir que file_path está no formato correto
                    let filePath = media.file_path;
                    if (filePath.startsWith('/opt/smart-signage/public/assets/')) {
                      filePath = filePath.replace('/opt/smart-signage/public/assets/', '/assets/');
                    }
                    previewUrl = filePath;
                  }
                  
                  // Debug: log para verificar URLs
                  if (mediaItems.indexOf(media) === 0) {
                    console.log('🔍 [Media Preview] Media:', {
                      name: media.name,
                      media_type: media.media_type,
                      file_path: media.file_path,
                      thumbnailUrl: media.thumbnailUrl,
                      previewUrl: media.previewUrl,
                      finalPreviewUrl: previewUrl,
                      size_bytes: media.size_bytes
                    });
                  }

                  const finalPreviewUrl = previewUrl;

                  if (finalPreviewUrl) {
                    return (
                      <>
                        {media.media_type === 'video' ? (
                          <Box
                            component="video"
                            src={finalPreviewUrl}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                            }}
                            muted
                            playsInline
                            onError={(e: any) => {
                              // Se o vídeo falhar, mostrar ícone
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <Box
                            component="img"
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
                              // Se a imagem falhar ao carregar, ocultar e mostrar apenas o ícone
                              e.target.style.display = 'none';
                            }}
                          />
                        )}
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
                      {formatFileSize(media.size_bytes)}
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
      
                {media.title && (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }} noWrap>
                    {media.title}
                  </Typography>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={media.status || 'draft'}
                    size="small"
                    color={media.status === 'active' ? 'success' : 'default'}
                    variant="outlined"
                  />
                  
                  <Box>
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
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Mídia</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome"
            defaultValue={selectedMedia?.name}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Título"
            defaultValue={selectedMedia?.title}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Descrição"
            defaultValue={selectedMedia?.description}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Media;