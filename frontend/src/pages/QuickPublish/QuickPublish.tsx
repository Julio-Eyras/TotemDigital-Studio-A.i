import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
}

const PRESETS: PresetOption[] = [
  { value: 'menu', label: 'Cardápio Digital', description: 'Para cardápios, preços e ofertas do dia.' },
  { value: 'promotion', label: 'Promoção', description: 'Para ofertas rápidas e chamadas comerciais.' },
  { value: 'ad', label: 'Anúncio', description: 'Para mídia indoor e anúncios em tela cheia.' },
  { value: 'announcement', label: 'Comunicado', description: 'Para avisos, eventos e informações locais.' },
  { value: 'institutional', label: 'Institucional', description: 'Para conteúdo fixo de marca ou ambiente.' },
];

const STEPS = ['Cliente', 'Tela', 'Conteúdo', 'Publicar'];

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

const QuickPublish: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [totems, setTotems] = useState<Player[]>([]);
  const [medias, setMedias] = useState<MediaItem[]>([]);
  const [subscriberId, setSubscriberId] = useState<number | ''>('');
  const [contractId, setContractId] = useState<number | ''>('');
  const [totemIds, setTotemIds] = useState<number[]>([]);
  const [mediaIds, setMediaIds] = useState<number[]>([]);
  const [preset, setPreset] = useState<QuickPublishPreset>('ad');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMs, setDurationMs] = useState(10000);
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
    () => PRESETS.find((item) => item.value === preset) || PRESETS[2],
    [preset]
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
      setTitle(`${selectedPreset.label} - ${getSubscriberName(selectedSubscriber)}`);
    }
  }, [selectedPreset.label, selectedSubscriber, title]);

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
              <FormControl fullWidth size="small" disabled={!subscriberId || loadingDetails || publishing}>
                <InputLabel>Preset comercial</InputLabel>
                <Select
                  value={preset}
                  label="Preset comercial"
                  onChange={(e) => setPreset(e.target.value as QuickPublishPreset)}
                >
                  {PRESETS.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>{selectedPreset.label}:</strong> {selectedPreset.description}
                </Typography>
              </Alert>
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
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">Cliente</Typography>
              <Typography variant="body2">{selectedSubscriber?.name || '-'}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">Preset</Typography>
              <Typography variant="body2">{selectedPreset.label}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary">Telas</Typography>
              <Typography variant="body2">{totemIds.length}</Typography>
            </Grid>
            <Grid item xs={12} md={3}>
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
