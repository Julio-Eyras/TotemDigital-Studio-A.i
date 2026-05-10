import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert } from '@mui/material';
import { QrCode, Add, Refresh } from '@mui/icons-material';
import { qrCodeApi, QRCode as QRCodeType, CreateQRCodeRequest } from '../../services/api';

const QRCodes: React.FC = () => {
  const [items, setItems] = useState<QRCodeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newQR, setNewQR] = useState<CreateQRCodeRequest>({ name: '', url: '' });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const resp = await qrCodeApi.getAll();
      // Garantir que resp seja sempre um array
      setItems(Array.isArray(resp) ? resp : []);
    } catch (e) {
      setError('Erro ao carregar QR Codes');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await qrCodeApi.create(newQR);
      setCreateOpen(false);
      setNewQR({ name: '', url: '' });
      loadAll();
    } catch (e) {
      setError('Erro ao criar QR Code');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Gerenciamento de QR Codes
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>Novo QR Code</Button>
        <Button startIcon={<Refresh />} variant="outlined" onClick={loadAll}>Atualizar</Button>
      </Box>

      <Grid container spacing={3}>
        {items.map((q) => (
          <Grid item xs={12} sm={6} md={4} key={q.qr_code_id}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{q.name}</Typography>
                <Typography variant="body2" color="text.secondary">{q.url}</Typography>
                <Box sx={{ mt: 1 }}>
                  <a href={q.url} target="_blank" rel="noreferrer">Abrir Link</a>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo QR Code</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Nome" margin="normal" value={newQR.name} onChange={(e) => setNewQR({ ...newQR, name: e.target.value })} />
          <TextField fullWidth label="URL" margin="normal" value={newQR.url} onChange={(e) => setNewQR({ ...newQR, url: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newQR.name || !newQR.url}>Criar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QRCodes;
