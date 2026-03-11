import React, { useState, useEffect, useMemo } from 'react';
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
  CreateContractRequest,
  CreateLocalRequest,
  CreatePlayerRequest,
  CreateSmartTvRequest,
  Local,
  localApi,
  totemApi,
  smartTvApi,
  contractApi,
  planApi,
} from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import { SortableList } from '../../components/SortableList/SortableList';
import { SubscriberCard, SubscriberDetails, SubscriberForm } from './components';

const Subscribers: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  // Datas padrão para contratos: início = hoje, vencimento = 31/12 do ano corrente
  const getDefaultContractStartDate = (): string => new Date().toISOString().split('T')[0];
  const getDefaultContractEndDate = (): string => {
    const year = new Date().getFullYear();
    return `${year}-12-31`;
  };

  // Função helper para formatar datas ISO para input type="date" (yyyy-MM-dd)
  const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Função helper para formatar datas do input (yyyy-MM-dd) para API (ISO string)
  const formatDateForAPI = (dateString: string | null | undefined): string | undefined => {
    if (!dateString || dateString.trim() === '') return undefined;
    try {
      // Se já está no formato yyyy-MM-dd, adicionar hora para criar ISO válido
      const date = dateString.includes('T') 
        ? new Date(dateString) 
        : new Date(dateString + 'T00:00:00.000Z');
      if (isNaN(date.getTime())) return undefined;
      return date.toISOString();
    } catch {
      return undefined;
    }
  };
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
  const [createTab, setCreateTab] = useState(0); // NOVO: Aba do dialog de criação
  const [editTab, setEditTab] = useState(0); // NOVO: Aba do dialog de edição
  const [newSubscriber, setNewSubscriber] = useState<CreateSubscriberRequest>({
    name: '',
    contract_ids: undefined,
    plan_ids: undefined,
    contract_id: undefined, // Mantido para compatibilidade
    plan_id: undefined, // Mantido para compatibilidade
    contact_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    address: '',
    category_segment: '',
    description: '',
  });
  
  // Estados para contratos
  const [availablePlansForContract, setAvailablePlansForContract] = useState<any[]>([]);
  // NOVO: Estados para gerenciar contratos durante a criação
  const [tempSubscriberContracts, setTempSubscriberContracts] = useState<(CreateContractRequest & { tempId: string })[]>([]);
  const [editingSubscriberContractIndexCreate, setEditingSubscriberContractIndexCreate] = useState<number | null>(null);
  // Estados para gerenciar contratos durante a edição
  const [editingSubscriberContractIndexEdit, setEditingSubscriberContractIndexEdit] = useState<number | null>(null);
  const [subscriberContractForm, setSubscriberContractForm] = useState<CreateContractRequest>({
    contract_number: '',
    contract_type: 'advertising',
    title: '',
    description: '',
    start_date: getDefaultContractStartDate(),
    end_date: getDefaultContractEndDate(),
    currency: 'BRL',
    status: 'draft',
    plan_id: undefined,
  });
  const [subscriberContractFormEdit, setSubscriberContractFormEdit] = useState<CreateContractRequest>({
    contract_number: '',
    contract_type: 'advertising',
    title: '',
    description: '',
    start_date: getDefaultContractStartDate(),
    end_date: getDefaultContractEndDate(),
    currency: 'BRL',
    status: 'draft',
    plan_id: undefined,
  });
  // NOVO: Estados para gerenciar locais, totens, smart TVs e subscribers durante a criação
  const [tempLocals, setTempLocals] = useState<CreateLocalRequest[]>([]);
  const [tempTotems, setTempTotems] = useState<(CreatePlayerRequest & { tempId: string })[]>([]);
  const [tempSmartTvs, setTempSmartTvs] = useState<(CreateSmartTvRequest & { tempId: string })[]>([]);
  const [editingLocalIndex, setEditingLocalIndex] = useState<number | null>(null);
  const [editingTotemIndex, setEditingTotemIndex] = useState<number | null>(null);
  const [editingSmartTvIndex, setEditingSmartTvIndex] = useState<number | null>(null);
  
  // Estados para edição de Anunciante (carregar dados existentes)
  const [editMedias, setEditMedias] = useState<MediaItem[]>([]);
  const [mediaPreviewFailed, setMediaPreviewFailed] = useState<Set<number>>(new Set());
  const [editPlaylists, setEditPlaylists] = useState<PlaylistItem[]>([]);
  const [editCampaigns, setEditCampaigns] = useState<Campaign[]>([]);
  const [editingEditMediaIndex, setEditingEditMediaIndex] = useState<number | null>(null);
  const [editingEditPlaylistIndex, setEditingEditPlaylistIndex] = useState<number | null>(null);
  const [editingEditCampaignIndex, setEditingEditCampaignIndex] = useState<number | null>(null);
  const [campaignSaveLoading, setCampaignSaveLoading] = useState(false);
  
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
  // null = ainda não carregado do backend (evita gerar número antes da hora)
  const [activeContracts, setActiveContracts] = useState<any[] | null>(null);
  /** Contratos com status "active" para vincular a campanhas (só estes podem ser usados nos totens) */
  const contractsActiveForCampaign = useMemo(
    () => (activeContracts || []).filter((c: any) => c.status === 'active'),
    [activeContracts]
  );

  // Próximo número = último sequencial existente (após o ponto) + 1. Ex: SUB-11.000003 -> próximo 000004
  const generateInlineSubscriberContractNumber = (subscriberId: number): string => {
    const list = [...(activeContracts || []), ...tempSubscriberContracts];
    const parseSeq = (n: string) => {
      if (!n || typeof n !== 'string') return 0;
      const parts = n.trim().split('.');
      const last = parts[parts.length - 1];
      const num = parseInt(last, 10);
      return Number.isNaN(num) ? 0 : num;
    };
    const maxSeq = list.length === 0 ? 0 : Math.max(0, ...list.map((c: any) => parseSeq(c.contract_number || '')));
    const seq = String(maxSeq + 1).padStart(6, '0');
    return `SUB-${subscriberId}.${seq}`;
  };

  // Número padrão no cadastro (novo anunciante, ainda sem ID): SUB-NOVO.<NNNNNN>
  const defaultNewSubscriberContractNumber = `SUB-NOVO.${String(tempSubscriberContracts.length + 1).padStart(6, '0')}`;

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
    loadOverallStats(); // Carregar estatísticas gerais
  }, [activeOnlyFilter, page, limit]);

  // Carregar planos quando a aba Contratos for aberta (criação ou edição)
  useEffect(() => {
    if ((createTab === 1 && createDialogOpen) || (editTab === 1 && editDialogOpen)) {
      const loadPlans = async () => {
        try {
          const plans = await planApi.getAll(false);
          setAvailablePlansForContract(plans ?? []);
        } catch (error) {
          console.error('Erro ao carregar planos:', error);
          setAvailablePlansForContract([]);
        }
      };
      loadPlans();
    }
  }, [createTab, createDialogOpen, editTab, editDialogOpen]);

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
        subscriberApi.getContracts(subscriberId, { activeOnly: false }).catch(() => []), // Todos os contratos (incl. rascunho) para a aba Contratos do modal
      ]);

      setEditMedias(Array.isArray(mediasResponse?.data) ? mediasResponse.data : []);
      setMediaPreviewFailed(new Set());
      setEditPlaylists(Array.isArray(playlistsResponse?.data) ? playlistsResponse.data : []);
      // campaignApi.getAll pode retornar CampaignListResponse (objeto com data) ou array diretamente
      // Normalizar campanhas: backend retorna 'id' e 'contractId' (camelCase), frontend espera 'campaign_id' e 'contract_id' (snake_case)
      const campaignsArray = Array.isArray(campaignsResponse) 
        ? campaignsResponse 
        : (campaignsResponse as any)?.data || [];
      
      const normalizedCampaigns = campaignsArray.map((c: any) => {
        // Tentar múltiplas formas de obter o ID
        const campaignId = c.campaign_id || c.id || c.campaignId || (c as any).campaignId;
        const contractId = c.contract_id || c.contractId;
        
        const normalized = {
          ...c,
          campaign_id: campaignId,
          contract_id: contractId,
        };
        
        if (!normalized.campaign_id) {
          console.error('[Campanha] Campanha sem ID após normalização - será ignorada', { 
            original: c, 
            normalized,
            availableKeys: Object.keys(c),
          });
        }
        return normalized;
      }).filter((c: any) => c.campaign_id); // Filtrar campanhas sem ID
      
      console.log('[Campanha] Campanhas normalizadas', { 
        total: campaignsArray.length,
        normalized: normalizedCampaigns.length,
        sample: normalizedCampaigns[0] 
      });
      setEditCampaigns(normalizedCampaigns);
      setActiveContracts(Array.isArray(contractsResponse) ? contractsResponse : []);
    } catch (error) {
      console.error('Erro ao carregar dados do Subscriber para edição:', error);
      setError('Erro ao carregar dados do Anunciante');
    }
  };

  // Carregar dados automaticamente quando o dialog de edição abrir
  useEffect(() => {
    if (editDialogOpen && selectedSubscriber) {
      loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  }, [editDialogOpen, selectedSubscriber?.subscriber_id]);

  // Pré-preencher número do contrato na aba "Contratos do Anunciante" (edição)
  useEffect(() => {
    // Só gerar quando:
    // - modal de edição aberto
    // - aba Contratos ativa
    // - subscriber selecionado
    // - contratos já carregados (activeContracts != null)
    if (!editDialogOpen || !selectedSubscriber || editTab !== 1 || !Array.isArray(activeContracts)) return;
    setSubscriberContractFormEdit((prev) => {
      if (prev.contract_number != null && prev.contract_number !== '') return prev;
      return { ...prev, contract_number: generateInlineSubscriberContractNumber(selectedSubscriber.subscriber_id) };
    });
  }, [editDialogOpen, editTab, selectedSubscriber?.subscriber_id, activeContracts]);

  // Pré-preencher número do contrato no cadastro (novo assinante, aba Contratos): SUB-NOVO.<NNNNNN>
  useEffect(() => {
    if (!createDialogOpen || createTab !== 1) return;
    setSubscriberContractForm((prev) => {
      if (prev.contract_number != null && prev.contract_number !== '') return prev;
      const seq = String(tempSubscriberContracts.length + 1).padStart(6, '0');
      return { ...prev, contract_number: `SUB-NOVO.${seq}` };
    });
  }, [createDialogOpen, createTab, tempSubscriberContracts.length]);

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
  // FUNÇÕES DE CRUD PARA EDIÇÃO DE Anunciante
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
    // PROTEÇÃO INICIAL ABSOLUTA: Resetar editingEditCampaignIndex se inválido ANTES de qualquer processamento
    if (editingEditCampaignIndex !== null) {
      const checkCampaign = editCampaigns[editingEditCampaignIndex];
      const checkCampaignId = checkCampaign?.campaign_id || (checkCampaign as any)?.id;
      if (!checkCampaign || !checkCampaignId || checkCampaignId === 0 || !Number.isInteger(checkCampaignId)) {
        console.warn('[Campanha] PROTEÇÃO INICIAL: editingEditCampaignIndex inválido, resetando ANTES de processar', {
          editingEditCampaignIndex,
          checkCampaign,
          checkCampaignId,
          isInteger: Number.isInteger(checkCampaignId),
          editCampaignsLength: editCampaigns.length,
        });
        setEditingEditCampaignIndex(null);
      }
    }

    console.log('[Campanha] handleAddCampaign chamado', {
      hasSubscriber: !!selectedSubscriber,
      title: editCampaignForm.title,
      titleTrim: editCampaignForm.title?.trim(),
      editingEditCampaignIndex,
      editCampaignsLength: editCampaigns.length,
      campaignAtIndex: editingEditCampaignIndex !== null ? editCampaigns[editingEditCampaignIndex] : null,
    });
    setError(null);
    if (!selectedSubscriber || !editCampaignForm.title?.trim()) {
      setError('Título da campanha é obrigatório');
      return;
    }

    // Validação prévia de limites (apenas para criação)
    if (editingEditCampaignIndex === null) {
      try {
        const validation = await subscriberApi.validatePlanLimits(selectedSubscriber.subscriber_id, 'campaign');
        if (!validation.valid) {
          setError(validation.message || 'Limite de campanhas do plano excedido');
          return;
        }
      } catch (err: any) {
        console.error('Erro na validação prévia:', err);
        // Continuar mesmo se validação falhar (backend vai validar)
      }
    }

    // Verificar se está em modo de edição e se a campanha existe
    // Normalizar campaign_id: pode vir como campaign_id (snake_case) ou id (camelCase)
    const campaignAtIndex = editingEditCampaignIndex !== null && editingEditCampaignIndex >= 0 && editingEditCampaignIndex < editCampaigns.length
      ? editCampaigns[editingEditCampaignIndex]
      : null;
    const campaignIdAtEditIndex = campaignAtIndex?.campaign_id || (campaignAtIndex as any)?.id;
    
    let isEditMode = editingEditCampaignIndex !== null && 
                     editingEditCampaignIndex >= 0 && 
                     editingEditCampaignIndex < editCampaigns.length &&
                     !!campaignIdAtEditIndex; // Garantir que campaignId existe e não é 0/null/undefined
    
    console.log('[Campanha] Verificação de modo de edição', {
      editingEditCampaignIndex,
      editCampaignsLength: editCampaigns.length,
      campaignAtIndex,
      campaignIdAtEditIndex,
      isEditMode,
    });
    
    if (editingEditCampaignIndex !== null && !isEditMode) {
      console.warn('[Campanha] editingEditCampaignIndex definido mas campanha inválida, resetando para modo criação', {
        editingEditCampaignIndex,
        editCampaignsLength: editCampaigns.length,
        campaignAtIndex,
        campaignIdAtEditIndex,
      });
      setEditingEditCampaignIndex(null);
      // Forçar modo criação após reset
      isEditMode = false;
    }

    // PROTEÇÃO FINAL: Se não há campaignId válido, forçar modo criação
    if (isEditMode && (!campaignIdAtEditIndex || campaignIdAtEditIndex === 0 || !Number.isInteger(campaignIdAtEditIndex))) {
      console.warn('[Campanha] PROTEÇÃO FINAL: isEditMode=true mas campaignId inválido, forçando modo criação', {
        editingEditCampaignIndex,
        campaignIdAtEditIndex,
        campaignAtIndex,
        isInteger: Number.isInteger(campaignIdAtEditIndex),
      });
      isEditMode = false;
      setEditingEditCampaignIndex(null);
    }

    // VALIDAÇÃO FINAL ABSOLUTA: NUNCA entrar em modo edição sem campaignId válido
    const finalCampaignId = isEditMode && campaignIdAtEditIndex && campaignIdAtEditIndex > 0 && Number.isInteger(campaignIdAtEditIndex) 
      ? campaignIdAtEditIndex 
      : null;
    const shouldEdit = !!finalCampaignId;

    console.log('[Campanha] Decisão final', {
      isEditMode,
      finalCampaignId,
      shouldEdit,
      willCreate: !shouldEdit,
    });

    setCampaignSaveLoading(true);
    try {
      // VALIDAÇÃO ABSOLUTA FINAL: NUNCA fazer UPDATE sem campaignId válido
      if (shouldEdit && finalCampaignId && Number.isInteger(finalCampaignId) && finalCampaignId > 0) {
        const campaign = editCampaigns[editingEditCampaignIndex!];
        // Usar o campaignId já validado acima
        const campaignId = finalCampaignId;
        
        // Verificação dupla antes de chamar API
        if (!campaignId || campaignId === 0 || !Number.isInteger(campaignId)) {
          console.error('[Campanha] ERRO CRÍTICO: Tentando UPDATE com campaignId inválido!', {
            campaignId,
            shouldEdit,
            finalCampaignId,
            editingEditCampaignIndex,
          });
          setError('Erro: campanha não encontrada para edição. Tente criar uma nova campanha.');
          setEditingEditCampaignIndex(null);
          setCampaignSaveLoading(false);
          return;
        }
        
        const updateData: UpdateCampaignRequest = {
          ...editCampaignForm,
          contractId: editCampaignForm.contractId !== undefined && editCampaignForm.contractId !== null ? Number(editCampaignForm.contractId) : undefined,
          mediaIds: campaignMedias.map(m => m.media_id),
          playlistIds: campaignPlaylists.map(p => p.playlist_id),
        };
        console.log('[Campanha] Atualizando campanha', { 
          campaignId, 
          updateData,
          contractId: updateData.contractId,
          contractIdType: typeof updateData.contractId,
        });
        await campaignApi.update(campaignId, updateData);
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setEditingEditCampaignIndex(null);
        setCampaignMedias([]);
        setCampaignPlaylists([]);
      } else {
        const createData = {
          title: editCampaignForm.title?.trim() || '',
          description: editCampaignForm.description,
          campaign_type: editCampaignForm.campaign_type || 'general',
          priority: editCampaignForm.priority ?? 1,
          contractId: editCampaignForm.contractId !== undefined && editCampaignForm.contractId !== null ? Number(editCampaignForm.contractId) : undefined,
          subscriberId: selectedSubscriber.subscriber_id,
          mediaIds: campaignMedias.map(m => m.media_id),
          playlistIds: campaignPlaylists.map(p => p.playlist_id),
        } as CreateCampaignRequest;
        console.log('[Campanha] Criando nova campanha', { 
          createData, 
          isEditMode,
          contractId: createData.contractId,
          contractIdType: typeof createData.contractId,
        });
        await campaignApi.create(createData);
        await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
        setCampaignMedias([]);
        setCampaignPlaylists([]);
      }
      setError(null);
      setEditCampaignForm({ title: '', description: '', campaign_type: 'general', priority: 1, contractId: undefined, status: 'draft', isActive: true });
    } catch (error: any) {
      console.error('Erro ao salvar campanha:', error);
      const msg =
        error?.response?.data?.message ??
        error?.response?.data?.error ??
        (typeof error?.message === 'string' ? error.message : null) ??
        'Erro ao salvar campanha. Verifique a consola (F12) ou tente novamente.';
      setError(msg);
    } finally {
      setCampaignSaveLoading(false);
    }
  };

  const handleStartEditCampaign = async (index: number) => {
    const campaign = editCampaigns[index];
    if (!campaign) {
      console.error('[Campanha] Erro: campanha não encontrada no índice', { index, editCampaignsLength: editCampaigns.length });
      return;
    }
    
    // Normalizar contractId: pode vir como contract_id (snake_case) ou contractId (camelCase)
    const contractId = campaign.contract_id || (campaign as any).contractId;
    const normalizedContractId = contractId !== undefined && contractId !== null ? Number(contractId) : undefined;
    
    console.log('[Campanha] Iniciando edição', {
      index,
      campaign,
      contractIdRaw: contractId,
      contractIdNormalized: normalizedContractId,
      campaignId: campaign.campaign_id || (campaign as any).id,
    });
    
    setEditCampaignForm({
      title: campaign.title || '',
      description: campaign.description,
      campaign_type: campaign.campaign_type || 'general',
      priority: campaign.priority || 1,
      contractId: normalizedContractId,
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
      // Validar índice
      if (index < 0 || index >= editCampaigns.length) {
        console.error('[Campanha] Erro: índice inválido para exclusão', { 
          index, 
          editCampaignsLength: editCampaigns.length,
          editCampaigns: editCampaigns.map((c, i) => ({ 
            index: i, 
            campaign_id: c.campaign_id || (c as any).id,
            title: c.title 
          })),
        });
        setError('Erro: campanha não encontrada para exclusão');
        return;
      }

      const campaign = editCampaigns[index];
      if (!campaign) {
        console.error('[Campanha] Erro: campanha não encontrada no índice', { index, editCampaignsLength: editCampaigns.length });
        setError('Erro: campanha não encontrada para exclusão');
        return;
      }

      // Normalizar campaignId: tentar múltiplas formas
      const campaignId = campaign.campaign_id || (campaign as any).id || (campaign as any).campaignId;
      
      console.log('[Campanha] Tentando excluir', { 
        index, 
        campaign, 
        campaignId,
        campaignIdType: typeof campaignId,
        isInteger: Number.isInteger(campaignId),
        availableKeys: Object.keys(campaign),
      });

      // Validação rigorosa
      if (!campaignId || campaignId === 0 || !Number.isInteger(campaignId) || campaignId < 1) {
        console.error('[Campanha] Erro: campanha sem ID válido para exclusão', { 
          campaign, 
          index, 
          campaignId,
          campaignIdType: typeof campaignId,
          isInteger: Number.isInteger(campaignId),
          campaign_id: campaign.campaign_id,
          id: (campaign as any).id,
        });
        setError('Erro: campanha não encontrada para exclusão (ID inválido)');
        return;
      }

      await campaignApi.delete(campaignId);
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


  // NOVO: handleCreateSubscriber modificado para criar Subscriber baseado em contrato
  const handleCreateSubscriber = async () => {
    try {
      // Limpar erros anteriores
      setError(null);

      // Validação: nome do Subscriber é obrigatório
      if (!newSubscriber.name || newSubscriber.name.trim() === '') {
        setError('Nome do Anunciante é obrigatório. Por favor, preencha o campo "Nome da Empresa / Razão Social".');
        setCreateTab(0); // Ir para aba de Informações
        return;
      }

      // Validação: nome deve ter pelo menos 3 caracteres
      if (newSubscriber.name.trim().length < 3) {
        setError('O nome do Anunciante deve ter pelo menos 3 caracteres.');
        setCreateTab(0);
        return;
      }

      // Não é mais obrigatório adicionar contratos antes de criar o anunciante.

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

      const subscriberData = { ...newSubscriber };
      delete subscriberData.contract_ids;
      delete subscriberData.plan_ids;
      delete subscriberData.contract_id;
      delete subscriberData.plan_id;

      let createdSubscriber;
      if (tempSubscriberContracts.length > 0) {
        // Criar subscriber + contratos numa única chamada (procedure; contract_number gerado no banco como SUB-{id}.{seq})
        const payload = {
          subscriber: subscriberData,
          contracts: tempSubscriberContracts.map((c) => ({
            title: c.title,
            plan_id: c.plan_id,
            contract_type: c.contract_type || 'advertising',
            start_date: formatDateForAPI(c.start_date) || undefined,
            end_date: c.end_date ? formatDateForAPI(c.end_date) : undefined,
            total_amount: c.total_amount,
            currency: c.currency || 'BRL',
            payment_terms: c.payment_terms,
            description: c.description,
          })),
        };
        createdSubscriber = await subscriberApi.create(payload);
      } else {
        createdSubscriber = await subscriberApi.create(subscriberData);
      }

      const subscriberId = createdSubscriber.subscriber_id;
      if (!subscriberId) {
        const errorMessage = 'Erro: Anunciante criado mas não retornou ID válido. Por favor, entre em contato com o suporte.';
        console.error(errorMessage);
        setError(errorMessage);
        return;
      }

      // Contratos já foram criados pela procedure quando enviados no payload; não criar de novo via API.

      // NOTA: Subscribers não podem criar locais próprios
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
        plan_id: undefined,
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
      setError(error?.response?.data?.error || error?.message || 'Erro ao atualizar Anunciante');
    }
  };

  const handleDeleteSubscriber = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este Anunciante?')) {
      try {
        await subscriberApi.delete(id);
        loadSubscribers();
      } catch (error: any) {
        console.error('Erro ao excluir Subscriber:', error);
        setError(error?.response?.data?.error || error?.message || 'Erro ao excluir Subscriber');
      }
    }
  };

  const handleViewDetails = (Subscriber: Subscriber) => {
    setSelectedSubscriber(Subscriber);
    setDetailsDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getClientTypeLabel = (clientType?: string) => {
    switch (clientType) {
      case 'subscriber': return 'Anunciante';
      case 'Subscriber': return 'Anunciante';
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
          Carregando Anunciantes...
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
          Adicionar Anunciante
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
                placeholder="Buscar Anunciantes..."
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
            <SubscriberCard
              subscriber={Subscriber}
              onView={() => handleViewDetails(Subscriber)}
              onEdit={async () => {
                setSelectedSubscriber(Subscriber);
                setEditDialogOpen(true);
                await loadSubscriberDataForEdit(Subscriber.subscriber_id);
              }}
              onDelete={() => handleDeleteSubscriber(Subscriber.subscriber_id)}
            />
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
              Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total} anunciantes
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
              Nenhum Anunciante encontrado
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece adicionando seus primeiros Anunciantes
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Adicionar Primeiro Anunciante
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
          setTempSubscriberContracts([]);
          setEditingSubscriberContractIndexCreate(null);
          setSubscriberContractForm({
            contract_number: '',
            contract_type: 'advertising',
            title: '',
            description: '',
            start_date: getDefaultContractStartDate(),
            end_date: getDefaultContractEndDate(),
            currency: 'BRL',
            status: 'draft',
            plan_id: undefined,
          });
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Adicionar Anunciante</DialogTitle>
        <DialogContent>
          <Tabs
            value={createTab}
            onChange={(_, newValue) => {
              setCreateTab(newValue);
              if (newValue === 1) {
                setSubscriberContractForm((prev) => ({
                  ...prev,
                  contract_number: prev.contract_number || `SUB-NOVO.${String(tempSubscriberContracts.length + 1).padStart(6, '0')}`,
                }));
              }
            }}
            sx={{ mb: 3 }}
          >
            <Tab label="Informações" />
            <Tab label="Contratos" icon={tempSubscriberContracts && tempSubscriberContracts.length > 0 ? <Chip label={tempSubscriberContracts.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Locais" icon={tempLocals.length > 0 ? <Chip label={tempLocals.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Totens" icon={tempTotems.length > 0 ? <Chip label={tempTotems.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Smart TVs" icon={tempSmartTvs.length > 0 ? <Chip label={tempSmartTvs.length} size="small" color="primary" /> : undefined} iconPosition="end" />
          </Tabs>

          {/* Aba Informações */}
          {createTab === 0 && (
            <SubscriberForm
              mode="create"
              data={newSubscriber}
              onChange={(data) => setNewSubscriber(data as CreateSubscriberRequest)}
              activeParentTab={createTab}
            />
          )}

          {/* Aba Contratos */}
          {createTab === 1 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Contratos do Anunciante *</Typography>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Obrigatório:</strong> Um anunciante deve ter pelo menos um contrato. 
                Adicione pelo menos um contrato antes de criar o anunciante.
              </Alert>
              
              {/* Formulário para criar/editar Subscriber Contract */}
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: editingSubscriberContractIndexCreate !== null ? alpha(theme.palette.primary.main, 0.05) : 'transparent' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  {editingSubscriberContractIndexCreate !== null ? 'Editar Contrato' : 'Adicionar Contrato'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Plano</InputLabel>
                      <Select
                        value={subscriberContractForm.plan_id || ''}
                        label="Plano"
                        onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, plan_id: e.target.value ? Number(e.target.value) : undefined })}
                      >
                        <MenuItem value="">Nenhum (contrato sem plano)</MenuItem>
                        {availablePlansForContract.map((p: any) => (
                          <MenuItem key={p.planId} value={p.planId}>{p.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Número do Contrato *"
                      value={subscriberContractForm.contract_number || defaultNewSubscriberContractNumber}
                      size="small"
                      required
                      InputProps={{ readOnly: true, disabled: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Tipo de Contrato *</InputLabel>
                      <Select
                        value={subscriberContractForm.contract_type || 'advertising'}
                        label="Tipo de Contrato *"
                        onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, contract_type: e.target.value as any })}
                      >
                        <MenuItem value="advertising">Advertising</MenuItem>
                        <MenuItem value="subscription">Subscription</MenuItem>
                        <MenuItem value="partnership">Partnership</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Título *"
                      value={subscriberContractForm.title || ''}
                      onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, title: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={subscriberContractForm.description || ''}
                      onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Início *"
                      type="date"
                      value={formatDateForInput(subscriberContractForm.start_date) || ''}
                      onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, start_date: e.target.value })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Término"
                      type="date"
                      value={formatDateForInput(subscriberContractForm.end_date) || getDefaultContractEndDate()}
                      onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, end_date: e.target.value || getDefaultContractEndDate() })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Moeda"
                      value={subscriberContractForm.currency || 'BRL'}
                      onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, currency: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={subscriberContractForm.status || 'draft'}
                        label="Status"
                        onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, status: e.target.value as any })}
                      >
                        <MenuItem value="draft">Rascunho</MenuItem>
                        <MenuItem value="active">Ativo</MenuItem>
                        <MenuItem value="expired">Expirado</MenuItem>
                        <MenuItem value="terminated">Terminado</MenuItem>
                        <MenuItem value="cancelled">Cancelado</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => {
                        const contractNumber = subscriberContractForm.contract_number || defaultNewSubscriberContractNumber;
                        if (!contractNumber || !subscriberContractForm.title) {
                          setError('Número do contrato e título são obrigatórios');
                          return;
                        }
                        if (editingSubscriberContractIndexCreate !== null) {
                          const updated = [...tempSubscriberContracts];
                          updated[editingSubscriberContractIndexCreate] = { ...subscriberContractForm, contract_number: contractNumber, tempId: tempSubscriberContracts[editingSubscriberContractIndexCreate].tempId };
                          setTempSubscriberContracts(updated);
                          setEditingSubscriberContractIndexCreate(null);
                        } else {
                          setTempSubscriberContracts([...tempSubscriberContracts, { ...subscriberContractForm, contract_number: contractNumber, tempId: `temp-${Date.now()}` }]);
                        }
                        setSubscriberContractForm({
                          contract_number: `SUB-NOVO.${String(tempSubscriberContracts.length + 2).padStart(6, '0')}`,
                          contract_type: 'advertising',
                          title: '',
                          description: '',
                          start_date: getDefaultContractStartDate(),
                          end_date: getDefaultContractEndDate(),
                          currency: 'BRL',
                          status: 'draft',
                          plan_id: undefined,
                        });
                      }}
                      disabled={!(subscriberContractForm.contract_number || defaultNewSubscriberContractNumber) || !subscriberContractForm.title}
                    >
                      {editingSubscriberContractIndexCreate !== null ? 'Atualizar Contrato' : 'Adicionar Contrato'}
                    </Button>
                    {editingSubscriberContractIndexCreate !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingSubscriberContractIndexCreate(null);
                          setSubscriberContractForm({
                            contract_number: defaultNewSubscriberContractNumber,
                            contract_type: 'advertising',
                            title: '',
                            description: '',
                            start_date: getDefaultContractStartDate(),
                            end_date: getDefaultContractEndDate(),
                            currency: 'BRL',
                            status: 'draft',
                            plan_id: undefined,
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

              {/* Lista de Subscriber Contracts temporários */}
              {tempSubscriberContracts.length > 0 ? (
                <List>
                  {tempSubscriberContracts.map((contract, index) => (
                    <ListItem
                      key={contract.tempId}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 1,
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {contract.contract_number} - {contract.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {contract.description || 'Sem descrição'}
                            {contract.plan_id && ` | Plano ID: ${contract.plan_id}`}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={contract.status || 'draft'}
                            size="small"
                            color={contract.status === 'active' ? 'success' : 'default'}
                          />
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSubscriberContractForm({ ...contract });
                              setEditingSubscriberContractIndexCreate(index);
                            }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setTempSubscriberContracts(tempSubscriberContracts.filter((_, i) => i !== index));
                              if (editingSubscriberContractIndexCreate === index) {
                                setEditingSubscriberContractIndexCreate(null);
                                setSubscriberContractForm({
                                  contract_number: '',
                                  contract_type: 'advertising',
                                  title: '',
                                  description: '',
                                  start_date: getDefaultContractStartDate(),
                                  end_date: getDefaultContractEndDate(),
                                  currency: 'BRL',
                                  status: 'draft',
                                  plan_id: undefined,
                                });
                              }
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="warning">
                  <strong>Nenhum contrato adicionado.</strong> É obrigatório adicionar pelo menos um contrato antes de criar o anunciante.
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Locais - REMOVIDA: Subscribers não criam locais próprios */}
          {createTab === 2 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Locais
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>Nota:</strong> Anunciantes não criam locais próprios. 
                Locais pertencem apenas a Publishers. 
                Anunciantes acessam locais através de planos e contratos.
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
          {createTab === 3 && (
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
          {createTab === 4 && (
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
            setTempSubscriberContracts([]);
            setEditingSubscriberContractIndexCreate(null);
            setSubscriberContractForm({
              contract_number: '',
              contract_type: 'advertising',
              title: '',
              description: '',
              start_date: getDefaultContractStartDate(),
              end_date: getDefaultContractEndDate(),
              currency: 'BRL',
              status: 'draft',
              plan_id: undefined,
            });
          }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateSubscriber}
            disabled={!newSubscriber.name?.trim() || !tempSubscriberContracts || tempSubscriberContracts.length === 0}
            title={
              (!tempSubscriberContracts || tempSubscriberContracts.length === 0) 
                ? 'Adicione pelo menos um contrato na aba "Contratos"' 
                : ''
            }
          >
            Criar Anunciante
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog com Abas */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => {
          setEditDialogOpen(false);
          setError(null);
          setEditTab(0);
          setEditMedias([]);
          setEditPlaylists([]);
          setEditCampaigns([]);
          setEditingEditMediaIndex(null);
          setEditingEditPlaylistIndex(null);
          setEditingEditCampaignIndex(null);
          setEditingSubscriberContractIndexEdit(null);
          setSubscriberContractFormEdit({
            contract_number: '',
            contract_type: 'advertising',
            title: '',
            description: '',
            start_date: getDefaultContractStartDate(),
            end_date: getDefaultContractEndDate(),
            currency: 'BRL',
            status: 'draft',
            plan_id: undefined,
          });
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Editar Anunciante - {selectedSubscriber?.name || ''}
        </DialogTitle>
        <DialogContent>
          <Tabs value={editTab} onChange={(_, newValue) => setEditTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Informações" />
            {(() => {
              const contractsCount = (activeContracts || []).length;
              return (
                <Tab
                  label="Contratos"
                  icon={contractsCount > 0 ? <Chip label={contractsCount} size="small" color="primary" /> : undefined}
                  iconPosition="end"
                />
              );
            })()}
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
              <SubscriberForm
                mode="edit"
                subscriber={selectedSubscriber}
                data={selectedSubscriber}
                onChange={(data) => {
                  setSelectedSubscriber({
                    ...selectedSubscriber,
                    ...(data as UpdateSubscriberRequest),
                  });
                }}
              />
            </Box>
          )}

          {/* Aba Contratos */}
          {editTab === 1 && selectedSubscriber && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>Contratos do Anunciante</Typography>
              
              {/* Formulário para criar/editar Subscriber Contract */}
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, bgcolor: editingSubscriberContractIndexEdit !== null ? alpha(theme.palette.primary.main, 0.05) : 'transparent' }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  {editingSubscriberContractIndexEdit !== null ? 'Editar Contrato' : 'Adicionar Contrato'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Plano</InputLabel>
                      <Select
                        value={subscriberContractFormEdit.plan_id || ''}
                        label="Plano"
                        onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, plan_id: e.target.value ? Number(e.target.value) : undefined })}
                      >
                        <MenuItem value="">Nenhum (contrato sem plano)</MenuItem>
                        {availablePlansForContract.map((p: any) => (
                          <MenuItem key={p.planId} value={p.planId}>{p.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Número do Contrato *"
                      value={subscriberContractFormEdit.contract_number || ''}
                      size="small"
                      required
                      InputProps={{ readOnly: true, disabled: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small" required>
                      <InputLabel>Tipo de Contrato *</InputLabel>
                      <Select
                        value={subscriberContractFormEdit.contract_type || 'advertising'}
                        label="Tipo de Contrato *"
                        onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, contract_type: e.target.value as any })}
                      >
                        <MenuItem value="advertising">Advertising</MenuItem>
                        <MenuItem value="subscription">Subscription</MenuItem>
                        <MenuItem value="partnership">Partnership</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Título *"
                      value={subscriberContractFormEdit.title || ''}
                      onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, title: e.target.value })}
                      size="small"
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Descrição"
                      value={subscriberContractFormEdit.description || ''}
                      onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, description: e.target.value })}
                      size="small"
                      multiline
                      rows={2}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Início *"
                      type="date"
                      value={formatDateForInput(subscriberContractFormEdit.start_date) || ''}
                      onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, start_date: e.target.value })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Data de Término"
                      type="date"
                      value={formatDateForInput(subscriberContractFormEdit.end_date) || getDefaultContractEndDate()}
                      onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, end_date: e.target.value || getDefaultContractEndDate() })}
                      size="small"
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Moeda"
                      value={subscriberContractFormEdit.currency || 'BRL'}
                      onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, currency: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={subscriberContractFormEdit.status || 'draft'}
                        label="Status"
                        onChange={(e) => setSubscriberContractFormEdit({ ...subscriberContractFormEdit, status: e.target.value as any })}
                      >
                        <MenuItem value="draft">Rascunho</MenuItem>
                        <MenuItem value="active">Ativo</MenuItem>
                        <MenuItem value="expired">Expirado</MenuItem>
                        <MenuItem value="terminated">Terminado</MenuItem>
                        <MenuItem value="cancelled">Cancelado</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={async () => {
                        if (!subscriberContractFormEdit.contract_number || !subscriberContractFormEdit.title) {
                          setError('Número do contrato e título são obrigatórios');
                          return;
                        }
                        if (!selectedSubscriber?.subscriber_id) {
                          setError('Anunciante não selecionado');
                          return;
                        }
                        try {
                          if (editingSubscriberContractIndexEdit !== null) {
                            // Atualizar contrato existente
                            const contractToUpdate = activeContracts[editingSubscriberContractIndexEdit];
                            await contractApi.update(contractToUpdate.contract_id, {
                              ...subscriberContractFormEdit,
                              start_date: formatDateForAPI(subscriberContractFormEdit.start_date),
                              end_date: formatDateForAPI(subscriberContractFormEdit.end_date || getDefaultContractEndDate()),
                            });
                            setEditingSubscriberContractIndexEdit(null);
                          } else {
                            // Criar novo contrato
                            await contractApi.create({
                              ...subscriberContractFormEdit,
                              start_date: formatDateForAPI(subscriberContractFormEdit.start_date) || '',
                              end_date: formatDateForAPI(subscriberContractFormEdit.end_date || getDefaultContractEndDate()),
                              subscriber_id: selectedSubscriber.subscriber_id,
                              created_before_subscriber: false,
                            });
                          }
                          // Recarregar contratos
                          const list = await subscriberApi.getContracts(selectedSubscriber.subscriber_id);
                          setActiveContracts(Array.isArray(list) ? list : []);
                          // Limpar formulário
                          setSubscriberContractFormEdit({
                            contract_number: '',
                            contract_type: 'advertising',
                            title: '',
                            description: '',
                            start_date: getDefaultContractStartDate(),
                            end_date: getDefaultContractEndDate(),
                            currency: 'BRL',
                            status: 'draft',
                            plan_id: undefined,
                          });
                        } catch (error: any) {
                          setError(error?.response?.data?.error || error?.message || 'Erro ao salvar contrato');
                        }
                      }}
                      disabled={!subscriberContractFormEdit.contract_number || !subscriberContractFormEdit.title}
                    >
                      {editingSubscriberContractIndexEdit !== null ? 'Atualizar Contrato' : 'Adicionar Contrato'}
                    </Button>
                    {editingSubscriberContractIndexEdit !== null && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setEditingSubscriberContractIndexEdit(null);
                          setSubscriberContractFormEdit({
                            contract_number: '',
                            contract_type: 'advertising',
                            title: '',
                            description: '',
                            start_date: getDefaultContractStartDate(),
                            end_date: getDefaultContractEndDate(),
                            currency: 'BRL',
                            status: 'draft',
                            plan_id: undefined,
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

              {/* Lista de Contratos do Anunciante */}
              {Array.isArray(activeContracts) && activeContracts.length > 0 ? (
                <List>
                  {activeContracts.map((contract, index) => (
                    <ListItem
                      key={contract.contract_id}
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        mb: 1,
                        flexDirection: 'column',
                        alignItems: 'stretch',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {contract.contract_number} - {contract.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {contract.description || 'Sem descrição'}
                            {contract.plan_name && ` | Plano: ${contract.plan_name}`}
                            {contract.start_date && ` | Início: ${new Date(contract.start_date).toLocaleDateString('pt-BR')}`}
                            {contract.end_date && ` | Fim: ${new Date(contract.end_date).toLocaleDateString('pt-BR')}`}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip
                            label={contract.status || 'draft'}
                            size="small"
                            color={contract.status === 'active' ? 'success' : 'default'}
                          />
                          <IconButton
                            size="small"
                            onClick={async () => {
                              try {
                                const plans = await planApi.getAll(false);
                                setAvailablePlansForContract(plans ?? []);
                                setSubscriberContractFormEdit({
                                  contract_number: contract.contract_number,
                                  contract_type: contract.contract_type as any,
                                  title: contract.title,
                                  description: contract.description || '',
                                  start_date: formatDateForInput(contract.start_date) || getDefaultContractStartDate(),
                                  end_date: formatDateForInput(contract.end_date) || getDefaultContractEndDate(),
                                  currency: contract.currency || 'BRL',
                                  status: contract.status as any || 'draft',
                                  plan_id: contract.plan_id || undefined,
                                });
                                setEditingSubscriberContractIndexEdit(index);
                              } catch (error) {
                                console.error('Erro ao carregar dados do contrato:', error);
                              }
                            }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={async () => {
                              if (window.confirm(`Tem certeza que deseja excluir o contrato "${contract.contract_number}"?`)) {
                                try {
                                  await contractApi.delete(contract.contract_id);
                                  const list = await subscriberApi.getContracts(selectedSubscriber!.subscriber_id);
                                  setActiveContracts(Array.isArray(list) ? list : []);
                                  if (editingSubscriberContractIndexEdit === index) {
                                    setEditingSubscriberContractIndexEdit(null);
                                    setSubscriberContractFormEdit({
                                      contract_number: '',
                                      contract_type: 'advertising',
                                      title: '',
                                      description: '',
                                      start_date: getDefaultContractStartDate(),
                                      end_date: getDefaultContractEndDate(),
                                      currency: 'BRL',
                                      status: 'draft',
                                      plan_id: undefined,
                                    });
                                  }
                                } catch (error: any) {
                                  setError(error?.response?.data?.error || error?.message || 'Erro ao excluir contrato');
                                }
                              }
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  Nenhum contrato vinculado ao anunciante ainda.
                </Alert>
              )}
            </Box>
          )}

          {/* Aba Mídias */}
          {editTab === 2 && selectedSubscriber && (
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
                    const apiThumbnail = media.media_id ? `${process.env.REACT_APP_API_URL || '/api'}/media/${media.media_id}/thumbnail` : null;
                    let previewUrl: string | null = apiThumbnail || media.thumbnailUrl || media.previewUrl || media.file_path || null;
                    if (previewUrl && previewUrl.startsWith('/opt/smart-signage/public/assets/')) {
                      previewUrl = previewUrl.replace('/opt/smart-signage/public/assets/', '/assets/');
                    }
                    if (previewUrl && (previewUrl.startsWith('/assets/uploads/') || previewUrl.includes('assets/uploads/'))) {
                      previewUrl = apiThumbnail;
                    }
                    const showPlaceholder = mediaPreviewFailed.has(media.media_id) || !previewUrl;
                    const isThumbnailUrl = previewUrl?.includes('/thumbnail');

                    return (
                      <Grid item xs={12} sm={6} md={4} key={media.media_id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <Box sx={{ position: 'relative', height: 150, bgcolor: theme.palette.grey[100], overflow: 'hidden' }}>
                            {!showPlaceholder && previewUrl && (media.media_type === 'image' || isThumbnailUrl) ? (
                              <Box
                                component="img"
                                src={previewUrl}
                                alt={media.name}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={() => setMediaPreviewFailed(prev => new Set(prev).add(media.media_id))}
                              />
                            ) : !showPlaceholder && previewUrl && media.media_type === 'video' && !isThumbnailUrl ? (
                              <Box
                                component="video"
                                src={previewUrl}
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                muted
                                onError={() => setMediaPreviewFailed(prev => new Set(prev).add(media.media_id))}
                                onMouseEnter={(e: any) => e.target.play?.()}
                                onMouseLeave={(e: any) => { e.target.pause?.(); e.target.currentTime = 0; }}
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
          {editTab === 3 && selectedSubscriber && (
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
          {editTab === 4 && selectedSubscriber && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Campanhas ({editCampaigns.length})
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
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
                        value={editCampaignForm.contractId != null ? String(editCampaignForm.contractId) : ''}
                        label="Contrato"
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditCampaignForm({ ...editCampaignForm, contractId: v !== '' && v != null ? Number(v) : undefined });
                        }}
                      >
                        <MenuItem value="">
                          <em>Nenhum (Rascunho)</em>
                        </MenuItem>
                        {contractsActiveForCampaign.map((contract: any) => (
                          <MenuItem key={contract.contract_id} value={String(contract.contract_id)}>
                            {contract.contract_number} - {contract.plan_name || 'Sem plano'}
                            {contract.start_date && contract.end_date &&
                              ` (${new Date(contract.start_date).toLocaleDateString('pt-BR')} a ${new Date(contract.end_date).toLocaleDateString('pt-BR')})`
                            }
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {contractsActiveForCampaign.length === 0 && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Você precisa ter um contrato ativo para executar campanhas nos totens. Crie ou ative um contrato na aba &quot;Contratos&quot;.
                      </Alert>
                    )}
                    {!editCampaignForm.contractId && (
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
                      type="button"
                      variant="contained"
                      startIcon={campaignSaveLoading ? undefined : <Add />}
                      onClick={handleAddCampaign}
                      disabled={campaignSaveLoading}
                    >
                      {campaignSaveLoading
                        ? 'A adicionar…'
                        : editingEditCampaignIndex !== null
                          ? 'Atualizar Campanha'
                          : 'Adicionar Campanha'}
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
                  {editCampaigns.map((campaign, index) => {
                    const campaignId = campaign.campaign_id || (campaign as any).id;
                    const contractId = campaign.contract_id || (campaign as any).contractId;
                    return (
                    <ListItem key={campaignId} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}>
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
                            {contractId ? (
                              <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                                ✓ Vinculada ao contrato: {(campaign as any).contract_number || (campaign as any).contract_title || `#${contractId}`}
                                {(campaign as any).plan_name && ` (Plano: ${(campaign as any).plan_name})`}
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
                    );
                  })}
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
      <SubscriberDetails
        open={detailsDialogOpen}
        subscriber={selectedSubscriber}
        onClose={() => {
          setDetailsDialogOpen(false);
        }}
        onEdit={async (subscriber) => {
          setSelectedSubscriber(subscriber);
          setEditDialogOpen(true);
          await loadSubscriberDataForEdit(subscriber.subscriber_id);
        }}
      />
    </Box>
  );
};

export default Subscribers;




