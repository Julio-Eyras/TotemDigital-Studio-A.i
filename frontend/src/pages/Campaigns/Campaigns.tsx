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
  Tooltip,
  useTheme,
  alpha,
  LinearProgress,
  Alert,
  Switch,
  FormControlLabel,
  Autocomplete,
  Tabs,
  Tab,
  Snackbar,
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
  VideoLibrary,
} from '@mui/icons-material';
import { campaignApi, Campaign, CreateCampaignRequest, UpdateCampaignRequest, clientApi, Client, subscriberApi, Subscriber, playlistApi, PlaylistItem, playerApi, Player, publisherApi, Publisher, subscriberAccessApi, AccessiblePublisher, mediaApi, MediaItem } from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { useLocation } from 'react-router-dom';
import { SortableList } from '../../components/SortableList/SortableList';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { CampaignCard, CampaignForm, CampaignDetails } from './components';

interface PublisherOption {
  publisher_id: number;
  name: string;
  email?: string;
}

const Campaigns: React.FC = () => {
  const theme = useTheme();
  const breadcrumbs = useBreadcrumbs();
  const location = useLocation() as { state?: { highlightId?: number } };
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]); // NOVO: Para mídias diretas
  const [players, setPlayers] = useState<Player[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [accessiblePublishers, setAccessiblePublishers] = useState<AccessiblePublisher[]>([]);
  const [loading, setLoading] = useState(true);
  
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin = user?.role === 'admin' || user?.role === 'admin_sql';
  const userSubscriberId = user?.subscriberId;

  // Converter publishers para formato comum
  const getPublisherOptions = (): PublisherOption[] => {
    if (isAdmin) {
      return publishers.map(p => ({
        publisher_id: p.publisher_id,
        name: p.name,
        email: p.email
      }));
    }
    if (!Array.isArray(accessiblePublishers)) {
      return [];
    }
    return accessiblePublishers.map(ap => ({
      publisher_id: ap.publisher_id,
      name: ap.publisher_name || '',
      email: ap.publisher_email
    }));
  };
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [editTab, setEditTab] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [orderedMediaIds, setOrderedMediaIds] = useState<number[]>([]);
  const [orderedPlaylistIds, setOrderedPlaylistIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({ open: false, message: '', severity: 'success' });

  // Derivados para abas Totens/Smart TVs (impacto da seleção de publishers)
  const [derivedTotems, setDerivedTotems] = useState<any[]>([]);
  const [derivedSmartTvs, setDerivedSmartTvs] = useState<any[]>([]);
  const [derivedDevicesLoading, setDerivedDevicesLoading] = useState(false);
  const [newCampaign, setNewCampaign] = useState<CreateCampaignRequest>({
    title: '',
    categorySegment: '',
    description: '',
    campaign_type: 'general',
    status: 'draft',
    subscriberId: undefined,
    start_date: '',
    end_date: '',
    playlistIds: [],
    totemIds: [],
    publisherIds: [], // Publishers onde a campanha será exibida
    mediaIds: [], // NOVO: Mídias diretas (sem playlist)
    // Novos campos comerciais (frontend envia para backend usar comercial_tier e time_share)
    commercial_tier: 'standard' as any,
    default_time_share_percent: 0,
    max_consecutive_slots: 2,
  } as any);

  useEffect(() => {
    loadCampaigns();
    loadClients();
    loadPlaylists();
    loadMediaItems(); // NOVO: Carregar mídias
  }, []);

  useEffect(() => {
    if (location.state?.highlightId) {
      setHighlightId(location.state.highlightId);
    }
  }, [location.state]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, campaigns]);

  // Inicializar ordem quando abrir diálogo de edição
  useEffect(() => {
    if (selectedCampaign && editDialogOpen) {
      // Manter ordem das mídias e playlists
      setOrderedMediaIds(selectedCampaign.mediaIds || []);
      setOrderedPlaylistIds(selectedCampaign.playlistIds || []);
      setEditTab(0);
    } else if (!editDialogOpen) {
      // Limpar ordem quando fechar diálogo
      setOrderedMediaIds([]);
      setOrderedPlaylistIds([]);
      setDerivedTotems([]);
      setDerivedSmartTvs([]);
    }
  }, [selectedCampaign, editDialogOpen]);

  const getSelectedPublisherIds = (): number[] => {
    if (!selectedCampaign) return [];
    return (((selectedCampaign as any).publisherIds || []) as number[]).filter((x) => typeof x === 'number');
  };

  const loadDerivedDevices = async () => {
    if (!selectedCampaign) return;
    const publisherIds = getSelectedPublisherIds();
    if (publisherIds.length === 0) {
      setDerivedTotems([]);
      setDerivedSmartTvs([]);
      return;
    }

    try {
      setDerivedDevicesLoading(true);
      const results = await Promise.all(
        publisherIds.map(async (publisherId) => {
          const [totems, tvs] = await Promise.all([
            publisherApi.getTotems(publisherId),
            publisherApi.getSmartTvs(publisherId),
          ]);
          return { publisherId, totems, tvs };
        })
      );

      const allTotems = results.flatMap(r => r.totems || []);
      const allTvs = results.flatMap(r => r.tvs || []);

      const uniqBy = (items: any[], key: string) => {
        const map = new Map<any, any>();
        for (const it of items) {
          const k = it?.[key];
          if (k !== undefined && k !== null) map.set(k, it);
        }
        return Array.from(map.values());
      };

      setDerivedTotems(uniqBy(allTotems, 'totem_id'));
      setDerivedSmartTvs(uniqBy(allTvs, 'smart_tv_id'));
    } catch (e) {
      console.error('Erro ao carregar totems/smart TVs derivados:', e);
      setDerivedTotems([]);
      setDerivedSmartTvs([]);
    } finally {
      setDerivedDevicesLoading(false);
    }
  };

  // Carregar devices derivados quando entrar nas abas Totens/Smart TVs
  useEffect(() => {
    if (!editDialogOpen) return;
    // 4 = Totens, 5 = Smart TVs (ver Tabs abaixo)
    if (editTab === 4 || editTab === 5) {
      loadDerivedDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTab, editDialogOpen, selectedCampaign]);

  useEffect(() => {
    loadPlayers();
    loadPublishers();
    if (userSubscriberId) {
      loadAccessiblePublishers(userSubscriberId);
    }
  }, [userSubscriberId]);

  const normalizeCampaignType = (raw: any): string => {
    const v = String(raw ?? '').trim().toLowerCase();
    // Aceitos no DB: general, scheduled, interactive, recurring
    if (['general', 'scheduled', 'interactive', 'recurring'].includes(v)) return v;
    // Valores legacy do frontend -> mapear para um tipo válido
    if (['standard', 'promotional', 'informational'].includes(v)) return 'general';
    return 'general';
  };

  const normalizeCampaign = (campaign: any) => {
    if (!campaign) return campaign;
    return {
      ...campaign,
      // Compat de ID (backend v2 usa "id")
      campaign_id: campaign.campaign_id ?? campaign.campaignId ?? campaign.id,
      // Compat de subscriber/cliente
      subscriber_id: campaign.subscriber_id ?? campaign.subscriberId ?? campaign.clientId,
      // Compat de datas
      start_date: campaign.start_date ?? campaign.startDate,
      end_date: campaign.end_date ?? campaign.endDate,
      // Compat de tipo/status/ativo
      campaign_type: normalizeCampaignType(campaign.campaign_type ?? campaign.campaignType),
      status: campaign.status ?? 'draft',
      is_active:
        campaign.is_active !== undefined
          ? campaign.is_active
          : campaign.isActive !== undefined
            ? campaign.isActive
            : true,
      created_at: campaign.created_at ?? campaign.createdAt,
      updated_at: campaign.updated_at ?? campaign.updatedAt,
    };
  };

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await campaignApi.getAll({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      // campaignApi.getAll retorna um array de Campaign já normalizado
      const campaignsArray = Array.isArray(response) ? response : [];
      const normalizedCampaigns = campaignsArray.map(normalizeCampaign);
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
      const response = await clientApi.getAll({ limit: 1000 });
      const list = Array.isArray(response?.data) ? response.data : [];
      setClients(list);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setClients([]);
    }
  };

  const loadPlaylists = async () => {
    try {
      // Filtrar playlists por subscriber se não for admin
      const subscriberId = !isAdmin && userSubscriberId ? userSubscriberId : undefined;
      const response = await playlistApi.getAll({
        subscriberId: subscriberId,
      });
      setPlaylists(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar playlists:', error);
    }
  };

  const loadMediaItems = async () => {
    try {
      // Filtrar mídias por subscriber se não for admin
      const subscriberId = !isAdmin && userSubscriberId ? userSubscriberId : undefined;
      const response = await mediaApi.getAll({
        subscriberId: subscriberId,
      });
      setMediaItems(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar mídias:', error);
      setMediaItems([]);
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

  const loadPublishers = async () => {
    try {
      const response = await publisherApi.getAll({ active_only: true });
      setPublishers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar publishers:', error);
    }
  };

  const loadAccessiblePublishers = async (subscriberId: number) => {
    try {
      const accessible = await subscriberAccessApi.getAccessiblePublishers(subscriberId);
      setAccessiblePublishers(accessible);
    } catch (error) {
      console.error('Erro ao carregar publishers acessíveis:', error);
    }
  };

  const handleCreateCampaign = async () => {
    try {
      setError(null); // Limpar erro anterior
      
      // Validar acesso a publishers antes de criar (para não-admins)
      if (!isAdmin && newCampaign.publisherIds && newCampaign.publisherIds.length > 0 && newCampaign.subscriberId) {
        const accessiblePublisherIds = accessiblePublishers.map(ap => ap.publisher_id);
        const invalidPublishers = newCampaign.publisherIds.filter(id => !accessiblePublisherIds.includes(id));
        
        if (invalidPublishers.length > 0) {
          setError(`Você não tem acesso aos seguintes publishers: ${invalidPublishers.join(', ')}. Verifique seu contrato e plano.`);
          return;
        }
      }
      
      const createdCampaign = await campaignApi.create(newCampaign as any);
      // Fechar diálogo e limpar formulário
      setCreateDialogOpen(false);
      setSnackbar({ open: true, message: 'Campanha criada com sucesso!', severity: 'success' });
      setNewCampaign({
        title: '',
        categorySegment: '',
        description: '',
        campaign_type: 'general',
        status: 'draft',
        subscriberId: undefined,
        start_date: '',
        end_date: '',
        playlistIds: [],
        totemIds: [],
        publisherIds: [],
        mediaIds: [], // NOVO
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

  // Função para reordenar mídias
  const handleReorderMedias = async (newOrder: number[]) => {
    if (!selectedCampaign) return;
    
    try {
      await campaignApi.reorderMedias(selectedCampaign.campaign_id, newOrder);
      setOrderedMediaIds(newOrder);
      // Atualizar campanha selecionada
      const updated = await campaignApi.getById(selectedCampaign.campaign_id);
      setSelectedCampaign(normalizeCampaign(updated));
    } catch (error: any) {
      console.error('Erro ao reordenar mídias:', error);
      const errorMessage = error?.response?.data?.message 
        || error?.response?.data?.error 
        || error?.message 
        || 'Erro ao reordenar mídias';
      setError(errorMessage);
    }
  };

  // Função para reordenar playlists
  const handleReorderPlaylists = async (newOrder: number[]) => {
    if (!selectedCampaign) return;
    
    try {
      await campaignApi.reorderPlaylists(selectedCampaign.campaign_id, newOrder);
      setOrderedPlaylistIds(newOrder);
      // Atualizar campanha selecionada
      const updated = await campaignApi.getById(selectedCampaign.campaign_id);
      setSelectedCampaign(normalizeCampaign(updated));
    } catch (error: any) {
      console.error('Erro ao reordenar playlists:', error);
      const errorMessage = error?.response?.data?.message 
        || error?.response?.data?.error 
        || error?.message 
        || 'Erro ao reordenar playlists';
      setError(errorMessage);
    }
  };

  const handleEditCampaign = async () => {
    if (!selectedCampaign) return;
    
    try {
      const updateData: UpdateCampaignRequest = {
        title: selectedCampaign.title,
        categorySegment: (selectedCampaign as any).categorySegment || (selectedCampaign as any).category_segment,
        description: selectedCampaign.description,
        campaign_type: normalizeCampaignType(selectedCampaign.campaign_type || (selectedCampaign as any).campaignType),
        status: selectedCampaign.status || 'draft',
        subscriberId: selectedCampaign.subscriber_id || (selectedCampaign as any).subscriberId,
        start_date: selectedCampaign.start_date || (selectedCampaign as any).startDate,
        end_date: selectedCampaign.end_date || (selectedCampaign as any).endDate,
        isActive: selectedCampaign.is_active !== undefined ? selectedCampaign.is_active : ((selectedCampaign as any).isActive !== undefined ? (selectedCampaign as any).isActive : true),
        playlistIds: orderedPlaylistIds.length > 0 ? orderedPlaylistIds : (selectedCampaign.playlistIds || []),
        mediaIds: orderedMediaIds.length > 0 ? orderedMediaIds : (selectedCampaign.mediaIds || []),
        publisherIds: (selectedCampaign as any).publisherIds || [],
        // Campos comerciais
        commercial_tier: (selectedCampaign as any).commercial_tier || 'standard',
        default_time_share_percent: (selectedCampaign as any).default_time_share_percent ?? 0,
        max_consecutive_slots: (selectedCampaign as any).max_consecutive_slots ?? 2,
      } as any;
      await campaignApi.update(selectedCampaign.campaign_id, updateData);
      setEditDialogOpen(false);
      setSelectedCampaign(null);
      setOrderedMediaIds([]);
      setOrderedPlaylistIds([]);
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

  const formatDate = (dateValue?: any) => {
    if (!dateValue) return 'N/A';
    try {
      let s = typeof dateValue === 'string' ? dateValue.trim() : '';
      let d: Date;
      if (dateValue instanceof Date) {
        d = dateValue;
      } else if (s) {
        // Normalizar "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
        if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(s)) {
          s = s.replace(' ', 'T');
        }
        d = new Date(s);
      } else {
        d = new Date(dateValue);
      }
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('pt-BR');
    } catch {
      return 'N/A';
    }
  };

  const toDateInputValue = (dateValue?: any) => {
    if (!dateValue) return '';
    try {
      if (dateValue instanceof Date) {
        return dateValue.toISOString().slice(0, 10);
      }
      const s = typeof dateValue === 'string' ? dateValue.trim() : '';
      if (!s) return '';
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : '';
    } catch {
      return '';
    }
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
      <PageHeader
        title="Campanhas"
        subtitle="Gerencie campanhas, playlists, agendamentos e prioridades comerciais (tier, share de tempo)."
        breadcrumbs={breadcrumbs}
        actions={[
          {
            label: 'Criar Campanha',
            icon: <Add />,
            onClick: () => setCreateDialogOpen(true),
            variant: 'contained',
          },
        ]}
        onRefresh={loadCampaigns}
        loading={loading}
      />

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
        {campaigns.map((campaign) => {
          const isHighlighted = highlightId === campaign.campaign_id;
          return (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              lg={3}
              key={campaign.campaign_id}
              ref={isHighlighted ? highlightRef : null}
            >
              <CampaignCard
                campaign={campaign}
                highlighted={isHighlighted}
                onEdit={async (campaign) => {
                  setSelectedCampaign(normalizeCampaign(campaign));
                  // Carregar publishers acessíveis se houver subscriberId
                  const subscriberId = campaign.subscriber_id || (campaign as any).subscriberId;
                  if (subscriberId && !isAdmin) {
                    await loadAccessiblePublishers(subscriberId);
                  }
                  setEditDialogOpen(true);
                }}
                onDelete={(campaign) => handleDeleteCampaign(campaign.campaign_id)}
                onView={(campaign) => {
                  setSelectedCampaign(campaign);
                  setDetailsDialogOpen(true);
                }}
              />
            </Grid>
          );
        })}
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
      <Dialog open={createDialogOpen} onClose={() => { setCreateDialogOpen(false); setError(null); }} maxWidth="md" fullWidth>
        <DialogTitle>Criar Campanha</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
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
            id="campaign-create-category-segment"
            name="categorySegment"
            label="Categoria/Segmento"
            value={(newCampaign as any).categorySegment || (newCampaign as any).category_segment || ''}
            onChange={(e) => setNewCampaign({ ...(newCampaign as any), categorySegment: e.target.value } as any)}
            margin="normal"
            helperText="Ex.: Black Friday, Saúde, Promoções..."
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
              <MenuItem value="general">Geral</MenuItem>
              <MenuItem value="scheduled">Agendada</MenuItem>
              <MenuItem value="interactive">Interativa</MenuItem>
              <MenuItem value="recurring">Recorrente</MenuItem>
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
              value={newCampaign.subscriberId || ''}
              onChange={async (e) => {
                const value = e.target.value;
                const subscriberId = value && value !== '' ? parseInt(String(value), 10) : undefined;
                setNewCampaign({ 
                  ...newCampaign, 
                  subscriberId,
                  publisherIds: [],   // Limpar publishers ao mudar subscriber
                  playlistIds: [],    // Limpar playlists (devem ser do mesmo subscriber)
                  mediaIds: [],       // Limpar mídias (devem ser do mesmo subscriber)
                });
                
                // Carregar publishers acessíveis para o subscriber selecionado
                if (subscriberId) {
                  try {
                    const accessible = await subscriberAccessApi.getAccessiblePublishers(subscriberId);
                    setAccessiblePublishers(accessible);
                  } catch (error) {
                    console.error('Erro ao carregar publishers acessíveis:', error);
                    setAccessiblePublishers([]);
                  }
                } else {
                  setAccessiblePublishers([]);
                }
              }}
              label="Cliente (Subscriber)"
            >
              <MenuItem value="">Nenhum</MenuItem>
              {clients.map((client) => {
                // Client tem apenas client_id (deprecated - usar Subscriber no futuro)
                // client_id é usado como subscriberId para compatibilidade
                const subscriberId = client.client_id;
                return (
                  <MenuItem key={client.client_id} value={subscriberId}>
                    {client.name}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          
          {/* Seleção de Publishers */}
          {newCampaign.subscriberId && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Publishers (Onde a campanha será exibida)</InputLabel>
              <Autocomplete<PublisherOption, true>
                multiple
                options={getPublisherOptions()}
                getOptionLabel={(option) => option.name || `Publisher ${option.publisher_id}`}
                value={getPublisherOptions().filter(p => newCampaign.publisherIds?.includes(p.publisher_id))}
                onChange={(_, newValue) => {
                  setNewCampaign({ 
                    ...newCampaign, 
                    publisherIds: newValue.map(p => p.publisher_id) 
                  });
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Publishers" 
                    margin="normal"
                    helperText={
                      isAdmin 
                        ? "Selecione os publishers onde a campanha será exibida"
                        : !Array.isArray(accessiblePublishers) || accessiblePublishers.length === 0
                        ? "Nenhum publisher acessível encontrado. Verifique o contrato e plano do subscriber."
                        : "Selecione os publishers acessíveis onde a campanha será exibida"
                    }
                  />
                )}
                disabled={!newCampaign.subscriberId || (!isAdmin && (!Array.isArray(accessiblePublishers) || accessiblePublishers.length === 0))}
              />
            </FormControl>
          )}
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
            options={playlists.filter(p => {
              // Filtrar playlists por subscriber da campanha
              const campaignSubscriberId = newCampaign.subscriberId;
              return !campaignSubscriberId || (p.subscriber_id ?? p.client_id) === campaignSubscriberId;
            })}
            getOptionLabel={(option) => option.name}
            value={playlists.filter(p => newCampaign.playlistIds?.includes(p.playlist_id))}
            onChange={(_, newValue) => {
              setNewCampaign({ ...newCampaign, playlistIds: newValue.map(p => p.playlist_id) });
            }}
            noOptionsText="Nenhuma playlist cadastrada. Crie em Assinantes > Playlists, adicione mídias e depois selecione aqui."
            renderInput={(params) => (
              <TextField {...params} label="Playlists" margin="normal" />
            )}
          />
          <Autocomplete
            multiple
            options={mediaItems.filter(m => {
              // Filtrar mídias por subscriber da campanha
              const campaignSubscriberId = newCampaign.subscriberId || newCampaign.clientId;
              const mediaSubscriberId = m.subscriberId || m.clientId;
              return !campaignSubscriberId || mediaSubscriberId === campaignSubscriberId;
            })}
            getOptionLabel={(option) => option.name}
            value={mediaItems.filter(m => newCampaign.mediaIds?.includes(m.media_id))}
            onChange={(_, newValue) => {
              // Validar ownership ao adicionar mídias
              const campaignSubscriberId = newCampaign.subscriberId || newCampaign.clientId;
              if (campaignSubscriberId) {
                const invalidMedia = newValue.find(m => {
                  const mediaSubscriberId = m.subscriberId || m.clientId;
                  return mediaSubscriberId && mediaSubscriberId !== campaignSubscriberId;
                });
                if (invalidMedia) {
                  setError(
                    `A mídia "${invalidMedia.name}" pertence a outro subscriber. ` +
                    `Você só pode adicionar mídias do mesmo subscriber da campanha.`
                  );
                  return;
                }
              }
              setError(null);
              setNewCampaign({ ...newCampaign, mediaIds: newValue.map(m => m.media_id) });
            }}
            renderInput={(params) => (
              <TextField {...params} label="Mídias Diretas (sem playlist)" margin="normal" helperText="Selecione mídias para associar diretamente à campanha, sem usar playlist" />
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
          <Tabs
            value={editTab}
            onChange={(_, v) => setEditTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2 }}
          >
            <Tab label="Principal" />
            <Tab label="Publicadores" />
            <Tab label="Playlists" />
            <Tab label="Mídias" />
            <Tab label="Totens" />
            <Tab label="Smart TVs" />
            <Tab label="Agendamento" />
          </Tabs>

          {editTab === 0 && (
            <>
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
            id="campaign-edit-category-segment"
            name="categorySegment"
            label="Categoria/Segmento"
            value={(selectedCampaign as any)?.categorySegment || (selectedCampaign as any)?.category_segment || ''}
            onChange={(e) => setSelectedCampaign({ ...(selectedCampaign as any), categorySegment: e.target.value } as any)}
            margin="normal"
            helperText="Ex.: Black Friday, Saúde, Promoções..."
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

          {/* Datas (Início/Fim) */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Data de Início"
                type="date"
                value={toDateInputValue(selectedCampaign?.start_date || (selectedCampaign as any)?.startDate)}
                onChange={(e) => setSelectedCampaign({
                  ...selectedCampaign!,
                  start_date: e.target.value
                })}
                InputLabelProps={{ shrink: true }}
                helperText="Período de validade da campanha (início)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Data de Fim"
                type="date"
                value={toDateInputValue(selectedCampaign?.end_date || (selectedCampaign as any)?.endDate)}
                onChange={(e) => setSelectedCampaign({
                  ...selectedCampaign!,
                  end_date: e.target.value
                })}
                InputLabelProps={{ shrink: true }}
                helperText="Período de validade da campanha (fim)"
              />
            </Grid>
          </Grid>
            </>
          )}
          
          {/* Seleção de Publishers */}
          {editTab === 1 && selectedCampaign && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Publishers (Onde a campanha será exibida)</InputLabel>
              <Autocomplete
                multiple
                options={(() => {
                  if (isAdmin) return publishers;
                  const baseOptions: any[] = accessiblePublishers.map(ap => ({
                    publisher_id: ap.publisher_id,
                    name: ap.publisher_name,
                    email: ap.publisher_email,
                    __invalid: false
                  }));

                  // Incluir publishers selecionados mas não acessíveis (para permitir remover)
                  const selectedIds = ((selectedCampaign as any).publisherIds || []) as number[];
                  const accessibleIds = accessiblePublishers.map(ap => ap.publisher_id);
                  const invalidIds = selectedIds.filter(id => !accessibleIds.includes(id));
                  const invalidOptions = invalidIds.map((publisherId) => {
                    const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                    return {
                      publisher_id: publisherId,
                      name: fromAll?.name || `Publisher ${publisherId}`,
                      email: fromAll?.email,
                      __invalid: true
                    };
                  });

                  // Merge único por publisher_id
                  const merged = [...baseOptions, ...invalidOptions];
                  const seen = new Set<number>();
                  return merged.filter((p) => {
                    if (seen.has(p.publisher_id)) return false;
                    seen.add(p.publisher_id);
                    return true;
                  });
                })()}
                getOptionLabel={(option) => option.name || `Publisher ${option.publisher_id}`}
                isOptionEqualToValue={(option, value) => option.publisher_id === value.publisher_id}
                getOptionDisabled={(option: any) => !isAdmin && option.__invalid === true}
                value={(() => {
                  const selectedIds = ((selectedCampaign as any).publisherIds || []) as number[];
                  const options: any[] = isAdmin
                    ? publishers
                    : [
                        ...accessiblePublishers.map(ap => ({
                          publisher_id: ap.publisher_id,
                          name: ap.publisher_name || '',
                          email: ap.publisher_email,
                          __invalid: false
                        })),
                        ...selectedIds
                          .filter((id) => !accessiblePublishers.map(ap => ap.publisher_id).includes(id))
                          .map((publisherId) => {
                            const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                            return {
                              publisher_id: publisherId,
                              name: fromAll?.name || `Publisher ${publisherId}`,
                              email: fromAll?.email,
                              __invalid: true
                            };
                          })
                      ];
                  return options.filter(p => selectedIds.includes(p.publisher_id));
                })()}
                onChange={(_, newValue) => {
                  setSelectedCampaign({ 
                    ...selectedCampaign!, 
                    publisherIds: newValue.map((p: any) => p.publisher_id) 
                  } as any);
                }}
                renderInput={(params) => {
                  const selectedIds = ((selectedCampaign as any).publisherIds || []) as number[];
                  const accessibleIds = accessiblePublishers.map(ap => ap.publisher_id);
                  const hasInvalidPublishers = !isAdmin && selectedIds.some(id => !accessibleIds.includes(id));
                  const invalidIds = !isAdmin ? selectedIds.filter(id => !accessibleIds.includes(id)) : [];
                  const invalidLabels = invalidIds.map((publisherId) => {
                    const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                    return `${fromAll?.name || `Publisher ${publisherId}`} (#${publisherId})`;
                  });
                  
                  return (
                    <TextField 
                      {...params} 
                      label="Publishers" 
                      margin="normal"
                      error={hasInvalidPublishers}
                      helperText={
                        hasInvalidPublishers
                          ? `⚠️ Publishers não acessíveis: ${invalidLabels.join(', ')}. Remova-os ou verifique seu contrato.`
                          : isAdmin 
                          ? "Selecione os publishers onde a campanha será exibida"
                          : accessiblePublishers.length === 0
                          ? "Nenhum publisher acessível encontrado. Verifique o contrato e plano do subscriber."
                          : "Selecione os publishers acessíveis onde a campanha será exibida"
                      }
                    />
                  );
                }}
                disabled={!isAdmin && accessiblePublishers.length === 0}
              />
            </FormControl>
          )}
          
          {/* Seleção de Playlists */}
          {editTab === 2 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Playlists
            </Typography>
            {orderedPlaylistIds.length > 0 ? (
              <>
                <SortableList
                  items={orderedPlaylistIds.map(id => {
                    const playlist = playlists.find(p => p.playlist_id === id);
                    return {
                      id,
                      label: playlist?.name || `Playlist ${id}`,
                      secondary: playlist ? `${playlist.media_count || 0} mídias` : undefined
                    };
                  })}
                  onReorder={handleReorderPlaylists}
                  onDelete={(id) => {
                    const newOrder = orderedPlaylistIds.filter(playlistId => playlistId !== id);
                    handleReorderPlaylists(newOrder);
                    setSelectedCampaign({ 
                      ...selectedCampaign!, 
                      playlistIds: newOrder
                    });
                  }}
                  emptyMessage="Nenhuma playlist selecionada"
                />
                <Autocomplete
                  multiple
                  options={playlists.filter(p => {
                    const campaignSubscriberId = selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                    const isAlreadyAdded = orderedPlaylistIds.includes(p.playlist_id);
                    return !isAlreadyAdded && (!campaignSubscriberId || (p.subscriber_id ?? p.client_id) === campaignSubscriberId);
                  })}
                  getOptionLabel={(option) => option.name}
                  value={[]}
                  onChange={(_, newValue) => {
                    const newIds = [...orderedPlaylistIds, ...newValue.map(p => p.playlist_id)];
                    setOrderedPlaylistIds(newIds);
                    setSelectedCampaign({ 
                      ...selectedCampaign!, 
                      playlistIds: newIds
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Adicionar Playlist" margin="normal" size="small" />
                  )}
                />
              </>
            ) : (
              <Autocomplete
                multiple
                options={playlists.filter(p => {
                  const campaignSubscriberId = selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                  return !campaignSubscriberId || (p.subscriber_id ?? p.client_id) === campaignSubscriberId;
                })}
                getOptionLabel={(option) => option.name}
                value={playlists.filter(p => (selectedCampaign?.playlistIds || []).includes(p.playlist_id))}
                onChange={(_, newValue) => {
                  const newIds = newValue.map(p => p.playlist_id);
                  setOrderedPlaylistIds(newIds);
                  setSelectedCampaign({ 
                    ...selectedCampaign!, 
                    playlistIds: newIds
                  });
                }}
                noOptionsText="Nenhuma playlist cadastrada. Crie em Assinantes > Playlists, adicione mídias e depois selecione aqui."
                renderInput={(params) => (
                  <TextField {...params} label="Playlists" margin="normal" helperText="Selecione playlists e depois arraste para reordenar" />
                )}
              />
            )}
          </Box>
          )}
          
          {/* Seleção de Mídias Diretas */}
          {editTab === 3 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              Mídias Diretas (sem playlist)
            </Typography>
            {orderedMediaIds.length > 0 ? (
              <>
                <SortableList
                  items={orderedMediaIds.map(id => {
                    const media = mediaItems.find(m => m.media_id === id);
                    return {
                      id,
                      label: media?.name || `Mídia ${id}`,
                      secondary: media ? `${media.fileName || ''} (${media.media_type || (media as any).mediaType || 'N/A'})` : undefined
                    };
                  })}
                  onReorder={handleReorderMedias}
                  onDelete={(id) => {
                    const newOrder = orderedMediaIds.filter(mediaId => mediaId !== id);
                    handleReorderMedias(newOrder);
                    setSelectedCampaign({ 
                      ...selectedCampaign!, 
                      mediaIds: newOrder
                    });
                  }}
                  emptyMessage="Nenhuma mídia selecionada"
                />
                <Autocomplete
                  multiple
                  options={mediaItems.filter(m => {
                    const campaignSubscriberId = selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                    const isAlreadyAdded = orderedMediaIds.includes(m.media_id);
                    return !isAlreadyAdded && (!campaignSubscriberId || (m.subscriberId ?? m.clientId) === campaignSubscriberId);
                  })}
                  getOptionLabel={(option) => option.name}
                  value={[]}
                  onChange={(_, newValue) => {
                    const newIds = [...orderedMediaIds, ...newValue.map(m => m.media_id)];
                    setOrderedMediaIds(newIds);
                    setSelectedCampaign({ 
                      ...selectedCampaign!, 
                      mediaIds: newIds
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Adicionar Mídia" margin="normal" size="small" />
                  )}
                />
              </>
            ) : (
              <Autocomplete
                multiple
                options={mediaItems.filter(m => {
                  const campaignSubscriberId = selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                  return !campaignSubscriberId || (m.subscriberId ?? m.clientId) === campaignSubscriberId;
                })}
                getOptionLabel={(option) => option.name}
                value={mediaItems.filter(m => (selectedCampaign?.mediaIds || []).includes(m.media_id))}
                onChange={(_, newValue) => {
                  const newIds = newValue.map(m => m.media_id);
                  setOrderedMediaIds(newIds);
                  setSelectedCampaign({ 
                    ...selectedCampaign!, 
                    mediaIds: newIds
                  });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Mídias Diretas (sem playlist)" margin="normal" helperText="Selecione mídias e depois arraste para reordenar" />
                )}
              />
            )}
          </Box>
          )}

          {/* Aba Totens (derivados dos publishers selecionados) */}
          {editTab === 4 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Totens impactados (derivado dos publishers selecionados)
              </Typography>
              {derivedDevicesLoading ? (
                <LinearProgress />
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {derivedTotems.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhum totem encontrado para os publishers selecionados.
                    </Typography>
                  ) : (
                    derivedTotems.map((t) => (
                      <Chip
                        key={t.totem_id}
                        label={`${t.name || t.identifier || 'Totem'} (#${t.totem_id})`}
                        size="small"
                        color={t.status === 'online' ? 'success' : 'default'}
                      />
                    ))
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Aba Smart TVs (derivadas dos publishers selecionados) */}
          {editTab === 5 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Smart TVs impactadas (derivado dos publishers selecionados)
              </Typography>
              {derivedDevicesLoading ? (
                <LinearProgress />
              ) : (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {derivedSmartTvs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma Smart TV encontrada para os publishers selecionados.
                    </Typography>
                  ) : (
                    derivedSmartTvs.map((tv) => (
                      <Chip
                        key={tv.smart_tv_id}
                        label={`${tv.name || tv.identifier || 'Smart TV'} (#${tv.smart_tv_id})`}
                        size="small"
                        color={tv.status === 'online' ? 'success' : 'default'}
                      />
                    ))
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Aba Agendamento / Execução */}
          {editTab === 6 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Validade / Execução (política A)
              </Typography>
              {(() => {
                const selectedIds = (((selectedCampaign as any)?.publisherIds || []) as number[]);
                const accessibleIds = accessiblePublishers.map(ap => ap.publisher_id);
                const invalidIds = !isAdmin ? selectedIds.filter(id => !accessibleIds.includes(id)) : [];
                const invalidLabels = invalidIds.map((publisherId) => {
                  const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                  return `${fromAll?.name || `Publisher ${publisherId}`} (#${publisherId})`;
                });
                return (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      A campanha pode manter associações históricas. A execução (dispatcher/mix) filtra apenas o que estiver válido no momento atual.
                    </Typography>
                    {invalidLabels.length > 0 ? (
                      <Alert severity="warning">
                        Publishers bloqueados agora (não serão executados): {invalidLabels.join(', ')}
                      </Alert>
                    ) : (
                      <Alert severity="success">Todos os publishers selecionados estão válidos no momento.</Alert>
                    )}
                  </>
                );
              })()}
            </Box>
          )}
          
          {/* Campos Comerciais */}
          {editTab === 0 && (
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
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditCampaign}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <CampaignDetails
        open={detailsDialogOpen}
        campaign={selectedCampaign}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedCampaign(null);
        }}
        onEdit={async (campaign) => {
          setDetailsDialogOpen(false);
          setSelectedCampaign(campaign);
          const subscriberId = campaign.subscriber_id || (campaign as any).subscriberId;
          if (subscriberId && !isAdmin) {
            await loadAccessiblePublishers(subscriberId);
          }
          setEditDialogOpen(true);
        }}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Campaigns;
