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
  useMediaQuery,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
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
import { Publisher } from '../../services/api';
import ResponsiveSectionNav from '../../components/Navigation/ResponsiveSectionNav';
import { getForeignTotemIdFromRow, getPublisherIdFromRow, getTotemIdFromRow } from '../../utils/totemRowIds';
import { isStudioMode } from '../../config/studioMode';
import { getProductTerminology } from '../../config/productTerminology';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`totem-playlist-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 0.5, sm: 1, md: 2 } }}>{children}</Box>}
    </div>
  );
}

const TotemPlayListPage: React.FC = () => {
  const orgTerms = getProductTerminology();
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
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

      const totemsRes = await totemApi.getAll({ limit: 100 });

      // Blindagem: algumas APIs retornam formatos diferentes; garantir arrays sempre
      const totemsData = Array.isArray((totemsRes as any)?.data)
        ? (totemsRes as any).data
        : Array.isArray((totemsRes as any)?.data?.data)
          ? (totemsRes as any).data.data
          : [];

      setTotems(totemsData);
      if (!isStudioMode()) {
        const { publisherApi } = await import('../../services/api');
        const publishersRes = await publisherApi.getAll({ active_only: true });
        const publishersData = Array.isArray((publishersRes as any)?.data)
          ? (publishersRes as any).data
          : Array.isArray((publishersRes as any)?.data?.data)
            ? (publishersRes as any).data.data
            : [];
        setPublishers(publishersData);
      } else {
        setPublishers([]);
      }
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

  const totemPlaylistSections = [
    { label: 'Lista de Totens', icon: Tv },
    { label: 'Timeline/Grade', icon: Schedule, disabled: !selectedPlaylist },
    {
      label: isStudioMode() ? 'Detalhes' : 'Detalhes de Anunciantes',
      icon: Business,
      disabled: !selectedPlaylist,
    },
    ...(!isStudioMode()
      ? [{ label: 'Validações', icon: CheckCircle, disabled: !selectedPlaylist }]
      : []),
  ] as const;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            📺 Playlists de Totens
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Visualize e regenere a playlist consolidada por Totem
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<Refresh />} onClick={loadPlaylists} disabled={loading}>
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
            {!isStudioMode() && (
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel {...selectLabelShrinkProps} id="totem-playlists-filter-publisher-label">{orgTerms.organization}</InputLabel>
                <Select
                  id="totem-playlists-filter-publisher"
                  labelId="totem-playlists-filter-publisher-label"
                  value={filters.publisherId}
                  label={orgTerms.organization}
                  onChange={(e) => setFilters({ ...filters, publisherId: e.target.value })}
                  inputProps={{ name: 'publisherId' }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {publishers
                    .map((pub: any) => {
                      const publisherId = getPublisherIdFromRow(pub);
                      if (publisherId === undefined || publisherId <= 0) return null;
                      return (
                        <MenuItem key={`publisher-${publisherId}`} value={String(publisherId)}>
                          {pub?.name || `${orgTerms.organization} #${publisherId}`}
                        </MenuItem>
                      );
                    })
                    .filter(Boolean)}
                </Select>
              </FormControl>
            </Grid>
            )}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel {...selectLabelShrinkProps} id="totem-playlists-filter-totem-label">Totem</InputLabel>
                <Select
                  id="totem-playlists-filter-totem"
                  labelId="totem-playlists-filter-totem-label"
                  value={filters.totemId}
                  label="Totem"
                  onChange={(e) => setFilters({ ...filters, totemId: e.target.value })}
                  inputProps={{ name: 'totemId' }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {totems
                    .map((totem: any) => {
                      const totemId = getTotemIdFromRow(totem);
                      if (totemId === undefined) return null;
                      return (
                        <MenuItem key={`totem-${totemId}`} value={String(totemId)}>
                          {totem?.name || totem?.identifier || `Totem #${totemId}`}
                        </MenuItem>
                      );
                    })
                    .filter(Boolean)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <ResponsiveSectionNav
          sections={totemPlaylistSections}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="totem-playlist"
        />

        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <LinearProgress />
          ) : playlists.length === 0 ? (
            <Alert severity="info">
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Nenhuma playlist encontrada</Typography>
              {isStudioMode() ? (
                <Typography variant="body2" component="div">
                  No TotemDigital, a <strong>playlist consolidada</strong> do totem é criada quando há conteúdo para o motor processar: por exemplo <strong>campanha ativa</strong> com este totem associado (e mídias/playlists válidas), ou após usar <strong>Regenerar</strong> quando já existir dados para esse totem. Se ainda não configurou campanhas, comece em <strong>Campanhas</strong> ou associe mídias/playlists ao fluxo do totem. O dispatcher usa esta lista como fallback quando não há plano só de campanha.
                </Typography>
              ) : (
                <Typography variant="body2" component="span">
                  {`Para as playlists aparecerem: contrato do anunciante com plano que tenha acesso a esta ${orgTerms.organization.toLowerCase()}; campanha ativa com esta ${orgTerms.organization.toLowerCase()} em ${orgTerms.campaignOrganizationsTab.toUpperCase()} e com playlists ou mídias diretas; depois use "Regenerar" ou aguarde o totem solicitar o plano. Consulte docs/FLUXO_PLAYLIST_POR_TOTEM.md para o fluxo completo.`}
                </Typography>
              )}
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {playlists.map((playlist) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={playlist.totem_playlist_id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Box>
                          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tv fontSize="small" />
                            {playlist.totem_name || `Totem #${playlist.totem_id}`}
                          </Typography>
                          {!isStudioMode() && (
                            <Typography variant="body2" color="text.secondary">
                              {playlist.publisher_name || `Publisher #${playlist.publisher_id}`}
                            </Typography>
                          )}
                        </Box>
                        <Chip label={`v${playlist.version}`} size="small" />
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="body2" color="text.secondary">
                        Itens: <strong>{playlist.total_items}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Duração: <strong>{formatDuration(playlist.total_duration_seconds)}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Atualizada: <strong>{formatDate(playlist.last_updated_at)}</strong>
                      </Typography>

                      <Box sx={{ mt: 2 }}>
                        <Chip
                          label={playlist.status}
                          size="small"
                          color={playlist.status === 'active' ? 'success' : playlist.status === 'paused' ? 'warning' : 'default'}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                        <Tooltip title="Visualizar Playlist">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const tid =
                                getForeignTotemIdFromRow(playlist) ??
                                (playlist as any).totem_id;
                              handleOpenPlaylist(tid);
                            }}
                            disabled={loadingPlaylist}
                          >
                            <PlayArrow />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Regenerar Playlist">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const tid =
                                getForeignTotemIdFromRow(playlist) ??
                                (playlist as any).totem_id;
                              handleRegenerate(tid);
                            }}
                            disabled={loading}
                          >
                            <Refresh />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
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
                      <TableCell>Anunciante ID</TableCell>
                      <TableCell>Duração</TableCell>
                      <TableCell>Prioridade</TableCell>
                      <TableCell>Horário</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPlaylist.items || []).map((item, index) => (
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
                {isStudioMode() ? 'Detalhes da playlist' : 'Detalhes por Anunciante'}
              </Typography>
              {isStudioMode() ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Lista técnica dos itens consolidados neste totem (origem campanha, mídias, etc.). Use o separador <strong>Timeline/Grade</strong> para a ordem de exibição.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Em desenvolvimento: Agrupar itens por subscriber e mostrar estatísticas
                </Alert>
              )}
            </Box>
          ) : (
            <Alert severity="info">Selecione uma playlist para visualizar os detalhes</Alert>
          )}
        </TabPanel>

        {!isStudioMode() && (
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
        )}
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
                      <TableCell>Anunciante</TableCell>
                      <TableCell>Duração</TableCell>
                      <TableCell>Prioridade</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedPlaylist.items || []).map((item, index) => (
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
