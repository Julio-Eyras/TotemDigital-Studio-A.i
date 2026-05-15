/**
 * SubscriberCard Component
 * Card reutilizável para exibir informações de um subscriber
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
  LinearProgress,
} from '@mui/material';
import {
  Business,
  Email,
  Phone,
  Edit,
  Delete,
  Visibility,
  LocationOn,
  Article,
  VideoLibrary,
  QueueMusic,
  Campaign as CampaignIcon,
  Storage,
} from '@mui/icons-material';
import { Subscriber } from '../../../services/api';
import {
  getSubscriberListContractAlert,
  subscriberAlertCardSx,
} from '../subscriberContractHealth';

export interface SubscriberCardProps {
  subscriber: Subscriber;
  onEdit?: (subscriber: Subscriber) => void;
  onDelete?: (subscriber: Subscriber) => void;
  onView?: (subscriber: Subscriber) => void;
}

const SubscriberCard: React.FC<SubscriberCardProps> = ({
  subscriber,
  onEdit,
  onDelete,
  onView,
}) => {
  const activeContracts = subscriber.active_contracts_count || 0;
  const mediaCount = subscriber.media_count || 0;
  const playlistCount = subscriber.playlist_count || 0;
  const campaignCount = subscriber.campaign_count || 0;
  const storageUsedGB = subscriber.storage_used_gb || 0;
  const storageLimitGB = subscriber.storage_limit_gb || 0;
  const storagePercent =
    storageLimitGB > 0 ? Math.min((storageUsedGB / storageLimitGB) * 100, 100) : 0;
  const storageLabel =
    storageLimitGB > 0
      ? `${storageUsedGB.toFixed(2)} / ${storageLimitGB} GB`
      : `${storageUsedGB.toFixed(2)} GB usados`;

  const contractAlert = getSubscriberListContractAlert(subscriber);

  const metricItems = [
    { label: 'Contratos', value: activeContracts, icon: <Article fontSize="small" color="action" /> },
    { label: 'Mídias', value: mediaCount, icon: <VideoLibrary fontSize="small" color="action" /> },
    { label: 'Playlists', value: playlistCount, icon: <QueueMusic fontSize="small" color="action" /> },
    { label: 'Campanhas', value: campaignCount, icon: <CampaignIcon fontSize="small" color="action" /> },
  ];

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        ...subscriberAlertCardSx(contractAlert.health),
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 56,
              height: 56,
              mr: 2,
            }}
          >
            <Business />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" noWrap>
              {subscriber.name}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              <Chip
                label={subscriber.is_active ? 'Ativo' : 'Inativo'}
                size="small"
                color={subscriber.is_active ? 'success' : 'default'}
              />
              <Tooltip title={contractAlert.tooltip}>
                <Chip
                  label={contractAlert.chipLabel}
                  size="small"
                  color={
                    contractAlert.health === 'error'
                      ? 'error'
                      : contractAlert.health === 'warning'
                        ? 'warning'
                        : contractAlert.health === 'success'
                          ? 'success'
                          : 'default'
                  }
                  variant={contractAlert.health === 'success' ? 'outlined' : 'filled'}
                />
              </Tooltip>
            </Box>
          </Box>
        </Box>

        <Stack spacing={1} sx={{ mt: 2 }}>
          {subscriber.email && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Email fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" noWrap>
                {subscriber.email}
              </Typography>
            </Box>
          )}

          {subscriber.phone && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Phone fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {subscriber.phone}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationOn fontSize="small" color="action" />
            <Tooltip title={subscriber.city || 'Cidade não informada'}>
              <Typography variant="body2" color="text.secondary" noWrap>
                {subscriber.city || 'Cidade não informada'}
              </Typography>
            </Tooltip>
          </Box>

          {subscriber.category_segment && (
            <Chip
              label={subscriber.category_segment}
              size="small"
              variant="outlined"
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            />
          )}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 1,
              mt: 1,
            }}
          >
            {metricItems.map((item) => (
              <Box
                key={item.label}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  minWidth: 0,
                }}
              >
                {item.icon}
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                    {item.value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Storage fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary" noWrap>
                Espaço da cota
              </Typography>
              <Typography variant="caption" sx={{ ml: 'auto', fontWeight: 600 }}>
                {storageLabel}
              </Typography>
            </Box>
            {storageLimitGB > 0 && (
              <LinearProgress
                variant="determinate"
                value={storagePercent}
                color={storagePercent > 90 ? 'error' : storagePercent > 75 ? 'warning' : 'primary'}
                sx={{ height: 6, borderRadius: 3 }}
              />
            )}
          </Box>
        </Stack>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        {onView && (
          <Tooltip title="Ver Detalhes">
            <IconButton size="small" onClick={() => onView(subscriber)}>
              <Visibility />
            </IconButton>
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(subscriber)}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Deletar">
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(subscriber)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

export default SubscriberCard;
