/**
 * SubscriberPlaylistsTab Component
 * Tab para gerenciar playlists do subscriber
 */

import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import {
  QueueMusic,
  Edit,
  Delete,
} from '@mui/icons-material';
import { PlaylistItem } from '../../../../services/api';

export interface SubscriberPlaylistsTabProps {
  playlists: PlaylistItem[];
  onEdit?: (playlist: PlaylistItem, index: number) => void;
  onDelete?: (index: number) => void;
  editingIndex?: number | null;
}

const SubscriberPlaylistsTab: React.FC<SubscriberPlaylistsTabProps> = ({
  playlists,
  onEdit,
  onDelete,
  editingIndex,
}) => {
  return (
    <Box>
      {playlists.length === 0 ? (
        <Alert severity="info">
          Nenhuma playlist cadastrada ainda. Crie uma playlist para organizar suas mídias.
        </Alert>
      ) : (
        <List>
          {playlists.map((playlist, index) => (
            <ListItem
              key={playlist.playlist_id || index}
              sx={{
                border: `1px solid`,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemIcon>
                <QueueMusic />
              </ListItemIcon>
              <ListItemText
                primary={playlist.name || 'Sem nome'}
                secondary={
                  <Box>
                    {playlist.description && (
                      <Box component="span" sx={{ display: 'block', mb: 0.5 }}>
                        {playlist.description}
                      </Box>
                    )}
                    <Chip
                      label={playlist.is_active ? 'Ativa' : 'Inativa'}
                      size="small"
                      color={playlist.is_active ? 'success' : 'default'}
                    />
                  </Box>
                }
              />
              {onEdit && (
                <IconButton
                  size="small"
                  onClick={() => onEdit(playlist, index)}
                  disabled={editingIndex === index}
                >
                  <Edit />
                </IconButton>
              )}
              {onDelete && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => onDelete(index)}
                >
                  <Delete />
                </IconButton>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default SubscriberPlaylistsTab;
