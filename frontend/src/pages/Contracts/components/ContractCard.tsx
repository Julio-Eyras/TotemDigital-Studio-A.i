/**
 * ContractCard Component
 * Card reutilizável para exibir informações de um contrato
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
  Description,
  Edit,
  Delete,
  Visibility,
  People,
  Assignment,
  CalendarToday,
  AttachMoney,
} from '@mui/icons-material';
import { Contract } from '../../../services/api';

export interface ContractCardProps {
  contract: Contract;
  canViewSensitiveValues?: boolean;
  onEdit?: (contract: Contract) => void;
  onDelete?: (contract: Contract) => void;
  onView?: (contract: Contract) => void;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('pt-BR');
};

const getStatusColor = (status: string): 'success' | 'default' | 'warning' | 'error' => {
  switch (status) {
    case 'active':
      return 'success';
    case 'draft':
      return 'default';
    case 'expired':
      return 'warning';
    case 'terminated':
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'draft':
      return 'Rascunho';
    case 'expired':
      return 'Expirado';
    case 'terminated':
      return 'Terminado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return status;
  }
};

const getContractTypeLabel = (type: string) => {
  switch (type) {
    case 'advertising':
      return 'Publicidade';
    case 'subscription':
      return 'Assinatura';
    case 'partnership':
      return 'Parceria';
    case 'revenue_share':
      return 'Revenue Share';
    case 'hybrid':
      return 'Híbrido';
    default:
      return type;
  }
};

const ContractCard: React.FC<ContractCardProps> = ({
  contract,
  canViewSensitiveValues = false,
  onEdit,
  onDelete,
  onView,
}) => {
  const theme = useTheme();

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
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.main,
          }}
        >
          <Description />
        </Avatar>

        <Chip
          label={getStatusLabel(contract.status)}
          size="small"
          color={getStatusColor(contract.status)}
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
            {formatDate(contract.created_at)}
          </Typography>
        </Box>
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }} noWrap>
          {contract.title}
        </Typography>

        <Chip
          label={getContractTypeLabel(contract.contract_type)}
          size="small"
          color="primary"
          sx={{ mb: 1 }}
        />

        <Stack spacing={1} sx={{ mt: 2 }}>
          {contract.subscriber_name && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <People fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" noWrap>
                {contract.subscriber_name}
              </Typography>
            </Box>
          )}

          {contract.contract_number && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Assignment fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary" noWrap>
                {contract.contract_number}
              </Typography>
            </Box>
          )}

          {contract.start_date && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {formatDate(contract.start_date)}
                {contract.end_date && ` - ${formatDate(contract.end_date)}`}
              </Typography>
            </Box>
          )}

          {contract.total_amount && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {canViewSensitiveValues
                  ? `${contract.currency} ${contract.total_amount.toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                    })}`
                  : 'Valor confidencial'}
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
        {onView && (
          <Tooltip title="Ver Detalhes">
            <IconButton size="small" onClick={() => onView(contract)}>
              <Visibility />
            </IconButton>
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip title="Editar">
            <IconButton size="small" onClick={() => onEdit(contract)}>
              <Edit />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Deletar">
            <IconButton size="small" color="error" onClick={() => onDelete(contract)}>
              <Delete />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
};

export default ContractCard;
