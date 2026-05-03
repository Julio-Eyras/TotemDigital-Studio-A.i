/**
 * SubscriberDetails Component
 * Componente para exibir detalhes completos de um subscriber
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
  Store,
  Computer,
  Tv,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  VideoLibrary,
  QueueMusic,
  Campaign as CampaignIcon,
  Description,
  Add,
  OpenInNew,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Subscriber, Contract, subscriberApi, contractApi } from '../../../services/api';
import SubscriberStats from './SubscriberStats';

export interface SubscriberDetailsProps {
  open: boolean;
  subscriber: Subscriber | null;
  onClose: () => void;
  onEdit?: (subscriber: Subscriber) => void;
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

const SubscriberDetails: React.FC<SubscriberDetailsProps> = ({
  open,
  subscriber,
  onClose,
  onEdit,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<{
    locals: any[];
    totems: any[];
    smartTvs: any[];
    stats: any;
  } | null>(null);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && subscriber) {
      loadDetails();
    }
  }, [open, subscriber]);

  const loadDetails = async () => {
    if (!subscriber) return;

    try {
      setLoading(true);
      const [localsResponse, totemsResponse, smartTvsResponse, statsResponse, contractsResponse] =
        await Promise.all([
          subscriberApi.getLocals(subscriber.subscriber_id),
          subscriberApi.getTotems(subscriber.subscriber_id),
          subscriberApi.getSmartTvs(subscriber.subscriber_id),
          subscriberApi.getStats(subscriber.subscriber_id),
          subscriberApi.getContracts(subscriber.subscriber_id).catch(() => []),
        ]);

      setStats({
        locals: Array.isArray(localsResponse) ? localsResponse : [],
        totems: Array.isArray(totemsResponse) ? totemsResponse : [],
        smartTvs: Array.isArray(smartTvsResponse) ? smartTvsResponse : [],
        stats: statsResponse || {},
      });
      setActiveContracts(Array.isArray(contractsResponse) ? contractsResponse : []);
    } catch (error) {
      console.error('Erro ao carregar detalhes do subscriber:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Detalhes do Assinante - {subscriber.name}</DialogTitle>
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
          <Tab label="Locais" />
          <Tab label="Totens" />
          <Tab label="Smart TVs" />
          <Tab
            label="Contratos"
            icon={
              activeContracts.length > 0 ? (
                <Chip label={activeContracts.length} size="small" color="primary" />
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
                  <TableCell>{subscriber.name}</TableCell>
                </TableRow>
                {subscriber.contact_name && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Nome do Contato</TableCell>
                    <TableCell>{subscriber.contact_name}</TableCell>
                  </TableRow>
                )}
                {subscriber.email && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                    <TableCell>{subscriber.email}</TableCell>
                  </TableRow>
                )}
                {subscriber.phone && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Telefone</TableCell>
                    <TableCell>{subscriber.phone}</TableCell>
                  </TableRow>
                )}
                {subscriber.whatsapp && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>WhatsApp</TableCell>
                    <TableCell>{subscriber.whatsapp}</TableCell>
                  </TableRow>
                )}
                {subscriber.category_segment && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Categoria/Segmento</TableCell>
                    <TableCell>{subscriber.category_segment}</TableCell>
                  </TableRow>
                )}
                {subscriber.description && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Descrição</TableCell>
                    <TableCell>{subscriber.description}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Tipo de Cliente</TableCell>
                  <TableCell>
                    <Chip label="Anunciante" size="small" color="primary" />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell>
                    <Chip
                      label={subscriber.is_active ? 'Ativo' : 'Inativo'}
                      size="small"
                      color={subscriber.is_active ? 'success' : 'error'}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Criado em</TableCell>
                  <TableCell>
                    {subscriber.created_at ? formatDate(subscriber.created_at) : 'N/A'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Atualizado em</TableCell>
                  <TableCell>
                    {subscriber.updated_at ? formatDate(subscriber.updated_at) : 'N/A'}
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
        {activeTab === 4 && (
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
              <Typography variant="h6">Contratos ({activeContracts.length})</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => {
                    navigate(`/subscriber-contracts?subscriberId=${subscriber.subscriber_id}&openCreate=1`);
                  }}
                >
                  Criar Contrato
                </Button>
                <Button
                  variant="text"
                  endIcon={<OpenInNew />}
                  onClick={() => {
                    navigate(`/subscriber-contracts?subscriberId=${subscriber.subscriber_id}`);
                  }}
                >
                  Abrir Manutenção
                </Button>
              </Box>
            </Box>

            {activeContracts.length === 0 ? (
              <Alert severity="info">Nenhum contrato ativo encontrado para este anunciante.</Alert>
            ) : (
              <List>
                {activeContracts.map((contract: any, idx: number) => {
                  const isExpired =
                    contract.end_date && new Date(contract.end_date) < new Date();
                  const isExpiringSoon =
                    contract.end_date &&
                    new Date(contract.end_date) > new Date() &&
                    new Date(contract.end_date) <=
                      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                  return (
                    <ListItem
                      key={contract.contract_id || contract.contractId || `contract-${idx}`}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                      }}
                    >
                      <ListItemIcon>
                        <Description />
                      </ListItemIcon>
                      <ListItemText
                        primary={`${contract.contract_number || contract.contractNumber || 'N/A'} - ${
                          contract.title || 'Sem título'
                        }`}
                        secondary={`Status: ${contract.status || 'N/A'} • Início: ${
                          contract.start_date
                            ? new Date(contract.start_date).toLocaleDateString('pt-BR')
                            : 'N/A'
                        }${
                          contract.end_date
                            ? ` • Fim: ${new Date(contract.end_date).toLocaleDateString('pt-BR')}`
                            : ''
                        }`}
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        )}

        {/* Aba Estatísticas */}
        {activeTab === 5 && stats && (
          <SubscriberStats
            data={{
              locals: stats.locals,
              totems: stats.totems,
              smartTvs: stats.smartTvs,
              stats: stats.stats,
            }}
            subscriberId={subscriber?.subscriber_id}
          />
        )}
      </DialogContent>
      <DialogActions>
        {onEdit && (
          <Button onClick={() => onEdit(subscriber)} variant="contained">
            Editar
          </Button>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SubscriberDetails;
