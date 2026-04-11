/**
 * SubscriberMediaTab Component
 * Tab para gerenciar mídias do subscriber
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
  Button,
} from '@mui/material';
import {
  VideoLibrary,
  Image as ImageIcon,
  AudioFile,
  Edit,
  Delete,
  CloudUpload,
} from '@mui/icons-material';
import { MediaItem } from '../../../../services/api';

export interface SubscriberMediaTabProps {
  medias: MediaItem[];
  onEdit?: (media: MediaItem, index: number) => void;
  onDelete?: (index: number) => void;
  onUpload?: () => void;
  editingIndex?: number | null;
}

const SubscriberMediaTab: React.FC<SubscriberMediaTabProps> = ({
  medias,
  onEdit,
  onDelete,
  onUpload,
  editingIndex,
}) => {
  const getMediaIcon = (type?: string) => {
    if (!type) return <VideoLibrary />;
    if (type.includes('image')) return <ImageIcon />;
    if (type.includes('audio')) return <AudioFile />;
    return <VideoLibrary />;
  };

  return (
    <Box>
      {onUpload && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={onUpload}
          >
            Upload Mídia
          </Button>
        </Box>
      )}

      {medias.length === 0 ? (
        <Alert severity="info">
          Nenhuma mídia cadastrada ainda. Faça upload de mídias para começar.
        </Alert>
      ) : (
        <List>
          {medias.map((media, index) => (
            <ListItem
              key={media.media_id || index}
              sx={{
                border: `1px solid`,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
            >
              <ListItemIcon>{getMediaIcon(media.media_type)}</ListItemIcon>
              <ListItemText
                primary={media.name || 'Sem nome'}
                secondary={
                  <Box>
                    {media.description && (
                      <Box component="span" sx={{ display: 'block', mb: 0.5 }}>
                        {media.description}
                      </Box>
                    )}
                    {media.media_type && (
                      <Chip
                        label={media.media_type}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                    )}
                    {(media.fileSizeBytes || media.size_bytes) && (
                      <Chip
                        label={`${((media.fileSizeBytes || media.size_bytes || 0) / 1024 / 1024).toFixed(2)} MB`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                }
              />
              {onEdit && (
                <IconButton
                  size="small"
                  onClick={() => onEdit(media, index)}
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

export default SubscriberMediaTab;
