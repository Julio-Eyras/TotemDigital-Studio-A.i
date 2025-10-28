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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Devices,
  LocationOn,
  PlayArrow,
  Pause,
  Stop,
  Warning,
  CheckCircle,
  MoreVert,
  Schedule,
  Refresh,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { playerApi, Player, CreatePlayerRequest, PlaylistItem } from '../../services/api';

export const Players: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [openPlaylistDialog, setOpenPlaylistDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [formData, setFormData] = useState<CreatePlayerRequest>({
    name: '',
    location: '',
  });

  useEffect(() => {
    loadPlayers();
    loadPlaylists();
  }, []);

  const loadPlayers = async () => {
    try {
      setIsLoading(true);
      
      // Simular carregamento de dados (substituir por chamadas reais da API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPlayers([
        {
          totem_id: 1,
          name: 'Player Loja Centro',
          location: 'Entrada Principal',
          client_id: 1,
          is_active: true,
          last_heartbeat: '2024-01-20 14:30:00',
          current_playlist_id: 1,
          status: 'online',
          created_at: '2024-01-01 00:00:00',
          updated_at: '2024-01-20 14:30:00',
        },
        {
          totem_id: 2,
          name: 'Player Loja Norte',
          location: 'Corredor Principal',
          client_id: 1,
          is_active: true,
          last_heartbeat: '2024-01-20 14:25:00',
          current_playlist_id: 2,
          status: 'online',
          created_at: '2024-01-05 09:00:00',
          updated_at: '2024-01-20 14:25:00',
        },
        {
          totem_id: 3,
          name: 'Player Loja Sul',
          location: 'Área de Vendas',
          client_id: 2,
          is_active: true,
          last_heartbeat: '2024-01-20 10:15:00',
          status: 'offline',
          created_at: '2024-01-10 14:30:00',
          updated_at: '2024-01-20 10:15:00',
        },
        {
          totem_id: 4,
          name: 'Player Shopping',
          location: 'Praça de Alimentação',
          client_id: 3,
          is_active: false,
          last_heartbeat: '2024-01-15 11:20:00',
          status: 'error',
          created_at: '2024-01-12 08:15:00',
          updated_at: '2024-01-15 11:20:00',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar players:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylists = async () => {
    try {
      // Simular carregamento de playlists
      setPlaylists([
        {
          playlist_id: 1,
          name: 'Horário Comercial',
          description: 'Playlist para horário comercial',
          is_active: true,
          created_at: '2024-01-15 00:00:00',
          updated_at: '2024-01-20 14:30:00',
        },
        {
          playlist_id: 2,
          name: 'Promoções',
          description: 'Conteúdo promocional',
          is_active: true,
          created_at: '2024-01-14 00:00:00',
          updated_at: '2024-01-19 16:45:00',
        },
      ]);
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
    }
  };

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setFormData({
      name: '',
      location: '',
    });
    setOpenDialog(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      location: player.location || '',
    });
    setOpenDialog(true);
  };

  const handleDeletePlayer = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este player?')) {
      try {
        // Implementar exclusão via API
        setPlayers(prev => prev.filter(item => item.totem_id !== id));
      } catch (error) {
        console.error('Erro ao excluir player:', error);
      }
    }
  };

  const handleSavePlayer = async () => {
    try {
      if (editingPlayer) {
        // Atualizar player existente
        const updatedPlayer = await playerApi.update(editingPlayer.totem_id, formData);
        setPlayers(prev => prev.map(item => 
          item.totem_id === editingPlayer.totem_id ? updatedPlayer : item
        ));
      } else {
        // Criar novo player
        const newPlayer = await playerApi.create(formData);
        setPlayers(prev => [...prev, newPlayer]);
      }
      setOpenDialog(false);
    } catch (error) {
      console.error('Erro ao salvar player:', error);
    }
  };

  const handleAssignPlaylist = (player: Player) => {
    setSelectedPlayer(player);
    setOpenPlaylistDialog(true);
  };

  const handlePlaylistAssignment = async (playlistId: number) => {
    if (selectedPlayer) {
      try {
        await playerApi.assignPlaylist(selectedPlayer.totem_id, playlistId);
        setPlayers(prev => prev.map(item => 
          item.totem_id === selectedPlayer.totem_id 
            ? { ...item, current_playlist_id: playlistId }
            : item
        ));
        setOpenPlaylistDialog(false);
      } catch (error) {
        console.error('Erro ao atribuir playlist:', error);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleStatusChange = async (id: number, isActive: boolean) => {
    try {
      // Implementar mudança de status via API
      setPlayers(prev => prev.map(item => 
        item.totem_id === id ? { ...item, is_active: isActive } : item
      ));
    } catch (error) {
      console.error('Erro ao alterar status do player:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle color="success" />;
      case 'offline': return <Warning color="warning" />;
      case 'error': return <Warning color="error" />;
      default: return <Stop color="default" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'error': return 'Erro';
      default: return status;
    }
  };

  const getTimeSinceLastHeartbeat = (lastHeartbeat: string) => {
    const now = new Date();
    const heartbeat = new Date(lastHeartbeat);
    const diffMs = now.getTime() - heartbeat.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} dias atrás`;
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Carregando Players...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Gerenciamento de Players
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadPlayers}
          >
            Atualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddPlayer}
          >
            Novo Player
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {players.map((player) => (
          <Grid item xs={12} md={6} lg={4} key={player.totem_id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Devices sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">
                      {player.name}
                    </Typography>
                  </Box>
                  <IconButton size="small">
                    <MoreVert />
                  </IconButton>
                </Box>

                {player.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <LocationOn sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {player.location}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    icon={getStatusIcon(player.status)}
                    label={getStatusLabel(player.status)}
                    color={getStatusColor(player.status) as any}
                    size="small"
                  />
                  <Chip
                    label={player.is_active ? 'Ativo' : 'Inativo'}
                    color={player.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </Box>

                {player.last_heartbeat && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Último heartbeat: {getTimeSinceLastHeartbeat(player.last_heartbeat)}
                  </Typography>
                )}

                {player.current_playlist_id && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Playlist atual: {playlists.find(p => p.playlist_id === player.current_playlist_id)?.name || 'N/A'}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleEditPlayer(player)}
                  >
                    <Edit sx={{ mr: 0.5 }} />
                    Editar
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleAssignPlaylist(player)}
                  >
                    <Schedule sx={{ mr: 0.5 }} />
                    Playlist
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleDeletePlayer(player.totem_id)}
                    color="error"
                  >
                    <Delete sx={{ mr: 0.5 }} />
                    Excluir
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={player.is_active}
                        onChange={(e) => handleStatusChange(player.totem_id, e.target.checked)}
                        size="small"
                      />
                    }
                    label="Ativo"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialog para adicionar/editar player */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPlayer ? 'Editar Player' : 'Novo Player'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nome do Player"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Localização"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSavePlayer}>
            {editingPlayer ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para atribuir playlist */}
      <Dialog open={openPlaylistDialog} onClose={() => setOpenPlaylistDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Atribuir Playlist - {selectedPlayer?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Selecione uma playlist para atribuir ao player:
            </Typography>
            <List>
              {playlists.map((playlist) => (
                <ListItem
                  key={playlist.playlist_id}
                  button
                  onClick={() => handlePlaylistAssignment(playlist.playlist_id)}
                  selected={selectedPlayer?.current_playlist_id === playlist.playlist_id}
                >
                  <ListItemIcon>
                    <Schedule />
                  </ListItemIcon>
                  <ListItemText
                    primary={playlist.name}
                    secondary={playlist.description}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPlaylistDialog(false)}>
            Cancelar
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB para adicionar player */}
      <Tooltip title="Adicionar Player">
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={handleAddPlayer}
        >
          <Add />
        </Fab>
      </Tooltip>
    </Box>
  );
};
