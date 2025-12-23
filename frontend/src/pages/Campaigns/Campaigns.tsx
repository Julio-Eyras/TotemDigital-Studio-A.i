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
  Autocomplete,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Campaign as CampaignIcon,
  CalendarToday,
  People,
  PlayArrow,
  Stop,
  Refresh,
  CheckCircle,
  Warning,
  Error,
} from '@mui/icons-material';
import { campaignApi, Campaign, CreateCampaignRequest, UpdateCampaignRequest, clientApi, Client, playlistApi, PlaylistItem, playerApi, Player } from '../../services/api';

const Campaigns: React.FC = () => {
  const theme = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [newCampaign, setNewCampaign] = useState<CreateCampaignRequest>({
    title: '',
    description: '',
    campaign_type: 'standard',
    status: 'draft',
    clientId: undefined,
    start_date: '',
    end_date: '',
    playlistIds: [],
    totemIds: [],
    // Novos campos comerciais (frontend envia para backend usar comercial_tier e time_share)
    commercial_tier: 'standard' as any,
    default_time_share_percent: 0,
    max_consecutive_slots: 2,
  } as any);

  useEffect(() => {
    loadCampaigns();
    loadClients();
    loadPlaylists();
    loadPlayers();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await campaignApi.getAll({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      // Normalizar dados do backend (campaignType -> campaign_type)
      const normalizedCampaigns = (response.data || []).map((campaign: any) => ({
        ...campaign,
        campaign_type: campaign.campaign_type || campaign.campaignType || 'standard',
        status: campaign.status || 'draft',
        client_id: campaign.client_id || campaign.clientId,
        start_date: campaign.start_date || campaign.startDate,
        end_date: campaign.end_date || campaign.endDate,
        is_active: campaign.is_active !== undefined ? campaign.is_active : (campaign.isActive !== undefined ? campaign.isActive : true),
        created_at: campaign.created_at || campaign.createdAt,
        updated_at: campaign.updated_at || campaign.updatedAt,
      }));
      setCampaigns(normalizedCampaigns);
    } catch (error: any) {
      console.error('Erro ao carregar campanhas:', error);
      const errorMessage = error?.response?.data?.message 
        || error?.message 
        || 'Erro ao carregar lista de campanhas';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const response = await clientApi.getAll();
      setClients(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadPlaylists = async () => {
    try {
      const response = await playlistApi.getAll();
      setPlaylists(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await playerApi.getAll();
      setPlayers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar players:', error);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      setError(null); // Limpar erro anterior
      const createdCampaign = await campaignApi.create(newCampaign as any);
      console.log('Campanha criada com sucesso:', createdCampaign);
      
      // Fechar diálogo e limpar formulário
      setCreateDialogOpen(false);
      setNewCampaign({
        title: '',
        description: '',
        campaign_type: 'standard',
        status: 'draft',
        clientId: undefined,
        start_date: '',
        end_date: '',
        playlistIds: [],
        totemIds: [],
        commercial_tier: 'standard' as any,
        default_time_share_percent: 0,
        max_consecutive_slots: 2,
      } as any);
      
      // Recarregar lista de campanhas
      await loadCampaigns();
    } catch (error: any) {
      console.error('Erro ao criar campanha:', error);
      // Extrair mensagem de erro específica da resposta da API
      const errorMessage = error?.response?.data?.message 
        || error?.response?.data?.error 
        || error?.message 
        || 'Erro ao criar campanha. Verifique os dados e tente novamente.';
      setError(errorMessage);
    }
  };

  const handleEditCampaign = async () => {
    if (!selectedCampaign) return;
    
    try {
      const updateData: UpdateCampaignRequest = {
        title: selectedCampaign.title,
        description: selectedCampaign.description,
        campaign_type: selectedCampaign.campaign_type || (selectedCampaign as any).campaignType || 'standard',
        status: selectedCampaign.status || 'draft',
        clientId: selectedCampaign.client_id || (selectedCampaign as any).clientId,
        start_date: selectedCampaign.start_date || (selectedCampaign as any).startDate,
        end_date: selectedCampaign.end_date || (selectedCampaign as any).endDate,
        isActive: selectedCampaign.is_active !== undefined ? selectedCampaign.is_active : ((selectedCampaign as any).isActive !== undefined ? (selectedCampaign as any).isActive : true),
        // Campos comerciais
        commercial_tier: (selectedCampaign as any).commercial_tier || 'standard',
        default_time_share_percent: (selectedCampaign as any).default_time_share_percent ?? 0,
        max_consecutive_slots: (selectedCampaign as any).max_consecutive_slots ?? 2,
      } as any;
      await campaignApi.update(selectedCampaign.campaign_id, updateData);
      setEditDialogOpen(false);
      setSelectedCampaign(null);
      await loadCampaigns();
    } catch (error: any) {
      console.error('Erro ao atualizar campanha:', error);
      const errorMessage = error?.response?.data?.message 
        || error?.response?.data?.error 
        || error?.message 
        || 'Erro ao atualizar campanha';
      setError(errorMessage);
    }
  };

  const handleDeleteCampaign = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta campanha?')) {
      try {
        await campaignApi.delete(id);
        loadCampaigns();
      } catch (error) {
        console.error('Erro ao excluir campanha:', error);
        setError('Erro ao excluir campanha');
      }
    }
  };

  const getStatusColor = (status: string) => {
    if (!status) return theme.palette.primary.main;
    switch (status.toLowerCase()) {
      case 'active':
        return theme.palette.success.main;
      case 'draft':
        return theme.palette.warning.main;
      case 'completed':
        return theme.palette.info.main;
      case 'cancelled':
        return theme.palette.error.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const getStatusIcon = (status: string) => {
    if (!status) return <CampaignIcon />;
    switch (status.toLowerCase()) {
      case 'active':
        return <PlayArrow />;
      case 'draft':
        return <Edit />;
      case 'completed':
        return <CheckCircle />;
      case 'cancelled':
        return <Stop />;
      default:
        return <CampaignIcon />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando campanhas...
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
            Campanhas
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie campanhas, playlists, agendamentos e prioridades comerciais (tier, share de tempo).
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
          Criar Campanha
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar campanhas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <CampaignIcon sx={{ mr: 1, color: theme.palette.text.secondary }} />,
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
                  <MenuItem value="active">Ativa</MenuItem>
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="completed">Concluída</MenuItem>
                  <MenuItem value="cancelled">Cancelada</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadCampaigns}
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

      {/* Campaigns Grid */}
      <Grid container spacing={3}>
        {campaigns.map((campaign) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={campaign.campaign_id}>
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
                    backgroundColor: alpha(getStatusColor(campaign.status || 'draft'), 0.1),
                    color: getStatusColor(campaign.status || 'draft'),
                  }}
                >
                  {getStatusIcon(campaign.status || 'draft')}
                </Avatar>
                
                <Chip
                  label={(campaign.status || 'draft').toUpperCase()}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(getStatusColor(campaign.status || 'draft'), 0.1),
                    color: getStatusColor(campaign.status || 'draft'),
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
                    {(campaign.campaign_type || (campaign as any).campaignType || 'standard').toUpperCase()}
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {campaign.title}
                </Typography>
                
                {campaign.description && (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }} noWrap>
                    {campaign.description}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarToday fontSize="small" color="action" />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      Início: {formatDate(campaign.start_date || (campaign as any).startDate)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CalendarToday fontSize="small" color="action" />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      Fim: {formatDate(campaign.end_date || (campaign as any).endDate)}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip
                    label={(campaign.is_active !== undefined ? campaign.is_active : ((campaign as any).isActive !== undefined ? (campaign as any).isActive : true)) ? 'Ativa' : 'Inativa'}
                    size="small"
                    color={(campaign.is_active !== undefined ? campaign.is_active : ((campaign as any).isActive !== undefined ? (campaign as any).isActive : true)) ? 'success' : 'default'}
                    variant="outlined"
                  />
                  
                  <Box>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => {
                        setSelectedCampaign(campaign);
                        setEditDialogOpen(true);
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeleteCampaign(campaign.campaign_id)}>
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
      {campaigns.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <CampaignIcon sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhuma campanha encontrada
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece criando suas primeiras campanhas
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Criar Primeira Campanha
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Criar Campanha</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Título"
            value={newCampaign.title}
            onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Descrição"
            value={newCampaign.description}
            onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo de Campanha</InputLabel>
            <Select
              value={newCampaign.campaign_type}
              onChange={(e) => setNewCampaign({ ...newCampaign, campaign_type: e.target.value })}
              label="Tipo de Campanha"
            >
              <MenuItem value="standard">Padrão</MenuItem>
              <MenuItem value="promotional">Promocional</MenuItem>
              <MenuItem value="informational">Informativa</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={newCampaign.status}
              onChange={(e) => setNewCampaign({ ...newCampaign, status: e.target.value })}
              label="Status"
            >
              <MenuItem value="draft">Rascunho</MenuItem>
              <MenuItem value="active">Ativa</MenuItem>
              <MenuItem value="completed">Concluída</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Cliente</InputLabel>
            <Select
              value={newCampaign.clientId || ''}
              onChange={(e) => {
                const value = e.target.value;
                setNewCampaign({ 
                  ...newCampaign, 
                  clientId: value && value !== '' ? parseInt(String(value), 10) : undefined 
                });
              }}
              label="Cliente"
            >
              <MenuItem value="">Nenhum</MenuItem>
              {clients.map((client) => (
                <MenuItem key={client.client_id} value={client.client_id}>
                  {client.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Data de Início"
            type="date"
            value={newCampaign.start_date}
            onChange={(e) => setNewCampaign({ ...newCampaign, start_date: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="Data de Término"
            type="date"
            value={newCampaign.end_date}
            onChange={(e) => setNewCampaign({ ...newCampaign, end_date: e.target.value })}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <Autocomplete
            multiple
            options={playlists}
            getOptionLabel={(option) => option.name}
            value={playlists.filter(p => newCampaign.playlistIds?.includes(p.playlist_id))}
            onChange={(_, newValue) => {
              setNewCampaign({ ...newCampaign, playlistIds: newValue.map(p => p.playlist_id) });
            }}
            renderInput={(params) => (
              <TextField {...params} label="Playlists" margin="normal" />
            )}
          />
          <Autocomplete
            multiple
            options={players}
            getOptionLabel={(option) => option.name || option.identifier || option.uin || `Totem ${option.totem_id}`}
            value={players.filter(p => newCampaign.totemIds?.includes(p.totem_id))}
            onChange={(_, newValue) => {
              setNewCampaign({ ...newCampaign, totemIds: newValue.map(p => p.totem_id) });
            }}
            renderInput={(params) => (
              <TextField {...params} label="SmartvPlayers → Totem" margin="normal" />
            )}
          />
          
          {/* Campos Comerciais */}
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: theme.palette.primary.main }}>
              Configurações Comerciais
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel>Nível Comercial (Tier)</InputLabel>
              <Select
                value={(newCampaign as any).commercial_tier || 'standard'}
                onChange={(e) => setNewCampaign({ ...newCampaign, commercial_tier: e.target.value } as any)}
                label="Nível Comercial (Tier)"
              >
                <MenuItem value="premium">Premium</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="remnant">Remnant</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Share de Tempo Padrão (%)"
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              value={(newCampaign as any).default_time_share_percent || 0}
              onChange={(e) => setNewCampaign({ 
                ...newCampaign, 
                default_time_share_percent: parseFloat(e.target.value) || 0 
              } as any)}
              margin="normal"
              helperText="Percentual de tempo padrão que esta campanha deve ocupar no mix (0-100%)"
            />
            <TextField
              fullWidth
              label="Máximo de Slots Consecutivos"
              type="number"
              inputProps={{ min: 1, max: 10 }}
              value={(newCampaign as any).max_consecutive_slots || 2}
              onChange={(e) => setNewCampaign({ 
                ...newCampaign, 
                max_consecutive_slots: parseInt(e.target.value) || 2 
              } as any)}
              margin="normal"
              helperText="Número máximo de itens desta campanha que podem aparecer consecutivamente"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreateCampaign}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Editar Campanha</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Título"
            value={selectedCampaign?.title || ''}
            onChange={(e) => setSelectedCampaign({ ...selectedCampaign!, title: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Descrição"
            value={selectedCampaign?.description || ''}
            onChange={(e) => setSelectedCampaign({ ...selectedCampaign!, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={selectedCampaign?.status || 'draft'}
              onChange={(e) => setSelectedCampaign({ ...selectedCampaign!, status: e.target.value })}
              label="Status"
            >
              <MenuItem value="draft">Rascunho</MenuItem>
              <MenuItem value="active">Ativa</MenuItem>
              <MenuItem value="completed">Concluída</MenuItem>
              <MenuItem value="cancelled">Cancelada</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={selectedCampaign?.is_active || false}
                onChange={(e) => setSelectedCampaign({ ...selectedCampaign!, is_active: e.target.checked })}
              />
            }
            label="Campanha Ativa"
          />
          
          {/* Campos Comerciais */}
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: theme.palette.primary.main }}>
              Configurações Comerciais
            </Typography>
            <FormControl fullWidth margin="normal">
              <InputLabel>Nível Comercial (Tier)</InputLabel>
              <Select
                value={(selectedCampaign as any)?.commercial_tier || 'standard'}
                onChange={(e) => setSelectedCampaign({ 
                  ...selectedCampaign!, 
                  commercial_tier: e.target.value 
                } as any)}
                label="Nível Comercial (Tier)"
              >
                <MenuItem value="premium">Premium</MenuItem>
                <MenuItem value="standard">Standard</MenuItem>
                <MenuItem value="remnant">Remnant</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Share de Tempo Padrão (%)"
              type="number"
              inputProps={{ min: 0, max: 100, step: 0.1 }}
              value={(selectedCampaign as any)?.default_time_share_percent || 0}
              onChange={(e) => setSelectedCampaign({ 
                ...selectedCampaign!, 
                default_time_share_percent: parseFloat(e.target.value) || 0 
              } as any)}
              margin="normal"
              helperText="Percentual de tempo padrão que esta campanha deve ocupar no mix (0-100%)"
            />
            <TextField
              fullWidth
              label="Máximo de Slots Consecutivos"
              type="number"
              inputProps={{ min: 1, max: 10 }}
              value={(selectedCampaign as any)?.max_consecutive_slots || 2}
              onChange={(e) => setSelectedCampaign({ 
                ...selectedCampaign!, 
                max_consecutive_slots: parseInt(e.target.value) || 2 
              } as any)}
              margin="normal"
              helperText="Número máximo de itens desta campanha que podem aparecer consecutivamente"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditCampaign}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Campaigns;
