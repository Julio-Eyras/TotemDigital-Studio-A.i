import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { AccessTime, Add, AudioFile, Delete, Edit, ErrorOutline, Image, PlayArrow, QueueMusic, Refresh, VideoLibrary } from '@mui/icons-material';
import {
  CreatePlaylistRequest,
  MediaItem,
  PlaylistCampaignInfo,
  PlaylistExposureResponse,
  PlaylistItem,
  PlaylistMediaItem,
  PlaylistItemScheduleSummary,
  Subscriber,
  mediaApi,
  playlistApi,
  subscriberApi,
} from '../../services/api';
import { useAppSelector } from '../../store/hooks';

type EditorMode = 'create' | 'edit';

const Playlists: React.FC = () => {
  const theme = useTheme();
  const user = useAppSelector((state) => state.auth.user);

  // Somente owner/admin/admin_sql podem escolher subscriber (multi-tenant)
  const canSelectSubscriber = useMemo(() => {
    const u: any = user;
    return ['owner_system', 'admin', 'admin_sql'].includes(u?.role || '');
  }, [user]);

  const userSubscriberId = useMemo(() => {
    const u: any = user;
    return u?.subscriberId ?? u?.subscriber_id ?? u?.clientId ?? undefined;
  }, [user]);

  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSubscriberId, setSelectedSubscriberId] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editorTab, setEditorTab] = useState(0);
  const [exposureTab, setExposureTab] = useState(0);

  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistItem | null>(null);
  const [draft, setDraft] = useState<CreatePlaylistRequest>({
    subscriberId: userSubscriberId,
    name: '',
    description: '',
  });

  const [playlistMedia, setPlaylistMedia] = useState<PlaylistMediaItem[]>([]);
  const [playlistCampaigns, setPlaylistCampaigns] = useState<PlaylistCampaignInfo[]>([]);
  const [playlistExposure, setPlaylistExposure] = useState<PlaylistExposureResponse | null>(null);

  useEffect(() => {
    if (canSelectSubscriber) void loadSubscribers();
    void loadPlaylists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSelectSubscriber, selectedSubscriberId, searchTerm]);

  useEffect(() => {
    // Carregar mídias quando editor abre (depende do subscriber alvo)
    if (!editorOpen) return;
    void loadMediaItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, editorMode, selectedPlaylist?.playlist_id, draft?.subscriberId]);

  useEffect(() => {
    // Para usuário "do subscriber", manter draft sempre fixo no subscriber do usuário
    if (!canSelectSubscriber) {
      setDraft((prev) => ({
        ...prev,
        subscriberId: userSubscriberId,
        clientId: userSubscriberId,
      }));
    }
  }, [canSelectSubscriber, userSubscriberId]);

  const loadSubscribers = async () => {
    try {
      const response = await subscriberApi.getAll({ limit: 10000, active_only: false });
      setSubscribers(response.data || []);
    } catch (e) {
      console.error('Erro ao carregar subscribers:', e);
    }
  };

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);

      let subscriberId: number | undefined = undefined;
      if (!canSelectSubscriber && userSubscriberId) {
        subscriberId = userSubscriberId;
      } else if (canSelectSubscriber && selectedSubscriberId !== 'all' && typeof selectedSubscriberId === 'number') {
        subscriberId = selectedSubscriberId;
      }

      const response = await playlistApi.getAll({
        search: searchTerm || undefined,
        subscriberId,
      });
      setPlaylists(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
      console.error('Erro ao carregar playlists:', e);
      setError('Erro ao carregar lista de playlists');
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const getTargetSubscriberIdForMedia = (): number | undefined => {
    if (editorMode === 'edit' && selectedPlaylist) return selectedPlaylist.subscriber_id || selectedPlaylist.client_id;
    if (editorMode === 'create') return draft.subscriberId || userSubscriberId;
    return userSubscriberId;
  };

  const loadMediaItems = async () => {
    try {
      const subscriberId = getTargetSubscriberIdForMedia();
      const response = await mediaApi.getAll({ subscriberId });
      setMediaItems(Array.isArray(response?.data) ? response.data : []);
    } catch (e) {
      console.error('Erro ao carregar mídias:', e);
      setMediaItems([]);
    }
  };

  const loadPlaylistMedia = async (playlistId: number) => {
    try {
      const media = await playlistApi.getMedia(playlistId);
      setPlaylistMedia(Array.isArray(media) ? media : []);
    } catch (e) {
      console.error('Erro ao carregar mídia da playlist:', e);
      setPlaylistMedia([]);
    }
  };

  const loadPlaylistCampaigns = async (playlistId: number) => {
    try {
      const campaigns = await playlistApi.getCampaigns(playlistId);
      setPlaylistCampaigns(Array.isArray(campaigns) ? campaigns : []);
    } catch (e) {
      console.error('Erro ao carregar campanhas da playlist:', e);
      setPlaylistCampaigns([]);
    }
  };

  const loadPlaylistExposure = async (playlistId: number) => {
    try {
      const exposure = await playlistApi.getExposure(playlistId);
      setPlaylistExposure(exposure || null);
    } catch (e) {
      console.error('Erro ao carregar exposição da playlist:', e);
      setPlaylistExposure(null);
    }
  };

  const openCreate = () => {
    setEditorMode('create');
    setEditorTab(0);
    setExposureTab(0);
    setSelectedPlaylist(null);
    setPlaylistMedia([]);
    setPlaylistCampaigns([]);
    setPlaylistExposure(null);
    setDraft({ subscriberId: userSubscriberId, clientId: userSubscriberId, name: '', description: '' });
    setEditorOpen(true);
  };

  const openEdit = async (pl: PlaylistItem) => {
    setEditorMode('edit');
    setEditorTab(0);
    setExposureTab(0);
    setSelectedPlaylist(pl);
    setEditorOpen(true);

    await loadPlaylistMedia(pl.playlist_id);
    await loadPlaylistCampaigns(pl.playlist_id);
    await loadPlaylistExposure(pl.playlist_id);
  };

  const handleCreatePlaylist = async () => {
    try {
      setError(null);
      const targetSubscriberId = canSelectSubscriber ? (draft.subscriberId || userSubscriberId) : userSubscriberId;
      if (!targetSubscriberId) {
        setError('É necessário selecionar um subscriber (anunciante) para criar a playlist.');
        return;
      }
      const playlistData: CreatePlaylistRequest = {
        name: draft.name,
        description: draft.description,
        subscriberId: targetSubscriberId,
        clientId: targetSubscriberId,
      };
      const created = await playlistApi.create(playlistData);
      setSelectedPlaylist(created);
      setEditorMode('edit');
      setEditorTab(1); // Mídias
      await loadPlaylists();
      await loadPlaylistMedia(created.playlist_id);
      await loadPlaylistCampaigns(created.playlist_id);
      await loadPlaylistExposure(created.playlist_id);
    } catch (e: any) {
      console.error('Erro ao criar playlist:', e);
      setError(e?.response?.data?.error || e?.message || 'Erro ao criar playlist');
    }
  };

  const handleSavePlaylist = async () => {
    if (!selectedPlaylist) return;
    try {
      setError(null);
      const targetSubscriberId =
        canSelectSubscriber ? (selectedPlaylist.subscriber_id || selectedPlaylist.client_id || userSubscriberId) : userSubscriberId;
      if (!targetSubscriberId) {
        setError('É necessário um subscriber (anunciante) válido para salvar a playlist.');
        return;
      }
      await playlistApi.update(selectedPlaylist.playlist_id, {
        name: selectedPlaylist.name,
        description: selectedPlaylist.description,
        subscriberId: targetSubscriberId,
        clientId: targetSubscriberId,
        isActive: selectedPlaylist.is_active,
      });
      await loadPlaylists();
    } catch (e: any) {
      console.error('Erro ao atualizar playlist:', e);
      setError(e?.response?.data?.error || e?.message || 'Erro ao atualizar playlist');
    }
  };

  const handleDeletePlaylist = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta playlist?')) return;
    try {
      await playlistApi.delete(id);
      await loadPlaylists();
    } catch (e) {
      console.error('Erro ao excluir playlist:', e);
      setError('Erro ao excluir playlist');
    }
  };

  const handleAddMediaToPlaylist = async (mediaId: number) => {
    if (!selectedPlaylist) return;
    try {
      setError(null);
      await playlistApi.addMedia(selectedPlaylist.playlist_id, mediaId);
      await loadPlaylistMedia(selectedPlaylist.playlist_id);
      await loadPlaylists();
    } catch (e: any) {
      console.error('Erro ao adicionar mídia:', e);
      setError(e?.response?.data?.error || e?.message || 'Erro ao adicionar mídia à playlist');
    }
  };

  const handleRemoveMediaFromPlaylist = async (itemId: number) => {
    if (!selectedPlaylist) return;
    try {
      await playlistApi.removeMedia(selectedPlaylist.playlist_id, itemId);
      await loadPlaylistMedia(selectedPlaylist.playlist_id);
      await loadPlaylists();
    } catch (e) {
      console.error('Erro ao remover mídia:', e);
      setError('Erro ao remover mídia da playlist');
    }
  };

  const getMediaIcon = (mediaType: string) => {
    switch ((mediaType || '').toLowerCase()) {
      case 'video':
        return <VideoLibrary />;
      case 'image':
        return <Image />;
      case 'audio':
        return <AudioFile />;
      default:
        return <VideoLibrary />;
    }
  };

  const formatDurationMs = (durationMs: number) => {
    const seconds = Math.floor((durationMs || 0) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (totalDurationMs?: number) => {
    if (!totalDurationMs) return '0:00';
    return formatDurationMs(totalDurationMs);
  };

  const normalizeDaysOfWeek = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.slice().sort().join(',');
    const s = String(v).trim();
    if (!s) return '';
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.slice().sort().join(',');
    } catch {
      // ignore
    }
    return s;
  };

  const scheduleKey = (startTime: unknown, endTime: unknown, days: unknown): string => {
    const st = startTime ? String(startTime).trim() : '';
    const et = endTime ? String(endTime).trim() : '';
    const dw = normalizeDaysOfWeek(days);
    return `${st}|${et}|${dw}`;
  };

  const computeScheduleConflict = (campaigns: PlaylistCampaignInfo[], itemSchedules: PlaylistItemScheduleSummary[]): boolean => {
    if (!campaigns?.length) return false;
    if (!itemSchedules?.length) return false;

    const distinctPlaylistKeys = new Set(itemSchedules.map((s) => scheduleKey(s.start_time, s.end_time, s.days_of_week)));
    // Se playlist tem múltiplas agendas distintas, é um potencial conflito (ambiguidade)
    if (distinctPlaylistKeys.size > 1) return true;

    const playlistOnlyKey = Array.from(distinctPlaylistKeys)[0] || '';
    // Se qualquer campanha define agenda e for diferente da agenda única da playlist, marcar conflito
    for (const c of campaigns) {
      const ck = scheduleKey(c.start_time, c.end_time, c.days_of_week);
      if (ck && playlistOnlyKey && ck !== playlistOnlyKey) return true;
    }
    return false;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography variant="h6" sx={{ mt: 2, textAlign: 'center' }}>
          Carregando playlists...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            Playlists
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Playlists pertencem a um subscriber e contêm mídias; campanhas apontam para playlists.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
          sx={{ backgroundColor: theme.palette.primary.main, '&:hover': { backgroundColor: theme.palette.primary.dark } }}
        >
          Criar Playlist
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            {canSelectSubscriber && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Subscriber (Anunciante)</InputLabel>
                  <Select
                    value={selectedSubscriberId}
                    onChange={(e) => setSelectedSubscriberId(e.target.value as number | 'all')}
                    label="Subscriber (Anunciante)"
                  >
                    <MenuItem value="all">Todos</MenuItem>
                    {subscribers.map((s) => (
                      <MenuItem key={s.subscriber_id} value={s.subscriber_id}>
                        {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} md={canSelectSubscriber ? 6 : 8}>
              <TextField
                fullWidth
                placeholder="Buscar playlists..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{ startAdornment: <QueueMusic sx={{ mr: 1, color: theme.palette.text.secondary }} /> }}
              />
            </Grid>
            <Grid item xs={12} md={canSelectSubscriber ? 2 : 4}>
              <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadPlaylists}>
                Atualizar
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

      <Grid container spacing={3}>
        {playlists.map((playlist) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={playlist.playlist_id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[8] },
              }}
            >
              <Box sx={{ position: 'relative', height: 120, backgroundColor: theme.palette.grey[100] }}>
                <Avatar
                  sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                  }}
                >
                  <QueueMusic />
                </Avatar>
                <Chip
                  label={`${playlist.media_count || 0} itens`}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    fontWeight: 'bold',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
                    right: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTime fontSize="small" color="action" />
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      {formatTotalDuration(playlist.total_duration)}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
                  {playlist.name}
                </Typography>
                {playlist.description && (
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }} noWrap>
                    {playlist.description}
                  </Typography>
                )}
                {playlist.subscriber_name && (
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                    Subscriber: {playlist.subscriber_name}
                  </Typography>
                )}

                <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Chip label={playlist.is_active ? 'Ativa' : 'Inativa'} size="small" color={playlist.is_active ? 'success' : 'default'} variant="outlined" />
                  <Box>
                    <Tooltip title="Abrir editor">
                      <IconButton size="small" onClick={() => openEdit(playlist)}>
                        <PlayArrow />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openEdit(playlist)}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton size="small" onClick={() => handleDeletePlaylist(playlist.playlist_id)}>
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {playlists.length === 0 && !loading && (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <QueueMusic sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Nenhuma playlist encontrada
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Comece criando suas primeiras playlists
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
              Criar Primeira Playlist
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{editorMode === 'create' ? 'Criar Playlist' : `Editar Playlist - ${selectedPlaylist?.name || ''}`}</DialogTitle>
        <DialogContent>
          <Tabs value={editorTab} onChange={(_, v) => setEditorTab(v)} sx={{ mb: 2 }}>
            <Tab label="Dados da Playlist" />
            <Tab label="Mídias" />
            <Tab label="Campanhas" disabled={!selectedPlaylist?.playlist_id} />
            <Tab label="Exposição" disabled={!selectedPlaylist?.playlist_id} />
          </Tabs>

          {editorTab === 0 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Playlist pertence a um <strong>subscriber</strong> e contém <strong>mídias</strong> via <strong>playlist_items</strong>.
                Campanhas apontam para playlists via <strong>campaign_playlists</strong>.
              </Alert>

              {canSelectSubscriber ? (
                <FormControl fullWidth margin="normal">
                  <InputLabel>Subscriber (Anunciante)</InputLabel>
                  <Select
                    value={editorMode === 'create' ? draft.subscriberId || '' : selectedPlaylist?.subscriber_id || selectedPlaylist?.client_id || ''}
                    onChange={(e) => {
                      const sid = e.target.value ? parseInt(String(e.target.value), 10) : undefined;
                      if (editorMode === 'create') setDraft({ ...draft, subscriberId: sid, clientId: sid });
                      else if (selectedPlaylist && sid) setSelectedPlaylist({ ...selectedPlaylist, subscriber_id: sid, client_id: sid });
                    }}
                    label="Subscriber (Anunciante)"
                  >
                    {subscribers.map((s) => (
                      <MenuItem key={s.subscriber_id} value={s.subscriber_id}>
                        {s.name} (ID: {s.subscriber_id})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Subscriber (Anunciante)"
                  value={
                    userSubscriberId
                      ? `${(user as any)?.subscriberName || 'Subscriber'} (ID: ${userSubscriberId})`
                      : '—'
                  }
                  disabled
                  helperText="Campo fixo: esta playlist pertence ao subscriber do usuário logado."
                />
              )}

              <TextField
                fullWidth
                label="Nome da Playlist *"
                value={editorMode === 'create' ? draft.name : selectedPlaylist?.name || ''}
                onChange={(e) => {
                  if (editorMode === 'create') setDraft({ ...draft, name: e.target.value });
                  else if (selectedPlaylist) setSelectedPlaylist({ ...selectedPlaylist, name: e.target.value });
                }}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Descrição"
                value={editorMode === 'create' ? draft.description || '' : selectedPlaylist?.description || ''}
                onChange={(e) => {
                  if (editorMode === 'create') setDraft({ ...draft, description: e.target.value });
                  else if (selectedPlaylist) setSelectedPlaylist({ ...selectedPlaylist, description: e.target.value });
                }}
                margin="normal"
                multiline
                rows={3}
              />
            </Box>
          )}

          {editorTab === 1 && (
            <Box>
              {!selectedPlaylist?.playlist_id ? (
                <Alert severity="warning">Crie a playlist primeiro para adicionar mídias.</Alert>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Mídias disponíveis
                    </Typography>
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                      Somente mídias do mesmo subscriber da playlist.
                    </Typography>
                    <List sx={{ maxHeight: 420, overflow: 'auto', mt: 1 }}>
                      {mediaItems.map((m) => (
                        <ListItem key={m.media_id} button onClick={() => handleAddMediaToPlaylist(m.media_id)}>
                          <Avatar sx={{ mr: 2, backgroundColor: alpha(theme.palette.primary.main, 0.1) }}>{getMediaIcon(m.media_type)}</Avatar>
                          <ListItemText primary={m.name} secondary={m.media_type} />
                        </ListItem>
                      ))}
                      {mediaItems.length === 0 && <Alert severity="info">Nenhuma mídia disponível para este subscriber.</Alert>}
                    </List>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      Itens da playlist ({playlistMedia.length})
                    </Typography>
                    <TableContainer component={Paper} sx={{ maxHeight: 420 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Ordem</TableCell>
                            <TableCell>Mídia</TableCell>
                            <TableCell>Duração</TableCell>
                            <TableCell>Ações</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {playlistMedia.map((it) => (
                            <TableRow key={it.item_id}>
                              <TableCell>{it.order_index}</TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 24, height: 24 }}>{getMediaIcon(it.media?.media_type || 'video')}</Avatar>
                                  <Typography variant="body2" noWrap>
                                    {it.media?.name || `Media ${it.media_id}`}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>{formatDurationMs(it.duration || 10000)}</TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={() => handleRemoveMediaFromPlaylist(it.item_id)}>
                                  <Delete />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                          {playlistMedia.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <Alert severity="info">Nenhuma mídia adicionada ainda.</Alert>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}

          {editorTab === 2 && (
            <Box>
              {!selectedPlaylist?.playlist_id ? (
                <Alert severity="warning">Salve a playlist para ver campanhas.</Alert>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Campanhas que apontam para esta playlist (via campaign_playlists).
                  </Alert>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>ID</TableCell>
                          <TableCell>Título</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Ativa</TableCell>
                          <TableCell>Início</TableCell>
                          <TableCell>Fim</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {playlistCampaigns.map((c) => (
                          <TableRow key={c.campaign_id}>
                            <TableCell>{c.campaign_id}</TableCell>
                            <TableCell>{c.title}</TableCell>
                            <TableCell>{c.status}</TableCell>
                            <TableCell>{c.is_active ? 'Sim' : 'Não'}</TableCell>
                            <TableCell>{c.start_date ? new Date(c.start_date).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                            <TableCell>{c.end_date ? new Date(c.end_date).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                        {playlistCampaigns.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <Alert severity="info">Nenhuma campanha usando esta playlist.</Alert>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          )}

          {editorTab === 3 && (
            <Box>
              {!selectedPlaylist?.playlist_id ? (
                <Alert severity="warning">Salve a playlist para ver exposição.</Alert>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Exposição derivada via campanhas → publishers → locals → totems → smart TVs (para entendimento/diagnóstico).
                  </Alert>
                  <Tabs value={exposureTab} onChange={(_, v) => setExposureTab(v)} sx={{ mb: 2 }}>
                    <Tab label="Datas" />
                    <Tab label="Horas" />
                    <Tab label="Publishers" />
                    <Tab label="Totens" />
                    <Tab label="Smart TVs" />
                  </Tabs>

                  {exposureTab === 0 && (
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell width={40}></TableCell>
                            <TableCell>Campanha</TableCell>
                            <TableCell>Datas (Campanha)</TableCell>
                            <TableCell>Datas (Playlist)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            const itemSchedules = (playlistExposure?.playlistItemSchedules || []) as PlaylistItemScheduleSummary[];
                            const conflict = computeScheduleConflict(playlistExposure?.campaigns || [], itemSchedules);
                            return (playlistExposure?.campaigns || []).map((c) => (
                            <TableRow key={c.campaign_id}>
                              <TableCell>
                                {conflict ? <ErrorOutline sx={{ color: theme.palette.error.main }} /> : null}
                              </TableCell>
                              <TableCell>{c.title}</TableCell>
                              <TableCell>
                                {c.start_date ? new Date(c.start_date).toLocaleDateString('pt-BR') : 'N/A'} →{' '}
                                {c.end_date ? new Date(c.end_date).toLocaleDateString('pt-BR') : 'N/A'}
                              </TableCell>
                              <TableCell>—</TableCell>
                            </TableRow>
                            ));
                          })()}
                          {(playlistExposure?.campaigns || []).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <Alert severity="info">Sem dados de exposição.</Alert>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {exposureTab === 1 && (
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell width={40}></TableCell>
                            <TableCell>Campanha</TableCell>
                            <TableCell>Agenda (Campanha)</TableCell>
                            <TableCell>Agenda (Playlist)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(() => {
                            const itemSchedules = (playlistExposure?.playlistItemSchedules || []) as PlaylistItemScheduleSummary[];
                            const conflict = computeScheduleConflict(playlistExposure?.campaigns || [], itemSchedules);
                            const playlistAgendaText = (() => {
                              if (!itemSchedules.length) return '—';
                              if (itemSchedules.length === 1) {
                                const s = itemSchedules[0];
                                const dw = normalizeDaysOfWeek(s.days_of_week) || '—';
                                return `${s.start_time || '—'} → ${s.end_time || '—'} | dias: ${dw}`;
                              }
                              return `múltiplas agendas (${itemSchedules.length})`;
                            })();

                            return (playlistExposure?.campaigns || []).map((c) => {
                              const dw = normalizeDaysOfWeek(c.days_of_week) || '—';
                              const campaignAgendaText = `${c.start_time || '—'} → ${c.end_time || '—'} | dias: ${dw} | tz: ${c.timezone || '—'}`;
                              return (
                            <TableRow key={c.campaign_id}>
                              <TableCell>
                                {conflict ? <ErrorOutline sx={{ color: theme.palette.error.main }} /> : null}
                              </TableCell>
                              <TableCell>{c.title}</TableCell>
                              <TableCell>{campaignAgendaText}</TableCell>
                              <TableCell>{playlistAgendaText}</TableCell>
                            </TableRow>
                              );
                            });
                          })()}
                          {(playlistExposure?.campaigns || []).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4}>
                                <Alert severity="info">Sem dados de exposição.</Alert>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {exposureTab === 2 && (
                    <List>
                      {(playlistExposure?.publishers || []).map((p) => (
                        <ListItem key={p.publisher_id}>
                          <ListItemText primary={p.name} secondary={`publisher_id: ${p.publisher_id}`} />
                        </ListItem>
                      ))}
                      {(playlistExposure?.publishers || []).length === 0 && <Alert severity="info">Sem publishers.</Alert>}
                    </List>
                  )}

                  {exposureTab === 3 && (
                    <List>
                      {(playlistExposure?.totems || []).map((t) => (
                        <ListItem key={t.totem_id}>
                          <ListItemText
                            primary={`${t.identifier}${t.name ? ` - ${t.name}` : ''}`}
                            secondary={t.local_name ? `Local: ${t.local_name}` : undefined}
                          />
                        </ListItem>
                      ))}
                      {(playlistExposure?.totems || []).length === 0 && <Alert severity="info">Sem totems.</Alert>}
                    </List>
                  )}

                  {exposureTab === 4 && (
                    <List>
                      {(playlistExposure?.smartTvs || []).map((tv) => (
                        <ListItem key={tv.tv_id}>
                          <ListItemText
                            primary={`${tv.identifier}${tv.name ? ` - ${tv.name}` : ''}`}
                            secondary={tv.totem_id ? `Totem: ${tv.totem_id}` : undefined}
                          />
                        </ListItem>
                      ))}
                      {(playlistExposure?.smartTvs || []).length === 0 && <Alert severity="info">Sem Smart TVs.</Alert>}
                    </List>
                  )}
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>Fechar</Button>
          {editorMode === 'create' ? (
            <Button variant="contained" onClick={handleCreatePlaylist} disabled={!draft.name}>
              Criar
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSavePlaylist} disabled={!selectedPlaylist?.name}>
              Salvar
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Playlists;

