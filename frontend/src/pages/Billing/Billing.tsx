/**
 * Billing Page - Smart Signage v2.1
 * Página completa de gerenciamento de planos, assinaturas e faturas
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  InputAdornment,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Payment,
  Add,
  Refresh,
  Check,
  Cancel,
  CreditCard,
  Receipt,
  CheckCircle,
  Cancel as CancelIcon,
  Schedule,
  QrCode2,
  ReceiptLong,
  Email,
} from '@mui/icons-material';
import {
  billingControlApi,
  BillingControlDashboard,
  financialAdminApi,
  subscriberBillingApi,
  SubscriberBillingItem,
  publisherBillingApi,
  PublisherBillingItem,
} from '../../services/api';
import BillingControlPanel from './BillingControlPanel';
import FinancialInvoiceDialog, { FinancialDialogMode } from './FinancialInvoiceDialog';
import {
  getInvoiceDueAlertLevel,
  getInvoiceDueLabel,
  invoiceRowSx,
} from '../../utils/billingDueStatus';
import { planApi, Plan, subscriptionApi, Subscription } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../store';
import ResponsiveSectionNav from '../../components/navigation/ResponsiveSectionNav';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';
import { TOTEMDIGITAL_COMPACT } from '../../config/featureFlags';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`billing-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>{children}</Box>}
    </div>
  );
}

const Billing: React.FC = () => {
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const { showSuccess, showError } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const userType = (user as any)?.user_type || (user as any)?.userType;
  const isSubscriberUser = userType === 'subscriber_user' || user?.role === 'subscriber_user';
  const isPublisherUser = userType === 'publisher_user' || user?.role === 'publisher_user';
  const canViewAllBillingTypes =
    user?.role === 'owner_system' ||
    user?.role === 'admin_sql' ||
    user?.role === 'admin' ||
    user?.role === 'operador_faturamento';

  /** Criar/editar faturas nas APIs subscriber/publisher (incl. dono no mono compacto). */
  const canCreateModernInvoices =
    canViewAllBillingTypes || (TOTEMDIGITAL_COMPACT && isPublisherUser);

  const DUE_SOON_DAYS = 30;
  const rawType = searchParams.get('type');
  /** Escopo: anunciantes ou exibidor (sem legado "todos"). */
  const billingType = (() => {
    if (isSubscriberUser) return 'subscriber';
    if (isPublisherUser && !canViewAllBillingTypes) {
      return rawType === 'subscriber' || rawType === 'publisher' ? rawType : 'publisher';
    }
    if (TOTEMDIGITAL_COMPACT) return rawType === 'publisher' ? 'publisher' : 'subscriber';
    return rawType === 'publisher' ? 'publisher' : 'subscriber';
  })();
  
  const [tabValue, setTabValue] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [dashboard, setDashboard] = useState<BillingControlDashboard | null>(null);
  const [subscriberBillings, setSubscriberBillings] = useState<SubscriberBillingItem[]>([]);
  const [publisherBillings, setPublisherBillings] = useState<PublisherBillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createSubscriberOpen, setCreateSubscriberOpen] = useState(false);
  const [createPublisherOpen, setCreatePublisherOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [financialDialog, setFinancialDialog] = useState<{
    open: boolean;
    mode: FinancialDialogMode;
    billingId: number | null;
    amount?: number;
  }>({ open: false, mode: 'pay', billingId: null });
  const [issuingInvoices, setIssuingInvoices] = useState(false);
  const [stripeReturnHandled, setStripeReturnHandled] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [newSubscriberInvoice, setNewSubscriberInvoice] = useState({
    subscriberId: '',
    billingType: 'advertisement' as
      | 'advertisement'
      | 'campaign'
      | 'media_upload'
      | 'exhibition_lot'
      | 'totem_quantity'
      | 'time_based'
      | 'custom',
    amount: '',
    dueDate: '',
    description: '',
  });
  const [newPublisherInvoice, setNewPublisherInvoice] = useState({
    publisherId: '',
    billingType: 'subscription' as 'revenue_share' | 'payout' | 'subscription' | 'platform_fee',
    direction: 'incoming' as 'incoming' | 'outgoing',
    amount: '',
    dueDate: '',
    description: '',
  });
  const parseCurrencyInputValue = (raw: string): number => {
    const normalized = raw.replace(',', '.').trim();
    if (!normalized) return 0;
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) return 0;
    return Math.max(0, parsed);
  };

  // Helper functions para compatibilidade com interface Plan atualizada
  const getPlanId = (plan: Plan): number => {
    return plan.planId || plan.plan_id || 0;
  };

  const getPlanPrice = (plan: Plan): number => {
    return plan.priceMonthly || plan.price_monthly || 0;
  };

  const getPlanBillingInterval = (plan: Plan): string => {
    return plan.billingInterval || plan.billing_interval || 'month';
  };

  const getPlanFeatures = (plan: Plan): string[] => {
    if (Array.isArray(plan.features)) {
      return plan.features;
    }
    if (typeof plan.features === 'object' && plan.features !== null) {
      // Se for objeto, converter para array de strings
      return Object.entries(plan.features).map(([key, value]) => 
        `${key}: ${typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : value}`
      );
    }
    return [];
  };
  
  // Filtros
  const [subscriberFilters, setSubscriberFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    billingType: '',
    dueFilter: '' as '' | 'overdue' | 'due_soon',
    startDate: '',
    endDate: '',
    search: '',
  });
  
  const [publisherFilters, setPublisherFilters] = useState({
    page: 1,
    limit: 20,
    paymentStatus: '',
    billingType: '',
    direction: '',
    dueFilter: '' as '' | 'overdue' | 'due_soon',
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    loadAll();
  }, [billingType]);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const paidParam = searchParams.get('paid');
    if (!sessionId || !paidParam || stripeReturnHandled) return;

    setStripeReturnHandled(true);
    (async () => {
      try {
        const result = await financialAdminApi.completeStripeSession(sessionId);
        if (result.success) {
          showSuccess('Pagamento confirmado via Stripe');
          await loadAll();
        } else {
          showError('Pagamento ainda não confirmado no Stripe. Tente atualizar em instantes.');
        }
      } catch (e: unknown) {
        showError(pickApiErrorMessage(e, 'Erro ao confirmar pagamento Stripe'));
      } finally {
        const next = new URLSearchParams(searchParams);
        next.delete('session_id');
        next.delete('paid');
        setSearchParams(next, { replace: true });
      }
    })();
  }, [searchParams, stripeReturnHandled]);

  const loadDashboard = async () => {
    try {
      const data = await billingControlApi.getDashboard({
        dueSoonDays: DUE_SOON_DAYS,
        publisherId:
          TOTEMDIGITAL_COMPACT && user?.publisherId != null ? Number(user.publisherId) : undefined,
      });
      setDashboard(data);
    } catch {
      setDashboard(null);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadDashboard(),
        loadPlans(),
        isSubscriberUser ? Promise.resolve() : loadSubscriptions(),
        billingType === 'subscriber' ? loadSubscriberBillings() : Promise.resolve(),
        billingType === 'publisher' ? loadPublisherBillings() : Promise.resolve(),
      ]);
    } catch (e) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const plansData = await planApi.getAll();
      setPlans(plansData);
    } catch (e) {
      showError('Erro ao carregar planos');
    }
  };

  const loadSubscriptions = async () => {
    try {
      if (isSubscriberUser) {
        setSubscriptions([]);
        return;
      }
      const subsData = await subscriptionApi.getAll();
      setSubscriptions(subsData);
    } catch (e) {
      showError('Erro ao carregar assinaturas');
    }
  };

  const loadSubscriberBillings = async () => {
    try {
      const response = await subscriberBillingApi.getAll({
        ...subscriberFilters,
        dueFilter: subscriberFilters.dueFilter || undefined,
        dueSoonDays: subscriberFilters.dueFilter === 'due_soon' ? DUE_SOON_DAYS : undefined,
      });
      setSubscriberBillings(response.billings || []);
    } catch (e) {
      showError('Erro ao carregar faturas de assinantes');
    }
  };

  const loadPublisherBillings = async () => {
    try {
      const filters = {
        ...publisherFilters,
        dueFilter: publisherFilters.dueFilter || undefined,
        dueSoonDays: publisherFilters.dueFilter === 'due_soon' ? DUE_SOON_DAYS : undefined,
        direction:
          publisherFilters.direction && publisherFilters.direction !== ''
            ? (publisherFilters.direction as 'incoming' | 'outgoing')
            : undefined,
      };
      const response = await publisherBillingApi.getAll(filters);
      setPublisherBillings(response.billings || []);
    } catch (e) {
      showError('Erro ao carregar faturas do exibidor');
    }
  };

  const applyInvoiceDueFilter = async (filter: 'overdue' | 'due_soon' | '') => {
    setTabValue(2);
    if (billingType === 'subscriber') {
      const next = { ...subscriberFilters, dueFilter: filter, status: '', page: 1 };
      setSubscriberFilters(next);
      try {
        const response = await subscriberBillingApi.getAll({
          ...next,
          dueFilter: filter || undefined,
          dueSoonDays: filter === 'due_soon' ? DUE_SOON_DAYS : undefined,
        });
        setSubscriberBillings(response.billings || []);
      } catch {
        showError('Erro ao filtrar faturas');
      }
    } else if (billingType === 'publisher') {
      const next = { ...publisherFilters, dueFilter: filter, paymentStatus: '', page: 1 };
      setPublisherFilters(next);
      try {
        const response = await publisherBillingApi.getAll({
          ...next,
          dueFilter: filter || undefined,
          dueSoonDays: filter === 'due_soon' ? DUE_SOON_DAYS : undefined,
          direction:
            next.direction && next.direction !== ''
              ? (next.direction as 'incoming' | 'outgoing')
              : undefined,
        });
        setPublisherBillings(response.billings || []);
      } catch {
        showError('Erro ao filtrar faturas');
      }
    }
  };

  const sendSubscriberPaymentEmail = async (id: number) => {
    try {
      const result = await financialAdminApi.sendPaymentEmail(id);
      if (result.sent) {
        showSuccess('E-mail de cobrança enviado');
      } else {
        showError(result.reason || 'Não foi possível enviar o e-mail');
      }
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao enviar e-mail'));
    }
  };

  const startStripeCheckout = async (id: number) => {
    try {
      const { url } = await financialAdminApi.createStripeCheckout(id);
      if (url) window.location.href = url;
      else showError('Stripe não retornou URL de pagamento');
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao abrir checkout Stripe'));
    }
  };

  const markSubscriberPaid = async (id: number) => {
    try {
      await financialAdminApi.recordPayment(id, { paymentMethod: 'pix' });
      await Promise.all([loadSubscriberBillings(), loadDashboard()]);
      showSuccess('Pagamento registado');
    } catch (e: any) {
      showError(pickApiErrorMessage(e, 'Erro ao registar pagamento'));
    }
  };

  const handleIssueContractInvoices = async () => {
    setIssuingInvoices(true);
    try {
      const result = await financialAdminApi.issueInvoices({});
      await Promise.all([loadSubscriberBillings(), loadDashboard()]);
      showSuccess(
        `Emissão concluída: ${result.created} criada(s), ${result.skipped} já existente(s)${
          result.errors.length ? `, ${result.errors.length} erro(s)` : ''
        }.`
      );
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao emitir faturas do período'));
    } finally {
      setIssuingInvoices(false);
    }
  };

  const openFinancialDialog = (mode: FinancialDialogMode, billing: SubscriberBillingItem) => {
    setFinancialDialog({
      open: true,
      mode,
      billingId: billing.billing_id,
      amount: billing.amount,
    });
  };

  const handleCreateSubscriberInvoice = async () => {
    const sid = Number.parseInt(String(newSubscriberInvoice.subscriberId).trim(), 10);
    const amt = parseCurrencyInputValue(newSubscriberInvoice.amount);
    if (!Number.isFinite(sid) || sid < 1 || !amt) {
      showError('Indique um ID de anunciante válido e um valor.');
      return;
    }
    try {
      await subscriberBillingApi.create({
        subscriberId: sid,
        billingType: newSubscriberInvoice.billingType,
        amount: amt,
        description: newSubscriberInvoice.description || undefined,
        dueDate: newSubscriberInvoice.dueDate || undefined,
      });
      setCreateSubscriberOpen(false);
      setNewSubscriberInvoice({
        subscriberId: '',
        billingType: 'advertisement',
        amount: '',
        dueDate: '',
        description: '',
      });
      await loadSubscriberBillings();
      showSuccess('Cobrança de anunciante criada.');
    } catch (e: any) {
      showError(pickApiErrorMessage(e, 'Erro ao criar cobrança de anunciante'));
    }
  };

  const handleCreatePublisherInvoice = async () => {
    const pidFromUser = user?.publisherId != null ? Number(user.publisherId) : NaN;
    const pidFromForm = Number.parseInt(String(newPublisherInvoice.publisherId).trim(), 10);
    const pid =
      TOTEMDIGITAL_COMPACT && isPublisherUser && Number.isFinite(pidFromUser)
        ? pidFromUser
        : pidFromForm;
    const amt = parseCurrencyInputValue(newPublisherInvoice.amount);
    if (!Number.isFinite(pid) || pid < 1 || !amt) {
      showError('Indique o publicador e um valor válidos (no mono, o utilizador deve ter publisherId).');
      return;
    }
    try {
      await publisherBillingApi.create({
        publisherId: pid,
        billingType: newPublisherInvoice.billingType,
        direction: newPublisherInvoice.direction,
        amount: amt,
        description: newPublisherInvoice.description || undefined,
        dueDate: newPublisherInvoice.dueDate || undefined,
      });
      setCreatePublisherOpen(false);
      setNewPublisherInvoice({
        publisherId: '',
        billingType: 'subscription',
        direction: 'incoming',
        amount: '',
        dueDate: '',
        description: '',
      });
      await loadPublisherBillings();
      showSuccess('Fatura de publicador criada.');
    } catch (e: any) {
      showError(pickApiErrorMessage(e, 'Erro ao criar fatura de publicador'));
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    const planId = selectedPlan.planId || selectedPlan.plan_id;
    if (!planId) {
      showError('ID do plano não encontrado');
      return;
    }

    try {
      const checkout = await subscriptionApi.create({
        planId: planId,
      });

      // Redirecionar para finalização de pagamento no Stripe
      if (checkout.url) {
        window.location.href = checkout.url;
      } else {
        showError('Erro ao criar sessão de checkout');
      }
    } catch (e: any) {
      const msg = pickApiErrorMessage(e, 'Erro ao criar assinatura');
      setError(msg);
      showError(msg);
    }
  };

  const handleCancelSubscription = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta assinatura?')) return;

    try {
      await subscriptionApi.cancel(id);
      loadSubscriptions();
      showSuccess('Assinatura cancelada com sucesso');
    } catch (e: any) {
      showError(pickApiErrorMessage(e, 'Erro ao cancelar assinatura'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
        return 'success';
      case 'cancelled':
      case 'unpaid':
        return 'error';
      case 'past_due':
        return 'warning';
      case 'trialing':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const billingTabLabel =
    billingType === 'subscriber'
      ? 'Faturas Anunciantes'
      : billingType === 'publisher'
      ? 'Faturas Publicadores'
      : 'Faturas';
  const BILLING_SECTIONS = [
    { label: 'Planos', icon: CreditCard },
    { label: 'Assinaturas', icon: Receipt },
    { label: billingTabLabel, icon: Payment },
  ] as const;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: { xs: 2.5, md: 4 }, fontSize: { xs: '1.4rem', md: undefined } }}>
        Faturamento e Assinaturas
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <BillingControlPanel
        dashboard={dashboard}
        loading={loading}
        showPublisherKpis={billingType === 'publisher' || canViewAllBillingTypes}
        publisherLabel={TOTEMDIGITAL_COMPACT ? 'Exibidor (sistema)' : 'Publicadores'}
        onFilterInvoices={canViewAllBillingTypes || !isSubscriberUser ? applyInvoiceDueFilter : undefined}
        formatCurrency={(n) => formatCurrency(n)}
      />

      {/* Filtro de tipo de billing */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Tipo de Faturamento</InputLabel>
          <Select
            value={billingType}
            label="Tipo de Faturamento"
            onChange={(e) => {
              setSearchParams({ type: e.target.value });
              setTabValue(0); // Resetar para primeira aba ao mudar tipo
            }}
          >
            {!isSubscriberUser && <MenuItem value="subscriber">Anunciantes</MenuItem>}
            {!isSubscriberUser && (
              <MenuItem value="publisher">
                {TOTEMDIGITAL_COMPACT ? 'Exibidor (sistema)' : 'Publicadores'}
              </MenuItem>
            )}
            {isSubscriberUser && <MenuItem value="subscriber">Anunciantes</MenuItem>}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ mb: 3 }}>
        <ResponsiveSectionNav
          sections={BILLING_SECTIONS}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="billing"
        />
      </Box>

      {/* TAB: PLANOS */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">Planos Disponíveis</Typography>
          <Button
            startIcon={<Refresh />}
            variant="outlined"
            onClick={loadPlans}
            disabled={loading}
          >
            Atualizar
          </Button>
        </Box>

        <Grid container spacing={3}>
          {plans.map((plan) => (
            <Grid item xs={12} md={4} key={getPlanId(plan)}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: plan.is_active ? '2px solid' : '1px solid',
                  borderColor: plan.is_active ? 'primary.main' : 'divider',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                      {plan.name}
                    </Typography>
                    <Chip
                      label={plan.is_active ? 'Ativo' : 'Inativo'}
                      color={plan.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                    {formatCurrency(getPlanPrice(plan), plan.currency || 'BRL')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    / {getPlanBillingInterval(plan) === 'month' ? 'mês' : 'ano'}
                  </Typography>

                  {plan.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {plan.description}
                    </Typography>
                  )}

                  <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
                    Recursos:
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {getPlanFeatures(plan).map((feature, idx) => (
                      <li key={idx}>
                        <Typography variant="body2">{feature}</Typography>
                      </li>
                    ))}
                  </Box>
                </CardContent>
                <CardActions>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                      setSelectedPlan(plan);
                      setSubscribeOpen(true);
                    }}
                    disabled={!plan.is_active}
                  >
                    Assinar
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* TAB: ASSINATURAS */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">Minhas Assinaturas</Typography>
          <Button
            startIcon={<Refresh />}
            variant="outlined"
            onClick={loadSubscriptions}
            disabled={loading}
          >
            Atualizar
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Plano</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Valor</TableCell>
                <TableCell>Período</TableCell>
                <TableCell>Início</TableCell>
                <TableCell>Próximo Pagamento</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.subscription_id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {sub.plan?.name || `Plano #${sub.plan_id}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={sub.status}
                      color={getStatusColor(sub.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {formatCurrency(sub.amount, sub.currency)}
                  </TableCell>
                  <TableCell>
                    {sub.billing_interval === 'month' ? 'Mensal' : 'Anual'}
                  </TableCell>
                  <TableCell>
                    {new Date(sub.start_date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell align="right">
                    {sub.status === 'active' && (
                      <Tooltip title="Cancelar Assinatura">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleCancelSubscription(sub.subscription_id)}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {subscriptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma assinatura encontrada
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* TAB: FATURAS ASSINANTES */}
      {billingType === 'subscriber' && (
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={subscriberFilters.status}
                label="Status"
                onChange={(e) => {
                  setSubscriberFilters({
                    ...subscriberFilters,
                    status: e.target.value,
                    dueFilter: '',
                    page: 1,
                  });
                }}
                onClose={() => loadSubscriberBillings()}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="pending">Pendente</MenuItem>
                <MenuItem value="paid">Pago</MenuItem>
                <MenuItem value="overdue">Vencido</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Vencimento</InputLabel>
              <Select
                value={subscriberFilters.dueFilter}
                label="Vencimento"
                onChange={(e) => {
                  setSubscriberFilters({
                    ...subscriberFilters,
                    dueFilter: e.target.value as '' | 'overdue' | 'due_soon',
                    status: '',
                    page: 1,
                  });
                }}
                onClose={() => loadSubscriberBillings()}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="overdue">Só vencidas</MenuItem>
                <MenuItem value="due_soon">A vencer ({DUE_SOON_DAYS}d)</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={subscriberFilters.billingType}
                label="Tipo"
                onChange={(e) => {
                  setSubscriberFilters({ ...subscriberFilters, billingType: e.target.value, page: 1 });
                }}
                onClose={() => loadSubscriberBillings()}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="advertisement">Publicidade</MenuItem>
                <MenuItem value="campaign">Campanha</MenuItem>
                <MenuItem value="media_upload">Upload de Mídia</MenuItem>
                <MenuItem value="exhibition_lot">Lote de Exibição</MenuItem>
                <MenuItem value="totem_quantity">Quantidade de Totens</MenuItem>
                <MenuItem value="time_based">Baseado em Tempo</MenuItem>
                <MenuItem value="custom">Personalizado</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Buscar"
              value={subscriberFilters.search}
              onChange={(e) => setSubscriberFilters({ ...subscriberFilters, search: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  loadSubscriberBillings();
                }
              }}
            />
            <Button startIcon={<Refresh />} variant="outlined" onClick={loadSubscriberBillings}>
              Atualizar
            </Button>
            {canCreateModernInvoices && (
              <>
                <Button
                  startIcon={<ReceiptLong />}
                  variant="outlined"
                  disabled={issuingInvoices}
                  onClick={handleIssueContractInvoices}
                >
                  Emitir faturas do período
                </Button>
                <Button startIcon={<Add />} variant="contained" onClick={() => setCreateSubscriberOpen(true)}>
                  Nova cobrança (anunciante)
                </Button>
              </>
            )}
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Assinante</TableCell>
                  <TableCell>Campanha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Alerta</TableCell>
                  <TableCell>Pago em</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subscriberBillings.map((billing) => {
                  const dueLevel = getInvoiceDueAlertLevel(
                    {
                      status: billing.status,
                      due_date: billing.due_date,
                      is_overdue: (billing as any).is_overdue,
                      is_due_soon: (billing as any).is_due_soon,
                      days_overdue: (billing as any).days_overdue,
                      days_until_due: (billing as any).days_until_due,
                    },
                    DUE_SOON_DAYS
                  );
                  const dueLabel = getInvoiceDueLabel(
                    {
                      status: billing.status,
                      due_date: billing.due_date,
                      is_overdue: (billing as any).is_overdue,
                      days_overdue: (billing as any).days_overdue,
                      days_until_due: (billing as any).days_until_due,
                    },
                    DUE_SOON_DAYS
                  );
                  return (
                  <TableRow key={billing.billing_id} sx={invoiceRowSx(dueLevel)}>
                    <TableCell>{billing.billing_id}</TableCell>
                    <TableCell>{billing.subscriber_name || `Assinante #${billing.subscriber_id}`}</TableCell>
                    <TableCell>{billing.campaign_title || '-'}</TableCell>
                    <TableCell>{billing.billing_type}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: billing.currency || 'BRL' }).format(billing.amount)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={billing.status}
                        color={getStatusColor(billing.status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {billing.due_date ? new Date(billing.due_date).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>
                      {dueLabel ? (
                        <Chip
                          size="small"
                          label={dueLabel}
                          color={dueLevel === 'error' ? 'error' : dueLevel === 'warning' ? 'warning' : 'default'}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {billing.paid_at ? new Date(billing.paid_at).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {billing.status !== 'paid' && canCreateModernInvoices && (
                        <>
                          <Tooltip title="QR Code PIX">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => openFinancialDialog('qr', billing)}
                            >
                              <QrCode2 />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Registar pagamento">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => openFinancialDialog('pay', billing)}
                            >
                              <Payment />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Enviar e-mail de cobrança">
                            <IconButton
                              size="small"
                              color="info"
                              onClick={() => sendSubscriberPaymentEmail(billing.billing_id)}
                            >
                              <Email />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Pagar com Stripe">
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => startStripeCheckout(billing.billing_id)}
                            >
                              <CreditCard />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Marcar pago (rápido)">
                            <IconButton
                              size="small"
                              onClick={() => markSubscriberPaid(billing.billing_id)}
                            >
                              <Check />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                  );
                })}
                {subscriberBillings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma fatura de assinante encontrada
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      )}

      {/* TAB: FATURAS PUBLICADORES */}
      {billingType === 'publisher' && (
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={publisherFilters.paymentStatus}
                label="Status"
                onChange={(e) => {
                  setPublisherFilters({
                    ...publisherFilters,
                    paymentStatus: e.target.value,
                    dueFilter: '',
                    page: 1,
                  });
                }}
                onClose={() => loadPublisherBillings()}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="pending">Pendente</MenuItem>
                <MenuItem value="pending_payout">Pendente Pagamento</MenuItem>
                <MenuItem value="paid">Pago</MenuItem>
                <MenuItem value="failed">Falhou</MenuItem>
                <MenuItem value="refunded">Reembolsado</MenuItem>
                <MenuItem value="cancelled">Cancelado</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Vencimento</InputLabel>
              <Select
                value={publisherFilters.dueFilter}
                label="Vencimento"
                onChange={(e) => {
                  setPublisherFilters({
                    ...publisherFilters,
                    dueFilter: e.target.value as '' | 'overdue' | 'due_soon',
                    paymentStatus: '',
                    page: 1,
                  });
                }}
                onClose={() => loadPublisherBillings()}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="overdue">Só vencidas</MenuItem>
                <MenuItem value="due_soon">A vencer ({DUE_SOON_DAYS}d)</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Direção</InputLabel>
              <Select
                value={publisherFilters.direction}
                label="Direção"
                onChange={(e) => {
                  setPublisherFilters({ ...publisherFilters, direction: e.target.value, page: 1 });
                }}
                onClose={() => loadPublisherBillings()}
              >
                <MenuItem value="">Todas</MenuItem>
                <MenuItem value="incoming">Entrada</MenuItem>
                <MenuItem value="outgoing">Saída</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={publisherFilters.billingType}
                label="Tipo"
                onChange={(e) => {
                  setPublisherFilters({ ...publisherFilters, billingType: e.target.value, page: 1 });
                }}
                onClose={() => loadPublisherBillings()}
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="revenue_share">Participação na Receita</MenuItem>
                <MenuItem value="payout">Repasse</MenuItem>
                <MenuItem value="subscription">Assinatura</MenuItem>
                <MenuItem value="platform_fee">Taxa de Plataforma</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Buscar"
              value={publisherFilters.search}
              onChange={(e) => setPublisherFilters({ ...publisherFilters, search: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  loadPublisherBillings();
                }
              }}
            />
            <Button startIcon={<Refresh />} variant="outlined" onClick={loadPublisherBillings}>
              Atualizar
            </Button>
            {canCreateModernInvoices && (
              <Button startIcon={<Add />} variant="contained" onClick={() => setCreatePublisherOpen(true)}>
                {TOTEMDIGITAL_COMPACT ? 'Nova fatura (exibidor)' : 'Nova fatura (publicador)'}
              </Button>
            )}
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  {!TOTEMDIGITAL_COMPACT && <TableCell>Publicador</TableCell>}
                  <TableCell>Campanha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Direção</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Alerta</TableCell>
                  <TableCell>Pago em</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publisherBillings.map((billing) => {
                  const dueLevel = getInvoiceDueAlertLevel(
                    {
                      payment_status: billing.payment_status,
                      due_date: billing.due_date,
                      is_overdue: (billing as any).is_overdue,
                      is_due_soon: (billing as any).is_due_soon,
                    },
                    DUE_SOON_DAYS
                  );
                  const dueLabel = getInvoiceDueLabel(
                    {
                      payment_status: billing.payment_status,
                      due_date: billing.due_date,
                      is_overdue: (billing as any).is_overdue,
                      days_until_due: (billing as any).days_until_due,
                    },
                    DUE_SOON_DAYS
                  );
                  return (
                  <TableRow key={billing.billing_id} sx={invoiceRowSx(dueLevel)}>
                    <TableCell>{billing.billing_id}</TableCell>
                    {!TOTEMDIGITAL_COMPACT && (
                      <TableCell>{billing.publisher_name || `Publicador #${billing.publisher_id}`}</TableCell>
                    )}
                    <TableCell>{billing.campaign_title || '-'}</TableCell>
                    <TableCell>{billing.billing_type}</TableCell>
                    <TableCell>
                      <Chip
                        label={billing.direction === 'incoming' ? 'Entrada' : 'Saída'}
                        color={billing.direction === 'incoming' ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: billing.currency || 'BRL' }).format(billing.amount)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={billing.payment_status}
                        color={getStatusColor(billing.payment_status) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {billing.due_date ? new Date(billing.due_date).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell>
                      {dueLabel ? (
                        <Chip
                          size="small"
                          label={dueLabel}
                          color={dueLevel === 'error' ? 'error' : dueLevel === 'warning' ? 'warning' : 'default'}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {billing.paid_at ? new Date(billing.paid_at).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                  </TableRow>
                  );
                })}
                {publisherBillings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={TOTEMDIGITAL_COMPACT ? 9 : 10} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {TOTEMDIGITAL_COMPACT
                          ? 'Nenhuma fatura do exibidor encontrada'
                          : 'Nenhuma fatura de publicador encontrada'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      )}

      {canCreateModernInvoices && (
        <Dialog open={createSubscriberOpen} onClose={() => setCreateSubscriberOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Nova cobrança (anunciante)</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              margin="normal"
              label="ID do anunciante (subscriber)"
              value={newSubscriberInvoice.subscriberId}
              onChange={(e) => setNewSubscriberInvoice({ ...newSubscriberInvoice, subscriberId: e.target.value })}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={newSubscriberInvoice.billingType}
                onChange={(e) =>
                  setNewSubscriberInvoice({
                    ...newSubscriberInvoice,
                    billingType: e.target.value as typeof newSubscriberInvoice.billingType,
                  })
                }
              >
                <MenuItem value="advertisement">Publicidade</MenuItem>
                <MenuItem value="campaign">Campanha</MenuItem>
                <MenuItem value="media_upload">Upload de mídia</MenuItem>
                <MenuItem value="exhibition_lot">Lote de exibição</MenuItem>
                <MenuItem value="totem_quantity">Quantidade de totens</MenuItem>
                <MenuItem value="time_based">Baseado em tempo</MenuItem>
                <MenuItem value="custom">Personalizado</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              margin="normal"
              label="Valor (R$)"
              value={newSubscriberInvoice.amount}
              onChange={(e) => setNewSubscriberInvoice({ ...newSubscriberInvoice, amount: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Vencimento"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={newSubscriberInvoice.dueDate}
              onChange={(e) => setNewSubscriberInvoice({ ...newSubscriberInvoice, dueDate: e.target.value })}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Descrição"
              value={newSubscriberInvoice.description}
              onChange={(e) => setNewSubscriberInvoice({ ...newSubscriberInvoice, description: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateSubscriberOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleCreateSubscriberInvoice}>
              Criar
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {canCreateModernInvoices && (
        <Dialog open={createPublisherOpen} onClose={() => setCreatePublisherOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Nova fatura (publicador)</DialogTitle>
          <DialogContent>
            {(!TOTEMDIGITAL_COMPACT || !isPublisherUser || user?.publisherId == null) && (
              <TextField
                fullWidth
                margin="normal"
                label="ID do publicador"
                value={newPublisherInvoice.publisherId}
                onChange={(e) => setNewPublisherInvoice({ ...newPublisherInvoice, publisherId: e.target.value })}
                helperText={
                  TOTEMDIGITAL_COMPACT && isPublisherUser && user?.publisherId == null
                    ? 'O seu utilizador não tem publisherId; indique o ID do exibidor.'
                    : undefined
                }
              />
            )}
            {TOTEMDIGITAL_COMPACT && isPublisherUser && user?.publisherId != null && (
              <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                Publicador: #{user.publisherId} (mono compacto)
              </Alert>
            )}
            <FormControl fullWidth margin="normal">
              <InputLabel>Tipo</InputLabel>
              <Select
                label="Tipo"
                value={newPublisherInvoice.billingType}
                onChange={(e) =>
                  setNewPublisherInvoice({
                    ...newPublisherInvoice,
                    billingType: e.target.value as typeof newPublisherInvoice.billingType,
                  })
                }
              >
                <MenuItem value="subscription">Assinatura</MenuItem>
                <MenuItem value="platform_fee">Taxa de plataforma</MenuItem>
                <MenuItem value="payout">Repasse</MenuItem>
                <MenuItem value="revenue_share">Participação na receita</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Direção</InputLabel>
              <Select
                label="Direção"
                value={newPublisherInvoice.direction}
                onChange={(e) =>
                  setNewPublisherInvoice({
                    ...newPublisherInvoice,
                    direction: e.target.value as 'incoming' | 'outgoing',
                  })
                }
              >
                <MenuItem value="incoming">Entrada (ex.: o exibidor paga)</MenuItem>
                <MenuItem value="outgoing">Saída (ex.: reparte / recebe)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              margin="normal"
              label="Valor (R$)"
              value={newPublisherInvoice.amount}
              onChange={(e) => setNewPublisherInvoice({ ...newPublisherInvoice, amount: e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Vencimento"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={newPublisherInvoice.dueDate}
              onChange={(e) => setNewPublisherInvoice({ ...newPublisherInvoice, dueDate: e.target.value })}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Descrição"
              value={newPublisherInvoice.description}
              onChange={(e) => setNewPublisherInvoice({ ...newPublisherInvoice, description: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreatePublisherOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleCreatePublisherInvoice}>
              Criar
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* DIALOG: ASSINAR PLANO */}
      <Dialog open={subscribeOpen} onClose={() => setSubscribeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assinar Plano</DialogTitle>
        <DialogContent>
          {selectedPlan && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedPlan.name}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                {formatCurrency(getPlanPrice(selectedPlan), selectedPlan.currency || 'BRL')}
                <Typography component="span" variant="body2" color="text.secondary">
                  {' '}/ {getPlanBillingInterval(selectedPlan) === 'month' ? 'mês' : 'ano'}
                </Typography>
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                Você será redirecionado para o Stripe para completar o pagamento.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubscribeOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubscribe} disabled={!selectedPlan}>
            Continuar para Pagamento
          </Button>
        </DialogActions>
      </Dialog>

      <FinancialInvoiceDialog
        open={financialDialog.open}
        mode={financialDialog.mode}
        billingId={financialDialog.billingId}
        amount={financialDialog.amount}
        onClose={() => setFinancialDialog({ open: false, mode: 'pay', billingId: null })}
        onSuccess={() => {
          loadSubscriberBillings();
          loadDashboard();
        }}
      />
    </Box>
  );
};

export default Billing;
