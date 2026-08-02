import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  Select,
  Switch,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { AutoAwesome, CheckCircle, CloudUpload, FlashOn, PlayCircleOutline, Refresh, Send } from '@mui/icons-material';
import { CreatePublishPanel } from '../../components/Publish/CreatePublishPanel';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import {
  Contract,
  MediaItem,
  Player,
  QuickPublishPreset,
  quickPublishApi,
  mediaApi,
  publishBoardApi,
  subscriberApi,
  Subscriber,
} from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { resolveMediaId, sanitizeMediaIdList } from '../../utils/mediaId';
import { isInstallationModuleOn } from '../../utils/installationModuleAccess';
import {
  isPublishBoardHtmlMedia,
  parsePublishBoardPresetFromTags,
} from '../../utils/publishBoardMedia';
import {
  PUBLISH_SEGMENTS,
  buildTemplateDescription,
  buildTemplateTitle,
  findPublishPreset,
  findPublishSegment,
  resolvePublishPreset,
} from '../../config/publishTemplates';
import { usePublishTemplatesFromApi } from '../../hooks/usePublishTemplatesFromApi';
import { campaignTotemOptionLabel } from '../Campaigns/campaignHelpers';
import { getTotemIdFromRow } from '../../utils/totemRowIds';
import { useAppSelector } from '../../store';

const STEPS = ['Cliente', 'Tela', 'Conteúdo', 'Publicar'];

type PublishMode = 'quick' | 'create';

function resolvePublishMode(value: string | null): PublishMode {
  return value === 'create' ? 'create' : 'quick';
}

function parseIdListParam(value: string | null): number[] {
  if (!value) return [];
  return [...new Set(
    value.split(',').map((part) => Number(part.trim())).filter((n) => Number.isInteger(n) && n > 0)
  )];
}

function resolveSegment(value: string | null): string {
  return PUBLISH_SEGMENTS.some((item) => item.value === value) ? String(value) : PUBLISH_SEGMENTS[0].value;
}

function getSubscriberName(subscriber?: Subscriber | null): string {
  return String(subscriber?.name || '').trim();
}

function getContractLabel(contract: Contract): string {
  const contractAny = contract as any;
  const number = String(contractAny.contract_number || contractAny.contractNumber || '').trim();
  const plan = String(contractAny.plan_name || contractAny.planName || 'Plano').trim();
  return `${number || `Contrato ${contract.contract_id}`} - ${plan}`;
}

function getMediaLabel(media: MediaItem): string {
  return `${media.name} (${media.media_type})`;
}

function isApprovedMedia(media: MediaItem): boolean {
  const status = String(media.status || '').toLowerCase();
  if (status !== 'approved') return false;
  const approval = String(media.approvalStatus || '').toLowerCase();
  return !approval || approval === 'approved';
}

function isProtectedThumbnailUrl(url?: string | null): boolean {
  if (!url) return false;
  return /\/api\/media\/\d+\/thumbnail(\?|$)/.test(url);
}

function normalizePublicAssetUrl(raw?: string | null): string | undefined {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (!v) return undefined;
  if (v.startsWith('/assets/')) return v;
  if (v.startsWith('/uploads/')) return v;
  if (v.startsWith('/opt/smart-signage/public/assets/')) {
    return v.replace('/opt/smart-signage/public/assets/', '/assets/');
  }
  if (v.includes('/public/assets/')) {
    const parts = v.split('/public/assets/');
    if (parts.length > 1) return `/assets/${parts[1]}`.replace(/\/+/g, '/');
  }
  if (v.includes('/assets/')) {
    const parts = v.split('/assets/');
    if (parts.length > 1) return `/assets/${parts[1]}`.replace(/\/+/g, '/');
  }
  return undefined;
}

const QuickPublish: React.FC = () => {
  const theme = useTheme();
  const user = useAppSelector((state) => state.auth.user);
  const breadcrumbs = useBreadcrumbs();
  const { presets: publishPresets, getPreset } = usePublishTemplatesFromApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [publishMode, setPublishMode] = useState<PublishMode>(
    resolvePublishMode(searchParams.get('mode'))
  );
  const initialSegment = resolveSegment(searchParams.get('segment'));
  const initialSegmentOption = findPublishSegment(initialSegment);
  const initialPreset = searchParams.get('preset')
    ? resolvePublishPreset(searchParams.get('preset'))
    : initialSegmentOption.defaultPreset;
  const initialPresetOption = findPublishPreset(initialPreset);
  const initialOrientation = searchParams.get('orientation');
  const initialPortrait =
    initialOrientation === 'portrait'
      ? true
      : initialOrientation === 'landscape'
        ? false
        : initialPresetOption.preferredOrientation === 'portrait';
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [totems, setTotems] = useState<Player[]>([]);
  const [medias, setMedias] = useState<MediaItem[]>([]);
  const [subscriberId, setSubscriberId] = useState<number | ''>('');
  const [contractId, setContractId] = useState<number | ''>('');
  const [totemIds, setTotemIds] = useState<number[]>([]);
  const [mediaIds, setMediaIds] = useState<number[]>([]);
  const [segment, setSegment] = useState(initialSegment);
  const [preset, setPreset] = useState<QuickPublishPreset>(initialPreset);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(buildTemplateDescription(initialPresetOption, initialSegmentOption));
  const [durationMs, setDurationMs] = useState(initialPresetOption.recommendedDurationMs);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const uploadPreviewRevokeRef = useRef<(() => void) | null>(null);
  const autoTotemSelectionContractRef = useRef<number | null>(null);
  const selectedMediaPreviewUrlsRef = useRef<Map<number, string>>(new Map());
  const selectedMediaHtmlDocsRef = useRef<Map<number, string>>(new Map());
  const [selectedMediaPreviewTick, setSelectedMediaPreviewTick] = useState(0);
  const [loadingSelectedMediaPreview, setLoadingSelectedMediaPreview] = useState(false);
  const [uploadName, setUploadName] = useState('');
  /** Após upload, encaixar imagem/vídeo em 9:16 (API `POST /api/media/:id/transform`). */
  const [portraitAfterUpload, setPortraitAfterUpload] = useState(initialPortrait);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const publishInFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [partialRegenWarning, setPartialRegenWarning] = useState<string | null>(null);
  const selectedSubscriber = useMemo(
    () => subscribers.find((subscriber) => subscriber.subscriber_id === subscriberId) || null,
    [subscriberId, subscribers]
  );

  const selectedPreset = useMemo(
    () => getPreset(preset),
    [getPreset, preset]
  );

  const selectedSegment = useMemo(
    () => findPublishSegment(segment),
    [segment]
  );

  const safeMediaIds = useMemo(() => sanitizeMediaIdList(mediaIds), [mediaIds]);

  const activeStep = useMemo(() => {
    if (!subscriberId || !contractId) return 0;
    if (totemIds.length === 0) return 1;
    if (safeMediaIds.length === 0 || !title.trim()) return 2;
    return 3;
  }, [contractId, safeMediaIds.length, subscriberId, title, totemIds.length]);

  const selectedMedias = useMemo(
    () =>
      medias.filter((media) => {
        const id = resolveMediaId(media);
        return id != null && safeMediaIds.includes(id);
      }),
    [safeMediaIds, medias]
  );

  const selectedMediaNames = useMemo(
    () => selectedMedias.map((media) => media.name),
    [selectedMedias]
  );

  const replacePublishBoardMediaId = useMemo(() => {
    if (safeMediaIds.length !== 1) return undefined;
    const id = safeMediaIds[0];
    const media = selectedMedias.find((m) => resolveMediaId(m) === id);
    if (media && isPublishBoardHtmlMedia(media)) return id;
    return undefined;
  }, [safeMediaIds, selectedMedias]);

  const getSelectedMediaPreviewSrc = useCallback((media: MediaItem): string | undefined => {
    const id = resolveMediaId(media);
    if (id && selectedMediaPreviewUrlsRef.current.has(id)) {
      return selectedMediaPreviewUrlsRef.current.get(id);
    }
    const url = media.previewUrl || media.thumbnailUrl;
    if (url && !isProtectedThumbnailUrl(url)) return url;
    const publicPath = normalizePublicAssetUrl(media.file_path);
    if (publicPath && !id) return publicPath;
    return undefined;
  }, [selectedMediaPreviewTick]);

  const getSelectedMediaHtmlDoc = useCallback((media: MediaItem): string | undefined => {
    const id = resolveMediaId(media);
    if (!id) return undefined;
    return selectedMediaHtmlDocsRef.current.get(id);
  }, [selectedMediaPreviewTick]);

  const selectedTotemNames = useMemo(
    () =>
      totems
        .filter((totem) => {
          const id = getTotemIdFromRow(totem);
          return id !== undefined && totemIds.includes(id);
        })
        .map((totem) => campaignTotemOptionLabel(totem)),
    [totemIds, totems]
  );

  const eligibleTotemIds = useMemo(
    () =>
      totems
        .map((totem) => getTotemIdFromRow(totem))
        .filter((id): id is number => id !== undefined),
    [totems]
  );

  const allTotemsSelected =
    eligibleTotemIds.length > 0 && eligibleTotemIds.every((id) => totemIds.includes(id));

  const billingBlocksPublish = useMemo(() => {
    if (!selectedSubscriber?.has_billing_publish_blocked) return false;
    const role = String(user?.role || '');
    return !['owner_system', 'admin_sql', 'admin'].includes(role);
  }, [selectedSubscriber, user?.role]);

  const billingGraceWarning = useMemo(
    () =>
      Boolean(
        selectedSubscriber?.has_billing_overdue && !selectedSubscriber?.has_billing_publish_blocked
      ),
    [selectedSubscriber]
  );

  const canPublish = Boolean(
    subscriberId &&
      contractId &&
      totemIds.length > 0 &&
      safeMediaIds.length > 0 &&
      title.trim() &&
      !billingBlocksPublish
  );

  const autoPublishReady = useMemo(
    () =>
      Boolean(subscriberId && contractId && totemIds.length > 0 && title.trim() && !billingBlocksPublish),
    [billingBlocksPublish, contractId, subscriberId, title, totemIds.length]
  );

  const autoPublishContext = useMemo(() => {
    if (!subscriberId || !contractId || totemIds.length === 0) return null;
    return {
      contractId: Number(contractId),
      totemIds,
      title: title.trim(),
      description: description.trim() || undefined,
      durationMs,
    };
  }, [contractId, description, durationMs, subscriberId, title, totemIds]);

  const loadApprovedMedias = useCallback(async (targetSubscriberId: number) => {
    const mediaResult = await mediaApi.getAll({ subscriberId: targetSubscriberId, limit: 1000 });
    const approvedMedias = (mediaResult.data || []).filter(isApprovedMedia);
    setMedias(approvedMedias);
    return approvedMedias;
  }, []);

  const loadSubscribers = async () => {
    try {
      setLoadingInitial(true);
      setError(null);
      if (!isInstallationModuleOn('subscribers')) {
        setSubscribers([]);
        setError(
          'Anunciantes desactivados neste modo. Em Complementos do sistema, escolha Multi-agência Pro.'
        );
        return;
      }
      const response = await subscriberApi.getAll({ active_only: true, limit: 1000 });
      setSubscribers(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar anunciantes.'));
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadSubscribers();
  }, []);

  useEffect(() => {
    const cleaned = sanitizeMediaIdList(mediaIds);
    const dirty =
      cleaned.length !== mediaIds.length ||
      cleaned.some((id, i) => id !== Number(mediaIds[i]));
    if (dirty) {
      setMediaIds(cleaned);
    }
  }, [mediaIds]);

  useEffect(() => {
    const sid = searchParams.get('subscriber');
    if (sid && /^\d+$/.test(sid)) {
      setSubscriberId(Number(sid));
    }
  }, [searchParams]);

  useEffect(() => {
    setPortraitAfterUpload(preset === 'menu');
  }, [preset]);

  useEffect(() => {
    return () => {
      selectedMediaPreviewUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* noop */
        }
      });
      selectedMediaPreviewUrlsRef.current.clear();
      selectedMediaHtmlDocsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || selectedMedias.length === 0) {
      setLoadingSelectedMediaPreview(false);
      return;
    }

    let cancelled = false;
    const toFetch = selectedMedias
      .map((media) => ({
        id: resolveMediaId(media),
        media,
        isHtml: isPublishBoardHtmlMedia(media),
        needsBlob:
          !isPublishBoardHtmlMedia(media)
          && resolveMediaId(media) != null
          && (
            isProtectedThumbnailUrl(media.thumbnailUrl || media.previewUrl)
            || !normalizePublicAssetUrl(media.file_path)
          ),
      }))
      .filter((item): item is { id: number; media: MediaItem; isHtml: boolean; needsBlob: boolean } =>
        item.id != null && (item.isHtml || item.needsBlob)
      )
      .filter((item) =>
        item.isHtml
          ? !selectedMediaHtmlDocsRef.current.has(item.id) && !selectedMediaPreviewUrlsRef.current.has(item.id)
          : !selectedMediaPreviewUrlsRef.current.has(item.id)
      );

    if (toFetch.length === 0) {
      setLoadingSelectedMediaPreview(false);
      return;
    }

    setLoadingSelectedMediaPreview(true);
    (async () => {
      for (const { id, media, isHtml } of toFetch) {
        try {
          if (isHtml) {
            const sid = Number(media.subscriberId || 0);
            const boardPreset = parsePublishBoardPresetFromTags(media.tags);
            if (sid > 0 && boardPreset) {
              try {
                const layoutRes = await publishBoardApi.getLayout(sid, boardPreset);
                const preview = await publishBoardApi.previewHtml(sid, boardPreset, layoutRes.data);
                if (cancelled) continue;
                selectedMediaHtmlDocsRef.current.set(id, preview.data?.html || '');
                setSelectedMediaPreviewTick((v) => v + 1);
                continue;
              } catch {
                /* tenta ficheiro abaixo */
              }
            }
            const blob = await mediaApi.getFileBlob(id);
            const text = await blob.text();
            if (cancelled) continue;
            selectedMediaHtmlDocsRef.current.set(id, text);
            setSelectedMediaPreviewTick((v) => v + 1);
            continue;
          }
          const blob = await mediaApi.getThumbnailBlob(id);
          const objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            continue;
          }
          selectedMediaPreviewUrlsRef.current.set(id, objectUrl);
          setSelectedMediaPreviewTick((v) => v + 1);
        } catch {
          /* preview opcional */
        }
      }
      if (!cancelled) setLoadingSelectedMediaPreview(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedMedias]);

  useEffect(() => {
    uploadPreviewRevokeRef.current?.();
    uploadPreviewRevokeRef.current = null;
    if (!uploadFile) {
      setUploadPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setUploadPreviewUrl(url);
    uploadPreviewRevokeRef.current = () => {
      URL.revokeObjectURL(url);
      uploadPreviewRevokeRef.current = null;
    };
    return () => {
      uploadPreviewRevokeRef.current?.();
    };
  }, [uploadFile]);

  useEffect(() => {
    const urlSegment = resolveSegment(searchParams.get('segment'));
    const segmentOption = findPublishSegment(urlSegment);
    const urlPreset = searchParams.get('preset')
      ? resolvePublishPreset(searchParams.get('preset'))
      : segmentOption.defaultPreset;

    if (urlPreset === preset && urlSegment === segment) {
      return;
    }

    const template = findPublishPreset(urlPreset);
    const urlOrientation = searchParams.get('orientation');
    if (urlOrientation === 'portrait') setPortraitAfterUpload(true);
    else if (urlOrientation === 'landscape') setPortraitAfterUpload(false);
    else setPortraitAfterUpload(template.preferredOrientation === 'portrait');
    setSegment(urlSegment);
    setPreset(template.value);
    setDurationMs(template.recommendedDurationMs);
    setDescription(buildTemplateDescription(template, segmentOption));
  }, [preset, searchParams, segment]);

  useEffect(() => {
    if (!subscriberId) {
      setContracts([]);
      setTotems([]);
      setMedias([]);
      setContractId('');
      setTotemIds([]);
      setMediaIds([]);
      autoTotemSelectionContractRef.current = null;
      return;
    }

    const loadSubscriberDetails = async () => {
      try {
        setLoadingDetails(true);
        setError(null);
        autoTotemSelectionContractRef.current = null;
        setContractId('');
        setTotemIds([]);
        const fromUrl = parseIdListParam(searchParams.get('mediaIds'));
        const [contractsResult, approvedMedias] = await Promise.all([
          subscriberApi.getContracts(Number(subscriberId), { activeOnly: true }),
          loadApprovedMedias(Number(subscriberId)),
        ]);
        const activeContracts = Array.isArray(contractsResult) ? contractsResult : [];
        setContracts(activeContracts);
        setContractId(activeContracts[0]?.contract_id || '');
        const validMedia = fromUrl.filter((id) =>
          approvedMedias.some((m) => m.media_id === id)
        );
        setMediaIds(validMedia);
        const urlMode = resolvePublishMode(searchParams.get('mode'));
        const urlSegment = resolveSegment(searchParams.get('segment'));
        const urlPreset = searchParams.get('preset')
          ? resolvePublishPreset(searchParams.get('preset'))
          : findPublishSegment(urlSegment).defaultPreset;
        const selectedRows = approvedMedias.filter((m) => validMedia.includes(m.media_id));
        const boardMedia = selectedRows.find((m) => isPublishBoardHtmlMedia(m));
        if (urlMode === 'create' || boardMedia) {
          setPublishMode('create');
          const presetFromTag = boardMedia
            ? parsePublishBoardPresetFromTags(boardMedia.tags)
            : null;
          const effectivePreset = presetFromTag || urlPreset;
          if (presetFromTag) {
            const tpl = findPublishPreset(presetFromTag);
            setPreset(tpl.value);
            setDurationMs(tpl.recommendedDurationMs);
          }
          const nextParams: Record<string, string> = {
            mode: 'create',
            subscriber: String(subscriberId),
            preset: effectivePreset,
            segment: urlSegment,
          };
          if (validMedia.length) nextParams.mediaIds = validMedia.join(',');
          setSearchParams(nextParams, { replace: true });
        }
        if (validMedia.length > 0 && !boardMedia && urlMode !== 'create') {
          setSuccess('Mídia carregada — selecione contrato e telas para publicar.');
        } else if (validMedia.length > 0 && boardMedia) {
          setSuccess('Conteúdo HTML carregado — edite no estúdio ou publique novamente.');
        }
      } catch (e) {
        setError(pickApiErrorMessage(e, 'Erro ao carregar dados do anunciante.'));
      } finally {
        setLoadingDetails(false);
      }
    };

    loadSubscriberDetails();
  }, [loadApprovedMedias, searchParams, subscriberId]);

  useEffect(() => {
    if (!subscriberId || !contractId) {
      setTotems([]);
      setTotemIds([]);
      return;
    }

    const loadTotems = async () => {
      try {
        setLoadingDetails(true);
        setError(null);
        setTotemIds([]);
        const rows = await subscriberApi.getTotems(Number(subscriberId), { contractId: Number(contractId) });
        setTotems(Array.isArray(rows) ? rows : []);
      } catch (e) {
        setError(pickApiErrorMessage(e, 'Erro ao carregar telas/totens do contrato.'));
      } finally {
        setLoadingDetails(false);
      }
    };

    loadTotems();
  }, [contractId, subscriberId]);

  /** Sem totens definidos: selecionar todos os elegíveis do contrato (mesma regra das campanhas). */
  useEffect(() => {
    if (!subscriberId || !contractId || loadingDetails) return;
    const cid = Number(contractId);
    if (eligibleTotemIds.length === 0) return;

    if (totemIds.length > 0) {
      autoTotemSelectionContractRef.current = cid;
      return;
    }
    if (autoTotemSelectionContractRef.current === cid) return;

    autoTotemSelectionContractRef.current = cid;
    setTotemIds([...eligibleTotemIds]);
  }, [contractId, eligibleTotemIds, loadingDetails, subscriberId, totemIds.length]);

  /** Remove totens que deixaram de ser elegíveis sem apagar seleção quando a lista ainda está vazia. */
  useEffect(() => {
    if (!subscriberId || !contractId || loadingDetails) return;
    if (totems.length === 0) return;
    const ids = totemIds.filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return;
    const allowed = new Set(eligibleTotemIds);
    const pruned = ids.filter((id) => allowed.has(id));
    if (pruned.length === ids.length) return;
    setTotemIds(pruned);
  }, [contractId, eligibleTotemIds, loadingDetails, subscriberId, totems.length, totemIds]);

  useEffect(() => {
    if (!title.trim() && selectedSubscriber) {
      setTitle(buildTemplateTitle(selectedPreset, getSubscriberName(selectedSubscriber), selectedSegment));
    }
  }, [selectedPreset.label, selectedSegment.value, selectedSubscriber, title]);

  const setPublishParams = (nextPreset: QuickPublishPreset, nextSegment: string, mode = publishMode) => {
    const next: Record<string, string> = { preset: nextPreset, segment: nextSegment, mode };
    if (subscriberId) next.subscriber = String(subscriberId);
    const ids = sanitizeMediaIdList(mediaIds);
    if (ids.length) next.mediaIds = ids.join(',');
    setSearchParams(next, { replace: true });
  };

  const handleModeChange = (_: React.SyntheticEvent, next: PublishMode) => {
    setPublishMode(next);
    const nextParams: Record<string, string> = { mode: next };
    if (preset) nextParams.preset = preset;
    if (segment) nextParams.segment = segment;
    if (subscriberId) nextParams.subscriber = String(subscriberId);
    const ids = sanitizeMediaIdList(mediaIds);
    if (ids.length) nextParams.mediaIds = ids.join(',');
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    const urlMode = resolvePublishMode(searchParams.get('mode'));
    if (urlMode !== publishMode) setPublishMode(urlMode);
  }, [searchParams, publishMode]);

  const handleCreateMediaGenerated = useCallback(
    async (mediaId: number) => {
      if (!subscriberId) return;
      const id = Number(mediaId);
      if (!Number.isInteger(id) || id <= 0) return;
      await loadApprovedMedias(Number(subscriberId));
      setMediaIds([id]);
      setSuccess('Conteúdo gerado — revise as telas e publique abaixo.');
    },
    [loadApprovedMedias, subscriberId]
  );

  const handleSelectPreset = (template: typeof selectedPreset) => {
    setPreset(template.value);
    setDurationMs(template.recommendedDurationMs);
    setPortraitAfterUpload(template.preferredOrientation === 'portrait');
    setTitle(buildTemplateTitle(template, getSubscriberName(selectedSubscriber), selectedSegment));
    setDescription(buildTemplateDescription(template, selectedSegment));
    setPublishParams(template.value, segment);
  };

  const handleSelectSegment = (nextSegment: string) => {
    const segmentOption = findPublishSegment(nextSegment);
    const shouldUseSegmentPreset = !searchParams.get('preset') || preset === selectedSegment.defaultPreset;
    const nextPreset = shouldUseSegmentPreset ? segmentOption.defaultPreset : preset;
    const template = findPublishPreset(nextPreset);

    setSegment(nextSegment);
    setPreset(nextPreset);
    setDurationMs(template.recommendedDurationMs);
    setTitle(buildTemplateTitle(template, getSubscriberName(selectedSubscriber), segmentOption));
    setDescription(buildTemplateDescription(template, segmentOption));
    setPublishParams(nextPreset, nextSegment);
  };

  const handlePublish = async () => {
    if (publishInFlightRef.current || publishing) return;

    const publishMediaIds = sanitizeMediaIdList(mediaIds);
    if (!subscriberId || !contractId || totemIds.length === 0 || publishMediaIds.length === 0 || !title.trim()) {
      setError('Preencha cliente, contrato, tela, mídia válida e título antes de publicar.');
      return;
    }

    publishInFlightRef.current = true;
    try {
      setPublishing(true);
      setError(null);
      setSuccess(null);
      setPartialRegenWarning(null);
      const result = await quickPublishApi.publish({
        subscriberId: Number(subscriberId),
        contractId: Number(contractId),
        totemIds,
        mediaIds: publishMediaIds,
        preset,
        title: title.trim(),
        description: description.trim() || undefined,
        publishNow: true,
        durationMs,
      });

      setSuccess(
        result.message || 'Conteúdo publicado com sucesso nas telas selecionadas.'
      );
      if (result.partialRegeneration) {
        const failed = result.failedTotemIds?.length
          ? ` Telas não atualizadas: ${result.failedTotemIds.join(', ')}.`
          : '';
        setPartialRegenWarning(
          `A publicação foi criada, mas nem todas as telas atualizaram a playlist automaticamente.${failed}`
        );
      }
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao publicar conteúdo.'));
    } finally {
      publishInFlightRef.current = false;
      setPublishing(false);
    }
  };

  const handleUploadMedia = async () => {
    if (!subscriberId) {
      setError('Selecione um anunciante antes de enviar mídia.');
      return;
    }
    if (!uploadFile) {
      setError('Selecione um arquivo para enviar.');
      return;
    }

    try {
      setUploadingMedia(true);
      setError(null);
      setSuccess(null);

      const planCheck = await subscriberApi.validatePlanLimits(Number(subscriberId), 'media');
      if (!planCheck.valid) {
        setError(planCheck.message || 'Limite de mídias do plano atingido.');
        return;
      }

      const storageCheck = await subscriberApi.validateStorage(Number(subscriberId), uploadFile.size);
      if (!storageCheck.valid) {
        setError(storageCheck.message || 'Limite de armazenamento excedido para este envio.');
        return;
      }

      const uploaded = await mediaApi.upload(uploadFile, {
        name: uploadName.trim() || uploadFile.name.replace(/\.[^.]+$/, ''),
        description: `Enviado pelo fluxo Publicar em Tela (${selectedPreset.label})`,
        tags: ['quick-publish', preset],
        subscriberId: Number(subscriberId),
      });

      const mediaId = resolveMediaId(uploaded);
      if (!mediaId) {
        setError('Upload concluído, mas o servidor não retornou o ID da mídia. Atualize a lista e selecione manualmente.');
        return;
      }
      let workingMedia: MediaItem = uploaded;
      let portraitWarning: string | null = null;

      const wantPortrait =
        portraitAfterUpload &&
        mediaId > 0 &&
        (uploadFile.type.startsWith('image/') || uploadFile.type.startsWith('video/'));

      if (wantPortrait) {
        try {
          workingMedia = await mediaApi.transformToPortrait(mediaId, {
            rotationDegrees: 0,
            fit: '9:16',
          });
        } catch (transformErr) {
          portraitWarning = pickApiErrorMessage(
            transformErr,
            'ajuste 9:16 indisponível; tente em Mídias.'
          );
        }
      }

      const approvedMedias = await loadApprovedMedias(Number(subscriberId));
      const resolvedId = resolveMediaId(workingMedia) ?? mediaId;
      const normalizedWorking = { ...workingMedia, media_id: resolvedId, id: resolvedId };
      setMedias((prev) => {
        if (prev.some((item) => resolveMediaId(item) === resolvedId)) return prev;
        return [...prev, normalizedWorking as MediaItem];
      });
      if (isApprovedMedia(workingMedia)) {
        setMediaIds((prev) => sanitizeMediaIdList([...prev, resolvedId]));
        setSuccess(
          portraitWarning
            ? `Mídia enviada e selecionada. Aviso 9:16: ${portraitWarning}`
            : wantPortrait && !portraitWarning
              ? 'Mídia enviada, ajustada a 9:16 e selecionada para publicação.'
              : 'Mídia enviada e selecionada para publicação.'
        );
      } else {
        const foundUploaded = approvedMedias.find(
          (media) => resolveMediaId(media) === resolvedId
        );
        if (foundUploaded) {
          const foundId = resolveMediaId(foundUploaded);
          if (foundId) setMediaIds((prev) => sanitizeMediaIdList([...prev, foundId]));
          setSuccess(
            portraitWarning
              ? `Mídia enviada e selecionada. Aviso 9:16: ${portraitWarning}`
              : wantPortrait && !portraitWarning
                ? 'Mídia enviada, ajustada a 9:16 e selecionada para publicação.'
                : 'Mídia enviada e selecionada para publicação.'
          );
        } else {
          setSuccess(
            portraitWarning
              ? `Mídia enviada. ${portraitWarning} Ficará disponível após aprovação.`
              : 'Mídia enviada. Ela ficará disponível para publicação assim que estiver aprovada.'
          );
        }
      }
      setUploadFile(null);
      setUploadName('');
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao enviar mídia.'));
    } finally {
      setUploadingMedia(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <PageHeader
        title="Publicar em Tela"
        subtitle="Modo Rápido: envie arquivo pronto. Modo Criar: monte animação HTML com textos e IA."
        breadcrumbs={breadcrumbs}
        actions={[
          {
            label: 'Recarregar',
            icon: <Refresh />,
            onClick: loadSubscribers,
            variant: 'outlined',
          },
        ]}
        loading={loadingInitial || loadingDetails || publishing || uploadingMedia}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircle />} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {partialRegenWarning && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setPartialRegenWarning(null)}>
          {partialRegenWarning}
        </Alert>
      )}
      {billingGraceWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Este anunciante tem prestações vencidas, mas ainda está dentro da tolerância configurada em{' '}
          <Button component={RouterLink} to="/settings" size="small" sx={{ ml: 0.5, verticalAlign: 'baseline' }}>
            Configurações → Financeiro
          </Button>
          . A publicação será bloqueada automaticamente após o prazo de dias de atraso.
        </Alert>
      )}
      {billingBlocksPublish && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Publicação bloqueada: tolerância de inadimplência excedida. Regularize em{' '}
          <Button
            component={RouterLink}
            to={`/billing?type=subscriber&view=invoices&dueFilter=overdue&subscriberId=${subscriberId}`}
            size="small"
            sx={{ ml: 0.5, verticalAlign: 'baseline' }}
          >
            Faturamento
          </Button>
          {' '}antes de publicar na tela.
        </Alert>
      )}

      {!loadingInitial && subscribers.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nenhum anunciante ativo encontrado.{' '}
          <Button component={RouterLink} to="/subscribers" size="small" sx={{ ml: 0.5 }}>
            Cadastrar anunciante
          </Button>
        </Alert>
      )}

      {subscriberId && !loadingDetails && contracts.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Este anunciante não possui contrato ativo.{' '}
          <Button component={RouterLink} to="/subscriber-contracts" size="small" sx={{ ml: 0.5 }}>
            Gerir contratos
          </Button>
        </Alert>
      )}

      <Tabs value={publishMode} onChange={handleModeChange} sx={{ mb: 2 }}>
        <Tab icon={<FlashOn />} iconPosition="start" label="Rápido" value="quick" />
        <Tab icon={<AutoAwesome />} iconPosition="start" label="Criar" value="create" />
      </Tabs>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
            {STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Anunciante</InputLabel>
                <Select
                  value={subscriberId === '' ? '' : String(subscriberId)}
                  label="Anunciante"
                  onChange={(e) => setSubscriberId(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={loadingInitial || publishing}
                >
                  {subscribers.map((subscriber) => (
                    <MenuItem key={subscriber.subscriber_id} value={String(subscriber.subscriber_id)}>
                      {subscriber.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" disabled={!subscriberId || loadingDetails || publishing}>
                <InputLabel>Contrato ativo</InputLabel>
                <Select
                  value={contractId === '' ? '' : String(contractId)}
                  label="Contrato ativo"
                  onChange={(e) => {
                    autoTotemSelectionContractRef.current = null;
                    setTotemIds([]);
                    setContractId(e.target.value === '' ? '' : Number(e.target.value));
                  }}
                >
                  {contracts.map((contract) => (
                    <MenuItem key={contract.contract_id} value={String(contract.contract_id)}>
                      {getContractLabel(contract)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              {loadingDetails && contractId ? <LinearProgress sx={{ mb: 1 }} /> : null}
              {contractId && eligibleTotemIds.length > 0 && (
                <FormControlLabel
                  sx={{ mb: 1, display: 'flex', alignItems: 'center' }}
                  control={
                    <Switch
                      checked={allTotemsSelected}
                      disabled={loadingDetails || publishing}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (contractId) {
                          autoTotemSelectionContractRef.current = Number(contractId);
                        }
                        setTotemIds(checked ? [...eligibleTotemIds] : []);
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
                size="small"
                sx={{
                  '& .MuiAutocomplete-inputRoot': {
                    alignItems: 'flex-start',
                    py: 1,
                  },
                  '& .MuiAutocomplete-tag': {
                    my: 0.25,
                  },
                }}
                options={totems}
                getOptionLabel={(option) => campaignTotemOptionLabel(option)}
                isOptionEqualToValue={(option, value) =>
                  getTotemIdFromRow(option) === getTotemIdFromRow(value)
                }
                value={totems.filter((totem) => {
                  const id = getTotemIdFromRow(totem);
                  return id !== undefined && totemIds.includes(id);
                })}
                onChange={(_, newValue, reason, details) => {
                  if (contractId) {
                    autoTotemSelectionContractRef.current = Number(contractId);
                  }
                  let nextIds: number[];
                  if (reason === 'selectOption' && details?.option) {
                    const clickedId = getTotemIdFromRow(details.option);
                    if (clickedId === undefined) return;
                    nextIds = totemIds.includes(clickedId)
                      ? totemIds.filter((id) => id !== clickedId)
                      : [...totemIds, clickedId];
                  } else {
                    nextIds = newValue
                      .map((totem) => getTotemIdFromRow(totem))
                      .filter((id): id is number => id !== undefined);
                  }
                  setTotemIds(nextIds);
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
                  const id = getTotemIdFromRow(option);
                  return (
                    <Box
                      component="li"
                      key={key ?? id}
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
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="body2">{campaignTotemOptionLabel(option)}</Typography>
                        {option.status ? (
                          <Typography variant="caption" color="text.secondary">
                            {option.status}
                          </Typography>
                        ) : null}
                      </Box>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Telas/Totens (Onde o conteúdo será exibido)"
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    helperText={
                      !contractId
                        ? 'Selecione um contrato ativo para listar os totens elegíveis.'
                        : eligibleTotemIds.length === 0
                          ? 'Nenhum totem elegível para este contrato.'
                          : allTotemsSelected
                            ? 'Todos os totens elegíveis do contrato estão selecionados (padrão). Desmarque «Selecionar todos» ou retire totens para limitar.'
                            : 'Selecione uma ou mais telas/totens onde o conteúdo será exibido.'
                    }
                  />
                )}
                disabled={!contractId || loadingDetails || publishing || totems.length === 0}
                noOptionsText="Nenhum totem elegível para este contrato."
              />
            </Grid>

            {publishMode === 'quick' && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" disabled={publishing}>
                <InputLabel>Segmento comercial</InputLabel>
                <Select
                  value={segment}
                  label="Segmento comercial"
                  onChange={(e) => handleSelectSegment(String(e.target.value))}
                >
                  {PUBLISH_SEGMENTS.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      <ListItemText primary={item.label} secondary={item.description} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            )}

            {publishMode === 'quick' && (
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Template visual inteligente
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Escolha o segmento e o modelo para preencher automaticamente título, descrição, linguagem visual e duração recomendada.
              </Typography>
              <Grid container spacing={2}>
                {publishPresets.map((item) => {
                  const selected = item.value === preset;
                  return (
                    <Grid item xs={12} sm={6} md={2.4} key={item.value}>
                      <Card
                        variant="outlined"
                        onClick={() => {
                          if (!publishing) handleSelectPreset(item);
                        }}
                        sx={{
                          height: '100%',
                          cursor: publishing ? 'not-allowed' : 'pointer',
                          opacity: publishing ? 0.6 : 1,
                          borderColor: selected ? item.accentColor : 'divider',
                          borderWidth: selected ? 2 : 1,
                          transition: 'border-color 160ms ease, transform 160ms ease',
                          '&:hover': {
                            transform: publishing ? 'none' : 'translateY(-2px)',
                            borderColor: item.accentColor,
                          },
                        }}
                      >
                        <Box sx={{ height: 92, p: 1.5, color: '#fff', background: item.background }}>
                          <Chip
                            size="small"
                            label={item.premium ? 'Premium' : item.badge}
                            sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700 }}
                          />
                          <Typography variant="subtitle2" sx={{ mt: 1.2, fontWeight: 800 }}>
                            {item.headline}
                          </Typography>
                        </Box>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', minHeight: 34 }}>
                            {item.description}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${Math.round(item.recommendedDurationMs / 1000)}s`}
                            variant={selected ? 'filled' : 'outlined'}
                            sx={{ mt: 1, bgcolor: selected ? item.accentColor : undefined, color: selected ? '#fff' : undefined }}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Grid>
            )}

            {publishMode === 'create' && !subscriberId && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Selecione um anunciante acima para montar a animação HTML e publicar na tela.
                </Alert>
              </Grid>
            )}

            {publishMode === 'create' && subscriberId && (
              <Grid item xs={12}>
                <CreatePublishPanel
                  subscriberId={Number(subscriberId)}
                  segment={segment}
                  preset={preset}
                  onPresetChange={(next) => {
                    const tpl = findPublishPreset(next);
                    setPreset(next);
                    setDurationMs(tpl.recommendedDurationMs);
                    setPublishParams(next, segment, 'create');
                  }}
                  onSegmentChange={handleSelectSegment}
                  onMediaGenerated={handleCreateMediaGenerated}
                  onTitleSuggestion={(t) => setTitle(t)}
                  disabled={publishing || loadingDetails}
                  autoPublishReady={autoPublishReady}
                  autoPublishContext={autoPublishContext}
                  onAutoPublished={async ({ mediaId, message }) => {
                    if (!subscriberId) return;
                    await loadApprovedMedias(Number(subscriberId));
                    setMediaIds([mediaId]);
                    setSuccess(message);
                    setPartialRegenWarning(null);
                    setError(null);
                  }}
                  replaceMediaId={replacePublishBoardMediaId}
                />
              </Grid>
            )}

            {publishMode === 'quick' && (
            <>
            <Grid item xs={12} md={7}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>{selectedPreset.label}:</strong> {selectedPreset.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                  {selectedPreset.bullets.map((bullet) => (
                    <Chip key={bullet} size="small" label={bullet} variant="outlined" />
                  ))}
                  {selectedSegment.bullets.map((bullet) => (
                    <Chip key={bullet} size="small" label={bullet} color="primary" variant="outlined" />
                  ))}
                </Box>
              </Alert>
            </Grid>

            <Grid item xs={12} md={5}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  minHeight: 180,
                  color: '#fff',
                  background: selectedPreset.background,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <CardContent>
                  <Chip
                    size="small"
                    label={`Prévia 9:16 - ${selectedSegment.shortLabel}`}
                    sx={{ bgcolor: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, mb: 2 }}
                  />
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {title.trim() || buildTemplateTitle(selectedPreset, getSubscriberName(selectedSubscriber), selectedSegment) || selectedPreset.headline}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.82)' }}>
                    {selectedPreset.headline}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'rgba(255,255,255,0.72)' }}>
                    {selectedSegment.visualLanguage}
                  </Typography>
                  <Box sx={{ mt: 3, borderTop: '1px solid rgba(255,255,255,0.2)', pt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.78)' }}>
                      {selectedMediaNames.length || 0} mídia(s) • {selectedTotemNames.length || 0} tela(s)
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    Enviar nova mídia
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Use esta opção para trazer uma arte ou vídeo direto para o fluxo de publicação.
                  </Typography>
                  <FormControlLabel
                    sx={{ mb: 1, alignItems: 'flex-start' }}
                    control={
                      <Checkbox
                        checked={portraitAfterUpload}
                        onChange={(e) => setPortraitAfterUpload(e.target.checked)}
                        disabled={uploadingMedia || publishing}
                      />
                    }
                    label="Após enviar, ajustar imagem ou vídeo ao formato vertical 9:16 (recorte central; requer ffmpeg no servidor para vídeo)"
                  />
                  {uploadingMedia && <LinearProgress sx={{ mb: 2 }} />}
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={5}>
                      <Button
                        component="label"
                        variant="outlined"
                        startIcon={<CloudUpload />}
                        fullWidth
                        disabled={!subscriberId || uploadingMedia || publishing}
                      >
                        {uploadFile ? uploadFile.name : 'Selecionar arquivo'}
                        <input
                          hidden
                          type="file"
                          accept="image/*,video/*,audio/*,application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setUploadFile(file);
                            setUploadName(file ? file.name.replace(/\.[^.]+$/, '') : '');
                            e.target.value = '';
                          }}
                        />
                      </Button>
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Nome da mídia"
                        value={uploadName}
                        disabled={!uploadFile || uploadingMedia || publishing}
                        onChange={(e) => setUploadName(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleUploadMedia}
                        disabled={!subscriberId || !uploadFile || uploadingMedia || publishing}
                      >
                        Enviar
                      </Button>
                    </Grid>
                    {uploadPreviewUrl && uploadFile && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Pré-visualização do arquivo (antes do envio)
                        </Typography>
                        <Box
                          sx={{
                            maxHeight: 140,
                            maxWidth: 360,
                            mx: 'auto',
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: 'action.hover',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {uploadFile.type.startsWith('video/') ? (
                            <Box
                              component="video"
                              src={uploadPreviewUrl}
                              controls
                              muted
                              playsInline
                              sx={{ maxWidth: '100%', maxHeight: 130 }}
                            />
                          ) : uploadFile.type.startsWith('image/') ? (
                            <Box
                              component="img"
                              src={uploadPreviewUrl}
                              alt={uploadFile.name}
                              sx={{ maxWidth: '100%', maxHeight: 130, objectFit: 'contain' }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                              Pré-visualização não disponível para este tipo de ficheiro. O envio continua válido.
                            </Typography>
                          )}
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
            </>
            )}

            <Grid item xs={12} md={8}>
              <FormControl fullWidth size="small" disabled={!subscriberId || loadingDetails || publishing}>
                <InputLabel>Mídias aprovadas</InputLabel>
                <Select
                  multiple
                  value={safeMediaIds.map(String)}
                  label="Mídias aprovadas"
                  onChange={(e) => {
                    const value = e.target.value;
                    const values = Array.isArray(value) ? value : String(value).split(',');
                    setMediaIds(values.map(Number).filter((item) => Number.isInteger(item) && item > 0));
                  }}
                  renderValue={() => selectedMediaNames.join(', ')}
                >
                  {medias.map((media) => {
                    const mid = resolveMediaId(media);
                    if (!mid) return null;
                    return (
                    <MenuItem key={mid} value={String(mid)}>
                      <Checkbox checked={safeMediaIds.includes(resolveMediaId(media) ?? -1)} />
                      <ListItemText primary={getMediaLabel(media)} secondary={media.subscriberName} />
                    </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
              {subscriberId && medias.length === 0 && !loadingDetails && (
                <Typography variant="caption" color="text.secondary">
                  Nenhuma mídia aprovada encontrada para este anunciante.
                </Typography>
              )}
            </Grid>

            {safeMediaIds.length > 0 && (
              <Grid item xs={12}>
                <Card variant="outlined" sx={{ borderColor: 'success.light' }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                      Pré-visualização da mídia selecionada
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Confira o conteúdo que será publicado nas telas escolhidas.
                    </Typography>
                    {loadingSelectedMediaPreview && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <CircularProgress size={18} />
                        <Typography variant="caption" color="text.secondary">
                          Carregando pré-visualização...
                        </Typography>
                      </Box>
                    )}
                    <Grid container spacing={2}>
                      {selectedMedias.map((media) => {
                        const mediaId = resolveMediaId(media);
                        const previewSrc = getSelectedMediaPreviewSrc(media);
                        const htmlDoc = getSelectedMediaHtmlDoc(media);
                        const mediaType = String(media.media_type || '').toLowerCase();
                        const isVideo = mediaType === 'video';
                        return (
                          <Grid item xs={12} sm={6} md={3} key={mediaId ?? media.name}>
                            <Box
                              sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                overflow: 'hidden',
                                bgcolor: 'action.hover',
                                maxWidth: 220,
                              }}
                            >
                              <Box
                                sx={{
                                  position: 'relative',
                                  minHeight: 100,
                                  maxHeight: 140,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {htmlDoc ? (
                                  <Box
                                    component="iframe"
                                    title={`preview-${mediaId}`}
                                    srcDoc={htmlDoc}
                                    sandbox="allow-scripts"
                                    sx={{ width: '100%', height: 140, border: 0, bgcolor: '#000' }}
                                  />
                                ) : previewSrc && isVideo ? (
                                  <>
                                    <Box
                                      component="img"
                                      src={previewSrc}
                                      alt={media.name}
                                      sx={{ width: '100%', maxHeight: 140, objectFit: 'contain' }}
                                    />
                                    <PlayCircleOutline
                                      sx={{
                                        position: 'absolute',
                                        fontSize: 36,
                                        color: 'rgba(255,255,255,0.92)',
                                        filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
                                      }}
                                    />
                                  </>
                                ) : previewSrc ? (
                                  <Box
                                    component="img"
                                    src={previewSrc}
                                    alt={media.name}
                                    sx={{ width: '100%', maxHeight: 140, objectFit: 'contain' }}
                                  />
                                ) : (
                                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                                    Pré-visualização indisponível para {getMediaLabel(media)}.
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {media.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {getMediaLabel(media)}
                                </Typography>
                              </Box>
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Duração por imagem (segundos)"
                value={Math.round(durationMs / 1000)}
                inputProps={{ min: 1, max: 300 }}
                disabled={publishing}
                onChange={(e) => setDurationMs(Math.max(1000, Math.min(300000, Number(e.target.value || 10) * 1000)))}
                helperText="Vídeos usam a duração do arquivo."
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Título da publicação"
                value={title}
                disabled={publishing}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Descrição"
                value={description}
                disabled={publishing}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Resumo da publicação
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Typography variant="caption" color="text.secondary">Cliente</Typography>
              <Typography variant="body2">{selectedSubscriber?.name || '-'}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Typography variant="caption" color="text.secondary">Segmento</Typography>
              <Typography variant="body2">{selectedSegment.shortLabel}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Typography variant="caption" color="text.secondary">Preset</Typography>
              <Typography variant="body2">{selectedPreset.label}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Typography variant="caption" color="text.secondary">Telas</Typography>
              <Typography variant="body2">{totemIds.length}</Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Typography variant="caption" color="text.secondary">Mídias</Typography>
              <Typography variant="body2">{safeMediaIds.length}</Typography>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {selectedTotemNames.map((name) => (
              <Chip key={name} label={name} size="small" color="success" variant="outlined" />
            ))}
            {selectedMediaNames.map((name) => (
              <Chip key={name} label={name} size="small" color="success" variant="outlined" />
            ))}
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={publishing ? <CircularProgress size={18} color="inherit" /> : <Send />}
            disabled={!canPublish || publishing}
            onClick={handlePublish}
          >
            {publishing ? 'Publicando...' : 'Publicar agora'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default QuickPublish;
