import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Chip,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  TrendingUp,
  Assessment,
  Refresh,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getMixAnalytics, MixAnalytics } from '../../services/api/playlistMixApi';
import { totemApi, Player } from '../../services/api';
import { getTotemIdFromRow } from '../../utils/totemRowIds';

const PlaylistMixAnalytics: React.FC = () => {
  const theme = useTheme();
  const [analytics, setAnalytics] = useState<MixAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totems, setTotems] = useState<Player[]>([]);
  
  const [filters, setFilters] = useState<{
    totemId?: number;
    startDate?: string;
    endDate?: string;
  }>({});

  useEffect(() => {
    loadTotems();
    loadAnalytics();
  }, []);

  const loadTotems = async () => {
    try {
      // Aumentar limit para garantir que todos os totens sejam carregados
      const resp = await totemApi.getAll({ limit: 100 });
      setTotems(resp.data || []);
    } catch (e: any) {
      console.error('Erro ao carregar totens:', e);
    }
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMixAnalytics(filters);
      if (response.success) {
        setAnalytics(response.data);
      }
    } catch (e: any) {
      setError('Erro ao carregar analytics: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num.toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Analytics de Performance de Mixagens
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Análise de performance e engajamento das mixagens de playlists
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadAnalytics}
        >
          Atualizar
        </Button>
      </Box>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Totem</InputLabel>
                <Select
                  value={filters.totemId || ''}
                  onChange={(e) => setFilters({ ...filters, totemId: e.target.value ? Number(e.target.value) : undefined })}
                  label="Totem"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {totems.map((totem, idx) => {
                    const totemId = getTotemIdFromRow(totem);
                    if (totemId === undefined) return null;
                    return (
                      <MenuItem key={`totem-${totemId}-${idx}`} value={totemId}>
                        {totem.name || totem.identifier || `Totem ${totemId}`}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Data Início"
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Data Fim"
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={loadAnalytics}
                sx={{ height: '56px' }}
              >
                Filtrar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {analytics && (
        <>
          {/* Estatísticas Gerais */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Total de Mixagens
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    {analytics.stats.total_mixes}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Engajamento Médio
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1, color: theme.palette.success.main }}>
                    {formatNumber(analytics.stats.avg_engagement)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Execuções Totais
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    {analytics.stats.total_executions}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Itens Médios por Mix
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 1 }}>
                    {formatNumber(analytics.stats.avg_items)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Performance por Estratégia */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Performance por Estratégia
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <ReBarChart data={analytics.byStrategy}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="strategy" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avg_engagement" fill={theme.palette.primary.main} name="Engajamento Médio (%)" />
                  <Bar dataKey="avg_executions" fill={theme.palette.secondary.main} name="Execuções Médias" />
                </ReBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tendência Temporal */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Tendência de Engajamento (Últimos 30 dias)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                  <YAxis />
                  <Tooltip labelFormatter={(value) => formatDate(value)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avg_engagement"
                    stroke={theme.palette.success.main}
                    strokeWidth={2}
                    name="Engajamento Médio (%)"
                  />
                  <Line
                    type="monotone"
                    dataKey="mix_count"
                    stroke={theme.palette.info.main}
                    strokeWidth={2}
                    name="Mixagens"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Mixagens */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Top 10 Mixagens por Engajamento
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Totem</TableCell>
                      <TableCell>Estratégia</TableCell>
                      <TableCell>Engajamento</TableCell>
                      <TableCell>Execuções</TableCell>
                      <TableCell>Itens</TableCell>
                      <TableCell>Data</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.topMixes.map((mix) => (
                      <TableRow key={mix.history_id} hover>
                        <TableCell>
                          {mix.totem_name || mix.totem_identifier || `Totem ${mix.totem_id}`}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={mix.mix_strategy || 'N/A'}
                            size="small"
                            color={
                              mix.mix_strategy === 'ai' ? 'warning' :
                              mix.mix_strategy === 'hybrid' ? 'success' : 'info'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {mix.engagement_score !== null ? (
                            <Chip
                              label={`${formatNumber(mix.engagement_score)}%`}
                              size="small"
                              color={mix.engagement_score > 70 ? 'success' : mix.engagement_score > 50 ? 'warning' : 'default'}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>{mix.execution_count}</TableCell>
                        <TableCell>{mix.total_items}</TableCell>
                        <TableCell>
                          {mix.generated_at ? formatDate(mix.generated_at) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Performance por Totem */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                Performance por Totem
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Totem</TableCell>
                      <TableCell>Mixagens</TableCell>
                      <TableCell>Engajamento Médio</TableCell>
                      <TableCell>Execuções Totais</TableCell>
                      <TableCell>Itens Médios</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.byTotem.map((totem) => (
                      <TableRow key={totem.totem_id} hover>
                        <TableCell>
                          {totem.totem_name || totem.totem_identifier || `Totem ${totem.totem_id}`}
                        </TableCell>
                        <TableCell>{totem.mix_count}</TableCell>
                        <TableCell>
                          <Chip
                            label={`${formatNumber(totem.avg_engagement)}%`}
                            size="small"
                            color={totem.avg_engagement > 70 ? 'success' : totem.avg_engagement > 50 ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{totem.total_executions}</TableCell>
                        <TableCell>{formatNumber(totem.avg_items)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default PlaylistMixAnalytics;

