import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, Alert } from '@mui/material';
import { Payment, Add, Refresh, Check } from '@mui/icons-material';
import { billingApi, BillingItem, CreateBillingRequest } from '../../services/api';

const Billing: React.FC = () => {
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBill, setNewBill] = useState<CreateBillingRequest>({ billing_type: 'subscription', amount: 0 });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const resp = await billingApi.getAll();
      const data = Array.isArray(resp) ? resp : (resp?.data || []);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Erro ao carregar faturas:', e);
      setError('Erro ao carregar faturas');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await billingApi.create(newBill);
      setCreateOpen(false);
      setNewBill({ billing_type: 'subscription', amount: 0 });
      loadAll();
    } catch (e) {
      setError('Erro ao criar cobrança');
    }
  };

  const markPaid = async (id: number) => {
    try {
      await billingApi.markAsPaid(id);
      loadAll();
    } catch (e) {
      setError('Erro ao marcar como pago');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Faturamento e Cobrança
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>Nova Cobrança</Button>
        <Button startIcon={<Refresh />} variant="outlined" onClick={loadAll}>Atualizar</Button>
      </Box>

      <Grid container spacing={3}>
        {Array.isArray(items) && items.map((b) => (
          <Grid item xs={12} sm={6} md={4} key={b.billing_id}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>{b.billing_type}</Typography>
                <Typography variant="body2" color="text.secondary">R$ {b.amount?.toFixed(2)}</Typography>
                <Typography variant="caption" color="text.secondary">Status: {b.status}</Typography>
                {b.due_date && (
                  <Typography variant="caption" color="text.secondary" display="block">Vencimento: {new Date(b.due_date).toLocaleDateString('pt-BR')}</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {b.status !== 'paid' && (
                    <Button size="small" startIcon={<Check />} onClick={() => markPaid(b.billing_id)}>Marcar pago</Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nova Cobrança</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo</InputLabel>
            <Select label="Tipo" value={newBill.billing_type} onChange={(e) => setNewBill({ ...newBill, billing_type: e.target.value })}>
              <MenuItem value="subscription">Assinatura</MenuItem>
              <MenuItem value="service">Serviço</MenuItem>
              <MenuItem value="license">Licença</MenuItem>
            </Select>
          </FormControl>
          <TextField 
            fullWidth 
            label="Valor (R$)" 
            type="number" 
            margin="normal" 
            value={newBill.amount} 
            onChange={(e) => {
              const value = e.target.value;
              setNewBill({ ...newBill, amount: value ? parseFloat(String(value)) : 0 });
            }} 
          />
          <TextField fullWidth label="Vencimento" type="date" margin="normal" InputLabelProps={{ shrink: true }} onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newBill.amount}>Criar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Billing;
