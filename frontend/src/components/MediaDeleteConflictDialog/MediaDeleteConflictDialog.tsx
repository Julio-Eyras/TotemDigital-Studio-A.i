import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import type { MediaInUseConflictPayload } from '../../services/api';

interface MediaDeleteConflictDialogProps {
  open: boolean;
  conflict: MediaInUseConflictPayload | null;
  mediaLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirmForceDelete: () => void;
}

export const MediaDeleteConflictDialog: React.FC<MediaDeleteConflictDialogProps> = ({
  open,
  conflict,
  mediaLabel,
  loading = false,
  onClose,
  onConfirmForceDelete,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleClose = () => {
    setAcknowledged(false);
    onClose();
  };

  if (!conflict) return null;

  const { usage } = conflict;
  const hasPlaylists = usage.playlistDetails?.length > 0 || usage.playlists?.length > 0;
  const hasCampaigns = usage.campaignDetails?.length > 0 || usage.campaigns?.length > 0;
  const hasTotems = usage.totemPlaylistDetails?.length > 0 || usage.totemPlaylists?.length > 0;

  return (
    <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Mídia em uso</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>{mediaLabel || conflict.mediaName}</strong> não pode ser excluída porque ainda está referenciada em:
        </Typography>

        {hasPlaylists && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Playlists
            </Typography>
            <List dense disablePadding>
              {(usage.playlistDetails?.length ? usage.playlistDetails : usage.playlists.map((name, i) => ({ id: i, name }))).map(
                (pl) => (
                  <ListItem key={`pl-${pl.id}-${pl.name}`} disablePadding sx={{ py: 0.25 }}>
                    <ListItemText primary={pl.name} secondary={pl.id ? `ID ${pl.id}` : undefined} />
                  </ListItem>
                )
              )}
            </List>
          </Box>
        )}

        {hasCampaigns && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Campanhas
            </Typography>
            <List dense disablePadding>
              {(usage.campaignDetails?.length
                ? usage.campaignDetails
                : usage.campaigns.map((title, i) => ({ id: i, title }))
              ).map((c) => (
                <ListItem key={`c-${c.id}-${c.title}`} disablePadding sx={{ py: 0.25 }}>
                  <ListItemText primary={c.title} secondary={c.id ? `ID ${c.id}` : undefined} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {hasTotems && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Totens (playlist gerada)
            </Typography>
            <List dense disablePadding>
              {(usage.totemPlaylistDetails?.length
                ? usage.totemPlaylistDetails
                : usage.totemPlaylists.map((identifier, i) => ({ totemId: i, identifier }))
              ).map((t) => (
                <ListItem key={`t-${t.totemId}-${t.identifier}`} disablePadding sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={t.identifier}
                    secondary={
                      [
                        t.campaignTitle ? `Campanha: ${t.campaignTitle}` : null,
                        typeof t.online === 'boolean' ? (t.online ? 'Online' : 'Offline') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        <Alert severity="warning" sx={{ mb: 2 }}>
          Ao confirmar, as referências serão removidas, playlists vazias serão excluídas, a ordem das demais
          playlists/campanhas será reorganizada, o arquivo será apagado do servidor e os totens receberão comando
          para limpar o cache local.
        </Alert>

        {conflict.offlineTotemWarning && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {conflict.offlineTotemWarning}
          </Alert>
        )}

        <FormControlLabel
          control={
            <Checkbox
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={loading}
            />
          }
          label="Entendo que esta ação é irreversível e remove a mídia de todas as relações listadas."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={!acknowledged || loading}
          onClick={onConfirmForceDelete}
        >
          {loading ? 'Excluindo…' : 'Remover referências e excluir'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MediaDeleteConflictDialog;
