/**
 * Mídias de um totem — adicionar, reordenar, excluir (modo Publicar em Totem)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
} from '@mui/material';
import { Add, ArrowBack, CloudUpload, Delete, Edit, Settings } from '@mui/icons-material';
import {
  mediaApi,
  MediaItem,
  totemApi,
  totemDirectMediaApi,
  TotemDirectMediaItem,
  Player,
} from '../../services/api';
import { SortableList } from '../../components/SortableList/SortableList';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import TotemRemoteControl from '../../components/TotemRemoteControl/TotemRemoteControl';
import TotemEditDialog from '../../components/TotemEditDialog/TotemEditDialog';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { useMediaThumbnailUrls } from '../../hooks/useMediaThumbnailUrls';
import { buildMediaThumbnailApiPath } from '../../utils/mediaPreviewUrl';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { buildMediaMetaSummary, buildMediaSizeDurationDateLine } from '../../utils/mediaDisplayMeta';
import { formatTotemMediaCountLabel } from '../../utils/totemMediaCountLabel';
import { MediaViewDialog } from '../../components/Media/MediaViewDialog';
import { MediaPortraitThumb } from '../../components/Media/MediaPortraitThumb';

const TotemMediaPage: React.FC = () => {
  const { totemId: totemIdParam } = useParams<{ totemId: string }>();
  const totemId = Number(totemIdParam);
  const navigate = useNavigate();
  const defaultBreadcrumbs = useBreadcrumbs();
  const [totem, setTotem] = useState<Player | null>(null);
  const [items, setItems] = useState<TotemDirectMediaItem[]>([]);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickSelectedIds, setPickSelectedIds] = useState<number[]>([]);
  const [addingPicked, setAddingPicked] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [orphanDialog, setOrphanDialog] = useState<{
    open: boolean;
    mediaId: number;
    mediaName: string;
  }>({ open: false, mediaId: 0, mediaName: '' });
  const [deletingPermanent, setDeletingPermanent] = useState(false);
  const [mediaViewTarget, setMediaViewTarget] = useState<MediaItem | null>(null);

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(totemId) || totemId < 1) {
      setLoading(false);
      setError('Totem inválido');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [totemRes, mediaItems, mediaList] = await Promise.all([
        totemApi.getById(totemId),
        totemDirectMediaApi.list(totemId),
        mediaApi.getAll({ limit: 500 }),
      ]);
      setTotem(totemRes);
      setItems(mediaItems);
      const lib = Array.isArray((mediaList as any)?.data)
        ? (mediaList as any).data
        : Array.isArray(mediaList)
          ? mediaList
          : [];
      setLibrary(lib);
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar mídias do totem'));
    } finally {
      setLoading(false);
    }
  }, [totemId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!pickOpen) setPickSelectedIds([]);
  }, [pickOpen]);

  const thumbMediaItems = useMemo(
    () =>
      items.map((item) => ({
        media_id: item.media_id,
        thumbnailUrl: buildMediaThumbnailApiPath(item.media_id),
      })),
    [items]
  );
  const { getThumbnailSrc, urlsById, invalidateThumbnail } = useMediaThumbnailUrls(thumbMediaItems);

  const libraryById = useMemo(() => {
    const map = new Map<number, MediaItem>();
    for (const m of library) {
      if (m.media_id) map.set(m.media_id, m);
    }
    return map;
  }, [library]);

  const openMediaPreview = useCallback(
    (mediaId: number) => {
      const item = items.find((i) => i.media_id === mediaId);
      const lib = libraryById.get(mediaId);
      if (!item && !lib) return;

      const merged: MediaItem = {
        ...(lib || ({} as MediaItem)),
        media_id: mediaId,
        name: lib?.name || item?.name || `Mídia ${mediaId}`,
        media_type: lib?.media_type || item?.media_type || 'video',
        width: lib?.width ?? item?.width ?? undefined,
        height: lib?.height ?? item?.height ?? undefined,
        duration_seconds: lib?.duration_seconds ?? item?.duration_seconds ?? undefined,
        file_path: lib?.file_path || item?.file_path,
        tags: lib?.tags,
        approvedByName: lib?.approvedByName || item?.approved_by_name || undefined,
        approvedAt: lib?.approvedAt || item?.approved_at || undefined,
        size_bytes: (lib as any)?.size_bytes ?? (lib as any)?.fileSizeBytes ?? item?.file_size_bytes,
        fileSizeBytes: (lib as any)?.fileSizeBytes ?? item?.file_size_bytes,
        deliveryRotation: lib?.deliveryRotation,
        deliveryPreviewRotation: lib?.deliveryPreviewRotation,
        subscriberId: lib?.subscriberId,
      } as MediaItem;

      setMediaViewTarget(merged);
    },
    [items, libraryById],
  );

  const sortableItems = useMemo(
    () =>
      items.map((item) => {
        const lib = libraryById.get(item.media_id);
        const thumbSrc = urlsById[item.media_id];
        const sizeBytes =
          item.file_size_bytes ?? (lib as any)?.size_bytes ?? (lib as any)?.fileSizeBytes;
        const durationSeconds = item.duration_seconds ?? lib?.duration_seconds;
        const uploadedAt =
          item.created_at ??
          (lib as any)?.createdAt ??
          (lib as any)?.created_at ??
          item.approved_at ??
          (lib as any)?.approvedAt;
        const metaLine = buildMediaMetaSummary({
          mediaType: item.media_type || lib?.media_type,
          width: item.width ?? lib?.width,
          height: item.height ?? lib?.height,
          tags: lib?.tags,
          durationSeconds,
          omitFileSize: true,
        });
        const detailLine = buildMediaSizeDurationDateLine({
          sizeBytes,
          durationSeconds,
          uploadedAt,
        });
        const baseSecondary =
          metaLine && detailLine
            ? `${metaLine} · ${detailLine}`
            : metaLine || detailLine || undefined;

        const statusParts: React.ReactNode[] = [];
        if (item.is_active === false) {
          statusParts.push(
            <Box
              key="disabled-local"
              component="span"
              sx={{ color: 'warning.dark', fontWeight: 700 }}
            >
              desabilitada neste totem
            </Box>
          );
        }
        if (item.media_is_active === false) {
          statusParts.push(
            <Box
              key="disabled-global"
              component="span"
              sx={{ color: 'error.main', fontWeight: 800 }}
            >
              desabilitada na biblioteca
            </Box>
          );
        }

        let secondary: React.ReactNode = baseSecondary;
        if (statusParts.length > 0) {
          secondary = (
            <Box
              component="span"
              sx={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {baseSecondary ? (
                <>
                  <Box component="span" sx={{ color: 'text.secondary' }}>
                    {baseSecondary}
                  </Box>
                  {' · '}
                </>
              ) : null}
              {statusParts.map((part, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 ? ' · ' : null}
                  {part}
                </React.Fragment>
              ))}
            </Box>
          );
        }

        const visualState =
          item.media_is_active === false
            ? 'disabled-global'
            : item.is_active === false
              ? 'disabled-local'
              : 'default';

        return {
          id: item.media_id,
          label: item.name || `Mídia ${item.media_id}`,
          secondary,
          preview: {
            mediaId: item.media_id,
            thumbSrc,
            mediaWidth: item.width ?? lib?.width ?? null,
            mediaHeight: item.height ?? lib?.height ?? null,
          },
          active: item.is_active !== false && item.media_is_active !== false,
          visualState,
        };
      }),
    [items, libraryById, urlsById],
  );

  const libraryAvailable = useMemo(() => {
    const inPlaylist = new Set(items.map((i) => i.media_id));
    return library.filter(
      (m) =>
        m.media_id &&
        !inPlaylist.has(m.media_id) &&
        (m as { isActive?: boolean; is_active?: boolean }).isActive !== false &&
        (m as { is_active?: boolean }).is_active !== false
    );
  }, [items, library]);

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

  const handleReorder = async (newOrder: Array<string | number>) => {
    try {
      const mediaIds = newOrder.map((id) => Number(id));
      const updated = await totemDirectMediaApi.reorder(totemId, mediaIds);
      setItems(updated);
      setSuccess('Ordem atualizada');
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao reordenar'));
    }
  };

  const togglePickMedia = (mediaId: number) => {
    setPickSelectedIds((prev) =>
      prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId]
    );
  };

  const handleAddSelectedMedia = async () => {
    if (pickSelectedIds.length === 0) return;
    try {
      setAddingPicked(true);
      setError(null);
      let updated = items;
      for (const mediaId of pickSelectedIds) {
        updated = await totemDirectMediaApi.add(totemId, mediaId);
      }
      setItems(updated);
      setPickOpen(false);
      setSuccess(
        pickSelectedIds.length === 1
          ? 'Mídia adicionada ao totem'
          : `${pickSelectedIds.length} mídias adicionadas ao totem`
      );
    } catch (e: any) {
      setSuccess(null);
      setError(pickApiErrorMessage(e, 'Erro ao adicionar mídias'));
      await loadAll();
    } finally {
      setAddingPicked(false);
    }
  };

  const handleToggleMediaActive = async (mediaId: number) => {
    const current = items.find((i) => i.media_id === Number(mediaId));
    const nextActive = !(current?.is_active !== false);
    try {
      const updated = await totemDirectMediaApi.setActive(totemId, Number(mediaId), nextActive);
      setItems(updated);
      setSuccess(nextActive ? 'Mídia habilitada neste totem' : 'Mídia desabilitada neste totem');
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao alterar status da mídia'));
    }
  };

  const handleRemove = async (mediaId: number) => {
    try {
      const result = await totemDirectMediaApi.remove(totemId, mediaId);
      setItems(result.items);
      if (result.orphan) {
        const removed = items.find((i) => i.media_id === mediaId);
        setOrphanDialog({
          open: true,
          mediaId,
          mediaName: removed?.name || `Mídia ${mediaId}`,
        });
      } else {
        setSuccess('Mídia removida deste totem (arquivo mantido na biblioteca)');
      }
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao remover mídia'));
    }
  };

  const handlePermanentDelete = async () => {
    try {
      setDeletingPermanent(true);
      await mediaApi.delete(orphanDialog.mediaId);
      setOrphanDialog({ open: false, mediaId: 0, mediaName: '' });
      setSuccess('Mídia excluída permanentemente');
      await loadAll();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao excluir mídia do servidor'));
    } finally {
      setDeletingPermanent(false);
    }
  };

  const title = totem?.name || totem?.identifier || `Totem ${totemId}`;
  const playableCount = items.filter(
    (i) => i.is_active !== false && i.media_is_active !== false
  ).length;
  const linkedCount = items.length;
  const canDeleteTotem = linkedCount === 0;

  const breadcrumbs = useMemo(() => {
    if (defaultBreadcrumbs.length === 0) return defaultBreadcrumbs;
    const label = formatTotemMediaCountLabel(playableCount, linkedCount);
    const next = [...defaultBreadcrumbs];
    next[next.length - 1] = { ...next[next.length - 1], label };
    return next;
  }, [defaultBreadcrumbs, playableCount, linkedCount]);

  const handleDeleteTotem = async () => {
    if (!canDeleteTotem) {
      setError('Remova todas as mídias deste totem antes de excluí-lo');
      return;
    }
    try {
      setDeleting(true);
      await totemApi.delete(totemId);
      navigate('/publish-totem');
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao excluir totem'));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <PageHeader title={`Mídias — ${title}`} breadcrumbs={breadcrumbs} />

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/publish-totem')}>
          Voltar
        </Button>
        <Button startIcon={<Edit />} variant="outlined" onClick={() => setEditOpen(true)}>
          Editar totem
        </Button>
        <Tooltip
          title={
            canDeleteTotem
              ? 'Excluir totem'
              : 'Remova todas as mídias antes de excluir este totem'
          }
        >
          <span>
            <Button
              startIcon={<Delete />}
              variant="outlined"
              color="error"
              disabled={!canDeleteTotem}
              onClick={() => setDeleteOpen(true)}
            >
              Excluir totem
            </Button>
          </span>
        </Tooltip>
        <Button startIcon={<Settings />} variant="outlined" onClick={() => setRemoteOpen(true)}>
          Controle remoto
        </Button>
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

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setPickOpen(true)}>
          Adicionar mídia
        </Button>
        <Button variant="outlined" startIcon={<CloudUpload />} onClick={() => setUploadOpen(true)}>
          Enviar nova mídia
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Arraste para reordenar. Use o ícone do olho para visualizar. Excluir remove só deste totem.
      </Typography>

      <SortableList
        items={sortableItems}
        onReorder={(order) => void handleReorder(order)}
        onDelete={(id) => void handleRemove(Number(id))}
        onToggleActive={(id) => void handleToggleMediaActive(Number(id))}
        onPreview={(id) => openMediaPreview(Number(id))}
        emptyMessage="Nenhuma mídia neste totem. Adicione ou envie uma mídia."
      />

      <MediaViewDialog
        open={!!mediaViewTarget}
        media={mediaViewTarget}
        thumbnailSrc={
          mediaViewTarget?.media_id ? getThumbnailSrc({ media_id: mediaViewTarget.media_id }) : undefined
        }
        onClose={() => setMediaViewTarget(null)}
      />

      <Dialog
        open={pickOpen}
        onClose={() => !addingPicked && setPickOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Adicionar mídia da biblioteca</DialogTitle>
        <DialogContent dividers>
          {libraryAvailable.length === 0 ? (
            <Typography color="text.secondary">Nenhuma mídia disponível na biblioteca.</Typography>
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
                        secondary={buildMediaMetaSummary({
                          mediaType: m.media_type,
                          durationSeconds: m.duration_seconds,
                          width: m.width,
                          height: m.height,
                          tags: m.tags,
                          sizeBytes: (m as any).size_bytes ?? m.fileSizeBytes,
                        })}
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
          <Button disabled={addingPicked} onClick={() => setPickOpen(false)}>
            Fechar
          </Button>
          <Button
            variant="contained"
            disabled={addingPicked || pickSelectedIds.length === 0}
            onClick={() => void handleAddSelectedMedia()}
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
          const mediaIds = (uploaded ?? [])
            .map((m) => m.media_id ?? (m as { id?: number }).id)
            .filter((id): id is number => typeof id === 'number' && id > 0);

          if (mediaIds.length > 0) {
            try {
              setError(null);
              // add responde na hora; player só atualiza quando o tratamento de entrega terminar.
              for (const mediaId of mediaIds) {
                await totemDirectMediaApi.add(totemId, mediaId);
                await invalidateThumbnail(mediaId);
              }
              await loadAll();
              setSuccess(
                mediaIds.length === 1
                  ? 'Upload concluído e mídia adicionada ao totem.'
                  : `${mediaIds.length} mídias enviadas e adicionadas ao totem.`
              );
            } catch (e: any) {
              await loadAll();
              setSuccess(null);
              setError(pickApiErrorMessage(e, 'Upload concluído, mas falhou ao adicionar ao totem'));
              setPickOpen(true);
            }
          } else {
            await loadAll();
            setPickOpen(true);
            setSuccess('Upload concluído. Selecione a mídia para adicionar ao totem.');
          }
        }}
        isAdmin
      />

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Excluir totem?</DialogTitle>
        <DialogContent>
          <Typography>
            O totem <strong>{title}</strong> será removido permanentemente. Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setDeleteOpen(false)}>
            Cancelar
          </Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => void handleDeleteTotem()}>
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <TotemEditDialog
        open={editOpen}
        totem={totem as unknown as Record<string, unknown> | null}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          setSuccess('Totem atualizado');
          await loadAll();
        }}
      />

      <Dialog open={remoteOpen} onClose={() => setRemoteOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Controle remoto — {title}</DialogTitle>
        <DialogContent>
          <TotemRemoteControl totemId={totemId} totemName={title} onClose={() => setRemoteOpen(false)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoteOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={orphanDialog.open}
        onClose={() => {
          if (deletingPermanent) return;
          setOrphanDialog({ open: false, mediaId: 0, mediaName: '' });
          setSuccess('Mídia removida deste totem (arquivo mantido na biblioteca)');
        }}
      >
        <DialogTitle>Excluir mídia permanentemente?</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{orphanDialog.mediaName}</strong> já foi removida deste totem e não está em nenhum outro. Deseja
            também apagar o arquivo do servidor e da biblioteca?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={deletingPermanent}
            onClick={() => {
              setOrphanDialog({ open: false, mediaId: 0, mediaName: '' });
              setSuccess('Mídia removida deste totem (arquivo mantido na biblioteca)');
            }}
          >
            Manter no servidor
          </Button>
          <Button color="error" variant="contained" disabled={deletingPermanent} onClick={() => void handlePermanentDelete()}>
            Excluir permanentemente
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TotemMediaPage;
