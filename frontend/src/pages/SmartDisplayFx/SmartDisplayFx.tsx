import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Refresh,
  PlayArrow,
  FilterList,
  ViewTimeline,
  AutoAwesome,
  Analytics,
  Speed,
  TrendingUp,
  Assessment,
  AccountTree,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { smartDisplayFxApi, SmartDisplayFxLog, FxAnalyticsOverview, FxPerformanceMetrics } from '../../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ResponsiveSectionNav from '../../components/navigation/ResponsiveSectionNav';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`smartdisplayfx-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 0.5, sm: 1, md: 2 } }}>{children}</Box>}
    </div>
  );
}

const SmartDisplayFx: React.FC = () => {
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState<{
    siteId?: string;
    type?: 'rule' | 'effect';
    limit: number;
    startDate?: string;
    endDate?: string;
  }>({
    limit: 50,
  });

  const queryClient = useQueryClient();

  // Query para analytics overview
  const {
    data: analyticsOverview,
    isLoading: isLoadingAnalytics,
    error: analyticsError,
  } = useQuery({
    queryKey: ['fxAnalyticsOverview', filters.siteId, filters.startDate, filters.endDate],
    queryFn: () => smartDisplayFxApi.getAnalyticsOverview({
      site_id: filters.siteId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });

  // Query para performance metrics
  const {
    data: performanceMetrics,
    isLoading: isLoadingPerformance,
  } = useQuery({
    queryKey: ['fxPerformanceMetrics', filters.siteId, filters.startDate, filters.endDate],
    queryFn: () => smartDisplayFxApi.getPerformanceMetrics({
      site_id: filters.siteId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    refetchInterval: 60000,
  });

  // Query para buscar logs
  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    error: logsError,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['smartDisplayFxLogs', filters],
    queryFn: () => smartDisplayFxApi.getLogs(filters),
    refetchInterval: 30000,
  });

  // Query para telemetria
  const {
    data: telemetryData,
    isLoading: isLoadingTelemetry,
  } = useQuery({
    queryKey: ['fxTelemetry', filters],
    queryFn: () => smartDisplayFxApi.getTelemetry({
      page: 1,
      limit: 50,
      totem_id: filters.siteId ? parseInt(filters.siteId) : undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
    refetchInterval: 30000,
  });

  // Query para sites e rede estrela
  const {
    data: sitesData = [],
    isLoading: isLoadingSites,
  } = useQuery({
    queryKey: ['fxSites'],
    queryFn: () => smartDisplayFxApi.getSiteAnalytics(),
    refetchInterval: 60000,
  });

  // Mutation para disparar efeito (debug)
  const triggerEffectMutation = useMutation({
    mutationFn: smartDisplayFxApi.triggerEffect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smartDisplayFxLogs'] });
    },
  });

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const handleTriggerEffect = () => {
    const siteId = prompt('Site ID:') || '';
    const fromTotemId = prompt('Totem Origem:') || '';
    const toTotemId = prompt('Totem Destino:') || '';
    const effectId = prompt('Effect ID (opcional, padrão: neon_warp_v1):') || 'neon_warp_v1';

    if (siteId && fromTotemId && toTotemId) {
      triggerEffectMutation.mutate({
        siteId,
        fromTotemId,
        toTotemId,
        effectId: effectId || undefined,
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getEffectColor = (effectId?: string) => {
    const colors: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'info'> = {
      neon_warp_v1: 'primary',
      ripple_sync_v1: 'secondary',
      particle_burst_v1: 'success',
      ambient_wave_v1: 'info',
    };
    return colors[effectId || ''] || 'default';
  };

  // Cores para gráficos
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Preparar dados para gráficos
  const trendsData = analyticsOverview?.trends?.map(t => ({
    date: new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    execuções: t.executions,
    fps: Math.round(t.avg_fps),
    taxaSucesso: t.success_rate,
  })) || [];

  const topEffectsData = analyticsOverview?.topEffects?.slice(0, 5).map(e => ({
    name: e.effect_id,
    execuções: e.executions,
    fps: Math.round(e.avg_fps),
  })) || [];

  const fpsDistributionData = performanceMetrics?.fpsDistribution || [];
  const durationDistributionData = performanceMetrics?.durationDistribution || [];
  const performanceByHourData = performanceMetrics?.performanceByHour || [];
  const fxSections = [
    { icon: AccountTree, label: 'Rede Estrela' },
    { icon: Analytics, label: 'Analytics' },
    { icon: Speed, label: 'Performance' },
    { icon: ViewTimeline, label: 'Logs' },
    { icon: Assessment, label: 'Telemetria' },
  ] as const;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          SmartDisplayFX
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<PlayArrow />}
            onClick={handleTriggerEffect}
            disabled={triggerEffectMutation.isPending}
          >
            Disparar Efeito (Debug)
          </Button>
          <IconButton onClick={() => {
            refetchLogs();
            queryClient.invalidateQueries({ queryKey: ['fxAnalyticsOverview'] });
            queryClient.invalidateQueries({ queryKey: ['fxPerformanceMetrics'] });
          }} color="primary">
            <Refresh />
          </IconButton>
        </Stack>
      </Stack>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <TextField
              size="small"
              label="Site ID"
              value={filters.siteId || ''}
              onChange={(e) => handleFilterChange('siteId', e.target.value)}
              sx={{ minWidth: 150 }}
            />
            <TextField
              size="small"
              label="Data Início"
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              label="Data Fim"
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={filters.type || ''}
                label="Tipo"
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="effect">Efeitos</MenuItem>
                <MenuItem value="rule">Regras</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={() => {
                refetchLogs();
                queryClient.invalidateQueries({ queryKey: ['fxAnalyticsOverview'] });
              }}
            >
              Aplicar Filtros
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <ResponsiveSectionNav
          sections={fxSections}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="smartdisplayfx"
        />

        {/* Tab Rede Estrela */}
        <TabPanel value={tabValue} index={0}>
          {isLoadingSites ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {sitesData.map((site) => (
                <Grid item xs={12} md={6} key={site.site_id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {site.site_name || site.site_id}
                      </Typography>
                      <Box sx={{ position: 'relative', width: '100%', height: 400, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: '#f5f5f5' }}>
                        {/* Visualização da Rede Estrela */}
                        <svg width="100%" height="100%" viewBox="0 0 400 400" style={{ position: 'absolute', top: 0, left: 0 }}>
                          {/* Centro (Site) */}
                          <circle
                            cx="200"
                            cy="200"
                            r="30"
                            fill="#1976d2"
                            stroke="#fff"
                            strokeWidth="3"
                          />
                          <text
                            x="200"
                            y="205"
                            textAnchor="middle"
                            fill="#fff"
                            fontSize="12"
                            fontWeight="bold"
                          >
                            Site
                          </text>
                          
                          {/* Totens (distribuídos em círculo) */}
                          {Array.from({ length: Math.min(site.totem_count, 8) }).map((_, idx) => {
                            const angle = (idx * 2 * Math.PI) / Math.min(site.totem_count, 8);
                            const radius = 120;
                            const x = 200 + radius * Math.cos(angle - Math.PI / 2);
                            const y = 200 + radius * Math.sin(angle - Math.PI / 2);
                            
                            // Status baseado em execuções
                            const isActive = site.total_executions > 0;
                            const color = isActive ? '#4caf50' : '#9e9e9e';
                            
                            return (
                              <g key={idx}>
                                {/* Linha do centro para o totem */}
                                <line
                                  x1="200"
                                  y1="200"
                                  x2={x}
                                  y2={y}
                                  stroke={color}
                                  strokeWidth="2"
                                  strokeDasharray={isActive ? '0' : '5,5'}
                                  opacity={0.5}
                                />
                                {/* Totem */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="20"
                                  fill={color}
                                  stroke="#fff"
                                  strokeWidth="2"
                                />
                                <text
                                  x={x}
                                  y={y + 5}
                                  textAnchor="middle"
                                  fill="#fff"
                                  fontSize="10"
                                  fontWeight="bold"
                                >
                                  T{idx + 1}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                        
                        {/* Estatísticas sobrepostas */}
                        <Box sx={{ position: 'absolute', bottom: 10, left: 10, right: 10, bgcolor: 'rgba(255,255,255,0.9)', p: 1, borderRadius: 1 }}>
                          <Stack direction="row" spacing={2} justifyContent="space-around">
                            <Box textAlign="center">
                              <Typography variant="caption" color="textSecondary">Totens</Typography>
                              <Typography variant="h6">{site.totem_count}</Typography>
                            </Box>
                            <Box textAlign="center">
                              <Typography variant="caption" color="textSecondary">Execuções</Typography>
                              <Typography variant="h6">{site.total_executions}</Typography>
                            </Box>
                            <Box textAlign="center">
                              <Typography variant="caption" color="textSecondary">FPS Médio</Typography>
                              <Typography variant="h6">{Math.round(site.avg_fps)}</Typography>
                            </Box>
                            <Box textAlign="center">
                              <Typography variant="caption" color="textSecondary">Taxa Sucesso</Typography>
                              <Typography variant="h6" color={site.success_rate >= 90 ? 'success.main' : 'warning.main'}>
                                {site.success_rate}%
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              
              {sitesData.length === 0 && (
                <Grid item xs={12}>
                  <Alert severity="info">
                    Nenhum site encontrado. Configure sites e totens para visualizar a rede estrela.
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </TabPanel>

        {/* Tab Analytics */}
        <TabPanel value={tabValue} index={1}>
          {isLoadingAnalytics ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : analyticsError ? (
            <Alert severity="error" sx={{ m: 3 }}>
              Erro ao carregar analytics: {String(analyticsError)}
            </Alert>
          ) : (
            <>
              {/* Cards de Estatísticas */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Total de Execuções
                      </Typography>
                      <Typography variant="h4">{analyticsOverview?.totalExecutions || 0}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Taxa de Sucesso
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {analyticsOverview?.successRate || 0}%
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        FPS Médio
                      </Typography>
                      <Typography variant="h4" color="primary.main">
                        {analyticsOverview?.avgFps || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Duração Média
                      </Typography>
                      <Typography variant="h4">
                        {analyticsOverview?.avgDuration || 0}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Gráfico de Tendências */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={8}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Tendências (Últimos 7 Dias)
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="execuções" stroke="#8884d8" strokeWidth={2} />
                          <Line type="monotone" dataKey="fps" stroke="#82ca9d" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Top 5 Efeitos
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={topEffectsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                          <YAxis />
                          <RechartsTooltip />
                          <Bar dataKey="execuções" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Tabela Top Efeitos */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Efeitos
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Efeito</TableCell>
                          <TableCell align="right">Execuções</TableCell>
                          <TableCell align="right">FPS Médio</TableCell>
                          <TableCell align="right">Duração Média</TableCell>
                          <TableCell align="right">Taxa de Sucesso</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analyticsOverview?.topEffects?.map((effect, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Chip label={effect.effect_id} size="small" color={getEffectColor(effect.effect_id)} />
                            </TableCell>
                            <TableCell align="right">{effect.executions}</TableCell>
                            <TableCell align="right">{effect.avg_fps}</TableCell>
                            <TableCell align="right">{effect.avg_duration}ms</TableCell>
                            <TableCell align="right">{effect.success_rate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Tabela Top Totens */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Totens
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Totem</TableCell>
                          <TableCell align="right">Execuções</TableCell>
                          <TableCell align="right">FPS Médio</TableCell>
                          <TableCell align="right">Taxa de Sucesso</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analyticsOverview?.topTotems?.map((totem, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{totem.name}</TableCell>
                            <TableCell align="right">{totem.executions}</TableCell>
                            <TableCell align="right">{totem.avg_fps}</TableCell>
                            <TableCell align="right">{totem.success_rate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </TabPanel>

        {/* Tab Performance */}
        <TabPanel value={tabValue} index={2}>
          {isLoadingPerformance ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Distribuição de FPS
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={fpsDistributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percentage }) => `${name}: ${percentage}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {fpsDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Distribuição de Duração
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={durationDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="duration_range" />
                          <YAxis />
                          <RechartsTooltip />
                          <Bar dataKey="count" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Performance por Hora do Dia
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={performanceByHourData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="hour" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Line type="monotone" dataKey="executions" stroke="#8884d8" name="Execuções" />
                          <Line type="monotone" dataKey="avg_fps" stroke="#82ca9d" name="FPS Médio" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </>
          )}
        </TabPanel>

        {/* Tab Logs */}
        <TabPanel value={tabValue} index={3}>
          {isLoadingLogs ? (
            <Box sx={{ p: 3 }}>
              <LinearProgress />
              <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
                Carregando logs...
              </Typography>
            </Box>
          ) : logsError ? (
            <Alert severity="error" sx={{ m: 3 }}>
              Erro ao carregar logs: {String(logsError)}
            </Alert>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Logs Recentes
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Data/Hora</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Efeito/Regra</TableCell>
                        <TableCell>Origem → Destino</TableCell>
                        <TableCell>Detalhes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="textSecondary" sx={{ py: 3 }}>
                              Nenhum log encontrado
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        logs.map((log) => (
                          <TableRow key={log.id} hover>
                            <TableCell>{formatDate(log.created_at)}</TableCell>
                            <TableCell>
                              <Chip
                                label={log.entity_type === 'smartdisplayfx_effect' ? 'Efeito' : 'Regra'}
                                color={log.entity_type === 'smartdisplayfx_effect' ? 'primary' : 'secondary'}
                                size="small"
                                icon={
                                  log.entity_type === 'smartdisplayfx_effect' ? (
                                    <AutoAwesome fontSize="small" />
                                  ) : (
                                    <ViewTimeline fontSize="small" />
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              {log.metadata.effectId ? (
                                <Chip
                                  label={log.metadata.effectId}
                                  color={getEffectColor(log.metadata.effectId)}
                                  size="small"
                                />
                              ) : (
                                <Typography variant="body2" color="textSecondary">
                                  {log.metadata.rule || '-'}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.metadata.fromTotemId && log.metadata.toTotemId ? (
                                <Typography variant="body2">
                                  <strong>{log.metadata.fromTotemId}</strong> →{' '}
                                  <strong>{log.metadata.toTotemId}</strong>
                                </Typography>
                              ) : log.metadata.totemId ? (
                                <Typography variant="body2">
                                  <strong>{log.metadata.totemId}</strong>
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="textSecondary">
                                  -
                                </Typography>
                              )}
                              {log.metadata.siteId && (
                                <Typography variant="caption" color="textSecondary" display="block">
                                  Site: {log.metadata.siteId}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Tooltip
                                title={
                                  <Box
                                    component="pre"
                                    sx={{
                                      margin: 0,
                                      fontSize: '11px',
                                      fontFamily: 'monospace',
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </Box>
                                }
                              >
                                <Typography variant="body2" sx={{ cursor: 'help' }}>
                                  {log.metadata.durationMs
                                    ? `${log.metadata.durationMs}ms`
                                    : log.metadata.interactionType
                                    ? log.metadata.interactionType
                                    : log.metadata.segment
                                    ? `Segmento: ${log.metadata.segment}`
                                    : 'Ver detalhes'}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* Tab Telemetria */}
        <TabPanel value={tabValue} index={4}>
          {isLoadingTelemetry ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Telemetria Recente
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Data/Hora</TableCell>
                        <TableCell>Totem</TableCell>
                        <TableCell>Efeito</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>FPS</TableCell>
                        <TableCell>Duração</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {telemetryData?.data?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography color="textSecondary" sx={{ py: 3 }}>
                              Nenhuma telemetria encontrada
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        telemetryData?.data?.map((telemetry) => (
                          <TableRow key={telemetry.id} hover>
                            <TableCell>{formatDate(telemetry.created_at)}</TableCell>
                            <TableCell>{telemetry.totem_id}</TableCell>
                            <TableCell>
                              <Chip
                                label={telemetry.effect_id}
                                size="small"
                                color={getEffectColor(telemetry.effect_id)}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={telemetry.status}
                                size="small"
                                color={telemetry.status === 'success' ? 'success' : 'error'}
                              />
                            </TableCell>
                            <TableCell>{telemetry.avg_fps || '-'}</TableCell>
                            <TableCell>{telemetry.duration_ms ? `${telemetry.duration_ms}ms` : '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </TabPanel>
      </Card>
    </Box>
  );
};

export default SmartDisplayFx;
