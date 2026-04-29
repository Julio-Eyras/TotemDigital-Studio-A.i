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
  Alert,
  Chip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
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
} from '@mui/icons-material';
import { billingApi, BillingItem, CreateBillingRequest, subscriberBillingApi, SubscriberBillingItem, SubscriberBillingListResponse, publisherBillingApi, PublisherBillingItem, PublisherBillingListResponse } from '../../services/api';
import { planApi, Plan, subscriptionApi, Subscription } from '../../services/api';
import { useNotification } from '../../hooks/useNotification';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../store';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Billing: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [searchParams, setSearchParams] = useSearchParams();
  const billingType = searchParams.get('type') || 'all'; // 'all', 'subscriber', 'publisher'
  const { user } = useAppSelector((state) => state.auth);
  const userType = (user as any)?.user_type || (user as any)?.userType;
  const isSubscriberUser = userType === 'subscriber_user' || user?.role === 'subscriber_user';
  
  const [tabValue, setTabValue] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [items, setItems] = useState<BillingItem[]>([]);
  const [subscriberBillings, setSubscriberBillings] = useState<SubscriberBillingItem[]>([]);
  const [publisherBillings, setPublisherBillings] = useState<PublisherBillingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [newBill, setNewBill] = useState<CreateBillingRequest>({ billing_type: 'subscription', amount: 0 });

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
    startDate: '',
    endDate: '',
    search: '',
  });

  useEffect(() => {
    loadAll();
  }, [billingType]);

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPlans(),
        // Subscriptions são apenas para publishers (subscriber_user não deve carregar)
        isSubscriberUser ? Promise.resolve() : loadSubscriptions(),
        billingType === 'all' || billingType === 'subscriber' ? loadSubscriberBillings() : Promise.resolve(),
        billingType === 'all' || billingType === 'publisher' ? loadPublisherBillings() : Promise.resolve(),
        billingType === 'all' ? loadBillings() : Promise.resolve(),
      ]);
    } catch (e) {
      console.error('Erro ao carregar dados:', e);
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
      console.error('Erro ao carregar planos:', e);
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
      console.error('Erro ao carregar assinaturas:', e);
      showError('Erro ao carregar assinaturas');
    }
  };

  const loadBillings = async () => {
    try {
      const resp = await billingApi.getAll();
      const itemsArray = Array.isArray(resp) ? resp : [];
      const normalizedItems = itemsArray.map(item => ({
        ...item,
        amount: typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount || 0))
      }));
      setItems(normalizedItems);
    } catch (e) {
      console.error('Erro ao carregar faturas:', e);
      showError('Erro ao carregar faturas');
    }
  };

  const loadSubscriberBillings = async () => {
    try {
      const response = await subscriberBillingApi.getAll(subscriberFilters);
      setSubscriberBillings(response.billings || []);
    } catch (e) {
      console.error('Erro ao carregar faturas de assinantes:', e);
      showError('Erro ao carregar faturas de assinantes');
    }
  };

  const loadPublisherBillings = async () => {
    try {
      // Converter direction vazia para undefined e garantir tipo correto
      const filters = {
        ...publisherFilters,
        direction: publisherFilters.direction && publisherFilters.direction !== '' 
          ? (publisherFilters.direction as 'incoming' | 'outgoing')
          : undefined
      };
      const response = await publisherBillingApi.getAll(filters);
      setPublisherBillings(response.billings || []);
    } catch (e) {
      console.error('Erro ao carregar faturas de publicadores:', e);
      showError('Erro ao carregar faturas de publicadores');
    }
  };

  const handleCreate = async () => {
    try {
      await billingApi.create(newBill);
      setCreateOpen(false);
      setNewBill({ billing_type: 'subscription', amount: 0 });
      loadBillings();
      showSuccess('Cobrança criada com sucesso');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao criar cobrança');
      showError('Erro ao criar cobrança');
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

      // Redirecionar para Stripe Checkout
      if (checkout.url) {
        window.location.href = checkout.url;
      } else {
        showError('Erro ao criar sessão de checkout');
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao criar assinatura');
      showError('Erro ao criar assinatura');
    }
  };

  const handleCancelSubscription = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta assinatura?')) return;

    try {
      await subscriptionApi.cancel(id);
      loadSubscriptions();
      showSuccess('Assinatura cancelada com sucesso');
    } catch (e: any) {
      showError(e.response?.data?.message || 'Erro ao cancelar assinatura');
    }
  };

  const markPaid = async (id: number) => {
    try {
      await billingApi.markAsPaid(id);
      loadBillings();
      showSuccess('Fatura marcada como paga');
    } catch (e: any) {
      showError('Erro ao marcar como pago');
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 4 }}>
        Faturamento e Assinaturas
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
            <MenuItem value="all">Todos</MenuItem>
            <MenuItem value="subscriber">Anunciantes</MenuItem>
            <MenuItem value="publisher">Publicadores</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Planos" icon={<CreditCard />} iconPosition="start" />
          <Tab label="Assinaturas" icon={<Receipt />} iconPosition="start" />
          {billingType === 'all' && (
            <Tab label="Faturas" icon={<Payment />} iconPosition="start" />
          )}
          {billingType === 'subscriber' && (
            <Tab label="Faturas Anunciantes" icon={<Payment />} iconPosition="start" />
          )}
          {billingType === 'publisher' && (
            <Tab label="Faturas Publicadores" icon={<Payment />} iconPosition="start" />
          )}
        </Tabs>
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

      {/* TAB: FATURAS */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Button startIcon={<Add />} variant="contained" onClick={() => setCreateOpen(true)}>
            Nova Cobrança
          </Button>
          <Button startIcon={<Refresh />} variant="outlined" onClick={loadBillings}>
            Atualizar
          </Button>
        </Box>

        <Grid container spacing={3}>
          {items.map((b) => (
            <Grid item xs={12} sm={6} md={4} key={b.billing_id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {b.billing_type}
                    </Typography>
                    <Chip
                      label={b.status}
                      color={getStatusColor(b.status) as any}
                      size="small"
                    />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    {formatCurrency(b.amount)}
                  </Typography>
                  {b.due_date && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Vencimento: {new Date(b.due_date).toLocaleDateString('pt-BR')}
                    </Typography>
                  )}
                  {b.paid_at && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Pago em: {new Date(b.paid_at).toLocaleDateString('pt-BR')}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    {b.status !== 'paid' && (
                      <Button
                        size="small"
                        startIcon={<Check />}
                        onClick={() => markPaid(b.billing_id)}
                        variant="outlined"
                      >
                        Marcar pago
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {items.length === 0 && (
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" align="center">
                Nenhuma fatura encontrada
              </Typography>
            </Grid>
          )}
        </Grid>
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
                  setSubscriberFilters({ ...subscriberFilters, status: e.target.value, page: 1 });
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
                  <TableCell>Pago em</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subscriberBillings.map((billing) => (
                  <TableRow key={billing.billing_id}>
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
                      {billing.paid_at ? new Date(billing.paid_at).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {subscriberBillings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
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
                  setPublisherFilters({ ...publisherFilters, paymentStatus: e.target.value, page: 1 });
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
                <MenuItem value="revenue_share">Revenue Share</MenuItem>
                <MenuItem value="payout">Payout</MenuItem>
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
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Publicador</TableCell>
                  <TableCell>Campanha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Direção</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Pago em</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {publisherBillings.map((billing) => (
                  <TableRow key={billing.billing_id}>
                    <TableCell>{billing.billing_id}</TableCell>
                    <TableCell>{billing.publisher_name || `Publicador #${billing.publisher_id}`}</TableCell>
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
                      {billing.paid_at ? new Date(billing.paid_at).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {publisherBillings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma fatura de publicador encontrada
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      )}

      {/* DIALOG: NOVA COBRANÇA */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nova Cobrança</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo</InputLabel>
            <Select
              label="Tipo"
              value={newBill.billing_type}
              onChange={(e) => setNewBill({ ...newBill, billing_type: e.target.value })}
            >
              <MenuItem value="subscription">Assinatura</MenuItem>
              <MenuItem value="service">Serviço</MenuItem>
              <MenuItem value="license">Licença</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Valor (R$)"
            type="number"
            margin="normal"
            value={newBill.amount}
            onChange={(e) => {
              const value = e.target.value;
              setNewBill({ ...newBill, amount: value ? parseFloat(String(value)) : 0 });
            }}
          />
          <TextField
            fullWidth
            label="Vencimento"
            type="date"
            margin="normal"
            InputLabelProps={{ shrink: true }}
            onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!newBill.amount}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

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
                Você será redirecionado para o Stripe Checkout para completar o pagamento.
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
    </Box>
  );
};

export default Billing;
