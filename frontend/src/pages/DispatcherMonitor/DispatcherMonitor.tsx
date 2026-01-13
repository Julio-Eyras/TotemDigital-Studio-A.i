/**
 * Dispatcher Monitor
 * Página de monitoramento do Dispatcher-Totem
 * Mostra logs, inputs e outputs do dispatcher
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  useTheme,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Refresh,
  Visibility,
  ExpandMore,
  CheckCircle,
  Error,
  Warning,
  Schedule,
  PlaylistPlay,
  Campaign,
  Computer,
  Cached,
  Timer,
  FilterList,
} from '@mui/icons-material';
import { dispatcherTotemApi, DispatchLogEntry, DispatchPlan, totemApi } from '../../services/api';
import { format } from 'date-fns';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const DispatcherMonitor: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [logs, setLogs] = useState<DispatchLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DispatchLogEntry | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Filtros
  const [totemFilter, setTotemFilter] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string>(
    format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [totems, setTotems] = useState<any[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // segundos

  // Cache config
  const [cacheConfig, setCacheConfig] = useState<{
    enabled: boolean;
    ttlSeconds: number;
    maxSize?: number;
  } | null>(null);

  useEffect(() => {
    loadTotems();
    loadCacheConfig();
  }, []);

  useEffect(() => {
    if (totemFilter) {
      loadLogs();
    }
  }, [totemFilter, startDate, endDate]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh && totemFilter) {
      interval = setInterval(() => {
        loadLogs();
      }, refreshInterval * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, totemFilter]);

  const loadTotems = async () => {
    try {
      const response = await totemApi.getAll({ limit: 1000 });
      setTotems(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Erro ao carregar totens:', err);
    }
  };

  const loadCacheConfig = async () => {
    try {
      const response = await dispatcherTotemApi.getCacheConfig();
      setCacheConfig(response.data);
    } catch (err) {
      console.error('Erro ao carregar configuração de cache:', err);
    }
  };

  const loadLogs = async () => {
    if (!totemFilter) {
      setError('Selecione um totem para visualizar os logs');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await dispatcherTotemApi.getHistory(
        totemFilter,
        `${startDate}T00:00:00Z`,
        `${endDate}T23:59:59Z`
      );
      setLogs(response.data || []);
    } catch (err: any) {
      console.error('Erro ao carregar logs:', err);
      setError(err.response?.data?.error || 'Erro ao carregar logs do dispatcher');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (log: DispatchLogEntry) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const getValidationColor = (valid: boolean | null | undefined) => {
    if (valid === null || valid === undefined) return 'default';
    return valid ? 'success' : 'error';
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'direct': return <Computer />;
      case 'group': return <Campaign />;
      case 'campaign': return <Campaign />;
      default: return <PlaylistPlay />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'direct': return 'Totem Direto';
      case 'group': return 'Grupo';
      case 'campaign': return 'Campanha';
      default: return source;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
        Monitor Dispatcher-Totem
      </Typography>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <Autocomplete
                options={totems}
                getOptionLabel={(option) => `${option.name || option.identifier} (ID: ${option.id})`}
                value={totems.find(t => t.id === totemFilter) || null}
                onChange={(_, newValue) => setTotemFilter(newValue?.id)}
                renderInput={(params) => (
                  <TextField {...params} label="Totem" placeholder="Selecione um totem" />
                )}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="Data Início"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                label="Data Fim"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                }
                label="Auto-refresh"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={loadLogs}
                  disabled={!totemFilter || loading}
                >
                  Carregar
                </Button>
                <Button
                  variant="outlined"
                  onClick={loadCacheConfig}
                >
                  Cache Config
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Cache Config */}
      {cacheConfig && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configuração de Cache
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Chip
                  label={cacheConfig.enabled ? 'Cache Ativo' : 'Cache Desativado'}
                  color={cacheConfig.enabled ? 'success' : 'default'}
                  icon={<Cached />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="body2" color="text.secondary">
                  TTL: {cacheConfig.ttlSeconds} segundos
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={`Logs (${logs.length})`} />
          <Tab label="Estatísticas" />
        </Tabs>
      </Paper>

      {/* Tab: Logs */}
      <TabPanel value={tabValue} index={0}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Totem ID</TableCell>
                <TableCell>Playlist</TableCell>
                <TableCell>Fonte</TableCell>
                <TableCell>Prioridade</TableCell>
                <TableCell>Candidatos</TableCell>
                <TableCell>Validações</TableCell>
                <TableCell>Cache</TableCell>
                <TableCell>Tempo (ms)</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      {totemFilter ? 'Nenhum log encontrado para o período selecionado' : 'Selecione um totem para visualizar os logs'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.logId} hover>
                    <TableCell>
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>{log.totemId}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {log.dispatchPlan?.playlistName || `ID: ${log.selectedPlaylistId}`}
                        </Typography>
                        {log.selectedCampaignId && (
                          <Typography variant="caption" color="text.secondary">
                            Campanha: {log.selectedCampaignId}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getSourceLabel(log.selectedSource)}
                        size="small"
                        icon={getSourceIcon(log.selectedSource)}
                        color={log.selectedSource === 'direct' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={log.priority} size="small" color="info" />
                    </TableCell>
                    <TableCell>
                      <Chip label={log.candidatesCount} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Tooltip title="Validação Temporal">
                          <Chip
                            icon={log.temporalValidation ? <CheckCircle /> : <Error />}
                            label="T"
                            size="small"
                            color={getValidationColor(log.temporalValidation)}
                          />
                        </Tooltip>
                        <Tooltip title="Validação Técnica">
                          <Chip
                            icon={log.technicalValidation ? <CheckCircle /> : <Error />}
                            label="Tec"
                            size="small"
                            color={getValidationColor(log.technicalValidation)}
                          />
                        </Tooltip>
                        <Tooltip title="Validação de Integridade">
                          <Chip
                            icon={log.integrityValidation ? <CheckCircle /> : <Error />}
                            label="Int"
                            size="small"
                            color={getValidationColor(log.integrityValidation)}
                          />
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {log.fromCache ? (
                        <Chip
                          icon={<Cached />}
                          label="Cache"
                          size="small"
                          color="success"
                        />
                      ) : (
                        <Chip label="Live" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<Timer />}
                        label={`${log.executionTimeMs}ms`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Ver Detalhes">
                        <IconButton size="small" onClick={() => handleViewDetails(log)}>
                          <Visibility />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab: Estatísticas */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Total de Logs
                </Typography>
                <Typography variant="h3">{logs.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Cache Hits
                </Typography>
                <Typography variant="h3">
                  {logs.filter(l => l.fromCache).length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tempo Médio
                </Typography>
                <Typography variant="h3">
                  {logs.length > 0
                    ? Math.round(logs.reduce((sum, l) => sum + l.executionTimeMs, 0) / logs.length)
                    : 0}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Dialog de Detalhes */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Detalhes do Log - {selectedLog && format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss')}
        </DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Tabs value={0}>
                <Tab label="Input" />
                <Tab label="Output" />
                <Tab label="Candidatos" />
                <Tab label="Validações" />
              </Tabs>

              <Box sx={{ mt: 2 }}>
                {/* Input */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Input (Entrada)</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List>
                      <ListItem>
                        <ListItemIcon><Computer /></ListItemIcon>
                        <ListItemText
                          primary="Totem ID"
                          secondary={selectedLog.totemId}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><Schedule /></ListItemIcon>
                        <ListItemText
                          primary="Timestamp"
                          secondary={format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon><Cached /></ListItemIcon>
                        <ListItemText
                          primary="Cache Key"
                          secondary={selectedLog.cacheKey || 'N/A'}
                        />
                      </ListItem>
                    </List>
                  </AccordionDetails>
                </Accordion>

                {/* Output */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Output (Saída)</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {selectedLog.dispatchPlan ? (
                      <Box>
                        <Typography variant="subtitle1" gutterBottom>
                          Plano de Exibição
                        </Typography>
                        <List>
                          <ListItem>
                            <ListItemIcon><PlaylistPlay /></ListItemIcon>
                            <ListItemText
                              primary="Playlist"
                              secondary={`${selectedLog.dispatchPlan.playlistName} (ID: ${selectedLog.dispatchPlan.playlistId})`}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon><Campaign /></ListItemIcon>
                            <ListItemText
                              primary="Fonte"
                              secondary={`${getSourceLabel(selectedLog.dispatchPlan.source)} (ID: ${selectedLog.dispatchPlan.sourceId})`}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon><Timer /></ListItemIcon>
                            <ListItemText
                              primary="Duração Total"
                              secondary={`${selectedLog.dispatchPlan.totalDuration} segundos`}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon><Schedule /></ListItemIcon>
                            <ListItemText
                              primary="Validade"
                              secondary={`${format(new Date(selectedLog.dispatchPlan.validityStart), 'dd/MM/yyyy HH:mm')} - ${format(new Date(selectedLog.dispatchPlan.validityEnd), 'dd/MM/yyyy HH:mm')}`}
                            />
                          </ListItem>
                        </List>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          Mídias ({selectedLog.dispatchPlan.mediaItems.length})
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Ordem</TableCell>
                                <TableCell>ID</TableCell>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Duração</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedLog.dispatchPlan.mediaItems.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{item.order}</TableCell>
                                  <TableCell>{item.mediaId}</TableCell>
                                  <TableCell>{item.mediaType}</TableCell>
                                  <TableCell>{item.duration}s</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    ) : (
                      <Alert severity="info">Nenhum plano gerado</Alert>
                    )}
                  </AccordionDetails>
                </Accordion>

                {/* Candidatos */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">
                      Candidatos ({selectedLog.candidatesCount})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {selectedLog.candidates && selectedLog.candidates.length > 0 ? (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Campanha</TableCell>
                              <TableCell>Playlist</TableCell>
                              <TableCell>Prioridade</TableCell>
                              <TableCell>Fonte</TableCell>
                              <TableCell>Score</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedLog.candidates.map((candidate: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{candidate.campaignTitle || candidate.campaignId}</TableCell>
                                <TableCell>{candidate.playlistName || candidate.playlistId}</TableCell>
                                <TableCell>{candidate.priority}</TableCell>
                                <TableCell>{getSourceLabel(candidate.source)}</TableCell>
                                <TableCell>{candidate.score}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Alert severity="info">Nenhum candidato registrado</Alert>
                    )}
                  </AccordionDetails>
                </Accordion>

                {/* Validações */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography variant="h6">Validações</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          {selectedLog.temporalValidation ? <CheckCircle color="success" /> : <Error color="error" />}
                        </ListItemIcon>
                        <ListItemText
                          primary="Validação Temporal"
                          secondary={selectedLog.temporalValidation ? 'Válido' : 'Inválido'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          {selectedLog.technicalValidation ? <CheckCircle color="success" /> : <Error color="error" />}
                        </ListItemIcon>
                        <ListItemText
                          primary="Validação Técnica"
                          secondary={selectedLog.technicalValidation ? 'Válido' : 'Inválido'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          {selectedLog.integrityValidation ? <CheckCircle color="success" /> : <Error color="error" />}
                        </ListItemIcon>
                        <ListItemText
                          primary="Validação de Integridade"
                          secondary={selectedLog.integrityValidation ? 'Válido' : 'Inválido'}
                        />
                      </ListItem>
                    </List>
                    {selectedLog.validationDetails && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Detalhes:
                        </Typography>
                        <pre style={{ fontSize: '0.875rem', overflow: 'auto' }}>
                          {JSON.stringify(selectedLog.validationDetails, null, 2)}
                        </pre>
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DispatcherMonitor;
