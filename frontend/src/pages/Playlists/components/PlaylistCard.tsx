/**
 * PlaylistCard Component
 * Card reutilizável para exibir informações de uma playlist
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  useTheme,
  alpha,
} from '@mui/material';
import {
  QueueMusic,
  Edit,
  Delete,
  Visibility,
  VideoLibrary,
  AccessTime,
} from '@mui/icons-material';
import { PlaylistItem } from '../../../services/api';
import { getDisabledContainerSx, getDisabledTextColor } from '../../../utils/disabledVisualIdentity';

export interface PlaylistCardProps {
  playlist: PlaylistItem;
  onEdit?: (playlist: PlaylistItem) => void;
  onDelete?: (playlist: PlaylistItem) => void;
  onView?: (playlist: PlaylistItem) => void;
  highlighted?: boolean;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onEdit,
  onDelete,
  onView,
  highlighted = false,
}) => {
  const theme = useTheme();
  const isInactive = playlist.is_active === false;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        border: highlighted ? `2px solid ${theme.palette.primary.main}` : 'none',
        boxShadow: highlighted ? theme.shadows[8] : theme.shadows[1],
        ...getDisabledContainerSx(theme, isInactive ? 'disabled-global' : 'default'),
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: theme.palette.primary.main,
              width: 56,
              height: 56,
              mr: 2,
            }}
          >
            <QueueMusic />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant="h6"
              component="div"
              noWrap
              sx={isInactive ? { fontWeight: 700 } : undefined}
            >
              {playlist.name}
            </Typography>
            <Chip
              label={playlist.is_active ? 'Ativa' : 'Inativa'}
              size="small"
              color={playlist.is_active ? 'success' : 'warning'}
              sx={{ mt: 0.5, ...(isInactive ? { fontWeight: 700 } : {}) }}
            />
          </Box>
        </Box>

        <Stack spacing={1} sx={{ mt: 2 }}>
          {playlist.description && (
            <Typography
              variant="body2"
              color={getDisabledTextColor(theme, isInactive ? 'disabled-global' : 'default')}
              sx={{ mb: 1 }}
            >
              {playlist.description.length > 100
                ? `${playlist.description.substring(0, 100)}...`
                : playlist.description}
            </Typography>
          )}

          {playlist.category_segment && (
            <Chip
              label={playlist.category_segment}
              size="small"
              variant="outlined"
              sx={{ alignSelf: 'flex-start' }}
            />
          )}

          {playlist.media_count !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VideoLibrary fontSize="small" color="action" />
              <Typography
                variant="body2"
                color={getDisabledTextColor(theme, isInactive ? 'disabled-global' : 'default')}
              >
                {playlist.media_count} Mídia{playlist.media_count !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}

          {playlist.total_duration !== undefined && playlist.total_duration > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime fontSize="small" color="action" />
              <Typography
                variant="body2"
                color={getDisabledTextColor(theme, isInactive ? 'disabled-global' : 'default')}
              >
                {Math.floor(playlist.total_duration / 60)}:{String(Math.floor(playlist.total_duration % 60)).padStart(2, '0')}
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        {onView && (
          <Tooltip title="Ver Detalhes">
            <IconButton size="small" onClick={() => onView(playlist)}>
              <Visibility />
            </IconButton>
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(playlist)}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Deletar">
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(playlist)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

export default PlaylistCard;
