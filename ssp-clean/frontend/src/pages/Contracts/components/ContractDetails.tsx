/**
 * ContractDetails Component
 * Componente para exibir detalhes completos de um contrato
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Chip,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import {
  Description,
  Business,
  People,
  Assignment,
  CalendarToday,
  AttachMoney,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Contract, contractApi, Publisher } from '../../../services/api';

export interface ContractDetailsProps {
  open: boolean;
  contract: Contract | null;
  onClose: () => void;
  onEdit?: (contract: Contract) => void;
  canViewSensitiveValues?: boolean;
}

const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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

const ContractDetails: React.FC<ContractDetailsProps> = ({
  open,
  contract,
  onClose,
  onEdit,
  canViewSensitiveValues = false,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [publishers, setPublishers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && contract) {
      loadDetails();
    }
  }, [open, contract]);

  const loadDetails = async () => {
    if (!contract) return;

    try {
      setLoading(true);
      const publishersData = await contractApi.getPublishers(contract.contract_id);
      setPublishers(Array.isArray(publishersData) ? publishersData : []);
    } catch (error) {
      console.error('Erro ao carregar detalhes do contrato:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!contract) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Description />
          <Typography variant="h6">Detalhes do Contrato - {contract.title}</Typography>
          <Chip
            label={getStatusLabel(contract.status)}
            size="small"
            color={getStatusColor(contract.status)}
            sx={{ ml: 'auto' }}
          />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab label="Informações" />
          <Tab
            label="Publicadores"
            icon={
              publishers.length > 0 ? (
                <Chip label={publishers.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
        </Tabs>

        {/* Aba Informações */}
        {activeTab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Número do Contrato</TableCell>
                  <TableCell>{contract.contract_number}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Título</TableCell>
                  <TableCell>{contract.title}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                  <TableCell>
                    <Chip label={getContractTypeLabel(contract.contract_type)} size="small" color="primary" />
                  </TableCell>
                </TableRow>
                {contract.subscriber_name && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Assinante</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <People fontSize="small" />
                        {contract.subscriber_name}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {contract.plan_name && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Plano</TableCell>
                    <TableCell>{contract.plan_name}</TableCell>
                  </TableRow>
                )}
                {contract.description && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                    <TableCell>{contract.description}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Data de Início</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarToday fontSize="small" />
                      {formatDate(contract.start_date)}
                    </Box>
                  </TableCell>
                </TableRow>
                {contract.end_date && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Data de Término</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarToday fontSize="small" />
                        {formatDate(contract.end_date)}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {contract.total_amount && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Valor Total</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AttachMoney fontSize="small" />
                        {canViewSensitiveValues
                          ? `${contract.currency} ${contract.total_amount.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}`
                          : 'Valor confidencial'}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {contract.payment_terms && canViewSensitiveValues && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Condições de Pagamento</TableCell>
                    <TableCell>{contract.payment_terms}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(contract.status)}
                      size="small"
                      color={getStatusColor(contract.status)}
                    />
                  </TableCell>
                </TableRow>
                {contract.signed_by_subscriber_at && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Assinado por Assinante em</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle fontSize="small" color="success" />
                        {formatDate(contract.signed_by_subscriber_at)}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {contract.signed_by_publisher_at && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Assinado por Publicador em</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle fontSize="small" color="success" />
                        {formatDate(contract.signed_by_publisher_at)}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                {contract.signed_by_tenant_at && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Assinado por Tenant em</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CheckCircle fontSize="small" color="success" />
                        {formatDate(contract.signed_by_tenant_at)}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                  <TableCell>{formatDate(contract.created_at)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                  <TableCell>{formatDate(contract.updated_at)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Aba Publicadores */}
        {activeTab === 1 && (
          <Box>
            {loading ? (
              <LinearProgress />
            ) : publishers.length === 0 ? (
              <Alert severity="info">
                Nenhum publicador associado a este contrato.
              </Alert>
            ) : (
              <List>
                {publishers.map((publisher: any) => (
                  <Card key={publisher.publisher_id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                        <Business color="primary" />
                        <Typography variant="h6">{publisher.name}</Typography>
                        <Chip
                          label={publisher.is_active ? 'Ativo' : 'Inativo'}
                          size="small"
                          color={publisher.is_active ? 'success' : 'default'}
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                      {publisher.email && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Email: {publisher.email}
                        </Typography>
                      )}
                      {publisher.phone && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Telefone: {publisher.phone}
                        </Typography>
                      )}
                      {publisher.access_created_at && (
                        <Typography variant="caption" color="text.secondary">
                          Acesso criado em: {formatDate(publisher.access_created_at)}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        {onEdit && (
          <Button variant="contained" onClick={() => onEdit(contract)}>
            Editar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ContractDetails;
