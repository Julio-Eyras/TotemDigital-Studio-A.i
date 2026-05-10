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
  Tooltip,
  useTheme,
  alpha,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Business,
  Email,
  Phone,
  LocationOn,
  Refresh,
  MoreVert,
  CheckCircle,
  Warning,
  Error,
  People,
  Computer,
  QueueMusic,
  VideoLibrary,
} from '@mui/icons-material';
import { clientApi, Client, CreateClientRequest, userApi, User, playerApi, Player, playlistApi, PlaylistItem, mediaApi, MediaItem } from '../../services/api';

const Clients: React.FC = () => {
  const theme = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientStats, setClientStats] = useState<{
    users: User[];
    players: Player[];
    playlists: PlaylistItem[];
    media: MediaItem[];
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newClient, setNewClient] = useState<CreateClientRequest>({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await clientApi.getAll({
        search: searchTerm || undefined,
      });
      setClients(response.data);
    } catch (error) {
      setError('Erro ao carregar lista de assinantes');
    } finally {
      setLoading(false);
    }
  };

  const loadClientStats = async (clientId: number) => {
    try {
      // clientId aqui é na verdade subscriber_id (compatibilidade com código legado)
      const subscriberId = clientId;
      const [usersResponse, playersResponse, playlistsResponse, mediaResponse] = await Promise.all([
        userApi.getAll({ subscriberId }),
        playerApi.getAll({ subscriberId }),
        playlistApi.getAll({ subscriberId }),
        mediaApi.getAll({ subscriberId }),
      ]);

      setClientStats({
        users: usersResponse.data,
        players: playersResponse.data,
        playlists: playlistsResponse.data,
        media: mediaResponse.data,
      });
    } catch (error) {
    }
  };

  const handleCreateClient = async () => {
    try {
      await clientApi.create(newClient);
      setCreateDialogOpen(false);
      setNewClient({ name: '', contact_name: '', email: '', phone: '', whatsapp: '', address: '' });
      loadClients();
    } catch (error) {
      setError('Erro ao criar assinante');
    }
  };

  const handleEditClient = async () => {
    if (!selectedClient) return;
    
    try {
      await clientApi.update(selectedClient.client_id, {
        name: selectedClient.name,
        email: selectedClient.email,
        phone: selectedClient.phone,
        address: selectedClient.address,
        isActive: selectedClient.is_active,
      });
      setEditDialogOpen(false);
      setSelectedClient(null);
      loadClients();
    } catch (error) {
      setError('Erro ao atualizar assinante');
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este assinante?')) {
      try {
        await clientApi.delete(id);
        loadClients();
      } catch (error) {
        setError('Erro ao excluir assinante');
      }
    }
  };

  const handleViewDetails = async (client: Client) => {
    setSelectedClient(client);
    await loadClientStats(client.client_id);
    setDetailsDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando assinantes...
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
            Assinantes
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie seus assinantes e suas informações
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
          Adicionar Assinante
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                placeholder="Buscar assinantes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Business sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadClients}
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

      {/* Clients Grid */}
      <Grid container spacing={3}>
        {clients.map((client) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={client.client_id}>
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
                  <Business />
                </Avatar>
                
                <Chip
                  label={client.is_active ? 'Ativo' : 'Inativo'}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(client.is_active ? theme.palette.success.main : theme.palette.error.main, 0.1),
                    color: client.is_active ? theme.palette.success.main : theme.palette.error.main,
                    fontWeight: 'bold',
                  }}
                />

                <Box sx={{ 
                  position: 'absolute', 
                  bottom: 16, 
                  left: 16, 
                  right: 16,
                }}>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    Criado em {formatDate(client.created_at)}
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {client.name}
                </Typography>
                
                {client.contact_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      Contato: {client.contact_name}
                    </Typography>
                  </Box>
                )}

                {client.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Email fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {client.email}
                    </Typography>
                  </Box>
                )}

                {client.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {client.phone}
                    </Typography>
                  </Box>
                )}

                {client.whatsapp && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      WhatsApp: {client.whatsapp}
                    </Typography>
                  </Box>
                )}

                {client.address && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <LocationOn fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {client.address}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleViewDetails(client)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Detalhes
                  </Button>
                  
                  <Box>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => {
                        setSelectedClient(client);
                        setEditDialogOpen(true);
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeleteClient(client.client_id)}>
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
      {clients.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Business sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhum assinante encontrado
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros assinantes
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Adicionar Primeiro Assinante
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar Assinante</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome da Empresa"
            value={newClient.name}
            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Telefone"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Endereço"
            value={newClient.address}
            onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateClient}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Assinante</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome da Empresa / Razão Social"
            value={selectedClient?.name || ''}
            onChange={(e) => setSelectedClient({ ...selectedClient!, name: e.target.value })}
            margin="normal"
            required
            helperText="Nome completo da empresa ou razão social"
          />
          <TextField
            fullWidth
            label="Nome do Contato"
            value={selectedClient?.contact_name || ''}
            onChange={(e) => setSelectedClient({ ...selectedClient!, contact_name: e.target.value })}
            margin="normal"
            helperText="Nome da pessoa responsável pelo contato"
          />
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={selectedClient?.email || ''}
            onChange={(e) => setSelectedClient({ ...selectedClient!, email: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Telefone"
            value={selectedClient?.phone || ''}
            onChange={(e) => setSelectedClient({ ...selectedClient!, phone: e.target.value })}
            margin="normal"
            helperText="Telefone comercial (formato: +55 11 1234-5678)"
          />
          <TextField
            fullWidth
            label="WhatsApp"
            value={selectedClient?.whatsapp || ''}
            onChange={(e) => setSelectedClient({ ...selectedClient!, whatsapp: e.target.value })}
            margin="normal"
            helperText="Número do WhatsApp (formato: +55 11 98765-4321)"
          />
          <TextField
            fullWidth
            label="Endereço"
            value={selectedClient?.address || ''}
            onChange={(e) => setSelectedClient({ ...selectedClient!, address: e.target.value })}
            margin="normal"
            multiline
            rows={3}
            helperText="Endereço completo da empresa"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditClient}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Detalhes do Assinante - {selectedClient?.name}
        </DialogTitle>
        <DialogContent>
          {clientStats && (
            <Grid container spacing={3}>
              {/* Stats Cards */}
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <People sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {clientStats.users.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Usuários
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Computer sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {clientStats.players.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Players
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <QueueMusic sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {clientStats.playlists.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Playlists
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <VideoLibrary sx={{ fontSize: 40, color: theme.palette.error.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {clientStats.media.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Mídia
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Informações do Assinante */}
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Informações do Assinante
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableBody>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome da Empresa</TableCell>
                            <TableCell>{selectedClient?.name || 'N/A'}</TableCell>
                          </TableRow>
                          {selectedClient?.contact_name && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Nome do Contato</TableCell>
                              <TableCell>{selectedClient.contact_name}</TableCell>
                            </TableRow>
                          )}
                          {selectedClient?.email && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                              <TableCell>{selectedClient.email}</TableCell>
                            </TableRow>
                          )}
                          {selectedClient?.phone && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Telefone</TableCell>
                              <TableCell>{selectedClient.phone}</TableCell>
                            </TableRow>
                          )}
                          {selectedClient?.whatsapp && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>WhatsApp</TableCell>
                              <TableCell>{selectedClient.whatsapp}</TableCell>
                            </TableRow>
                          )}
                          {selectedClient?.address && (
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Endereço</TableCell>
                              <TableCell>{selectedClient.address}</TableCell>
                            </TableRow>
                          )}
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell>
                              <Chip
                                label={selectedClient?.is_active ? 'Ativo' : 'Inativo'}
                                size="small"
                                color={selectedClient?.is_active ? 'success' : 'error'}
                              />
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                            <TableCell>{selectedClient?.created_at ? formatDate(selectedClient.created_at) : 'N/A'}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                            <TableCell>{selectedClient?.updated_at ? formatDate(selectedClient.updated_at) : 'N/A'}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Users List */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Usuários ({clientStats.users.length})
                    </Typography>
                    <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {clientStats.users.map((user) => (
                        <ListItem key={user.user_id}>
                          <ListItemIcon>
                            <Avatar sx={{ width: 32, height: 32 }}>
                              <People />
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={user.name}
                            secondary={`@${user.username} - ${user.role}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Players List */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Players ({clientStats.players.length})
                    </Typography>
                    <List sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {clientStats.players.map((player) => (
                        <ListItem key={player.totem_id}>
                          <ListItemIcon>
                            <Avatar sx={{ 
                              width: 32, 
                              height: 32,
                              backgroundColor: alpha(
                                player.status === 'online' ? theme.palette.success.main : theme.palette.error.main, 
                                0.1
                              ),
                              color: player.status === 'online' ? theme.palette.success.main : theme.palette.error.main
                            }}>
                              <Computer />
                            </Avatar>
                          </ListItemIcon>
                          <ListItemText
                            primary={player.name}
                            secondary={`${player.location || 'Sem localização'} - ${player.status}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Clients;