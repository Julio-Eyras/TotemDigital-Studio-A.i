/**
 * PublisherDetails Component
 * Componente para exibir detalhes completos de um publisher
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Store,
  Computer,
  Tv,
  CheckCircle,
  Description,
  CalendarToday,
  Assignment,
  AttachMoney,
} from '@mui/icons-material';
import { Publisher, publisherApi, publisherContractApi } from '../../../services/api';
import {
  SUBSCRIBER_CONTRACT_STATUS_OPTIONS,
  normalizeSubscriberContractStatus,
} from '../../Subscribers/subscriberContractHealth';

type ContractStatusFilter = 'all' | (typeof SUBSCRIBER_CONTRACT_STATUS_OPTIONS)[number]['value'];

export interface PublisherDetailsProps {
  open: boolean;
  publisher: Publisher | null;
  onClose: () => void;
  onEdit?: (publisher: Publisher) => void;
}

const formatDate = (date: string | Date): string => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const getClientTypeLabel = (clientType?: string) => {
  switch (clientType) {
    case 'subscriber':
      return 'Assinante';
    case 'publisher':
      return 'Publicador';
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

const PublisherDetails: React.FC<PublisherDetailsProps> = ({
  open,
  publisher,
  onClose,
  onEdit,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatusFilter>('all');
  const [stats, setStats] = useState<{
    locals: any[];
    totems: any[];
    smartTvs: any[];
    contracts?: any[];
    stats: any;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const allPublisherContracts = Array.isArray(stats?.contracts) ? stats.contracts : [];
  const filteredPublisherContracts = useMemo(() => {
    if (contractStatusFilter === 'all') return allPublisherContracts;
    return allPublisherContracts.filter(
      (c: any) => normalizeSubscriberContractStatus(c?.status) === contractStatusFilter
    );
  }, [allPublisherContracts, contractStatusFilter]);

  useEffect(() => {
    if (open && publisher) {
      loadDetails();
    }
  }, [open, publisher]);

  useEffect(() => {
    if (!open) {
      setContractStatusFilter('all');
    }
  }, [open]);

  const loadDetails = async () => {
    if (!publisher) return;

    try {
      setLoading(true);
      const [localsResponse, totemsResponse, smartTvsResponse, statsResponse, contractsResponse] =
        await Promise.all([
          publisherApi.getLocals(publisher.publisher_id),
          publisherApi.getTotems(publisher.publisher_id),
          publisherApi.getSmartTvs(publisher.publisher_id),
          publisherApi.getStats(publisher.publisher_id).catch(() => ({})),
          publisherContractApi.getAll({ publisherId: publisher.publisher_id }).catch(() => ({ data: [] })),
        ]);

      setStats({
        locals: Array.isArray(localsResponse) ? localsResponse : [],
        totems: Array.isArray(totemsResponse) ? totemsResponse : [],
        smartTvs: Array.isArray(smartTvsResponse) ? smartTvsResponse : [],
        contracts: Array.isArray(contractsResponse?.data) ? contractsResponse.data : [],
        stats: statsResponse || {},
      });
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  if (!publisher) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Detalhes do Publicador - {publisher.name}</DialogTitle>
      <DialogContent>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 2 }}
        >
          <Tab label="Informações" />
          <Tab
            label="Locais"
            icon={
              stats && stats.locals.length > 0 ? (
                <Chip label={stats.locals.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab
            label="Totens"
            icon={
              stats && stats.totems.length > 0 ? (
                <Chip label={stats.totems.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab
            label="Smart TVs"
            icon={
              stats && stats.smartTvs.length > 0 ? (
                <Chip label={stats.smartTvs.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab
            label="Contratos"
            icon={
              stats && stats.contracts && stats.contracts.length > 0 ? (
                <Chip label={stats.contracts.length} size="small" color="primary" />
              ) : undefined
            }
            iconPosition="end"
          />
          <Tab label="Estatísticas" />
        </Tabs>

        {/* Aba Informações */}
        {activeTab === 0 && (
          <TableContainer>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Nome da Empresa</TableCell>
                  <TableCell>{publisher.name}</TableCell>
                </TableRow>
                {publisher.contact_name && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Nome do Contato</TableCell>
                    <TableCell>{publisher.contact_name}</TableCell>
                  </TableRow>
                )}
                {publisher.email && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                    <TableCell>{publisher.email}</TableCell>
                  </TableRow>
                )}
                {publisher.phone && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Telefone</TableCell>
                    <TableCell>{publisher.phone}</TableCell>
                  </TableRow>
                )}
                {publisher.whatsapp && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>WhatsApp</TableCell>
                    <TableCell>{publisher.whatsapp}</TableCell>
                  </TableRow>
                )}
                {publisher.category_segment && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Categoria/Segmento</TableCell>
                    <TableCell>{publisher.category_segment}</TableCell>
                  </TableRow>
                )}
                {publisher.description && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                    <TableCell>{publisher.description}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tipo de Cliente</TableCell>
                  <TableCell>
                    <Chip
                      label={getClientTypeLabel(publisher.client_type)}
                      size="small"
                      color={getClientTypeColor(publisher.client_type)}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell>
                    <Chip
                      label={(publisher.active ?? publisher.is_active) ? 'Ativo' : 'Inativo'}
                      size="small"
                      color={(publisher.active ?? publisher.is_active) ? 'success' : 'error'}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                  <TableCell>
                    {publisher.created_at ? formatDate(publisher.created_at) : 'N/A'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                  <TableCell>
                    {publisher.updated_at ? formatDate(publisher.updated_at) : 'N/A'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Aba Locais */}
        {activeTab === 1 && stats && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Locais ({stats.locals.length})
            </Typography>
            {stats.locals.length === 0 ? (
              <Alert severity="info">Nenhum local cadastrado</Alert>
            ) : (
              <List>
                {stats.locals.map((local: any) => (
                  <ListItem key={local.local_id}>
                    <ListItemIcon>
                      <Store />
                    </ListItemIcon>
                    <ListItemText primary={local.name} secondary={local.address || 'Sem endereço'} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Aba Totens */}
        {activeTab === 2 && stats && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Totens ({stats.totems.length})
            </Typography>
            {stats.totems.length === 0 ? (
              <Alert severity="info">Nenhum totem cadastrado</Alert>
            ) : (
              <List>
                {stats.totems.map((totem: any) => (
                  <ListItem key={totem.totem_id}>
                    <ListItemIcon>
                      <Computer />
                    </ListItemIcon>
                    <ListItemText
                      primary={totem.name || totem.identifier}
                      secondary={`Status: ${totem.status || 'N/A'}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Aba Smart TVs */}
        {activeTab === 3 && stats && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Smart TVs ({stats.smartTvs.length})
            </Typography>
            {stats.smartTvs.length === 0 ? (
              <Alert severity="info">Nenhuma Smart TV cadastrada</Alert>
            ) : (
              <List>
                {stats.smartTvs.map((tv: any, index: number) => (
                  <ListItem key={tv.smart_tv_id || `tv-${index}`}>
                    <ListItemIcon>
                      <Tv />
                    </ListItemIcon>
                    <ListItemText
                      primary={tv.name || tv.identifier}
                      secondary={`${tv.brand || ''} ${tv.model || ''} - Status: ${tv.status || 'N/A'}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Aba Contratos */}
        {activeTab === 4 && stats && (
          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="h6">
                  Contratos ({filteredPublisherContracts.length}
                  {contractStatusFilter !== 'all' &&
                  allPublisherContracts.length !== filteredPublisherContracts.length
                    ? ` de ${allPublisherContracts.length}`
                    : ''}
                  )
                </Typography>
                {contractStatusFilter !== 'all' &&
                  filteredPublisherContracts.length === 0 &&
                  allPublisherContracts.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      Nenhum contrato com este status. Ajuste o filtro ou escolha &quot;Todos&quot;.
                    </Typography>
                  )}
              </Box>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="publisher-details-contract-status-filter">Status</InputLabel>
                <Select
                  labelId="publisher-details-contract-status-filter"
                  label="Status"
                  value={contractStatusFilter}
                  onChange={(e) => setContractStatusFilter(e.target.value as ContractStatusFilter)}
                >
                  <MenuItem value="all">Todos</MenuItem>
                  {SUBSCRIBER_CONTRACT_STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {!stats.contracts || stats.contracts.length === 0 ? (
              <Alert severity="info">Nenhum contrato encontrado para este publicador.</Alert>
            ) : (
              <List>
                {filteredPublisherContracts.map((contract: any, idx: number) => (
                  <ListItem
                    key={contract.contract_id || `contract-${idx}`}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                      flexDirection: 'column',
                      alignItems: 'stretch',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          {contract.contract_number || 'N/A'} - {contract.title || 'Sem título'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {contract.description || 'Sem descrição'}
                        </Typography>
                      </Box>
                      <Chip
                        label={
                          SUBSCRIBER_CONTRACT_STATUS_OPTIONS.find(
                            (o) => o.value === normalizeSubscriberContractStatus(contract.status)
                          )?.label ||
                          contract.status ||
                          'Rascunho'
                        }
                        size="small"
                        color={
                          contract.status === 'active'
                            ? 'success'
                            : contract.status === 'expired' ||
                              contract.status === 'terminated' ||
                              contract.status === 'cancelled'
                            ? 'error'
                            : 'default'
                        }
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
                      {contract.start_date && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            Início: {new Date(contract.start_date).toLocaleDateString('pt-BR')}
                          </Typography>
                        </Box>
                      )}
                      {contract.end_date && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            Fim: {new Date(contract.end_date).toLocaleDateString('pt-BR')}
                          </Typography>
                        </Box>
                      )}
                      {contract.contract_type && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Assignment fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            Tipo: {contract.contract_type}
                          </Typography>
                        </Box>
                      )}
                      {contract.revenue_share_percentage !== undefined &&
                        contract.revenue_share_percentage !== null &&
                        typeof contract.revenue_share_percentage === 'number' &&
                        !isNaN(Number(contract.revenue_share_percentage)) &&
                        Number(contract.revenue_share_percentage) >= 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <AttachMoney fontSize="small" color="action" />
                            <Typography variant="caption" color="text.secondary">
                              Revenue Share: {Number(contract.revenue_share_percentage || 0)}%
                            </Typography>
                          </Box>
                        )}
                    </Box>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}

        {/* Aba Estatísticas */}
        {activeTab === 5 && stats && (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <CardContent>
                  <Store sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.locals.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Locais
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <CardContent>
                  <Computer sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.totems.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Totens
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ textAlign: 'center', py: 2 }}>
                <CardContent>
                  <Tv sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {stats.smartTvs.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Smart TVs
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            {stats.stats && stats.stats.onlineTotems !== undefined && (
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ textAlign: 'center', py: 2 }}>
                  <CardContent>
                    <CheckCircle sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {stats.stats.onlineTotems || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Totens Online
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        {onEdit && (
          <Button onClick={() => onEdit(publisher)} variant="contained">
            Editar
          </Button>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PublisherDetails;
