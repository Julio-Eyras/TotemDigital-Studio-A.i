/**
 * PublisherCard Component
 * Card reutilizável para exibir informações de uma organização (publisher)
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
import { Publisher } from '../../../services/api';
import { getProductTerminology } from '../../../config/productTerminology';

export interface PublisherCardProps {
  publisher: Publisher;
  onEdit?: (publisher: Publisher) => void;
  onDelete?: (publisher: Publisher) => void;
  onView?: (publisher: Publisher) => void;
}

const getClientTypeLabel = (clientType?: string) => {
  switch (clientType) {
    case 'subscriber':
      return 'Assinante';
    case 'publisher':
      return getProductTerminology().organization;
    case 'both':
      return 'Ambos';
    default:
      return 'N/A';
  }
};

const getClientTypeColor = (clientType?: string): 'primary' | 'success' | 'warning' | 'default' => {
  switch (clientType) {
    case 'subscriber':
      return 'primary';
    case 'publisher':
      return 'success';
    case 'both':
      return 'warning';
    default:
      return 'default';
  }
};

const PublisherCard: React.FC<PublisherCardProps> = ({
  publisher,
  onEdit,
  onDelete,
  onView,
}) => {
  const totemsCount = Number(publisher.totems_count ?? 0);
  const localsCount = Number(publisher.locals_count ?? 0);
  const category = String(publisher.category_segment || '').trim();
  // Segmento da org + quantidade de totens dessa organização (ex.: «Totens (3)»).
  const segmentChipLabel = category
    ? `${category} (${totemsCount})`
    : `${totemsCount} ${totemsCount === 1 ? 'totem' : 'totens'}`;

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
              bgcolor: 'success.main',
              width: 56,
              height: 56,
              mr: 2,
            }}
          >
            <Business />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" noWrap>
              {publisher.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              <Chip
                label={(publisher.active ?? publisher.is_active) ? 'Ativo' : 'Inativo'}
                size="small"
                color={(publisher.active ?? publisher.is_active) ? 'success' : 'default'}
              />
              {publisher.client_type && (
                <Chip
                  label={getClientTypeLabel(publisher.client_type)}
                  size="small"
                  color={getClientTypeColor(publisher.client_type)}
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        </Box>

        <Stack spacing={1} sx={{ mt: 2 }}>
          {publisher.email && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Email fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" noWrap>
                {publisher.email}
              </Typography>
            </Box>
          )}

          {publisher.phone && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Phone fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {publisher.phone}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
            <Chip
              label={segmentChipLabel}
              size="small"
              color="primary"
              variant="outlined"
            />
            {localsCount > 0 && (
              <Chip
                label={`${localsCount} ${localsCount === 1 ? 'local' : 'locais'}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Stack>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        {onView && (
          <Tooltip title="Ver Detalhes">
            <IconButton size="small" onClick={() => onView(publisher)}>
              <Visibility />
            </IconButton>
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(publisher)}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Deletar">
            <IconButton
              size="small"
              color="error"
              onClick={() => onDelete(publisher)}
            >
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

export default PublisherCard;
