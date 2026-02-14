/**
 * Network Topology - Dashboard visual da rede
 * Exibe hierarquia: Publishers → Locals → Totens → Smart TVs com mídias atreladas
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
} from '@mui/material';
import {
  Business,
  LocationOn,
  Computer,
  Tv,
  VideoLibrary,
  ExpandMore,
  Refresh,
  Wifi,
  WifiOff,
  AccountTree,
  ViewList,
} from '@mui/icons-material';
import { networkTopologyApi, NetworkTopologyPublisher } from '../../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HoloGraphNetwork from '../../components/HoloGraphNetwork/HoloGraphNetwork';
import { NODE_TYPE_LABELS } from '@shared/holograph-adapter';
import type { GraphNode } from '@shared/holograph-adapter';

const formatLastHeartbeat = (ts: string | undefined) => {
  if (!ts) return '-';
  const d = new Date(ts);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 60000;
  if (diff < 5) return 'Online';
  if (diff < 60) return `${Math.round(diff)} min`;
  return d.toLocaleDateString('pt-BR');
};

type ViewMode = 'list' | 'graph';

const NetworkTopology: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = (searchParams.get('view') === 'graph' ? 'graph' : 'list') as ViewMode;
  const initialDay = searchParams.get('day');
  const initialTime = searchParams.get('time') ?? '';
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [topology, setTopology] = useState<NetworkTopologyPublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphFilterDay, setGraphFilterDay] = useState<number | ''>(
    initialDay !== null && initialDay !== '' ? parseInt(initialDay, 10) : ''
  );
  const [graphFilterTime, setGraphFilterTime] = useState<string>(initialTime);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<GraphNode[] | null>(null);
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);

  const updateGraphParams = (day: number | '', time: string) => {
    const next = new URLSearchParams(searchParams);
    if (viewMode === 'graph') {
      next.set('view', 'graph');
      if (day !== '') next.set('day', String(day));
      else next.delete('day');
      if (time) next.set('time', time);
      else next.delete('time');
      setSearchParams(next, { replace: true });
    }
  };

  const loadTopology = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await networkTopologyApi.getTopology();
      setTopology(res.data || []);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Erro ao carregar topologia');
      setTopology([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopology();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setSelectedNodePath(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (loading && viewMode === 'list') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          Rede Visual
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonGroup size="small" variant="outlined">
            <Button
              startIcon={<ViewList />}
              onClick={() => setViewMode('list')}
              variant={viewMode === 'list' ? 'contained' : 'outlined'}
            >
              Lista
            </Button>
            <Button
              startIcon={<AccountTree />}
              onClick={() => setViewMode('graph')}
              variant={viewMode === 'graph' ? 'contained' : 'outlined'}
            >
              Grafo
            </Button>
          </ButtonGroup>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              loadTopology();
              if (viewMode === 'graph') setGraphRefreshKey((k) => k + 1);
            }}
            size="small"
          >
            Atualizar
          </Button>
        </Box>
      </Box>

      {viewMode === 'graph' && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Dia da semana</InputLabel>
              <Select
                value={graphFilterDay}
                label="Dia da semana"
                onChange={(e) => {
                  const v = e.target.value === '' ? '' : Number(e.target.value);
                  setGraphFilterDay(v);
                  updateGraphParams(v, graphFilterTime);
                }}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value={0}>Domingo</MenuItem>
                <MenuItem value={1}>Segunda</MenuItem>
                <MenuItem value={2}>Terça</MenuItem>
                <MenuItem value={3}>Quarta</MenuItem>
                <MenuItem value={4}>Quinta</MenuItem>
                <MenuItem value={5}>Sexta</MenuItem>
                <MenuItem value={6}>Sábado</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Horário</InputLabel>
              <Select
                value={graphFilterTime}
                label="Horário"
                onChange={(e) => {
                  const v = e.target.value as string;
                  setGraphFilterTime(v);
                  updateGraphParams(graphFilterDay, v);
                }}
              >
                <MenuItem value="">Qualquer</MenuItem>
                {Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`).map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <HoloGraphNetwork
            key={graphRefreshKey}
            height={520}
            dayOfWeek={graphFilterDay === '' ? undefined : graphFilterDay}
            time={graphFilterTime || undefined}
            onNodeClick={(n, pathFromRoot) => {
              setSelectedNode(n);
              setSelectedNodePath(pathFromRoot ?? null);
            }}
          />
          {selectedNode && (
            <Paper sx={{ mt: 1.5, p: 2, bgcolor: alpha(theme.palette.background.paper, 0.95) }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Nó selecionado</Typography>
                  {selectedNodePath && selectedNodePath.length > 1 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {selectedNodePath.map((n) => n.label ?? n.id).join(' › ')}
                    </Typography>
                  )}
                  <Typography variant="body1" fontWeight="bold">{selectedNode.label ?? selectedNode.id}</Typography>
                  <Chip size="small" label={NODE_TYPE_LABELS[selectedNode.type ?? ''] ?? selectedNode.type ?? '—'} sx={{ mt: 0.5 }} />
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                    Pressione Esc para limpar
                  </Typography>
                </Box>
                <Button size="small" onClick={() => { setSelectedNode(null); setSelectedNodePath(null); }}>Limpar</Button>
              </Box>
              {selectedNode.meta && Object.keys(selectedNode.meta).length > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  {selectedNode.meta.address != null && (
                    <Typography variant="body2" color="text.secondary">Endereço: {String(selectedNode.meta.address)}</Typography>
                  )}
                  {(selectedNode.meta.dayOfWeek as number[] | undefined)?.length != null && (
                    <Typography variant="body2" color="text.secondary">
                      Dias: {[0,1,2,3,4,5,6].filter((d) => (selectedNode.meta?.dayOfWeek as number[])?.includes(d)).map((d) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join(', ') || '—'}
                    </Typography>
                  )}
                  {(selectedNode.meta.startTime != null || selectedNode.meta.endTime != null) && (
                    <Typography variant="body2" color="text.secondary">
                      Horário: {String(selectedNode.meta.startTime ?? '—')} – {String(selectedNode.meta.endTime ?? '—')}
                    </Typography>
                  )}
                  {selectedNode.meta.mediaIds != null && (
                    <Typography variant="body2" color="text.secondary">Mídias: {(selectedNode.meta.mediaIds as string[])?.length ?? 0} itens</Typography>
                  )}
                  {selectedNode.meta.playlistIds != null && (
                    <Typography variant="body2" color="text.secondary">Playlists: {(selectedNode.meta.playlistIds as string[])?.length ?? 0} itens</Typography>
                  )}
                  <Box component="pre" sx={{ mt: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 100 }}>
                    {JSON.stringify(selectedNode.meta, null, 2)}
                  </Box>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      )}

      {viewMode === 'list' && error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {viewMode === 'list' && topology.length === 0 && !error && (
        <Alert severity="info">Nenhum publicador encontrado.</Alert>
      )}

      {viewMode === 'list' && (
        <>
      {topology.map((pub) => (
        <Accordion
          key={pub.id}
          defaultExpanded={topology.length <= 3}
          sx={{
            mb: 1,
            '&:before': { display: 'none' },
            borderRadius: 1,
            overflow: 'hidden',
            boxShadow: 1,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 },
            }}
          >
            <Business color="primary" />
            <Typography variant="subtitle1" fontWeight="600">
              {pub.name}
            </Typography>
            <Chip
              label={`${pub.locals?.length || 0} locais`}
              size="small"
              variant="outlined"
            />
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {(!pub.locals || pub.locals.length === 0) && (
              <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                Sem locais cadastrados
              </Typography>
            )}
            {pub.locals?.map((loc) => (
              <Accordion
                key={`${pub.id}-${loc.id}`}
                sx={{
                  mb: 1,
                  '&:before': { display: 'none' },
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMore />}
                  sx={{
                    bgcolor: alpha(theme.palette.secondary.main, 0.04),
                    '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 },
                  }}
                >
                  <LocationOn fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight="500">
                    {loc.name}
                  </Typography>
                  <Chip
                    label={`${loc.totems?.length || 0} totens`}
                    size="small"
                    variant="outlined"
                  />
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  {(!loc.totems || loc.totems.length === 0) && (
                    <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                      Sem totens neste local
                    </Typography>
                  )}
                  {loc.totems?.map((tot) => (
                    <Card
                      key={tot.id}
                      variant="outlined"
                      sx={{
                        mb: 1.5,
                        borderRadius: 1,
                        overflow: 'hidden',
                      }}
                    >
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            flexWrap: 'wrap',
                            mb: tot.smartTvs?.length ? 1 : 0,
                          }}
                        >
                          <Computer fontSize="small" color="action" />
                          <Typography variant="body2" fontWeight="500">
                            {tot.name || tot.identifier}
                          </Typography>
                          <Chip
                            size="small"
                            label={tot.status || 'unknown'}
                            color={
                              tot.status === 'online'
                                ? 'success'
                                : tot.status === 'offline'
                                ? 'error'
                                : 'default'
                            }
                            icon={
                              tot.status === 'online' ? (
                                <Wifi sx={{ fontSize: 14 }} />
                              ) : (
                                <WifiOff sx={{ fontSize: 14 }} />
                              )
                            }
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            icon={<VideoLibrary sx={{ fontSize: 14 }} />}
                            label={`${tot.mediaCount} mídias`}
                            onClick={() => navigate(`/totems/${tot.id}`)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </Box>
                        {tot.smartTvs && tot.smartTvs.length > 0 && (
                          <List dense disablePadding>
                            {tot.smartTvs.map((tv) => (
                              <ListItem
                                key={tv.id}
                                disablePadding
                                sx={{
                                  pl: 3,
                                  py: 0.25,
                                  borderLeft: 2,
                                  borderColor: 'divider',
                                  ml: 1,
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                  <Tv fontSize="small" color="action" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={tv.name || tv.identifier}
                                  secondary={
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {tv.status} • {formatLastHeartbeat(tv.lastHeartbeat)}
                                      {(tv.mediaCount ?? 0) > 0 && ` • ${tv.mediaCount} mídias`}
                                    </Typography>
                                  }
                                  primaryTypographyProps={{ variant: 'body2' }}
                                />
                                {(tv.mediaCount ?? 0) > 0 && (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    icon={<VideoLibrary sx={{ fontSize: 14 }} />}
                                    label={`${tv.mediaCount} mídias`}
                                    sx={{ mr: 0.5 }}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  label={tv.status}
                                  color={
                                    tv.status === 'online'
                                      ? 'success'
                                      : tv.status === 'offline'
                                      ? 'error'
                                      : 'default'
                                  }
                                  sx={{ ml: 0.5 }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
        </>
      )}
    </Box>
  );
};

export default NetworkTopology;
