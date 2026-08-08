/**
 * Publicar em Totem — listagem em cards (modo direto)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  ListItemIcon,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { Add, CloudUpload, ContentCopy, Delete, Edit, PhotoLibrary, PowerSettingsNew, Refresh, Settings, Tv } from '@mui/icons-material';
import { mediaApi, MediaItem, totemApi, totemDirectMediaApi, Player, CreatePlayerRequest } from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import TotemEditDialog from '../../components/TotemEditDialog/TotemEditDialog';
import TotemRemoteControl from '../../components/TotemRemoteControl/TotemRemoteControl';
import TotemPlaybackStatus from '../../components/TotemPlaybackStatus/TotemPlaybackStatus';
import { MediaPortraitThumb } from '../../components/Media/MediaPortraitThumb';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useMediaThumbnailUrls } from '../../hooks/useMediaThumbnailUrls';
import { getTotemIdFromRow } from '../../utils/totemRowIds';
import { buildMediaThumbnailApiPath } from '../../utils/mediaPreviewUrl';
import { buildMediaMetaSummary } from '../../utils/mediaDisplayMeta';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { formatTotemScheduleCardLines } from '../../utils/totemDisplaySchedule';
import { formatTotemMediaCountLabel } from '../../utils/totemMediaCountLabel';
import { getDisabledContainerSx } from '../../utils/disabledVisualIdentity';
import { useTotemPlaybackTelemetry } from '../../hooks/useTotemPlaybackTelemetry';

function isTotemRowActive(row: unknown): boolean {
  const r = row as Record<string, unknown> | null | undefined;
  if (!r) return false;
  const active = r.is_active ?? r.active;
  if (active === false || active === 0 || active === 'false' || active === '0') return false;
  return true;
}

function createActivationCode(): string {
  const segment = () => Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `TD-${segment()}-${segment()}`;
}

function getOperationalStatus(totem: any): { label: string; color: 'default' | 'success' | 'warning' | 'error' } {
  if (totem?.status === 'online') return { label: 'Online', color: 'success' };
  if (totem?.status === 'error') return { label: 'Erro', color: 'error' };
  if (totem?.status === 'pending_approval') return { label: 'Aguardando aprovação', color: 'warning' };
  return { label: 'Offline', color: 'default' };
}

const PublishTotem: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  const [totems, setTotems] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [remoteTotem, setRemoteTotem] = useState<Player | null>(null);
  const [editTotem, setEditTotem] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingTotemId, setTogglingTotemId] = useState<number | null>(null);
  const [mediaMenuAnchor, setMediaMenuAnchor] = useState<null | HTMLElement>(null);
  const [mediaTargetTotemId, setMediaTargetTotemId] = useState<number | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickSelectedIds, setPickSelectedIds] = useState<number[]>([]);
  const [addingPicked, setAddingPicked] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [totemMediaIds, setTotemMediaIds] = useState<Set<number>>(new Set());
  const [mediaActionLoading, setMediaActionLoading] = useState(false);
  const playbackTelemetry = useTotemPlaybackTelemetry();

  const libraryAvailable = useMemo(() => {
    return library.filter(
      (m) =>
        m.media_id &&
        !totemMediaIds.has(m.media_id) &&
        (m as { isActive?: boolean; is_active?: boolean }).isActive !== false &&
        (m as { is_active?: boolean }).is_active !== false
    );
  }, [library, totemMediaIds]);

  const libraryPickThumbItems = useMemo(
    () =>
      pickOpen
        ? libraryAvailable
            .filter((m) => typeof m.media_id === 'number' && m.media_id > 0)
            .map((m) => ({
              media_id: m.media_id!,
              thumbnailUrl: buildMediaThumbnailApiPath(m.media_id!),
            }))
        : [],
    [pickOpen, libraryAvailable],
  );
  const { urlsById: libraryPickUrlsById } = useMediaThumbnailUrls(libraryPickThumbItems);

  useEffect(() => {
    if (!pickOpen) setPickSelectedIds([]);
  }, [pickOpen]);

  const mediaTargetTotem = useMemo(
    () => totems.find((t) => getTotemIdFromRow(t) === mediaTargetTotemId) ?? null,
    [totems, mediaTargetTotemId]
  );

  const loadLibraryForTotem = useCallback(async (totemId: number) => {
    const [mediaList, playlist] = await Promise.all([
      mediaApi.getAll({ limit: 500 }),
      totemDirectMediaApi.list(totemId),
    ]);
    const lib = Array.isArray((mediaList as any)?.data)
      ? (mediaList as any).data
      : Array.isArray(mediaList)
        ? mediaList
        : [];
    setLibrary(lib);
    setTotemMediaIds(new Set(playlist.map((i) => i.media_id)));
  }, []);

  const openMediaMenu = (e: React.MouseEvent<HTMLElement>, totemId: number) => {
    e.stopPropagation();
    setMediaTargetTotemId(totemId);
    setMediaMenuAnchor(e.currentTarget);
  };

  const closeMediaMenu = () => {
    setMediaMenuAnchor(null);
  };

  const handlePickFromLibrary = async () => {
    if (!mediaTargetTotemId) return;
    closeMediaMenu();
    try {
      setMediaActionLoading(true);
      await loadLibraryForTotem(mediaTargetTotemId);
      setPickOpen(true);
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar biblioteca de mídias'));
    } finally {
      setMediaActionLoading(false);
    }
  };

  const handleUploadFromDisk = () => {
    closeMediaMenu();
    setUploadOpen(true);
  };

  const togglePickMedia = (mediaId: number) => {
    setPickSelectedIds((prev) =>
      prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId]
    );
  };

  const handleAddSelectedMediaToTotem = async () => {
    if (!mediaTargetTotemId || pickSelectedIds.length === 0) return;
    try {
      setAddingPicked(true);
      setError(null);
      for (const mediaId of pickSelectedIds) {
        await totemDirectMediaApi.add(mediaTargetTotemId, mediaId);
      }
      setPickOpen(false);
      setSuccess(
        pickSelectedIds.length === 1
          ? 'Mídia adicionada ao totem'
          : `${pickSelectedIds.length} mídias adicionadas ao totem`
      );
      await loadTotems();
    } catch (e: any) {
      setSuccess(null);
      setError(pickApiErrorMessage(e, 'Erro ao adicionar mídias ao totem'));
      if (mediaTargetTotemId) await loadLibraryForTotem(mediaTargetTotemId);
    } finally {
      setAddingPicked(false);
    }
  };

  const loadTotems = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      const res = await totemApi.getAll({ limit: 500 });
      const list = Array.isArray((res as any)?.data)
        ? (res as any).data
        : Array.isArray(res)
          ? res
          : [];
      setTotems(list);
    } catch (e: any) {
      if (!opts?.silent) {
        setError(pickApiErrorMessage(e, 'Erro ao carregar totens'));
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTotems();
  }, [loadTotems]);

  // Atualiza hora do player / horário de tela sem spinner (heartbeat ~15–30s).
  useEffect(() => {
    const id = window.setInterval(() => {
      void loadTotems({ silent: true });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [loadTotems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return totems;
    return totems.filter((t) => {
      const name = String(t.name || t.identifier || '').toLowerCase();
      const id = String(getTotemIdFromRow(t) || '');
      return name.includes(q) || id.includes(q);
    });
  }, [totems, search]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError('Informe o nome do totem');
      return;
    }
    try {
      const payload: CreatePlayerRequest = {
        name,
        identifier: name.replace(/\s+/g, '-').toLowerCase().slice(0, 80) || `totem-${Date.now()}`,
        uin: createActivationCode(),
        isActive: true,
      } as CreatePlayerRequest;
      await totemApi.create(payload);
      setSuccess('Totem criado com sucesso');
      setCreateOpen(false);
      setNewName('');
      await loadTotems();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao criar totem'));
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setSuccess('Código copiado');
    } catch {
      setError('Não foi possível copiar o código');
    }
  };

  const getTotemMediaCounts = (totem: Player) => {
    const active = Number((totem as any).media_count ?? 0);
    const total = Number((totem as any).media_count_total ?? active);
    return { active, total };
  };

  const handleToggleTotemActive = async (totem: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    const totemId = getTotemIdFromRow(totem);
    if (!totemId) return;
    const nextActive = !isTotemRowActive(totem);
    try {
      setTogglingTotemId(totemId);
      setError(null);
      await totemApi.update(totemId, { isActive: nextActive });
      setSuccess(nextActive ? 'Totem habilitado' : 'Totem desabilitado');
      await loadTotems();
    } catch (err: any) {
      setError(pickApiErrorMessage(err, 'Erro ao alterar status do totem'));
    } finally {
      setTogglingTotemId(null);
    }
  };

  const handleDeleteTotem = async () => {
    const totemId = deleteTarget ? getTotemIdFromRow(deleteTarget) : undefined;
    if (!totemId) {
      setError('Totem inválido para exclusão');
      return;
    }
    if (getTotemMediaCounts(deleteTarget!).total > 0) {
      setError('Remova todas as mídias deste totem antes de excluí-lo');
      return;
    }
    try {
      setDeleting(true);
      setDeleteError(null);
      await totemApi.delete(totemId);
      setTotems((prev) => prev.filter((t) => getTotemIdFromRow(t) !== totemId));
      setSuccess('Totem excluído');
      setDeleteTarget(null);
      setDeleteError(null);
      await loadTotems();
    } catch (e: any) {
      const msg = pickApiErrorMessage(e, 'Erro ao excluir totem');
      setDeleteError(msg);
      setError(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <PageHeader title="Publicar em Totem" breadcrumbs={breadcrumbs} />
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

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Buscar totem"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <Button variant="outlined" startIcon={<Refresh />} onClick={() => void loadTotems()}>
          Atualizar
        </Button>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Novo totem
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={2}>
        {filtered.length === 0 && !loading ? (
          <Grid item xs={12}>
            <Alert severity="info">Nenhum totem cadastrado. Clique em &quot;Novo totem&quot; para começar.</Alert>
          </Grid>
        ) : (
          filtered.map((t, idx) => {
            const totemId = getTotemIdFromRow(t);
            const title = t.name || t.identifier || (totemId ? `Totem ${totemId}` : 'Totem');
            const op = getOperationalStatus(t);
            const { active: mediaActive, total: mediaTotal } = getTotemMediaCounts(t);
            const canDelete = mediaTotal === 0;
            const totemActive = isTotemRowActive(t);
            const activationCode = String((t as any).uin || '').trim();
            const scheduleLines = formatTotemScheduleCardLines(t as Record<string, unknown>);
            return (
              <Grid item xs={12} sm={6} md={4} key={String(totemId ?? idx)}>
                <Card
                  onMouseEnter={() => totemId && playbackTelemetry.hoverStart(totemId)}
                  onMouseLeave={() => totemId && playbackTelemetry.hoverEnd(totemId)}
                  sx={{
                    height: '100%',
                    ...getDisabledContainerSx(theme, totemActive ? 'default' : 'disabled-global'),
                  }}
                >
                  <CardActionArea
                    onClick={() => totemId && navigate(`/publish-totem/${totemId}`)}
                    sx={{ height: '100%' }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <Avatar sx={{ bgcolor: op.color === 'success' ? 'success.main' : 'grey.600' }}>
                          <Tv fontSize="small" />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" fontWeight={700} noWrap>
                            {title}
                          </Typography>
                          <Chip size="small" label={op.label} color={op.color} sx={{ mt: 0.5 }} />
                          {!totemActive && (
                            <Chip
                              size="small"
                              label="Desabilitado"
                              color="warning"
                              sx={{ mt: 0.5, ml: 0.5, fontWeight: 700 }}
                            />
                          )}
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {formatTotemMediaCountLabel(mediaActive, mediaTotal)}
                          </Typography>
                          {totemId && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Add />}
                              sx={{ mt: 1 }}
                              onClick={(e) => openMediaMenu(e, totemId)}
                            >
                              Mídia
                            </Button>
                          )}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ mt: 1, fontFamily: 'monospace', lineHeight: 1.45, fontWeight: 600 }}
                          >
                            {scheduleLines.deviceClockLine}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                            sx={{ lineHeight: 1.4 }}
                          >
                            {scheduleLines.scheduleLine}
                            {scheduleLines.daysLine ? ` · ${scheduleLines.daysLine}` : ''}
                          </Typography>
                          {totemId && (
                            <TotemPlaybackStatus
                              totemId={totemId}
                              state={playbackTelemetry.states[totemId]}
                              observationSample={playbackTelemetry.observationSamples[totemId]}
                              fallback={(t as any).nowPlaying ?? (t as any).now_playing ?? (t as any).runtime}
                            />
                          )}
                          {activationCode && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Ativação: {activationCode}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyCode(activationCode);
                                }}
                              >
                                <ContentCopy fontSize="inherit" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                        {totemId && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Tooltip title="Editar totem">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditTotem(t);
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={totemActive ? 'Desabilitar totem' : 'Habilitar totem'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color={totemActive ? 'warning' : 'success'}
                                  disabled={togglingTotemId === totemId}
                                  onClick={(e) => void handleToggleTotemActive(t, e)}
                                >
                                  <PowerSettingsNew fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Controle remoto">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRemoteTotem(t);
                                }}
                              >
                                <Settings fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={
                                canDelete
                                  ? 'Excluir totem'
                                  : 'Remova todas as mídias antes de excluir este totem'
                              }
                            >
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  disabled={!canDelete}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (canDelete) {
                                      setDeleteError(null);
                                      setDeleteTarget(t);
                                    }
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })
        )}
      </Grid>

      <Menu
        anchorEl={mediaMenuAnchor}
        open={Boolean(mediaMenuAnchor)}
        onClose={closeMediaMenu}
      >
        <MenuItem onClick={() => void handlePickFromLibrary()} disabled={mediaActionLoading}>
          <ListItemIcon>
            <PhotoLibrary fontSize="small" />
          </ListItemIcon>
          Da biblioteca
        </MenuItem>
        <MenuItem onClick={handleUploadFromDisk}>
          <ListItemIcon>
            <CloudUpload fontSize="small" />
          </ListItemIcon>
          Enviar do disco
        </MenuItem>
      </Menu>

      <Dialog
        open={pickOpen}
        onClose={() => !addingPicked && setPickOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Adicionar mídia — {mediaTargetTotem?.name || mediaTargetTotem?.identifier || 'Totem'}
        </DialogTitle>
        <DialogContent dividers>
          {libraryAvailable.length === 0 ? (
            <Typography color="text.secondary">
              Nenhuma mídia disponível na biblioteca. Use &quot;Enviar do disco&quot; para importar um arquivo.
            </Typography>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={addingPicked || libraryAvailable.length === 0}
                  onClick={() => {
                    const allIds = libraryAvailable
                      .map((m) => m.media_id)
                      .filter((id): id is number => typeof id === 'number' && id > 0);
                    setPickSelectedIds(allIds);
                  }}
                >
                  Selecionar todos
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={addingPicked || pickSelectedIds.length === 0}
                  onClick={() => setPickSelectedIds([])}
                >
                  Nenhum
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {pickSelectedIds.length} selecionada(s)
                </Typography>
              </Box>
              <List dense>
                {libraryAvailable.map((m) => {
                  const id = m.media_id!;
                  const checked = pickSelectedIds.includes(id);
                  return (
                    <ListItemButton
                      key={id}
                      selected={checked}
                      disabled={addingPicked}
                      onClick={() => togglePickMedia(id)}
                      sx={{ alignItems: 'center', gap: 0.5, py: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 42 }}>
                        <Checkbox
                          edge="start"
                          checked={checked}
                          tabIndex={-1}
                          disableRipple
                          disabled={addingPicked}
                          color="primary"
                        />
                      </ListItemIcon>
                      <MediaPortraitThumb
                        src={libraryPickUrlsById[id]}
                        width={44}
                        title={m.name}
                        mediaWidth={m.width}
                        mediaHeight={m.height}
                      />
                      <ListItemText
                        primary={m.name}
                        secondary={
                          buildMediaMetaSummary({
                            mediaType: m.media_type,
                            durationSeconds: m.duration_seconds,
                            width: m.width,
                            height: m.height,
                            tags: m.tags,
                            sizeBytes: (m as any).size_bytes ?? m.fileSizeBytes,
                          }) || m.media_type
                        }
                        sx={{ minWidth: 0 }}
                        primaryTypographyProps={{ noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(true)} startIcon={<CloudUpload />} disabled={addingPicked}>
            Enviar do disco
          </Button>
          <Button disabled={addingPicked} onClick={() => setPickOpen(false)}>
            Fechar
          </Button>
          <Button
            variant="contained"
            disabled={addingPicked || pickSelectedIds.length === 0}
            onClick={() => void handleAddSelectedMediaToTotem()}
          >
            {addingPicked
              ? 'Adicionando…'
              : pickSelectedIds.length > 0
                ? `Adicionar (${pickSelectedIds.length})`
                : 'Adicionar'}
          </Button>
        </DialogActions>
      </Dialog>

      <MediaUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={async (uploaded) => {
          setUploadOpen(false);
          if (!mediaTargetTotemId) return;

          const mediaIds = (uploaded ?? [])
            .map((m) => m.media_id ?? (m as { id?: number }).id)
            .filter((id): id is number => typeof id === 'number' && id > 0);

          if (mediaIds.length > 0) {
            try {
              setError(null);
              for (const mediaId of mediaIds) {
                await totemDirectMediaApi.add(mediaTargetTotemId, mediaId);
              }
              setSuccess(
                mediaIds.length === 1
                  ? 'Upload concluído e mídia adicionada ao totem.'
                  : `${mediaIds.length} mídias enviadas e adicionadas ao totem.`
              );
              await loadTotems();
            } catch (e: any) {
              setSuccess(null);
              setError(pickApiErrorMessage(e, 'Upload concluído, mas falhou ao adicionar ao totem'));
              await loadLibraryForTotem(mediaTargetTotemId);
              setPickOpen(true);
            }
          } else {
            await loadLibraryForTotem(mediaTargetTotemId);
            setPickOpen(true);
            setSuccess('Upload concluído. Selecione a mídia para adicionar ao totem.');
          }
        }}
        isAdmin
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Excluir totem?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: deleteError ? 2 : 0 }}>
            O totem <strong>{deleteTarget?.name || deleteTarget?.identifier}</strong> será removido
            permanentemente. Esta ação não pode ser desfeita.
          </Typography>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => void handleDeleteTotem()}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <TotemEditDialog
        open={Boolean(editTotem)}
        totem={editTotem as unknown as Record<string, unknown> | null}
        onClose={() => setEditTotem(null)}
        onSaved={async () => {
          setSuccess('Totem atualizado');
          await loadTotems();
        }}
      />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Novo totem</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O totem será cadastrado na sua organização. Um código de ativação será gerado automaticamente.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Nome do totem"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleCreate()}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(remoteTotem)}
        onClose={() => setRemoteTotem(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Controle remoto — {remoteTotem?.name || remoteTotem?.identifier || ''}
        </DialogTitle>
        <DialogContent>
          {remoteTotem && getTotemIdFromRow(remoteTotem) ? (
            <TotemRemoteControl
              totemId={getTotemIdFromRow(remoteTotem)!}
              totemName={remoteTotem.name || remoteTotem.identifier}
              onClose={() => setRemoteTotem(null)}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoteTotem(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PublishTotem;
