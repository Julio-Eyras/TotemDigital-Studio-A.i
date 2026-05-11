/**
 * OTA Updates Component - Smart Signage v2.1
 * Componente para gerenciar atualizações Over-The-Air
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  LinearProgress,
  Tabs,
  Tab,
  FormControlLabel,
  Switch,
  Tooltip,
} from '@mui/material';
import {
  Upload,
  PlayArrow,
  Pause,
  Download,
  Refresh,
  Info,
  CheckCircle,
  Cancel,
  Schedule,
} from '@mui/icons-material';
import { otaApi, OTAUpdate } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const OTAUpdates: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [updates, setUpdates] = useState<OTAUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<OTAUpdate | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    version: '',
    platform: 'all' as 'webos' | 'tizen' | 'android' | 'linux' | 'windows' | 'all',
    description: '',
    changelog: '',
    isMandatory: false,
    minVersion: '',
    maxVersion: '',
    rolloutPercentage: 100,
    file: null as File | null,
  });

  useEffect(() => {
    loadUpdates();
    loadStats();
  }, []);

  const loadUpdates = async () => {
    try {
      setLoading(true);
      const response = await otaApi.getAll();
      setUpdates(response.data || []);
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao carregar atualizações'));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await otaApi.getStats();
      setStats(response.data);
    } catch {
      /* estatísticas opcionais; lista de updates já tratada em loadUpdates */
    }
  };

  const handleUpload = async () => {
    if (!formData.file || !formData.version || !formData.platform) {
      showError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const data = new FormData();
      data.append('file', formData.file);
      data.append('version', formData.version);
      data.append('platform', formData.platform);
      if (formData.description) data.append('description', formData.description);
      if (formData.changelog) data.append('changelog', formData.changelog);
      data.append('isMandatory', formData.isMandatory.toString());
      if (formData.minVersion) data.append('minVersion', formData.minVersion);
      if (formData.maxVersion) data.append('maxVersion', formData.maxVersion);
      data.append('rolloutPercentage', formData.rolloutPercentage.toString());

      // Simular progresso (em produção, usar axios onUploadProgress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await otaApi.create(data);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      showSuccess('Atualização criada com sucesso');
      setOpenDialog(false);
      resetForm();
      loadUpdates();
      loadStats();
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao criar atualização'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await otaApi.activate(id);
      showSuccess('Atualização ativada com sucesso');
      loadUpdates();
      loadStats();
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao ativar atualização'));
    }
  };

  const handlePause = async (id: number) => {
    try {
      await otaApi.pause(id);
      showSuccess('Atualização pausada com sucesso');
      loadUpdates();
      loadStats();
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao pausar atualização'));
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const blob = await otaApi.download(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `update_${id}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Download iniciado');
    } catch (error: any) {
      showError(pickApiErrorMessage(error, 'Erro ao fazer download'));
    }
  };

  const resetForm = () => {
    setFormData({
      version: '',
      platform: 'all',
      description: '',
      changelog: '',
      isMandatory: false,
      minVersion: '',
      maxVersion: '',
      rolloutPercentage: 100,
      file: null,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'testing':
        return 'warning';
      case 'paused':
        return 'default';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Rascunho';
      case 'testing':
        return 'Testando';
      case 'active':
        return 'Ativa';
      case 'paused':
        return 'Pausada';
      case 'completed':
        return 'Concluída';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Atualizações OTA</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<Upload />}
            onClick={() => setOpenDialog(true)}
          >
            Nova Atualização
          </Button>
          <IconButton onClick={loadUpdates} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Estatísticas */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Atualizações Ativas
                </Typography>
                <Typography variant="h4">{stats.updates?.active || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Totens Atualizados
                </Typography>
                <Typography variant="h4">{stats.totems?.upToDate || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Atualizações Disponíveis
                </Typography>
                <Typography variant="h4">{stats.totems?.updateAvailable || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Em Instalação
                </Typography>
                <Typography variant="h4">{stats.totems?.installing || 0}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabela de Atualizações */}
      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : updates.length === 0 ? (
            <Alert severity="info">Nenhuma atualização encontrada</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Versão</TableCell>
                    <TableCell>Plataforma</TableCell>
                    <TableCell>Tamanho</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Rollout</TableCell>
                    <TableCell>Obrigatória</TableCell>
                    <TableCell>Criada em</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {updates.map((update) => (
                    <TableRow key={update.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {update.version}
                        </Typography>
                        {update.description && (
                          <Typography variant="caption" color="textSecondary">
                            {update.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={update.platform} size="small" />
                      </TableCell>
                      <TableCell>{formatFileSize(update.fileSize)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusLabel(update.status)}
                          color={getStatusColor(update.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{update.rolloutPercentage}%</TableCell>
                      <TableCell>
                        {update.isMandatory ? (
                          <CheckCircle color="error" fontSize="small" />
                        ) : (
                          <Cancel color="disabled" fontSize="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(update.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {update.status === 'active' ? (
                            <Tooltip title="Pausar">
                              <IconButton
                                size="small"
                                onClick={() => handlePause(update.id)}
                              >
                                <Pause fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : update.status === 'draft' || update.status === 'paused' ? (
                            <Tooltip title="Ativar">
                              <IconButton
                                size="small"
                                onClick={() => handleActivate(update.id)}
                              >
                                <PlayArrow fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                          <Tooltip title="Download">
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(update.id)}
                            >
                              <Download fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Nova Atualização */}
      <Dialog
        open={openDialog}
        onClose={() => !uploading && setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Nova Atualização OTA</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="Versão"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              required
              placeholder="ex: 2.1.0"
              fullWidth
            />

            <FormControl fullWidth required>
              <InputLabel>Plataforma</InputLabel>
              <Select
                value={formData.platform}
                label="Plataforma"
                onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
              >
                <MenuItem value="all">Todas</MenuItem>
                <MenuItem value="webos">webOS (LG)</MenuItem>
                <MenuItem value="tizen">Tizen (Samsung)</MenuItem>
                <MenuItem value="android">Android TV</MenuItem>
                <MenuItem value="linux">Linux (SBC)</MenuItem>
                <MenuItem value="windows">Windows</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Arquivo de Atualização"
              type="file"
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  setFormData({ ...formData, file });
                }
              }}
              required
              inputProps={{ accept: '.zip,.tar.gz,.tar,.deb,.rpm,.apk,.ipk' }}
              fullWidth
            />

            {formData.file && (
              <Alert severity="info">
                Arquivo selecionado: {formData.file.name} ({formatFileSize(formData.file.size)})
              </Alert>
            )}

            <TextField
              label="Descrição"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />

            <TextField
              label="Changelog"
              value={formData.changelog}
              onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
              multiline
              rows={4}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.isMandatory}
                  onChange={(e) => setFormData({ ...formData, isMandatory: e.target.checked })}
                />
              }
              label="Atualização Obrigatória"
            />

            <TextField
              label="Versão Mínima"
              value={formData.minVersion}
              onChange={(e) => setFormData({ ...formData, minVersion: e.target.value })}
              placeholder="ex: 2.0.0"
              fullWidth
            />

            <TextField
              label="Versão Máxima"
              value={formData.maxVersion}
              onChange={(e) => setFormData({ ...formData, maxVersion: e.target.value })}
              placeholder="ex: 2.0.9"
              fullWidth
            />

            <TextField
              label="Rollout Percentage"
              type="number"
              value={formData.rolloutPercentage}
              onChange={(e) => setFormData({ ...formData, rolloutPercentage: parseInt(e.target.value) || 100 })}
              inputProps={{ min: 0, max: 100 }}
              helperText="Porcentagem de totens que receberão a atualização (0-100)"
              fullWidth
            />

            {uploading && (
              <Box>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                  Enviando... {uploadProgress}%
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={uploading || !formData.file || !formData.version}
            startIcon={<Upload />}
          >
            {uploading ? 'Enviando...' : 'Criar Atualização'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OTAUpdates;

