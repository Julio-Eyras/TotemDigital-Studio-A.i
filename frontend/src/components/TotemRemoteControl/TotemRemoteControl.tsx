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
  const [syncLoading, setSyncLoading] = useState<SyncCommandType | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [invalidateDialog, setInvalidateDialog] = useState<{
    open: boolean;
    type: 'invalidate_media' | 'invalidate_playlist' | 'invalidate_campaign';
  }>({ open: false, type: 'invalidate_media' });
  const [invalidateMediaIds, setInvalidateMediaIds] = useState('');
  const [invalidatePlaylistId, setInvalidatePlaylistId] = useState('');
  const [invalidateCampaignId, setInvalidateCampaignId] = useState('');

  useEffect(() => {
    if (tabValue === 0) {
      loadCommands();
    } else if (tabValue === 1) {
      loadScreenshots();
    }
  }, [tabValue, totemId]);

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
      setScreenshots(response.data || []);
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
        'O totem executará no próximo heartbeat (TV Smart / Player-AD)'
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
    if (!window.confirm('Tem certeza que deseja reiniciar este totem remotamente?')) {
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

  const handleScreenshot = async () => {
    try {
      setCapturing(true);
      await totemApi.screenshot(totemId);
      showSuccess('Comando de screenshot enviado', 'O screenshot será capturado em breve');
      if (tabValue === 1) {
        setTimeout(loadScreenshots, 3000);
      }
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
      update: 'Atualização',
      config: 'Configuração',
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
          A execução ocorre no próximo heartbeat do player.
        </Alert>

        {/* Ações Rápidas */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6}>
            <Button
              fullWidth
              variant="contained"
              color="warning"
              startIcon={restarting ? <CircularProgress size={16} /> : <RestartAlt />}
              onClick={handleRestart}
              disabled={restarting}
            >
              {restarting ? 'Reiniciando...' : 'Reiniciar Totem'}
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
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
                      onClick={() => setSelectedScreenshot(screenshot)}
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
                        <PhotoLibrary sx={{ fontSize: 48, color: 'grey.500' }} />
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
        onClose={() => setSelectedScreenshot(null)}
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
                <Box
                  component="img"
                  src={`${process.env.REACT_APP_API_URL || '/api'}/totems/${totemId}/screenshots/${selectedScreenshot.id}/download`}
                  alt="Captura de tela"
                  sx={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => handleDownloadScreenshot(selectedScreenshot)} startIcon={<Download />}>
                Download
              </Button>
              <Button onClick={() => setSelectedScreenshot(null)}>Fechar</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
};

export default TotemRemoteControl;
