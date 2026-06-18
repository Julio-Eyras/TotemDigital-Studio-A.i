/**
 * Editor completo de campanha (mesmo fluxo de abas que o menu global tinha),
 * para uso a partir de Anunciantes — o menu Campanhas global fica só leitura.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  Autocomplete,
  FormControlLabel,
  Switch,
  Alert,
  LinearProgress,
  Typography,
  Chip,
  Paper,
  useTheme,
  alpha,
  ListSubheader,
} from '@mui/material';
import {
  campaignApi,
  Campaign,
  Contract,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  playlistApi,
  PlaylistItem,
  mediaApi,
  MediaItem,
  publisherApi,
  Publisher,
  subscriberAccessApi,
  AccessiblePublisher,
  subscriberApi,
  dashboardApi,
  DashboardUiContext,
} from '../../services/api';
import { useAppSelector } from '../../store/hooks';
import { isStudioMode } from '../../config/studioMode';
import {DISABLE_DIRECT_CAMPAIGN_TOTEM} from '../../config/featureFlags';
import { DIRECT_CAMPAIGN_TOTEM_DISABLED_HINT_PT } from '../../constants/campaignUiMessages';
import { SortableList } from '../../components/SortableList/SortableList';
import {
  campaignTotemOptionLabel,
  compareByDisplayName,
  normalizeCampaignType,
} from './campaignHelpers';
import { getTotemIdFromRow } from '../../utils/totemRowIds';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { getProductTerminology } from '../../config/productTerminology';
import { isSubscriberContractActiveForCampaign } from '../Subscribers/subscriberContractHealth';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';
import {
  CAMPAIGN_START_DATE_MIN_HELPER,
  clampCampaignStartYmd,
  getCampaignEndYmdForDisplay,
  getCampaignStartYmdForDisplay,
  getMinCampaignStartYmd,
  getTodayYmd,
  resolveCampaignStartYmdForSave,
} from '../../utils/campaignStartDate';
import { formatDateForApi } from '../../utils/businessDate';
import { PlanTopologyTabPanel } from '../Subscribers/PlanTopologyTabPanel';
import { countTopologyInRows } from '../Subscribers/planTopologyPreview';
import { buildContractEligibleTopologyRow } from './campaignContractTopology';

export interface CampaignFullEditorDialogProps {
  open: boolean;
  campaignId: number | null;
  onClose: () => void;
  onSaved?: () => void;
  /** Anunciante em contexto (ex.: tela Anunciantes) — carrega contratos antes do GET da campanha */
  subscriberId?: number | null;
  /** Contratos já carregados no pai (todos exceto cancelados) — evita combo vazio por timing de rede */
  prefetchedContracts?: Contract[] | null;
  /** Abre a aba Contratos no modal do anunciante (quando o utilizador precisa ativar um contrato). */
  onGoToSubscriberContracts?: () => void;
}

const CampaignFullEditorDialog: React.FC<CampaignFullEditorDialogProps> = ({
  open,
  campaignId,
  onClose,
  onSaved,
  subscriberId: subscriberIdProp,
  prefetchedContracts,
  onGoToSubscriberContracts,
}) => {
  const theme = useTheme();
  const user = useAppSelector((state) => state.auth.user);
  const isAdmin =
    user?.role === 'admin' ||
    user?.role === 'admin_sql' ||
    user?.role === 'owner_system';
  const userSubscriberId = user?.subscriberId;

  const compactMode = isStudioMode();
  const orgTerms = getProductTerminology();
  const orgLabel = (id: number, name?: string) => name || `${orgTerms.organization} #${id}`;
  const tabTotems = compactMode ? 1 : 2;
  const tabSmartTvs = 3;
  const tabMedias = compactMode ? 2 : 4;
  const tabPlaylists = compactMode ? 3 : 5;
  const tabSchedule = compactMode ? 4 : 6;

  const [editTab, setEditTab] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [orderedMediaIds, setOrderedMediaIds] = useState<number[]>([]);
  const [orderedPlaylistIds, setOrderedPlaylistIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [saving, setSaving] = useState(false);
  const isCreateMode = campaignId == null;

  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [accessiblePublishers, setAccessiblePublishers] = useState<AccessiblePublisher[]>([]);

  const [derivedTotems, setDerivedTotems] = useState<any[]>([]);
  const [derivedSmartTvs, setDerivedSmartTvs] = useState<any[]>([]);
  const [derivedDevicesLoading, setDerivedDevicesLoading] = useState(false);
  const [subscriberContracts, setSubscriberContracts] = useState<Contract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractTopoSubTab, setContractTopoSubTab] = useState(0);
  const [serverUi, setServerUi] = useState<DashboardUiContext | null>(null);
  /** Evita reaplicar “todos selecionados” após o utilizador alterar manualmente. */
  const autoTotemSelectionContractRef = useRef<number | null>(null);

  const resolvedSubscriberId = useMemo(() => {
    const fromCampaign =
      selectedCampaign?.subscriber_id ?? (selectedCampaign as any)?.subscriberId;
    if (fromCampaign != null && Number.isFinite(Number(fromCampaign))) return Number(fromCampaign);
    if (subscriberIdProp != null && Number.isFinite(Number(subscriberIdProp))) return Number(subscriberIdProp);
    return undefined;
  }, [selectedCampaign, subscriberIdProp]);

  const allContractsForSubscriber = useMemo(() => {
    const seen = new Set<number>();
    const out: Contract[] = [];
    for (const c of [...(prefetchedContracts || []), ...subscriberContracts]) {
      const id = Number(c.contract_id);
      if (!Number.isFinite(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(c);
    }
    return out;
  }, [prefetchedContracts, subscriberContracts]);

  const contractsForPicker = useMemo(
    () => allContractsForSubscriber.filter((c) => isSubscriberContractActiveForCampaign(c)),
    [allContractsForSubscriber]
  );

  const contractsInactiveForPicker = useMemo(
    () => allContractsForSubscriber.filter((c) => !isSubscriberContractActiveForCampaign(c)),
    [allContractsForSubscriber]
  );

  const contractStatusHint = (c: Contract): string => {
    const status = String(c.status || '').toLowerCase();
    if (status === 'draft') return 'Rascunho';
    if (status === 'expired') return 'Expirado';
    if (status === 'terminated') return 'Terminado';
    if (status === 'cancelled') return 'Cancelado';
    if (status === 'active') return 'Fora da vigência';
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Indisponível';
  };

  const selectedContractId = useMemo(() => {
    const raw =
      (selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId;
    if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
    const n = Number(raw);
    return Number.isNaN(n) ? undefined : n;
  }, [selectedCampaign]);

  const selectedContractRow = useMemo(() => {
    if (selectedContractId == null) return undefined;
    return allContractsForSubscriber.find((c) => Number(c.contract_id) === selectedContractId);
  }, [selectedContractId, allContractsForSubscriber]);

  const contractTopologyRow = useMemo(() => {
    if (!selectedContractRow) return null;
    return buildContractEligibleTopologyRow(
      {
        contract_id: selectedContractRow.contract_id,
        contract_number: selectedContractRow.contract_number,
        title: selectedContractRow.title,
        plan_id: selectedContractRow.plan_id,
        plan_name: (selectedContractRow as any).plan_name ?? (selectedContractRow as any).planName,
      },
      derivedTotems
    );
  }, [selectedContractRow, derivedTotems]);

  const contractTopologyCounts = useMemo(
    () => (contractTopologyRow ? countTopologyInRows([contractTopologyRow]) : { lc: 0, tt: 0, st: 0 }),
    [contractTopologyRow]
  );

  useEffect(() => {
    if (!open) {
      setServerUi(null);
      return;
    }
    void dashboardApi.getUiContext().then(setServerUi).catch(() => setServerUi(null));
  }, [open]);

  const directTotemDisabled =
    serverUi?.disableDirectCampaignTotem ?? DISABLE_DIRECT_CAMPAIGN_TOTEM;
  const directTotemHint =
    serverUi?.directCampaignTotemHint || DIRECT_CAMPAIGN_TOTEM_DISABLED_HINT_PT;

  const getSelectedPublisherIds = (): number[] => {
    if (!selectedCampaign) return [];
    return (((selectedCampaign as any).publisherIds || []) as number[]).filter((x) => typeof x === 'number');
  };

  const getSelectedTotemIds = (): number[] => {
    if (!selectedCampaign) return [];
    const raw = ((selectedCampaign as any).totemIds || []) as unknown[];
    return raw.map((x) => Number(x)).filter((n) => !Number.isNaN(n) && n > 0);
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

      const allTotems = results.flatMap((r) => r.totems || []);
      const allTvs = results.flatMap((r) => r.tvs || []);

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
      setDerivedTotems([]);
      setDerivedSmartTvs([]);
    } finally {
      setDerivedDevicesLoading(false);
    }
  };

  const loadCompactTotemOptions = async () => {
    try {
      setDerivedDevicesLoading(true);
      const subId = selectedCampaign?.subscriber_id ?? (selectedCampaign as any)?.subscriberId;
      const contractRaw =
        (selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId;
      const contractId =
        contractRaw !== undefined && contractRaw !== null && String(contractRaw).trim() !== ''
          ? Number(contractRaw)
          : undefined;
      if (!subId) {
        setDerivedTotems([]);
        setDerivedSmartTvs([]);
        return;
      }
      if (contractId === undefined || Number.isNaN(contractId)) {
        setDerivedTotems([]);
        setDerivedSmartTvs([]);
        return;
      }
      const totems = await subscriberApi.getTotems(Number(subId), { contractId });
      setDerivedTotems(Array.isArray(totems) ? totems : []);
      setDerivedSmartTvs([]);
    } catch (e) {
      setDerivedTotems([]);
    } finally {
      setDerivedDevicesLoading(false);
    }
  };

  const loadAccessiblePublishers = async (subscriberId: number) => {
    try {
      const accessible = await subscriberAccessApi.getAccessiblePublishers(subscriberId);
      accessible.sort((a: any, b: any) =>
        compareByDisplayName(a?.name || a?.publisher_name, b?.name || b?.publisher_name)
      );
      setAccessiblePublishers(accessible);
    } catch {
      /* publishers opcionais */
    }
  };

  const loadPlaylists = async (subscriberIdOverride?: number) => {
    try {
      const subscriberId =
        subscriberIdOverride ??
        selectedCampaign?.subscriber_id ??
        (selectedCampaign as any)?.subscriberId ??
        (!isAdmin && userSubscriberId ? userSubscriberId : undefined);
      const response = await playlistApi.getAll({ subscriberId });
      const playlistsData = Array.isArray(response.data) ? [...response.data] : [];
      playlistsData.sort((a: any, b: any) =>
        compareByDisplayName(a?.name || a?.title, b?.name || b?.title)
      );
      setPlaylists(playlistsData);
    } catch {
      /* opcional na edição */
    }
  };

  const loadMediaItems = async (subscriberIdOverride?: number) => {
    try {
      const subscriberId =
        subscriberIdOverride ??
        selectedCampaign?.subscriber_id ??
        (selectedCampaign as any)?.subscriberId ??
        (!isAdmin && userSubscriberId ? userSubscriberId : undefined);
      const response = await mediaApi.getAll(
        subscriberId != null ? { subscriberId } : { subscriberId: undefined }
      );
      const mediaData = Array.isArray(response?.data) ? [...response.data] : [];
      mediaData.sort((a: any, b: any) =>
        compareByDisplayName(a?.name || a?.title || a?.file_name, b?.name || b?.title || b?.file_name)
      );
      setMediaItems(mediaData);
    } catch {
      /* opcional na edição */
    }
  };

  const loadPublishers = async () => {
    try {
      const response = await publisherApi.getAll({ active_only: true });
      const publishersData = Array.isArray(response.data) ? [...response.data] : [];
      publishersData.sort((a: any, b: any) => compareByDisplayName(a?.name, b?.name));
      setPublishers(publishersData);
    } catch {
      /* opcional na edição */
    }
  };

  useEffect(() => {
    if (!open) return;
    loadPlaylists();
    loadMediaItems();
    if (!compactMode) {
      loadPublishers();
      if (userSubscriberId) loadAccessiblePublishers(userSubscriberId);
    }
  }, [open, compactMode, userSubscriberId]);

  useEffect(() => {
    if (!open) return;
    autoTotemSelectionContractRef.current = null;
  }, [open, campaignId]);

  useEffect(() => {
    if (!open || !campaignId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingCampaign(true);
        setError(null);
        const full = await campaignApi.getById(campaignId);
        if (cancelled) return;
        setSelectedCampaign({
          ...full,
          start_date: getCampaignStartYmdForDisplay(full) || undefined,
          end_date: getCampaignEndYmdForDisplay(full) || undefined,
        });
        const subscriberId = full.subscriber_id || (full as any).subscriberId;
        if (subscriberId != null && Number.isFinite(Number(subscriberId))) {
          await Promise.all([loadMediaItems(Number(subscriberId)), loadPlaylists(Number(subscriberId))]);
        }
        if (!compactMode && subscriberId && !isAdmin) {
          await loadAccessiblePublishers(subscriberId);
        }
        setEditTab(0);
      } catch (e) {
        if (!cancelled) setError('Não foi possível carregar a campanha.');
      } finally {
        if (!cancelled) setLoadingCampaign(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, campaignId, compactMode, isAdmin]);

  useEffect(() => {
    if (!open || !isCreateMode) return;
    const sid = resolvedSubscriberId;
    if (!sid) {
      setSelectedCampaign(null);
      setError('Anunciante não definido para criar campanha.');
      return;
    }
    setError(null);
    setLoadingCampaign(false);
    setSelectedCampaign({
      title: '',
      description: '',
      campaign_type: 'general',
      status: 'draft',
      is_active: true,
      subscriber_id: sid,
      contract_id: undefined,
      contractId: undefined,
      totemIds: [],
      mediaIds: [],
      playlistIds: [],
      start_date: getTodayYmd(),
      commercial_tier: 'standard',
      default_time_share_percent: 0,
      max_consecutive_slots: 2,
    } as unknown as Campaign);
    setOrderedMediaIds([]);
    setOrderedPlaylistIds([]);
    setEditTab(0);
    setContractTopoSubTab(0);
    void loadPlaylists(sid);
    void loadMediaItems(sid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isCreateMode, resolvedSubscriberId]);

  useEffect(() => {
    if (!open) {
      setSubscriberContracts([]);
      setContractsLoading(false);
      return;
    }
    if (!compactMode) return;
    const sid = resolvedSubscriberId;
    if (!sid) {
      setSubscriberContracts([]);
      return;
    }
    let cancelled = false;
    setContractsLoading(true);
    subscriberApi
      .getContracts(sid, { activeOnly: false })
      .then((rows) => {
        if (!cancelled) setSubscriberContracts(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setSubscriberContracts([]);
      })
      .finally(() => {
        if (!cancelled) setContractsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, compactMode, resolvedSubscriberId]);

  useEffect(() => {
    if (!open) {
      setOrderedMediaIds([]);
      setOrderedPlaylistIds([]);
      setDerivedTotems([]);
      setDerivedSmartTvs([]);
      setSelectedCampaign(null);
      setError(null);
      setContractTopoSubTab(0);
      autoTotemSelectionContractRef.current = null;
      return;
    }
    if (selectedCampaign) {
      setOrderedMediaIds(selectedCampaign.mediaIds || []);
      setOrderedPlaylistIds(selectedCampaign.playlistIds || []);
    }
  }, [open, campaignId, selectedCampaign?.campaign_id]);

  useEffect(() => {
    if (!open) return;
    if (compactMode) {
      if (selectedCampaign) void loadCompactTotemOptions();
      return;
    }
    if (editTab === 2 || editTab === 3) loadDerivedDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editTab,
    open,
    compactMode,
    selectedCampaign?.campaign_id,
    selectedCampaign?.subscriber_id,
    (selectedCampaign as any)?.contract_id,
    (selectedCampaign as any)?.contractId,
  ]);

  /** Opções do combo + placeholders para totens já na campanha mas ainda fora da lista (API/tipos). */
  const totemAutocompleteOptions = useMemo(() => {
    const selectedIds = (((selectedCampaign as any)?.totemIds || []) as unknown[])
      .map((x) => Number(x))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const out: any[] = [];
    const seen = new Set<number>();
    for (const t of derivedTotems) {
      const id = getTotemIdFromRow(t);
      if (id === undefined || seen.has(id)) continue;
      seen.add(id);
      out.push(t);
    }
    for (const id of selectedIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        totem_id: id,
        name: `Totem #${id}`,
        identifier: '',
        local_name: 'Fora da lista atual do contrato (rever plano/locais ou aguarde o carregamento)',
        __orphan: true,
      });
    }
    return out;
  }, [derivedTotems, selectedCampaign?.campaign_id, (selectedCampaign as any)?.totemIds]);

  const eligibleTotemIds = useMemo(
    () =>
      derivedTotems
        .map((t) => getTotemIdFromRow(t))
        .filter((id): id is number => id !== undefined && id > 0),
    [derivedTotems]
  );

  const allTotemsSelected =
    eligibleTotemIds.length > 0 &&
    eligibleTotemIds.every((id) => getSelectedTotemIds().includes(id));

  /** Sem totens definidos ainda: selecionar todos os elegíveis do contrato (padrão). */
  useEffect(() => {
    if (!open || !compactMode || !selectedCampaign || derivedDevicesLoading) return;
    const contractRaw =
      (selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId;
    if (
      contractRaw === undefined ||
      contractRaw === null ||
      String(contractRaw).trim() === '' ||
      Number.isNaN(Number(contractRaw))
    ) {
      autoTotemSelectionContractRef.current = null;
      return;
    }
    const contractId = Number(contractRaw);
    if (eligibleTotemIds.length === 0) return;

    const currentIds = getSelectedTotemIds();
    if (currentIds.length > 0) {
      autoTotemSelectionContractRef.current = contractId;
      return;
    }
    if (autoTotemSelectionContractRef.current === contractId) return;

    autoTotemSelectionContractRef.current = contractId;
    setSelectedCampaign((prev) =>
      prev ? ({ ...prev, totemIds: [...eligibleTotemIds] } as any) : prev
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    compactMode,
    selectedCampaign?.campaign_id,
    (selectedCampaign as any)?.contract_id,
    (selectedCampaign as any)?.contractId,
    eligibleTotemIds,
    derivedDevicesLoading,
  ]);

  /** Compacto: remove só totens que deixaram de ser elegíveis quando já temos lista elegível (>0).
   * Se a lista vier vazia (sem contrato, API sem linhas, erro de rede), não apagar seleção no estado. */
  useEffect(() => {
    if (!open || !compactMode || !selectedCampaign || derivedDevicesLoading) return;
    const contractRaw =
      (selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId;
    if (
      contractRaw === undefined ||
      contractRaw === null ||
      String(contractRaw).trim() === '' ||
      Number.isNaN(Number(contractRaw))
    ) {
      return;
    }
    if (derivedTotems.length === 0) return;
    const raw = ((selectedCampaign as any).totemIds || []) as number[];
    const ids = raw.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
    if (ids.length === 0) return;
    const allowed = new Set(
      derivedTotems
        .map((t) => getTotemIdFromRow(t))
        .filter((id): id is number => id !== undefined)
    );
    const pruned = ids.filter((id) => allowed.has(id));
    if (pruned.length === ids.length) return;
    setSelectedCampaign((prev) => (prev ? ({ ...prev, totemIds: pruned } as any) : prev));
  }, [
    open,
    compactMode,
    selectedCampaign?.campaign_id,
    (selectedCampaign as any)?.contract_id,
    (selectedCampaign as any)?.contractId,
    derivedTotems,
    derivedDevicesLoading,
  ]);

  const handleReorderMedias = async (newOrder: number[]) => {
    if (!selectedCampaign) return;
    try {
      await campaignApi.reorderMedias(selectedCampaign.campaign_id, newOrder);
      setOrderedMediaIds(newOrder);
      const updated = await campaignApi.getById(selectedCampaign.campaign_id);
      setSelectedCampaign(updated);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao reordenar mídias'));
    }
  };

  const handleReorderPlaylists = async (newOrder: number[]) => {
    if (!selectedCampaign) return;
    try {
      await campaignApi.reorderPlaylists(selectedCampaign.campaign_id, newOrder);
      setOrderedPlaylistIds(newOrder);
      const updated = await campaignApi.getById(selectedCampaign.campaign_id);
      setSelectedCampaign(updated);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao reordenar playlists'));
    }
  };

  const handleSaveCampaign = async () => {
    if (!selectedCampaign) return;
    if (!selectedCampaign.title?.trim()) {
      setError('Título da campanha é obrigatório');
      setEditTab(0);
      return;
    }

    const totemIds = getSelectedTotemIds();
    const contractRaw =
      (selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId;
    const hasContract =
      contractRaw !== undefined &&
      contractRaw !== null &&
      String(contractRaw).trim() !== '' &&
      !Number.isNaN(Number(contractRaw));

    if (compactMode && hasContract && totemIds.length === 0) {
      setError('Selecione pelo menos um totem na aba Totens (rede permitida pelo contrato).');
      setEditTab(tabTotems);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const basePayload = {
        title: selectedCampaign.title.trim(),
        categorySegment:
          (selectedCampaign as any).categorySegment || (selectedCampaign as any).category_segment,
        description: selectedCampaign.description,
        campaign_type: normalizeCampaignType(
          selectedCampaign.campaign_type || (selectedCampaign as any).campaignType
        ),
        status: selectedCampaign.status || 'draft',
        subscriberId: selectedCampaign.subscriber_id || (selectedCampaign as any).subscriberId,
        start_date: formatDateForApi(resolveCampaignStartYmdForSave(selectedCampaign)),
        end_date: (() => {
          const endYmd = getCampaignEndYmdForDisplay(selectedCampaign);
          return endYmd ? formatDateForApi(endYmd) : undefined;
        })(),
        isActive:
          selectedCampaign.is_active !== undefined
            ? selectedCampaign.is_active
            : (selectedCampaign as any).isActive !== undefined
              ? (selectedCampaign as any).isActive
              : true,
        playlistIds:
          orderedPlaylistIds.length > 0 ? orderedPlaylistIds : selectedCampaign.playlistIds || [],
        mediaIds: orderedMediaIds.length > 0 ? orderedMediaIds : selectedCampaign.mediaIds || [],
        totemIds,
        commercial_tier: (selectedCampaign as any).commercial_tier || 'standard',
        default_time_share_percent: (selectedCampaign as any).default_time_share_percent ?? 0,
        max_consecutive_slots: (selectedCampaign as any).max_consecutive_slots ?? 2,
      };

      if (isCreateMode) {
        const sid = resolvedSubscriberId;
        if (!sid) {
          throw new Error('Anunciante não definido para criar campanha.');
        }
        try {
          const validation = await subscriberApi.validatePlanLimits(sid, 'campaign');
          if (!validation.valid) {
            setError(validation.message || 'Limite de campanhas do plano excedido');
            return;
          }
        } catch {
          /* validação prévia opcional */
        }

        const createData: CreateCampaignRequest = {
          ...basePayload,
          subscriberId: sid,
          contractId: hasContract ? Number(contractRaw) : undefined,
          priority: (selectedCampaign as any).priority ?? 1,
        };
        await campaignApi.create(createData);
      } else {
        const updateData: UpdateCampaignRequest = { ...basePayload } as any;
        if (!compactMode) {
          (updateData as any).publisherIds = (((selectedCampaign as any).publisherIds || []) as number[]);
        }
        if (compactMode) {
          (updateData as any).contractId = hasContract ? Number(contractRaw) : null;
        }
        const cid =
          selectedCampaign.campaign_id ??
          (selectedCampaign as any).id ??
          (selectedCampaign as any).campaignId;
        if (!cid || Number.isNaN(Number(cid))) {
          throw new Error('ID da campanha inválido ao salvar.');
        }
        await campaignApi.update(Number(cid), updateData);
      }

      onSaved?.();
      onClose();
    } catch (error: any) {
      setError(
        pickApiErrorMessage(error, isCreateMode ? 'Erro ao criar campanha' : 'Erro ao atualizar campanha')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{isCreateMode ? 'Adicionar Campanha' : 'Editar Campanha'}</DialogTitle>
      <DialogContent>
        {loadingCampaign && <LinearProgress sx={{ mb: 2 }} />}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {isCreateMode && !resolvedSubscriberId && !loadingCampaign && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Anunciante não definido. Feche e abra novamente a partir da edição do anunciante.
          </Alert>
        )}
        {directTotemDisabled && (
          <Alert severity="warning" sx={{ mb: 2 }} variant="outlined">
            <Typography variant="body2">{directTotemHint}</Typography>
          </Alert>
        )}
        {!loadingCampaign && selectedCampaign && (
          <>
            <Stepper activeStep={editTab} alternativeLabel sx={{ mb: 2, display: { xs: 'none', md: 'flex' } }}>
              {compactMode ? (
                <>
                  <Step key="p"><StepLabel>Principal</StepLabel></Step>
                  <Step key="t"><StepLabel>Totens</StepLabel></Step>
                  <Step key="m"><StepLabel>Mídias</StepLabel></Step>
                  <Step key="pl"><StepLabel>Playlists</StepLabel></Step>
                  <Step key="s"><StepLabel>Agendamento</StepLabel></Step>
                </>
              ) : (
                <>
                  <Step key="p"><StepLabel>Principal</StepLabel></Step>
                  <Step key="pub"><StepLabel>{orgTerms.campaignOrganizationsTab}</StepLabel></Step>
                  <Step key="t"><StepLabel>Totens</StepLabel></Step>
                  <Step key="tv"><StepLabel>Smart TVs</StepLabel></Step>
                  <Step key="m"><StepLabel>Mídias</StepLabel></Step>
                  <Step key="pl"><StepLabel>Playlists</StepLabel></Step>
                  <Step key="s"><StepLabel>Agendamento</StepLabel></Step>
                </>
              )}
            </Stepper>
            <Tabs
              value={editTab}
              onChange={(_, v) => setEditTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ mb: 2 }}
            >
              <Tab label="Principal" />
              {compactMode ? (
                <Tab label="Totens" />
              ) : (
                <>
                  <Tab label={orgTerms.campaignOrganizationsTab} />
                  <Tab label="Totens" />
                  <Tab label="Smart TVs" />
                </>
              )}
              <Tab label="Mídias" />
              <Tab label="Playlists" />
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
                  id="campaign-full-editor-category-segment"
                  name="categorySegment"
                  label="Categoria/Segmento"
                  value={(selectedCampaign as any)?.categorySegment || (selectedCampaign as any)?.category_segment || ''}
                  onChange={(e) =>
                    setSelectedCampaign({ ...(selectedCampaign as any), categorySegment: e.target.value } as any)
                  }
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
                {compactMode && (
                  <>
                    <FormControl fullWidth margin="normal" disabled={contractsLoading && contractsForPicker.length === 0}>
                      <InputLabel {...selectLabelShrinkProps}>Contrato (define o plano e os totens elegíveis)</InputLabel>
                      <Select
                        label="Contrato (define o plano e os totens elegíveis)"
                        value={(() => {
                          const c =
                            (selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId;
                          if (c === undefined || c === null || String(c).trim() === '') return '';
                          const n = Number(c);
                          if (Number.isNaN(n)) return '';
                          return contractsForPicker.some((row) => row.contract_id === n) ? String(n) : '';
                        })()}
                        onChange={(e) => {
                          const v = e.target.value;
                          const cid = v === '' ? undefined : Number(v);
                          setContractTopoSubTab(0);
                          autoTotemSelectionContractRef.current = null;
                          setSelectedCampaign({
                            ...selectedCampaign!,
                            contract_id: cid as any,
                            contractId: cid as any,
                            totemIds: [],
                          } as any);
                          if (cid !== undefined && !Number.isNaN(cid)) {
                            setEditTab(tabTotems);
                          }
                        }}
                      >
                        <MenuItem value="">
                          <em>Nenhum (sem execução nos totens)</em>
                        </MenuItem>
                        {contractsForPicker.map((c) => (
                          <MenuItem key={c.contract_id} value={String(c.contract_id)}>
                            {c.contract_number || `Contrato #${c.contract_id}`}
                            {c.plan_name ? ` — ${c.plan_name}` : ''}
                          </MenuItem>
                        ))}
                        {contractsInactiveForPicker.length > 0 && (
                          <ListSubheader component="div" sx={{ lineHeight: '32px', fontWeight: 600 }}>
                            Indisponíveis — ative na aba Contratos
                          </ListSubheader>
                        )}
                        {contractsInactiveForPicker.map((c) => (
                          <MenuItem key={`inactive-${c.contract_id}`} value={`__inactive_${c.contract_id}`} disabled>
                            {c.contract_number || `Contrato #${c.contract_id}`}
                            {c.plan_name ? ` — ${c.plan_name}` : ''}
                            {` (${contractStatusHint(c)})`}
                          </MenuItem>
                        ))}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Escolha um contrato ativo com plano. Abaixo aparecem os locais e totens elegíveis; na aba
                        Totens você escolhe onde a campanha será exibida.
                      </Typography>
                    </FormControl>
                    {contractsLoading && contractsForPicker.length === 0 && (
                      <LinearProgress sx={{ mb: 1 }} />
                    )}
                    {!contractsLoading && contractsForPicker.length === 0 && (
                      <Alert
                        severity="warning"
                        sx={{ mt: 1 }}
                        action={
                          onGoToSubscriberContracts ? (
                            <Button color="inherit" size="small" onClick={onGoToSubscriberContracts}>
                              Abrir Contratos
                            </Button>
                          ) : undefined
                        }
                      >
                        {contractsInactiveForPicker.length > 0
                          ? `Há ${contractsInactiveForPicker.length} contrato(s) em rascunho ou inativo. Ative um contrato na aba Contratos do anunciante (status «Ativo» e dentro da vigência) para vincular a campanha aos totens do plano.`
                          : 'Nenhum contrato encontrado para este anunciante. Crie um contrato na aba Contratos antes de vincular a campanha aos totens.'}
                      </Alert>
                    )}
                    {(() => {
                      const raw =
                        (selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId;
                      const n =
                        raw !== undefined && raw !== null && String(raw).trim() !== ''
                          ? Number(raw)
                          : NaN;
                      const hasInactiveSelection =
                        !Number.isNaN(n) && !contractsForPicker.some((row) => row.contract_id === n);
                      if (hasInactiveSelection) {
                        return (
                          <Alert severity="warning" sx={{ mt: 1 }}>
                            A campanha está vinculada a um contrato que não está ativo. Selecione um contrato ativo
                            acima para executar nos totens.
                          </Alert>
                        );
                      }
                      if (
                        contractsForPicker.length > 0 &&
                        (Number.isNaN(n) || raw === undefined || raw === null || String(raw).trim() === '')
                      ) {
                        return (
                          <Alert severity="info" sx={{ mt: 1 }}>
                            Esta campanha ainda não está vinculada a um contrato. Selecione um contrato ativo acima
                            para ver a rede permitida e depois escolha os totens na aba Totens.
                          </Alert>
                        );
                      }
                      return null;
                    })()}
                    {selectedContractRow && (
                      <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                        <Typography
                          variant="subtitle1"
                          component="div"
                          sx={{ color: 'primary.dark', fontWeight: 700, fontSize: '0.9375rem', mb: 0.5 }}
                        >
                          Rede permitida pelo contrato (somente leitura)
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                          Locais e totens que este contrato autoriza para campanhas (plano,{' '}
                          {orgTerms.organizationPlural.toLowerCase()} e locais configurados no plano).
                        </Typography>
                        <Tabs
                          value={contractTopoSubTab}
                          onChange={(_, v) => setContractTopoSubTab(v)}
                          variant="scrollable"
                          scrollButtons="auto"
                          allowScrollButtonsMobile
                          sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
                        >
                          <Tab
                            label="Locais"
                            icon={
                              contractTopologyCounts.lc > 0 ? (
                                <Chip label={contractTopologyCounts.lc} size="small" color="primary" />
                              ) : undefined
                            }
                            iconPosition="end"
                          />
                          <Tab
                            label="Totens"
                            icon={
                              contractTopologyCounts.tt > 0 ? (
                                <Chip label={contractTopologyCounts.tt} size="small" color="primary" />
                              ) : undefined
                            }
                            iconPosition="end"
                          />
                        </Tabs>
                        {derivedDevicesLoading ? (
                          <LinearProgress sx={{ my: 2 }} />
                        ) : (
                          <>
                            {!selectedContractRow.plan_id && (
                              <Alert severity="warning" sx={{ mb: 2 }}>
                                Este contrato não tem plano associado. Associe um plano na aba Contratos do anunciante
                                para liberar locais e totens.
                              </Alert>
                            )}
                            {selectedContractRow.plan_id && derivedTotems.length === 0 && (
                              <Alert severity="warning" sx={{ mb: 2 }}>
                                Nenhum totem elegível neste contrato. Verifique se o plano permite a{' '}
                                {orgTerms.organization.toLowerCase()} de cada local e se cada local está listado em
                                «locais do plano» (plan_local_access).
                              </Alert>
                            )}
                            {contractTopologyRow && (
                              <>
                                {contractTopoSubTab === 0 && (
                                  <PlanTopologyTabPanel
                                    mode="locals"
                                    preview={{ loading: false, error: null, rows: [contractTopologyRow] }}
                                    variant="edit"
                                    contractCount={1}
                                    dense
                                  />
                                )}
                                {contractTopoSubTab === 1 && (
                                  <PlanTopologyTabPanel
                                    mode="totens"
                                    preview={{ loading: false, error: null, rows: [contractTopologyRow] }}
                                    variant="edit"
                                    contractCount={1}
                                    dense
                                  />
                                )}
                              </>
                            )}
                          </>
                        )}
                      </Paper>
                    )}
                  </>
                )}
                <Grid container spacing={2} sx={{ mt: 1, alignItems: 'center' }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth margin="normal">
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={selectedCampaign?.status || 'draft'}
                        onChange={(e) => setSelectedCampaign({ ...selectedCampaign!, status: e.target.value })}
                        label="Status"
                      >
                        <MenuItem value="draft">Rascunho</MenuItem>
                        <MenuItem value="active">Ativa</MenuItem>
                        <MenuItem value="finished">Concluída</MenuItem>
                        <MenuItem value="cancelled">Cancelada</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      sx={{ mt: { xs: 0, sm: 1 } }}
                      control={
                        <Switch
                          checked={selectedCampaign?.is_active || false}
                          onChange={(e) => setSelectedCampaign({ ...selectedCampaign!, is_active: e.target.checked })}
                        />
                      }
                      label="Campanha Ativa"
                    />
                  </Grid>
                </Grid>

                <Box
                  sx={{
                    mt: 2,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                    width: '100%',
                  }}
                >
                  <TextField
                    fullWidth
                    label="Data de Início"
                    type="date"
                    value={
                      getCampaignStartYmdForDisplay(selectedCampaign) ||
                      getMinCampaignStartYmd(selectedCampaign)
                    }
                    onChange={(e) => {
                      if (!selectedCampaign) return;
                      const minYmd = getMinCampaignStartYmd(selectedCampaign);
                      setSelectedCampaign({
                        ...selectedCampaign,
                        start_date: clampCampaignStartYmd(e.target.value, minYmd),
                      });
                    }}
                    inputProps={{
                      min: selectedCampaign ? getMinCampaignStartYmd(selectedCampaign) : undefined,
                    }}
                    InputLabelProps={{ shrink: true }}
                    helperText={CAMPAIGN_START_DATE_MIN_HELPER}
                  />
                  <TextField
                    fullWidth
                    label="Data de Fim"
                    type="date"
                    value={getCampaignEndYmdForDisplay(selectedCampaign)}
                    onChange={(e) =>
                      setSelectedCampaign({
                        ...selectedCampaign!,
                        end_date: e.target.value,
                      })
                    }
                    InputLabelProps={{ shrink: true }}
                    helperText="Período de validade da campanha (fim)"
                  />
                </Box>
              </>
            )}

            {!compactMode && editTab === 1 && selectedCampaign && (
              <FormControl fullWidth margin="normal">
                <InputLabel>{orgTerms.organizationPlural} (onde a campanha será exibida)</InputLabel>
                <Autocomplete
                  multiple
                  options={(() => {
                    if (isAdmin) return publishers;
                    const baseOptions: any[] = accessiblePublishers.map((ap) => ({
                      publisher_id: ap.publisher_id,
                      name: ap.publisher_name,
                      email: ap.publisher_email,
                      __invalid: false,
                    }));

                    const selectedIds = ((selectedCampaign as any).publisherIds || []) as number[];
                    const accessibleIds = accessiblePublishers.map((ap) => ap.publisher_id);
                    const invalidIds = selectedIds.filter((id) => !accessibleIds.includes(id));
                    const invalidOptions = invalidIds.map((publisherId) => {
                      const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                      return {
                        publisher_id: publisherId,
                        name: orgLabel(publisherId, fromAll?.name),
                        email: fromAll?.email,
                        __invalid: true,
                      };
                    });

                    const merged = [...baseOptions, ...invalidOptions];
                    const seen = new Set<number>();
                    return merged.filter((p) => {
                      if (seen.has(p.publisher_id)) return false;
                      seen.add(p.publisher_id);
                      return true;
                    });
                  })()}
                  getOptionLabel={(option) => orgLabel(option.publisher_id, option.name)}
                  isOptionEqualToValue={(option, value) => option.publisher_id === value.publisher_id}
                  getOptionDisabled={(option: any) => !isAdmin && option.__invalid === true}
                  value={(() => {
                    const selectedIds = ((selectedCampaign as any).publisherIds || []) as number[];
                    const options: any[] = isAdmin
                      ? publishers
                      : [
                          ...accessiblePublishers.map((ap) => ({
                            publisher_id: ap.publisher_id,
                            name: ap.publisher_name || '',
                            email: ap.publisher_email,
                            __invalid: false,
                          })),
                          ...selectedIds
                            .filter((id) => !accessiblePublishers.map((ap) => ap.publisher_id).includes(id))
                            .map((publisherId) => {
                              const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                              return {
                                publisher_id: publisherId,
                                name: orgLabel(publisherId, fromAll?.name),
                                email: fromAll?.email,
                                __invalid: true,
                              };
                            }),
                        ];
                    return options.filter((p) => selectedIds.includes(p.publisher_id));
                  })()}
                  onChange={(_, newValue) => {
                    setSelectedCampaign({
                      ...selectedCampaign!,
                      publisherIds: newValue.map((p: any) => p.publisher_id),
                    } as any);
                  }}
                  renderInput={(params) => {
                    const selectedIds = ((selectedCampaign as any).publisherIds || []) as number[];
                    const accessibleIds = accessiblePublishers.map((ap) => ap.publisher_id);
                    const hasInvalidPublishers = !isAdmin && selectedIds.some((id) => !accessibleIds.includes(id));
                    const invalidIds = !isAdmin ? selectedIds.filter((id) => !accessibleIds.includes(id)) : [];
                    const invalidLabels = invalidIds.map((publisherId) => {
                      const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                      return `${orgLabel(publisherId, fromAll?.name)} (#${publisherId})`;
                    });

                    return (
                      <TextField
                        {...params}
                        label={orgTerms.campaignOrganizationsTab}
                        margin="normal"
                        error={hasInvalidPublishers}
                        helperText={
                          hasInvalidPublishers
                            ? `${orgTerms.organizationPlural} não acessíveis: ${invalidLabels.join(', ')}. Remova-as ou verifique seu contrato.`
                            : isAdmin
                              ? `Selecione as ${orgTerms.organizationPlural.toLowerCase()} onde a campanha será exibida`
                              : accessiblePublishers.length === 0
                                ? `Nenhuma ${orgTerms.organization.toLowerCase()} acessível encontrada. Verifique o contrato e o plano do anunciante.`
                                : `Selecione as ${orgTerms.organizationPlural.toLowerCase()} acessíveis onde a campanha será exibida`
                        }
                      />
                    );
                  }}
                  disabled={!isAdmin && accessiblePublishers.length === 0}
                />
              </FormControl>
            )}

            {editTab === tabPlaylists && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Playlists
                </Typography>
                {orderedPlaylistIds.length > 0 ? (
                  <>
                    <SortableList
                      items={orderedPlaylistIds.map((id) => {
                        const playlist = playlists.find((p) => p.playlist_id === id);
                        return {
                          id,
                          label: playlist?.name || `Playlist ${id}`,
                          secondary: playlist ? `${playlist.media_count || 0} mídias` : undefined,
                        };
                      })}
                      onReorder={handleReorderPlaylists}
                      onDelete={(id) => {
                        const newOrder = orderedPlaylistIds.filter((playlistId) => playlistId !== id);
                        setOrderedPlaylistIds(newOrder);
                        setSelectedCampaign({
                          ...selectedCampaign!,
                          playlistIds: newOrder,
                        });
                      }}
                      emptyMessage="Nenhuma playlist selecionada"
                    />
                    <Autocomplete
                      multiple
                      options={playlists.filter((p) => {
                        const campaignSubscriberId =
                          selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                        const isAlreadyAdded = orderedPlaylistIds.includes(p.playlist_id);
                        return (
                          !isAlreadyAdded &&
                          (!campaignSubscriberId || (p.subscriber_id ?? p.client_id) === campaignSubscriberId)
                        );
                      })}
                      getOptionLabel={(option) => option.name}
                      value={[]}
                      onChange={(_, newValue) => {
                        const newIds = [...orderedPlaylistIds, ...newValue.map((p) => p.playlist_id)];
                        setOrderedPlaylistIds(newIds);
                        setSelectedCampaign({
                          ...selectedCampaign!,
                          playlistIds: newIds,
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
                    options={playlists.filter((p) => {
                      const campaignSubscriberId =
                        selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                      return !campaignSubscriberId || (p.subscriber_id ?? p.client_id) === campaignSubscriberId;
                    })}
                    getOptionLabel={(option) => option.name}
                    value={playlists.filter((p) => (selectedCampaign?.playlistIds || []).includes(p.playlist_id))}
                    onChange={(_, newValue) => {
                      const newIds = newValue.map((p) => p.playlist_id);
                      setOrderedPlaylistIds(newIds);
                      setSelectedCampaign({
                        ...selectedCampaign!,
                        playlistIds: newIds,
                      });
                    }}
                    noOptionsText={
                      compactMode
                        ? 'Nenhuma playlist cadastrada. Crie em Playlists e adicione mídias.'
                        : 'Nenhuma playlist cadastrada. Crie em Anunciantes > Playlists, adicione mídias e depois selecione aqui.'
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Playlists"
                        margin="normal"
                        helperText="Selecione playlists e depois arraste para reordenar"
                      />
                    )}
                  />
                )}
              </Box>
            )}

            {editTab === tabMedias && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Mídias Diretas (sem playlist)
                </Typography>
                {orderedMediaIds.length > 0 ? (
                  <>
                    <SortableList
                      items={orderedMediaIds.map((id) => {
                        const media = mediaItems.find((m) => m.media_id === id);
                        return {
                          id,
                          label: media?.name || `Mídia ${id}`,
                          secondary: media
                            ? `${media.fileName || ''} (${media.media_type || (media as any).mediaType || 'N/A'})`
                            : undefined,
                        };
                      })}
                      onReorder={handleReorderMedias}
                      onDelete={(id) => {
                        const newOrder = orderedMediaIds.filter((mediaId) => mediaId !== id);
                        setOrderedMediaIds(newOrder);
                        setSelectedCampaign({
                          ...selectedCampaign!,
                          mediaIds: newOrder,
                        });
                      }}
                      emptyMessage="Nenhuma mídia selecionada"
                    />
                    <Autocomplete
                      multiple
                      options={mediaItems.filter((m) => {
                        const campaignSubscriberId =
                          selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                        const isAlreadyAdded = orderedMediaIds.includes(m.media_id);
                        return (
                          !isAlreadyAdded &&
                          (!campaignSubscriberId || (m.subscriberId ?? m.clientId) === campaignSubscriberId)
                        );
                      })}
                      getOptionLabel={(option) => option.name}
                      value={[]}
                      onChange={(_, newValue) => {
                        const newIds = [...orderedMediaIds, ...newValue.map((m) => m.media_id)];
                        setOrderedMediaIds(newIds);
                        setSelectedCampaign({
                          ...selectedCampaign!,
                          mediaIds: newIds,
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
                    options={mediaItems.filter((m) => {
                      const campaignSubscriberId =
                        selectedCampaign?.subscriber_id || (selectedCampaign as any)?.subscriberId;
                      return !campaignSubscriberId || (m.subscriberId ?? m.clientId) === campaignSubscriberId;
                    })}
                    getOptionLabel={(option) => option.name}
                    value={mediaItems.filter((m) => (selectedCampaign?.mediaIds || []).includes(m.media_id))}
                    onChange={(_, newValue) => {
                      const newIds = newValue.map((m) => m.media_id);
                      setOrderedMediaIds(newIds);
                      setSelectedCampaign({
                        ...selectedCampaign!,
                        mediaIds: newIds,
                      });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Mídias Diretas (sem playlist)"
                        margin="normal"
                        helperText="Selecione mídias e depois arraste para reordenar"
                      />
                    )}
                  />
                )}
              </Box>
            )}

            {editTab === tabTotems && selectedCampaign && (
              <Box sx={{ mt: 2, mb: 1 }}>
                {compactMode &&
                  !((selectedCampaign as any)?.contract_id ?? (selectedCampaign as any)?.contractId) && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Selecione um contrato ativo na aba Principal para listar os totens elegíveis (plano e locais do
                      contrato).
                    </Alert>
                  )}
                {derivedDevicesLoading ? (
                  <LinearProgress sx={{ mt: 2 }} />
                ) : (
                  <>
                    {compactMode && eligibleTotemIds.length > 0 && (
                      <FormControlLabel
                        sx={{ mb: 1, display: 'flex', alignItems: 'center' }}
                        control={
                          <Switch
                            checked={allTotemsSelected}
                            onChange={(e) => {
                              if (!selectedCampaign) return;
                              const checked = e.target.checked;
                              const contractRaw =
                                (selectedCampaign as any)?.contract_id ??
                                (selectedCampaign as any)?.contractId;
                              const contractId =
                                contractRaw !== undefined &&
                                contractRaw !== null &&
                                String(contractRaw).trim() !== '' &&
                                !Number.isNaN(Number(contractRaw))
                                  ? Number(contractRaw)
                                  : null;
                              if (contractId != null) {
                                autoTotemSelectionContractRef.current = contractId;
                              }
                              setSelectedCampaign({
                                ...selectedCampaign,
                                totemIds: checked ? [...eligibleTotemIds] : [],
                              } as any);
                            }}
                          />
                        }
                        label="Selecionar todos"
                      />
                    )}
                  <Autocomplete
                    multiple
                    disableCloseOnSelect
                    filterSelectedOptions={false}
                    sx={{
                      '& .MuiAutocomplete-inputRoot': {
                        alignItems: 'flex-start',
                        py: 1,
                      },
                      '& .MuiAutocomplete-tag': {
                        my: 0.25,
                      },
                    }}
                    options={totemAutocompleteOptions}
                    getOptionLabel={(option) => campaignTotemOptionLabel(option)}
                    isOptionEqualToValue={(option, value) =>
                      getTotemIdFromRow(option) ===
                      getTotemIdFromRow(value)
                    }
                    value={totemAutocompleteOptions.filter((t) => {
                      const id = getTotemIdFromRow(t);
                      return id !== undefined && getSelectedTotemIds().includes(id);
                    })}
                    onChange={(_, newValue, reason, details) => {
                      if (!selectedCampaign) return;
                      let nextIds: number[];
                      if (reason === 'selectOption' && details?.option) {
                        const clickedId = getTotemIdFromRow(details.option);
                        if (clickedId === undefined) return;
                        const cur = getSelectedTotemIds();
                        nextIds = cur.includes(clickedId)
                          ? cur.filter((id) => id !== clickedId)
                          : [...cur, clickedId];
                      } else {
                        nextIds = newValue
                          .map((t) => getTotemIdFromRow(t))
                          .filter((n): n is number => n !== undefined);
                      }
                      setSelectedCampaign({
                        ...selectedCampaign,
                        totemIds: nextIds,
                      } as any);
                    }}
                    renderTags={(tagValue, getTagProps) =>
                      tagValue.map((option, index) => (
                        <Chip
                          {...getTagProps({ index })}
                          label={campaignTotemOptionLabel(option)}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ))
                    }
                    renderOption={(props, option, { selected }) => {
                      const { key, ...liProps } = props as React.HTMLAttributes<HTMLLIElement> & { key?: string };
                      const orphan = Boolean((option as any).__orphan);
                      return (
                        <Box
                          component="li"
                          key={key ?? option.totem_id}
                          {...liProps}
                          sx={{
                            ...(selected && {
                              bgcolor: alpha(theme.palette.success.main, 0.14),
                              color: 'success.dark',
                              fontWeight: 600,
                              '&.Mui-focused, &.Mui-focusVisible': {
                                bgcolor: alpha(theme.palette.success.main, 0.22),
                              },
                            }),
                            ...(orphan && { opacity: 0.85, fontStyle: 'italic' }),
                          }}
                        >
                          {campaignTotemOptionLabel(option)}
                        </Box>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Totens (Onde a campanha será exibida)"
                        margin="none"
                        InputLabelProps={{ shrink: true }}
                        helperText={(() => {
                          const compactContractId =
                            (selectedCampaign as any)?.contract_id ??
                            (selectedCampaign as any)?.contractId;
                          if (derivedTotems.length === 0) {
                            if (!compactMode) {
                              return `Nenhum totem nas ${orgTerms.organizationPlural.toLowerCase()} selecionadas. Selecione ${orgTerms.organizationPlural.toLowerCase()} na aba ${orgTerms.campaignOrganizationsTab}.`;
                            }
                            if (totemAutocompleteOptions.some((o: any) => o.__orphan)) {
                              return 'Totens guardados na campanha ainda não aparecem na lista do contrato (verifique plan_local_access / contrato ativo) ou aguarde o carregamento.';
                            }
                            return compactContractId
                              ? `Nenhum totem elegível: o contrato tem de estar ativo e no prazo; o plano tem de permitir a ${orgTerms.organization.toLowerCase()} de cada totem; e o plano tem de listar explicitamente cada local permitido (configuração «locais do plano» na base de dados). Se faltar a lista de locais do plano, não aparece nenhum totem.`
                              : 'Nenhum totem listado. Escolha um contrato ativo com plano na aba Principal (campo Contrato).';
                          }
                          return compactMode
                            ? allTotemsSelected
                              ? 'Todos os totens elegíveis do contrato estão selecionados (padrão). Desmarque «Selecionar todos» ou retire totens para limitar.'
                              : `Só aparecem totens dos locais explicitamente ligados ao plano do contrato (e cuja ${orgTerms.organization.toLowerCase()} o plano também permite).`
                            : `Selecione os totens onde a campanha será exibida. Se nenhum for selecionado, a campanha vale para todos os totens das ${orgTerms.organizationPlural.toLowerCase()}.`;
                        })()}
                      />
                    )}
                    disabled={totemAutocompleteOptions.length === 0 && !derivedDevicesLoading}
                    noOptionsText={
                      compactMode
                        ? 'Nenhum totem disponível.'
                        : `Nenhum totem nas ${orgTerms.organizationPlural.toLowerCase()} selecionadas. Selecione ${orgTerms.organizationPlural.toLowerCase()} na aba ${orgTerms.campaignOrganizationsTab}.`
                    }
                  />
                  </>
                )}
              </Box>
            )}

            {!compactMode && editTab === tabSmartTvs && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Smart TVs impactadas (derivado das {orgTerms.organizationPlural.toLowerCase()} selecionadas)
                </Typography>
                {derivedDevicesLoading ? (
                  <LinearProgress />
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {derivedSmartTvs.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma Smart TV encontrada para as {orgTerms.organizationPlural.toLowerCase()} selecionadas.
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

            {editTab === tabSchedule && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Validade / Execução (política A)
                </Typography>
                {compactMode ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    No TotemDigital, a execução segue o dispatcher e as regras de campanha/totem. Ajuste datas na aba
                    Principal e totens na aba Totens.
                  </Typography>
                ) : (
                  (() => {
                    const selectedIds = (((selectedCampaign as any)?.publisherIds || []) as number[]);
                    const accessibleIds = accessiblePublishers.map((ap) => ap.publisher_id);
                    const invalidIds = !isAdmin ? selectedIds.filter((id) => !accessibleIds.includes(id)) : [];
                    const invalidLabels = invalidIds.map((publisherId) => {
                      const fromAll = (publishers || []).find((p: any) => p.publisher_id === publisherId);
                      return `${orgLabel(publisherId, fromAll?.name)} (#${publisherId})`;
                    });
                    return (
                      <>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          A campanha pode manter associações históricas. A execução (dispatcher/mix) filtra apenas o que
                          estiver válido no momento atual.
                        </Typography>
                        {invalidLabels.length > 0 ? (
                          <Alert severity="warning">
                            {orgTerms.organizationPlural} bloqueadas agora (não serão executadas): {invalidLabels.join(', ')}
                          </Alert>
                        ) : (
                          <Alert severity="success">Todas as {orgTerms.organizationPlural.toLowerCase()} selecionadas estão válidas no momento.</Alert>
                        )}
                      </>
                    );
                  })()
                )}
              </Box>
            )}

            {editTab === 0 && (
              <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, color: theme.palette.primary.main }}>
                  Configurações Comerciais
                </Typography>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Nível Comercial (Tier)</InputLabel>
                  <Select
                    value={(selectedCampaign as any)?.commercial_tier || 'standard'}
                    onChange={(e) =>
                      setSelectedCampaign({
                        ...selectedCampaign!,
                        commercial_tier: e.target.value,
                      } as any)
                    }
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
                  onChange={(e) =>
                    setSelectedCampaign({
                      ...selectedCampaign!,
                      default_time_share_percent: parseFloat(e.target.value) || 0,
                    } as any)
                  }
                  margin="normal"
                  helperText="Percentual de tempo padrão que esta campanha deve ocupar no mix (0-100%)"
                />
                <TextField
                  fullWidth
                  label="Máximo de Slots Consecutivos"
                  type="number"
                  inputProps={{ min: 1, max: 10 }}
                  value={(selectedCampaign as any)?.max_consecutive_slots || 2}
                  onChange={(e) =>
                    setSelectedCampaign({
                      ...selectedCampaign!,
                      max_consecutive_slots: parseInt(e.target.value, 10) || 2,
                    } as any)
                  }
                  margin="normal"
                  helperText="Número máximo de itens desta campanha que podem aparecer consecutivamente"
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSaveCampaign}
          disabled={!selectedCampaign || loadingCampaign || saving}
        >
          {saving ? 'A guardar…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CampaignFullEditorDialog;
