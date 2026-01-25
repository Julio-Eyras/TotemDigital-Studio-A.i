/**
 * Dispatcher Monitor - Monitor
 * 
 * Histórico e auditoria de decisões já tomadas:
 * - Histórico de decisões do dispatcher (logs do banco)
 * - Campanhas selecionadas em cada momento
 * - Planos de exibição que foram gerados
 * - Métricas de cache e performance
 * 
 * DIFERENÇA DOS OUTROS:
 * - Gerenciar: Planejamento (o que será exibido)
 * - Monitor: Histórico (o que foi exibido) ← VOCÊ ESTÁ AQUI
 * - Debug Online: Diagnóstico técnico (por que não funciona)
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
  TableSortLabel,
  Paper,
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
import { useNavigate } from 'react-router-dom';
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
  PlayArrow,
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

type Order = 'asc' | 'desc';

interface EligiblePlaylistRow {
  playlistId: number;
  name: string;
  campaignId: number;
  campaignTitle: string;
  priority: number;
  commercialTier?: string;
  timeSharePercent?: number;
  status: string;
}

const DispatcherMonitor: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [logs, setLogs] = useState<DispatchLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<DispatchLogEntry | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Filtros
  // totemFilter: undefined ou 0 => "Todos (*)"; > 0 => totem específico
  const [totemFilter, setTotemFilter] = useState<number | undefined>(0);
  const [startDate, setStartDate] = useState<string>(
    format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [totems, setTotems] = useState<any[]>([]);
  const allOption = React.useMemo(() => ({ totem_id: 0, name: 'Todos (*)', identifier: '*' }), []);
  const [selectedTotemOption, setSelectedTotemOption] = useState<any>(allOption);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // segundos

  // Helper para extrair totem_id de forma padronizada
  const getTotemId = (item: any): number => {
    if (!item) return 0;
    // Padronização: sempre usar totem_id (não mais 'id')
    return item.totem_id ?? 0;
  };

  // Playlists elegíveis (aba extra)
  const [eligiblePlaylists, setEligiblePlaylists] = useState<EligiblePlaylistRow[]>([]);

  // Ordenação da tabela de logs
  const [orderBy, setOrderBy] = useState<
    keyof DispatchLogEntry | 'playlistName' | 'publisherName' | 'subscriberName'
  >('timestamp');
  const [order, setOrder] = useState<Order>('desc');

  // Ordenação da tabela de playlists elegíveis
  const [playlistOrderBy, setPlaylistOrderBy] = useState<keyof EligiblePlaylistRow>('priority');
  const [playlistOrder, setPlaylistOrder] = useState<Order>('desc');

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
    // Sempre tenta carregar logs quando filtros de data mudam ou quando muda o filtro de totem.
    // Quando totemFilter for "Todos (*)", buscamos históricos de múltiplos totens.
    loadLogs();
  }, [totemFilter, startDate, endDate]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
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
      const list = Array.isArray(response.data) ? response.data : [];
      setTotems(list);
      // Sincronizar opção selecionada com o filtro atual
      if (!totemFilter || totemFilter === 0) {
        setSelectedTotemOption(allOption);
      } else {
        const match = list.find((t) => getTotemId(t) === totemFilter);
        setSelectedTotemOption(match || allOption);
      }
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
    try {
      setLoading(true);
      setError(null);

      // Validar datas para evitar montar query inválida (ex.: ano 0002) e causar 500 no backend
      const isValidYmd = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(`${v}T00:00:00Z`).getTime());
      if (!isValidYmd(startDate) || !isValidYmd(endDate)) {
        setError('Data inválida. Use o formato AAAA-MM-DD.');
        return;
      }

      const startIso = `${startDate}T00:00:00Z`;
      const endIso = `${endDate}T23:59:59Z`;

      // Caso "Todos (*)": buscar histórico de vários totens e agrupar
      if (!totemFilter || totemFilter === 0) {
        // Garantir que temos a lista de totens carregada
        if (!totems || totems.length === 0) {
          await loadTotems();
        }

        const targetTotems = (totems || []).filter((t) => getTotemId(t) > 0);

        const results = await Promise.all(
          targetTotems.map(async (t) => {
            const id = getTotemId(t);
            try {
              const resp = await dispatcherTotemApi.getHistory(id, startIso, endIso);
              return resp.data || [];
            } catch (e) {
              // Se um totem falhar, apenas ignora seus logs, mas registra no console
              // para não quebrar a experiência ao listar "Todos"
              // eslint-disable-next-line no-console
              console.error('Erro ao carregar histórico para totem', id, e);
              return [];
            }
          })
        );

        const allLogs = results.flat();
        setLogs(allLogs);
      } else {
        const response = await dispatcherTotemApi.getHistory(
          totemFilter,
          startIso,
          endIso
        );
        setLogs(response.data || []);
      }
    } catch (err: any) {
      console.error('Erro ao carregar logs:', err);
      setError(err.response?.data?.error || 'Erro ao carregar logs do dispatcher');
    } finally {
      setLoading(false);
    }
  };

  const loadEligiblePlaylists = async () => {
    // Requer totem específico; faz mais sentido olhar playlists elegíveis por totem
    if (!totemFilter || totemFilter === 0) {
      setEligiblePlaylists([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const response = await dispatcherTotemApi.getCandidates(totemFilter, {
        timestamp: now.toISOString(),
      });

      const playlistsMap = new Map<number, EligiblePlaylistRow>();

      (response.candidates || []).forEach((c: any) => {
        if (!c.playlistId) return;
        if (!playlistsMap.has(c.playlistId)) {
          playlistsMap.set(c.playlistId, {
            playlistId: c.playlistId,
            name: c.playlistName,
            campaignId: c.campaignId,
            campaignTitle: c.campaignTitle,
            priority: c.priority,
            commercialTier: c.commercialTier,
            timeSharePercent: c.timeSharePercent,
            status: c.temporalValid ? 'elegível' : 'inválida',
          });
        }
      });

      setEligiblePlaylists(Array.from(playlistsMap.values()));
    } catch (err: any) {
      console.error('Erro ao carregar playlists elegíveis:', err);
      setError(err.response?.data?.error || 'Erro ao carregar playlists elegíveis');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (
    property: keyof DispatchLogEntry | 'playlistName' | 'publisherName' | 'subscriberName'
  ) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedLogs = React.useMemo(() => {
    const data = [...logs];
    return data.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (orderBy) {
        case 'timestamp':
          aValue = a.timestamp;
          bValue = b.timestamp;
          break;
        case 'totemId':
          aValue = a.totemId;
          bValue = b.totemId;
          break;
        case 'playlistName':
          aValue = a.dispatchPlan?.playlistName || a.selectedPlaylistId || '';
          bValue = b.dispatchPlan?.playlistName || b.selectedPlaylistId || '';
          break;
        case 'priority':
          aValue = a.priority ?? 0;
          bValue = b.priority ?? 0;
          break;
        case 'executionTimeMs':
          aValue = a.executionTimeMs ?? 0;
          bValue = b.executionTimeMs ?? 0;
          break;
        case 'publisherName':
          aValue = a.publisherName || '';
          bValue = b.publisherName || '';
          break;
        case 'subscriberName':
          aValue = a.subscriberName || '';
          bValue = b.subscriberName || '';
          break;
        default:
          aValue = (a as any)[orderBy];
          bValue = (b as any)[orderBy];
      }

      if (aValue < bValue) {
        return order === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [logs, order, orderBy]);

  const sortedEligiblePlaylists = React.useMemo(() => {
    const data = [...eligiblePlaylists];
    return data.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (playlistOrderBy) {
        case 'priority':
          aValue = a.priority ?? 0;
          bValue = b.priority ?? 0;
          break;
        case 'campaignTitle':
          aValue = a.campaignTitle || '';
          bValue = b.campaignTitle || '';
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'timeSharePercent':
          aValue = a.timeSharePercent ?? 0;
          bValue = b.timeSharePercent ?? 0;
          break;
        default:
          aValue = (a as any)[playlistOrderBy];
          bValue = (b as any)[playlistOrderBy];
      }

      if (aValue < bValue) {
        return playlistOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return playlistOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [eligiblePlaylists, playlistOrder, playlistOrderBy]);

  const handleSimulateDispatch = async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      let targetTotemId = totemFilter && totemFilter !== 0 ? totemFilter : undefined;

      // Se nenhum totem específico estiver selecionado, encontrar automaticamente
      // um totem com candidatos válidos (playlist/campanha) usando o endpoint /candidates.
      if (!targetTotemId) {
        if (!totems || totems.length === 0) {
          await loadTotems();
        }

        for (const t of totems) {
          const id = getTotemId(t);
          if (!id) continue;
          try {
            const resp = await dispatcherTotemApi.getCandidates(id, {
              timestamp: now.toISOString(),
            });
            if (resp.success && resp.candidates && resp.candidates.length > 0) {
              targetTotemId = id;
              break;
            }
          } catch (e) {
            // Ignorar erros individuais e tentar próximo totem
            // eslint-disable-next-line no-console
            console.error('Erro ao buscar candidatos para totem', id, e);
          }
        }

        if (!targetTotemId) {
          setError('Nenhum totem com playlists elegíveis encontrado para simulação.');
          return;
        }

        // Atualizar filtro visualmente para o totem escolhido
        setTotemFilter(targetTotemId);
      }

      await dispatcherTotemApi.dispatch(targetTotemId, {
        timestamp: now.toISOString(),
        includeCandidates: true,
        skipCache: false,
      });

      // Após simular, recarregar históricos (para que o novo log apareça)
      await loadLogs();
    } catch (err: any) {
      console.error('Erro ao simular dispatch:', err);
      setError(err.response?.data?.error || 'Erro ao simular solicitação do totem');
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
                options={[allOption, ...totems]}
                isOptionEqualToValue={(option, value) =>
                  getTotemId(option) === getTotemId(value)
                }
                getOptionLabel={(option) => {
                  if (!option) return '';
                  if (getTotemId(option) === 0) return 'Todos (*)';
                  const id = getTotemId(option);
                  return `${option.name || option.identifier} (ID: ${id})`;
                }}
                value={selectedTotemOption}
                onChange={(_, newValue) => {
                  const valId = getTotemId(newValue);
                  setTotemFilter(valId || 0);
                  setSelectedTotemOption(newValue || allOption);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Totem"
                    placeholder="Todos (*)"
                  />
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
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<Refresh />}
                  onClick={loadLogs}
                  disabled={loading}
                >
                  Carregar
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PlayArrow />}
                  onClick={handleSimulateDispatch}
                  disabled={loading}
                >
                  Simular solicitação
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
          onChange={(_, newValue) => {
            setTabValue(newValue);
            if (newValue === 1) {
              // Carregar playlists elegíveis ao entrar na aba
              loadEligiblePlaylists();
            }
          }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={`Logs (${logs.length})`} />
          <Tab label="Playlists elegíveis" />
          <Tab label="Estatísticas" />
        </Tabs>
      </Paper>

      {/* Tab: Logs */}
      <TabPanel value={tabValue} index={0}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={orderBy === 'timestamp' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'timestamp'}
                    direction={orderBy === 'timestamp' ? order : 'asc'}
                    onClick={() => handleSort('timestamp')}
                  >
                    Timestamp
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'totemId' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'totemId'}
                    direction={orderBy === 'totemId' ? order : 'asc'}
                    onClick={() => handleSort('totemId')}
                  >
                    Totem ID
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'playlistName' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'playlistName'}
                    direction={orderBy === 'playlistName' ? order : 'asc'}
                    onClick={() => handleSort('playlistName')}
                  >
                    Playlist
                  </TableSortLabel>
                </TableCell>
                <TableCell>Fonte</TableCell>
                <TableCell sortDirection={orderBy === 'priority' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'priority'}
                    direction={orderBy === 'priority' ? order : 'asc'}
                    onClick={() => handleSort('priority')}
                  >
                    Prioridade
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'publisherName' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'publisherName'}
                    direction={orderBy === 'publisherName' ? order : 'asc'}
                    onClick={() => handleSort('publisherName')}
                  >
                    Publisher
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'subscriberName' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'subscriberName'}
                    direction={orderBy === 'subscriberName' ? order : 'asc'}
                    onClick={() => handleSort('subscriberName')}
                  >
                    Subscriber
                  </TableSortLabel>
                </TableCell>
                <TableCell>Candidatos</TableCell>
                <TableCell>Validações</TableCell>
                <TableCell>Cache</TableCell>
                <TableCell sortDirection={orderBy === 'executionTimeMs' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'executionTimeMs'}
                    direction={orderBy === 'executionTimeMs' ? order : 'asc'}
                    onClick={() => handleSort('executionTimeMs')}
                  >
                    Tempo (ms)
                  </TableSortLabel>
                </TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      {totemFilter && totemFilter !== 0
                        ? 'Nenhum log encontrado para o período selecionado'
                        : 'Nenhum log encontrado para o período selecionado'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedLogs.map((log) => (
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
                      <Typography variant="body2">
                        {log.publisherName || log.publisherId || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.subscriberName || log.subscriberId || '-'}
                      </Typography>
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

      {/* Tab: Playlists elegíveis */}
      <TabPanel value={tabValue} index={1}>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={playlistOrderBy === 'playlistId' ? playlistOrder : false}>
                  <TableSortLabel
                    active={playlistOrderBy === 'playlistId'}
                    direction={playlistOrderBy === 'playlistId' ? playlistOrder : 'asc'}
                    onClick={() => {
                      const isAsc = playlistOrderBy === 'playlistId' && playlistOrder === 'asc';
                      setPlaylistOrder(isAsc ? 'desc' : 'asc');
                      setPlaylistOrderBy('playlistId');
                    }}
                  >
                    Playlist ID
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={playlistOrderBy === 'name' ? playlistOrder : false}>
                  <TableSortLabel
                    active={playlistOrderBy === 'name'}
                    direction={playlistOrderBy === 'name' ? playlistOrder : 'asc'}
                    onClick={() => {
                      const isAsc = playlistOrderBy === 'name' && playlistOrder === 'asc';
                      setPlaylistOrder(isAsc ? 'desc' : 'asc');
                      setPlaylistOrderBy('name');
                    }}
                  >
                    Playlist
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={playlistOrderBy === 'campaignTitle' ? playlistOrder : false}>
                  <TableSortLabel
                    active={playlistOrderBy === 'campaignTitle'}
                    direction={playlistOrderBy === 'campaignTitle' ? playlistOrder : 'asc'}
                    onClick={() => {
                      const isAsc = playlistOrderBy === 'campaignTitle' && playlistOrder === 'asc';
                      setPlaylistOrder(isAsc ? 'desc' : 'asc');
                      setPlaylistOrderBy('campaignTitle');
                    }}
                  >
                    Campanha
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={playlistOrderBy === 'priority' ? playlistOrder : false}>
                  <TableSortLabel
                    active={playlistOrderBy === 'priority'}
                    direction={playlistOrderBy === 'priority' ? playlistOrder : 'asc'}
                    onClick={() => {
                      const isAsc = playlistOrderBy === 'priority' && playlistOrder === 'asc';
                      setPlaylistOrder(isAsc ? 'desc' : 'asc');
                      setPlaylistOrderBy('priority');
                    }}
                  >
                    Prioridade
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={playlistOrderBy === 'timeSharePercent' ? playlistOrder : false}>
                  <TableSortLabel
                    active={playlistOrderBy === 'timeSharePercent'}
                    direction={playlistOrderBy === 'timeSharePercent' ? playlistOrder : 'asc'}
                    onClick={() => {
                      const isAsc =
                        playlistOrderBy === 'timeSharePercent' && playlistOrder === 'asc';
                      setPlaylistOrder(isAsc ? 'desc' : 'asc');
                      setPlaylistOrderBy('timeSharePercent');
                    }}
                  >
                    Time share (%)
                  </TableSortLabel>
                </TableCell>
                <TableCell>Tier</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedEligiblePlaylists.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      {totemFilter && totemFilter !== 0
                        ? 'Nenhuma playlist elegível encontrada para o totem selecionado'
                        : 'Selecione um totem específico para ver playlists elegíveis'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedEligiblePlaylists.map((row) => (
                  <TableRow key={row.playlistId} hover>
                    <TableCell>{row.playlistId}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      {row.campaignTitle} (ID: {row.campaignId})
                    </TableCell>
                    <TableCell>
                      <Chip label={row.priority} size="small" />
                    </TableCell>
                    <TableCell>
                      {row.timeSharePercent && row.timeSharePercent > 0
                        ? `${row.timeSharePercent}%`
                        : '0%'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.commercialTier || 'standard'}
                        size="small"
                        color={
                          row.commercialTier === 'premium'
                            ? 'success'
                            : row.commercialTier === 'remnant'
                            ? 'default'
                            : 'info'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.status === 'elegível' ? 'Elegível' : 'Inválida'}
                        size="small"
                        color={row.status === 'elegível' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate('/playlists', { state: { highlightId: row.playlistId } })}
                        >
                          Ver playlist
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate('/campaigns', { state: { highlightId: row.campaignId } })}
                        >
                          Ver campanha
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab: Estatísticas */}
      <TabPanel value={tabValue} index={2}>
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
