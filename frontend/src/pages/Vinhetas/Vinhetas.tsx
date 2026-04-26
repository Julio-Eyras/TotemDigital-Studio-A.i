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
} from '@mui/material';
import { Add, Delete, Edit, Refresh, VideoLibrary } from '@mui/icons-material';
import { MediaItem, mediaApi, subscriberApi, Subscriber } from '../../services/api';
import MediaUploadDialog from '../../components/MediaUploadDialog/MediaUploadDialog';
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';

const VINHETA_TAG = 'vinheta';

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
  const [editForm, setEditForm] = useState<{ name: string; description: string; status: string } | null>(null);

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
      setError(e?.response?.data?.message || e?.message || 'Erro ao carregar vinhetas');
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
      setError(e?.response?.data?.message || e?.message || 'Erro ao remover vinheta');
    }
  };

  const openEdit = (m: MediaItem) => {
    setSelectedMedia(m);
    setEditForm({
      name: m.name || '',
      description: m.description || '',
      status: m.status || 'draft',
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
        tags: Array.from(new Set([...(selectedMedia.tags || []), VINHETA_TAG])),
      });
      setEditDialogOpen(false);
      setSelectedMedia(null);
      setEditForm(null);
      loadVinhetas();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Erro ao atualizar vinheta');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Vinhetas"
        subtitle="Gerencie vinhetas com bucket dedicado no dispatch"
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
                  <InputLabel>Subscriber</InputLabel>
                  <Select value={subscriberFilter} label="Subscriber" onChange={(e) => setSubscriberFilter(e.target.value as number | 'all')}>
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
                <Box sx={{ mb: 1, display: 'flex', gap: 1 }}>
                  <Chip size="small" label={m.media_type?.toUpperCase() || 'MÍDIA'} />
                  <Chip size="small" color="secondary" label="vinheta" />
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

      <MediaUploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
        isAdmin={isAdmin}
        canSelectSubscriber={canSelectSubscriber}
        subscribers={subscribers}
        userSubscriberId={userSubscriberId}
        dialogTitle="Upload de Vinheta"
        defaultTags={[VINHETA_TAG]}
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
