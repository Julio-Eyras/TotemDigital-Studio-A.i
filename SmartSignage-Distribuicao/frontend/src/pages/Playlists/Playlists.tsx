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
  Tooltip,
  useTheme,
  alpha,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  QueueMusic,
  PlayArrow,
  DragIndicator,
  Refresh,
  MoreVert,
  AccessTime,
  VideoLibrary,
  Image,
  AudioFile,
} from '@mui/icons-material';
import { playlistApi, PlaylistItem, CreatePlaylistRequest, PlaylistMediaItem, mediaApi, MediaItem } from '../../services/api';

const Playlists: React.FC = () => {
  const theme = useTheme();
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistItem | null>(null);
  const [playlistMedia, setPlaylistMedia] = useState<PlaylistMediaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newPlaylist, setNewPlaylist] = useState<CreatePlaylistRequest>({
    name: '',
    description: '',
    clientId: undefined,
  });

  useEffect(() => {
    loadPlaylists();
    loadMediaItems();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await playlistApi.getAll({
        search: searchTerm || undefined,
      });
      const data = response?.data || response || [];
      setPlaylists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
      setError('Erro ao carregar lista de playlists');
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMediaItems = async () => {
    try {
      const response = await mediaApi.getAll();
      // mediaApi.getAll já retorna { data: [...], total, page, limit }
      setMediaItems(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar mídia:', error);
      setMediaItems([]);
    }
  };

  const loadPlaylistMedia = async (playlistId: number) => {
    try {
      const media = await playlistApi.getMedia(playlistId);
      // playlistApi.getMedia() já retorna PlaylistMediaItem[]
      setPlaylistMedia(Array.isArray(media) ? media : []);
    } catch (error) {
      console.error('Erro ao carregar mídia da playlist:', error);
      setPlaylistMedia([]);
    }
  };

  const handleCreatePlaylist = async () => {
    try {
      await playlistApi.create(newPlaylist);
      setCreateDialogOpen(false);
      setNewPlaylist({ name: '', description: '', clientId: undefined });
      loadPlaylists();
    } catch (error) {
      console.error('Erro ao criar playlist:', error);
      setError('Erro ao criar playlist');
    }
  };

  const handleEditPlaylist = async () => {
    if (!selectedPlaylist) return;
    
    try {
      await playlistApi.update(selectedPlaylist.playlist_id, {
        name: selectedPlaylist.name,
        description: selectedPlaylist.description,
        clientId: selectedPlaylist.client_id,
        isActive: selectedPlaylist.is_active,
      });
      setEditDialogOpen(false);
      setSelectedPlaylist(null);
      loadPlaylists();
    } catch (error) {
      console.error('Erro ao atualizar playlist:', error);
      setError('Erro ao atualizar playlist');
    }
  };

  const handleDeletePlaylist = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta playlist?')) {
      try {
        await playlistApi.delete(id);
        loadPlaylists();
      } catch (error) {
        console.error('Erro ao excluir playlist:', error);
        setError('Erro ao excluir playlist');
      }
    }
  };

  const handleAddMediaToPlaylist = async (mediaId: number) => {
    if (!selectedPlaylist) return;
    
    try {
      await playlistApi.addMedia(selectedPlaylist.playlist_id, mediaId);
      loadPlaylistMedia(selectedPlaylist.playlist_id);
    } catch (error) {
      console.error('Erro ao adicionar mídia:', error);
      setError('Erro ao adicionar mídia à playlist');
    }
  };

  const handleRemoveMediaFromPlaylist = async (itemId: number) => {
    if (!selectedPlaylist) return;
    
    try {
      await playlistApi.removeMedia(selectedPlaylist.playlist_id, itemId);
      loadPlaylistMedia(selectedPlaylist.playlist_id);
    } catch (error) {
      console.error('Erro ao remover mídia:', error);
      setError('Erro ao remover mídia da playlist');
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

  const formatDuration = (duration: number) => {
    const seconds = Math.floor(duration / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (totalDuration?: number) => {
    if (!totalDuration) return '0:00';
    return formatDuration(totalDuration);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando playlists...
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
            Playlists
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie suas playlists de mídia
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ 
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Criar Playlist
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Buscar playlists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <QueueMusic sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadPlaylists}
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

      {/* Playlists Grid */}
      <Grid container spacing={3}>
        {Array.isArray(playlists) && playlists.map((playlist) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={playlist.playlist_id}>
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
              <Box sx={{ position: 'relative', height: 120, backgroundColor: theme.palette.grey[100] }}>
                <Avatar
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                  }}
                >
                  <QueueMusic />
                </Avatar>
                
                <Chip
                  label={`${playlist.media_count || 0} itens`}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTime fontSize="small" color="action" />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      {formatTotalDuration(playlist.total_duration)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {playlist.name}
                </Typography>
                
                {playlist.description && (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }} noWrap>
                    {playlist.description}
                  </Typography>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={playlist.is_active ? 'Ativa' : 'Inativa'}
                    size="small"
                    color={playlist.is_active ? 'success' : 'default'}
                    variant="outlined"
                  />
                  
                  <Box>
                    <Tooltip title="Gerenciar Mídia">
                      <IconButton size="small" onClick={() => {
                        setSelectedPlaylist(playlist);
                        loadPlaylistMedia(playlist.playlist_id);
                        setMediaDialogOpen(true);
                      }}>
                        <PlayArrow />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => {
                        setSelectedPlaylist(playlist);
                        setEditDialogOpen(true);
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeletePlaylist(playlist.playlist_id)}>
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
      {playlists.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <QueueMusic sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhuma playlist encontrada
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece criando suas primeiras playlists
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Criar Primeira Playlist
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Criar Playlist</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome da Playlist"
            value={newPlaylist.name}
            onChange={(e) => setNewPlaylist({ ...newPlaylist, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Descrição"
            value={newPlaylist.description}
            onChange={(e) => setNewPlaylist({ ...newPlaylist, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreatePlaylist}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Playlist</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome da Playlist"
            value={selectedPlaylist?.name || ''}
            onChange={(e) => setSelectedPlaylist({ ...selectedPlaylist!, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Descrição"
            value={selectedPlaylist?.description || ''}
            onChange={(e) => setSelectedPlaylist({ ...selectedPlaylist!, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditPlaylist}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Media Management Dialog */}
      <Dialog open={mediaDialogOpen} onClose={() => setMediaDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Gerenciar Mídia - {selectedPlaylist?.name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {/* Available Media */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Mídia Disponível
              </Typography>
              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {Array.isArray(mediaItems) && mediaItems.map((media) => (
                  <ListItem
                    key={media.media_id}
                    button
                    onClick={() => handleAddMediaToPlaylist(media.media_id)}
                  >
                    <Avatar sx={{ mr: 2, backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>
                      {getMediaIcon(media.media_type)}
                    </Avatar>
                    <ListItemText
                      primary={media.name}
                      secondary={media.media_type}
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end">
                        <Add />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Grid>

            {/* Playlist Media */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Mídia na Playlist
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ordem</TableCell>
                      <TableCell>Mídia</TableCell>
                      <TableCell>Duração</TableCell>
                      <TableCell>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(playlistMedia) && playlistMedia.map((item) => (
                      <TableRow key={item.item_id}>
                        <TableCell>{item.order_index}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ width: 24, height: 24 }}>
                              {getMediaIcon(item.media.media_type)}
                            </Avatar>
                            <Typography variant="body2" noWrap>
                              {item.media.name}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{formatDuration(item.duration)}</TableCell>
                        <TableCell>
                          <IconButton 
                            size="small" 
                            onClick={() => handleRemoveMediaFromPlaylist(item.item_id)}
                          >
                            <Delete />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMediaDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Playlists;