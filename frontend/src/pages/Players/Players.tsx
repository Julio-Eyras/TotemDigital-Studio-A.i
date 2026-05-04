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
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Computer,
  LocationOn,
  PlayArrow,
  Stop,
  Refresh,
  MoreVert,
  CheckCircle,
  Warning,
  Error,
  Wifi,
  WifiOff,
} from '@mui/icons-material';
import { playerApi, Player, CreatePlayerRequest, playlistApi, PlaylistItem } from '../../services/api';
import { getTotemIdFromRow } from '../../utils/totemRowIds';

const Players: React.FC = () => {
  const theme = useTheme();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [newPlayer, setNewPlayer] = useState<CreatePlayerRequest>({
    identifier: '',
    localId: 0,
    name: '',
    location: '',
    subscriberId: undefined,
  });

  useEffect(() => {
    loadPlayers();
    loadPlaylists();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await playerApi.getAll({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setPlayers(response.data);
    } catch (error) {
      console.error('Erro ao carregar players:', error);
      setError('Erro ao carregar lista de players');
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylists = async () => {
    try {
      const response = await playlistApi.getAll();
      setPlaylists(response.data);
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
    }
  };

  const handleCreatePlayer = async () => {
    try {
      await playerApi.create(newPlayer);
      setCreateDialogOpen(false);
      setNewPlayer({ identifier: '', localId: 0, name: '', location: '', subscriberId: undefined });
      loadPlayers();
    } catch (error) {
      console.error('Erro ao criar player:', error);
      setError('Erro ao criar player');
    }
  };

  const handleEditPlayer = async () => {
    if (!selectedPlayer) return;
    
    try {
      const pid = getTotemIdFromRow(selectedPlayer as Record<string, unknown>) ?? selectedPlayer.totem_id;
      await playerApi.update(pid, {
        name: selectedPlayer.name,
        location: selectedPlayer.location,
        subscriberId: selectedPlayer.subscriber_id || (selectedPlayer as any).subscriberId,
        isActive: selectedPlayer.is_active,
      });
      setEditDialogOpen(false);
      setSelectedPlayer(null);
      loadPlayers();
    } catch (error) {
      console.error('Erro ao atualizar player:', error);
      setError('Erro ao atualizar player');
    }
  };

  const handleDeletePlayer = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este player?')) {
      try {
        await playerApi.delete(id);
        loadPlayers();
      } catch (error) {
        console.error('Erro ao excluir player:', error);
        setError('Erro ao excluir player');
      }
    }
  };

  const handleAssignPlaylist = async (playlistId: number) => {
    if (!selectedPlayer) return;
    
    try {
      const pid = getTotemIdFromRow(selectedPlayer as Record<string, unknown>) ?? selectedPlayer.totem_id;
      await playerApi.assignPlaylist(pid, playlistId);
      setAssignDialogOpen(false);
      setSelectedPlayer(null);
      loadPlayers();
    } catch (error) {
      console.error('Erro ao atribuir playlist:', error);
      setError('Erro ao atribuir playlist');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi color="success" />;
      case 'offline':
        return <WifiOff color="error" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Warning color="warning" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return theme.palette.success.main;
      case 'offline':
        return theme.palette.error.main;
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.warning.main;
    }
  };

  const formatLastSeen = (lastHeartbeat?: string) => {
    if (!lastHeartbeat) return 'Nunca';
    
    const now = new Date();
    const lastSeen = new Date(lastHeartbeat);
    const diffInMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora mesmo';
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return `${Math.floor(diffInMinutes / 1440)}d atrás`;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando players...
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
            SmartvPlayer
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
            SmartvPlayers {'->'} Totem
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie seus players de sinalização digital
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
          Adicionar Player
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Computer sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">Todos</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                  <MenuItem value="offline">Offline</MenuItem>
                  <MenuItem value="error">Erro</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadPlayers}
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

      {/* Players Grid */}
      <Grid container spacing={3}>
        {players.map((player) => (
          <Grid
            item
            xs={12}
            sm={6}
            md={4}
            lg={3}
            key={getTotemIdFromRow(player as Record<string, unknown>) ?? player.identifier ?? 'player'}
          >
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
                    backgroundColor: alpha(getStatusColor(player.status), 0.1),
                    color: getStatusColor(player.status),
                  }}
                >
                  <Computer />
                </Avatar>
                
                <Chip
                  label={player.status.toUpperCase()}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(getStatusColor(player.status), 0.1),
                    color: getStatusColor(player.status),
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
                    {getStatusIcon(player.status)}
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      {formatLastSeen(player.last_heartbeat)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {player.name}
                </Typography>
                
                {player.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <LocationOn fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {player.location}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={player.is_active ? 'Ativo' : 'Inativo'}
                    size="small"
                    color={player.is_active ? 'success' : 'default'}
                    variant="outlined"
                  />
                  
                  <Box>
                    <Tooltip title="Atribuir Playlist">
                      <IconButton size="small" onClick={() => {
                        setSelectedPlayer(player);
                        setAssignDialogOpen(true);
                      }}>
                        <PlayArrow />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => {
                        setSelectedPlayer(player);
                        setEditDialogOpen(true);
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const id = getTotemIdFromRow(player as Record<string, unknown>) ?? player.totem_id;
                          handleDeletePlayer(id);
                        }}
                      >
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
      {players.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Computer sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhum player encontrado
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros players
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Adicionar Primeiro Player
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar Player</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome do Player"
            value={newPlayer.name}
            onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Localização"
            value={newPlayer.location}
            onChange={(e) => setNewPlayer({ ...newPlayer, location: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreatePlayer}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Player</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome do Player"
            value={selectedPlayer?.name || ''}
            onChange={(e) => setSelectedPlayer({ ...selectedPlayer!, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Localização"
            value={selectedPlayer?.location || ''}
            onChange={(e) => setSelectedPlayer({ ...selectedPlayer!, location: e.target.value })}
            margin="normal"
          />
          <FormControlLabel
            control={
              <Switch
                checked={selectedPlayer?.is_active || false}
                onChange={(e) => setSelectedPlayer({ ...selectedPlayer!, is_active: e.target.checked })}
              />
            }
            label="Player Ativo"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditPlayer}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Assign Playlist Dialog */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Atribuir Playlist</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Selecione uma playlist para o player: <strong>{selectedPlayer?.name}</strong>
          </Typography>
          <List>
            {playlists.map((playlist) => (
              <ListItem
                key={playlist.playlist_id}
                button
                onClick={() => handleAssignPlaylist(playlist.playlist_id)}
              >
                <ListItemText
                  primary={playlist.name}
                  secondary={playlist.description}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end">
                    <PlayArrow />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancelar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Players;