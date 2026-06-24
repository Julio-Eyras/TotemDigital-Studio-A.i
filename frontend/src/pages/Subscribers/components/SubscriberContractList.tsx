import React from 'react';
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  Typography,
  useTheme,
} from '@mui/material';
import { Delete, Edit } from '@mui/icons-material';
import { formatCurrencyAmount } from '../subscriberContractUtils';

export interface SubscriberContractListItem {
  contract_id: number;
  contract_number?: string;
  title?: string;
  description?: string;
  plan_name?: string;
  start_date?: string;
  end_date?: string;
  total_amount?: number | null;
  currency?: string;
  status?: string;
}

export interface SubscriberContractListProps {
  contracts: SubscriberContractListItem[];
  onEdit: (contract: SubscriberContractListItem) => void;
  onDelete: (contract: SubscriberContractListItem) => void;
  /** Contrato cuja rede está em exibição (aba Contratos → painel inferior). */
  selectedContractId?: number | null;
  onSelect?: (contract: SubscriberContractListItem) => void;
}

const SubscriberContractList: React.FC<SubscriberContractListProps> = ({
  contracts,
  onEdit,
  onDelete,
  selectedContractId = null,
  onSelect,
}) => {
  const theme = useTheme();

  return (
    <List>
      {contracts.map((contract) => {
        const isSelected =
          selectedContractId != null && Number(contract.contract_id) === Number(selectedContractId);

        return (
        <ListItem
          key={contract.contract_id}
          onClick={onSelect ? () => onSelect(contract) : undefined}
          sx={{
            border: `1px solid ${
              isSelected ? theme.palette.primary.main : theme.palette.divider
            }`,
            borderRadius: 1,
            mb: 1,
            flexDirection: 'column',
            alignItems: 'stretch',
            cursor: onSelect ? 'pointer' : 'default',
            bgcolor: isSelected ? 'action.selected' : 'background.paper',
            '&:hover': onSelect
              ? { bgcolor: isSelected ? 'action.selected' : 'action.hover' }
              : undefined,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {contract.contract_number} - {contract.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {contract.description || 'Sem descrição'}
                {contract.plan_name && ` | Plano: ${contract.plan_name}`}
                {contract.start_date &&
                  ` | Início: ${new Date(contract.start_date).toLocaleDateString('pt-BR')}`}
                {contract.end_date &&
                  ` | Fim: ${new Date(contract.end_date).toLocaleDateString('pt-BR')}`}
                {contract.total_amount != null &&
                  ` | Valor: ${formatCurrencyAmount(contract.total_amount, contract.currency || 'BRL')}`}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={contract.status || 'draft'}
                size="small"
                color={contract.status === 'active' ? 'success' : 'default'}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(contract);
                }}
                aria-label="Editar contrato"
              >
                <Edit />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(contract);
                }}
                aria-label="Excluir contrato"
              >
                <Delete />
              </IconButton>
            </Box>
          </Box>
        </ListItem>
        );
      })}
    </List>
  );
};

export default SubscriberContractList;
