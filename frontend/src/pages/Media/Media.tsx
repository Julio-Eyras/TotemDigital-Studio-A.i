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

  const getMediaIcon = (mediaType: string) => {
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

  const getMediaTypeColor = (mediaType: string) => {
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
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
              <Box sx={{ position: 'relative', height: 200, backgroundColor: theme.palette.grey[100] }}>
                <Avatar
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: alpha(getMediaTypeColor(media.media_type), 0.1),
                    color: getMediaTypeColor(media.media_type),
                  }}
                >
                  {getMediaIcon(media.media_type)}
                </Avatar>
                
                <Chip
                  label={media.media_type.toUpperCase()}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(getMediaTypeColor(media.media_type), 0.1),
                    color: getMediaTypeColor(media.media_type),
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
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {formatFileSize(media.size_bytes)}
                  </Typography>
                  {media.duration_seconds && (
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      {formatDuration(media.duration_seconds)}
                    </Typography>
                  )}
                </Box>
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
                    label={media.status}
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