import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Alert,
  Chip,
  useTheme,
  alpha,
  Paper,
} from '@mui/material';
import {
  People,
  SentimentSatisfied,
  SentimentNeutral,
  SentimentDissatisfied,
  AccessTime,
  TrendingUp,
  SmartToy,
} from '@mui/icons-material';
import { totemApi, Player } from '../../services/api';
import { getAIContext, AIContext } from '../../services/api/playlistMixApi';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';

const AIContextDashboard: React.FC = () => {
  const theme = useTheme();
  const [totems, setTotems] = useState<Player[]>([]);
  const [selectedTotemId, setSelectedTotemId] = useState<number | ''>('');
  const [aiContext, setAiContext] = useState<AIContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTotems();
  }, []);

  useEffect(() => {
    if (selectedTotemId) {
      loadAIContext(selectedTotemId as number);
      // Atualizar contexto a cada 30 segundos
      const interval = setInterval(() => {
        loadAIContext(selectedTotemId as number);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [selectedTotemId]);

  const loadTotems = async () => {
    try {
      const resp = await totemApi.getAll();
      setTotems(resp.data || []);
    } catch (e: any) {
      setError('Erro ao carregar totens: ' + (e.message || 'Erro desconhecido'));
    }
  };

  const loadAIContext = async (totemId: number) => {
    try {
      setLoading(true);
      setError(null);
      const context = await getAIContext(totemId);
      setAiContext(context);
    } catch (e: any) {
      setError('Erro ao carregar contexto de IA: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const getSentimentIcon = (label?: string) => {
    switch (label) {
      case 'positive':
        return <SentimentSatisfied sx={{ color: theme.palette.success.main }} />;
      case 'negative':
        return <SentimentDissatisfied sx={{ color: theme.palette.error.main }} />;
      default:
        return <SentimentNeutral sx={{ color: theme.palette.warning.main }} />;
    }
  };

  const getDensityColor = (density?: string) => {
    switch (density) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const getSentimentColor = (score?: number) => {
    if (score === undefined) return theme.palette.grey[500];
    if (score > 0.3) return theme.palette.success.main;
    if (score < -0.3) return theme.palette.error.main;
    return theme.palette.warning.main;
  };

  // Dados para gráficos (mock - em produção viria do histórico)
  const pedestrianHistory = [
    { time: '08:00', count: 5 },
    { time: '09:00', count: 12 },
    { time: '10:00', count: 25 },
    { time: '11:00', count: 35 },
    { time: '12:00', count: 45 },
    { time: '13:00', count: 50 },
    { time: '14:00', count: 40 },
    { time: '15:00', count: 30 },
  ];

  const sentimentHistory = [
    { time: '08:00', score: 0.2 },
    { time: '09:00', score: 0.4 },
    { time: '10:00', score: 0.6 },
    { time: '11:00', score: 0.7 },
    { time: '12:00', score: 0.8 },
    { time: '13:00', score: 0.75 },
    { time: '14:00', score: 0.6 },
    { time: '15:00', score: 0.5 },
  ];

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
          Dashboard de Contexto de IA
        </Typography>
        <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
          Visualize dados de transeuntes, sentimento e contexto ambiental em tempo real
        </Typography>
      </Box>

      {/* Seleção de Totem */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <FormControl fullWidth>
            <InputLabel {...selectLabelShrinkProps}>Selecionar Totem</InputLabel>
            <Select
              value={selectedTotemId}
              onChange={(e) => setSelectedTotemId(e.target.value as number | '')}
              label="Selecionar Totem"
            >
              <MenuItem value="">Nenhum selecionado</MenuItem>
              {totems.map((totem) => (
                <MenuItem key={totem.totem_id} value={totem.totem_id}>
                  {totem.name || totem.identifier || `Totem ${totem.totem_id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!selectedTotemId && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Selecione um totem para visualizar o contexto de IA
        </Alert>
      )}

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {selectedTotemId && aiContext && (
        <Grid container spacing={3}>
          {/* Transeuntes */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <People sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {aiContext.pedestrian_count || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Transeuntes Detectados
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={aiContext.pedestrian_density || 'N/A'}
                  sx={{
                    bgcolor: getDensityColor(aiContext.pedestrian_density),
                    color: 'white',
                  }}
                />
                {aiContext.last_pedestrian_detection && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Última atualização:{' '}
                    {new Date(aiContext.last_pedestrian_detection).toLocaleString('pt-BR')}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Sentimento */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {getSentimentIcon(aiContext.sentiment_label)}
                  <Box sx={{ ml: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {aiContext.sentiment_score !== undefined
                        ? (aiContext.sentiment_score * 100).toFixed(0)
                        : 'N/A'}
                      %
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Score de Sentimento
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={aiContext.sentiment_label || 'N/A'}
                  sx={{
                    bgcolor: getSentimentColor(aiContext.sentiment_score),
                    color: 'white',
                  }}
                />
                {aiContext.emotion_tags && aiContext.emotion_tags.length > 0 && (
                  <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {aiContext.emotion_tags.map((tag, idx) => (
                      <Chip key={idx} label={tag} size="small" />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Contexto Temporal */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AccessTime sx={{ fontSize: 40, color: theme.palette.info.main, mr: 2 }} />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      {aiContext.time_of_day || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Período do Dia
                    </Typography>
                  </Box>
                </Box>
                <Chip label={aiContext.day_type || 'N/A'} sx={{ mb: 1 }} />
                {aiContext.weather_context && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Clima: {JSON.stringify(aiContext.weather_context)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Gráfico de Transeuntes */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Histórico de Transeuntes
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={pedestrianHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2}
                      name="Transeuntes"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Gráfico de Sentimento */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Histórico de Sentimento
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sentimentHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[-1, 1]} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="score"
                      fill={theme.palette.success.main}
                      name="Score de Sentimento"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Demografia */}
          {aiContext.pedestrian_demographics && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Demografia de Transeuntes
                  </Typography>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                    {JSON.stringify(aiContext.pedestrian_demographics, null, 2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Métricas de Performance */}
          {aiContext.performance_metrics && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <TrendingUp sx={{ fontSize: 32, color: theme.palette.success.main, mr: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                      Métricas de Performance
                    </Typography>
                  </Box>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                    {JSON.stringify(aiContext.performance_metrics, null, 2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
};

export default AIContextDashboard;

