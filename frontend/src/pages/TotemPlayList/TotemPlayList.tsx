/**
 * TotemPlayList Page - Smart Signage v2.1
 * Página para visualizar e gerenciar as playlists de cada totem
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
  Alert,
  useTheme,
  Tabs,
  Tab,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Refresh,
  PlayArrow,
  CheckCircle,
  Warning,
  Error,
  Info,
  Tv,
  Schedule,
  Business,
  AccountTree,
} from '@mui/icons-material';
import { totemPlaylistApi, TotemPlaylist, TotemPlaylistListItem, TotemPlaylistItem } from '../../services/api';
import { totemApi, Player } from '../../services/api';
import { publisherApi, Publisher } from '../../services/api';

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

const TotemPlayListPage: React.FC = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  
  // Estados comuns
  const [playlists, setPlaylists] = useState<TotemPlaylistListItem[]>([]);
  const [totems, setTotems] = useState<Player[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  // Filtros
  const [filters, setFilters] = useState({
    publisherId: '',
    totemId: '',
  });

  // Playlist selecionada
  const [selectedPlaylist, setSelectedPlaylist] = useState<TotemPlaylist | null>(null);
  const [selectedTotemId, setSelectedTotemId] = useState<number | null>(null);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [page, filters]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [totemsRes, publishersRes] = await Promise.all([
        totemApi.getAll({ limit: 1000 }),
        publisherApi.getAll({ active_only: true }),
      ]);

      setTotems(totemsRes.data || []);
      setPublishers(publishersRes.data || []);
    } catch (e: any) {
      setError('Erro ao carregar dados: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page,
        limit,
      };

      if (filters.publisherId) {
        params.publisherId = parseInt(filters.publisherId);
      }

      if (filters.totemId) {
        params.totemId = parseInt(filters.totemId);
      }

      const response = await totemPlaylistApi.getAll(params);
      setPlaylists(response.data || []);
      setTotal(response.total || 0);
    } catch (e: any) {
      setError('Erro ao carregar playlists: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPlaylist = async (totemId: number) => {
    try {
      setLoadingPlaylist(true);
      setSelectedTotemId(totemId);
      const playlist = await totemPlaylistApi.getByTotemId(totemId);
      setSelectedPlaylist(playlist);
      setPlaylistDialogOpen(true);
    } catch (e: any) {
      setError('Erro ao carregar playlist: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const handleRegenerate = async (totemId: number) => {
    try {
      setLoading(true);
      await totemPlaylistApi.regenerate(totemId, undefined, true);
      await loadPlaylists();
      setError(null);
    } catch (e: any) {
      setError('Erro ao regenerar playlist: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDate = (date: Date | string): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('pt-BR');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Playlists de Totens
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadPlaylists}
          disabled={loading}
        >
          Atualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Publisher</InputLabel>
                <Select
                  value={filters.publisherId}
                  label="Publisher"
                  onChange={(e) => setFilters({ ...filters, publisherId: e.target.value })}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {publishers.map((pub) => (
                    <MenuItem key={pub.publisher_id} value={pub.publisher_id.toString()}>
                      {pub.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>Totem</InputLabel>
                <Select
                  value={filters.totemId}
                  label="Totem"
                  onChange={(e) => setFilters({ ...filters, totemId: e.target.value })}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {totems.map((totem) => (
                    <MenuItem key={totem.totem_id} value={totem.totem_id.toString()}>
                      {totem.name || totem.identifier}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Lista de Totens" icon={<Tv />} iconPosition="start" />
            <Tab label="Timeline/Grade" icon={<Schedule />} iconPosition="start" disabled={!selectedPlaylist} />
            <Tab label="Detalhes Subscribers" icon={<Business />} iconPosition="start" disabled={!selectedPlaylist} />
            <Tab label="Validações" icon={<CheckCircle />} iconPosition="start" disabled={!selectedPlaylist} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <LinearProgress />
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Totem</TableCell>
                    <TableCell>Publisher</TableCell>
                    <TableCell>Versão</TableCell>
                    <TableCell>Itens</TableCell>
                    <TableCell>Duração Total</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Última Atualização</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {playlists.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography variant="body2" color="text.secondary">
                          Nenhuma playlist encontrada
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    playlists.map((playlist) => (
                      <TableRow key={playlist.totem_playlist_id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tv fontSize="small" />
                            <Typography variant="body2" fontWeight={500}>
                              {playlist.totem_name || `Totem #${playlist.totem_id}`}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{playlist.publisher_name || `Publisher #${playlist.publisher_id}`}</TableCell>
                        <TableCell>
                          <Chip label={`v${playlist.version}`} size="small" />
                        </TableCell>
                        <TableCell>{playlist.total_items}</TableCell>
                        <TableCell>{formatDuration(playlist.total_duration_seconds)}</TableCell>
                        <TableCell>
                          <Chip
                            label={playlist.status}
                            size="small"
                            color={playlist.status === 'active' ? 'success' : playlist.status === 'paused' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{formatDate(playlist.last_updated_at)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Visualizar Playlist">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenPlaylist(playlist.totem_id)}
                              disabled={loadingPlaylist}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Regenerar Playlist">
                            <IconButton
                              size="small"
                              onClick={() => handleRegenerate(playlist.totem_id)}
                              disabled={loading}
                            >
                              <Refresh />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {selectedPlaylist ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Timeline/Grade - {selectedPlaylist.totem_name || `Totem #${selectedPlaylist.totem_id}`}
              </Typography>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Ordem</TableCell>
                      <TableCell>Mídia ID</TableCell>
                      <TableCell>Campanha ID</TableCell>
                      <TableCell>Subscriber ID</TableCell>
                      <TableCell>Duração</TableCell>
                      <TableCell>Prioridade</TableCell>
                      <TableCell>Horário</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedPlaylist.items.map((item, index) => (
                      <TableRow key={item.item_id || index}>
                        <TableCell>{item.order_index + 1}</TableCell>
                        <TableCell>{item.media_id}</TableCell>
                        <TableCell>{item.campaign_id || '-'}</TableCell>
                        <TableCell>{item.subscriber_id}</TableCell>
                        <TableCell>{item.display_seconds ? `${item.display_seconds}s` : '-'}</TableCell>
                        <TableCell>{item.priority}</TableCell>
                        <TableCell>
                          {item.start_time && item.end_time
                            ? `${item.start_time} - ${item.end_time}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : (
            <Alert severity="info">Selecione uma playlist para visualizar a timeline</Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {selectedPlaylist ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Detalhes por Subscriber
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Em desenvolvimento: Agrupar itens por subscriber e mostrar estatísticas
              </Alert>
            </Box>
          ) : (
            <Alert severity="info">Selecione uma playlist para visualizar os detalhes</Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {selectedPlaylist ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Validações
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Em desenvolvimento: Mostrar validações de contratos, planos e acessos
              </Alert>
            </Box>
          ) : (
            <Alert severity="info">Selecione uma playlist para visualizar as validações</Alert>
          )}
        </TabPanel>
      </Card>

      {/* Dialog para visualizar playlist completa */}
      <Dialog
        open={playlistDialogOpen}
        onClose={() => setPlaylistDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Playlist - {selectedPlaylist?.totem_name || `Totem #${selectedTotemId}`}
        </DialogTitle>
        <DialogContent>
          {loadingPlaylist ? (
            <LinearProgress />
          ) : selectedPlaylist ? (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Versão
                  </Typography>
                  <Typography variant="body1">{selectedPlaylist.version}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Total de Itens
                  </Typography>
                  <Typography variant="body1">{selectedPlaylist.total_items}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Duração Total
                  </Typography>
                  <Typography variant="body1">{formatDuration(selectedPlaylist.total_duration_seconds)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Gerada em
                  </Typography>
                  <Typography variant="body1">{formatDate(selectedPlaylist.generated_at || '')}</Typography>
                </Grid>
              </Grid>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ordem</TableCell>
                      <TableCell>Mídia ID</TableCell>
                      <TableCell>Campanha</TableCell>
                      <TableCell>Subscriber</TableCell>
                      <TableCell>Duração</TableCell>
                      <TableCell>Prioridade</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedPlaylist.items.map((item, index) => (
                      <TableRow key={item.item_id || index}>
                        <TableCell>{item.order_index + 1}</TableCell>
                        <TableCell>{item.media_id}</TableCell>
                        <TableCell>{item.campaign_id || '-'}</TableCell>
                        <TableCell>{item.subscriber_id}</TableCell>
                        <TableCell>{item.display_seconds ? `${item.display_seconds}s` : '-'}</TableCell>
                        <TableCell>{item.priority}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaylistDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TotemPlayListPage;
