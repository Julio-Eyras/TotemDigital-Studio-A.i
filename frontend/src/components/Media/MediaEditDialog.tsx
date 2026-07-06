import React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { isStudioMode } from '../../config/studioMode';

export interface MediaEditFormState {
  name: string;
  description: string;
  tags: string[];
}

export interface MediaEditDialogProps {
  open: boolean;
  form: MediaEditFormState | null;
  subscriberName?: string;
  saving?: boolean;
  onChange: (form: MediaEditFormState) => void;
  onClose: () => void;
  onSave: () => void;
}

export function MediaEditDialog({
  open,
  form,
  subscriberName,
  saving = false,
  onChange,
  onClose,
  onSave,
}: MediaEditDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Editar mídia</DialogTitle>
      <DialogContent>
        {form && (
          <>
            <TextField
              fullWidth
              label="Nome *"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              margin="normal"
              size="small"
              required
            />
            <TextField
              fullWidth
              label="Descrição"
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              margin="normal"
              size="small"
              multiline
              rows={2}
            />
            <TextField
              fullWidth
              label="Tags (separadas por vírgula)"
              value={form.tags.join(', ')}
              onChange={(e) =>
                onChange({
                  ...form,
                  tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              margin="normal"
              size="small"
              helperText="Ex: promoção, verão, 2024"
            />
            {subscriberName && (
              <TextField
                fullWidth
                label="Anunciante"
                value={subscriberName}
                margin="normal"
                size="small"
                disabled
              />
            )}
            {isStudioMode() && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Modo compacto: a mídia permanece aprovada após salvar.
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={onSave} disabled={saving || !form?.name?.trim()}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
