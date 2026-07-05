import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  InputAdornment,
  CircularProgress,
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
  MediaInUseConflictPayload,
  parseMediaInUseConflict,
  CreateMediaRequest,
  UpdateMediaRequest,
  playlistApi,
  PlaylistItem,
  PlaylistMediaItem,
  CreatePlaylistRequest,
  UpdatePlaylistRequest,
  campaignApi,
  Campaign,
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
  settingsApi,
  subscriberBillingApi,
  SubscriberBillingItem,
} from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import MediaDeleteConflictDialog from '../../components/MediaDeleteConflictDialog/MediaDeleteConflictDialog';
import MediaTransformActions from '../../components/Media/MediaTransformActions';
import { SortableList } from '../../components/SortableList/SortableList';
import { SubscriberCard, SubscriberDetails, SubscriberForm } from './components';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import CampaignFullEditorDialog from '../Campaigns/CampaignFullEditorDialog';
import { isSubscriberContractActiveForCampaign } from './subscriberContractHealth';
import { useAppSelector } from '../../store/hooks';
import { getForeignTotemIdFromRow, getTotemIdFromRow, getTotemLocalIdFromRow } from '../../utils/totemRowIds';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { useMediaRotationTransform, mediaPortraitPreviewSx, mediaPortraitPreviewFrameSx } from '../../hooks/useMediaRotationTransform';
import {
  billingIntervalLabel,
  contractEndDateHelperText,
  getMinContractEndDate,
  normalizeBillingInterval,
} from '../../utils/billingIntervals';
import { PlanTopologyPreviewRow, loadPlanTopologyPreviewRows, countTopologyInRows } from './planTopologyPreview';
import { PlanTopologyTabPanel } from './PlanTopologyTabPanel';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';
import {
  formatDateForApi as formatDateForAPI,
  formatDateForInput,
  getDefaultContractStartDate,
} from '../../utils/businessDate';
import { getTodayYmd } from '../../utils/campaignStartDate';
import SubscriberContractList from './components/SubscriberContractList';
import {
  applyContractBillingInterval,
  applyContractEndDate,
  applyContractStartDate,
  applyPlanToContractForm,
  buildContractEndDateForStart,
  filterEditableContracts,
  formatCurrencyAmount,
  getContractIntervalOptions,
  getPlanIdFromOption,
  getPlanOptionLabel,
  getSelectedPlanValueHelper,
  validateSubscriberContractForm,
} from './subscriberContractUtils';

const compareByDisplayName = (a?: string, b?: string) =>
  String(a || '').localeCompare(String(b || ''), 'pt-BR', { sensitivity: 'base', numeric: true });

const isVideoOrAudioMediaType = (mediaType?: string | null): boolean => {
  const t = String(mediaType || '').trim().toLowerCase();
  if (t === 'video' || t === 'audio') return true;
  return t.startsWith('video/') || t.startsWith('audio/');
};

interface SubscriberStatusFilterOption {
  value: string;
  label: string;
  activeOnly?: boolean;
}

const DEFAULT_SUBSCRIBER_STATUS_OPTIONS: SubscriberStatusFilterOption[] = [
  { value: 'active', label: 'Ativos', activeOnly: true },
  { value: 'all', label: 'Todos' },
];

const normalizeSubscriberStatusOptions = (rawValue: unknown): SubscriberStatusFilterOption[] => {
  const source = Array.isArray(rawValue)
    ? rawValue
    : rawValue && typeof rawValue === 'object' && Array.isArray((rawValue as any).options)
      ? (rawValue as any).options
      : [];

  const options = source
    .map((option: unknown) => {
      const o = option as Record<string, unknown>;
      return {
        value: String(o?.value ?? '').trim(),
        label: String(o?.label ?? o?.value ?? '').trim(),
        activeOnly: o?.activeOnly === true,
      };
    })
    .filter(
      (option: SubscriberStatusFilterOption): option is SubscriberStatusFilterOption =>
        Boolean(option.value && option.label)
    );

  return options.length > 0 ? options : DEFAULT_SUBSCRIBER_STATUS_OPTIONS;
};

const Subscribers: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const breadcrumbs = useBreadcrumbs();
  const authUser = useAppSelector((state) => state.auth.user);
  /** Comercial consulta campanhas no anunciante; não edita nem abre o editor completo. */
  const isOperadorComercial = authUser?.role === 'operador_comercial';

  /** Valor fechado do Select em verde (igual à cor dos chips de escolha noutras áreas). */
  const sxSelectChosenGreen = (hasSelection: boolean) =>
    hasSelection
      ? ({
          '& .MuiSelect-select': {
            color: theme.palette.success.main,
            fontWeight: 500,
          },
        } as const)
      : undefined;

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
  const [statusFilterValue, setStatusFilterValue] = useState<string>('active');
  const [subscriberStatusOptions, setSubscriberStatusOptions] = useState<SubscriberStatusFilterOption[]>(
    DEFAULT_SUBSCRIBER_STATUS_OPTIONS
  );
  const [error, setError] = useState<string | null>(null);
  // Estados para paginação
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12);
  const [total, setTotal] = useState<number>(0);
  const [createTab, setCreateTab] = useState(0); // NOVO: Aba do dialog de criação
  const [editTab, setEditTab] = useState(0); // NOVO: Aba do dialog de edição
  /** Transição ao voltar da página de contrato. */
  const [restoringSubscriberEdit, setRestoringSubscriberEdit] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('openEdit')
  );
  /** Editor completo de campanha (mesmas abas que o menu global). */
  const [campaignFullEditorOpen, setCampaignFullEditorOpen] = useState(false);
  const [campaignFullEditorId, setCampaignFullEditorId] = useState<number | null>(null);
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
  const [subscriberContractForm, setSubscriberContractForm] = useState<CreateContractRequest>({
    contract_number: '',
    contract_type: 'advertising',
    title: '',
    description: '',
    start_date: getDefaultContractStartDate(),
    end_date: buildContractEndDateForStart(getDefaultContractStartDate()),
    currency: 'BRL',
    total_amount: undefined,
    billing_interval: 'month',
    status: 'draft',
    plan_id: undefined,
  });
  /** Faturas em atraso (prestações) ao editar anunciante — aba Contratos */
  const [editSubscriberOverdueBillings, setEditSubscriberOverdueBillings] = useState<SubscriberBillingItem[]>([]);
  const [editSubscriberOverdueLoading, setEditSubscriberOverdueLoading] = useState(false);
  const [editSubscriberOverdueError, setEditSubscriberOverdueError] = useState<string | null>(null);

  // NOVO: Estados para gerenciar locais, totens, smart TVs e subscribers durante a criação
  const [tempLocals, setTempLocals] = useState<CreateLocalRequest[]>([]);
  const [tempTotems, setTempTotems] = useState<(CreatePlayerRequest & { tempId: string })[]>([]);
  const [tempSmartTvs, setTempSmartTvs] = useState<(CreateSmartTvRequest & { tempId: string })[]>([]);
  const [editingLocalIndex, setEditingLocalIndex] = useState<number | null>(null);
  const [editingTotemIndex, setEditingTotemIndex] = useState<number | null>(null);
  const [editingSmartTvIndex, setEditingSmartTvIndex] = useState<number | null>(null);

  /** Locais/totens/TVs derivados dos planos nos contratos (somente leitura no assistente de criação). */
  const [createContractPlanPreview, setCreateContractPlanPreview] = useState<{
    loading: boolean;
    error: string | null;
    rows: PlanTopologyPreviewRow[];
  }>({ loading: false, error: null, rows: [] });

  /** Mesma rede do plano, na edição de anunciante (contratos persistidos). */
  const [editContractPlanPreview, setEditContractPlanPreview] = useState<{
    loading: boolean;
    error: string | null;
    rows: PlanTopologyPreviewRow[];
  }>({ loading: false, error: null, rows: [] });

  /** Sub-abas Locais / Totens / Smart TVs dentro da aba Contratos (modal Editar). */
  const [editContractTopologySubTab, setEditContractTopologySubTab] = useState(0);
  /** Contrato selecionado na aba Contratos (modal Editar). */
  const [editSelectedContractId, setEditSelectedContractId] = useState<number | null>(null);

  const createPreviewCounts = useMemo(
    () => countTopologyInRows(createContractPlanPreview.rows),
    [createContractPlanPreview.rows]
  );

  const editSelectedContractTopologyPreview = useMemo(() => {
    const base = editContractPlanPreview;
    if (editSelectedContractId == null) {
      return { ...base, rows: [] as PlanTopologyPreviewRow[] };
    }
    const rowKey = `contract-${editSelectedContractId}`;
    const row = base.rows.find((r) => r.rowKey === rowKey);
    return { ...base, rows: row ? [row] : [] };
  }, [editContractPlanPreview, editSelectedContractId]);

  const editPreviewCounts = useMemo(
    () => countTopologyInRows(editSelectedContractTopologyPreview.rows),
    [editSelectedContractTopologyPreview.rows]
  );

  // Estados para edição de Anunciante (carregar dados existentes)
  const [editMedias, setEditMedias] = useState<MediaItem[]>([]);
  const [mediaPreviewFailed, setMediaPreviewFailed] = useState<Set<number>>(new Set());
  const [editPlaylists, setEditPlaylists] = useState<PlaylistItem[]>([]);
  const [editCampaigns, setEditCampaigns] = useState<Campaign[]>([]);
  const [editingEditMediaIndex, setEditingEditMediaIndex] = useState<number | null>(null);
  const [processingMediaFitId, setProcessingMediaFitId] = useState<number | null>(null);
  const [mediaDeleteConflict, setMediaDeleteConflict] = useState<MediaInUseConflictPayload | null>(null);
  const [mediaDeleteConflictOpen, setMediaDeleteConflictOpen] = useState(false);
  const [mediaDeleteLoading, setMediaDeleteLoading] = useState(false);
  const [pendingMediaDeleteIndex, setPendingMediaDeleteIndex] = useState<number | null>(null);
  const [mediaThumbVersion, setMediaThumbVersion] = useState(0);
  const HOVER_PREVIEW_MAX_BYTES = 30 * 1024 * 1024;
  const videoHoverBlobUrlsRef = useRef<Map<number, string>>(new Map());
  const hoverGenRef = useRef(0);
  const [videoHover, setVideoHover] = useState<{ id: number | null; url: string | null }>({
    id: null,
    url: null,
  });
  const hoverVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeOnlyFilter = useMemo(() => {
    const selectedOption = subscriberStatusOptions.find((option) => option.value === statusFilterValue);
    return selectedOption?.activeOnly === true;
  }, [statusFilterValue, subscriberStatusOptions]);
  const [editingEditPlaylistIndex, setEditingEditPlaylistIndex] = useState<number | null>(null);
  
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
  // Estados para itens de playlist
  const [playlistItems, setPlaylistItems] = useState<PlaylistMediaItem[]>([]);
  const [editingPlaylistItemIndex, setEditingPlaylistItemIndex] = useState<number | null>(null);
  const [selectedMediasForPlaylist, setSelectedMediasForPlaylist] = useState<number[]>([]);
  const [defaultPlaylistItemDuration, setDefaultPlaylistItemDuration] = useState<number>(10);
  const [editingItemDuration, setEditingItemDuration] = useState<number | null>(null);
  const [tempItemDuration, setTempItemDuration] = useState<{ [itemId: number]: number }>({});
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  /** Totens derivados da exposição da playlist (campanhas → organizações/locais/totens) */
  const [editPlaylistTotemLabels, setEditPlaylistTotemLabels] = useState<string[]>([]);
  
  // Estados para campanha (mídias e playlists associadas)
  
  // Estados para contratos
  // null = ainda não carregado do backend (evita gerar número antes da hora)
  const [activeContracts, setActiveContracts] = useState<any[] | null>(null);
  /** Contratos com status "active" para vincular a campanhas (só estes podem ser usados nos totens) */
  const contractsActiveForCampaign = useMemo(
    () => (activeContracts || []).filter((c: any) => isSubscriberContractActiveForCampaign(c)),
    [activeContracts]
  );

  const editSelectedContract = useMemo(() => {
    if (editSelectedContractId == null || !Array.isArray(activeContracts)) return null;
    return (
      activeContracts.find((c: any) => Number(c.contract_id) === Number(editSelectedContractId)) ??
      null
    );
  }, [activeContracts, editSelectedContractId]);

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
    let cancelled = false;

    const loadStatusOptions = async () => {
      try {
        const settings = await settingsApi.getPublic();
        const options = normalizeSubscriberStatusOptions(settings['ui.combo.subscribers.status_filter']);
        if (!cancelled) {
          setSubscriberStatusOptions(options);
          if (!options.some((option) => option.value === 'active')) {
            setStatusFilterValue(options[0]?.value || 'active');
          }
        }
      } catch {
        if (!cancelled) {
          setSubscriberStatusOptions(DEFAULT_SUBSCRIBER_STATUS_OPTIONS);
        }
      }
    };

    loadStatusOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadSubscribers();
  }, [activeOnlyFilter, page, limit]);

  // Carregar planos quando a aba Contratos for aberta (criação ou edição)
  useEffect(() => {
    if ((createTab === 1 && createDialogOpen) || (editTab === 1 && editDialogOpen)) {
      const loadPlans = async () => {
        try {
          const plans = await planApi.getAll(false);
          setAvailablePlansForContract(plans ?? []);
        } catch (error) {
          setAvailablePlansForContract([]);
        }
      };
      loadPlans();
    }
  }, [createTab, createDialogOpen, editTab, editDialogOpen]);

  /** Carrega rede (organizações → locais/totens/TVs) conforme planos nos contratos em rascunho. */
  useEffect(() => {
    if (!createDialogOpen) {
      setCreateContractPlanPreview({ loading: false, error: null, rows: [] });
      return;
    }
    let cancelled = false;
    const load = async () => {
      if (tempSubscriberContracts.length === 0) {
        setCreateContractPlanPreview({ loading: false, error: null, rows: [] });
        return;
      }
      setCreateContractPlanPreview((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const rows = await loadPlanTopologyPreviewRows(
          tempSubscriberContracts.map((c) => ({
            tempId: c.tempId,
            plan_id: c.plan_id,
            title: c.title,
            contract_number: c.contract_number,
          }))
        );
        if (!cancelled) {
          setCreateContractPlanPreview({ loading: false, error: null, rows });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setCreateContractPlanPreview({
            loading: false,
            error: pickApiErrorMessage(e, 'Erro ao carregar rede do plano'),
            rows: [],
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [createDialogOpen, tempSubscriberContracts]);

  /** Rede do plano por contrato persistido (modal Editar → aba Contratos). */
  useEffect(() => {
    if (!editDialogOpen || editTab !== 1) {
      setEditContractPlanPreview({ loading: false, error: null, rows: [] });
      return;
    }
    if (!Array.isArray(activeContracts)) return;

    let cancelled = false;
    const load = async () => {
      if (activeContracts.length === 0) {
        setEditContractPlanPreview({ loading: false, error: null, rows: [] });
        return;
      }
      setEditContractPlanPreview((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const rows = await loadPlanTopologyPreviewRows(
          activeContracts.map((c: any) => ({
            contract_id: c.contract_id,
            plan_id: c.plan_id,
            title: c.title,
            contract_number: c.contract_number,
          }))
        );
        if (!cancelled) {
          setEditContractPlanPreview({ loading: false, error: null, rows });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setEditContractPlanPreview({
            loading: false,
            error: pickApiErrorMessage(e, 'Erro ao carregar rede do plano'),
            rows: [],
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [editDialogOpen, editTab, activeContracts]);

  /** Seleciona contrato na aba Contratos quando nenhum está selecionado (ex.: abrir modal manualmente). */
  useEffect(() => {
    if (!editDialogOpen || editTab !== 1 || !Array.isArray(activeContracts)) return;
    if (activeContracts.length === 0) {
      if (editSelectedContractId != null) setEditSelectedContractId(null);
      return;
    }
    if (editSelectedContractId != null) {
      const stillExists = activeContracts.some(
        (c: any) => Number(c.contract_id) === Number(editSelectedContractId)
      );
      if (stillExists) return;
    }
    setEditSelectedContractId(Number(activeContracts[0].contract_id));
  }, [editDialogOpen, editTab, activeContracts, editSelectedContractId]);

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
        active_only: activeOnlyFilter ? true : undefined,
        page,
        limit,
      });
      const subscribersData = Array.isArray(response.data) ? [...response.data] : [];
      subscribersData.sort((a: any, b: any) => compareByDisplayName(a?.name, b?.name));
      setSubscribers(subscribersData);
      setTotal(response.total || response.data?.length || 0);
    } catch (error) {
      setError(pickApiErrorMessage(error, 'Erro ao carregar lista de Subscribers'));
    } finally {
      setLoading(false);
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
    } catch {
      /* estatísticas opcionais; falha não bloqueia o fluxo */
    }
  };

  const refreshSubscriberContracts = async (subscriberId: number) => {
    const list = await subscriberApi.getContracts(subscriberId, { activeOnly: false });
    setActiveContracts(Array.isArray(list) ? filterEditableContracts(list) : []);
  };

  const fetchSubscriberOverdueBillings = useCallback(
    async (subscriberId: number): Promise<{ rows: SubscriberBillingItem[]; error: string | null }> => {
      try {
        const res = await subscriberBillingApi.getAll({
          subscriberId,
          dueFilter: 'overdue',
          limit: 50,
          page: 1,
        });
        return { rows: Array.isArray(res.billings) ? res.billings : [], error: null };
      } catch (e: unknown) {
        return {
          rows: [],
          error: pickApiErrorMessage(e, 'Erro ao carregar prestações em atraso'),
        };
      }
    },
    []
  );

  /** Prestações em atraso — só na aba Contratos do modal de edição. */
  useEffect(() => {
    if (!editDialogOpen || !selectedSubscriber || editTab !== 1) {
      setEditSubscriberOverdueBillings([]);
      setEditSubscriberOverdueLoading(false);
      setEditSubscriberOverdueError(null);
      return;
    }
    const subscriberId = selectedSubscriber.subscriber_id;
    let cancelled = false;
    setEditSubscriberOverdueError(null);
    setEditSubscriberOverdueLoading(true);
    fetchSubscriberOverdueBillings(subscriberId)
      .then(({ rows, error }) => {
        if (!cancelled) {
          setEditSubscriberOverdueBillings(rows);
          setEditSubscriberOverdueError(error);
        }
      })
      .finally(() => {
        if (!cancelled) setEditSubscriberOverdueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editDialogOpen, editTab, selectedSubscriber?.subscriber_id, fetchSubscriberOverdueBillings]);

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
      // campaignApi.getAll já normaliza cada linha (campaignNormalize); só filtrar inválidas.
      const campaignsArray = Array.isArray(campaignsResponse)
        ? campaignsResponse
        : (campaignsResponse as any)?.data || [];

      const campaignsForEdit = campaignsArray.filter((c: any) => c.campaign_id);

      setEditCampaigns(campaignsForEdit);
      const contracts = Array.isArray(contractsResponse) ? filterEditableContracts(contractsResponse) : [];
      setActiveContracts(contracts);
      return contracts;
    } catch (error) {
      setError(pickApiErrorMessage(error, 'Erro ao carregar dados do Anunciante'));
      return [];
    }
  };

  const {
    getRotationDraft,
    handleRotatePreview,
    handleConfirmRotation,
    processingRotationId,
  } = useMediaRotationTransform(async () => {
    setMediaThumbVersion((v) => v + 1);
    if (selectedSubscriber) {
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  });

  // Carregar dados automaticamente quando o dialog de edição abrir
  useEffect(() => {
    if (editDialogOpen && selectedSubscriber) {
      loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  }, [editDialogOpen, selectedSubscriber?.subscriber_id]);

  // Recarregar contratos ao entrar nas abas Contratos/Campanhas no modal de edição.
  // Isso mantém o combo "Contrato" da campanha sempre atualizado após qualquer manipulação.
  useEffect(() => {
    if (!editDialogOpen || !selectedSubscriber) return;
    if (editTab !== 1 && editTab !== 4) return;
    refreshSubscriberContracts(selectedSubscriber.subscriber_id).catch(() => {
      /* refresh em background */
    });
  }, [editDialogOpen, editTab, selectedSubscriber?.subscriber_id]);

  // Se o contrato selecionado na campanha deixar de existir/ficar inativo, limpar a seleção.
  // (contrato é gerido no CampaignFullEditorDialog)

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
      setError(pickApiErrorMessage(error, 'Erro ao salvar local'));
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
      const totemsToRemove = editTotems.filter(
        (t) => getTotemLocalIdFromRow(t) === local.local_id
      );
      for (const totem of totemsToRemove) {
        try {
          const totemPk = getTotemIdFromRow(totem);
          const smartTvsToRemove = editSmartTvs.filter(
            (tv) => getForeignTotemIdFromRow(tv) === totemPk
          );
          for (const tv of smartTvsToRemove) {
            await smartTvApi.delete(tv.smart_tv_id);
          }
          if (totemPk !== undefined) await totemApi.delete(totemPk);
        } catch {
          // ignorar falha ao remover totens dependentes
        }
      }
      await localApi.delete(local.local_id);
      // Recarregar dados
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao excluir local'));
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
        const totemPk =
          getTotemIdFromRow(totemToUpdate) ?? (totemToUpdate as any).totem_id;
        await totemApi.update(totemPk, totemData);
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
      setError(pickApiErrorMessage(error, 'Erro ao salvar totem'));
    }
  };

  const handleEditEditTotem = (index: number) => {
    const totem = editTotems[index];
    // Encontrar índice do local no array editLocals
    const localIndex = editLocals.findIndex(
      (l) => l.local_id === getTotemLocalIdFromRow(totem)
    );
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
      const totemPk = getTotemIdFromRow(totem);
      // Remover smart TVs associadas a este totem primeiro
      const smartTvsToRemove = editSmartTvs.filter(
        (tv) => getForeignTotemIdFromRow(tv) === totemPk
      );
      for (const tv of smartTvsToRemove) {
        try {
          await smartTvApi.delete(tv.smart_tv_id);
        } catch {
          // ignorar falha ao remover Smart TV associada
        }
      }
      if (totemPk !== undefined) await totemApi.delete(totemPk);
      // Recarregar dados
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao excluir totem'));
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
        totem_id:
          getTotemIdFromRow(selectedTotem) ?? (selectedTotem as any).totem_id,
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
      setError(pickApiErrorMessage(error, 'Erro ao salvar Smart TV'));
    }
  };

  const handleEditEditSmartTv = (index: number) => {
    const smartTv = editSmartTvs[index];
    // Encontrar índice do totem no array editTotems
    const totemIndex = editTotems.findIndex(
      (t) =>
        getTotemIdFromRow(t) ===
        getForeignTotemIdFromRow(smartTv)
    );
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
      setError(pickApiErrorMessage(error, 'Erro ao excluir Smart TV'));
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
    setMediaPreviewFailed(new Set());
    setMediaThumbVersion((v) => v + 1);
    if (selectedSubscriber) {
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    }
  };

  const handleMediaPreviewMouseEnter = async (media: MediaItem) => {
    const id = media.media_id;
    if (!id || !/^video$/i.test(String(media.media_type || ''))) return;
    const bytes = Number((media as any).size_bytes ?? (media as any).fileSizeBytes ?? 0);
    if (bytes > HOVER_PREVIEW_MAX_BYTES) return;
    const gen = ++hoverGenRef.current;
    let url = videoHoverBlobUrlsRef.current.get(id);
    if (!url) {
      try {
        const blob = await mediaApi.getFileBlob(id);
        if (gen !== hoverGenRef.current) return;
        url = URL.createObjectURL(blob);
        videoHoverBlobUrlsRef.current.set(id, url);
      } catch {
        if (gen === hoverGenRef.current) setVideoHover({ id: null, url: null });
        return;
      }
    }
    if (gen !== hoverGenRef.current) return;
    setVideoHover({ id, url: url! });
  };

  const handleMediaPreviewMouseLeave = () => {
    hoverGenRef.current += 1;
    try {
      hoverVideoRef.current?.pause();
    } catch {
      /* noop */
    }
    setVideoHover({ id: null, url: null });
  };

  useEffect(() => {
    const el = hoverVideoRef.current;
    if (!el || !videoHover.url) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  }, [videoHover.id, videoHover.url]);

  useEffect(() => {
    return () => {
      videoHoverBlobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      });
      videoHoverBlobUrlsRef.current.clear();
    };
  }, []);

  const handleEditMedia = async () => {
    if (!selectedSubscriber || editingEditMediaIndex === null) return;
    
    try {
      const media = editMedias[editingEditMediaIndex];
      await mediaApi.update(media.media_id, editMediaForm);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
      setEditingEditMediaIndex(null);
      setEditMediaForm({ name: '', description: '', tags: [] });
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao atualizar mídia'));
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

    const media = editMedias[index];
    try {
      setMediaDeleteLoading(true);
      setError(null);
      await mediaApi.delete(media.media_id);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      const conflict = parseMediaInUseConflict(error);
      if (conflict) {
        setPendingMediaDeleteIndex(index);
        setMediaDeleteConflict(conflict);
        setMediaDeleteConflictOpen(true);
        return;
      }
      setError(pickApiErrorMessage(error, 'Erro ao excluir mídia'));
    } finally {
      setMediaDeleteLoading(false);
    }
  };

  const handleForceDeleteMedia = async () => {
    if (!selectedSubscriber || pendingMediaDeleteIndex == null) return;
    const media = editMedias[pendingMediaDeleteIndex];
    if (!media) return;

    try {
      setMediaDeleteLoading(true);
      setError(null);
      const result = await mediaApi.delete(media.media_id, { forceDetach: true });
      setMediaDeleteConflictOpen(false);
      setMediaDeleteConflict(null);
      setPendingMediaDeleteIndex(null);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
      const offlineNote =
        typeof result === 'object' && result && 'offlineTotemWarning' in result
          ? (result as { offlineTotemWarning?: string }).offlineTotemWarning
          : '';
      window.dispatchEvent(
        new CustomEvent('showNotification', {
          detail: {
            type: 'success',
            title: 'Mídia excluída',
            message:
              (typeof result === 'object' && result && 'message' in result
                ? String((result as { message?: string }).message)
                : 'Mídia removida com sucesso') + (offlineNote ? `\n\n${offlineNote}` : ''),
            duration: offlineNote ? 20000 : 8000,
          },
        })
      );
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao excluir mídia'));
    } finally {
      setMediaDeleteLoading(false);
    }
  };

  const handleFitMediaToPortrait = async (media: MediaItem) => {
    if (!selectedSubscriber || processingMediaFitId || processingRotationId) return;
    const mediaId = media.media_id;

    if (!window.confirm('Adequar esta mídia para formato 9:16 (portrait)?')) {
      return;
    }

    try {
      setProcessingMediaFitId(mediaId);
      setError(null);
      await mediaApi.transformToPortrait(mediaId, {
        rotationDegrees: 0,
        fit: '9:16',
      });
      setMediaPreviewFailed((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
      setMediaThumbVersion((v) => v + 1);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao adequar mídia para 9:16'));
    } finally {
      setProcessingMediaFitId(null);
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
      } catch {
        // Validação prévia opcional; backend valida limites na mesma operação
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
      setError(pickApiErrorMessage(error, 'Erro ao salvar playlist'));
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
    
    // Carregar itens da playlist e exposição em totens (via campanhas)
    try {
      const [items, exposure] = await Promise.all([
        playlistApi.getMedia(playlist.playlist_id),
        playlistApi.getExposure(playlist.playlist_id).catch(() => null),
      ]);
      setPlaylistItems(items || []);
      const totemList = exposure?.totems?.length
        ? exposure.totems.map((t) => {
            const n = t.name && String(t.name).trim();
            return n || t.identifier || '';
          }).filter(Boolean)
        : [];
      setEditPlaylistTotemLabels([...new Set(totemList)].sort(compareByDisplayName));
    } catch (error) {
      setPlaylistItems([]);
      setEditPlaylistTotemLabels([]);
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
        const media = editMedias.find((m) => m.media_id === mediaId);
        const mt = String(media?.media_type || '').toLowerCase();
        const imageDurationSec =
          defaultPlaylistItemDuration > 0 ? defaultPlaylistItemDuration : 10;
        const durationMs = isVideoOrAudioMediaType(mt) ? 0 : imageDurationSec * 1000;

        await playlistApi.addMedia(
          playlist.playlist_id,
          mediaId,
          undefined, // orderIndex será calculado automaticamente
          durationMs
        );
      }

      // Recarregar itens da playlist
      const items = await playlistApi.getMedia(playlist.playlist_id);
      setPlaylistItems(items || []);
      
      // Limpar seleção
      setSelectedMediasForPlaylist([]);
    } catch (error: any) {
      setError(`Erro ao adicionar mídias à playlist: ${pickApiErrorMessage(error, 'Erro desconhecido')}`);
    }
  };

  const handleDeletePlaylist = async (index: number) => {
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir esta playlist?')) return;
    
    try {
      const playlist = editPlaylists[index];
      await playlistApi.delete(playlist.playlist_id);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao excluir playlist'));
    }
  };

  // ============================================================================
  // FUNÇÕES CRUD PARA CAMPANHAS
  // ============================================================================

  const handleStartEditCampaign = async (index: number) => {
    if (isOperadorComercial) return;
    const campaign = editCampaigns[index];
    if (!campaign) {
      return;
    }
    const campaignId = campaign.campaign_id || (campaign as any).id;
    if (!campaignId) {
      return;
    }
    if (selectedSubscriber) {
      await refreshSubscriberContracts(selectedSubscriber.subscriber_id);
    }
    setCampaignFullEditorId(Number(campaignId));
    setCampaignFullEditorOpen(true);
  };

  useEffect(() => {
    const st = (location.state || {}) as {
      openEditForSubscriberId?: number;
      focusCampaignTab?: boolean;
      focusContractsTab?: boolean;
      highlightCampaignId?: number;
      highlightContractId?: number;
    };

    const openEditParam = searchParams.get('openEdit');
    const subscriberIdToOpen = openEditParam
      ? Number(openEditParam)
      : st.openEditForSubscriberId;

    if (subscriberIdToOpen == null || !Number.isFinite(subscriberIdToOpen) || subscriberIdToOpen <= 0) {
      setRestoringSubscriberEdit(false);
      return;
    }

    setRestoringSubscriberEdit(true);

    const tabParam = searchParams.get('tab');
    const focusContractsTab = tabParam === 'contracts' || st.focusContractsTab === true;
    const focusCampaignTab = tabParam === 'campaigns' || st.focusCampaignTab === true;
    const contractParam = searchParams.get('contract');
    const highlightContractId =
      contractParam != null && contractParam !== ''
        ? Number(contractParam)
        : st.highlightContractId;
    const highlightCampaignId = st.highlightCampaignId;

    let cancelled = false;
    (async () => {
      try {
        const sub = await subscriberApi.getById(subscriberIdToOpen);
        if (cancelled) return;

        setSelectedSubscriber(sub);
        if (focusCampaignTab) setEditTab(4);
        else if (focusContractsTab) setEditTab(1);
        setEditDialogOpen(true);

        const contractsAfterLoad = await loadSubscriberDataForEdit(sub.subscriber_id);
        if (cancelled) return;

        const resolvedContractId =
          highlightContractId != null && Number.isFinite(highlightContractId)
            ? highlightContractId
            : contractsAfterLoad[0]?.contract_id;
        if (resolvedContractId != null && Number.isFinite(Number(resolvedContractId))) {
          setEditSelectedContractId(Number(resolvedContractId));
        }
        if (!isOperadorComercial && highlightCampaignId != null) {
          setCampaignFullEditorId(highlightCampaignId);
          setCampaignFullEditorOpen(true);
        }
      } catch (e) {
        setError('Não foi possível abrir o anunciante indicado.');
      } finally {
        if (!cancelled) {
          setRestoringSubscriberEdit(false);
          if (openEditParam) {
            setSearchParams({}, { replace: true });
          }
          if (st.openEditForSubscriberId != null) {
            navigate('.', { replace: true, state: {} });
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, location.state, isOperadorComercial]);

  const handleDeleteCampaign = async (index: number) => {
    if (isOperadorComercial) return;
    if (!selectedSubscriber || !window.confirm('Tem certeza que deseja excluir esta campanha?')) return;
    
    try {
      // Validar índice
      if (index < 0 || index >= editCampaigns.length) {
        setError('Erro: campanha não encontrada para exclusão');
        return;
      }

      const campaign = editCampaigns[index];
      if (!campaign) {
        setError('Erro: campanha não encontrada para exclusão');
        return;
      }

      // Normalizar campaignId: tentar múltiplas formas
      const campaignId = campaign.campaign_id || (campaign as any).id || (campaign as any).campaignId;

      // Validação rigorosa
      if (!campaignId || campaignId === 0 || !Number.isInteger(campaignId) || campaignId < 1) {
        setError('Erro: campanha não encontrada para exclusão (ID inválido)');
        return;
      }

      await campaignApi.delete(campaignId);
      await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao excluir campanha'));
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
            billing_interval: c.billing_interval,
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
        setError(errorMessage);
        return;
      }

      // Contratos já foram criados pela procedure quando enviados no payload; não criar de novo via API.

      // NOTA: Subscribers não podem criar locais próprios
      // Locais pertencem apenas a organizações (publisher_id)
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
            setError(errorMessage);
            return;
          }
          
          // Validar que localId é um número válido
          if (!localId || isNaN(Number(localId))) {
            const errorMessage = `Totem na posição ${localIndex + 1}: Local ID inválido`;
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
      const subEdit = selectedSubscriber as Subscriber & { isActive?: boolean };
      const isActivePayload =
        typeof subEdit.isActive === 'boolean' ? subEdit.isActive : subEdit.is_active;

      const updateData: UpdateSubscriberRequest = {
        name: selectedSubscriber.name,
        contact_name: selectedSubscriber.contact_name,
        email: selectedSubscriber.email,
        phone: selectedSubscriber.phone,
        whatsapp: selectedSubscriber.whatsapp,
        category_segment: selectedSubscriber.category_segment,
        description: selectedSubscriber.description,
        isActive: isActivePayload,
      };
      await subscriberApi.update(selectedSubscriber.subscriber_id, updateData);
      setEditDialogOpen(false);
      setEditTab(0);
      setEditContractTopologySubTab(0);
      // Limpar estados de edição
      setEditMedias([]);
      setEditPlaylists([]);
      setEditCampaigns([]);
      setEditingEditMediaIndex(null);
      setEditingEditPlaylistIndex(null);
      setActiveContracts([]);
      setSelectedSubscriber(null);
      loadSubscribers();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao atualizar Anunciante'));
    }
  };

  const handleDeleteSubscriber = async (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir este Anunciante?')) {
      try {
        await subscriberApi.delete(id);
        loadSubscribers();
      } catch (error: any) {
        setError(pickApiErrorMessage(error, 'Erro ao excluir Subscriber'));
      }
    }
  };

  const handleViewDetails = (Subscriber: Subscriber) => {
    setSelectedSubscriber(Subscriber);
    setDetailsDialogOpen(true);
  };

  const openSubscriberPublish = (subscriber: Subscriber) => {
    navigate(`/quick-publish?subscriber=${subscriber.subscriber_id}`);
  };

  const openSubscriberStudio = (subscriber: Subscriber) => {
    navigate(`/quick-publish?mode=create&subscriber=${subscriber.subscriber_id}`);
  };

  const openSubscriberMenuCatalog = (subscriber: Subscriber) => {
    navigate(`/menu-catalog?subscriber=${subscriber.subscriber_id}`);
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
      <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
        <PageHeader
          title="Anunciantes"
          subtitle="Contratos, planos e conteúdos por conta. Tetos: plano (limits) + defaults limits.defaults.* (0 = sem teto). Totais globais no Dashboard."
          breadcrumbs={breadcrumbs}
          loading
        />
        <LinearProgress sx={{ mt: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando…
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <PageHeader
        title="Anunciantes"
        subtitle="Lista, filtros e ações por conta. Resumo agregado (totais globais) está no Dashboard."
        breadcrumbs={breadcrumbs}
        onRefresh={() => {
          void loadSubscribers();
        }}
        loading={loading}
        actions={[
          {
            label: 'Criar Anunciante',
            icon: <Add />,
            onClick: () => setCreateDialogOpen(true),
            variant: 'contained',
          },
        ]}
      />

      <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
        <Typography variant="body2" component="div">
          <strong>Tetos (limites)</strong> aplicam-se no servidor assim: primeiro o <strong>plano</strong> ligado ao{' '}
          <strong>contrato ativo</strong> (campo <code>limits</code> em JSON — ex.: <code>storage_gb</code>, campanhas).
          Se o plano não definir uma métrica, usa-se o default do sistema (<strong>limits.defaults.*</strong> em
          configurações). Valor <strong>0</strong> nesses números significa <strong>sem teto</strong> nessa métrica.
        </Typography>
      </Alert>

      {restoringSubscriberEdit ? (
        <Card sx={{ textAlign: 'center', py: 8, mb: 3 }}>
          <CardContent>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Abrindo contratos do anunciante…
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Aguarde enquanto carregamos os dados do contrato.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
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
                  sx={sxSelectChosenGreen(true)}
                  value={statusFilterValue}
                  label="Status"
                  onChange={(e) => {
                    setStatusFilterValue(String(e.target.value));
                    setPage(1);
                  }}
                >
                  {subscriberStatusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
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
              onPublish={openSubscriberPublish}
              onStudio={openSubscriberStudio}
              onMenuCatalog={openSubscriberMenuCatalog}
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

        </>
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
            end_date: buildContractEndDateForStart(getDefaultContractStartDate()),
            currency: 'BRL',
            total_amount: undefined,
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
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ mb: 3 }}
          >
            <Tab label="Informações" />
            <Tab label="Contratos" icon={tempSubscriberContracts && tempSubscriberContracts.length > 0 ? <Chip label={tempSubscriberContracts.length} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Locais" icon={createPreviewCounts.lc > 0 ? <Chip label={createPreviewCounts.lc} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Totens" icon={createPreviewCounts.tt > 0 ? <Chip label={createPreviewCounts.tt} size="small" color="primary" /> : undefined} iconPosition="end" />
            <Tab label="Smart TVs" icon={createPreviewCounts.st > 0 ? <Chip label={createPreviewCounts.st} size="small" color="primary" /> : undefined} iconPosition="end" />
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
                      <InputLabel {...selectLabelShrinkProps}>Plano</InputLabel>
                      <Select
                        sx={sxSelectChosenGreen(!!subscriberContractForm.plan_id)}
                        value={subscriberContractForm.plan_id || ''}
                        label="Plano"
                        onChange={(e) => {
                          const planId = e.target.value ? Number(e.target.value) : undefined;
                          setSubscriberContractForm(applyPlanToContractForm(subscriberContractForm, planId, availablePlansForContract));
                        }}
                      >
                        <MenuItem value="">Nenhum (contrato sem plano)</MenuItem>
                        {availablePlansForContract.map((p: any) => (
                          <MenuItem key={getPlanIdFromOption(p)} value={getPlanIdFromOption(p)}>
                            {getPlanOptionLabel(p)}
                          </MenuItem>
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
                        sx={sxSelectChosenGreen(true)}
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
                      onChange={(e) =>
                        setSubscriberContractForm(applyContractStartDate(subscriberContractForm, e.target.value))
                      }
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
                      value={
                        formatDateForInput(subscriberContractForm.end_date) ||
                        buildContractEndDateForStart(
                          formatDateForInput(subscriberContractForm.start_date) || getDefaultContractStartDate(),
                          subscriberContractForm.billing_interval
                        )
                      }
                      onChange={(e) =>
                        setSubscriberContractForm(applyContractEndDate(subscriberContractForm, e.target.value))
                      }
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      inputProps={{
                        min: getMinContractEndDate(
                          formatDateForInput(subscriberContractForm.start_date) || getDefaultContractStartDate(),
                          subscriberContractForm.billing_interval || 'month'
                        ),
                      }}
                      helperText={contractEndDateHelperText(
                        formatDateForInput(subscriberContractForm.start_date) || getDefaultContractStartDate(),
                        subscriberContractForm.billing_interval || 'month'
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Moeda"
                      value={subscriberContractForm.currency || 'BRL'}
                      onChange={(e) => setSubscriberContractForm({ ...subscriberContractForm, currency: e.target.value })}
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Intervalo de cobrança</InputLabel>
                      <Select
                        sx={sxSelectChosenGreen(!!subscriberContractForm.billing_interval)}
                        value={normalizeBillingInterval(subscriberContractForm.billing_interval || 'month')}
                        label="Intervalo de cobrança"
                        disabled={!subscriberContractForm.plan_id}
                        onChange={(e) =>
                          setSubscriberContractForm(
                            applyContractBillingInterval(
                              subscriberContractForm,
                              availablePlansForContract,
                              e.target.value
                            )
                          )
                        }
                      >
                        {getContractIntervalOptions(subscriberContractForm.plan_id, availablePlansForContract).map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Valor acordado"
                      type="number"
                      value={subscriberContractForm.total_amount ?? ''}
                      onChange={(e) =>
                        setSubscriberContractForm({
                          ...subscriberContractForm,
                          total_amount: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      size="small"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">{subscriberContractForm.currency || 'BRL'}</InputAdornment>
                        ),
                      }}
                      inputProps={{ min: 0, step: '0.01' }}
                      helperText={getSelectedPlanValueHelper(
                        subscriberContractForm.plan_id,
                        availablePlansForContract,
                        subscriberContractForm.billing_interval
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Status</InputLabel>
                      <Select
                        sx={sxSelectChosenGreen(true)}
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
                        const dateErrCreate = validateSubscriberContractForm(
                          subscriberContractForm,
                          availablePlansForContract
                        );
                        if (dateErrCreate) {
                          setError(dateErrCreate);
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
                          end_date: buildContractEndDateForStart(getDefaultContractStartDate()),
                          currency: 'BRL',
                          total_amount: undefined,
                          status: 'draft',
                          plan_id: undefined,
                          billing_interval: 'month',
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
                            end_date: buildContractEndDateForStart(getDefaultContractStartDate()),
                            currency: 'BRL',
                            total_amount: undefined,
                            status: 'draft',
                            plan_id: undefined,
                            billing_interval: 'month',
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
                            {contract.total_amount != null &&
                              ` | Valor: ${formatCurrencyAmount(contract.total_amount, contract.currency || 'BRL')}`}
                            {((contract as any).billing_interval || contract.payment_terms) &&
                              ` | ${billingIntervalLabel((contract as any).billing_interval || contract.payment_terms)}`}
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
                                  end_date: buildContractEndDateForStart(getDefaultContractStartDate()),
                                  currency: 'BRL',
                                  total_amount: undefined,
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

          {createTab === 2 && (
            <PlanTopologyTabPanel
              mode="locals"
              preview={createContractPlanPreview}
              variant="create"
              contractCount={tempSubscriberContracts.length}
            />
          )}

          {/* Aba Totens — somente leitura (rede do plano); ver também aba Locais */}
          {createTab === 3 && (
            <PlanTopologyTabPanel
              mode="totens"
              preview={createContractPlanPreview}
              variant="create"
              contractCount={tempSubscriberContracts.length}
            />
          )}

          {/* Aba Smart TVs — somente leitura */}
          {createTab === 4 && (
            <PlanTopologyTabPanel
              mode="smartTvs"
              preview={createContractPlanPreview}
              variant="create"
              contractCount={tempSubscriberContracts.length}
            />
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
              end_date: buildContractEndDateForStart(getDefaultContractStartDate()),
              currency: 'BRL',
              total_amount: undefined,
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
          setEditSubscriberOverdueBillings([]);
          setEditSubscriberOverdueLoading(false);
          setEditSubscriberOverdueError(null);
          setEditContractTopologySubTab(0);
          setEditMedias([]);
          setEditPlaylists([]);
          setEditCampaigns([]);
          setEditingEditMediaIndex(null);
          setEditingEditPlaylistIndex(null);
          setEditSelectedContractId(null);
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>
          Editar Anunciante - {selectedSubscriber?.name || ''}
        </DialogTitle>
        <DialogContent>
          <Tabs
            value={editTab}
            onChange={(_, newValue) => setEditTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ mb: 3 }}
          >
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
              {editSubscriberOverdueError && (
                <Alert
                  severity="warning"
                  sx={{ mb: 2 }}
                  onClose={() => setEditSubscriberOverdueError(null)}
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      disabled={editSubscriberOverdueLoading}
                      onClick={async () => {
                        const sid = selectedSubscriber.subscriber_id;
                        setEditSubscriberOverdueError(null);
                        setEditSubscriberOverdueLoading(true);
                        try {
                          const { rows, error } = await fetchSubscriberOverdueBillings(sid);
                          setEditSubscriberOverdueBillings(rows);
                          setEditSubscriberOverdueError(error);
                        } finally {
                          setEditSubscriberOverdueLoading(false);
                        }
                      }}
                    >
                      Tentar novamente
                    </Button>
                  }
                >
                  {editSubscriberOverdueError}
                </Alert>
              )}
              {editSubscriberOverdueLoading && editSubscriberOverdueBillings.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress size={20} />
                    <Typography variant="body2">A carregar prestações em atraso…</Typography>
                  </Box>
                </Alert>
              )}
              {!editSubscriberOverdueLoading &&
                !editSubscriberOverdueError &&
                editSubscriberOverdueBillings.length === 0 && (
                  <Alert severity="success" variant="outlined" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      Sem prestações em atraso para este anunciante.
                    </Typography>
                  </Alert>
                )}
              {editSubscriberOverdueBillings.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {editSubscriberOverdueLoading && <LinearProgress sx={{ mb: 1 }} />}
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Prestações em atraso ({editSubscriberOverdueBillings.length})
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                    {editSubscriberOverdueBillings.map((b) => (
                      <li key={b.billing_id}>
                        <Typography variant="body2" component="span">
                          {b.description?.trim() || `Fatura #${b.billing_id}`}
                          {' — '}
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: (b.currency || 'BRL').toUpperCase(),
                          }).format(Number(b.amount))}
                          {b.due_date
                            ? ` — venc. ${formatDate(b.due_date)}`
                            : ''}
                          {typeof b.days_overdue === 'number' && b.days_overdue > 0
                            ? ` (${b.days_overdue} dia${b.days_overdue === 1 ? '' : 's'} em atraso)`
                            : ''}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    sx={{ mt: 1 }}
                    onClick={() => {
                      const sid = selectedSubscriber.subscriber_id;
                      const name = selectedSubscriber.name?.trim() || '';
                      const q = new URLSearchParams({
                        type: 'subscriber',
                        view: 'invoices',
                        subscriberId: String(sid),
                        dueFilter: 'overdue',
                      });
                      if (name) q.set('subscriberName', name);
                      navigate(`/billing?${q.toString()}`);
                    }}
                  >
                    Abrir faturamento
                  </Button>
                </Alert>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Contratos do Anunciante</Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() =>
                    navigate(`/subscribers/${selectedSubscriber.subscriber_id}/contracts/new`)
                  }
                >
                  Adicionar Contrato
                </Button>
              </Box>

              {Array.isArray(activeContracts) && activeContracts.length > 0 ? (
                <SubscriberContractList
                  contracts={activeContracts}
                  selectedContractId={editSelectedContractId}
                  onSelect={(contract) => setEditSelectedContractId(Number(contract.contract_id))}
                  onEdit={(contract) =>
                    navigate(
                      `/subscribers/${selectedSubscriber.subscriber_id}/contracts/${contract.contract_id}/edit`
                    )
                  }
                  onDelete={async (contract) => {
                    if (
                      !window.confirm(
                        `Tem certeza que deseja excluir o contrato "${contract.contract_number}"?`
                      )
                    ) {
                      return;
                    }
                    try {
                      await contractApi.delete(contract.contract_id);
                      await refreshSubscriberContracts(selectedSubscriber.subscriber_id);
                      const { rows, error } = await fetchSubscriberOverdueBillings(
                        selectedSubscriber.subscriber_id
                      );
                      setEditSubscriberOverdueBillings(rows);
                      setEditSubscriberOverdueError(error);
                      if (editSelectedContractId === contract.contract_id) {
                        setEditSelectedContractId(null);
                      }
                    } catch (error: any) {
                      setError(pickApiErrorMessage(error, 'Erro ao excluir contrato'));
                    }
                  }}
                />
              ) : (
                <Alert severity="info">
                  Nenhum contrato vinculado ao anunciante ainda.
                </Alert>
              )}

              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                Rede permitida pelo plano (somente leitura)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {editSelectedContract ? (
                  <>
                    Exibindo locais, totens e Smart TVs do contrato{' '}
                    <strong>
                      {editSelectedContract.contract_number} — {editSelectedContract.title}
                    </strong>
                    {editSelectedContract.plan_name
                      ? ` (plano: ${editSelectedContract.plan_name})`
                      : editSelectedContract.plan_id
                        ? ` (plano ID: ${editSelectedContract.plan_id})`
                        : ''}
                    . Selecione outro contrato na lista acima para ver a rede correspondente.
                  </>
                ) : (
                  <>Selecione um contrato na lista acima para ver a rede do plano associado.</>
                )}
              </Typography>
              <Tabs
                value={editContractTopologySubTab}
                onChange={(_, v) => setEditContractTopologySubTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
              >
                <Tab
                  label="Locais"
                  icon={editPreviewCounts.lc > 0 ? <Chip label={editPreviewCounts.lc} size="small" color="primary" /> : undefined}
                  iconPosition="end"
                />
                <Tab
                  label="Totens"
                  icon={editPreviewCounts.tt > 0 ? <Chip label={editPreviewCounts.tt} size="small" color="primary" /> : undefined}
                  iconPosition="end"
                />
                <Tab
                  label="Smart TVs"
                  icon={editPreviewCounts.st > 0 ? <Chip label={editPreviewCounts.st} size="small" color="primary" /> : undefined}
                  iconPosition="end"
                />
              </Tabs>
              {editContractTopologySubTab === 0 && (
                <PlanTopologyTabPanel
                  mode="locals"
                  preview={editSelectedContractTopologyPreview}
                  variant="edit"
                  contractCount={editSelectedContractId != null ? 1 : 0}
                  dense
                />
              )}
              {editContractTopologySubTab === 1 && (
                <PlanTopologyTabPanel
                  mode="totens"
                  preview={editSelectedContractTopologyPreview}
                  variant="edit"
                  contractCount={editSelectedContractId != null ? 1 : 0}
                  dense
                />
              )}
              {editContractTopologySubTab === 2 && (
                <PlanTopologyTabPanel
                  mode="smartTvs"
                  preview={editSelectedContractTopologyPreview}
                  variant="edit"
                  contractCount={editSelectedContractId != null ? 1 : 0}
                  dense
                />
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
                <Grid container spacing={3}>
                  {editMedias.map((media, index) => {
                    const apiThumbnail = media.media_id
                      ? `${process.env.REACT_APP_API_URL || '/api'}/media/${media.media_id}/thumbnail?v=${mediaThumbVersion}`
                      : null;
                    let previewUrl: string | null = apiThumbnail || media.thumbnailUrl || media.previewUrl || media.file_path || null;
                    if (previewUrl && previewUrl.startsWith('/opt/smart-signage/public/assets/')) {
                      previewUrl = previewUrl.replace('/opt/smart-signage/public/assets/', '/assets/');
                    }
                    if (previewUrl && (previewUrl.startsWith('/assets/uploads/') || previewUrl.includes('assets/uploads/'))) {
                      previewUrl = apiThumbnail;
                    }
                    const showPlaceholder = mediaPreviewFailed.has(media.media_id) || !previewUrl;
                    const isThumbnailUrl = previewUrl?.includes('/thumbnail');
                    const isTransformable = /^(image|video)$/i.test(String(media.media_type || ''));
                    const processingFit = processingMediaFitId === media.media_id;
                    const processingRotation = processingRotationId === media.media_id;

                    return (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={media.media_id}>
                        <Card sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: theme.shadows[8],
                          },
                        }}>
                          <Box
                            sx={mediaPortraitPreviewFrameSx()}
                            onMouseEnter={() => handleMediaPreviewMouseEnter(media)}
                            onMouseLeave={handleMediaPreviewMouseLeave}
                          >
                            {!showPlaceholder && previewUrl && (media.media_type === 'image' || isThumbnailUrl) ? (
                              <Box
                                component="img"
                                key={`${media.media_id}-${mediaThumbVersion}`}
                                src={previewUrl}
                                alt={media.name}
                                sx={mediaPortraitPreviewSx(getRotationDraft(media.media_id))}
                                onError={() => setMediaPreviewFailed(prev => new Set(prev).add(media.media_id))}
                              />
                            ) : !showPlaceholder && previewUrl && media.media_type === 'video' && !isThumbnailUrl ? (
                              <Box
                                component="video"
                                src={previewUrl}
                                sx={mediaPortraitPreviewSx(getRotationDraft(media.media_id))}
                                muted
                                onError={() => setMediaPreviewFailed(prev => new Set(prev).add(media.media_id))}
                                onMouseEnter={(e: any) => e.target.play?.()}
                                onMouseLeave={(e: any) => { e.target.pause?.(); e.target.currentTime = 0; }}
                              />
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                <Avatar sx={{ bgcolor: alpha(getMediaTypeColor(media.media_type), 0.1), color: getMediaTypeColor(media.media_type), width: 80, height: 80 }}>
                                  {getMediaIcon(media.media_type)}
                                </Avatar>
                              </Box>
                            )}
                            {/^video$/i.test(String(media.media_type || '')) &&
                              videoHover.id === media.media_id &&
                              videoHover.url && (
                                <Box
                                  component="video"
                                  ref={hoverVideoRef}
                                  src={videoHover.url}
                                  muted
                                  loop
                                  playsInline
                                  sx={{
                                    ...mediaPortraitPreviewSx(getRotationDraft(media.media_id)),
                                    zIndex: 2,
                                    pointerEvents: 'none',
                                  }}
                                />
                              )}
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                pointerEvents: 'none',
                                background: !showPlaceholder
                                  ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)'
                                  : 'transparent',
                                zIndex: 2,
                              }}
                            >
                              <Avatar
                                sx={{
                                  position: 'absolute',
                                  top: 16,
                                  left: 16,
                                  bgcolor: alpha(getMediaTypeColor(media.media_type), 0.85),
                                  color: 'white',
                                  width: 32,
                                  height: 32,
                                }}
                              >
                                {getMediaIcon(media.media_type)}
                              </Avatar>
                              <Chip
                                label={media.media_type?.toUpperCase() || 'MÍDIA'}
                                size="small"
                                sx={{
                                  position: 'absolute',
                                  top: 16,
                                  right: 16,
                                  bgcolor: alpha(getMediaTypeColor(media.media_type), 0.9),
                                  color: 'white',
                                  fontWeight: 'bold',
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 16,
                                  left: 16,
                                  right: 16,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'white',
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {formatFileSize(media.size_bytes ?? (media as any).fileSizeBytes)}
                                </Typography>
                                {media.duration_seconds && (
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'white',
                                      textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                                      fontWeight: 'bold',
                                    }}
                                  >
                                    {formatDuration(media.duration_seconds)}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                          <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                              {media.name}
                            </Typography>
                            {media.description && (
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
                                {media.description}
                              </Typography>
                            )}
                            <Box sx={{ mb: 1 }}>
                              <Chip
                                label={`Anunciante: ${selectedSubscriber.name}`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ fontSize: '0.7rem' }}
                              />
                            </Box>
                            <Box sx={{ mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={media.status || 'draft'}
                                size="small"
                                color={
                                  media.status === 'approved' ? 'success' :
                                  media.status === 'rejected' ? 'error' :
                                  media.status === 'pending_approval' ? 'warning' :
                                  'default'
                                }
                                variant="outlined"
                              />
                              {media.approvalStatus && (
                                <Chip
                                  label={`Aprovação: ${media.approvalStatus}`}
                                  size="small"
                                  color={media.approvalStatus === 'approved' ? 'success' : 'default'}
                                  variant="outlined"
                                />
                              )}
                            </Box>
                            {media.approvedByName && (
                              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                                Aprovado por: {media.approvedByName}
                                {media.approvedAt && ` em ${new Date(media.approvedAt).toLocaleDateString('pt-BR')}`}
                              </Typography>
                            )}
                            {Array.isArray(media.tags) && media.tags.length > 0 && (
                              <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {media.tags.slice(0, 3).map((tag, idx) => (
                                  <Chip key={idx} label={tag} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                                ))}
                                {media.tags.length > 3 && (
                                  <Chip label={`+${media.tags.length - 3}`} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                                )}
                              </Box>
                            )}
                            <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                <MediaTransformActions
                                  isTransformable={isTransformable}
                                  rotationDraft={getRotationDraft(media.media_id)}
                                  processingRotation={processingRotation}
                                  processingFit={processingFit}
                                  onRotatePreview={() => handleRotatePreview(media.media_id)}
                                  onConfirmRotation={async () => {
                                    const err = await handleConfirmRotation(media.media_id);
                                    if (err) setError(err);
                                  }}
                                  onFitPortrait={() => handleFitMediaToPortrait(media)}
                                />
                                <Tooltip title="Visualizar">
                                  <IconButton size="small" color="primary">
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Editar">
                                  <IconButton size="small" color="primary" onClick={() => handleStartEditMedia(index)}>
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Excluir">
                                  <IconButton size="small" color="error" onClick={() => handleDeleteMedia(index)}>
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                          </CardContent>
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
                subscriberLabel={selectedSubscriber.name}
                subscribers={selectedSubscriber ? [selectedSubscriber] : []}
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
                        sx={sxSelectChosenGreen(true)}
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
                          setEditPlaylistTotemLabels([]);
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
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setDefaultPlaylistItemDuration(0);
                            return;
                          }
                          const v = parseInt(raw, 10);
                          setDefaultPlaylistItemDuration(
                            Number.isFinite(v) ? Math.max(0, Math.min(300, v)) : 0
                          );
                        }}
                        size="small"
                        inputProps={{ min: 0, max: 300 }}
                        helperText="Aplica-se apenas a imagens. 0 vira 10 s ao adicionar. Vídeo e áudio usam sempre a duração do arquivo."
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
                      const m = item.media as any;
                      const mediaType: string | undefined = m?.media_type || m?.mediaType;
                      const isAutoDuration = isVideoOrAudioMediaType(mediaType);
                      const fileDurationSec = Math.max(0, Number(m?.duration_seconds) || 0);
                      const durationMs = item.duration ?? (isAutoDuration ? fileDurationSec * 1000 : 10000);
                      const durationSecEffective = isAutoDuration
                        ? fileDurationSec > 0
                          ? fileDurationSec
                          : Math.max(0, Math.round(durationMs / 1000))
                        : Math.max(1, Math.round(durationMs / 1000));
                      const storedSec =
                        item.display_seconds !== undefined && item.display_seconds !== null
                          ? item.display_seconds
                          : durationSecEffective;
                      const isEditing = editingItemDuration === item.item_id;
                      const tempDuration = tempItemDuration[item.item_id] ?? storedSec;
                      const isDragging = draggedItemIndex === index;
                      const mediaName =
                        m?.name || (item as any).mediaName || (item as any).media_name || `Mídia ${item.media_id}`;
                      const thumbFromApi = m?.thumbnail_url || m?.thumbnailUrl;
                      const previewFromApi = m?.preview_url || m?.previewUrl;
                      const apiThumbnail = item.media_id
                        ? `${process.env.REACT_APP_API_URL || '/api'}/media/${item.media_id}/thumbnail`
                        : null;
                      let thumbUrl: string | null =
                        thumbFromApi || previewFromApi || apiThumbnail || null;
                      if (thumbUrl && thumbUrl.startsWith('/opt/smart-signage/public/assets/')) {
                        thumbUrl = thumbUrl.replace('/opt/smart-signage/public/assets/', '/assets/');
                      }
                      if (
                        thumbUrl &&
                        (thumbUrl.startsWith('/assets/uploads/') || thumbUrl.includes('assets/uploads/'))
                      ) {
                        thumbUrl = apiThumbnail;
                      }
                      const isThumbUrl = thumbUrl?.includes('/thumbnail');
                      const showThumb =
                        !!thumbUrl &&
                        !mediaPreviewFailed.has(item.media_id) &&
                        (mediaType === 'image' || mediaType === 'video' || isThumbUrl);

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
                              setError(`Erro ao reordenar itens: ${pickApiErrorMessage(error, 'Erro desconhecido')}`);
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
                          <Avatar
                            variant="rounded"
                            src={showThumb && thumbUrl ? thumbUrl : undefined}
                            imgProps={{
                              onError: () =>
                                setMediaPreviewFailed((prev) => new Set(prev).add(item.media_id)),
                            }}
                            sx={{
                              width: 48,
                              height: 48,
                              mr: 1.5,
                              flexShrink: 0,
                              bgcolor: alpha(getMediaTypeColor(mediaType), 0.12),
                              color: getMediaTypeColor(mediaType),
                            }}
                          >
                            {getMediaIcon(mediaType)}
                          </Avatar>
                          <ListItemText
                            primaryTypographyProps={{ component: 'div' }}
                            primary={
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600} noWrap title={mediaName}>
                                  {mediaName}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ display: 'block', mt: 0.25 }}
                                >
                                  {editPlaylistTotemLabels.length > 0
                                    ? `Totens: ${editPlaylistTotemLabels.join(', ')}`
                                    : 'Totens: nenhuma campanha expõe esta playlist em totens ainda'}
                                </Typography>
                              </Box>
                            }
                            sx={{ flex: 1, mr: 1 }}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
                            {isEditing ? (
                              <>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={tempDuration}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    if (raw === '') {
                                      setTempItemDuration({ ...tempItemDuration, [item.item_id]: 0 });
                                      return;
                                    }
                                    const v = parseInt(raw, 10);
                                    setTempItemDuration({
                                      ...tempItemDuration,
                                      [item.item_id]: Number.isFinite(v)
                                        ? Math.max(0, Math.min(300, v))
                                        : 0,
                                    });
                                  }}
                                  inputProps={{ min: 0, max: 300 }}
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
                                        tempDuration === 0 ? 0 : tempDuration * 1000
                                      );
                                      await handleStartEditPlaylist(editingEditPlaylistIndex!);
                                      setEditingItemDuration(null);
                                      setTempItemDuration({});
                                    } catch (error: any) {
                                      setError(`Erro ao atualizar duração: ${pickApiErrorMessage(error, 'Erro desconhecido')}`);
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
                                <Typography variant="body2" color="text.secondary" title="Duração efetiva de exibição">
                                  {isAutoDuration
                                    ? fileDurationSec > 0
                                      ? `auto (${formatDuration(fileDurationSec)})`
                                      : 'auto (duração do arquivo)'
                                    : `${durationSecEffective}s`}
                                </Typography>
                                {!isAutoDuration && (
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setEditingItemDuration(item.item_id);
                                      setTempItemDuration({ ...tempItemDuration, [item.item_id]: storedSec });
                                    }}
                                    title="Editar duração"
                                  >
                                    <Edit fontSize="small" />
                                  </IconButton>
                                )}
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
                              setError(`Erro ao remover item: ${pickApiErrorMessage(error, 'Erro desconhecido')}`);
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
              {isOperadorComercial && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Perfil comercial: pode consultar as campanhas deste anunciante. A criação e alteração de campanhas é feita por marketing ou administração.
                </Alert>
              )}
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              {!isOperadorComercial && (
              <Box sx={{ mb: 3 }}>
                <Button
                  type="button"
                  variant="contained"
                  startIcon={<Add />}
                  onClick={async () => {
                    if (selectedSubscriber) {
                      await refreshSubscriberContracts(selectedSubscriber.subscriber_id);
                    }
                    setCampaignFullEditorId(null);
                    setCampaignFullEditorOpen(true);
                  }}
                >
                  Adicionar Campanha
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Ao escolher o contrato, a rede permitida e os totens elegíveis serão apresentados para seleção
                  (mesmo fluxo do editor completo de campanha).
                </Typography>
                {contractsActiveForCampaign.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Você precisa ter um contrato ativo para executar campanhas nos totens. Crie ou ative um contrato na
                    aba &quot;Contratos&quot;.
                  </Alert>
                )}
              </Box>
              )}

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
                      {!isOperadorComercial && (
                        <>
                          <IconButton size="small" onClick={() => handleStartEditCampaign(index)}>
                            <Edit />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteCampaign(index)}>
                            <Delete />
                          </IconButton>
                        </>
                      )}
                    </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {isOperadorComercial
                    ? 'Nenhuma campanha cadastrada para este anunciante.'
                    : 'Nenhuma campanha cadastrada ainda. Crie uma campanha para organizar suas mídias e playlists.'}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setEditTab(0);
            setEditContractTopologySubTab(0);
            setEditMedias([]);
            setEditPlaylists([]);
            setEditCampaigns([]);
            setEditingEditMediaIndex(null);
            setEditingEditPlaylistIndex(null);
            setEditMediaForm({ name: '', description: '', tags: [] });
            setEditPlaylistForm({ name: '', description: '', isActive: true });
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

      <CampaignFullEditorDialog
        open={campaignFullEditorOpen}
        campaignId={campaignFullEditorId}
        subscriberId={selectedSubscriber?.subscriber_id}
        prefetchedContracts={activeContracts ?? []}
        onGoToSubscriberContracts={() => {
          setCampaignFullEditorOpen(false);
          setEditTab(1);
        }}
        onClose={() => {
          setCampaignFullEditorOpen(false);
          setCampaignFullEditorId(null);
        }}
        onSaved={async () => {
          if (selectedSubscriber) {
            await loadSubscriberDataForEdit(selectedSubscriber.subscriber_id);
          }
        }}
      />
      <MediaDeleteConflictDialog
        open={mediaDeleteConflictOpen}
        conflict={mediaDeleteConflict}
        mediaLabel={
          pendingMediaDeleteIndex != null ? editMedias[pendingMediaDeleteIndex]?.name : mediaDeleteConflict?.mediaName
        }
        loading={mediaDeleteLoading}
        onClose={() => {
          if (mediaDeleteLoading) return;
          setMediaDeleteConflictOpen(false);
          setMediaDeleteConflict(null);
          setPendingMediaDeleteIndex(null);
        }}
        onConfirmForceDelete={handleForceDeleteMedia}
      />
    </Box>
  );
};

export default Subscribers;




