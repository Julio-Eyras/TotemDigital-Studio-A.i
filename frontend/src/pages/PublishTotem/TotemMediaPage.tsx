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
} from '@mui/material';
import { Add, ArrowBack, CloudUpload, Settings } from '@mui/icons-material';
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
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { buildMediaThumbnailApiPath } from '../../utils/mediaPreviewUrl';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const TotemMediaPage: React.FC = () => {
  const { totemId: totemIdParam } = useParams<{ totemId: string }>();
  const totemId = Number(totemIdParam);
  const navigate = useNavigate();
  const breadcrumbs = useBreadcrumbs();
  const [totem, setTotem] = useState<Player | null>(null);
  const [items, setItems] = useState<TotemDirectMediaItem[]>([]);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [orphanDialog, setOrphanDialog] = useState<{
    open: boolean;
    mediaId: number;
    mediaName: string;
  }>({ open: false, mediaId: 0, mediaName: '' });
  const [deletingPermanent, setDeletingPermanent] = useState(false);

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(totemId) || totemId < 1) return;
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

  const sortableItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.media_id,
        label: item.name || `Mídia ${item.media_id}`,
        secondary: item.media_type,
        thumbnailSrc: buildMediaThumbnailApiPath(item.media_id),
      })),
    [items]
  );

  const libraryAvailable = useMemo(() => {
    const inPlaylist = new Set(items.map((i) => i.media_id));
    return library.filter((m) => m.media_id && !inPlaylist.has(m.media_id));
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
      const updated = await totemDirectMediaApi.add(totemId, mediaId);
      setItems(updated);
      setPickOpen(false);
      setSuccess('Mídia adicionada ao totem');
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao adicionar mídia'));
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

  return (
    <Box>
      <PageHeader title={`Mídias — ${title}`} breadcrumbs={breadcrumbs} />

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/publish-totem')}>
          Voltar
        </Button>
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
                    secondary={m.media_type}
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
              let updated = items;
              for (const mediaId of mediaIds) {
                updated = await totemDirectMediaApi.add(totemId, mediaId);
              }
              setItems(updated);
              await loadAll();
              setSuccess(
                mediaIds.length === 1
                  ? 'Upload concluído e mídia adicionada ao totem.'
                  : `${mediaIds.length} mídias enviadas e adicionadas ao totem.`
              );
            } catch (e: any) {
              await loadAll();
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
