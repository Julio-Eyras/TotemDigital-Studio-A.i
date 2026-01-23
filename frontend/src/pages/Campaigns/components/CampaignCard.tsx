/**
 * CampaignCard Component
 * Card reutilizável para exibir informações de uma campanha
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
  alpha,
  useTheme,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  Edit,
  Delete,
  Visibility,
  CalendarToday,
  People,
  VideoLibrary,
  QueueMusic,
  PlayArrow,
  Stop,
} from '@mui/icons-material';
import { Campaign } from '../../../services/api';

export interface CampaignCardProps {
  campaign: Campaign;
  onEdit?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onView?: (campaign: Campaign) => void;
  highlighted?: boolean;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('pt-BR');
  } catch {
    return 'N/A';
  }
};

const getStatusColor = (status: string): 'success' | 'default' | 'warning' | 'error' => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'success';
    case 'draft':
      return 'default';
    case 'completed':
      return 'warning';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return <PlayArrow />;
    case 'draft':
      return <CampaignIcon />;
    case 'completed':
      return <Stop />;
    case 'cancelled':
      return <Stop />;
    default:
      return <CampaignIcon />;
  }
};

const getCampaignTypeLabel = (type: string): string => {
  switch (type?.toLowerCase()) {
    case 'general':
      return 'Geral';
    case 'scheduled':
      return 'Agendada';
    case 'interactive':
      return 'Interativa';
    case 'recurring':
      return 'Recorrente';
    default:
      return type || 'Geral';
  }
};

const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onEdit,
  onDelete,
  onView,
  highlighted = false,
}) => {
  const theme = useTheme();
  const statusColor = getStatusColor(campaign.status || 'draft');
  const isActive = campaign.is_active !== undefined ? campaign.is_active : true;

  const getStatusColorValue = (color: 'success' | 'default' | 'warning' | 'error') => {
    switch (color) {
      case 'success':
        return theme.palette.success.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  const statusColorValue = getStatusColorValue(statusColor);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        border: highlighted ? `2px solid ${theme.palette.primary.main}` : 'none',
        boxShadow: highlighted ? theme.shadows[8] : theme.shadows[1],
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: 120,
          backgroundColor: theme.palette.grey[100],
        }}
      >
        <Avatar
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            backgroundColor: alpha(statusColorValue, 0.1),
            color: statusColorValue,
          }}
        >
          {getStatusIcon(campaign.status || 'draft')}
        </Avatar>

        <Chip
          label={(campaign.status || 'draft').toUpperCase()}
          size="small"
          color={statusColor}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            fontWeight: 'bold',
          }}
        />

        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
          }}
        >
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
            {getCampaignTypeLabel(campaign.campaign_type || 'general')}
          </Typography>
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
          {campaign.title}
        </Typography>

        {campaign.description && (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }} noWrap>
            {campaign.description}
          </Typography>
        )}

        <Stack spacing={1} sx={{ mt: 2 }}>
          {campaign.start_date && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {formatDate(campaign.start_date)}
                {campaign.end_date && ` - ${formatDate(campaign.end_date)}`}
              </Typography>
            </Box>
          )}

          {(campaign.playlistIds && campaign.playlistIds.length > 0) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QueueMusic fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {campaign.playlistIds.length} Playlist{campaign.playlistIds.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}

          {(campaign.mediaIds && campaign.mediaIds.length > 0) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VideoLibrary fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {campaign.mediaIds.length} Mídia{campaign.mediaIds.length !== 1 ? 's' : ''} Direta{campaign.mediaIds.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}

          {campaign.commercial_tier && (
            <Chip
              label={`Tier: ${campaign.commercial_tier}`}
              size="small"
              color="primary"
              sx={{ width: 'fit-content' }}
            />
          )}
        </Stack>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Chip
            label={isActive ? 'Ativa' : 'Inativa'}
            size="small"
            color={isActive ? 'success' : 'default'}
          />
          {campaign.priority && (
            <Typography variant="caption" color="text.secondary">
              Prioridade: {campaign.priority}
            </Typography>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        {onView && (
          <Tooltip title="Ver Detalhes">
            <IconButton size="small" onClick={() => onView(campaign)}>
              <Visibility />
            </IconButton>
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(campaign)}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Deletar">
            <IconButton size="small" color="error" onClick={() => onDelete(campaign)}>
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

export default CampaignCard;
