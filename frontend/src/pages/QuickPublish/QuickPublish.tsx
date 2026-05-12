import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Grid,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircle, CloudUpload, Refresh, Send } from '@mui/icons-material';
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

interface PresetOption {
  value: QuickPublishPreset;
  label: string;
  description: string;
  headline: string;
  badge: string;
  accentColor: string;
  background: string;
  recommendedDurationMs: number;
  titleSuffix: string;
  descriptionTemplate: string;
  bullets: string[];
  premium?: boolean;
}

interface SegmentOption {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
  visualLanguage: string;
  defaultPreset: QuickPublishPreset;
  bullets: string[];
}

const PRESETS: PresetOption[] = [
  {
    value: 'menu',
    label: 'Cardápio Digital',
    description: 'Para cardápios, preços e ofertas do dia.',
    headline: 'Cardápio pronto para vender',
    badge: 'Restaurante',
    accentColor: '#ff9800',
    background: 'linear-gradient(135deg, #2b1400 0%, #7a3a00 100%)',
    recommendedDurationMs: 12000,
    titleSuffix: 'Cardápio do dia',
    descriptionTemplate: 'Template de cardápio digital com foco em leitura rápida, preços claros e chamada para pedido.',
    bullets: ['Preços e combos', 'Visual vertical 9:16', 'Ideal para balcão e salão'],
    premium: true,
  },
  {
    value: 'promotion',
    label: 'Promoção',
    description: 'Para ofertas rápidas e chamadas comerciais.',
    headline: 'Oferta em destaque',
    badge: 'Venda rápida',
    accentColor: '#e91e63',
    background: 'linear-gradient(135deg, #2a0010 0%, #b0003a 100%)',
    recommendedDurationMs: 8000,
    titleSuffix: 'Promoção especial',
    descriptionTemplate: 'Template promocional para destacar oferta, preço e urgência de compra.',
    bullets: ['Chamada forte', 'Preço em evidência', 'Campanhas curtas'],
    premium: true,
  },
  {
    value: 'ad',
    label: 'Anúncio',
    description: 'Para mídia indoor e anúncios em tela cheia.',
    headline: 'Anúncio de impacto',
    badge: 'Indoor mídia',
    accentColor: '#1976d2',
    background: 'linear-gradient(135deg, #001a33 0%, #0d47a1 100%)',
    recommendedDurationMs: 10000,
    titleSuffix: 'Anúncio em tela',
    descriptionTemplate: 'Template padrão para anúncio em tela cheia com mídia principal e mensagem objetiva.',
    bullets: ['Tela cheia', 'Marca em destaque', 'Uso geral'],
  },
  {
    value: 'announcement',
    label: 'Comunicado',
    description: 'Para avisos, eventos e informações locais.',
    headline: 'Aviso claro na tela',
    badge: 'Comunicado',
    accentColor: '#7b1fa2',
    background: 'linear-gradient(135deg, #160021 0%, #6a1b9a 100%)',
    recommendedDurationMs: 9000,
    titleSuffix: 'Comunicado importante',
    descriptionTemplate: 'Template para comunicação local com mensagem direta e leitura confortável à distância.',
    bullets: ['Informação direta', 'Eventos e avisos', 'Boa legibilidade'],
  },
  {
    value: 'institutional',
    label: 'Institucional',
    description: 'Para conteúdo fixo de marca ou ambiente.',
    headline: 'Presença de marca',
    badge: 'Marca',
    accentColor: '#2e7d32',
    background: 'linear-gradient(135deg, #001f12 0%, #1b5e20 100%)',
    recommendedDurationMs: 15000,
    titleSuffix: 'Institucional',
    descriptionTemplate: 'Template institucional para reforçar marca, serviços e presença no ambiente.',
    bullets: ['Marca e confiança', 'Conteúdo perene', 'Ambiente premium'],
  },
];

const SEGMENTS: SegmentOption[] = [
  {
    value: 'restaurant',
    label: 'Restaurante / Lancheria',
    shortLabel: 'Restaurante',
    description: 'Cardápios, combos, promoções e chamadas para pedido.',
    visualLanguage: 'preços legíveis, fotos apetitosas, contraste forte e leitura rápida no balcão.',
    defaultPreset: 'menu',
    bullets: ['Cardápio', 'Combos', 'Preço em destaque'],
  },
  {
    value: 'retail',
    label: 'Loja / Varejo',
    shortLabel: 'Varejo',
    description: 'Ofertas, vitrines digitais e anúncios de produto.',
    visualLanguage: 'mensagem direta, urgência comercial e destaque para produto ou marca.',
    defaultPreset: 'promotion',
    bullets: ['Oferta', 'Vitrine', 'Chamada rápida'],
  },
  {
    value: 'church',
    label: 'Igreja / Evento',
    shortLabel: 'Evento',
    description: 'Avisos, agenda, eventos e comunicação com a comunidade.',
    visualLanguage: 'comunicados claros, clima acolhedor e boa leitura à distância.',
    defaultPreset: 'announcement',
    bullets: ['Avisos', 'Agenda', 'Comunidade'],
  },
  {
    value: 'health',
    label: 'Clínica / Saúde',
    shortLabel: 'Clínica',
    description: 'Orientações, serviços, campanhas preventivas e avisos de recepção.',
    visualLanguage: 'tom confiável, visual limpo, informação objetiva e sensação de cuidado.',
    defaultPreset: 'institutional',
    bullets: ['Recepção', 'Orientações', 'Confiança'],
  },
  {
    value: 'hotel',
    label: 'Hotel / Recepção',
    shortLabel: 'Hotel',
    description: 'Boas-vindas, serviços, eventos internos e comunicação institucional.',
    visualLanguage: 'aparência premium, mensagens elegantes e foco em experiência do visitante.',
    defaultPreset: 'institutional',
    bullets: ['Boas-vindas', 'Serviços', 'Premium'],
  },
  {
    value: 'gym',
    label: 'Academia',
    shortLabel: 'Academia',
    description: 'Planos, aulas, desafios, motivação e campanhas de retenção.',
    visualLanguage: 'energia visual, ritmo forte, chamadas motivacionais e movimento.',
    defaultPreset: 'ad',
    bullets: ['Energia', 'Aulas', 'Planos'],
  },
];

const STEPS = ['Cliente', 'Tela', 'Conteúdo', 'Publicar'];

function resolvePreset(value: string | null): QuickPublishPreset {
  return PRESETS.some((item) => item.value === value) ? (value as QuickPublishPreset) : 'ad';
}

function findPresetOption(value: QuickPublishPreset): PresetOption {
  return PRESETS.find((item) => item.value === value) || PRESETS[2];
}

function resolveSegment(value: string | null): string {
  return SEGMENTS.some((item) => item.value === value) ? String(value) : SEGMENTS[0].value;
}

function findSegmentOption(value: string): SegmentOption {
  return SEGMENTS.find((item) => item.value === value) || SEGMENTS[0];
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
  return String(media.status || '').toLowerCase() === 'approved'
    && String(media.approvalStatus || '').toLowerCase() === 'approved';
}

function buildTemplateTitle(template: PresetOption, subscriber?: Subscriber | null, segment?: SegmentOption): string {
  const subscriberName = getSubscriberName(subscriber);
  return [template.titleSuffix, segment?.shortLabel, subscriberName].filter(Boolean).join(' - ');
}

function buildTemplateDescription(template: PresetOption, segment?: SegmentOption): string {
  const segmentGuidance = segment
    ? ` Segmento: ${segment.label}. Linguagem visual: ${segment.visualLanguage}`
    : '';
  return `${template.descriptionTemplate} Direção visual: ${template.headline}.${segmentGuidance}`;
}

const QuickPublish: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSegment = resolveSegment(searchParams.get('segment'));
  const initialSegmentOption = findSegmentOption(initialSegment);
  const initialPreset = searchParams.get('preset')
    ? resolvePreset(searchParams.get('preset'))
    : initialSegmentOption.defaultPreset;
  const initialPresetOption = findPresetOption(initialPreset);
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
  const [uploadName, setUploadName] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedSubscriber = useMemo(
    () => subscribers.find((subscriber) => subscriber.subscriber_id === subscriberId) || null,
    [subscriberId, subscribers]
  );

  const selectedPreset = useMemo(
    () => findPresetOption(preset),
    [preset]
  );

  const selectedSegment = useMemo(
    () => findSegmentOption(segment),
    [segment]
  );

  const activeStep = useMemo(() => {
    if (!subscriberId || !contractId) return 0;
    if (totemIds.length === 0) return 1;
    if (mediaIds.length === 0 || !title.trim()) return 2;
    return 3;
  }, [contractId, mediaIds.length, subscriberId, title, totemIds.length]);

  const selectedMediaNames = useMemo(
    () => medias.filter((media) => mediaIds.includes(media.media_id)).map((media) => media.name),
    [mediaIds, medias]
  );

  const selectedTotemNames = useMemo(
    () => totems.filter((totem) => totemIds.includes(totem.totem_id)).map(getTotemLabel),
    [totemIds, totems]
  );

  const canPublish = Boolean(subscriberId && contractId && totemIds.length > 0 && mediaIds.length > 0 && title.trim());

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
    const urlSegment = resolveSegment(searchParams.get('segment'));
    const segmentOption = findSegmentOption(urlSegment);
    const urlPreset = searchParams.get('preset')
      ? resolvePreset(searchParams.get('preset'))
      : segmentOption.defaultPreset;

    if (urlPreset === preset && urlSegment === segment) {
      return;
    }

    const template = findPresetOption(urlPreset);
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
        setMediaIds([]);
        const [contractsResult] = await Promise.all([
          subscriberApi.getContracts(Number(subscriberId), { activeOnly: true }),
          loadApprovedMedias(Number(subscriberId)),
        ]);
        const activeContracts = Array.isArray(contractsResult) ? contractsResult : [];
        setContracts(activeContracts);
        setContractId(activeContracts[0]?.contract_id || '');
      } catch (e) {
        setError(pickApiErrorMessage(e, 'Erro ao carregar dados do anunciante.'));
      } finally {
        setLoadingDetails(false);
      }
    };

    loadSubscriberDetails();
  }, [loadApprovedMedias, subscriberId]);

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
      setTitle(buildTemplateTitle(selectedPreset, selectedSubscriber, selectedSegment));
    }
  }, [selectedPreset.label, selectedSegment.value, selectedSubscriber, title]);

  const setPublishParams = (nextPreset: QuickPublishPreset, nextSegment: string) => {
    setSearchParams({ preset: nextPreset, segment: nextSegment }, { replace: true });
  };

  const handleSelectPreset = (template: PresetOption) => {
    setPreset(template.value);
    setDurationMs(template.recommendedDurationMs);
    setTitle(buildTemplateTitle(template, selectedSubscriber, selectedSegment));
    setDescription(buildTemplateDescription(template, selectedSegment));
    setPublishParams(template.value, segment);
  };

  const handleSelectSegment = (nextSegment: string) => {
    const segmentOption = findSegmentOption(nextSegment);
    const shouldUseSegmentPreset = !searchParams.get('preset') || preset === selectedSegment.defaultPreset;
    const nextPreset = shouldUseSegmentPreset ? segmentOption.defaultPreset : preset;
    const template = findPresetOption(nextPreset);

    setSegment(nextSegment);
    setPreset(nextPreset);
    setDurationMs(template.recommendedDurationMs);
    setTitle(buildTemplateTitle(template, selectedSubscriber, segmentOption));
    setDescription(buildTemplateDescription(template, segmentOption));
    setPublishParams(nextPreset, nextSegment);
  };

  const handlePublish = async () => {
    if (!canPublish) {
      setError('Preencha cliente, contrato, tela, mídia e título antes de publicar.');
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      setSuccess(null);
      const result = await quickPublishApi.publish({
        subscriberId: Number(subscriberId),
        contractId: Number(contractId),
        totemIds,
        mediaIds,
        preset,
        title: title.trim(),
        description: description.trim() || undefined,
        publishNow: true,
        durationMs,
      });

      setSuccess(
        `${result.message}. Campanha #${result.campaignId}, playlist #${result.playlistId}. Totens atualizados: ${result.regeneratedTotemIds.length}.`
      );
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao publicar conteúdo.'));
    } finally {
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
      const uploaded = await mediaApi.upload(uploadFile, {
        name: uploadName.trim() || uploadFile.name.replace(/\.[^.]+$/, ''),
        description: `Enviado pelo fluxo Publicar em Tela (${selectedPreset.label})`,
        tags: ['quick-publish', preset],
        subscriberId: Number(subscriberId),
      });

      const approvedMedias = await loadApprovedMedias(Number(subscriberId));
      if (isApprovedMedia(uploaded)) {
        const uploadedId = uploaded.media_id;
        setMediaIds((prev) => [...new Set([...prev, uploadedId])]);
        setSuccess('Mídia enviada e selecionada para publicação.');
      } else {
        const foundUploaded = approvedMedias.find((media) => media.media_id === uploaded.media_id);
        if (foundUploaded) {
          setMediaIds((prev) => [...new Set([...prev, foundUploaded.media_id])]);
          setSuccess('Mídia enviada e selecionada para publicação.');
        } else {
          setSuccess('Mídia enviada. Ela ficará disponível para publicação assim que estiver aprovada.');
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
        subtitle="Fluxo rápido V3x para publicar mídia em TVs, totens e cardápios digitais."
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

            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" disabled={publishing}>
                <InputLabel>Segmento comercial</InputLabel>
                <Select
                  value={segment}
                  label="Segmento comercial"
                  onChange={(e) => handleSelectSegment(String(e.target.value))}
                >
                  {SEGMENTS.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      <ListItemText primary={item.label} secondary={item.description} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Template visual inteligente
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Escolha o segmento e o modelo para preencher automaticamente título, descrição, linguagem visual e duração recomendada.
              </Typography>
              <Grid container spacing={2}>
                {PRESETS.map((item) => {
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
                    {title.trim() || buildTemplateTitle(selectedPreset, selectedSubscriber, selectedSegment) || selectedPreset.headline}
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
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <FormControl fullWidth size="small" disabled={!subscriberId || loadingDetails || publishing}>
                <InputLabel>Mídias aprovadas</InputLabel>
                <Select
                  multiple
                  value={mediaIds.map(String)}
                  label="Mídias aprovadas"
                  onChange={(e) => {
                    const value = e.target.value;
                    const values = Array.isArray(value) ? value : String(value).split(',');
                    setMediaIds(values.map(Number).filter((item) => Number.isInteger(item) && item > 0));
                  }}
                  renderValue={() => selectedMediaNames.join(', ')}
                >
                  {medias.map((media) => (
                    <MenuItem key={media.media_id} value={String(media.media_id)}>
                      <Checkbox checked={mediaIds.includes(media.media_id)} />
                      <ListItemText primary={getMediaLabel(media)} secondary={media.subscriberName} />
                    </MenuItem>
                  ))}
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
              <Typography variant="body2">{mediaIds.length}</Typography>
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
