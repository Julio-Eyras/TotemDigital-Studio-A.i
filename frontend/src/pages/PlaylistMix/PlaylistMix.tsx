import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Tooltip,
  IconButton,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Stack,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
} from '@mui/material';
import {
  PlayArrow,
  Refresh,
  Schedule,
  InfoOutlined,
} from '@mui/icons-material';
import { totemApi, Player } from '../../services/api';
import {
  getCurrentMix,
  generateMix,
  getAIContext,
  getMixHistory,
  getMixRules,
  TotemPlaylistMix,
  AIContext,
  MixHistory,
  MixRule,
} from '../../services/api/playlistMixApi';

const PlaylistMix: React.FC = () => {
  const theme = useTheme();
  const [totems, setTotems] = useState<Player[]>([]);
  const [selectedTotemId, setSelectedTotemId] = useState<number | ''>('');

  const [mix, setMix] = useState<TotemPlaylistMix | null>(null);
  const [aiContext, setAiContext] = useState<AIContext | null>(null);
  const [rules, setRules] = useState<MixRule[]>([]);
  const [history, setHistory] = useState<MixHistory[]>([]);

  const [loadingTotems, setLoadingTotems] = useState(false);
  const [loadingMix, setLoadingMix] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize] = useState(10);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [historyFilters, setHistoryFilters] = useState<{
    strategy?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  useEffect(() => {
    loadTotems();
  }, []);

  useEffect(() => {
    if (selectedTotemId) {
      loadAllForTotem(selectedTotemId);
    } else {
      setMix(null);
      setAiContext(null);
      setRules([]);
      setHistory([]);
    }
  }, [selectedTotemId]);

  const loadTotems = async () => {
    try {
      setLoadingTotems(true);
      const resp = await totemApi.getAll();
      setTotems(resp.data || []);
    } catch (e: any) {
      setError('Erro ao carregar totems: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoadingTotems(false);
    }
  };

  const loadAllForTotem = async (totemId: number) => {
    try {
      setError(null);
      setLoadingMix(true);
      setLoadingHistory(true);

      const [mixResp, ctxResp, rulesResp, historyResp] = await Promise.all([
        getCurrentMix(totemId).catch(() => null),
        getAIContext(totemId).catch(() => null),
        getMixRules(totemId).catch(() => []),
        getMixHistory({ totemId, page: historyPage, limit: historyPageSize, ...historyFilters }).catch(() => ({
          data: [],
          pagination: { page: 1, limit: 10, total: 0 },
        })),
      ]);

      setMix(mixResp);
      setAiContext(ctxResp);
      setRules(Array.isArray(rulesResp) ? rulesResp : []);
      setHistory(historyResp.data || []);
      setHistoryPagination(historyResp.pagination || { page: 1, limit: 10, total: 0 });
    } catch (e: any) {
      setError('Erro ao carregar dados de mixagem: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoadingMix(false);
      setLoadingHistory(false);
    }
  };

  const loadHistory = async (totemId: number, page: number, filters?: any) => {
    try {
      setLoadingHistory(true);
      const historyResp = await getMixHistory({
        totemId,
        page,
        limit: historyPageSize,
        ...(filters || historyFilters),
      });
      setHistory(historyResp.data || []);
      setHistoryPagination(historyResp.pagination || { page: 1, limit: 10, total: 0 });
    } catch (e: any) {
      setError('Erro ao carregar histórico: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleGenerateMix = async () => {
    if (!selectedTotemId) return;
    try {
      setGenerating(true);
      setError(null);
      const newMix = await generateMix(selectedTotemId as number);
      setMix(newMix);
      setSuccess('Playlist mixada gerada com sucesso');
      // Recarregar histórico depois de gerar
      const historyResp = await getMixHistory({ totemId: selectedTotemId as number, page: 1, limit: 10 });
      setHistory(historyResp.data || []);
    } catch (e: any) {
      setError('Erro ao gerar mix: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setGenerating(false);
    }
  };

  const selectedTotem = useMemo(
    () => totems.find((t) => t.totem_id === selectedTotemId),
    [totems, selectedTotemId]
  );

  const formatDurationMinutes = (seconds: number) => {
    const mins = seconds / 60;
    return `${mins.toFixed(1)} min`;
  };

  // Resumo por campanha (quantidade de itens e duração total)
  const campaignSummary = useMemo(() => {
    if (!mix) return [];
    const byCampaign = new Map<number, { campaignId: number; items: number; duration: number }>();
    for (const item of mix.mix_items) {
      const dur = item.duration || 10;
      const existing = byCampaign.get(item.campaign_id) || {
        campaignId: item.campaign_id,
        items: 0,
        duration: 0,
      };
      existing.items += 1;
      existing.duration += dur;
      byCampaign.set(item.campaign_id, existing);
    }
    const arr = Array.from(byCampaign.values());
    const totalDuration = arr.reduce((sum, c) => sum + c.duration, 0) || 1;
    return arr
      .map((c) => ({
        ...c,
        sharePercent: (c.duration / totalDuration) * 100,
      }))
      .sort((a, b) => b.sharePercent - a.sharePercent);
  }, [mix]);

  // Mapa de cores para campanhas (determinístico)
  const getCampaignColor = (campaignId: number) => {
    const palette = [
      theme.palette.primary.main,
      theme.palette.success.main,
      theme.palette.info.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.secondary.main,
    ];
    const index = campaignId % palette.length;
    return palette[index];
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Playlist Mixer por Totem
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Visualize e gere a mixagem de campanhas, playlists e mídias para cada totem do publisher.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Recarregar totems e dados do mix">
            <span>
              <IconButton
                onClick={() => {
                  loadTotems();
                  if (selectedTotemId) loadAllForTotem(selectedTotemId as number);
                }}
                disabled={loadingTotems || loadingMix}
              >
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Seletor de Totem e resumo */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Seleção de Totem"
              subheader="Escolha um totem para ver e gerenciar sua playlist mixada."
            />
            <CardContent>
              {loadingTotems && <LinearProgress sx={{ mb: 2 }} />}
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel id="totem-select-label">Totem</InputLabel>
                <Select
                  labelId="totem-select-label"
                  label="Totem"
                  displayEmpty
                  value={selectedTotemId}
                  onChange={(e) => {
                    const v = e.target.value as any;
                    setSelectedTotemId(v === '' ? '' : Number(v));
                  }}
                >
                  <MenuItem value="">Selecione...</MenuItem>
                  {totems.map((t, idx) => {
                    const totemId = Number((t as any).totem_id ?? (t as any).id);
                    if (!totemId) return null;
                    return (
                      <MenuItem key={`totem-${totemId}-${idx}`} value={totemId}>
                        {t.name || t.identifier || `Totem ${totemId}`}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              {selectedTotem && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    Totem selecionado:
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {selectedTotem.totem_id} — {selectedTotem.location || 'Sem localização'}
                  </Typography>
                </Box>
              )}

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={handleGenerateMix}
                  disabled={!selectedTotemId || generating}
                  fullWidth
                >
                  {generating ? 'Gerando...' : 'Gerar nova mixagem'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Contexto de IA */}
          <Card sx={{ mt: 3 }}>
            <CardHeader
              title="Contexto de IA"
              subheader="Dados recentes de audiência e contexto usados para ajustar o mix."
              action={
                <Tooltip title="Contexto coletado via heartbeat e integrações de IA">
                  <IconButton size="small">
                    <InfoOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              }
            />
            <CardContent>
              {loadingMix && <LinearProgress sx={{ mb: 2 }} />}
              {!aiContext && (
                <Typography variant="body2" color="text.secondary">
                  Nenhum contexto de IA disponível para este totem ainda.
                </Typography>
              )}
              {aiContext && (
                <Box>
                  <Typography variant="body2">
                    Pessoas detectadas: <strong>{aiContext.pedestrian_count}</strong>{' '}
                    {aiContext.pedestrian_density && (
                      <Chip
                        size="small"
                        label={aiContext.pedestrian_density}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  {typeof aiContext.sentiment_score === 'number' && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Sentimento: <strong>{aiContext.sentiment_label || 'N/A'}</strong>{' '}
                      <Chip
                        size="small"
                        label={aiContext.sentiment_score.toFixed(2)}
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  )}
                  {aiContext.time_of_day && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Momento do dia: <strong>{aiContext.time_of_day}</strong>
                    </Typography>
                  )}
                  {aiContext.day_type && (
                    <Typography variant="body2">
                      Tipo de dia: <strong>{aiContext.day_type}</strong>
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Regras de mixagem */}
          <Card sx={{ mt: 3 }}>
            <CardHeader
              title="Regras de Mixagem"
              subheader="Regras ativas que influenciam a ordenação das campanhas."
            />
            <CardContent>
              {rules.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma regra de mixagem encontrada para este totem. A regra padrão será usada.
                </Typography>
              )}
              {rules.length > 0 && (
                <List dense>
                  {rules.map((rule) => (
                    <React.Fragment key={rule.rule_id}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {rule.name}
                              </Typography>
                              {rule.is_default && (
                                <Chip size="small" label="Padrão" color="primary" />
                              )}
                              {!rule.is_active && (
                                <Chip size="small" label="Inativa" color="default" />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              Tipo: {rule.rule_type} • Estratégia: {rule.rotation_strategy}
                            </Typography>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Chip
                            size="small"
                            icon={<Schedule fontSize="small" />}
                            label={`Máx. itens: ${rule.max_items_per_playlist}`}
                            variant="outlined"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Mix atual e histórico */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardHeader
              title="Playlist Mixada Atual"
              subheader={
                mix
                  ? `Versão ${mix.mix_version} • Itens: ${mix.total_items} • Duração total: ${formatDurationMinutes(
                      mix.total_duration || 0
                    )}`
                  : 'Nenhuma mixagem encontrada ainda para este totem.'
              }
            />
            <CardContent>
              {loadingMix && <LinearProgress sx={{ mb: 2 }} />}
              {!mix && !loadingMix && (
                <Typography variant="body2" color="text.secondary">
                  Selecione um totem e clique em "Gerar nova mixagem" para criar a primeira playlist mixada.
                </Typography>
              )}
              {mix && (
                <>
                  {/* Mapa visual de slots (timeline simples) */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Mapa visual de slots (ordem de exibição para este totem)
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: `1px solid ${theme.palette.divider}`,
                        height: 28,
                      }}
                    >
                      {mix.mix_items.map((item, index) => (
                        <Tooltip
                          key={`${item.campaign_id}-${item.media_id}-${index}`}
                          title={
                            <Box>
                              <Typography variant="caption">
                                Campanha {item.campaign_id} • Playlist {item.playlist_id}
                              </Typography>
                              <br />
                              <Typography variant="caption">
                                Mídia {item.media_id} • Duração: {(item.duration || 10)}s
                              </Typography>
                            </Box>
                          }
                        >
                          <Box
                            sx={{
                              flexGrow: item.duration || 10,
                              bgcolor: getCampaignColor(item.campaign_id),
                              opacity: 0.8,
                              '&:hover': {
                                opacity: 1,
                              },
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                    {/* Legenda por campanha */}
                    {campaignSummary.length > 0 && (
                      <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {campaignSummary.map((c) => (
                          <Chip
                            key={c.campaignId}
                            size="small"
                            label={`Campanha ${c.campaignId}: ${c.sharePercent.toFixed(
                              1
                            )}% do tempo (~${formatDurationMinutes(c.duration)})`}
                            sx={{
                              bgcolor: getCampaignColor(c.campaignId),
                              color: theme.palette.getContrastText(getCampaignColor(c.campaignId)),
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Lista detalhada de itens */}
                  <List dense>
                  {mix.mix_items.map((item, index) => (
                    <React.Fragment key={`${item.campaign_id}-${item.media_id}-${index}`}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip size="small" label={`#${index + 1}`} />
                              <Typography variant="body2">
                                Campanha {item.campaign_id} • Playlist {item.playlist_id} •
                                Mídia {item.media_id}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary">
                              Duração: {(item.duration || 10)}s • Peso: {item.weight.toFixed(2)} •
                              Prioridade: {item.priority.toFixed(2)}
                            </Typography>
                          }
                        />
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                  </List>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Histórico de Mixagens"
              subheader={
                historyPagination.total > 0
                  ? `Mostrando ${history.length} de ${historyPagination.total} mixagens`
                  : 'Últimas mixagens geradas para este totem.'
              }
              action={
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Estratégia</InputLabel>
                    <Select
                      value={historyFilters.strategy || 'all'}
                      onChange={(e) => {
                        setHistoryFilters({ ...historyFilters, strategy: e.target.value });
                        if (selectedTotemId) {
                          loadHistory(selectedTotemId as number, historyPage, {
                            ...historyFilters,
                            strategy: e.target.value === 'all' ? undefined : e.target.value,
                          });
                        }
                      }}
                      label="Estratégia"
                    >
                      <MenuItem value="all">Todas</MenuItem>
                      <MenuItem value="systematic">Systematic</MenuItem>
                      <MenuItem value="ai">AI</MenuItem>
                      <MenuItem value="hybrid">Hybrid</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Data início"
                    type="date"
                    value={historyFilters.startDate || ''}
                    onChange={(e) => {
                      setHistoryFilters({ ...historyFilters, startDate: e.target.value });
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                  <TextField
                    size="small"
                    label="Data fim"
                    type="date"
                    value={historyFilters.endDate || ''}
                    onChange={(e) => {
                      setHistoryFilters({ ...historyFilters, endDate: e.target.value });
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ width: 150 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      if (selectedTotemId) {
                        setHistoryPage(1);
                        loadHistory(selectedTotemId as number, 1, historyFilters);
                      }
                    }}
                  >
                    Filtrar
                  </Button>
                </Box>
              }
            />
            <CardContent>
              {loadingHistory && <LinearProgress sx={{ mb: 2 }} />}
              {history.length === 0 && !loadingHistory && (
                <Typography variant="body2" color="text.secondary">
                  Nenhum histórico de mixagens encontrado para este totem.
                </Typography>
              )}
              {history.length > 0 && (
                <>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ID</TableCell>
                          <TableCell>Estratégia</TableCell>
                          <TableCell>Itens</TableCell>
                          <TableCell>Duração</TableCell>
                          <TableCell>Engagement</TableCell>
                          <TableCell>Execuções</TableCell>
                          <TableCell>Gerada em</TableCell>
                          <TableCell>Aplicada em</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {history.map((h) => (
                          <TableRow key={h.history_id} hover>
                            <TableCell>{h.mix_id || 'N/A'}</TableCell>
                            <TableCell>
                              <Chip
                                label={h.mix_strategy || 'N/A'}
                                size="small"
                                color={
                                  h.mix_strategy === 'ai'
                                    ? 'warning'
                                    : h.mix_strategy === 'hybrid'
                                    ? 'success'
                                    : 'info'
                                }
                              />
                            </TableCell>
                            <TableCell>{h.total_items}</TableCell>
                            <TableCell>{formatDurationMinutes(h.total_duration || 0)}</TableCell>
                            <TableCell>
                              {h.engagement_score !== undefined ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={h.engagement_score}
                                    sx={{ width: 60, height: 8, borderRadius: 1 }}
                                  />
                                  <Typography variant="caption">
                                    {h.engagement_score.toFixed(1)}
                                  </Typography>
                                </Box>
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                            <TableCell>{h.execution_count || 0}</TableCell>
                            <TableCell>
                              {h.generated_at
                                ? new Date(h.generated_at).toLocaleString('pt-BR')
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {h.applied_at ? new Date(h.applied_at).toLocaleString('pt-BR') : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Página {historyPage} de {Math.ceil((historyPagination.total || 0) / historyPageSize)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        disabled={historyPage <= 1}
                        onClick={() => {
                          const newPage = historyPage - 1;
                          setHistoryPage(newPage);
                          if (selectedTotemId) {
                            loadHistory(selectedTotemId as number, newPage, historyFilters);
                          }
                        }}
                      >
                        Anterior
                      </Button>
                      <Button
                        size="small"
                        disabled={historyPage >= Math.ceil((historyPagination.total || 0) / historyPageSize)}
                        onClick={() => {
                          const newPage = historyPage + 1;
                          setHistoryPage(newPage);
                          if (selectedTotemId) {
                            loadHistory(selectedTotemId as number, newPage, historyFilters);
                          }
                        }}
                      >
                        Próxima
                      </Button>
                    </Box>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PlaylistMix;


