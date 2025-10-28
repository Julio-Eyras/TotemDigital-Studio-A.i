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
  Fab,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Pause,
  Stop,
  Schedule,
  MoreVert,
  DragIndicator,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';

interface PlaylistItem {
  id: string;
  name: string;
  description: string;
  mediaCount: number;
  duration: string;
  status: 'active' | 'draft' | 'paused';
  createdAt: string;
  lastPlayed?: string;
}

interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  duration: number;
  order: number;
}

export const Playlists: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<PlaylistItem | null>(null);
  const [openMediaDialog, setOpenMediaDialog] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistItem | null>(null);
  const [playlistMedia, setPlaylistMedia] = useState<MediaItem[]>([]);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      setIsLoading(true);
      
      // Simular carregamento de dados (substituir por chamadas reais da API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPlaylists([
        {
          id: '1',
          name: 'Horário Comercial',
          description: 'Playlist para horário comercial da loja',
          mediaCount: 8,
          duration: '15:30',
          status: 'active',
          createdAt: '2024-01-15',
          lastPlayed: '2024-01-20 14:30',
        },
        {
          id: '2',
          name: 'Promoções',
          description: 'Conteúdo promocional e ofertas',
          mediaCount: 5,
          duration: '8:45',
          status: 'active',
          createdAt: '2024-01-14',
          lastPlayed: '2024-01-20 12:15',
        },
        {
          id: '3',
          name: 'Informativos',
          description: 'Informações gerais e institucionais',
          mediaCount: 3,
          duration: '5:20',
          status: 'draft',
          createdAt: '2024-01-13',
        },
        {
          id: '4',
          name: 'Eventos Especiais',
          description: 'Conteúdo para eventos e datas comemorativas',
          mediaCount: 12,
          duration: '22:15',
          status: 'paused',
          createdAt: '2024-01-12',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylistMedia = async (playlistId: string) => {
    try {
      // Simular carregamento de mídia da playlist
      setPlaylistMedia([
        {
          id: '1',
          name: 'Logo Empresa',
          type: 'image',
          duration: 5000,
          order: 1,
        },
        {
          id: '2',
          name: 'Promoção Verão',
          type: 'video',
          duration: 30000,
          order: 2,
        },
        {
          id: '3',
          name: 'Produto Novo',
          type: 'image',
          duration: 8000,
          order: 3,
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar mídia da playlist:', error);
    }
  };

  const handleAddPlaylist = () => {
    setEditingPlaylist(null);
    setOpenDialog(true);
  };

  const handleEditPlaylist = (playlist: PlaylistItem) => {
    setEditingPlaylist(playlist);
    setOpenDialog(true);
  };

  const handleDeletePlaylist = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta playlist?')) {
      try {
        // Implementar exclusão via API
        setPlaylists(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error('Erro ao excluir playlist:', error);
      }
    }
  };

  const handleManageMedia = (playlist: PlaylistItem) => {
    setSelectedPlaylist(playlist);
    loadPlaylistMedia(playlist.id);
    setOpenMediaDialog(true);
  };

  const handlePlaylistStatusChange = async (id: string, status: string) => {
    try {
      // Implementar mudança de status via API
      setPlaylists(prev => prev.map(item => 
        item.id === id ? { ...item, status: status as any } : item
      ));
    } catch (error) {
      console.error('Erro ao alterar status da playlist:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'draft': return 'warning';
      case 'paused': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'draft': return 'Rascunho';
      case 'paused': return 'Pausada';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <PlayArrow />;
      case 'draft': return <Edit />;
      case 'paused': return <Pause />;
      default: return <Stop />;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Carregando Playlists...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Gerenciamento de Playlists
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddPlaylist}
        >
          Nova Playlist
        </Button>
      </Box>

      <Grid container spacing={3}>
        {playlists.map((playlist) => (
          <Grid item xs={12} md={6} lg={4} key={playlist.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {playlist.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {playlist.description}
                    </Typography>
                  </Box>
                  <IconButton size="small">
                    <MoreVert />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    icon={getStatusIcon(playlist.status)}
                    label={getStatusLabel(playlist.status)}
                    color={getStatusColor(playlist.status) as any}
                    size="small"
                  />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {playlist.mediaCount} itens
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {playlist.duration}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleEditPlaylist(playlist)}
                  >
                    <Edit sx={{ mr: 0.5 }} />
                    Editar
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleManageMedia(playlist)}
                  >
                    <Schedule sx={{ mr: 0.5 }} />
                    Mídia
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    color="error"
                  >
                    <Delete sx={{ mr: 0.5 }} />
                    Excluir
                  </Button>
                </Box>

                {playlist.lastPlayed && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Última reprodução: {playlist.lastPlayed}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialog para adicionar/editar playlist */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPlaylist ? 'Editar Playlist' : 'Nova Playlist'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nome da Playlist"
                  defaultValue={editingPlaylist?.name || ''}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descrição"
                  multiline
                  rows={3}
                  defaultValue={editingPlaylist?.description || ''}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => setOpenDialog(false)}>
            {editingPlaylist ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para gerenciar mídia da playlist */}
      <Dialog open={openMediaDialog} onClose={() => setOpenMediaDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Gerenciar Mídia - {selectedPlaylist?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Itens da Playlist ({playlistMedia.length})
              </Typography>
              <Button variant="outlined" startIcon={<Add />}>
                Adicionar Mídia
              </Button>
            </Box>

            <List>
              {playlistMedia.map((item, index) => (
                <ListItem key={item.id} divider>
                  <DragIndicator sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText
                    primary={item.name}
                    secondary={`${item.type} • ${Math.floor(item.duration / 1000)}s`}
                  />
                  <ListItemSecondaryAction>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton size="small">
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error">
                        <Delete />
                      </IconButton>
                    </Box>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMediaDialog(false)}>
            Fechar
          </Button>
          <Button variant="contained" onClick={() => setOpenMediaDialog(false)}>
            Salvar Alterações
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};