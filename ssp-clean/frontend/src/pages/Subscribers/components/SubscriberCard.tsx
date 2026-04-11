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
} from '@mui/material';
import {
  Business,
  Email,
  Phone,
  Edit,
  Delete,
  Visibility,
} from '@mui/icons-material';
import { Subscriber } from '../../../services/api';

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
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
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
            <Chip
              label={subscriber.is_active ? 'Ativo' : 'Inativo'}
              size="small"
              color={subscriber.is_active ? 'success' : 'default'}
              sx={{ mt: 0.5 }}
            />
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

          {subscriber.category_segment && (
            <Chip
              label={subscriber.category_segment}
              size="small"
              variant="outlined"
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            />
          )}
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
