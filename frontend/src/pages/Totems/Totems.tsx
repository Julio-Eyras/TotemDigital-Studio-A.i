import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Avatar, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControlLabel, Switch, Alert } from '@mui/material';
import { Tv, Add, Refresh, LocationOn } from '@mui/icons-material';
import { totemApi, Player, CreatePlayerRequest } from '../../services/api';

const Totems: React.FC = () => {
  const [totems, setTotems] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTotem, setNewTotem] = useState<CreatePlayerRequest>({ name: '', location: '' });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const resp = await totemApi.getAll();
      setTotems(resp.data || resp);
    } catch (e) {
      setError('Erro ao carregar totems');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await totemApi.create(newTotem);
      setCreateOpen(false);
      setNewTotem({ name: '', location: '' });
      loadAll();
    } catch (e) {
      setError('Erro ao criar totem');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Gerenciamento de Totems
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>Adicionar Totem</Button>
        <Button startIcon={<Refresh />} variant="outlined" onClick={loadAll}>Atualizar</Button>
      </Box>

      <Grid container spacing={3}>
        {totems.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.totem_id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar>
                    <Tv />
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{t.name}</Typography>
                    {t.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">{t.location}</Typography>
                      </Box>
                    )}
                  </Box>
                  <Chip size="small" label={t.status?.toUpperCase() || 'N/A'} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo Totem</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nome" margin="normal" value={newTotem.name} onChange={(e) => setNewTotem({ ...newTotem, name: e.target.value })} />
          <TextField fullWidth label="Localização" margin="normal" value={newTotem.location} onChange={(e) => setNewTotem({ ...newTotem, location: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newTotem.name}>Criar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
