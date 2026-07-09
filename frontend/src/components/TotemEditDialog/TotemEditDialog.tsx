import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { totemApi, UpdatePlayerRequest } from '../../services/api';
import { getTotemIdFromRow, getTotemLocalIdFromRow } from '../../utils/totemRowIds';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

export interface TotemEditDialogProps {
  open: boolean;
  totem: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

const TotemEditDialog: React.FC<TotemEditDialogProps> = ({ open, totem, onClose, onSaved }) => {
  const [form, setForm] = useState<UpdatePlayerRequest>({
    name: '',
    identifier: '',
    uin: '',
    localId: undefined,
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !totem) return;

    const totemId = getTotemIdFromRow(totem);
    const localId = getTotemLocalIdFromRow(totem);
    setForm({
      name: String(totem.name || ''),
      identifier: String(totem.identifier || totem.name || ''),
      uin: String(totem.uin || ''),
      localId,
      isActive: totem.isActive !== false && totem.is_active !== false,
    });
    setError(null);

    if (totemId && !localId) {
      void totemApi.getById(totemId).then((full) => {
        const resolvedLocalId = getTotemLocalIdFromRow(full);
        if (resolvedLocalId) {
          setForm((prev) => ({ ...prev, localId: resolvedLocalId }));
        }
      }).catch(() => {
        /* mantém formulário com dados da listagem */
      });
    }
  }, [open, totem]);

  const handleSave = async () => {
    const totemId = totem ? getTotemIdFromRow(totem) : undefined;
    const identifier = String(form.identifier || '').trim();
    const name = String(form.name || '').trim();
    const uin = String(form.uin || '').trim();

    if (!totemId) {
      setError('Totem inválido para edição');
      return;
    }
    if (identifier.length < 2) {
      setError('Identificador deve ter pelo menos 2 caracteres');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload: UpdatePlayerRequest = {
        identifier,
        isActive: form.isActive !== false,
      };
      if (name) payload.name = name;
      if (uin) payload.uin = uin;
      if (form.localId) payload.localId = form.localId;

      await totemApi.update(totemId, payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(pickApiErrorMessage(e, 'Erro ao salvar totem'));
    } finally {
      setLoading(false);
    }
  };

  const title = String(totem?.name || totem?.identifier || 'Totem');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Editar totem</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ajuste o nome, identificador e código de ativação (UIN) de <strong>{title}</strong>.
        </Typography>
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}
        <TextField
          autoFocus
          fullWidth
          label="Nome"
          margin="normal"
          value={form.name || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <TextField
          fullWidth
          label="Identificador"
          margin="normal"
          required
          value={form.identifier || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
          helperText="Identificação única do totem no sistema"
        />
        <TextField
          fullWidth
          label="Código de ativação (UIN)"
          margin="normal"
          value={form.uin || ''}
          onChange={(e) => setForm((prev) => ({ ...prev, uin: e.target.value }))}
          helperText="Informe este código no player para vincular a tela a este totem"
        />
        <FormControlLabel
          sx={{ mt: 1 }}
          control={
            <Switch
              checked={form.isActive !== false}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
          }
          label="Totem habilitado"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={loading}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TotemEditDialog;
