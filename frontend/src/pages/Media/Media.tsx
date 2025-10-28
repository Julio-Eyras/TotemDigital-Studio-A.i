import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Fab,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Stop,
  Upload,
  Image,
  VideoFile,
  AudioFile,
  MoreVert,
} from '@mui/icons-material';
import { MediaUploadDialog } from '../../components/MediaUploadDialog/MediaUploadDialog';
import { mediaApi, MediaItem } from '../../services/api';

// Remover interface duplicada - usar a do services/api

export const Media: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');

  useEffect(() => {
    loadMediaItems();
  }, []);

  const loadMediaItems = async () => {
    try {
      setIsLoading(true);
      
      // Carregar dados reais da API
      const response = await mediaApi.getAll({ page: 1, limit: 50 });
      setMediaItems(response.data);
    } catch (error) {
      console.error('Erro ao carregar mídia:', error);
      // Fallback para dados simulados em caso de erro
      setMediaItems([
        {
          media_id: 1,
          name: 'Promoção Verão 2024',
          media_type: 'video',
          size_bytes: 15925248,
          duration_seconds: 30,
          status: 'active',
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z',
          file_path: '/uploads/promocao-verao.mp4',
          mime_type: 'video/mp4',
          preview_url: '/api/placeholder/300/200',
        },
        {
          media_id: 2,
          name: 'Logo Empresa',
          media_type: 'image',
          size_bytes: 2202009,
          status: 'active',
          created_at: '2024-01-14T00:00:00Z',
          updated_at: '2024-01-14T00:00:00Z',
          file_path: '/uploads/logo-empresa.png',
          mime_type: 'image/png',
          preview_url: '/api/placeholder/300/200',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMedia = () => {
    setOpenUploadDialog(true);
  };

  const handleEditMedia = (media: MediaItem) => {
    setEditingMedia(media);
    setOpenDialog(true);
  };

  const handleUploadSuccess = () => {
    loadMediaItems(); // Recarregar lista após upload
  };

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image />;
      case 'video': return <VideoFile />;
      case 'audio': return <AudioFile />;
      default: return <Image />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'warning';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'draft': return 'Rascunho';
      case 'archived': return 'Arquivado';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Carregando Mídia...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Gerenciamento de Mídia
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={viewMode === 'table' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('table')}
          >
            Lista
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('grid')}
          >
            Grade
          </Button>
        </Box>
      </Box>

      {viewMode === 'grid' ? (
        <Grid container spacing={2}>
          {mediaItems.map((item) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
              <Card>
                {item.thumbnail && (
                  <CardMedia
                    component="img"
                    height="140"
                    image={item.thumbnail}
                    alt={item.name}
                  />
                )}
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {getMediaIcon(item.type)}
                    <Typography variant="h6" sx={{ ml: 1, flexGrow: 1 }}>
                      {item.name}
                    </Typography>
                    <IconButton size="small">
                      <MoreVert />
                    </IconButton>
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <Chip
                      label={getStatusLabel(item.status)}
                      color={getStatusColor(item.status) as any}
                      size="small"
                    />
                    <Chip
                      label={item.type}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary">
                    {item.size} • {item.createdAt}
                    {item.duration && ` • ${item.duration}`}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <IconButton size="small" onClick={() => handleEditMedia(item)}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteMedia(item.id)}>
                      <Delete />
                    </IconButton>
                    <IconButton size="small">
                      <PlayArrow />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Tamanho</TableCell>
                <TableCell>Duração</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mediaItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getMediaIcon(item.type)}
                      <Typography sx={{ ml: 1 }}>
                        {item.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.type}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{item.size}</TableCell>
                  <TableCell>{item.duration || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(item.status)}
                      color={getStatusColor(item.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{item.createdAt}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEditMedia(item)}>
                      <Edit />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteMedia(item.id)}>
                      <Delete />
                    </IconButton>
                    <IconButton size="small">
                      <PlayArrow />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* FAB para adicionar mídia */}
      <Tooltip title="Adicionar Mídia">
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleAddMedia}
        >
          <Add />
        </Fab>
      </Tooltip>

      {/* Dialog para adicionar/editar mídia */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingMedia ? 'Editar Mídia' : 'Adicionar Nova Mídia'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nome da Mídia"
                  defaultValue={editingMedia?.name || ''}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descrição"
                  multiline
                  rows={3}
                  defaultValue={editingMedia?.description || ''}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<Upload />}
                  fullWidth
                >
                  Selecionar Arquivo
                  <input
                    type="file"
                    hidden
                    accept="image/*,video/*,audio/*"
                    multiple
                  />
                </Button>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => setOpenDialog(false)}>
            {editingMedia ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};