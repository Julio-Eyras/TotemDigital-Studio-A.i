/**
 * SubscriberDetails Component
 * Componente para exibir detalhes completos de um subscriber
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
  Divider,
  Paper,
  Tooltip,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Description,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { Subscriber, Contract, subscriberApi } from '../../../services/api';
import SubscriberStats from './SubscriberStats';
import { loadPlanTopologyPreviewRows, countTopologyInRows, PlanTopologyPreviewRow } from '../planTopologyPreview';
import { PlanTopologyTabPanel } from '../PlanTopologyTabPanel';
import {
  getSubscriberContractHealth,
  SUBSCRIBER_CONTRACT_STATUS_OPTIONS,
  normalizeSubscriberContractStatus,
} from '../subscriberContractHealth';
import { pickApiErrorMessage } from '../../../utils/apiErrorMessage';

type ContractStatusFilter = 'all' | (typeof SUBSCRIBER_CONTRACT_STATUS_OPTIONS)[number]['value'];

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

const statusChipIcon = (health: 'success' | 'warning' | 'error') => {
  if (health === 'success') return <CheckCircle />;
  if (health === 'error') return <ErrorIcon />;
  return <Warning />;
};

const SubscriberDetails: React.FC<SubscriberDetailsProps> = ({
  open,
  subscriber,
  onClose,
  onEdit,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<{
    locals: any[];
    totems: any[];
    smartTvs: any[];
    stats: any;
  } | null>(null);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [topologyPreview, setTopologyPreview] = useState<{
    loading: boolean;
    error: string | null;
    rows: PlanTopologyPreviewRow[];
  }>({ loading: false, error: null, rows: [] });
  /** Sub-abas Locais/Totens/TVs por contract_id */
  const [topologySubTabByContract, setTopologySubTabByContract] = useState<Record<number, number>>({});
  const [contractStatusFilter, setContractStatusFilter] = useState<ContractStatusFilter>('all');

  const filteredContracts = useMemo(() => {
    if (contractStatusFilter === 'all') return activeContracts;
    return activeContracts.filter(
      (c: any) => normalizeSubscriberContractStatus(c?.status) === contractStatusFilter
    );
  }, [activeContracts, contractStatusFilter]);

  useEffect(() => {
    if (open && subscriber) {
      loadDetails();
    }
  }, [open, subscriber]);

  useEffect(() => {
    if (!open) {
      setTopologySubTabByContract({});
      setContractStatusFilter('all');
    }
  }, [open]);

  useEffect(() => {
    if (!open || !subscriber || activeContracts.length === 0) {
      setTopologyPreview({ loading: false, error: null, rows: [] });
      return;
    }
    let cancelled = false;
    const load = async () => {
      setTopologyPreview((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const rows = await loadPlanTopologyPreviewRows(
          activeContracts.map((c: any) => ({
            contract_id: c.contract_id,
            plan_id: c.plan_id,
            title: c.title,
            contract_number: c.contract_number,
          }))
        );
        if (!cancelled) {
          setTopologyPreview({ loading: false, error: null, rows });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setTopologyPreview({
            loading: false,
            error: pickApiErrorMessage(e, 'Erro ao carregar rede do plano'),
            rows: [],
          });
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, subscriber?.subscriber_id, activeContracts]);

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
          subscriberApi.getContracts(subscriber.subscriber_id, { activeOnly: false }).catch(() => []),
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

        {loading && <LinearProgress sx={{ mb: 2 }} />}

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

        {/* Aba Contratos — rede do plano aninhada por contrato */}
        {activeTab === 1 && (
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
                  Contratos ({filteredContracts.length}
                  {contractStatusFilter !== 'all' && activeContracts.length !== filteredContracts.length
                    ? ` de ${activeContracts.length}`
                    : ''}
                  )
                </Typography>
                {contractStatusFilter !== 'all' && filteredContracts.length === 0 && activeContracts.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Nenhum contrato com este status. Ajuste o filtro ou escolha &quot;Todos&quot;.
                  </Typography>
                )}
              </Box>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="subscriber-details-contract-status-filter">Status</InputLabel>
                <Select
                  labelId="subscriber-details-contract-status-filter"
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

            {activeContracts.length === 0 ? (
              <Alert severity="info">Nenhum contrato encontrado para este anunciante.</Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredContracts.map((contract: any, idx: number) => {
                  const cid = Number(contract.contract_id ?? contract.contractId ?? idx);
                  const health = getSubscriberContractHealth(contract as Record<string, unknown>);
                  const chipColor =
                    health.health === 'success' ? 'success' : health.health === 'error' ? 'error' : 'warning';
                  const fullIdx = activeContracts.findIndex(
                    (c: any) => Number(c.contract_id ?? c.contractId) === cid
                  );
                  const topoRow =
                    fullIdx >= 0 && topologyPreview.rows[fullIdx]
                      ? topologyPreview.rows[fullIdx]
                      : undefined;
                  const counts = topoRow ? countTopologyInRows([topoRow]) : { lc: 0, tt: 0, st: 0 };
                  const subTab = topologySubTabByContract[cid] ?? 0;
                  const singlePreview = {
                    loading: topologyPreview.loading,
                    error: topologyPreview.error,
                    rows: topoRow ? [topoRow] : [],
                  };

                  return (
                    <Paper key={cid} variant="outlined" sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 2,
                          flexWrap: 'wrap',
                          mb: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0 }}>
                          <Description color="action" sx={{ mt: 0.25 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {contract.contract_number || contract.contractNumber || 'N/A'} —{' '}
                              {contract.title || 'Sem título'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {contract.plan_name && (
                                <>
                                  Plano: {contract.plan_name}
                                  {' · '}
                                </>
                              )}
                              Início:{' '}
                              {contract.start_date
                                ? new Date(contract.start_date).toLocaleDateString('pt-BR')
                                : 'N/A'}
                              {contract.end_date &&
                                ` · Fim: ${new Date(contract.end_date).toLocaleDateString('pt-BR')}`}
                            </Typography>
                          </Box>
                        </Box>
                        <Tooltip title={health.tooltip}>
                          <Chip
                            size="small"
                            icon={statusChipIcon(health.health)}
                            label={health.chipLabel}
                            color={chipColor}
                            variant={health.health === 'warning' ? 'outlined' : 'filled'}
                            sx={{ flexShrink: 0 }}
                          />
                        </Tooltip>
                      </Box>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        Rede permitida pelo plano (somente leitura)
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                        Locais, totens e Smart TVs que este contrato outorga via plano — igual ao fluxo de cadastro.
                      </Typography>

                      <Tabs
                        value={subTab}
                        onChange={(_, v) =>
                          setTopologySubTabByContract((prev) => ({ ...prev, [cid]: v }))
                        }
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
                      >
                        <Tab
                          label="Locais"
                          icon={
                            counts.lc > 0 ? (
                              <Chip label={counts.lc} size="small" color="primary" />
                            ) : undefined
                          }
                          iconPosition="end"
                        />
                        <Tab
                          label="Totens"
                          icon={
                            counts.tt > 0 ? (
                              <Chip label={counts.tt} size="small" color="primary" />
                            ) : undefined
                          }
                          iconPosition="end"
                        />
                        <Tab
                          label="Smart TVs"
                          icon={
                            counts.st > 0 ? (
                              <Chip label={counts.st} size="small" color="primary" />
                            ) : undefined
                          }
                          iconPosition="end"
                        />
                      </Tabs>

                      {subTab === 0 && (
                        <PlanTopologyTabPanel
                          mode="locals"
                          preview={singlePreview}
                          variant="details"
                          contractCount={1}
                          dense
                        />
                      )}
                      {subTab === 1 && (
                        <PlanTopologyTabPanel
                          mode="totens"
                          preview={singlePreview}
                          variant="details"
                          contractCount={1}
                          dense
                        />
                      )}
                      {subTab === 2 && (
                        <PlanTopologyTabPanel
                          mode="smartTvs"
                          preview={singlePreview}
                          variant="details"
                          contractCount={1}
                          dense
                        />
                      )}
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* Aba Estatísticas */}
        {activeTab === 2 && stats && (
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
