import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Checkbox,
  Autocomplete,
  Pagination,
  Stack,
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
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  People,
  Computer,
  Tv,
  Store,
  VideoLibrary,
  Image as ImageIcon,
  AudioFile,
  CloudUpload,
  PlayArrow,
  Visibility,
  DragIndicator,
  Campaign as CampaignIcon,
  QueueMusic,
  Description,
  OpenInNew,
} from '@mui/icons-material';
import { 
  subscriberApi, 
  Subscriber, 
  CreateSubscriberRequest, 
  UpdateSubscriberRequest,
  mediaApi,
  MediaItem,
  CreateMediaRequest,
  UpdateMediaRequest,
  playlistApi,
  PlaylistItem,
  PlaylistMediaItem,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  campaignApi,
  Campaign,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  Contract,
  CreateLocalRequest,
  CreatePlayerRequest,
  CreateSmartTvRequest,
  Local,
  localApi,
  totemApi,
  smartTvApi,
  contractApi,
} from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import { SortableList } from '../../components/SortableList/SortableList';

const Subscribers: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [Subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [SubscriberStats, setSubscriberStats] = useState<{
    locals: any[];
    totems: any[];
    smartTvs: any[];
    stats: any;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // clientTypeFilter removido - subscribers não têm tipos
  const [activeOnlyFilter, setActiveOnlyFilter] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Estados para paginação
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12);
  const [total, setTotal] = useState<number>(0);
  // Estados para dashboard
  const [overallStats, setOverallStats] = useState<{
    total: number;
    active: number;
    inactive: number;
    totalMedias: number;
    totalPlaylists: number;
    totalCampaigns: number;
  } | null>(null);
  const [detailsTab, setDetailsTab] = useState(0);
  const [createTab, setCreateTab] = useState(0); // NOVO: Aba do dialog de criação
  const [editTab, setEditTab] = useState(0); // NOVO: Aba do dialog de edição
  const [newSubscriber, setNewSubscriber] = useState<CreateSubscriberRequest>({
    name: '',
    contract_id: undefined, // Opcional - pode vincular um pré-contrato (se existir)
    contact_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    category_segment: '',
    description: '',
  });
  
  // Estados para contratos
  const [availableContracts, setAvailableContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  // NOVO: Estados para gerenciar locais, totens, smart TVs e subscribers durante a criação
  const [tempLocals, setTempLocals] = useState<CreateLocalRequest[]>([]);
  const [tempTotems, setTempTotems] = useState<(CreatePlayerRequest & { tempId: string })[]>([]);
  const [tempSmartTvs, setTempSmartTvs] = useState<(CreateSmartTvRequest & { tempId: string })[]>([]);
  const [editingLocalIndex, setEditingLocalIndex] = useState<number | null>(null);
  const [editingTotemIndex, setEditingTotemIndex] = useState<number | null>(null);
  const [editingSmartTvIndex, setEditingSmartTvIndex] = useState<number | null>(null);
  
  // Estados para edição de Assinante (carregar dados existentes)
  const [editMedias, setEditMedias] = useState<MediaItem[]>([]);
  const [editPlaylists, setEditPlaylists] = useState<PlaylistItem[]>([]);
  const [editCampaigns, setEditCampaigns] = useState<Campaign[]>([]);
  const [editingEditMediaIndex, setEditingEditMediaIndex] = useState<number | null>(null);
  const [editingEditPlaylistIndex, setEditingEditPlaylistIndex] = useState<number | null>(null);
  const [editingEditCampaignIndex, setEditingEditCampaignIndex] = useState<number | null>(null);
  
  // Estados para upload de mídia
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  
  // Estados para formulários de edição
  const [editMediaForm, setEditMediaForm] = useState<UpdateMediaRequest>({
    name: '',
    description: '',
    tags: [],
  });
  const [editPlaylistForm, setEditPlaylistForm] = useState<UpdatePlaylistRequest>({
    name: '',
    description: '',
    isActive: true,
  });
  const [editCampaignForm, setEditCampaignForm] = useState<Partial<UpdateCampaignRequest>>({
    title: '',
    description: '',
    campaign_type: 'general',
    priority: 1,
    contractId: undefined,
    status: 'draft',
    isActive: true,
  });
  
  // Estados para itens de playlist
  const [playlistItems, setPlaylistItems] = useState<PlaylistMediaItem[]>([]);
  const [editingPlaylistItemIndex, setEditingPlaylistItemIndex] = useState<number | null>(null);
  const [selectedMediasForPlaylist, setSelectedMediasForPlaylist] = useState<number[]>([]);
  const [defaultPlaylistItemDuration, setDefaultPlaylistItemDuration] = useState<number>(10);
  const [editingItemDuration, setEditingItemDuration] = useState<number | null>(null);
  const [tempItemDuration, setTempItemDuration] = useState<{ [itemId: number]: number }>({});
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  
  // Estados para campanha (mídias e playlists associadas)
  const [campaignMedias, setCampaignMedias] = useState<any[]>([]);
  const [campaignPlaylists, setCampaignPlaylists] = useState<any[]>([]);
  
  // Estados para contratos
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [editLocalForm, setEditLocalForm] = useState<CreateLocalRequest>({
    publisher_id: 0,
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    description: '',
  });
  const [editTotemForm, setEditTotemForm] = useState<any>({
    localId: 0,
    identifier: '',
    name: '',
    uin: '',
    deviceId: '',
    description: '',
    firmwareVersion: '',
  });
  const [editSmartTvForm, setEditSmartTvForm] = useState<any>({
    totem_id: 0,
    identifier: '',
    name: '',
    device_id: '',
    brand: '',
    model: '',
    platform: '',
    firmware_version: '',
    resolution_width: undefined,
    resolution_height: undefined,
    orientation: 'landscape',
  });
  const [localForm, setLocalForm] = useState<CreateLocalRequest>({
    publisher_id: 0, // NOTA: Subscribers não podem criar locais - este formulário não deve ser usado
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    description: '',
  });
  const [totemForm, setTotemForm] = useState<CreatePlayerRequest & { tempId: string }>({
    tempId: '',
    identifier: '',
    localId: 0,
    uin: '',
    deviceId: '',
    name: '',
    description: '',
    firmwareVersion: '',
  });
  const [smartTvForm, setSmartTvForm] = useState<CreateSmartTvRequest & { tempId: string }>({
    tempId: '',
    totem_id: 0,
    identifier: '',
    device_id: '',
    name: '',
    brand: '',
    model: '',
    platform: '',
    firmware_version: '',
    resolution_width: undefined,
    resolution_height: undefined,
    orientation: 'landscape',
  });

  useEffect(() => {
    loadSubscribers();
    loadAvailableContracts(); // Carregar contratos disponíveis
    loadOverallStats(); // Carregar estatísticas gerais
  }, [activeOnlyFilter, page, limit]);

  useEffect(() => {
    // Debounce para busca
    const timer = setTimeout(() => {
      if (page === 1) {
        loadSubscribers();
      } else {
        setPage(1); // Resetar para primeira página ao buscar
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);
  
  const loadAvailableContracts = async () => {
    try {
      setLoadingContracts(true);
      const response = await contractApi.getAll({ 
        activeOnly: true,
        status: 'draft',
        limit: 1000 
      });
      // Filtrar apenas contratos sem subscriber_id (created_before_subscriber = true)
      const contractsWithoutSubscriber = response.data.filter(
        (c: Contract) => !c.subscriber_id || c.created_before_subscriber
      );
      setAvailableContracts(contractsWithoutSubscriber);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
      setError('Erro ao carregar lista de contratos');
    } finally {
      setLoadingContracts(false);
    }
  };

  // Carregar dados quando dialog de edição abre
  useEffect(() => {
    if (editDialogOpen && selectedSubscriber) {
      loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  }, [editDialogOpen, selectedSubscriber?.subscriber_id]);

  const loadSubscribers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await subscriberApi.getAll({
        search: searchTerm || undefined,
        active_only: activeOnlyFilter,
        page,
        limit,
      });
      setSubscribers(response.data || []);
      setTotal(response.total || response.data?.length || 0);
    } catch (error) {
      console.error('Erro ao carregar Subscribers:', error);
      setError('Erro ao carregar lista de Subscribers');
    } finally {
      setLoading(false);
    }
  };

  const loadOverallStats = async () => {
    try {
      // Backend limita paginação; manter compatível para evitar 400/429
      const allSubscribers = await subscriberApi.getAll({ limit: 100 });
      const subscribers = allSubscribers.data || [];
      
      let totalMedias = 0;
      let totalPlaylists = 0;
      let totalCampaigns = 0;

      // Carregar estatísticas de cada subscriber
      for (const subscriber of subscribers.slice(0, 50)) { // Limitar a 50 para não sobrecarregar
        try {
          const stats = await subscriberApi.getStats(subscriber.subscriber_id);
          if (stats) {
            totalMedias += stats.media_count || 0;
            totalPlaylists += stats.playlist_count || 0;
            totalCampaigns += stats.campaign_count || 0;
          }
        } catch (err) {
          // Ignorar erros individuais
        }
      }

      setOverallStats({
        total: subscribers.length,
        active: subscribers.filter(s => s.is_active).length,
        inactive: subscribers.filter(s => !s.is_active).length,
        totalMedias,
        totalPlaylists,
        totalCampaigns,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas gerais:', error);
    }
  };

  const loadSubscriberStats = async (subscriberId: number) => {
    try {
      const [localsResponse, totemsResponse, smartTvsResponse, statsResponse] = await Promise.all([
        subscriberApi.getLocals(subscriberId),
        subscriberApi.getTotems(subscriberId),
        subscriberApi.getSmartTvs(subscriberId),
        subscriberApi.getStats(subscriberId),
      ]);

      setSubscriberStats({
        locals: Array.isArray(localsResponse) ? localsResponse : [],
        totems: Array.isArray(totemsResponse) ? totemsResponse : [],
        smartTvs: Array.isArray(smartTvsResponse) ? smartTvsResponse : [],
        stats: statsResponse || {},
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas do Subscriber:', error);
    }
  };

  // Carregar dados para edição
  const loadSubscriberDataForEdit = async (subscriberId: number) => {
    try {
      const [mediasResponse, playlistsResponse, campaignsResponse, contractsResponse] = await Promise.all([
        mediaApi.getAll({ subscriberId, limit: 1000 }),
        playlistApi.getAll({ subscriberId, limit: 1000 }),
        campaignApi.getAll({ subscriberId, limit: 1000 }),
        subscriberApi.getContracts(subscriberId).catch(() => []), // Carregar contratos
      ]);

      setEditMedias(Array.isArray(mediasResponse?.data) ? mediasResponse.data : []);
      setEditPlaylists(Array.isArray(playlistsResponse?.data) ? playlistsResponse.data : []);
      setEditCampaigns(Array.isArray(campaignsResponse?.data) ? campaignsResponse.data : []);
      setActiveContracts(Array.isArray(contractsResponse) ? contractsResponse : []);
    } catch (error) {
      console.error('Erro ao carregar dados do Subscriber para edição:', error);
      setError('Erro ao carregar dados do Assinante');
    }
  };

  // Carregar dados automaticamente quando o dialog de edição abrir
  useEffect(() => {
    if (editDialogOpen && selectedSubscriber) {
      loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  }, [editDialogOpen, selectedSubscriber?.subscriber_id]);

  // NOVO: Funções para gerenciar locais temporários
  const handleAddLocal = () => {
    if (!localForm.name) {
      setError('Nome do local é obrigatório');
      return;
    }
    if (editingLocalIndex !== null) {
      const updated = [...tempLocals];
      updated[editingLocalIndex] = { ...localForm };
      setTempLocals(updated);
      setEditingLocalIndex(null);
    } else {
      setTempLocals([...tempLocals, { ...localForm }]);
    }
    // CORRIGIDO: Resetar o formulário corretamente
    setLocalForm({
      publisher_id: 0,
      name: '',
      address: '',
      city: '',
      state: '',
      zip_code: '',
      country: '',
      description: '',
    });
  };

  const handleEditLocal = (index: number) => {
    // NOTA: Subscribers não podem criar/editar locais
    const local = tempLocals[index];
    setLocalForm({ 
      publisher_id: local.publisher_id || 0,
      name: local.name || '',
      address: local.address || '',
      city: local.city || '',
      state: local.state || '',
      zip_code: local.zip_code || '',
      country: local.country || '',
      description: local.description || '',
    });
    setEditingLocalIndex(index);
  };

  const handleDeleteLocal = (index: number) => {
    setTempLocals(tempLocals.filter((_, i) => i !== index));
  };

  // NOVO: Funções para gerenciar totens temporários
  const handleAddTotem = () => {
    if (!totemForm.identifier) {
      setError('Identifier do totem é obrigatório');
      return;
    }
    // CORRIGIDO: Validar se localId está dentro do range válido (0 é um índice válido!)
    if (tempLocals.length === 0) {
      setError('É necessário cadastrar ao menos 1 local antes de adicionar totens');
      return;
    }
    if (totemForm.localId < 0 || totemForm.localId >= tempLocals.length) {
      setError('Local é obrigatório para o totem. Selecione um local válido.');
      return;
    }
    if (editingTotemIndex !== null) {
      const updated = [...tempTotems];
      // Preservar tempId ao editar
      updated[editingTotemIndex] = { ...totemForm, tempId: tempTotems[editingTotemIndex].tempId };
      setTempTotems(updated);
      setEditingTotemIndex(null);
    } else {
      setTempTotems([...tempTotems, { ...totemForm, tempId: `temp-${Date.now()}` }]);
    }
    setTotemForm({
      tempId: '',
      identifier: '',
      localId: 0,
      uin: '',
      deviceId: '',
      name: '',
      description: '',
      firmwareVersion: '',
    });
  };

  const handleEditTotem = (index: number) => {
    setTotemForm({ ...tempTotems[index] });
    setEditingTotemIndex(index);
  };

  const handleDeleteTotem = (index: number) => {
    setTempTotems(tempTotems.filter((_, i) => i !== index));
  };

  // NOVO: Funções para gerenciar Smart TVs temporárias
  const handleAddSmartTv = () => {
    if (!smartTvForm.identifier) {
      setError('Identifier da Smart TV é obrigatório');
      return;
    }
    // CORRIGIDO: Validar se totem_id está dentro do range válido (0 é um índice válido!)
    if (tempTotems.length === 0) {
      setError('É necessário cadastrar ao menos 1 totem antes de adicionar Smart TVs');
      return;
    }
    if (smartTvForm.totem_id < 0 || smartTvForm.totem_id >= tempTotems.length) {
      setError('Totem é obrigatório para a Smart TV. Selecione um totem válido.');
      return;
    }
    if (editingSmartTvIndex !== null) {
      const updated = [...tempSmartTvs];
      // Preservar tempId ao editar
      updated[editingSmartTvIndex] = { ...smartTvForm, tempId: tempSmartTvs[editingSmartTvIndex].tempId };
      setTempSmartTvs(updated);
      setEditingSmartTvIndex(null);
    } else {
      setTempSmartTvs([...tempSmartTvs, { ...smartTvForm, tempId: `tv-${Date.now()}` }]);
    }
    setSmartTvForm({
      tempId: '',
      totem_id: 0,
      identifier: '',
      device_id: '',
      name: '',
      brand: '',
      model: '',
      platform: '',
      firmware_version: '',
      resolution_width: undefined,
      resolution_height: undefined,
      orientation: 'landscape',
    });
  };

  const handleEditSmartTv = (index: number) => {
    // Preservar tempId ao editar
    setSmartTvForm({ ...tempSmartTvs[index], tempId: tempSmartTvs[index].tempId });
    setEditingSmartTvIndex(index);
  };

  const handleDeleteSmartTv = (index: number) => {
    setTempSmartTvs(tempSmartTvs.filter((_, i) => i !== index));
  };

  // ============================================================================
  // FUNÇÕES DE CRUD PARA EDIÇÃO DE Assinante
  // ============================================================================
  // NOTA: Funções antigas para gerenciar locais, totens e smart TVs foram removidas
  // pois subscribers não podem mais gerenciar esses recursos diretamente.
  // Eles acessam locais através de planos e contratos.

  /* Funções antigas comentadas (não mais usadas):
  // Funções para gerenciar locais na edição
  const handleAddEditLocal = async () => {
    if (!selectedSubscriber || !editLocalForm.name) {
      setError('Nome do local é obrigatório');
      return;
    }

    try {
      if (editingEditLocalIndex !== null) {
        // Atualizar local existente
        const localToUpdate = editLocals[editingEditLocalIndex];
        // Excluir publisher_id do update (UpdateLocalRequest não inclui esse campo)
        const { publisher_id, ...updateData } = editLocalForm;
        await localApi.update(localToUpdate.local_id, updateData);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditLocalIndex(null);
      } else {
        // Criar novo local - NOTA: Subscribers não podem criar locais
        // Esta função não deve ser chamada para subscribers
        throw new Error('Subscribers não podem criar locais. Locais pertencem apenas a publishers.');
      }
      setEditLocalForm({
        publisher_id: 0,
        name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        description: '',
      });
    } catch (error: any) {
      console.error('Erro ao salvar local:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar local');
    }
  };

  const handleEditEditLocal = (index: number) => {
    // NOTA: Subscribers não podem editar locais - esta função não deve ser chamada
    const local = editLocals[index];
    setEditLocalForm({
      publisher_id: local.publisher_id || 0,
      name: local.name || '',
      address: local.address || '',
      city: local.city || '',
      state: local.state || '',
      zip_code: local.zip_code || '',
      country: local.country || '',
      description: local.description || '',
    });
    setEditingEditLocalIndex(index);
  };

  const handleDeleteEditLocal = async (index: number) => {
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir este local?')) return;
    
    try {
      const local = editLocals[index];
      // Remover totens e smart TVs associados a este local primeiro
      const totemsToRemove = editTotems.filter(t => t.local_id === local.local_id);
      for (const totem of totemsToRemove) {
        try {
          const smartTvsToRemove = editSmartTvs.filter(tv => tv.totem_id === totem.totem_id);
          for (const tv of smartTvsToRemove) {
            await smartTvApi.delete(tv.smart_tv_id);
          }
          await totemApi.delete(totem.totem_id);
        } catch (err) {
          console.error('Erro ao excluir totem/smart TVs:', err);
        }
      }
      await localApi.delete(local.local_id);
      // Recarregar dados
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir local:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir local');
    }
  };

  // Funções para gerenciar totens na edição
  const handleAddEditTotem = async () => {
    if (!selectedSubscriber || !editTotemForm.identifier) {
      setError('Identifier do totem é obrigatório');
      return;
    }
    if (editLocals.length === 0) {
      setError('É necessário ter ao menos 1 local antes de adicionar totens');
      return;
    }
    if (editTotemForm.localId < 0 || editTotemForm.localId >= editLocals.length) {
      setError('Local é obrigatório para o totem');
      return;
    }

    try {
      const selectedLocal = editLocals[editTotemForm.localId];
      const totemData = {
        localId: selectedLocal.local_id,
        identifier: editTotemForm.identifier,
        name: editTotemForm.name || undefined,
        uin: editTotemForm.uin || undefined,
        deviceId: editTotemForm.deviceId || undefined,
        description: editTotemForm.description || undefined,
        firmwareVersion: editTotemForm.firmwareVersion || undefined,
      };

      if (editingEditTotemIndex !== null) {
        // Atualizar totem existente
        const totemToUpdate = editTotems[editingEditTotemIndex];
        await totemApi.update(totemToUpdate.totem_id, totemData);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditTotemIndex(null);
      } else {
        // Criar novo totem
        await totemApi.create(totemData);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
      }
      setEditTotemForm({
        localId: 0,
        identifier: '',
        name: '',
        uin: '',
        deviceId: '',
        description: '',
        firmwareVersion: '',
      });
    } catch (error: any) {
      console.error('Erro ao salvar totem:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar totem');
    }
  };

  const handleEditEditTotem = (index: number) => {
    const totem = editTotems[index];
    // Encontrar índice do local no array editLocals
    const localIndex = editLocals.findIndex(l => l.local_id === totem.local_id);
    setEditTotemForm({
      localId: localIndex >= 0 ? localIndex : 0,
      identifier: totem.identifier || '',
      name: totem.name || '',
      uin: totem.uin || '',
      deviceId: totem.device_id || totem.deviceId || '',
      description: totem.description || '',
      firmwareVersion: totem.firmware_version || totem.firmwareVersion || '',
    });
    setEditingEditTotemIndex(index);
  };

  const handleDeleteEditTotem = async (index: number) => {
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir este totem?')) return;
    
    try {
      const totem = editTotems[index];
      // Remover smart TVs associadas a este totem primeiro
      const smartTvsToRemove = editSmartTvs.filter(tv => tv.totem_id === totem.totem_id);
      for (const tv of smartTvsToRemove) {
        try {
          await smartTvApi.delete(tv.smart_tv_id);
        } catch (err) {
          console.error('Erro ao excluir Smart TV:', err);
        }
      }
      await totemApi.delete(totem.totem_id);
      // Recarregar dados
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir totem:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir totem');
    }
  };

  // Funções para gerenciar Smart TVs na edição
  const handleAddEditSmartTv = async () => {
    if (!selectedSubscriber || !editSmartTvForm.identifier) {
      setError('Identifier da Smart TV é obrigatório');
      return;
    }
    if (editTotems.length === 0) {
      setError('É necessário ter ao menos 1 totem antes de adicionar Smart TVs');
      return;
    }
    if (editSmartTvForm.totem_id < 0 || editSmartTvForm.totem_id >= editTotems.length) {
      setError('Totem é obrigatório para a Smart TV');
      return;
    }

    try {
      const selectedTotem = editTotems[editSmartTvForm.totem_id];
      const smartTvData = {
        totem_id: selectedTotem.totem_id,
        identifier: editSmartTvForm.identifier,
        name: editSmartTvForm.name || undefined,
        device_id: editSmartTvForm.device_id || undefined,
        brand: editSmartTvForm.brand || undefined,
        model: editSmartTvForm.model || undefined,
        platform: editSmartTvForm.platform || undefined,
        firmware_version: editSmartTvForm.firmware_version || undefined,
        resolution_width: editSmartTvForm.resolution_width,
        resolution_height: editSmartTvForm.resolution_height,
        orientation: editSmartTvForm.orientation || 'landscape',
      };

      if (editingEditSmartTvIndex !== null) {
        // Atualizar Smart TV existente
        const tvToUpdate = editSmartTvs[editingEditSmartTvIndex];
        await smartTvApi.update(tvToUpdate.smart_tv_id, smartTvData);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditSmartTvIndex(null);
      } else {
        // Criar nova Smart TV
        await smartTvApi.create(smartTvData);
        // Recarregar dados
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
      }
      setEditSmartTvForm({
        totem_id: 0,
        identifier: '',
        name: '',
        device_id: '',
        brand: '',
        model: '',
        platform: '',
        firmware_version: '',
        resolution_width: undefined,
        resolution_height: undefined,
        orientation: 'landscape',
      });
    } catch (error: any) {
      console.error('Erro ao salvar Smart TV:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar Smart TV');
    }
  };

  const handleEditEditSmartTv = (index: number) => {
    const smartTv = editSmartTvs[index];
    // Encontrar índice do totem no array editTotems
    const totemIndex = editTotems.findIndex(t => t.totem_id === smartTv.totem_id);
    setEditSmartTvForm({
      totem_id: totemIndex >= 0 ? totemIndex : 0,
      identifier: smartTv.identifier || '',
      name: smartTv.name || '',
      device_id: smartTv.device_id || '',
      brand: smartTv.brand || '',
      model: smartTv.model || '',
      platform: smartTv.platform || '',
      firmware_version: smartTv.firmware_version || '',
      resolution_width: smartTv.resolution_width,
      resolution_height: smartTv.resolution_height,
      orientation: smartTv.orientation || 'landscape',
    });
    setEditingEditSmartTvIndex(index);
  };

  const handleDeleteEditSmartTv = async (index: number) => {
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir esta Smart TV?')) return;
    
    try {
      const smartTv = editSmartTvs[index];
      await smartTvApi.delete(smartTv.smart_tv_id);
      // Recarregar dados
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir Smart TV:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir Smart TV');
    }
  };
  */

  // ============================================================================
  // FUNÇÕES AUXILIARES
  // ============================================================================

  const getMediaIcon = (mediaType?: string) => {
    if (!mediaType) return <VideoLibrary />;
    switch (mediaType.toLowerCase()) {
      case 'video': return <VideoLibrary />;
      case 'image': return <ImageIcon />;
      case 'audio': return <AudioFile />;
      default: return <VideoLibrary />;
    }
  };

  const getMediaTypeColor = (mediaType?: string) => {
    if (!mediaType) return theme.palette.primary.main;
    switch (mediaType.toLowerCase()) {
      case 'video': return theme.palette.error.main;
      case 'image': return theme.palette.success.main;
      case 'audio': return theme.palette.warning.main;
      default: return theme.palette.primary.main;
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

  // ============================================================================
  // FUNÇÕES CRUD PARA MÍDIAS
  // ============================================================================

  const handleUploadMediaSuccess = async () => {
    if (selectedSubscriber) {
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  };

  const handleEditMedia = async () => {
    if (!selectedSubscriber || editingEditMediaIndex === null) return;
    
    try {
      const media = editMedias[editingEditMediaIndex];
      await mediaApi.update(media.media_id, editMediaForm);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
      setEditingEditMediaIndex(null);
      setEditMediaForm({ name: '', description: '', tags: [] });
    } catch (error: any) {
      console.error('Erro ao atualizar mídia:', error);
      setError(error?.response?.data?.error || 'Erro ao atualizar mídia');
    }
  };

  const handleStartEditMedia = (index: number) => {
    const media = editMedias[index];
    setEditMediaForm({
      name: media.name || '',
      description: media.description || '',
      tags: media.tags || [],
    });
    setEditingEditMediaIndex(index);
  };

  const handleDeleteMedia = async (index: number) => {
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir esta mídia?')) return;
    
    try {
      const media = editMedias[index];
      await mediaApi.delete(media.media_id);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir mídia:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir mídia');
    }
  };

  // ============================================================================
  // FUNÇÕES CRUD PARA PLAYLISTS
  // ============================================================================

  const handleAddPlaylist = async () => {
    if (!selectedSubscriber || !editPlaylistForm.name) {
      setError('Nome da playlist é obrigatório');
      return;
    }

    // Validação prévia de limites (apenas para criação)
    if (editingEditPlaylistIndex === null) {
      try {
        const validation = await subscriberApi.validatePlanLimits(selectedSubscriber.subscriber_id, 'playlist');
        if (!validation.valid) {
          setError(validation.message);
          return;
        }
      } catch (err: any) {
        console.error('Erro na validação prévia:', err);
        // Continuar mesmo se validação falhar (backend vai validar)
      }
    }

    try {
      if (editingEditPlaylistIndex !== null) {
        const playlist = editPlaylists[editingEditPlaylistIndex];
        await playlistApi.update(playlist.playlist_id, editPlaylistForm);
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditPlaylistIndex(null);
      } else {
        await playlistApi.create({
          name: editPlaylistForm.name,
          description: editPlaylistForm.description,
          subscriberId: selectedSubscriber.subscriber_id,
        });
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
      }
      setEditPlaylistForm({ name: '', description: '', isActive: true });
    } catch (error: any) {
      console.error('Erro ao salvar playlist:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar playlist');
    }
  };

  const handleStartEditPlaylist = async (index: number) => {
    const playlist = editPlaylists[index];
    setEditPlaylistForm({
      name: playlist.name || '',
      description: playlist.description || '',
      isActive: playlist.is_active !== undefined ? playlist.is_active : true,
    });
    setEditingEditPlaylistIndex(index);
    setSelectedMediasForPlaylist([]);
    
    // Carregar itens da playlist
    try {
      const items = await playlistApi.getMedia(playlist.playlist_id);
      setPlaylistItems(items || []);
    } catch (error) {
      console.error('Erro ao carregar itens da playlist:', error);
      setPlaylistItems([]);
    }
  };

  const handleAddMediasToPlaylist = async () => {
    if (editingEditPlaylistIndex === null || selectedMediasForPlaylist.length === 0) {
      return;
    }

    try {
      const playlist = editPlaylists[editingEditPlaylistIndex];
      
      // Adicionar cada mídia selecionada à playlist
      for (const mediaId of selectedMediasForPlaylist) {
        await playlistApi.addMedia(
          playlist.playlist_id,
          mediaId,
          undefined, // orderIndex será calculado automaticamente
          defaultPlaylistItemDuration * 1000 // Converter segundos para milissegundos
        );
      }

      // Recarregar itens da playlist
      const items = await playlistApi.getMedia(playlist.playlist_id);
      setPlaylistItems(items || []);
      
      // Limpar seleção
      setSelectedMediasForPlaylist([]);
    } catch (error: any) {
      console.error('Erro ao adicionar mídias à playlist:', error);
      setError('Erro ao adicionar mídias à playlist: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeletePlaylist = async (index: number) => {
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir esta playlist?')) return;
    
    try {
      const playlist = editPlaylists[index];
      await playlistApi.delete(playlist.playlist_id);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir playlist:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir playlist');
    }
  };

  // ============================================================================
  // FUNÇÕES CRUD PARA CAMPANHAS
  // ============================================================================

  const handleAddCampaign = async () => {
    if (!selectedSubscriber || !editCampaignForm.title) {
      setError('Título da campanha é obrigatório');
      return;
    }

    // Validação prévia de limites (apenas para criação)
    if (editingEditCampaignIndex === null) {
      try {
        const validation = await subscriberApi.validatePlanLimits(selectedSubscriber.subscriber_id, 'campaign');
        if (!validation.valid) {
          setError(validation.message);
          return;
        }
      } catch (err: any) {
        console.error('Erro na validação prévia:', err);
        // Continuar mesmo se validação falhar (backend vai validar)
      }
    }

    try {
      if (editingEditCampaignIndex !== null) {
        const campaign = editCampaigns[editingEditCampaignIndex];
        const updateData: UpdateCampaignRequest = {
          ...editCampaignForm,
          mediaIds: campaignMedias.map(m => m.media_id),
          playlistIds: campaignPlaylists.map(p => p.playlist_id),
        };
        await campaignApi.update(campaign.campaign_id, updateData);
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditCampaignIndex(null);
        setCampaignMedias([]);
        setCampaignPlaylists([]);
      } else {
        await campaignApi.create({
          title: editCampaignForm.title || '',
          description: editCampaignForm.description,
          campaign_type: editCampaignForm.campaign_type || 'general',
          priority: editCampaignForm.priority || 1,
          contractId: editCampaignForm.contractId,
          subscriberId: selectedSubscriber.subscriber_id,
          mediaIds: campaignMedias.map(m => m.media_id),
          playlistIds: campaignPlaylists.map(p => p.playlist_id),
        } as CreateCampaignRequest);
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setCampaignMedias([]);
        setCampaignPlaylists([]);
      }
      setEditCampaignForm({ title: '', description: '', campaign_type: 'general', priority: 1, contractId: undefined, status: 'draft', isActive: true });
    } catch (error: any) {
      console.error('Erro ao salvar campanha:', error);
      setError(error?.response?.data?.error || 'Erro ao salvar campanha');
    }
  };

  const handleStartEditCampaign = async (index: number) => {
    const campaign = editCampaigns[index];
    setEditCampaignForm({
      title: campaign.title || '',
      description: campaign.description,
      campaign_type: campaign.campaign_type || 'general',
      priority: campaign.priority || 1,
      contractId: campaign.contract_id,
      status: campaign.status || 'draft',
      isActive: campaign.is_active !== undefined ? campaign.is_active : true,
    });
    setEditingEditCampaignIndex(index);
    
    // Carregar mídias e playlists associadas à campanha
    try {
      // Buscar mídias associadas
      const campaignMediasList = editMedias.filter(m => 
        campaign.mediaIds?.includes(m.media_id) || false
      );
      setCampaignMedias(campaignMediasList);
      
      // Buscar playlists associadas
      const campaignPlaylistsList = editPlaylists.filter(p => 
        campaign.playlistIds?.includes(p.playlist_id) || false
      );
      setCampaignPlaylists(campaignPlaylistsList);
    } catch (error) {
      console.error('Erro ao carregar conteúdo da campanha:', error);
      setCampaignMedias([]);
      setCampaignPlaylists([]);
    }
  };

  const handleDeleteCampaign = async (index: number) => {
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir esta campanha?')) return;
    
    try {
      const campaign = editCampaigns[index];
      await campaignApi.delete(campaign.campaign_id);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      console.error('Erro ao excluir campanha:', error);
      setError(error?.response?.data?.error || 'Erro ao excluir campanha');
    }
  };

  // Função auxiliar para validar email
  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === '') return true; // Email é opcional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  // Função auxiliar para validar telefone (formato básico: aceita números, +, -, espaços, parênteses)
  const validatePhone = (phone: string): boolean => {
    if (!phone || phone.trim() === '') return true; // Telefone é opcional
    const phoneRegex = /^[\d\s\+\-\(\)]+$/;
    return phoneRegex.test(phone.trim());
  };

  // Função para validar contrato
  const validateContract = (contractId: number | undefined): { valid: boolean; error?: string } => {
    if (!contractId || contractId <= 0) {
      // Contrato é opcional
      return { valid: true };
    }
    
    const contract = availableContracts.find(c => c.contract_id === contractId);
    if (!contract) {
      return { valid: false, error: 'Contrato selecionado não foi encontrado. Por favor, recarregue a lista de contratos.' };
    }

    // Validar se o contrato está ativo (se tiver end_date, verificar se ainda está válido)
    if (contract.end_date) {
      const endDate = new Date(contract.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (endDate < today) {
        return { valid: false, error: `O contrato "${contract.contract_number}" expirou em ${endDate.toLocaleDateString('pt-BR')}. Selecione um contrato válido.` };
      }
    }

    // Validar se o contrato tem subscriber_id (se não foi criado antes do subscriber)
    if (contract.subscriber_id && !contract.created_before_subscriber) {
      return { valid: false, error: `O contrato "${contract.contract_number}" já está vinculado a outro Assinante. Selecione um contrato disponível.` };
    }

    return { valid: true };
  };

  // NOVO: handleCreateSubscriber modificado para criar Subscriber baseado em contrato
  const handleCreateSubscriber = async () => {
    try {
      // Limpar erros anteriores
      setError(null);

      // Validação: nome do Subscriber é obrigatório
      if (!newSubscriber.name || newSubscriber.name.trim() === '') {
        setError('Nome do Assinante é obrigatório. Por favor, preencha o campo "Nome da Empresa / Razão Social".');
        setCreateTab(0); // Ir para aba de Informações
        return;
      }

      // Validação: nome deve ter pelo menos 3 caracteres
      if (newSubscriber.name.trim().length < 3) {
        setError('O nome do Assinante deve ter pelo menos 3 caracteres.');
        setCreateTab(0);
        return;
      }

      // Validação: contrato é opcional (se fornecido, precisa ser válido)
      const contractValidation = validateContract(newSubscriber.contract_id);
      if (!contractValidation.valid) {
        setError(contractValidation.error || 'Contrato inválido. Por favor, selecione um contrato válido.');
        setCreateTab(0);
        return;
      }

      // Validação: email (se fornecido)
      if (newSubscriber.email && newSubscriber.email.trim() !== '' && !validateEmail(newSubscriber.email)) {
        setError('Email inválido. Por favor, insira um endereço de email válido (exemplo: nome@empresa.com).');
        setCreateTab(0);
        return;
      }

      // Validação: telefone (se fornecido)
      if (newSubscriber.phone && newSubscriber.phone.trim() !== '' && !validatePhone(newSubscriber.phone)) {
        setError('Telefone inválido. Use apenas números, espaços, +, -, e parênteses.');
        setCreateTab(0);
        return;
      }

      // Validação: WhatsApp (se fornecido)
      if (newSubscriber.whatsapp && newSubscriber.whatsapp.trim() !== '' && !validatePhone(newSubscriber.whatsapp)) {
        setError('WhatsApp inválido. Use apenas números, espaços, +, -, e parênteses.');
        setCreateTab(0);
        return;
      }

      // 1. Criar o Subscriber (vinculado ao contrato)
      const createdSubscriber = await subscriberApi.create(newSubscriber);
      const subscriberId = createdSubscriber.subscriber_id;
      
      if (!subscriberId) {
        const errorMessage = 'Erro: Assinante criado mas não retornou ID válido. Por favor, entre em contato com o suporte.';
        console.error(errorMessage);
        setError(errorMessage);
        return;
      }

      // 2. NOTA: Subscribers não podem criar locais próprios
      // Locais pertencem apenas a publishers
      // Subscribers acessam locais através de planos e contratos
      const createdLocals: Local[] = [];
      // Removido: criação de locais para subscribers

      // 3. Criar os totens (usando os IDs dos locais criados)
      // O localId no totem é o índice do local na lista tempTotems
      const createdTotems: any[] = [];
      for (const totem of tempTotems) {
        const localIndex = totem.localId; // localId já é o índice
        if (localIndex >= 0 && localIndex < createdLocals.length && createdLocals[localIndex]) {
          const localId = createdLocals[localIndex].local_id;
          
          // Validar que temos name ou identifier (requisito do backend)
          if (!totem.name && !totem.identifier) {
            const errorMessage = `Totem na posição ${localIndex + 1}: Nome ou identificador é obrigatório`;
            console.error(errorMessage);
            setError(errorMessage);
            return;
          }
          
          // Validar que localId é um número válido
          if (!localId || isNaN(Number(localId))) {
            const errorMessage = `Totem na posição ${localIndex + 1}: Local ID inválido`;
            console.error(errorMessage, { localId, createdLocals });
            setError(errorMessage);
            return;
          }
          
          // Preparar dados do totem (identifier é obrigatório na interface, mas backend aceita name OU identifier)
          const totemData: any = {
            localId: Number(localId), // Garantir que é número
          };
          
          // Adicionar identifier OU name (backend requer pelo menos um)
          // Backend valida: identifier deve ter entre 2 e 100 caracteres se fornecido
          if (totem.identifier && totem.identifier.trim().length >= 2) {
            totemData.identifier = totem.identifier.trim();
          }
          if (totem.name && totem.name.trim().length >= 2) {
            totemData.name = totem.name.trim();
          }
          
          // Validar que temos pelo menos um (name ou identifier)
          if (!totemData.identifier && !totemData.name) {
            const errorMessage = `Totem na posição ${localIndex + 1}: Nome ou identificador é obrigatório e deve ter pelo menos 2 caracteres`;
            console.error(errorMessage, { identifier: totem.identifier, name: totem.name });
            setError(errorMessage);
            return;
          }
          
          // Adicionar campos opcionais apenas se tiverem valor
          if (totem.uin && totem.uin.trim()) {
            totemData.uin = totem.uin.trim();
          }
          if (totem.deviceId && totem.deviceId.trim()) {
            totemData.deviceId = totem.deviceId.trim();
          }
          if (totem.description && totem.description.trim()) {
            totemData.description = totem.description.trim();
          }
          if (totem.firmwareVersion && totem.firmwareVersion.trim()) {
            totemData.firmwareVersion = totem.firmwareVersion.trim();
          }
          
          try {
            const createdTotem = await totemApi.create(totemData);
            createdTotems.push(createdTotem);
          } catch (totemError: any) {
            console.error('Erro ao criar totem:', totemError);
            console.error('Response completa:', totemError?.response);
            console.error('Dados enviados:', totemData);
            
            let errorMessage = `Erro ao criar totem "${totem.identifier || totem.name}": `;
            
            if (totemError?.response?.data) {
              if (totemError.response.data.details && Array.isArray(totemError.response.data.details)) {
                const validationErrors = totemError.response.data.details
                  .map((detail: any) => detail.msg || detail.message || JSON.stringify(detail))
                  .join(', ');
                errorMessage += validationErrors;
              } else if (totemError.response.data.error) {
                errorMessage += totemError.response.data.error;
              } else if (totemError.response.data.message) {
                errorMessage += totemError.response.data.message;
              }
            } else if (totemError?.message) {
              errorMessage += totemError.message;
            } else {
              errorMessage += 'Erro desconhecido';
            }
            
            setError(errorMessage);
            return;
          }
        } else {
          const errorMessage = `Totem na posição ${localIndex + 1}: Local inválido ou não encontrado`;
          console.error(errorMessage, { localIndex, createdLocals });
          setError(errorMessage);
          return;
        }
      }

      // 4. Criar as Smart TVs (usando os IDs dos totens criados)
      // O totem_id na Smart TV é o índice do totem na lista tempTotems
      for (const smartTv of tempSmartTvs) {
        const totemIndex = smartTv.totem_id; // totem_id já é o índice
        if (totemIndex >= 0 && totemIndex < createdTotems.length && createdTotems[totemIndex]) {
          await smartTvApi.create({
            totem_id: createdTotems[totemIndex].totem_id,
            identifier: smartTv.identifier,
            device_id: smartTv.device_id,
            name: smartTv.name,
            brand: smartTv.brand,
            model: smartTv.model,
            platform: smartTv.platform,
            firmware_version: smartTv.firmware_version,
            resolution_width: smartTv.resolution_width,
            resolution_height: smartTv.resolution_height,
            orientation: smartTv.orientation,
          });
        }
      }

      // Subscribers não são criados aqui - são gerenciados separadamente

      // Sucesso: limpar estados
      setCreateDialogOpen(false);
      setCreateTab(0);
      setError(null);
      setNewSubscriber({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        whatsapp: '',
        address: '',
        description: '',
        contract_id: undefined,
      });
      setTempLocals([]);
      setTempTotems([]);
      setTempSmartTvs([]);
      setLocalForm({
        publisher_id: 0,
        name: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        country: '',
        description: '',
      });
      setTotemForm({
        tempId: '',
        identifier: '',
        localId: 0,
        uin: '',
        deviceId: '',
        name: '',
        description: '',
        firmwareVersion: '',
      });
      setSmartTvForm({
        tempId: '',
        totem_id: 0,
        identifier: '',
        device_id: '',
        name: '',
        brand: '',
        model: '',
        platform: '',
        firmware_version: '',
        resolution_width: undefined,
        resolution_height: undefined,
        orientation: 'landscape',
      });
      
      loadSubscribers();
    } catch (error: any) {
      console.error('Erro ao criar Subscriber:', error);
      
      // Melhorar tratamento de erro para mostrar detalhes completos
      let errorMessage = 'Erro ao criar Subscriber';
      
      if (error?.response?.data) {
        // Erro de validação do backend
        if (error.response.data.details && Array.isArray(error.response.data.details)) {
          const validationErrors = error.response.data.details
            .map((detail: any) => detail.msg || detail.message || JSON.stringify(detail))
            .join(', ');
          errorMessage = `Dados inválidos: ${validationErrors}`;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Se for erro de validação, voltar para aba de Informações
      if (error?.response?.status === 400) {
        setCreateTab(0);
      }
    }
  };

  const handleEditSubscriber = async () => {
    if (!selectedSubscriber) return;
    
    try {
      const updateData: UpdateSubscriberRequest = {
        name: selectedSubscriber.name,
        contact_name: selectedSubscriber.contact_name,
        email: selectedSubscriber.email,
        phone: selectedSubscriber.phone,
        whatsapp: selectedSubscriber.whatsapp,
        category_segment: selectedSubscriber.category_segment,
        description: selectedSubscriber.description,
        isActive: selectedSubscriber.is_active,
      };
      await subscriberApi.update(selectedSubscriber.subscriber_id, updateData);
      setEditDialogOpen(false);
      setEditTab(0);
      // Limpar estados de edição
      setEditMedias([]);
      setEditPlaylists([]);
      setEditCampaigns([]);
      setEditingEditMediaIndex(null);
      setEditingEditPlaylistIndex(null);
      setEditingEditCampaignIndex(null);
      setActiveContracts([]);
      setSelectedSubscriber(null);
      loadSubscribers();
    } catch (error: any) {
      console.error('Erro ao atualizar Subscriber:', error);
      setError(error?.response?.data?.error || error?.message || 'Erro ao atualizar Assinante');
    }
  };

  const handleDeleteSubscriber = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este Assinante?')) {
      try {
        await subscriberApi.delete(id);
        loadSubscribers();
      } catch (error: any) {
        console.error('Erro ao excluir Subscriber:', error);
        setError(error?.response?.data?.error || error?.message || 'Erro ao excluir Subscriber');
      }
    }
  };

  const handleViewDetails = async (Subscriber: Subscriber) => {
    setSelectedSubscriber(Subscriber);
    await loadSubscriberStats(Subscriber.subscriber_id);
    setDetailsDialogOpen(true);
    setDetailsTab(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getClientTypeLabel = (clientType?: string) => {
    switch (clientType) {
      case 'subscriber': return 'Assinante';
      case 'Subscriber': return 'Assinante';
      case 'both': return 'Ambos';
      default: return 'N/A';
    }
  };

  const getClientTypeColor = (clientType?: string) => {
    switch (clientType) {
      case 'subscriber': return 'primary';
      case 'Subscriber': return 'success';
      case 'both': return 'warning';
      default: return 'default';
    }
  };

  // Evitar mostrar a tela vazia enquanto carrega a primeira página
  if (loading && Subscribers.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando Assinantes...
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
            📢 Anunciantes
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie anunciantes e suas informações, mídias, playlists, campanhas e contratos
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

      {/* Resumo */}
      {overallStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <People sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {overallStats.total}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <CheckCircle sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {overallStats.active}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ativos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <ErrorIcon sx={{ fontSize: 40, color: theme.palette.error.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {overallStats.inactive}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Inativos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <VideoLibrary sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {overallStats.totalMedias}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mídias
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <QueueMusic sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {overallStats.totalPlaylists}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Playlists
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Card sx={{ textAlign: 'center', py: 2 }}>
              <CardContent>
                <CampaignIcon sx={{ fontSize: 40, color: theme.palette.secondary.main, mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {overallStats.totalCampaigns}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Campanhas
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar Assinantes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    loadSubscribers();
                  }
                }}
                InputProps={{
                  startAdornment: <Business sx={{ mr: 1, color: theme.palette.text.secondary }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={activeOnlyFilter ? 'active' : 'all'}
                  label="Status"
                  onChange={(e) => setActiveOnlyFilter(e.target.value === 'active')}
                >
                  <MenuItem value="active">Ativos</MenuItem>
                  <MenuItem value="all">Todos</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadSubscribers}
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

      {/* Subscribers Grid */}
      <Grid container spacing={3}>
        {Subscribers.map((Subscriber) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={Subscriber.subscriber_id}>
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
                  label={Subscriber.is_active ? 'Ativo' : 'Inativo'}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(Subscriber.is_active ? theme.palette.success.main : theme.palette.error.main, 0.1),
                    color: Subscriber.is_active ? theme.palette.success.main : theme.palette.error.main,
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
                    Criado em {Subscriber.created_at ? formatDate(Subscriber.created_at) : 'N/A'}
                  </Typography>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {Subscriber.name}
                </Typography>
                
                <Chip
                  label={'Assinante'}
                  size="small"
                  color={'primary' as any}
                  sx={{ mb: 1 }}
                />
                
                {Subscriber.contact_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <People fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      Contato: {Subscriber.contact_name}
                    </Typography>
                  </Box>
                )}

                {Subscriber.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Email fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {Subscriber.email}
                    </Typography>
                  </Box>
                )}

                {Subscriber.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      {Subscriber.phone}
                    </Typography>
                  </Box>
                )}

                {Subscriber.whatsapp && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                    <Phone fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }} noWrap>
                      WhatsApp: {Subscriber.whatsapp}
                    </Typography>
                  </Box>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleViewDetails(Subscriber)}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    Detalhes
                  </Button>
                  
                  <Box>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={async () => {
                        setSelectedSubscriber(Subscriber);
                        setEditDialogOpen(true);
                        // Carregar dados ao abrir o dialog
                        await loadSubscriberDataForEdit(Subscriber.subscriber_id);
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeleteSubscriber(Subscriber.subscriber_id)}>
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

      {/* Paginação */}
      {total > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 2 }}>
          <Stack spacing={2}>
            <Pagination
              count={Math.ceil(total / limit)}
              page={page}
              onChange={(_, value) => {
                setPage(value);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
            />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total} assinantes
            </Typography>
          </Stack>
        </Box>
      )}

      {/* Empty State */}
      {Subscribers.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Business sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhum Assinante encontrado
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros Assinantes
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

      {/* Create Dialog com Abas */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => {
          setCreateDialogOpen(false);
          setCreateTab(0);
          setTempLocals([]);
          setTempTotems([]);
          setTempSmartTvs([]);
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Adicionar Assinante</DialogTitle>
        <DialogContent>
          <Tabs value={createTab} onChange={(_, newValue) => setCreateTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab label="Locais" icon={tempLocals.length > 0 ? <Chip label={tempLocals.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Totens" icon={tempTotems.length > 0 ? <Chip label={tempTotems.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Smart TVs" icon={tempSmartTvs.length > 0 ? <Chip label={tempSmartTvs.length} size="small" color="primary" /> : undefined} iconPosition="end" />
          </Tabs>

          {/* Aba Informações */}
          {createTab === 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Assinante</Typography>
              
              {/* Campo de seleção de contrato - OPCIONAL */}
              <FormControl fullWidth margin="normal">
                <InputLabel>Contrato (opcional)</InputLabel>
                <Select
                  value={newSubscriber.contract_id || ''}
                  label="Contrato (opcional)"
                  onChange={(e) => setNewSubscriber({ ...newSubscriber, contract_id: e.target.value ? Number(e.target.value) : undefined })}
                  disabled={loadingContracts}
                >
                  {loadingContracts ? (
                    <MenuItem disabled>Carregando contratos...</MenuItem>
                  ) : (
                    <>
                      <MenuItem value="">Nenhum</MenuItem>
                      {availableContracts.map((contract) => (
                      <MenuItem key={contract.contract_id} value={contract.contract_id}>
                        {contract.contract_number} - {contract.title} {contract.created_before_subscriber ? '(Pré-criado)' : ''}
                      </MenuItem>
                      ))}
                    </>
                  )}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                  {newSubscriber.contract_id
                    ? `Contrato selecionado: ${availableContracts.find(c => c.contract_id === newSubscriber.contract_id)?.title || 'N/A'}`
                    : 'Você pode criar o anunciante sem contrato e criar/vincular contratos depois.'}
                </Typography>
              </FormControl>

              {availableContracts.length === 0 && !loadingContracts && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Nenhum pré-contrato disponível no momento (opcional). Você pode criar o anunciante normalmente e criar contratos depois.
                </Alert>
              )}
              
              <TextField
                fullWidth
                label="Nome da Empresa / Razão Social"
                value={newSubscriber.name}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, name: e.target.value })}
                margin="normal"
                required
                helperText="Nome completo da empresa ou razão social"
              />
              <TextField
                fullWidth
                label="Nome do Contato"
                value={newSubscriber.contact_name}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, contact_name: e.target.value })}
                margin="normal"
                helperText="Nome da pessoa responsável pelo contato"
              />
              <TextField
                fullWidth
                id="subscriber-create-category-segment"
                name="category_segment"
                label="Categoria/Segmento"
                value={newSubscriber.category_segment || ''}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, category_segment: e.target.value })}
                margin="normal"
                helperText="Ex.: Farmácia, Cinema, Shopping..."
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={newSubscriber.email || ''}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
                margin="normal"
                error={newSubscriber.email ? !validateEmail(newSubscriber.email) : false}
                helperText={
                  newSubscriber.email && !validateEmail(newSubscriber.email)
                    ? 'Email inválido. Use o formato: nome@empresa.com'
                    : 'Email de contato (opcional)'
                }
              />
              <TextField
                fullWidth
                label="Telefone"
                value={newSubscriber.phone || ''}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, phone: e.target.value })}
                margin="normal"
                error={newSubscriber.phone ? !validatePhone(newSubscriber.phone) : false}
                helperText={
                  newSubscriber.phone && !validatePhone(newSubscriber.phone)
                    ? 'Telefone inválido. Use apenas números, espaços, +, -, e parênteses'
                    : 'Telefone comercial (formato: +55 11 1234-5678) - opcional'
                }
              />
              <TextField
                fullWidth
                label="WhatsApp"
                value={newSubscriber.whatsapp || ''}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, whatsapp: e.target.value })}
                margin="normal"
                error={newSubscriber.whatsapp ? !validatePhone(newSubscriber.whatsapp) : false}
                helperText={
                  newSubscriber.whatsapp && !validatePhone(newSubscriber.whatsapp)
                    ? 'WhatsApp inválido. Use apenas números, espaços, +, -, e parênteses'
                    : 'Número do WhatsApp (formato: +55 11 98765-4321) - opcional'
                }
              />
              <TextField
                fullWidth
                label="Descrição"
                value={newSubscriber.description}
                onChange={(e) => setNewSubscriber({ ...newSubscriber, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
              <Alert severity="info" sx={{ mt: 2 }}>
                Tipo: Assinante - Este assinante pode criar mídias, playlists e campanhas vinculadas a contratos.
              </Alert>

            </Box>
          )}

          {/* Aba Locais - REMOVIDA: Subscribers não criam locais próprios */}
          {createTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Nota:</strong> Assinantes não criam locais próprios. 
                Locais pertencem apenas a Publishers. 
                Assinantes acessam locais através de planos e contratos.
              </Alert>
              
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Local</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome do Local *"
                      value={localForm.name}
                      onChange={(e) => setLocalForm({ ...localForm, name: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Endereço"
                      value={localForm.address || ''}
                      onChange={(e) => setLocalForm({ ...localForm, address: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Cidade"
                      value={localForm.city || ''}
                      onChange={(e) => setLocalForm({ ...localForm, city: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Estado"
                      value={localForm.state || ''}
                      onChange={(e) => setLocalForm({ ...localForm, state: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="CEP"
                      value={localForm.zip_code || ''}
                      onChange={(e) => setLocalForm({ ...localForm, zip_code: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={localForm.description || ''}
                      onChange={(e) => setLocalForm({ ...localForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddLocal}
                      disabled={!localForm.name}
                    >
                      {editingLocalIndex !== null ? 'Atualizar Local' : 'Adicionar Local'}
                    </Button>
                    {editingLocalIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingLocalIndex(null);
                          setLocalForm({
                            publisher_id: 0,
                            name: '',
                            address: '',
                            city: '',
                            state: '',
                            zip_code: '',
                            country: '',
                            description: '',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {tempLocals.length > 0 ? (
                <List>
                  {tempLocals.map((local, index) => (
                    <ListItem key={index} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                      <ListItemIcon><Store /></ListItemIcon>
                      <ListItemText
                        primary={local.name}
                        secondary={`${local.address || ''} ${local.city || ''} ${local.state || ''}`.trim() || 'Sem endereço'}
                      />
                      <IconButton size="small" onClick={() => handleEditLocal(index)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteLocal(index)}>
                        <Delete />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">Nenhum local cadastrado ainda. Adicione ao menos 1 local.</Alert>
              )}
            </Box>
          )}

          {/* Aba Totens */}
          {createTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Totens {tempTotems.length > 0 && `(${tempTotems.length})`}
              </Typography>
              {tempLocals.length === 0 ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Você precisa cadastrar ao menos 1 local na aba "Locais" antes de adicionar totens.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Os totens (players) devem estar atrelados a um local. Selecione um local no campo abaixo.
                  <strong> Nota:</strong> Os totens são players com player embutido.
                </Alert>
              )}

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Totem</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Local *</InputLabel>
                      <Select
                        value={totemForm.localId}
                        label="Local *"
                        onChange={(e) => setTotemForm({ ...totemForm, localId: Number(e.target.value) })}
                      >
                        {tempLocals.map((local, index) => (
                          <MenuItem key={index} value={index}>
                            {local.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Identifier *"
                      value={totemForm.identifier}
                      onChange={(e) => setTotemForm({ ...totemForm, identifier: e.target.value })}
                      size="small"
                      required
                      helperText="Identificador único do totem"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome"
                      value={totemForm.name || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, name: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Device ID"
                      value={totemForm.deviceId || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, deviceId: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="UIN"
                      value={totemForm.uin || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, uin: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Firmware Version"
                      value={totemForm.firmwareVersion || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, firmwareVersion: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={totemForm.description || ''}
                      onChange={(e) => setTotemForm({ ...totemForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddTotem}
                      disabled={!totemForm.identifier || tempLocals.length === 0 || totemForm.localId < 0 || totemForm.localId >= tempLocals.length}
                    >
                      {editingTotemIndex !== null ? 'Atualizar Totem' : 'Adicionar Totem'}
                    </Button>
                    {editingTotemIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingTotemIndex(null);
                          setTotemForm({
                            tempId: '',
                            identifier: '',
                            localId: 0,
                            uin: '',
                            deviceId: '',
                            name: '',
                            description: '',
                            firmwareVersion: '',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {tempTotems.length > 0 ? (
                <List>
                  {tempTotems.map((totem, index) => {
                    const localName = tempLocals[totem.localId]?.name || 'Local não encontrado';
                    return (
                      <ListItem key={totem.tempId || index} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                        <ListItemIcon><Computer /></ListItemIcon>
                        <ListItemText
                          primary={totem.name || totem.identifier}
                          secondary={`Local: ${localName} | Identifier: ${totem.identifier}`}
                        />
                        <IconButton size="small" onClick={() => handleEditTotem(index)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteTotem(index)}>
                          <Delete />
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {tempLocals.length === 0 
                    ? 'Cadastre locais na aba "Locais" para poder adicionar totens (players).'
                    : 'Nenhum totem cadastrado ainda. Os totens são players com player embutido.'}
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Smart TVs */}
          {createTab === 3 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Smart TVs {tempSmartTvs.length > 0 && `(${tempSmartTvs.length})`}
              </Typography>
              {tempTotems.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Para adicionar Smart TVs, você precisa cadastrar ao menos 1 totem na aba "Totens". 
                  <strong> Nota:</strong> As Smart TVs são opcionais - o próprio totem já possui um player embutido.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  As Smart TVs são opcionais e devem estar atreladas a um totem. 
                  <strong> Nota:</strong> O totem já possui um player embutido, então as Smart TVs são apenas para conectividade adicional.
                </Alert>
              )}

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>Adicionar Smart TV</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Totem *</InputLabel>
                      <Select
                        value={smartTvForm.totem_id}
                        label="Totem *"
                        onChange={(e) => setSmartTvForm({ ...smartTvForm, totem_id: Number(e.target.value) })}
                      >
                        {tempTotems.map((totem, index) => (
                          <MenuItem key={totem.tempId || index} value={index}>
                            {totem.name || totem.identifier} {tempLocals[totem.localId] && `(${tempLocals[totem.localId].name})`}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Identifier *"
                      value={smartTvForm.identifier}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, identifier: e.target.value })}
                      size="small"
                      required
                      helperText="Identificador único da Smart TV"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome"
                      value={smartTvForm.name || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, name: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Device ID"
                      value={smartTvForm.device_id || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, device_id: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Marca"
                      value={smartTvForm.brand || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, brand: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Modelo"
                      value={smartTvForm.model || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, model: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Plataforma"
                      value={smartTvForm.platform || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, platform: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Versão do Firmware"
                      value={smartTvForm.firmware_version || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, firmware_version: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Largura (px)"
                      type="number"
                      value={smartTvForm.resolution_width || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, resolution_width: e.target.value ? Number(e.target.value) : undefined })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Altura (px)"
                      type="number"
                      value={smartTvForm.resolution_height || ''}
                      onChange={(e) => setSmartTvForm({ ...smartTvForm, resolution_height: e.target.value ? Number(e.target.value) : undefined })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Orientação</InputLabel>
                      <Select
                        value={smartTvForm.orientation || 'landscape'}
                        label="Orientações"
                        onChange={(e) => setSmartTvForm({ ...smartTvForm, orientation: e.target.value as 'landscape' | 'portrait' })}
                      >
                        <MenuItem value="landscape">Paisagem</MenuItem>
                        <MenuItem value="portrait">Retrato</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddSmartTv}
                      disabled={!smartTvForm.identifier || tempTotems.length === 0 || smartTvForm.totem_id < 0 || smartTvForm.totem_id >= tempTotems.length}
                    >
                      {editingSmartTvIndex !== null ? 'Atualizar Smart TV' : 'Adicionar Smart TV'}
                    </Button>
                    {editingSmartTvIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingSmartTvIndex(null);
                          setSmartTvForm({
                            tempId: '',
                            totem_id: 0,
                            identifier: '',
                            device_id: '',
                            name: '',
                            brand: '',
                            model: '',
                            platform: '',
                            firmware_version: '',
                            resolution_width: undefined,
                            resolution_height: undefined,
                            orientation: 'landscape',
                          });
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {tempSmartTvs.length > 0 ? (
                <List>
                  {tempSmartTvs.map((smartTv, index) => {
                    const totemName = tempTotems[smartTv.totem_id]?.name || tempTotems[smartTv.totem_id]?.identifier || 'Totem não encontrado';
                    return (
                      <ListItem key={smartTv.tempId || index} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                        <ListItemIcon><Tv /></ListItemIcon>
                        <ListItemText
                          primary={smartTv.name || smartTv.identifier}
                          secondary={`Totem: ${totemName} | Identifier: ${smartTv.identifier}${smartTv.brand ? ` | ${smartTv.brand} ${smartTv.model || ''}` : ''}`}
                        />
                        <IconButton size="small" onClick={() => handleEditSmartTv(index)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteSmartTv(index)}>
                          <Delete />
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {tempTotems.length === 0 
                    ? 'Cadastre totens na aba "Totens" para poder adicionar Smart TVs. Lembre-se: o totem já possui um player embutido, então as Smart TVs são opcionais.'
                    : 'Nenhuma Smart TV cadastrada ainda. As Smart TVs são opcionais - o totem já possui um player embutido.'}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setCreateTab(0);
          setTempLocals([]);
          setTempTotems([]);
          setTempSmartTvs([]);
        }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSubscriber}
            disabled={!newSubscriber.name}
          >
            Criar Assinante
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog com Abas */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => {
          setEditDialogOpen(false);
          setEditTab(0);
          setEditMedias([]);
          setEditPlaylists([]);
          setEditCampaigns([]);
          setEditingEditMediaIndex(null);
          setEditingEditPlaylistIndex(null);
          setEditingEditCampaignIndex(null);
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Editar Assinante - {selectedSubscriber?.name || ''}
        </DialogTitle>
        <DialogContent>
          <Tabs value={editTab} onChange={(_, newValue) => setEditTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            <Tab 
              label="Mídias" 
              icon={editMedias.length > 0 ? <Chip label={editMedias.length} size="small" color="primary" /> : undefined} 
              iconPosition="end" 
            />
            <Tab 
              label="Playlists" 
              icon={editPlaylists.length > 0 ? <Chip label={editPlaylists.length} size="small" color="primary" /> : undefined} 
              iconPosition="end" 
            />
            <Tab 
              label="Campanhas" 
              icon={editCampaigns.length > 0 ? <Chip label={editCampaigns.length} size="small" color="primary" /> : undefined} 
              iconPosition="end" 
            />
          </Tabs>

          {/* Aba Informações */}
          {editTab === 0 && selectedSubscriber && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados do Assinante</Typography>
              <TextField
                fullWidth
                label="Nome da Empresa / Razão Social"
                value={selectedSubscriber.name || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, name: e.target.value })}
                margin="normal"
                required
                helperText="Nome completo da empresa ou razão social"
              />
              <TextField
                fullWidth
                label="Nome do Contato"
                value={selectedSubscriber.contact_name || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, contact_name: e.target.value })}
                margin="normal"
                helperText="Nome da pessoa responsável pelo contato"
              />
              <TextField
                fullWidth
                id="subscriber-edit-category-segment"
                name="category_segment"
                label="Categoria/Segmento"
                value={selectedSubscriber.category_segment || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, category_segment: e.target.value })}
                margin="normal"
                helperText="Ex.: Farmácia, Cinema, Shopping..."
              />
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={selectedSubscriber.email || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, email: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Telefone"
                value={selectedSubscriber.phone || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, phone: e.target.value })}
                margin="normal"
                helperText="Telefone comercial (formato: +55 11 1234-5678)"
              />
              <TextField
                fullWidth
                label="WhatsApp"
                value={selectedSubscriber.whatsapp || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, whatsapp: e.target.value })}
                margin="normal"
                helperText="Número do WhatsApp (formato: +55 11 98765-4321)"
              />
              <TextField
                fullWidth
                label="Descrição"
                value={selectedSubscriber.description || ''}
                onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                Tipo: Assinante - Este assinante pode criar mídias, playlists e campanhas vinculadas a contratos.
              </Alert>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedSubscriber.is_active ? 'active' : 'inactive'}
                  label="Status"
                  onChange={(e) => setSelectedSubscriber({ ...selectedSubscriber, is_active: e.target.value === 'active' })}
                >
                  <MenuItem value="active">Ativo</MenuItem>
                  <MenuItem value="inactive">Inativo</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {/* Aba Mídias */}
          {editTab === 1 && selectedSubscriber && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Mídias {editMedias.length > 0 && `(${editMedias.length})`}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<CloudUpload />}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Adicionar Mídia
                </Button>
              </Box>

              {editingEditMediaIndex !== null && (
                <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>Editar Mídia</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Nome *"
                        value={editMediaForm.name}
                        onChange={(e) => setEditMediaForm({ ...editMediaForm, name: e.target.value })}
                        size="small"
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Descrição"
                        value={editMediaForm.description || ''}
                        onChange={(e) => setEditMediaForm({ ...editMediaForm, description: e.target.value })}
                        size="small"
                        multiline
                        rows={2}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Tags (separadas por vírgula)"
                        value={Array.isArray(editMediaForm.tags) ? editMediaForm.tags.join(', ') : ''}
                        onChange={(e) => setEditMediaForm({ 
                          ...editMediaForm, 
                          tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) 
                        })}
                        size="small"
                        helperText="Ex: promoção, verão, 2024"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button variant="contained" onClick={handleEditMedia} sx={{ mr: 1 }}>
                        Salvar
                      </Button>
                      <Button variant="outlined" onClick={() => {
                        setEditingEditMediaIndex(null);
                        setEditMediaForm({ name: '', description: '', tags: [] });
                      }}>
                        Cancelar
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {editMedias.length > 0 ? (
                <Grid container spacing={2}>
                  {editMedias.map((media, index) => {
                    let previewUrl = media.thumbnailUrl || media.previewUrl || media.file_path;
                    if (previewUrl && previewUrl.startsWith('/opt/smart-signage/public/assets/')) {
                      previewUrl = previewUrl.replace('/opt/smart-signage/public/assets/', '/assets/');
                    }
                    
                    return (
                      <Grid item xs={12} sm={6} md={4} key={media.media_id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Box sx={{ position: 'relative', height: 150, bgcolor: theme.palette.grey[100], overflow: 'hidden' }}>
                            {previewUrl && media.media_type === 'image' ? (
                              <Box
                                component="img"
                                src={previewUrl}
                                alt={media.name}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : previewUrl && media.media_type === 'video' ? (
                              <Box
                                component="video"
                                src={previewUrl}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                muted
                                onMouseEnter={(e: any) => e.target.play()}
                                onMouseLeave={(e: any) => { e.target.pause(); e.target.currentTime = 0; }}
                              />
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Avatar sx={{ bgcolor: alpha(getMediaTypeColor(media.media_type), 0.1), color: getMediaTypeColor(media.media_type), width: 64, height: 64 }}>
                                  {getMediaIcon(media.media_type)}
                                </Avatar>
                              </Box>
                            )}
                            <Chip
                              label={media.status || 'draft'}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                bgcolor: alpha(theme.palette.common.black, 0.7),
                                color: 'white',
                              }}
                            />
                          </Box>
                          <CardContent sx={{ flexGrow: 1, p: 2 }}>
                            <Typography variant="subtitle2" fontWeight="bold" noWrap>
                              {media.name}
                            </Typography>
                            {media.description && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }} noWrap>
                                {media.description}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                              <Chip
                                icon={getMediaIcon(media.media_type)}
                                label={media.media_type?.toUpperCase() || 'MÍDIA'}
                                size="small"
                                sx={{ bgcolor: alpha(getMediaTypeColor(media.media_type), 0.1), color: getMediaTypeColor(media.media_type) }}
                              />
                              {media.size_bytes && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatFileSize(media.size_bytes)}
                                </Typography>
                              )}
                              {media.duration_seconds && (
                                <Typography variant="caption" color="text.secondary">
                                  {formatDuration(media.duration_seconds)}
                                </Typography>
                              )}
                            </Box>
                          </CardContent>
                          <Box sx={{ p: 1, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <IconButton size="small" onClick={() => handleStartEditMedia(index)}>
                              <Edit />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDeleteMedia(index)}>
                              <Delete />
                            </IconButton>
                          </Box>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              ) : (
                <Alert severity="info">
                  Nenhuma mídia cadastrada ainda. Clique em "Adicionar Mídia" para fazer upload de arquivos.
                </Alert>
              )}

              <MediaUploadDialog
                open={uploadDialogOpen}
                onClose={() => setUploadDialogOpen(false)}
                onSuccess={handleUploadMediaSuccess}
                isAdmin={false}
                userSubscriberId={selectedSubscriber.subscriber_id}
              />
            </Box>
          )}

          {/* Aba Playlists */}
          {editTab === 2 && selectedSubscriber && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Playlists {editPlaylists.length > 0 && `(${editPlaylists.length})`}
              </Typography>

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: editingEditPlaylistIndex !== null ? alpha(theme.palette.primary.main, 0.05) : 'transparent' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  {editingEditPlaylistIndex !== null ? 'Editar Playlist' : 'Adicionar Playlist'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Nome *"
                      value={editPlaylistForm.name}
                      onChange={(e) => setEditPlaylistForm({ ...editPlaylistForm, name: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={editPlaylistForm.isActive ? 'active' : 'inactive'}
                        label="Status"
                        onChange={(e) => setEditPlaylistForm({ ...editPlaylistForm, isActive: e.target.value === 'active' })}
                      >
                        <MenuItem value="active">Ativa</MenuItem>
                        <MenuItem value="inactive">Inativa</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={editPlaylistForm.description || ''}
                      onChange={(e) => setEditPlaylistForm({ ...editPlaylistForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddPlaylist}
                      disabled={!editPlaylistForm.name}
                    >
                      {editingEditPlaylistIndex !== null ? 'Atualizar Playlist' : 'Adicionar Playlist'}
                    </Button>
                    {editingEditPlaylistIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingEditPlaylistIndex(null);
                          setEditPlaylistForm({ name: '', description: '', isActive: true });
                          setPlaylistItems([]);
                          setSelectedMediasForPlaylist([]);
                          setEditingItemDuration(null);
                          setTempItemDuration({});
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {/* Seção para adicionar mídias à playlist */}
              {editingEditPlaylistIndex !== null && (
                <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: alpha(theme.palette.info.main, 0.05) }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Adicionar Mídias à Playlist
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Autocomplete
                        multiple
                        options={editMedias.filter(m => m.isActive)}
                        getOptionLabel={(option) => option.name || `Mídia ${option.media_id}`}
                        value={editMedias.filter(m => selectedMediasForPlaylist.includes(m.media_id))}
                        onChange={(_, newValue) => {
                          setSelectedMediasForPlaylist(newValue.map(m => m.media_id));
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Selecionar Mídias"
                            placeholder="Escolha as mídias para adicionar"
                            size="small"
                          />
                        )}
                        renderOption={(props, option) => (
                          <li {...props} key={option.media_id}>
                            <Checkbox
                              checked={selectedMediasForPlaylist.includes(option.media_id)}
                            />
                            <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                              {(() => {
                                const mediaType = (option as any).mediaType || option.media_type;
                                return (
                                  <>
                                    {mediaType === 'image' && <ImageIcon fontSize="small" />}
                                    {mediaType === 'video' && <VideoLibrary fontSize="small" />}
                                    {mediaType === 'audio' && <AudioFile fontSize="small" />}
                                    <Typography>{option.name}</Typography>
                                    {mediaType && (
                                      <Chip label={mediaType} size="small" variant="outlined" />
                                    )}
                                  </>
                                );
                              })()}
                            </Box>
                          </li>
                        )}
                        filterSelectedOptions
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Duração por Item (segundos)"
                        type="number"
                        value={defaultPlaylistItemDuration}
                        onChange={(e) => setDefaultPlaylistItemDuration(parseInt(e.target.value) || 10)}
                        size="small"
                        inputProps={{ min: 1, max: 300 }}
                        helperText="Duração padrão para as mídias adicionadas (1-300 segundos)"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={handleAddMediasToPlaylist}
                        disabled={selectedMediasForPlaylist.length === 0}
                        fullWidth
                        sx={{ mt: 1 }}
                      >
                        Adicionar {selectedMediasForPlaylist.length > 0 ? `${selectedMediasForPlaylist.length} ` : ''}Mídia{selectedMediasForPlaylist.length !== 1 ? 's' : ''}
                      </Button>
                    </Grid>
                  </Grid>
                  
                  {editMedias.filter(m => m.isActive).length === 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      Nenhuma mídia ativa disponível. Faça upload de mídias na aba "Mídias" primeiro.
                    </Alert>
                  )}
                </Box>
              )}

              {editingEditPlaylistIndex !== null && playlistItems.length > 0 && (
                <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>Itens da Playlist ({playlistItems.length})</Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Arraste os itens para reordenar a playlist. Clique e segure no ícone de arrastar (⋮⋮) para mover.
                  </Alert>
                  <List>
                    {playlistItems.map((item, index) => {
                      const durationMs = (item as any).display_seconds || (item as any).display_duration || 10000;
                      const durationSec = Math.round(durationMs / 1000);
                      const isEditing = editingItemDuration === item.item_id;
                      const tempDuration = tempItemDuration[item.item_id] ?? durationSec;
                      const isDragging = draggedItemIndex === index;

                      return (
                        <ListItem
                          key={item.item_id || index}
                          sx={{
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1,
                            mb: 1,
                            cursor: 'move',
                            opacity: isDragging ? 0.5 : 1,
                            bgcolor: isDragging ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.05),
                            },
                          }}
                          draggable
                          onDragStart={(e) => {
                            setDraggedItemIndex(index);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', index.toString());
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={async (e) => {
                            e.preventDefault();
                            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
                            const targetIndex = index;

                            if (draggedIndex === targetIndex) {
                              setDraggedItemIndex(null);
                              return;
                            }

                            try {
                              const playlist = editPlaylists[editingEditPlaylistIndex!];
                              const reorderedItems = [...playlistItems];
                              const [removed] = reorderedItems.splice(draggedIndex, 1);
                              reorderedItems.splice(targetIndex, 0, removed);

                              // Atualizar order_index de cada item
                              const itemsToReorder = reorderedItems.map((item, idx) => ({
                                itemId: item.item_id,
                                orderIndex: idx + 1,
                              }));

                              await playlistApi.reorderMedia(playlist.playlist_id, itemsToReorder);
                              await handleStartEditPlaylist(editingEditPlaylistIndex!);
                            } catch (error: any) {
                              console.error('Erro ao reordenar itens:', error);
                              setError('Erro ao reordenar itens: ' + (error.response?.data?.error || error.message));
                            } finally {
                              setDraggedItemIndex(null);
                            }
                          }}
                          onDragEnd={() => {
                            setDraggedItemIndex(null);
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              cursor: 'grab',
                              '&:active': {
                                cursor: 'grabbing',
                              },
                            }}
                          >
                            <DragIndicator />
                          </ListItemIcon>
                          <ListItemText
                            primary={(item as any).mediaName || (item as any).media_name || `Item ${index + 1}`}
                            secondary={`Ordem: ${item.order_index !== undefined ? item.order_index : index + 1}`}
                            sx={{ flex: 1 }}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                            {isEditing ? (
                              <>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={tempDuration}
                                  onChange={(e) => setTempItemDuration({ ...tempItemDuration, [item.item_id]: parseInt(e.target.value) || 10 })}
                                  inputProps={{ min: 1, max: 300 }}
                                  sx={{ width: '80px' }}
                                />
                                <Typography variant="caption">s</Typography>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={async () => {
                                    try {
                                      const playlist = editPlaylists[editingEditPlaylistIndex!];
                                      await playlistApi.updateItemDuration(
                                        playlist.playlist_id,
                                        item.item_id,
                                        tempDuration * 1000 // Converter para milissegundos
                                      );
                                      await handleStartEditPlaylist(editingEditPlaylistIndex!);
                                      setEditingItemDuration(null);
                                      setTempItemDuration({});
                                    } catch (error: any) {
                                      console.error('Erro ao atualizar duração:', error);
                                      setError('Erro ao atualizar duração: ' + (error.response?.data?.error || error.message));
                                    }
                                  }}
                                >
                                  <CheckCircle fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingItemDuration(null);
                                    const newTemp = { ...tempItemDuration };
                                    delete newTemp[item.item_id];
                                    setTempItemDuration(newTemp);
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </>
                            ) : (
                              <>
                                <Typography variant="body2" color="text.secondary">
                                  {durationSec}s
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingItemDuration(item.item_id);
                                    setTempItemDuration({ ...tempItemDuration, [item.item_id]: durationSec });
                                  }}
                                  title="Editar duração"
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </>
                            )}
                          </Box>
                          <IconButton size="small" onClick={async () => {
                            if (!window.confirm('Tem certeza que deseja remover este item da playlist?')) return;
                            try {
                              const playlist = editPlaylists[editingEditPlaylistIndex!];
                              await playlistApi.removeMedia(playlist.playlist_id, item.item_id);
                              await handleStartEditPlaylist(editingEditPlaylistIndex!);
                            } catch (error: any) {
                              console.error('Erro ao remover item:', error);
                              setError('Erro ao remover item: ' + (error.response?.data?.error || error.message));
                            }
                          }}>
                            <Delete />
                          </IconButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Box>
              )}

              {editPlaylists.length > 0 ? (
                <List>
                  {editPlaylists.map((playlist, index) => (
                    <ListItem key={playlist.playlist_id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                      <ListItemIcon><QueueMusic /></ListItemIcon>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="body1" fontWeight="bold">{playlist.name}</Typography>
                            {playlist.description && (
                              <Typography variant="caption" color="text.secondary">
                                {playlist.description}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={`Status: ${playlist.is_active ? 'Ativa' : 'Inativa'}`}
                      />
                      <Chip
                        label={playlist.is_active ? 'Ativa' : 'Inativa'}
                        size="small"
                        color={playlist.is_active ? 'success' : 'default'}
                        sx={{ mr: 1 }}
                      />
                      <IconButton size="small" onClick={() => handleStartEditPlaylist(index)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeletePlaylist(index)}>
                        <Delete />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  Nenhuma playlist cadastrada ainda. Crie uma playlist para organizar suas mídias.
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Campanhas */}
          {editTab === 3 && selectedSubscriber && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Campanhas {editCampaigns.length > 0 && `(${editCampaigns.length})`}
              </Typography>

              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: editingEditCampaignIndex !== null ? alpha(theme.palette.primary.main, 0.05) : 'transparent' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  {editingEditCampaignIndex !== null ? 'Editar Campanha' : 'Adicionar Campanha'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Título *"
                      value={editCampaignForm.title || ''}
                      onChange={(e) => setEditCampaignForm({ ...editCampaignForm, title: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Contrato</InputLabel>
                      <Select
                        value={editCampaignForm.contractId || ''}
                        label="Contrato"
                        onChange={(e) => setEditCampaignForm({ ...editCampaignForm, contractId: e.target.value ? Number(e.target.value) : undefined })}
                      >
                        <MenuItem value="">
                          <em>Nenhum (Rascunho)</em>
                        </MenuItem>
                        {activeContracts.map((contract) => (
                          <MenuItem key={contract.contract_id} value={contract.contract_id}>
                            {contract.contract_number} - {contract.plan_name || 'Sem plano'} 
                            {contract.start_date && contract.end_date && 
                              ` (${new Date(contract.start_date).toLocaleDateString('pt-BR')} a ${new Date(contract.end_date).toLocaleDateString('pt-BR')})`
                            }
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {activeContracts.length === 0 && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Você precisa ter um contrato ativo para executar campanhas nos totens.
                      </Alert>
                    )}
                    {editCampaignForm.contractId === undefined && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        Esta campanha não está vinculada a um contrato. Vincule a um contrato ativo para executá-la nos totens.
                      </Alert>
                    )}
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Tipo</InputLabel>
                      <Select
                        value={editCampaignForm.campaign_type || 'general'}
                        label="Tipo"
                        onChange={(e) => setEditCampaignForm({ ...editCampaignForm, campaign_type: e.target.value as any })}
                      >
                        <MenuItem value="general">Geral</MenuItem>
                        <MenuItem value="scheduled">Agendada</MenuItem>
                        <MenuItem value="interactive">Interativa</MenuItem>
                        <MenuItem value="recurring">Recorrente</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Prioridade (1-10)"
                      type="number"
                      value={editCampaignForm.priority || 1}
                      onChange={(e) => setEditCampaignForm({ ...editCampaignForm, priority: Number(e.target.value) })}
                      size="small"
                      inputProps={{ min: 1, max: 10 }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={editCampaignForm.status || 'draft'}
                        label="Status"
                        onChange={(e) => setEditCampaignForm({ ...editCampaignForm, status: e.target.value as any })}
                      >
                        <MenuItem value="draft">Rascunho</MenuItem>
                        <MenuItem value="pending_approval">Aguardando Aprovação</MenuItem>
                        <MenuItem value="approved">Aprovada</MenuItem>
                        <MenuItem value="active">Ativa</MenuItem>
                        <MenuItem value="paused">Pausada</MenuItem>
                        <MenuItem value="finished">Finalizada</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status Ativo</InputLabel>
                      <Select
                        value={editCampaignForm.isActive ? 'active' : 'inactive'}
                        label="Status Ativo"
                        onChange={(e) => setEditCampaignForm({ ...editCampaignForm, isActive: e.target.value === 'active' })}
                      >
                        <MenuItem value="active">Ativa</MenuItem>
                        <MenuItem value="inactive">Inativa</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={editCampaignForm.description || ''}
                      onChange={(e) => setEditCampaignForm({ ...editCampaignForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={3}
                    />
                  </Grid>
                  
                  {/* Seção de Conteúdo: Mídias e Playlists */}
                  {(editingEditCampaignIndex !== null || editCampaignForm.title) && (
                    <>
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                          Conteúdo da Campanha
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Mídias Individuais
                          </Typography>
                          <FormControl fullWidth size="small">
                            <InputLabel>Selecionar Mídias</InputLabel>
                            <Select
                              multiple
                              value={campaignMedias.map(m => m.media_id) || []}
                              onChange={(e) => {
                                const selectedIds = e.target.value as number[];
                                const selectedMedias = editMedias.filter(m => selectedIds.includes(m.media_id));
                                setCampaignMedias(selectedMedias);
                              }}
                              renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {(selected as number[]).map((id) => {
                                    const media = editMedias.find(m => m.media_id === id);
                                    return media ? (
                                      <Chip key={id} label={media.name} size="small" />
                                    ) : null;
                                  })}
                                </Box>
                              )}
                            >
                              {editMedias.map((media) => (
                                <MenuItem key={media.media_id} value={media.media_id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {getMediaIcon(media.media_type)}
                                    <Typography variant="body2">{media.name}</Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {campaignMedias.length > 0 && (
                            <List dense sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                              {campaignMedias.map((media) => (
                                <ListItem key={media.media_id} sx={{ py: 0.5 }}>
                                  <ListItemIcon sx={{ minWidth: 32 }}>
                                    {getMediaIcon(media.media_type)}
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary={media.name}
                                    secondary={formatFileSize(media.size_bytes)}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => setCampaignMedias(campaignMedias.filter(m => m.media_id !== media.media_id))}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </ListItem>
                              ))}
                            </List>
                          )}
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Playlists
                          </Typography>
                          <FormControl fullWidth size="small">
                            <InputLabel>Selecionar Playlists</InputLabel>
                            <Select
                              multiple
                              value={campaignPlaylists.map(p => p.playlist_id) || []}
                              onChange={(e) => {
                                const selectedIds = e.target.value as number[];
                                const selectedPlaylists = editPlaylists.filter(p => selectedIds.includes(p.playlist_id));
                                setCampaignPlaylists(selectedPlaylists);
                              }}
                              renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                  {(selected as number[]).map((id) => {
                                    const playlist = editPlaylists.find(p => p.playlist_id === id);
                                    return playlist ? (
                                      <Chip key={id} label={playlist.name} size="small" />
                                    ) : null;
                                  })}
                                </Box>
                              )}
                            >
                              {editPlaylists.map((playlist) => (
                                <MenuItem key={playlist.playlist_id} value={playlist.playlist_id}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <QueueMusic />
                                    <Typography variant="body2">{playlist.name}</Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {campaignPlaylists.length > 0 && (
                            <List dense sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                              {campaignPlaylists.map((playlist) => (
                                <ListItem key={playlist.playlist_id} sx={{ py: 0.5 }}>
                                  <ListItemIcon sx={{ minWidth: 32 }}>
                                    <QueueMusic />
                                  </ListItemIcon>
                                  <ListItemText 
                                    primary={playlist.name}
                                    secondary={playlist.description || 'Sem descrição'}
                                  />
                                  <IconButton
                                    size="small"
                                    onClick={() => setCampaignPlaylists(campaignPlaylists.filter(p => p.playlist_id !== playlist.playlist_id))}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </ListItem>
                              ))}
                            </List>
                          )}
                        </Box>
                      </Grid>
                    </>
                  )}
                  
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddCampaign}
                      disabled={!editCampaignForm.title}
                    >
                      {editingEditCampaignIndex !== null ? 'Atualizar Campanha' : 'Adicionar Campanha'}
                    </Button>
                    {editingEditCampaignIndex !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingEditCampaignIndex(null);
                          setEditCampaignForm({ title: '', description: '', campaign_type: 'general', priority: 1, contractId: undefined, status: 'draft', isActive: true });
                          setCampaignMedias([]);
                          setCampaignPlaylists([]);
                        }}
                        sx={{ ml: 1 }}
                      >
                        Cancelar Edição
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Box>

              {editCampaigns.length > 0 ? (
                <List>
                  {editCampaigns.map((campaign, index) => (
                    <ListItem key={campaign.campaign_id} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
                      <ListItemIcon><CampaignIcon /></ListItemIcon>
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="body1" fontWeight="bold">{campaign.title}</Typography>
                            {campaign.description && (
                              <Typography variant="caption" color="text.secondary">
                                {campaign.description}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              Tipo: {campaign.campaign_type} | Prioridade: {campaign.priority} | Status: {campaign.status}
                            </Typography>
                            {campaign.contract_id ? (
                              <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                                ✓ Vinculada ao contrato: {campaign.contract_number || campaign.contract_title || `#${campaign.contract_id}`}
                                {campaign.plan_name && ` (Plano: ${campaign.plan_name})`}
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                                ⚠ Sem contrato vinculado - não pode ser executada nos totens
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {campaign.mediaIds && campaign.mediaIds.length > 0 && `${campaign.mediaIds.length} mídia(s)`}
                              {campaign.mediaIds && campaign.mediaIds.length > 0 && campaign.playlistIds && campaign.playlistIds.length > 0 && ' • '}
                              {campaign.playlistIds && campaign.playlistIds.length > 0 && `${campaign.playlistIds.length} playlist(s)`}
                              {(!campaign.mediaIds || campaign.mediaIds.length === 0) && (!campaign.playlistIds || campaign.playlistIds.length === 0) && 'Sem conteúdo'}
                            </Typography>
                          </Box>
                        }
                      />
                      <Chip
                        label={campaign.is_active !== undefined ? (campaign.is_active ? 'Ativa' : 'Inativa') : 'N/A'}
                        size="small"
                        color={campaign.is_active ? 'success' : 'default'}
                        sx={{ mr: 1 }}
                      />
                      <Chip
                        label={campaign.status || 'draft'}
                        size="small"
                        color={campaign.status === 'active' ? 'success' : campaign.status === 'approved' ? 'info' : 'default'}
                        sx={{ mr: 1 }}
                      />
                      <IconButton size="small" onClick={() => handleStartEditCampaign(index)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteCampaign(index)}>
                        <Delete />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  Nenhuma campanha cadastrada ainda. Crie uma campanha para organizar suas mídias e playlists.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditTab(0);
            setEditMedias([]);
            setEditPlaylists([]);
            setEditCampaigns([]);
            setEditingEditMediaIndex(null);
            setEditingEditPlaylistIndex(null);
            setEditingEditCampaignIndex(null);
            setEditMediaForm({ name: '', description: '', tags: [] });
            setEditPlaylistForm({ name: '', description: '', isActive: true });
            setEditCampaignForm({ title: '', description: '', campaign_type: 'general', priority: 1, contractId: undefined, status: 'draft', isActive: true });
            setPlaylistItems([]);
          }}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditSubscriber}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Detalhes do Assinante - {selectedSubscriber?.name}
        </DialogTitle>
        <DialogContent>
          <Tabs value={detailsTab} onChange={(_, newValue) => setDetailsTab(newValue)} sx={{ mb: 2 }}>
            <Tab label="Informações" />
            <Tab label="Locais" />
            <Tab label="Totens" />
            <Tab label="Smart TVs" />
            <Tab label="Contratos" icon={activeContracts.length > 0 ? <Chip label={activeContracts.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Estatísticas" />
          </Tabs>

          {detailsTab === 0 && selectedSubscriber && (
            <TableContainer>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome da Empresa</TableCell>
                    <TableCell>{selectedSubscriber.name}</TableCell>
                  </TableRow>
                  {selectedSubscriber.contact_name && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Nome do Contato</TableCell>
                      <TableCell>{selectedSubscriber.contact_name}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.email && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                      <TableCell>{selectedSubscriber.email}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.phone && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Telefone</TableCell>
                      <TableCell>{selectedSubscriber.phone}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.whatsapp && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>WhatsApp</TableCell>
                      <TableCell>{selectedSubscriber.whatsapp}</TableCell>
                    </TableRow>
                  )}
                  {selectedSubscriber.description && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                      <TableCell>{selectedSubscriber.description}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Tipo de Cliente</TableCell>
                    <TableCell>
                      <Chip
                        label="Assinante"
                        size="small"
                        color="primary"
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                    <TableCell>
                      <Chip
                        label={selectedSubscriber.is_active ? 'Ativo' : 'Inativo'}
                        size="small"
                        color={selectedSubscriber.is_active ? 'success' : 'error'}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                    <TableCell>{selectedSubscriber.created_at ? formatDate(selectedSubscriber.created_at) : 'N/A'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                    <TableCell>{selectedSubscriber.updated_at ? formatDate(selectedSubscriber.updated_at) : 'N/A'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {detailsTab === 1 && SubscriberStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais ({SubscriberStats.locals.length})
              </Typography>
              {SubscriberStats.locals.length === 0 ? (
                <Alert severity="info">Nenhum local cadastrado</Alert>
              ) : (
                <List>
                  {SubscriberStats.locals.map((local: any) => (
                    <ListItem key={local.local_id}>
                      <ListItemIcon>
                        <Store />
                      </ListItemIcon>
                      <ListItemText
                        primary={local.name}
                        secondary={local.address || 'Sem endereço'}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 2 && SubscriberStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Totens ({SubscriberStats.totems.length})
              </Typography>
              {SubscriberStats.totems.length === 0 ? (
                <Alert severity="info">Nenhum totem cadastrado</Alert>
              ) : (
                <List>
                  {SubscriberStats.totems.map((totem: any) => (
                    <ListItem key={totem.totem_id}>
                      <ListItemIcon>
                        <Computer />
                      </ListItemIcon>
                      <ListItemText
                        primary={totem.name || totem.identifier}
                        secondary={`Status: ${totem.status || 'N/A'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 3 && SubscriberStats && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Smart TVs ({SubscriberStats.smartTvs.length})
              </Typography>
              {SubscriberStats.smartTvs.length === 0 ? (
                <Alert severity="info">Nenhuma Smart TV cadastrada</Alert>
              ) : (
                <List>
                  {SubscriberStats.smartTvs.map((tv: any, index: number) => (
                    <ListItem key={tv.smart_tv_id || `tv-${index}`}>
                      <ListItemIcon>
                        <Tv />
                      </ListItemIcon>
                      <ListItemText
                        primary={tv.name || tv.identifier}
                        secondary={`${tv.brand || ''} ${tv.model || ''} - Status: ${tv.status || 'N/A'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 4 && selectedSubscriber && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6">
                  Contratos ({activeContracts.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={() => {
                      const sid = (selectedSubscriber as any).subscriber_id || (selectedSubscriber as any).subscriberId;
                      navigate(`/subscriber-contracts?subscriberId=${sid}&openCreate=1`);
                    }}
                  >
                    Criar Contrato
                  </Button>
                  <Button
                    variant="text"
                    endIcon={<OpenInNew />}
                    onClick={() => {
                      const sid = (selectedSubscriber as any).subscriber_id || (selectedSubscriber as any).subscriberId;
                      navigate(`/subscriber-contracts?subscriberId=${sid}`);
                    }}
                  >
                    Abrir Manutenção
                  </Button>
                </Box>
              </Box>

              {activeContracts.length === 0 ? (
                <Alert severity="info">Nenhum contrato ativo encontrado para este anunciante.</Alert>
              ) : (
                <List>
                  {activeContracts.map((contract: any, idx: number) => (
                    <ListItem
                      key={contract.contract_id || contract.contractId || `contract-${idx}`}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemIcon>
                        <Description />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${contract.contract_number || contract.contractNumber || 'N/A'} - ${contract.title || 'Sem título'}`}
                        secondary={`Status: ${contract.status || 'N/A'} • Início: ${
                          contract.start_date ? new Date(contract.start_date).toLocaleDateString('pt-BR') : 'N/A'
                        }${contract.end_date ? ` • Fim: ${new Date(contract.end_date).toLocaleDateString('pt-BR')}` : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {detailsTab === 5 && SubscriberStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Store sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {SubscriberStats.locals.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Locais
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Computer sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {SubscriberStats.totems.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Totens
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <Tv sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {SubscriberStats.smartTvs.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Smart TVs
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {SubscriberStats.stats && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ textAlign: 'center', py: 2 }}>
                      <CardContent>
                        <CheckCircle sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {SubscriberStats.stats.onlineTotems || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Totens Online
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  {/* Contadores de Recursos */}
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ textAlign: 'center', py: 2 }}>
                      <CardContent>
                        <VideoLibrary sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {SubscriberStats.stats.media_count || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Mídias
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ textAlign: 'center', py: 2 }}>
                      <CardContent>
                        <QueueMusic sx={{ fontSize: 40, color: theme.palette.secondary.main, mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {SubscriberStats.stats.playlist_count || 0}
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
                        <CampaignIcon sx={{ fontSize: 40, color: theme.palette.warning.main, mb: 1 }} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                          {SubscriberStats.stats.campaign_count || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Campanhas
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  {/* Storage e Limites */}
                  {SubscriberStats.stats.storage_used_gb !== undefined && (
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 2 }}>
                            Armazenamento
                          </Typography>
                          <Box sx={{ mb: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2">
                                {SubscriberStats.stats.storage_used_gb?.toFixed(2) || 0} GB utilizados
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {SubscriberStats.stats.storage_limit_gb ? `${SubscriberStats.stats.storage_limit_gb} GB limite` : 'Sem limite'}
                              </Typography>
                            </Box>
                            {SubscriberStats.stats.storage_limit_gb && (
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(
                                  ((SubscriberStats.stats.storage_used_gb || 0) / SubscriberStats.stats.storage_limit_gb) * 100,
                                  100
                                )}
                                sx={{ height: 8, borderRadius: 4 }}
                                color={
                                  ((SubscriberStats.stats.storage_used_gb || 0) / SubscriberStats.stats.storage_limit_gb) * 100 > 90
                                    ? 'error'
                                    : ((SubscriberStats.stats.storage_used_gb || 0) / SubscriberStats.stats.storage_limit_gb) * 100 > 75
                                    ? 'warning'
                                    : 'primary'
                                }
                              />
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  {/* Limites do Plano */}
                  {SubscriberStats.stats.plan_limits && (
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 2 }}>
                            Limites do Plano
                          </Typography>
                          <Grid container spacing={2}>
                            {SubscriberStats.stats.plan_limits.medias !== undefined && (
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                  Mídias
                                </Typography>
                                <Typography variant="h6">
                                  {SubscriberStats.stats.media_count || 0} / {SubscriberStats.stats.plan_limits.medias === -1 ? '∞' : SubscriberStats.stats.plan_limits.medias}
                                </Typography>
                              </Grid>
                            )}
                            {SubscriberStats.stats.plan_limits.playlists !== undefined && (
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                  Playlists
                                </Typography>
                                <Typography variant="h6">
                                  {SubscriberStats.stats.playlist_count || 0} / {SubscriberStats.stats.plan_limits.playlists === -1 ? '∞' : SubscriberStats.stats.plan_limits.playlists}
                                </Typography>
                              </Grid>
                            )}
                            {SubscriberStats.stats.plan_limits.campaigns !== undefined && (
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                  Campanhas
                                </Typography>
                                <Typography variant="h6">
                                  {SubscriberStats.stats.campaign_count || 0} / {SubscriberStats.stats.plan_limits.campaigns === -1 ? '∞' : SubscriberStats.stats.plan_limits.campaigns}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                  
                  {/* Alertas de Contratos */}
                  {selectedSubscriber && (
                    <Grid item xs={12}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 2 }}>
                            Contratos e Planos
                          </Typography>
                          {availableContracts.filter(c => c.subscriber_id === selectedSubscriber.subscriber_id).length === 0 ? (
                            <Alert severity="warning">
                              Nenhum contrato ativo encontrado para este assinante.
                            </Alert>
                          ) : (
                            <List>
                              {availableContracts
                                .filter(c => c.subscriber_id === selectedSubscriber.subscriber_id)
                                .map((contract) => {
                                  const isExpired = contract.end_date && new Date(contract.end_date) < new Date();
                                  const isExpiringSoon = contract.end_date && 
                                    new Date(contract.end_date) > new Date() && 
                                    new Date(contract.end_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                                  
                                  return (
                                    <ListItem key={contract.contract_id}>
                                      <ListItemIcon>
                                        {isExpired ? (
                                          <ErrorIcon color="error" />
                                        ) : isExpiringSoon ? (
                                          <Warning color="warning" />
                                        ) : (
                                          <CheckCircle color="success" />
                                        )}
                                      </ListItemIcon>
                                      <ListItemText
                                        primary={contract.title}
                                        secondary={
                                          <>
                                            {contract.contract_number} • {contract.contract_type} • 
                                            {contract.end_date ? (
                                              isExpired ? (
                                                <span style={{ color: 'red' }}> Expirado em {formatDate(contract.end_date)}</span>
                                              ) : isExpiringSoon ? (
                                                <span style={{ color: 'orange' }}> Expira em {formatDate(contract.end_date)}</span>
                                              ) : (
                                                ` Válido até ${formatDate(contract.end_date)}`
                                              )
                                            ) : ' Sem data de término'}
                                          </>
                                        }
                                      />
                                    </ListItem>
                                  );
                                })}
                            </List>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  )}
                </>
              )}
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

export default Subscribers;




