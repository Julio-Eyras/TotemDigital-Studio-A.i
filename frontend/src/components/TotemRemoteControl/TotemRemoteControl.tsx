/**
 * Totem Remote Control Component - Smart Signage v2.1
 * Componente para controle remoto de totens
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
  ListItemSecondaryAction,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  ImageList,
  ImageListItem,
  Tooltip,
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
} from '@mui/icons-material';
import { totemApi } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
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
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);

  useEffect(() => {
    if (tabValue === 1) {
      loadCommands();
    } else if (tabValue === 2) {
      loadScreenshots();
    }
  }, [tabValue, totemId]);

  const loadCommands = async () => {
    try {
      setLoading(true);
      const response = await totemApi.getCommands(totemId, 50);
      setCommands(response.data || []);
    } catch (error: any) {
      showError('Erro ao carregar histórico de comandos', error.response?.data?.error || error.message);
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
      showError('Erro ao carregar screenshots', error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!window.confirm('Tem certeza que deseja reiniciar este totem remotamente?')) {
      return;
    }

    try {
      setRestarting(true);
      const result = await totemApi.restart(totemId);
      showSuccess('Comando de reinício enviado', 'O totem será reiniciado em breve');
      if (tabValue === 0) {
        setTimeout(loadCommands, 2000); // Recarregar após 2 segundos
      }
    } catch (error: any) {
      showError('Erro ao enviar comando de reinício', error.response?.data?.error || error.message);
    } finally {
      setRestarting(false);
    }
  };

  const handleScreenshot = async () => {
    try {
      setCapturing(true);
      const result = await totemApi.screenshot(totemId);
      showSuccess('Comando de screenshot enviado', 'O screenshot será capturado em breve');
      if (tabValue === 1) {
        setTimeout(loadScreenshots, 3000); // Recarregar após 3 segundos
      }
    } catch (error: any) {
      showError('Erro ao solicitar screenshot', error.response?.data?.error || error.message);
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
      showSuccess('Screenshot baixado com sucesso');
    } catch (error: any) {
      showError('Erro ao baixar screenshot', error.response?.data?.error || error.message);
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
    const types: { [key: string]: string } = {
      restart: 'Reinício',
      screenshot: 'Screenshot',
      update: 'Atualização',
      config: 'Configuração',
      custom: 'Personalizado',
    };
    return types[type] || type;
  };

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

        {/* Ações Rápidas */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
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
              {capturing ? 'Capturando...' : 'Capturar Screenshot'}
            </Button>
          </Grid>
        </Grid>

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
          <Tab label="Screenshots" icon={<PhotoLibrary />} iconPosition="start" />
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

        {/* Screenshots */}
        {tabValue === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2">Screenshots Capturados</Typography>
              <IconButton size="small" onClick={loadScreenshots} disabled={loading}>
                <Refresh />
              </IconButton>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : screenshots.length === 0 ? (
              <Alert severity="info">Nenhum screenshot capturado ainda</Alert>
            ) : (
              <ImageList cols={3} gap={8}>
                {screenshots.map((screenshot) => (
                  <ImageListItem key={screenshot.id}>
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '56.25%', // 16:9 aspect ratio
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
                      <Tooltip title="Download">
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

      {/* Dialog: Visualizar Screenshot */}
      <Dialog
        open={!!selectedScreenshot}
        onClose={() => setSelectedScreenshot(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedScreenshot && (
          <>
            <DialogTitle>
              Screenshot - {new Date(selectedScreenshot.created_at).toLocaleString('pt-BR')}
            </DialogTitle>
            <DialogContent>
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  component="img"
                  src={`${process.env.REACT_APP_API_URL || '/api'}/totems/${totemId}/screenshots/${selectedScreenshot.id}/download`}
                  alt="Screenshot"
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

