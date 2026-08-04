import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  useTheme,
  useMediaQuery,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Add,
  Delete,
  CheckCircle,
  Cancel,
  Block,
  History,
  Info,
  Refresh,
} from '@mui/icons-material';
import { publisherApi, Publisher } from '../../services/api';
import { subscriberAccessApi, SubscriberPublisherAccessDetail } from '../../services/api';
import { planApi, Plan } from '../../services/api';
import { subscriberApi } from '../../services/api';
import ResponsiveSectionNav from '../../components/Navigation/ResponsiveSectionNav';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { getProductTerminology } from '../../config/productTerminology';
import { selectLabelShrinkProps } from '../../utils/muiSelectLabel';
import { isInstallationModuleOn } from '../../utils/installationModuleAccess';

type SubscriberOption = {
  id: number;
  name: string;
};

function subscriberOptionId(row: { subscriber_id?: number; client_id?: number; id?: number }): number | null {
  const id = Number(row.subscriber_id ?? row.client_id ?? row.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`subscriber-publisher-access-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 0.5, sm: 1, md: 2 } }}>{children}</Box>}
    </div>
  );
}

const SubscriberPublisherAccessPage: React.FC = () => {
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const [tabValue, setTabValue] = useState(0);
  const [subscribers, setSubscribers] = useState<SubscriberOption[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [accessList, setAccessList] = useState<SubscriberPublisherAccessDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plansModuleOn = isInstallationModuleOn('plans');
  const contractsModuleOn = isInstallationModuleOn('contracts');
  const [filters, setFilters] = useState({
    subscriberId: '',
    publisherId: '',
    contractId: '',
    planId: '',
    isActive: undefined as boolean | undefined,
  });

  const [grantFormData, setGrantFormData] = useState({
    subscriberId: '',
    publisherId: '',
    contractId: '',
    expiresAt: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [filters, tabValue]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Multi Lite: não chamar /api/plans (módulo off → 403 «Planos e acessos»).
      const [subscribersRes, publishersRes, plansRes, accessRes] = await Promise.all([
        subscriberApi.getAll({ active_only: true, limit: 500 }),
        publisherApi.getAll({ active_only: true }),
        plansModuleOn ? planApi.getAll() : Promise.resolve([] as Plan[]),
        subscriberAccessApi.getAllAccess({
          subscriberId: filters.subscriberId ? parseInt(filters.subscriberId) : undefined,
          publisherId: filters.publisherId ? parseInt(filters.publisherId) : undefined,
          contractId: filters.contractId ? parseInt(filters.contractId) : undefined,
          planId: plansModuleOn && filters.planId ? parseInt(filters.planId) : undefined,
          isActive: filters.isActive,
        }),
      ]);

      const rawSubs = Array.isArray(subscribersRes?.data)
        ? subscribersRes.data
        : Array.isArray(subscribersRes)
          ? (subscribersRes as any[])
          : [];
      const mappedSubs: SubscriberOption[] = rawSubs
        .map((s: any) => {
          const id = subscriberOptionId(s);
          if (!id) return null;
          return { id, name: String(s.name || `Anunciante #${id}`) };
        })
        .filter((s: SubscriberOption | null): s is SubscriberOption => s != null);

      setSubscribers(mappedSubs);
      const pubs = Array.isArray(publishersRes)
        ? publishersRes
        : Array.isArray((publishersRes as any)?.data)
          ? (publishersRes as any).data
          : [];
      setPublishers(pubs);
      setPlans(plansModuleOn ? plansRes || [] : []);
      setAccessList(accessRes);
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao carregar dados'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGrantDialog = () => {
    setGrantFormData({
      subscriberId: '',
      publisherId: '',
      contractId: '',
      expiresAt: '',
      notes: '',
    });
    setGrantDialogOpen(true);
  };

  const handleCloseGrantDialog = () => {
    setGrantDialogOpen(false);
    setGrantFormData({
      subscriberId: '',
      publisherId: '',
      contractId: '',
      expiresAt: '',
      notes: '',
    });
  };

  const handleGrantAccess = async () => {
    try {
      setError(null);

      if (!grantFormData.subscriberId || !grantFormData.publisherId) {
        setError(`Anunciante e ${getProductTerminology().organization.toLowerCase()} são obrigatórios`);
        return;
      }
      if (contractsModuleOn && !grantFormData.contractId) {
        setError('Contrato é obrigatório quando o módulo de contratos está activo');
        return;
      }

      await subscriberAccessApi.grantAccess({
        subscriberId: parseInt(grantFormData.subscriberId),
        publisherId: parseInt(grantFormData.publisherId),
        ...(grantFormData.contractId
          ? { contractId: parseInt(grantFormData.contractId) }
          : {}),
        expiresAt: grantFormData.expiresAt || undefined,
        notes: grantFormData.notes || undefined,
      });

      handleCloseGrantDialog();
      await loadData();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao conceder acesso'));
    }
  };

  const handleRevokeAccess = async (subscriberId: number, publisherId: number) => {
    const reason = window.prompt('Motivo da revogação (opcional):');
    if (reason === null) return; // Usuário cancelou

    try {
      setError(null);
      await subscriberAccessApi.revokeAccess(subscriberId, publisherId, reason || undefined);
      await loadData();
    } catch (error: any) {
      setError(pickApiErrorMessage(error, 'Erro ao revogar acesso'));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const activeAccess = accessList.filter(a => a.isActive && !isExpired(a.expiresAt));
  const inactiveAccess = accessList.filter(a => !a.isActive || isExpired(a.expiresAt));
  const accessSections = [
    { icon: CheckCircle, label: `Acessos Ativos (${activeAccess.length})` },
    { icon: History, label: `Histórico (${inactiveAccess.length})` },
  ] as const;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: theme.palette.primary.main }}>
            {getProductTerminology().subscriberToOrgAccess}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
            Gerencie quais anunciantes podem exibir campanhas em cada organização
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenGrantDialog}
          sx={{
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark }
          }}
        >
          Conceder Acesso
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel {...selectLabelShrinkProps}>Anunciante</InputLabel>
                <Select
                  value={filters.subscriberId}
                  onChange={(e) => setFilters({ ...filters, subscriberId: e.target.value })}
                  label="Anunciante"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {subscribers.map((subscriber) => (
                    <MenuItem key={subscriber.id} value={subscriber.id.toString()}>
                      {subscriber.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel {...selectLabelShrinkProps}>{getProductTerminology().organization}</InputLabel>
                <Select
                  value={filters.publisherId}
                  onChange={(e) => setFilters({ ...filters, publisherId: e.target.value })}
                  label={getProductTerminology().organization}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {publishers.map((publisher) => (
                    <MenuItem key={publisher.publisher_id} value={publisher.publisher_id.toString()}>
                      {publisher.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel {...selectLabelShrinkProps}>Status</InputLabel>
                <Select
                  value={filters.isActive === undefined ? '' : filters.isActive ? 'active' : 'inactive'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters({
                      ...filters,
                      isActive: value === '' ? undefined : value === 'active'
                    });
                  }}
                  label="Status"
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="active">Ativo</MenuItem>
                  <MenuItem value="inactive">Inativo</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {plansModuleOn && (
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel {...selectLabelShrinkProps}>Plano</InputLabel>
                <Select
                  value={filters.planId}
                  onChange={(e) => setFilters({ ...filters, planId: e.target.value })}
                  label="Plano"
                >
                  <MenuItem value="">Todos</MenuItem>
                  {plans.map((plan) => {
                    const planId = plan.planId || plan.plan_id || 0;
                    return (
                      <MenuItem key={planId} value={planId.toString()}>
                        {plan.name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            )}
            <Grid item xs={12} md={2}>
              <Button fullWidth variant="outlined" startIcon={<Refresh />} onClick={loadData}>
                Atualizar
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <ResponsiveSectionNav
          sections={accessSections}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="subscriber-publisher-access"
        />

        <CardContent>
          <TabPanel value={tabValue} index={0}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Anunciante</strong></TableCell>
                    <TableCell><strong>{getProductTerminology().organization}</strong></TableCell>
                    <TableCell><strong>Tipo</strong></TableCell>
                    <TableCell><strong>Contrato</strong></TableCell>
                    <TableCell><strong>Plano</strong></TableCell>
                    <TableCell><strong>Concedido em</strong></TableCell>
                    <TableCell><strong>Expira em</strong></TableCell>
                    <TableCell><strong>Ações</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeAccess.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum acesso ativo encontrado.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeAccess.map((access) => (
                      <TableRow key={access.accessId}>
                        <TableCell>{access.subscriberName}</TableCell>
                        <TableCell>{access.publisherName}</TableCell>
                        <TableCell>
                          <Chip
                            label={access.accessType}
                            size="small"
                            color={access.accessType === 'override' ? 'warning' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{access.contractNumber || '-'}</TableCell>
                        <TableCell>{access.planName || '-'}</TableCell>
                        <TableCell>{formatDate(access.grantedAt)}</TableCell>
                        <TableCell>
                          {access.expiresAt ? (
                            <Chip
                              label={formatDate(access.expiresAt)}
                              size="small"
                              color={isExpired(access.expiresAt) ? 'error' : 'default'}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Sem expiração
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Revogar acesso">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRevokeAccess(access.subscriberId, access.publisherId)}
                            >
                              <Block />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Anunciante</strong></TableCell>
                    <TableCell><strong>{getProductTerminology().organization}</strong></TableCell>
                    <TableCell><strong>Tipo</strong></TableCell>
                    <TableCell><strong>Concedido em</strong></TableCell>
                    <TableCell><strong>Revogado em</strong></TableCell>
                    <TableCell><strong>Revogado por</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inactiveAccess.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          Nenhum histórico encontrado.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    inactiveAccess.map((access) => (
                      <TableRow key={access.accessId}>
                        <TableCell>{access.subscriberName}</TableCell>
                        <TableCell>{access.publisherName}</TableCell>
                        <TableCell>
                          <Chip label={access.accessType} size="small" />
                        </TableCell>
                        <TableCell>{formatDate(access.grantedAt)}</TableCell>
                        <TableCell>
                          {access.revokedAt ? (
                            <Chip label={formatDate(access.revokedAt)} size="small" color="error" />
                          ) : access.expiresAt && isExpired(access.expiresAt) ? (
                            <Chip label="Expirado" size="small" color="warning" />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>{access.grantedByName || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>
        </CardContent>
      </Card>

      {/* Grant Access Dialog */}
      <Dialog open={grantDialogOpen} onClose={handleCloseGrantDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Conceder Acesso</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel {...selectLabelShrinkProps}>Anunciante *</InputLabel>
              <Select
                value={grantFormData.subscriberId}
                onChange={(e) => setGrantFormData({ ...grantFormData, subscriberId: e.target.value })}
                label="Anunciante *"
              >
                <MenuItem value="">Selecione um anunciante</MenuItem>
                {subscribers.map((subscriber) => (
                  <MenuItem key={subscriber.id} value={subscriber.id.toString()}>
                    {subscriber.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel {...selectLabelShrinkProps}>{getProductTerminology().organization} *</InputLabel>
              <Select
                value={grantFormData.publisherId}
                onChange={(e) => setGrantFormData({ ...grantFormData, publisherId: e.target.value })}
                label={`${getProductTerminology().organization} *`}
              >
                <MenuItem value="">Selecione um publisher</MenuItem>
                {publishers.map((publisher) => (
                  <MenuItem key={publisher.publisher_id} value={publisher.publisher_id.toString()}>
                    {publisher.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label={contractsModuleOn ? 'ID do Contrato *' : 'ID do Contrato (opcional)'}
              type="number"
              value={grantFormData.contractId}
              onChange={(e) => setGrantFormData({ ...grantFormData, contractId: e.target.value })}
              margin="normal"
              helperText={
                contractsModuleOn
                  ? 'ID do contrato que concede este acesso'
                  : 'No Multi Lite pode deixar vazio — vínculo directo anunciante ↔ organização'
              }
            />

            <TextField
              fullWidth
              label="Data de Expiração"
              type="datetime-local"
              value={grantFormData.expiresAt}
              onChange={(e) => setGrantFormData({ ...grantFormData, expiresAt: e.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
              helperText="Deixe em branco para acesso permanente"
            />

            <TextField
              fullWidth
              label="Notas"
              multiline
              rows={2}
              value={grantFormData.notes}
              onChange={(e) => setGrantFormData({ ...grantFormData, notes: e.target.value })}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseGrantDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleGrantAccess}
            disabled={
              !grantFormData.subscriberId ||
              !grantFormData.publisherId ||
              (contractsModuleOn && !grantFormData.contractId)
            }
          >
            Conceder
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SubscriberPublisherAccessPage;

