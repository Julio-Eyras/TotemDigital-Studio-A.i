import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Button, TextField, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import { SmartToy, Add, Refresh } from '@mui/icons-material';
import { smartPlaylistApi, SmartPlaylist as SmartPlaylistType, SmartPlaylistRequest } from '../../services/api';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

const SmartPlaylist: React.FC = () => {
  const [items, setItems] = useState<SmartPlaylistType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [request, setRequest] = useState<SmartPlaylistRequest>({ name: '', description: '', rules: [], clientId: undefined });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const resp = await smartPlaylistApi.getAll();
      // Garantir que resp seja sempre um array
      setItems(Array.isArray(resp) ? resp : []);
    } catch (e) {
      setError(pickApiErrorMessage(e, 'Erro ao carregar Smart Playlists'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      // Validar nome antes de enviar
      if (!request.name || request.name.trim() === '') {
        setError('Nome é obrigatório');
        return;
      }

      // Remover campos undefined antes de enviar
      const dataToSend: any = {
        name: request.name.trim(),
        description: request.description?.trim() || '',
        rules: request.rules || []
      };
      
      // Só incluir clientId se estiver definido
      if (request.clientId) {
        dataToSend.clientId = request.clientId;
      }
      
      await smartPlaylistApi.create(dataToSend);
      setCreateOpen(false);
      setRequest({ name: '', description: '', rules: [], clientId: undefined });
      setError(null);
      loadAll();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao criar Smart Playlist'));
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Smart Playlist Engine
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>Criar Smart Playlist</Button>
        <Button startIcon={<Refresh />} variant="outlined" onClick={loadAll}>Atualizar</Button>
      </Box>

      <Grid container spacing={3}>
        {Array.isArray(items) && items.map((sp) => (
          <Grid item xs={12} sm={6} md={4} key={sp.smart_playlist_id}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{sp.name}</Typography>
                {sp.description && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{sp.description}</Typography>
                )}
                <Chip size="small" label={`ID ${sp.smart_playlist_id}`} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nova Smart Playlist</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nome" margin="normal" value={request.name} onChange={(e) => setRequest({ ...request, name: e.target.value })} />
          <TextField fullWidth label="Descrição" margin="normal" value={request.description} onChange={(e) => setRequest({ ...request, description: e.target.value })} />
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            Regras serão configuráveis em uma etapa futura.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!request.name}>Criar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SmartPlaylist;
