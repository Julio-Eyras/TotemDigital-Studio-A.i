import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
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
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { AutoAwesome, CheckCircle, CloudUpload, FlashOn, Refresh, Send } from '@mui/icons-material';
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
  subscriberApi,
  Subscriber,
} from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { resolveMediaId, sanitizeMediaIdList } from '../../utils/mediaId';
import {
  PUBLISH_SEGMENTS,
  buildTemplateDescription,
  buildTemplateTitle,
  findPublishPreset,
  findPublishSegment,
  resolvePublishPreset,
} from '../../config/publishTemplates';
import { usePublishTemplatesFromApi } from '../../hooks/usePublishTemplatesFromApi';

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

function getTotemLabel(totem: Player | any): string {
  const name = String(totem.name || '').trim();
  const identifier = String(totem.identifier || '').trim();
  const local = String(totem.local_name || totem.localName || '').trim();
  return [name || identifier || `Totem ${totem.totem_id}`, local].filter(Boolean).join(' - ');
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

const QuickPublish: React.FC = () => {
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

  const selectedMediaNames = useMemo(
    () =>
      medias
        .filter((media) => {
          const id = resolveMediaId(media);
          return id != null && safeMediaIds.includes(id);
        })
        .map((media) => media.name),
    [safeMediaIds, medias]
  );

  const selectedTotemNames = useMemo(
    () => totems.filter((totem) => totemIds.includes(totem.totem_id)).map(getTotemLabel),
    [totemIds, totems]
  );

  const canPublish = Boolean(
    subscriberId && contractId && totemIds.length > 0 && safeMediaIds.length > 0 && title.trim()
  );

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
      return;
    }

    const loadSubscriberDetails = async () => {
      try {
        setLoadingDetails(true);
        setError(null);
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
        if (validMedia.length > 0) {
          setSuccess('Mídia do cardápio carregada — selecione contrato e telas para publicar.');
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

  useEffect(() => {
    if (!title.trim() && selectedSubscriber) {
      setTitle(buildTemplateTitle(selectedPreset, getSubscriberName(selectedSubscriber), selectedSegment));
    }
  }, [selectedPreset.label, selectedSegment.value, selectedSubscriber, title]);

  const setPublishParams = (nextPreset: QuickPublishPreset, nextSegment: string, mode = publishMode) => {
    const next: Record<string, string> = { preset: nextPreset, segment: nextSegment, mode };
    if (subscriberId) next.subscriber = String(subscriberId);
    setSearchParams(next, { replace: true });
  };

  const handleModeChange = (_: React.SyntheticEvent, next: PublishMode) => {
    setPublishMode(next);
    const nextParams: Record<string, string> = { mode: next };
    if (preset) nextParams.preset = preset;
    if (segment) nextParams.segment = segment;
    if (subscriberId) nextParams.subscriber = String(subscriberId);
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
                  onChange={(e) => setContractId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  {contracts.map((contract) => (
                    <MenuItem key={contract.contract_id} value={String(contract.contract_id)}>
                      {getContractLabel(contract)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" disabled={!contractId || loadingDetails || publishing}>
                <InputLabel>Telas/Totens</InputLabel>
                <Select
                  multiple
                  value={totemIds.map(String)}
                  label="Telas/Totens"
                  onChange={(e) => {
                    const value = e.target.value;
                    const values = Array.isArray(value) ? value : String(value).split(',');
                    setTotemIds(values.map(Number).filter((item) => Number.isInteger(item) && item > 0));
                  }}
                  renderValue={() => selectedTotemNames.join(', ')}
                >
                  {totems.map((totem) => (
                    <MenuItem key={totem.totem_id} value={String(totem.totem_id)}>
                      <Checkbox checked={totemIds.includes(totem.totem_id)} />
                      <ListItemText primary={getTotemLabel(totem)} secondary={totem.status} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                  disabled={publishing}
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
                            maxHeight: 280,
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
                              sx={{ maxWidth: '100%', maxHeight: 260 }}
                            />
                          ) : uploadFile.type.startsWith('image/') ? (
                            <Box
                              component="img"
                              src={uploadPreviewUrl}
                              alt={uploadFile.name}
                              sx={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain' }}
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
              <Chip key={name} label={name} size="small" color="primary" variant="outlined" />
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
