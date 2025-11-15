import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  CircularProgress,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save,
  Refresh,
  Storage,
  RotateRight,
  Refresh as ReloadIcon,
  Warning,
  VideoLibrary,
  Build
} from '@mui/icons-material';
import { settingsApi, SystemSetting, logsApi, LogRotationConfig, LogFileInfo, DiskSpaceInfo, RotationStatus } from '../../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [logSettings, setLogSettings] = useState<SystemSetting[]>([]);
  const [mediaSettings, setMediaSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Logs monitoring
  const [logConfig, setLogConfig] = useState<LogRotationConfig | null>(null);
  const [logFiles, setLogFiles] = useState<LogFileInfo[]>([]);
  const [diskSpace, setDiskSpace] = useState<DiskSpaceInfo | null>(null);
  const [rotationStatus, setRotationStatus] = useState<RotationStatus | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Media config
  const [applyingMediaConfig, setApplyingMediaConfig] = useState(false);

  useEffect(() => {
    loadSettings();
    if (tabValue === 1) {
      loadLogsInfo();
    }
  }, [tabValue]);
  
  const handleApplyMediaConfig = async (rebuild: boolean = false) => {
    try {
      setApplyingMediaConfig(true);
      setError(null);
      
      const response = await fetch('/api/settings/media/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          applyChanges: true,
          rebuild
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.message || 'Erro ao aplicar configurações');
        return;
      }
      
      alert('✅ Configurações de mídia aplicadas com sucesso!\n\n' +
            'Mudanças aplicadas:\n' +
            `- Nginx: ${result.data?.changes?.nginx ? 'Sim' : 'Não'}\n` +
            `- Express: ${result.data?.changes?.express ? 'Sim' : 'Não'}\n` +
            `- Multer: ${result.data?.changes?.multer ? 'Sim' : 'Não'}\n` +
            `- Serviços reiniciados: ${result.data?.changes?.servicesRestarted ? 'Sim' : 'Não'}`);
      
      if (result.data?.errors && result.data.errors.length > 0) {
        console.warn('Avisos ao aplicar configurações:', result.data.errors);
      }
      
    } catch (e: any) {
      console.error('Erro ao aplicar configurações de mídia:', e);
      setError('Erro ao aplicar configurações: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setApplyingMediaConfig(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const resp = await settingsApi.getAll();
      
      // A API retorna um objeto com categories, precisamos extrair todas as settings
      let allSettings: SystemSetting[] = [];
      if (Array.isArray(resp)) {
        // Se já for array, usar diretamente
        allSettings = resp;
      } else if (resp && typeof resp === 'object' && 'categories' in resp) {
        // Se for objeto com categories, extrair todas as settings
        const categories = (resp as any).categories || [];
        allSettings = categories.flatMap((cat: any) => cat.settings || []);
      } else if (resp && typeof resp === 'object') {
        // Se for objeto simples, tentar converter
        allSettings = Object.values(resp) as SystemSetting[];
      }
      
      setSettings(Array.isArray(allSettings) ? allSettings : []);
      
      // Separar configurações de logs
      const logs = allSettings.filter(s => s?.key?.startsWith('log.'));
      setLogSettings(Array.isArray(logs) ? logs : []);
      
      // Separar configurações de mídia
      const media = allSettings.filter(s => s?.key?.startsWith('media.'));
      setMediaSettings(Array.isArray(media) ? media : []);
    } catch (e) {
      console.error('Erro ao carregar configurações:', e);
      setError('Erro ao carregar configurações');
      setSettings([]);
      setLogSettings([]);
    } finally {
      setLoading(false);
    }
  };

  const loadLogsInfo = async () => {
    try {
      setLoadingLogs(true);
      const [config, files, space, status] = await Promise.all([
        logsApi.getConfig(),
        logsApi.getFiles(),
        logsApi.getDiskSpace(),
        logsApi.getRotationStatus()
      ]);
      setLogConfig(config);
      setLogFiles(files);
      // Garantir que percentUsed seja sempre número
      if (space) {
        setDiskSpace({
          ...space,
          percentUsed: typeof space.percentUsed === 'number' 
            ? space.percentUsed 
            : parseFloat(String(space.percentUsed || 0))
        });
      } else {
        setDiskSpace(null);
      }
      setRotationStatus(status);
    } catch (e: any) {
      console.error('Erro ao carregar informações de logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      let settingsToSave: SystemSetting[] = [];
      if (tabValue === 0) {
        settingsToSave = Array.isArray(settings) 
          ? settings.filter(s => s?.key && !s.key.startsWith('log.') && !s.key.startsWith('media.')) 
          : [];
      } else if (tabValue === 1) {
        settingsToSave = Array.isArray(logSettings) ? logSettings : [];
      } else if (tabValue === 2) {
        settingsToSave = Array.isArray(mediaSettings) ? mediaSettings : [];
      }
      
      // Converter para formato esperado pelo backend
      const settingsObj: { [key: string]: any } = {};
      settingsToSave.forEach(s => {
        settingsObj[s.key] = s.value;
      });
      
      await settingsApi.updateMultiple(settingsObj);
      
      // Recarregar logger se foram alteradas configurações de logs
      if (tabValue === 1) {
        await logsApi.reload();
        await loadLogsInfo();
      }
      
      // Recarregar configurações após salvar
      await loadSettings();
    } catch (e) {
      setError('Erro ao salvar configurações');
    }
  };

  const handleRotateLogs = async () => {
    try {
      setLoadingLogs(true);
      await logsApi.rotate();
      await loadLogsInfo();
    } catch (e: any) {
      setError('Erro ao rotacionar logs: ' + e.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    if (key.startsWith('log.')) {
      setLogSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    }
    if (key.startsWith('media.')) {
      setMediaSettings(prev => prev.map(s => s.key === key ? { ...s, value } : s));
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Configurações do Sistema
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Geral" icon={<SettingsIcon />} iconPosition="start" />
          <Tab label="Logs" icon={<Storage />} iconPosition="start" />
          <Tab label="Mídias" icon={<VideoLibrary />} iconPosition="start" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadSettings}>Recarregar</Button>
          <Button startIcon={<Save />} variant="contained" onClick={handleSave}>Salvar Alterações</Button>
        </Box>

        <Grid container spacing={3}>
          {Array.isArray(settings) && settings.filter(s => s?.key && !s.key.startsWith('log.')).map((s) => (
            <Grid item xs={12} md={6} key={s.key}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>{s.key}</Typography>
                  {s.type === 'boolean' ? (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={s.value === 'true' || s.value === true}
                          onChange={(e) => handleChange(s.key, e.target.checked.toString())}
                        />
                      }
                      label={s.description || s.key}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      label={s.description || s.key}
                      value={String(s.value ?? '')}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                      type={s.type === 'number' ? 'number' : 'text'}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadLogsInfo} disabled={loadingLogs}>
            Atualizar Informações
          </Button>
          <Button startIcon={<RotateRight />} variant="outlined" onClick={handleRotateLogs} disabled={loadingLogs}>
            Rotacionar Logs Agora
          </Button>
          <Button startIcon={<ReloadIcon />} variant="outlined" onClick={async () => {
            await logsApi.reload();
            await loadLogsInfo();
          }} disabled={loadingLogs}>
            Recarregar Logger
          </Button>
          <Button startIcon={<Save />} variant="contained" onClick={handleSave} disabled={loadingLogs}>
            Salvar Configurações
          </Button>
        </Box>

        {loadingLogs && <LinearProgress sx={{ mb: 2 }} />}

        {/* Informações de Espaço em Disco */}
        {diskSpace && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Storage sx={{ mr: 1, verticalAlign: 'middle' }} />
                Espaço em Disco
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Total</Typography>
                  <Typography variant="h6">{diskSpace.totalFormatted}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Usado</Typography>
                  <Typography variant="h6">{diskSpace.usedFormatted}</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={diskSpace.percentUsed}
                    color={diskSpace.percentUsed > 80 ? 'error' : diskSpace.percentUsed > 60 ? 'warning' : 'success'}
                    sx={{ mt: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {typeof diskSpace.percentUsed === 'number' 
                      ? diskSpace.percentUsed.toFixed(2) 
                      : parseFloat(String(diskSpace.percentUsed || 0)).toFixed(2)}% usado
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2" color="text.secondary">Livre</Typography>
                  <Typography variant="h6" color={parseFloat(diskSpace.percentFree) < 20 ? 'error' : 'success'}>
                    {diskSpace.freeFormatted}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Status de Rotação */}
        {rotationStatus && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status de Rotação
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Chip
                  label={rotationStatus.needsRotation ? 'Rotação Necessária' : 'Tudo OK'}
                  color={rotationStatus.needsRotation ? 'warning' : 'success'}
                  icon={rotationStatus.needsRotation ? <Warning /> : undefined}
                  sx={{ mb: 1 }}
                />
                {rotationStatus.reason !== 'none' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Motivo: {rotationStatus.reason}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Configurações de Logs */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configurações de Rotação
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {logSettings.map((s) => (
                <Grid item xs={12} md={6} key={s.key}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>{s.key}</Typography>
                  {s.type === 'boolean' ? (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={s.value === 'true' || s.value === true}
                          onChange={(e) => handleChange(s.key, e.target.checked.toString())}
                        />
                      }
                      label={s.description || s.key}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      label={s.description || s.key}
                      value={String(s.value ?? '')}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                      type={s.type === 'number' ? 'number' : 'text'}
                      helperText={s.key === 'log.rotation.max_size' || s.key === 'log.rotation.min_free_space' 
                        ? 'Formato: 100MB, 1GB, etc.' 
                        : undefined}
                    />
                  )}
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Lista de Arquivos de Log */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Arquivos de Log ({logFiles.length})
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell align="right">Tamanho</TableCell>
                    <TableCell>Idade (dias)</TableCell>
                    <TableCell>Modificado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logFiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        Nenhum arquivo de log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    logFiles.map((file) => (
                      <TableRow key={file.name}>
                        <TableCell>{file.name}</TableCell>
                        <TableCell align="right">{file.sizeFormatted}</TableCell>
                        <TableCell>{file.age}</TableCell>
                        <TableCell>{new Date(file.modified).toLocaleString('pt-BR')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadSettings}>
            Recarregar
          </Button>
          <Button startIcon={<Save />} variant="contained" onClick={handleSave}>
            Salvar Configurações
          </Button>
          <Button 
            startIcon={<Build />} 
            variant="contained" 
            color="secondary"
            onClick={() => handleApplyMediaConfig(false)}
            disabled={applyingMediaConfig}
          >
            Aplicar Configurações (Nginx)
          </Button>
        </Box>

        {applyingMediaConfig && <LinearProgress sx={{ mb: 2 }} />}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Como funciona:</strong> As configurações são aplicadas automaticamente ao salvar. 
            O Express e Multer leem as configurações diretamente do banco de dados em tempo de execução.
            Para aplicar mudanças no Nginx (que requer modificação de arquivo), clique em "Aplicar Configurações (Nginx)".
            Isso atualizará o arquivo de configuração do Nginx e recarregará o serviço sem downtime.
          </Typography>
        </Alert>

        <Grid container spacing={3}>
          {Array.isArray(mediaSettings) && mediaSettings.map((s) => (
            <Grid item xs={12} md={6} key={s.key}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {s.description || s.key}
                  </Typography>
                  {s.type === 'boolean' ? (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={s.value === 'true' || s.value === true}
                          onChange={(e) => handleChange(s.key, e.target.checked.toString())}
                        />
                      }
                      label={s.description || s.key}
                    />
                  ) : s.type === 'number' ? (
                    <TextField
                      fullWidth
                      label={s.description || s.key}
                      value={String(s.value ?? '')}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                      type="number"
                      helperText={s.validation ? `Validação: ${s.validation}` : undefined}
                    />
                  ) : (
                    <TextField
                      fullWidth
                      label={s.description || s.key}
                      value={String(s.value ?? '')}
                      onChange={(e) => handleChange(s.key, e.target.value)}
                      helperText={
                        s.key.includes('size') || s.key.includes('quota')
                          ? 'Formato: número seguido de unidade (ex: 500MB, 1GB)'
                          : s.validation ? `Validação: ${s.validation}` : undefined
                      }
                    />
                  )}
                  {s.defaultValue && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Valor padrão: {s.defaultValue}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {mediaSettings.length === 0 && (
          <Alert severity="warning">
            Nenhuma configuração de mídia encontrada. Certifique-se de que as configurações foram inseridas no banco de dados.
          </Alert>
        )}
      </TabPanel>
    </Box>
  );
};

export default Settings;
