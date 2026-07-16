/**
 * Mídias de um totem — adicionar, reordenar, excluir (modo Publicar em Totem)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  List,
  ListItemButton,
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
import { useTotemDeliveryVideoPreviewUrls } from '../../hooks/useTotemDeliveryVideoPreviewUrls';
import { buildMediaThumbnailApiPath } from '../../utils/mediaPreviewUrl';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { buildMediaMetaSummary, formatMediaApprovalLine } from '../../utils/mediaDisplayMeta';

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

  const thumbMediaItems = useMemo(
    () =>
      items.map((item) => ({
        media_id: item.media_id,
        thumbnailUrl: buildMediaThumbnailApiPath(item.media_id),
      })),
    [items]
  );
  const { getThumbnailSrc, thumbVersion, invalidateThumbnail } = useMediaThumbnailUrls(thumbMediaItems);

  const libraryById = useMemo(() => {
    const map = new Map<number, MediaItem>();
    for (const m of library) {
      if (m.media_id) map.set(m.media_id, m);
    }
    return map;
  }, [library]);

  const previewMediaItems = useMemo(
    () =>
      items.map((item) => {
        const lib = libraryById.get(item.media_id);
        return {
          media_id: item.media_id,
          media_type: item.media_type,
          width: lib?.width,
          height: lib?.height,
          size_bytes: (lib as any)?.size_bytes ?? (lib as any)?.fileSizeBytes,
          fileSizeBytes: (lib as any)?.fileSizeBytes,
        };
      }),
    [items, libraryById],
  );
  const { getVideoPreviewUrl, videoPreviewVersion, invalidateVideoPreview } =
    useTotemDeliveryVideoPreviewUrls(previewMediaItems);

  const sortableItems = useMemo(
    () =>
      items.map((item) => {
        const lib = libraryById.get(item.media_id);
        const thumbSrc = getThumbnailSrc({
          media_id: item.media_id,
          thumbnailUrl: buildMediaThumbnailApiPath(item.media_id),
        });
        const videoSrc = getVideoPreviewUrl(item.media_id);
        const previewMedia = lib
          ? {
              media_type: lib.media_type,
              width: lib.width,
              height: lib.height,
              tags: lib.tags,
              deliveryRotation: lib.deliveryRotation,
              deliveryPreviewRotation: lib.deliveryPreviewRotation,
            }
          : { media_type: item.media_type };
        return {
          id: item.media_id,
          label: item.name || `Mídia ${item.media_id}`,
          secondary: (() => {
            const metaLine = buildMediaMetaSummary({
              mediaType: item.media_type || lib?.media_type,
              durationSeconds: item.duration_seconds ?? lib?.duration_seconds,
              width: item.width ?? lib?.width,
              height: item.height ?? lib?.height,
              sizeBytes: item.file_size_bytes ?? (lib as any)?.size_bytes ?? (lib as any)?.fileSizeBytes,
              extras: [
                item.is_active === false ? 'desabilitada neste totem' : null,
                item.media_is_active === false ? 'desabilitada na biblioteca' : null,
              ],
            });
            const approvalLine = formatMediaApprovalLine(
              item.approved_by_name ?? (lib as any)?.approvedByName,
              item.approved_at ?? (lib as any)?.approvedAt
            );
            if (!metaLine && !approvalLine) return undefined;
            return (
              <Box>
                {metaLine ? (
                  <Typography variant="body2" color="text.secondary" component="div" noWrap>
                    {metaLine}
                  </Typography>
                ) : null}
                {approvalLine ? (
                  <Typography variant="caption" color="text.secondary" component="div" noWrap>
                    {approvalLine}
                  </Typography>
                ) : null}
              </Box>
            );
          })(),
          preview: {
            mediaId: item.media_id,
            thumbSrc,
            videoSrc,
            media: previewMedia,
            previewKey: `${thumbVersion}:${videoPreviewVersion}:${thumbSrc ?? ''}:${videoSrc ?? ''}:${lib?.width ?? ''}:${lib?.height ?? ''}`,
          },
          active: item.is_active !== false && item.media_is_active !== false,
        };
      }),
    [items, libraryById, getThumbnailSrc, getVideoPreviewUrl, thumbVersion, videoPreviewVersion],
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

  const handleAddMedia = async (mediaId: number) => {
    try {
      setError(null);
      const updated = await totemDirectMediaApi.add(totemId, mediaId);
      setItems(updated);
      setPickOpen(false);
      setSuccess('Mídia adicionada ao totem');
    } catch (e: any) {
      setSuccess(null);
      setError(pickApiErrorMessage(e, 'Erro ao adicionar mídia'));
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
        setSuccess('Mídia removida deste totem');
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
  const hasActiveMedia = items.some((i) => i.is_active !== false);
  const canDeleteTotem = !hasActiveMedia;

  const breadcrumbs = useMemo(() => {
    if (defaultBreadcrumbs.length === 0) return defaultBreadcrumbs;
    const count = items.length;
    const label = `${count} ${count === 1 ? 'mídia' : 'mídias'}`;
    const next = [...defaultBreadcrumbs];
    next[next.length - 1] = { ...next[next.length - 1], label };
    return next;
  }, [defaultBreadcrumbs, items.length]);

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
        Arraste para reordenar a exibição neste totem. Excluir remove só deste totem.
      </Typography>

      <SortableList
        items={sortableItems}
        onReorder={(order) => void handleReorder(order)}
        onDelete={(id) => void handleRemove(Number(id))}
        onToggleActive={(id) => void handleToggleMediaActive(Number(id))}
        emptyMessage="Nenhuma mídia neste totem. Adicione ou envie uma mídia."
      />

      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar mídia da biblioteca</DialogTitle>
        <DialogContent dividers>
          {libraryAvailable.length === 0 ? (
            <Typography color="text.secondary">Nenhuma mídia disponível na biblioteca.</Typography>
          ) : (
            <List dense>
              {libraryAvailable.map((m) => (
                <ListItemButton key={m.media_id} onClick={() => void handleAddMedia(m.media_id!)}>
                  <ListItemText
                    primary={m.name}
                    secondary={buildMediaMetaSummary({
                      mediaType: m.media_type,
                      durationSeconds: m.duration_seconds,
                      width: m.width,
                      height: m.height,
                      sizeBytes: (m as any).size_bytes ?? m.fileSizeBytes,
                    })}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickOpen(false)}>Fechar</Button>
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
                invalidateVideoPreview(mediaId);
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
        onClose={() => !deletingPermanent && setOrphanDialog({ open: false, mediaId: 0, mediaName: '' })}
      >
        <DialogTitle>Excluir mídia permanentemente?</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{orphanDialog.mediaName}</strong> não está mais em nenhum totem. Deseja remover o arquivo do
            servidor?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={deletingPermanent} onClick={() => setOrphanDialog({ open: false, mediaId: 0, mediaName: '' })}>
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
