import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  IconButton,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { Add, Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import { MediaItem, mediaApi, subscriberApi, Subscriber } from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const VINHETA_TAG = 'vinheta';
const VINHETA_GLOBAL_TAG = 'vinheta_global';

function normalizeTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  return [];
}

function mergeVinhetaTags(existing: unknown, global: boolean): string[] {
  const base = new Set(normalizeTags(existing));
  base.add(VINHETA_TAG);
  if (global) base.add(VINHETA_GLOBAL_TAG);
  else base.delete(VINHETA_GLOBAL_TAG);
  return Array.from(base);
}

function isGlobalVinheta(tags: unknown): boolean {
  return normalizeTags(tags).includes(VINHETA_GLOBAL_TAG);
}

const Vinhetas: React.FC = () => {
  const breadcrumbs = useBreadcrumbs();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriberFilter, setSubscriberFilter] = useState<number | 'all'>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [canSelectSubscriber, setCanSelectSubscriber] = useState(false);
  const [userSubscriberId, setUserSubscriberId] = useState<number | undefined>(undefined);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; description: string; status: string; global: boolean } | null>(null);
  const [uploadAsGlobal, setUploadAsGlobal] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || '';
    const userType = user?.userType || user?.user_type || '';
    const isTrueAdmin = userRole === 'admin' || userRole === 'admin_sql' || userRole === 'owner_system' || userType === 'system_user';
    const canSelect = isTrueAdmin || userRole === 'gerente_marketing' || userRole === 'editoracao';
    setIsAdmin(isTrueAdmin);
    setCanSelectSubscriber(canSelect);
    setUserSubscriberId(user?.subscriberId ?? user?.subscriber_id ?? user?.clientId);
    if (canSelect) loadSubscribers();
    loadVinhetas();
  }, []);

  const loadSubscribers = async () => {
    try {
      const response = await subscriberApi.getAll({ limit: 1000, active_only: true });
      setSubscribers(response.data || []);
    } catch {
      // noop
    }
  };

  const loadVinhetas = async () => {
    try {
      setLoading(true);
      setError(null);
      const subscriberId = userSubscriberId || (subscriberFilter !== 'all' ? subscriberFilter : undefined);
      const response = await mediaApi.getAll({ limit: 1000, subscriberId: typeof subscriberId === 'number' ? subscriberId : undefined });
      setAllMedia(response.data || []);
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar vinhetas'));
      setAllMedia([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVinhetas();
  }, [subscriberFilter]);

  const vinhetas = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return allMedia.filter((m) => {
      const tags = Array.isArray(m.tags) ? m.tags.map((t) => String(t).toLowerCase()) : [];
      const isVinheta = tags.includes(VINHETA_TAG);
      if (!isVinheta) return false;
      if (!normalizedSearch) return true;
      return (m.name || '').toLowerCase().includes(normalizedSearch);
    });
  }, [allMedia, searchTerm]);

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    loadVinhetas();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Deseja remover esta vinheta?')) return;
    try {
      await mediaApi.delete(id);
      loadVinhetas();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao remover vinheta'));
    }
  };

  const openEdit = (m: MediaItem) => {
    setSelectedMedia(m);
    setEditForm({
      name: m.name || '',
      description: m.description || '',
      status: m.status || 'draft',
      global: isGlobalVinheta(m.tags),
    });
    setEditDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedMedia || !editForm) return;
    try {
      await mediaApi.update(selectedMedia.media_id, {
        name: editForm.name,
        description: editForm.description,
        status: editForm.status,
        tags: mergeVinhetaTags(selectedMedia.tags, editForm.global),
      });
      setEditDialogOpen(false);
      setSelectedMedia(null);
      setEditForm(null);
      loadVinhetas();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao atualizar vinheta'));
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Vinhetas"
        subtitle="Vinhetas no dispatch (globais no servidor + pasta local no player)"
        breadcrumbs={breadcrumbs}
        onRefresh={loadVinhetas}
        loading={loading}
        actions={[{
          label: 'Criar Vinheta',
          icon: <Add />,
          onClick: () => setUploadDialogOpen(true),
          variant: 'contained',
        }]}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={canSelectSubscriber ? 5 : 8}>
              <TextField fullWidth label="Buscar vinheta" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </Grid>
            {canSelectSubscriber && (
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Anunciante</InputLabel>
                  <Select value={subscriberFilter} label="Anunciante" onChange={(e) => setSubscriberFilter(e.target.value as number | 'all')}>
                    {isAdmin && <MenuItem value="all">Todos</MenuItem>}
                    {subscribers.map((s) => (
                      <MenuItem key={s.subscriber_id} value={s.subscriber_id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} md={3}>
              <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadVinhetas}>Atualizar</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Grid container spacing={2}>
        {vinhetas.map((m) => (
          <Grid item xs={12} md={6} lg={4} key={m.media_id}>
            <Card>
              <CardContent>
                <Typography variant="h6" noWrap>{m.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{m.description || 'Sem descrição'}</Typography>
                <Box sx={{ mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label={m.media_type?.toUpperCase() || 'MÍDIA'} />
                  <Chip size="small" color="secondary" label="vinheta" />
                  {isGlobalVinheta(m.tags) && (
                    <Chip size="small" color="primary" label="global" />
                  )}
                  <Chip size="small" variant="outlined" label={m.status || 'draft'} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Tooltip title="Editar"><IconButton onClick={() => openEdit(m)}><Edit /></IconButton></Tooltip>
                  <Tooltip title="Excluir"><IconButton onClick={() => handleDelete(m.media_id)}><Delete /></IconButton></Tooltip>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {!loading && vinhetas.length === 0 && (
        <Card sx={{ mt: 2, textAlign: 'center', py: 5 }}>
          <CardContent>
            <VideoLibrary sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography>Nenhuma vinheta cadastrada.</Typography>
          </CardContent>
        </Card>
      )}

      <Alert severity="info" sx={{ mb: 2 }}>
        Vinhetas <strong>globais</strong> entram automaticamente no JSON do dispatch do anunciante. O Player-AD ainda mistura com MP4 da pasta local <code>vinhetas/</code>.
      </Alert>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <FormControlLabel
            control={
              <Switch
                checked={uploadAsGlobal}
                onChange={(e) => setUploadAsGlobal(e.target.checked)}
              />
            }
            label="Próximo upload como vinheta global (todas as campanhas do anunciante)"
          />
        </CardContent>
      </Card>

      <MediaUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
        isAdmin={isAdmin}
        canSelectSubscriber={canSelectSubscriber}
        subscribers={subscribers}
        userSubscriberId={userSubscriberId}
        dialogTitle="Upload de Vinheta"
        defaultTags={uploadAsGlobal ? [VINHETA_TAG, VINHETA_GLOBAL_TAG] : [VINHETA_TAG]}
        lockDefaultTags={false}
      />

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Vinheta</DialogTitle>
        <DialogContent>
          {editForm && (
            <>
              <TextField fullWidth margin="normal" label="Nome" value={editForm.name} onChange={(e) => setEditForm((p) => p ? { ...p, name: e.target.value } : null)} />
              <TextField fullWidth margin="normal" multiline rows={3} label="Descrição" value={editForm.description} onChange={(e) => setEditForm((p) => p ? { ...p, description: e.target.value } : null)} />
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select value={editForm.status} label="Status" onChange={(e) => setEditForm((p) => p ? { ...p, status: String(e.target.value) } : null)}>
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="pending_approval">Aguardando Aprovação</MenuItem>
                  <MenuItem value="approved">Aprovado</MenuItem>
                  <MenuItem value="rejected">Rejeitado</MenuItem>
                  <MenuItem value="archived">Arquivado</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Switch
                    checked={editForm.global}
                    onChange={(e) => setEditForm((p) => p ? { ...p, global: e.target.checked } : null)}
                  />
                }
                label="Vinheta global (incluir em todos os dispatches do anunciante)"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm?.name?.trim()}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vinhetas;
