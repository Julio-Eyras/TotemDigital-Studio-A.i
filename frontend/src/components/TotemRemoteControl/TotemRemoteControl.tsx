/**
 * Totem Remote Control Component - Smart Signage v2.1
 * Componente para controle remoto de totens (Player-AD / TV Smart)
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  Tooltip,
  TextField,
  Divider,
} from '@mui/material';
import {
  RestartAlt,
  Screenshot,
  History,
  PhotoLibrary,
  Download,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Terminal,
  Sync,
  DeleteSweep,
  Cached,
  PlaylistPlay,
  Campaign,
  PermMedia,
  Verified,
  ScreenRotation,
  SystemUpdate,
  PlayCircleOutline,
  Wifi,
} from '@mui/icons-material';
import { totemApi, dispatcherTotemApi } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import TotemLogsViewer from '../TotemLogsViewer/TotemLogsViewer';

interface TotemRemoteControlProps {
  totemId: number;
  totemName?: string;
  onClose?: () => void;
}

interface RemoteCommand {
  id: number;
  commandType: string;
  status: string;
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

interface Screenshot {
  id: number;
  file_path: string;
  created_at: string;
  width?: number;
  height?: number;
}

type SyncCommandType =
  | 'refresh_dispatch'
  | 'sync_now'
  | 'content_version_check'
  | 'invalidate_media'
  | 'invalidate_playlist'
  | 'invalidate_campaign'
  | 'purge_cache';

const TotemRemoteControl: React.FC<TotemRemoteControlProps> = ({
  totemId,
  totemName,
  onClose,
}) => {
  const { showSuccess, showError } = useNotification();
  const [tabValue, setTabValue] = useState(0);
  const [commands, setCommands] = useState<RemoteCommand[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [orientationSaving, setOrientationSaving] = useState(false);
  const [displayRotation, setDisplayRotation] = useState(0);
  const [nowPlayingLabel, setNowPlayingLabel] = useState<string | null>(null);
  const [otaBusy, setOtaBusy] = useState(false);
  const [syncLoading, setSyncLoading] = useState<SyncCommandType | null>(null);
  const [screenshotPreviews, setScreenshotPreviews] = useState<Record<number, string>>({});
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [rebooting, setRebooting] = useState(false);
  const [invalidateDialog, setInvalidateDialog] = useState<{
    open: boolean;
    type: 'invalidate_media' | 'invalidate_playlist' | 'invalidate_campaign';
  }>({ open: false, type: 'invalidate_media' });
  const [invalidateMediaIds, setInvalidateMediaIds] = useState('');
  const [invalidatePlaylistId, setInvalidatePlaylistId] = useState('');
  const [invalidateCampaignId, setInvalidateCampaignId] = useState('');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiOpenNetwork, setWifiOpenNetwork] = useState(false);
  const [wifiBusy, setWifiBusy] = useState(false);

  useEffect(() => {
    if (tabValue === 0) {
      loadCommands();
    } else if (tabValue === 1) {
      loadScreenshots();
    }
  }, [tabValue, totemId]);

  useEffect(() => {
    void loadTotemRemoteState();
  }, [totemId]);

  const loadTotemRemoteState = async () => {
    try {
      const totem = await totemApi.getById(totemId);
      const settings = (totem as any)?.playerSettings || (totem as any)?.player_settings;
      const rotation = Number(settings?.displayRotation ?? 0);
      if (Number.isFinite(rotation)) {
        setDisplayRotation(Math.min(3, Math.max(0, Math.round(rotation))));
      }
      const np = (totem as any)?.nowPlaying || (totem as any)?.now_playing;
      if (np && (np.name || np.mediaId)) {
        setNowPlayingLabel(
          `${np.mediaType || 'média'} #${np.mediaId}${np.name ? ` — ${np.name}` : ''}${
            np.playlistName ? ` (${np.playlistName})` : ''
          }`
        );
      } else {
        setNowPlayingLabel(null);
      }
    } catch {
      // silencioso — totem pode não expor ainda as colunas
    }
  };

  const loadCommands = async () => {
    try {
      setLoading(true);
      const response = await totemApi.getCommands(totemId, 50);
      setCommands(response.data || []);
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao carregar histórico de comandos'));
    } finally {
      setLoading(false);
    }
  };

  const loadScreenshots = async () => {
    try {
      setLoading(true);
      const response = await totemApi.getScreenshots(totemId, 20);
      const list: Screenshot[] = response.data || [];
      setScreenshots(list);

      // Revogar URLs anteriores
      Object.values(screenshotPreviews).forEach((url) => URL.revokeObjectURL(url));
      const next: Record<number, string> = {};
      await Promise.all(
        list.slice(0, 12).map(async (shot) => {
          try {
            const blob = await totemApi.downloadScreenshot(totemId, shot.id);
            next[shot.id] = URL.createObjectURL(blob);
          } catch {
            /* preview opcional */
          }
        })
      );
      setScreenshotPreviews(next);
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao carregar screenshots'));
    } finally {
      setLoading(false);
    }
  };

  const sendSyncCommand = async (
    type: SyncCommandType,
    data: Record<string, unknown> = {},
    successMessage?: string
  ) => {
    try {
      setSyncLoading(type);
      await totemApi.sendCommand(totemId, type, data);
      showSuccess(
        successMessage || 'Comando enviado',
        'Entrega imediata pelo sync ativo; heartbeat usado como fallback'
      );
      if (tabValue === 0) {
        setTimeout(loadCommands, 2000);
      }
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao enviar comando'));
    } finally {
      setSyncLoading(null);
    }
  };

  const handleRefreshDispatch = () =>
    sendSyncCommand('refresh_dispatch', {}, 'Atualização de plano solicitada');

  const handleSyncNow = () =>
    sendSyncCommand('sync_now', {}, 'Sincronização imediata solicitada');

  const handleContentVersionCheck = async () => {
    try {
      setSyncLoading('content_version_check');
      const dispatch = await dispatcherTotemApi.dispatch(totemId);
      const plan = dispatch?.data || dispatch?.dispatchPlan;
      const mediaItems = plan?.mediaItems || (plan as any)?.media_items || [];
      const items = mediaItems
        .map((item: any) => ({
          mediaId: Number(item.mediaId ?? item.media_id),
          contentVersion: item.metadata?.contentVersion ?? item.metadata?.content_version,
        }))
        .filter((item: { mediaId: number; contentVersion?: string }) =>
          Number.isFinite(item.mediaId) && item.mediaId > 0 && !!item.contentVersion
        );

      if (!items.length) {
        showError('Plano atual sem contentVersion — republicar mídias ou atualizar o player');
        return;
      }

      await totemApi.sendCommand(totemId, 'content_version_check', { items });
      showSuccess(
        'Verificação de versões enviada',
        `${items.length} mídia(s) serão conferidas no cache da TV`
      );
      if (tabValue === 0) {
        setTimeout(loadCommands, 2000);
      }
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao verificar versões no totem'));
    } finally {
      setSyncLoading(null);
    }
  };

  const handlePurgeCache = async () => {
    if (!window.confirm('Limpar todo o cache de propagandas nesta TV? O conteúdo será baixado novamente.')) {
      return;
    }
    await sendSyncCommand('purge_cache', {}, 'Limpeza de cache solicitada');
  };

  const openInvalidateDialog = (type: typeof invalidateDialog.type) => {
    setInvalidateDialog({ open: true, type });
  };

  const submitInvalidate = async () => {
    const { type } = invalidateDialog;
    let data: Record<string, unknown> = {};

    if (type === 'invalidate_media') {
      const ids = invalidateMediaIds
        .split(/[,\s;]+/)
        .map((v) => parseInt(v.trim(), 10))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) {
        showError('Informe ao menos um ID de mídia');
        return;
      }
      data = { mediaIds: ids };
    } else if (type === 'invalidate_playlist') {
      const playlistId = parseInt(invalidatePlaylistId.trim(), 10);
      if (!Number.isFinite(playlistId) || playlistId <= 0) {
        showError('Informe o ID da playlist');
        return;
      }
      data = { playlistId };
    } else {
      const campaignId = parseInt(invalidateCampaignId.trim(), 10);
      if (!Number.isFinite(campaignId) || campaignId <= 0) {
        showError('Informe o ID da campanha');
        return;
      }
      data = { campaignId };
    }

    setInvalidateDialog({ open: false, type });
    await sendSyncCommand(type, data, 'Invalidação de cache enviada');
  };

  const handleRestart = async () => {
    if (!window.confirm('Tem certeza que deseja reiniciar a app deste totem remotamente?')) {
      return;
    }

    try {
      setRestarting(true);
      await totemApi.restart(totemId);
      showSuccess('Comando de reinício enviado', 'O totem será reiniciado em breve');
      if (tabValue === 0) {
        setTimeout(loadCommands, 2000);
      }
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao enviar comando de reinício'));
    } finally {
      setRestarting(false);
    }
  };

  const handleRebootBoard = async () => {
    if (!window.confirm('Reiniciar a placa (reboot)? Requer permissões no Android e pode falhar sem root.')) {
      return;
    }
    try {
      setRebooting(true);
      await totemApi.sendCommand(totemId, 'reboot', {});
      showSuccess('Reboot enfileirado', 'Entrega imediata pelo sync ativo; heartbeat usado como fallback');
      setTimeout(loadCommands, 1500);
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao enfileirar reboot'));
    } finally {
      setRebooting(false);
    }
  };

  const openScreenshotPreview = async (screenshot: Screenshot) => {
    setSelectedScreenshot(screenshot);
    const cached = screenshotPreviews[screenshot.id];
    if (cached) {
      setSelectedPreviewUrl(cached);
      return;
    }
    try {
      const blob = await totemApi.downloadScreenshot(totemId, screenshot.id);
      const url = URL.createObjectURL(blob);
      setScreenshotPreviews((prev) => ({ ...prev, [screenshot.id]: url }));
      setSelectedPreviewUrl(url);
    } catch (error: any) {
      setSelectedPreviewUrl(null);
      showError(pickApiErrorMessage(error, 'Não foi possível carregar a captura'));
    }
  };

  useEffect(() => {
    return () => {
      Object.values(screenshotPreviews).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScreenshot = async () => {
    try {
      setCapturing(true);
      await totemApi.screenshot(totemId);
      showSuccess('Comando de screenshot enviado', 'Aguarde alguns segundos e abra Capturas de Tela');
      setTimeout(() => {
        setTabValue(1);
        loadScreenshots();
      }, 8000);
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao solicitar screenshot'));
    } finally {
      setCapturing(false);
    }
  };

  const handleDownloadScreenshot = async (screenshot: Screenshot) => {
    try {
      const blob = await totemApi.downloadScreenshot(totemId, screenshot.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `screenshot_${totemId}_${screenshot.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Captura de tela baixada com sucesso');
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao baixar screenshot'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'executing':
        return 'warning';
      case 'pending':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string): React.ReactElement | undefined => {
    switch (status) {
      case 'completed':
        return <CheckCircle fontSize="small" />;
      case 'failed':
        return <ErrorIcon fontSize="small" />;
      case 'executing':
      case 'pending':
        return <Schedule fontSize="small" />;
      default:
        return undefined;
    }
  };

  const formatCommandType = (type: string) => {
    const types: Record<string, string> = {
      restart: 'Reinício',
      restart_app: 'Reinício do app',
      screenshot: 'Captura de tela',
      capture_screen: 'Captura de tela',
      refresh_dispatch: 'Atualizar plano',
      sync_now: 'Sincronizar agora',
      content_version_check: 'Verificar versões',
      invalidate_media: 'Invalidar mídia',
      invalidate_playlist: 'Invalidar playlist',
      invalidate_campaign: 'Invalidar campanha',
      purge_cache: 'Limpar cache',
      update: 'OTA / update',
      config: 'Configuração',
      apply_player_config: 'Configuração player',
      configure_wifi: 'Configurar Wi‑Fi',
      ota_rollback: 'OTA rollback',
      display_force_on: 'Forçar tela ligada',
      display_force_off: 'Forçar tela preta',
      display_force_clear: 'Seguir horário de tela',
      custom: 'Personalizado',
    };
    return types[type] || type;
  };

  const syncButton = (
    label: string,
    type: SyncCommandType,
    icon: React.ReactNode,
    onClick: () => void,
    color: 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'success' = 'primary'
  ) => (
    <Button
      fullWidth
      variant="outlined"
      color={color}
      size="small"
      startIcon={syncLoading === type ? <CircularProgress size={14} /> : icon}
      onClick={onClick}
      disabled={syncLoading !== null}
    >
      {syncLoading === type ? 'Enviando...' : label}
    </Button>
  );

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Controle Remoto {totemName && `- ${totemName}`}
          </Typography>
          {onClose && (
            <Button size="small" onClick={onClose}>
              Fechar
            </Button>
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          Comandos de sincronização exigem <strong>Player-AD</strong> atualizado na TV Smart.
          A entrega usa o sync de eventos quando ativo e o heartbeat como fallback.
        </Alert>

        {nowPlayingLabel && (
          <Alert severity="success" icon={<PlayCircleOutline />} sx={{ mb: 2 }}>
            A reproduzir: {nowPlayingLabel}
          </Alert>
        )}

        <Typography variant="subtitle2" gutterBottom>
          Orientação do totem (remota)
        </Typography>
        <Grid container spacing={1} sx={{ mb: 2 }} alignItems="center">
          <Grid item xs={12} sm={8}>
            <TextField
              select
              fullWidth
              size="small"
              label="displayRotation"
              value={displayRotation}
              onChange={(e) => setDisplayRotation(Number(e.target.value))}
              SelectProps={{ native: true }}
            >
              <option value={0}>0 — Retrato (topo para cima)</option>
              <option value={2}>2 — Retrato invertido</option>
              <option value={1}>1 — Paisagem (90° direita)</option>
              <option value={3}>3 — Paisagem invertida (90° esquerda)</option>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={orientationSaving ? <CircularProgress size={14} /> : <ScreenRotation />}
              disabled={orientationSaving}
              onClick={async () => {
                try {
                  setOrientationSaving(true);
                  await totemApi.sendCommand(totemId, 'config', { displayRotation });
                  showSuccess('Orientação enfileirada', 'Entrega imediata pelo sync ativo; heartbeat como fallback');
                  setTimeout(loadCommands, 1500);
                } catch (error: any) {
                  showError(pickApiErrorMessage(error, 'Erro ao enviar orientação'));
                } finally {
                  setOrientationSaving(false);
                }
              }}
            >
              Aplicar
            </Button>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" gutterBottom>
          Wi‑Fi no totem (Player-AD ≥ 2.12)
        </Typography>
        <Alert severity="warning" sx={{ mb: 1 }}>
          Só funciona se o aparelho já tiver alguma ligação à Internet (Ethernet ou Wi‑Fi antigo).
          Sem rede, use 3 toques no canto OK da TV → Config → «Abrir Wi‑Fi do sistema» ou scan local.
        </Alert>
        <Grid container spacing={1} sx={{ mb: 2 }} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              label="SSID"
              value={wifiSsid}
              onChange={(e) => setWifiSsid(e.target.value)}
              autoComplete="off"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              size="small"
              type="password"
              label="Senha"
              value={wifiPassword}
              onChange={(e) => setWifiPassword(e.target.value)}
              disabled={wifiOpenNetwork}
              autoComplete="new-password"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={wifiBusy ? <CircularProgress size={14} /> : <Wifi />}
              disabled={wifiBusy || !wifiSsid.trim() || (!wifiOpenNetwork && !wifiPassword)}
              onClick={async () => {
                const ssid = wifiSsid.trim();
                if (!ssid) {
                  showError('Informe o SSID da rede');
                  return;
                }
                if (!wifiOpenNetwork && !wifiPassword) {
                  showError('Informe a senha ou marque rede aberta');
                  return;
                }
                try {
                  setWifiBusy(true);
                  await totemApi.sendCommand(totemId, 'configure_wifi', {
                    ssid,
                    password: wifiOpenNetwork ? '' : wifiPassword,
                    secured: !wifiOpenNetwork,
                  });
                  showSuccess(
                    'Wi‑Fi enfileirado',
                    'O Player-AD tenta ligar no próximo sync/heartbeat'
                  );
                  setWifiPassword('');
                  setTimeout(loadCommands, 1500);
                } catch (error: any) {
                  showError(pickApiErrorMessage(error, 'Erro ao enviar configure_wifi'));
                } finally {
                  setWifiBusy(false);
                }
              }}
            >
              Enviar Wi‑Fi
            </Button>
          </Grid>
          <Grid item xs={12}>
            <Button
              size="small"
              variant={wifiOpenNetwork ? 'contained' : 'text'}
              onClick={() => setWifiOpenNetwork((v) => !v)}
            >
              {wifiOpenNetwork ? 'Rede aberta (sem senha)' : 'Marcar como rede aberta'}
            </Button>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" gutterBottom>
          Horário de tela (forçar)
        </Typography>
        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid item xs={4}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              onClick={async () => {
                try {
                  await totemApi.sendCommand(totemId, 'display_force_on', {});
                  showSuccess('Forçar tela ligada', 'Entrega imediata pelo sync ativo; heartbeat como fallback');
                  setTimeout(loadCommands, 1500);
                } catch (error: any) {
                  showError(pickApiErrorMessage(error, 'Erro ao enviar comando'));
                }
              }}
            >
              Ligar
            </Button>
          </Grid>
          <Grid item xs={4}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="warning"
              onClick={async () => {
                try {
                  await totemApi.sendCommand(totemId, 'display_force_off', {});
                  showSuccess('Forçar tela preta', 'Entrega imediata pelo sync ativo; heartbeat como fallback');
                  setTimeout(loadCommands, 1500);
                } catch (error: any) {
                  showError(pickApiErrorMessage(error, 'Erro ao enviar comando'));
                }
              }}
            >
              Apagar
            </Button>
          </Grid>
          <Grid item xs={4}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              onClick={async () => {
                try {
                  await totemApi.sendCommand(totemId, 'display_force_clear', {});
                  showSuccess('Seguir horário', 'Entrega imediata pelo sync ativo; heartbeat como fallback');
                  setTimeout(loadCommands, 1500);
                } catch (error: any) {
                  showError(pickApiErrorMessage(error, 'Erro ao enviar comando'));
                }
              }}
            >
              Horário
            </Button>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" gutterBottom>
          OTA (baixa prioridade — mock)
        </Typography>
        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={otaBusy ? <CircularProgress size={14} /> : <SystemUpdate />}
              disabled={otaBusy}
              onClick={async () => {
                try {
                  setOtaBusy(true);
                  await totemApi.sendCommand(totemId, 'update', {});
                  showSuccess('OTA enfileirado (mock/parcial)', 'Histórico no totem: files/OTA');
                  setTimeout(loadCommands, 1500);
                } catch (error: any) {
                  showError(pickApiErrorMessage(error, 'Erro ao enfileirar OTA'));
                } finally {
                  setOtaBusy(false);
                }
              }}
            >
              Pedir update
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              disabled={otaBusy}
              onClick={async () => {
                try {
                  setOtaBusy(true);
                  await totemApi.sendCommand(totemId, 'ota_rollback', {});
                  showSuccess('Rollback mock enfileirado', 'Player regista em files/OTA (sem instalar ainda)');
                  setTimeout(loadCommands, 1500);
                } catch (error: any) {
                  showError(pickApiErrorMessage(error, 'Erro ao enfileirar rollback'));
                } finally {
                  setOtaBusy(false);
                }
              }}
            >
              Rollback (mock)
            </Button>
          </Grid>
        </Grid>

        {/* Ações Rápidas */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              color="warning"
              startIcon={restarting ? <CircularProgress size={16} /> : <RestartAlt />}
              onClick={handleRestart}
              disabled={restarting || rebooting}
            >
              {restarting ? 'Reiniciando...' : 'Reiniciar app'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={rebooting ? <CircularProgress size={16} /> : <RestartAlt />}
              onClick={handleRebootBoard}
              disabled={restarting || rebooting}
            >
              {rebooting ? 'Reboot...' : 'Reboot placa'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              startIcon={capturing ? <CircularProgress size={16} /> : <Screenshot />}
              onClick={handleScreenshot}
              disabled={capturing}
            >
              {capturing ? 'Capturando...' : 'Capturar Tela'}
            </Button>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" gutterBottom>
          Sincronização — TV Smart / Player-AD
        </Typography>
        <Grid container spacing={1} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={4}>
            {syncButton('Atualizar plano', 'refresh_dispatch', <Refresh />, handleRefreshDispatch)}
          </Grid>
          <Grid item xs={6} sm={4}>
            {syncButton('Sincronizar agora', 'sync_now', <Sync />, handleSyncNow, 'success')}
          </Grid>
          <Grid item xs={6} sm={4}>
            {syncButton('Verificar versões', 'content_version_check', <Verified />, handleContentVersionCheck, 'info')}
          </Grid>
          <Grid item xs={6} sm={4}>
            {syncButton('Invalidar mídia', 'invalidate_media', <PermMedia />, () => openInvalidateDialog('invalidate_media'), 'warning')}
          </Grid>
          <Grid item xs={6} sm={4}>
            {syncButton('Invalidar playlist', 'invalidate_playlist', <PlaylistPlay />, () => openInvalidateDialog('invalidate_playlist'), 'warning')}
          </Grid>
          <Grid item xs={6} sm={4}>
            {syncButton('Invalidar campanha', 'invalidate_campaign', <Campaign />, () => openInvalidateDialog('invalidate_campaign'), 'warning')}
          </Grid>
          <Grid item xs={6} sm={4}>
            {syncButton('Limpar cache', 'purge_cache', <DeleteSweep />, handlePurgeCache, 'error')}
          </Grid>
          <Grid item xs={6} sm={4}>
            <Tooltip title="Limpa cache e solicita novo plano de exibição">
              <Box>
                {syncButton('Cache + plano', 'purge_cache', <Cached />, async () => {
                  if (!window.confirm('Limpar cache e atualizar plano nesta TV Smart?')) return;
                  setSyncLoading('purge_cache');
                  try {
                    await totemApi.sendCommand(totemId, 'purge_cache', {});
                    await totemApi.sendCommand(totemId, 'refresh_dispatch', {});
                    showSuccess('Cache limpo e plano atualizado', 'Comandos enfileirados para o Player-AD');
                    if (tabValue === 0) setTimeout(loadCommands, 2000);
                  } catch (error: any) {
                    showError(pickApiErrorMessage(error, 'Erro ao enviar comandos'));
                  } finally {
                    setSyncLoading(null);
                  }
                }, 'secondary')}
              </Box>
            </Tooltip>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 2 }} />

        {/* Tabs */}
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 2 }}
        >
          <Tab label="Histórico" icon={<History />} iconPosition="start" />
          <Tab label="Capturas de Tela" icon={<PhotoLibrary />} iconPosition="start" />
          <Tab label="Logs" icon={<Terminal />} iconPosition="start" />
        </Tabs>

        {/* Histórico de Comandos */}
        {tabValue === 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2">Últimos Comandos</Typography>
              <IconButton size="small" onClick={loadCommands} disabled={loading}>
                <Refresh />
              </IconButton>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : commands.length === 0 ? (
              <Alert severity="info">Nenhum comando executado ainda</Alert>
            ) : (
              <List>
                {commands.map((command) => (
                  <ListItem key={command.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            {formatCommandType(command.commandType)}
                          </Typography>
                          <Chip
                            icon={getStatusIcon(command.status)}
                            label={command.status}
                            color={getStatusColor(command.status) as any}
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            Criado: {new Date(command.createdAt).toLocaleString('pt-BR')}
                          </Typography>
                          {command.executedAt && (
                            <Typography variant="caption" display="block">
                              Executado: {new Date(command.executedAt).toLocaleString('pt-BR')}
                            </Typography>
                          )}
                          {command.completedAt && (
                            <Typography variant="caption" display="block">
                              Concluído: {new Date(command.completedAt).toLocaleString('pt-BR')}
                            </Typography>
                          )}
                          {command.errorMessage && (
                            <Typography variant="caption" color="error" display="block">
                              Erro: {command.errorMessage}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Capturas de tela */}
        {tabValue === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2">Capturas de Tela</Typography>
              <IconButton size="small" onClick={loadScreenshots} disabled={loading}>
                <Refresh />
              </IconButton>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : screenshots.length === 0 ? (
              <Alert severity="info">Nenhuma captura de tela realizada ainda</Alert>
            ) : (
              <ImageList cols={3} gap={8}>
                {screenshots.map((screenshot) => (
                  <ImageListItem key={screenshot.id}>
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '56.25%',
                        backgroundColor: 'grey.200',
                        borderRadius: 1,
                        overflow: 'hidden',
                        cursor: 'pointer',
                      }}
                      onClick={() => openScreenshotPreview(screenshot)}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'grey.300',
                        }}
                      >
                        {screenshotPreviews[screenshot.id] ? (
                          <Box
                            component="img"
                            src={screenshotPreviews[screenshot.id]}
                            alt="Captura"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <PhotoLibrary sx={{ fontSize: 48, color: 'grey.500' }} />
                        )}
                      </Box>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          p: 1,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'white',
                        }}
                      >
                        <Typography variant="caption">
                          {new Date(screenshot.created_at).toLocaleString('pt-BR')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center' }}>
                      <Tooltip title="Baixar">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadScreenshot(screenshot);
                          }}
                        >
                          <Download fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </ImageListItem>
                ))}
              </ImageList>
            )}
          </Box>
        )}

        {/* Logs em Tempo Real */}
        {tabValue === 2 && (
          <TotemLogsViewer
            totemId={totemId}
            totemName={totemName}
            onClose={onClose}
          />
        )}
      </CardContent>

      {/* Dialog: Invalidação */}
      <Dialog
        open={invalidateDialog.open}
        onClose={() => setInvalidateDialog({ open: false, type: invalidateDialog.type })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {invalidateDialog.type === 'invalidate_media' && 'Invalidar mídias no cache'}
          {invalidateDialog.type === 'invalidate_playlist' && 'Invalidar playlist no cache'}
          {invalidateDialog.type === 'invalidate_campaign' && 'Invalidar campanha no cache'}
        </DialogTitle>
        <DialogContent>
          {invalidateDialog.type === 'invalidate_media' && (
            <TextField
              fullWidth
              margin="normal"
              label="IDs de mídia"
              placeholder="Ex.: 42, 58, 103"
              value={invalidateMediaIds}
              onChange={(e) => setInvalidateMediaIds(e.target.value)}
              helperText="Separados por vírgula. O player apagará o cache e baixará de novo."
            />
          )}
          {invalidateDialog.type === 'invalidate_playlist' && (
            <TextField
              fullWidth
              margin="normal"
              label="ID da playlist"
              value={invalidatePlaylistId}
              onChange={(e) => setInvalidatePlaylistId(e.target.value)}
            />
          )}
          {invalidateDialog.type === 'invalidate_campaign' && (
            <TextField
              fullWidth
              margin="normal"
              label="ID da campanha"
              value={invalidateCampaignId}
              onChange={(e) => setInvalidateCampaignId(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvalidateDialog({ open: false, type: invalidateDialog.type })}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={submitInvalidate}>
            Enviar comando
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Visualizar captura de tela */}
      <Dialog
        open={!!selectedScreenshot}
        onClose={() => {
          setSelectedScreenshot(null);
          setSelectedPreviewUrl(null);
        }}
        maxWidth="md"
        fullWidth
      >
        {selectedScreenshot && (
          <>
            <DialogTitle>
              Captura de Tela - {new Date(selectedScreenshot.created_at).toLocaleString('pt-BR')}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ textAlign: 'center' }}>
                {selectedPreviewUrl || screenshotPreviews[selectedScreenshot.id] ? (
                  <Box
                    component="img"
                    src={selectedPreviewUrl || screenshotPreviews[selectedScreenshot.id]}
                    alt="Captura de tela"
                    sx={{ maxWidth: '100%', height: 'auto', display: 'block', mx: 'auto' }}
                  />
                ) : (
                  <Alert severity="warning">Imagem indisponível — tente Download</Alert>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleDownloadScreenshot(selectedScreenshot)} startIcon={<Download />}>
                Download
              </Button>
              <Button
                onClick={() => {
                  setSelectedScreenshot(null);
                  setSelectedPreviewUrl(null);
                }}
              >
                Fechar
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
};

export default TotemRemoteControl;
