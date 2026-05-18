/**
 * Billing Page - Smart Signage v2.1
 * Página completa de gerenciamento de planos, assinaturas e faturas
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  TablePagination,
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
import FinancialInvoiceDialog, {
  FinancialBillingScope,
  FinancialDialogMode,
} from './FinancialInvoiceDialog';
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
import { PageHeader } from '../../components/DataDisplay';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';
import {
  billingIntervalLabel,
  getPlanDefaultBillingInterval,
  getPlanPriceForInterval,
} from '../../utils/billingIntervals';
import { isStudioMode } from '../../config/studioMode';
import {
  billingViewFromTabIndex,
  parseBillingView,
  shouldLoadBillingInvoices,
  tabIndexFromBillingView,
} from '../../utils/billingNavigation';
import IssueInvoicesDialog from './IssueInvoicesDialog';
import type { IssueInvoicesScope } from '../../utils/billingIssuePayload';
import {
  formatIssueInvoicesMessage,
  formatRevenueSharePayoutMessage,
} from '../../utils/formatIssueInvoicesResult';

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
  const breadcrumbs = useBreadcrumbs();
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
    canViewAllBillingTypes || (isStudioMode() && isPublisherUser);

  /** QR PIX / Stripe: gestores ou anunciante na própria fatura */
  const canPaySubscriberInvoices = canCreateModernInvoices || isSubscriberUser;

  /** Faturas incoming do exibidor: gestores ou publisher_user */
  const canPayPublisherInvoices = canCreateModernInvoices || isPublisherUser;

  const DUE_SOON_DAYS = 30;
  const rawType = searchParams.get('type');
  /** Escopo: anunciantes ou exibidor (sem legado "todos"). */
  const billingType = (() => {
    if (isSubscriberUser) return 'subscriber';
    if (isPublisherUser && !canViewAllBillingTypes) {
      return rawType === 'subscriber' || rawType === 'publisher' ? rawType : 'publisher';
    }
    if (isStudioMode()) return rawType === 'publisher' ? 'publisher' : 'subscriber';
    return rawType === 'publisher' ? 'publisher' : 'subscriber';
  })();

  const billingView = useMemo(() => parseBillingView(searchParams), [searchParams.toString()]);
  const loadInvoices = shouldLoadBillingInvoices(searchParams, billingType);

  const [tabValue, setTabValue] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [dashboard, setDashboard] = useState<BillingControlDashboard | null>(null);
  const [subscriberBillings, setSubscriberBillings] = useState<SubscriberBillingItem[]>([]);
  const [subscriberBillingTotal, setSubscriberBillingTotal] = useState(0);
  const [publisherBillings, setPublisherBillings] = useState<PublisherBillingItem[]>([]);
  const [publisherBillingTotal, setPublisherBillingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createSubscriberOpen, setCreateSubscriberOpen] = useState(false);
  const [createPublisherOpen, setCreatePublisherOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [financialDialog, setFinancialDialog] = useState<{
    open: boolean;
    mode: FinancialDialogMode;
    billingScope: FinancialBillingScope;
    billingId: number | null;
    amount?: number;
  }>({ open: false, mode: 'pay', billingScope: 'subscriber', billingId: null });
  const [issuingInvoices, setIssuingInvoices] = useState(false);
  const [generatingRevenueShare, setGeneratingRevenueShare] = useState(false);
  const [issueInvoicesOpen, setIssueInvoicesOpen] = useState(false);
  const [issueInvoicesScope, setIssueInvoicesScope] = useState<IssueInvoicesScope>('all');
  const [stripeReturnHandled, setStripeReturnHandled] = useState(false);
  const invoiceDeepLinkHandled = useRef<number | null>(null);
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
    return getPlanPriceForInterval(plan, getPlanDefaultBillingInterval(plan)) ?? 0;
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
    /** Deep link: ?subscriberId= / ?subscriber_id= */
    subscriberId: undefined as number | undefined,
  });

  /** Rascunho do campo "ID anunciante"; só sincroniza com URL/estado quando estes mudam. */
  const [subscriberIdDraft, setSubscriberIdDraft] = useState('');
  
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

  /** Sincronizar query string → filtros antes do primeiro paint seguinte (deep link desde Anunciantes). */
  useLayoutEffect(() => {
    if (billingType !== 'subscriber') return;

    const rawId = searchParams.get('subscriberId') ?? searchParams.get('subscriber_id');
    const n = rawId ? parseInt(String(rawId), 10) : NaN;
    const id = Number.isFinite(n) && n > 0 ? n : undefined;

    const hasDueInUrl = searchParams.has('dueFilter');
    const rawDue = searchParams.get('dueFilter');
    const dueFromUrl: '' | 'overdue' | 'due_soon' | undefined = hasDueInUrl
      ? rawDue === 'overdue' || rawDue === 'due_soon'
        ? rawDue
        : ''
      : undefined;

    setSubscriberFilters((prev) => ({
      ...prev,
      subscriberId: id,
      ...(hasDueInUrl && dueFromUrl !== undefined ? { dueFilter: dueFromUrl, status: '' } : {}),
    }));

    if (id != null) {
      setNewSubscriberInvoice((prev) => ({ ...prev, subscriberId: String(id) }));
    }
  }, [billingType, searchParams.toString()]);

  useEffect(() => {
    setTabValue(tabIndexFromBillingView(billingView));
  }, [billingView]);

  const billingSearchKey = searchParams.toString();
  useEffect(() => {
    if (billingType !== 'subscriber') {
      setSubscriberIdDraft('');
      return;
    }
    const rawId = searchParams.get('subscriberId') ?? searchParams.get('subscriber_id');
    const fromUrl = rawId != null && rawId !== '' ? rawId : '';
    const sid = subscriberFilters.subscriberId;
    const fromState = sid != null ? String(sid) : '';
    setSubscriberIdDraft(fromUrl || fromState || '');
  }, [billingType, billingSearchKey, subscriberFilters.subscriberId]);

  useEffect(() => {
    void loadBillingCore();
  }, [billingType, user?.publisherId]);

  useEffect(() => {
    if (!loadInvoices) {
      setSubscriberBillings([]);
      setSubscriberBillingTotal(0);
      setPublisherBillings([]);
      setPublisherBillingTotal(0);
      return;
    }
    if (billingType === 'subscriber') void loadSubscriberBillings();
    if (billingType === 'publisher') void loadPublisherBillings();
  }, [billingType, loadInvoices, billingSearchKey, subscriberFilters.page, publisherFilters.page]);

  const handleBillingTabChange = useCallback(
    (newTab: number) => {
      const view = billingViewFromTabIndex(newTab);
      setTabValue(newTab);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (view === 'plans') {
            next.set('view', 'plans');
            const keepFocus =
              next.get('subscriberId') ||
              next.get('subscriber_id') ||
              next.get('dueFilter');
            if (!keepFocus) {
              next.delete('type');
              next.delete('dueFilter');
            }
          } else if (view === 'subscriptions') {
            next.set('view', 'subscriptions');
            next.delete('type');
          } else {
            next.set('view', 'invoices');
            if (billingType === 'subscriber' || compactBillingAdminOnly) {
              next.set('type', 'subscriber');
            } else if (billingType === 'publisher') {
              next.set('type', 'publisher');
            }
          }
          return next;
        },
        { replace: true }
      );
    },
    [billingType, compactBillingAdminOnly, setSearchParams]
  );

  /** Evita ?type=publisher no mono quando o ecrã é só administrativo de anunciantes. */
  useEffect(() => {
    if (!compactBillingAdminOnly) return;
    if (rawType !== 'publisher') return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('type', 'subscriber');
        return next;
      },
      { replace: true }
    );
  }, [compactBillingAdminOnly, rawType, setSearchParams]);

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

  useEffect(() => {
    const invoiceParam = searchParams.get('invoice');
    if (!invoiceParam || loading) return;
    if (billingType !== 'subscriber' && billingType !== 'publisher') return;

    const billingId = parseInt(invoiceParam, 10);
    if (!Number.isFinite(billingId) || billingId < 1) return;
    const linkKey = billingType === 'publisher' ? billingId + 1_000_000 : billingId;
    if (invoiceDeepLinkHandled.current === linkKey) return;

    if (billingType === 'subscriber') {
      const row = subscriberBillings.find((b) => b.billing_id === billingId);
      if (row?.status === 'paid') {
        showError('Esta fatura já está paga.');
        invoiceDeepLinkHandled.current = linkKey;
        const next = new URLSearchParams(searchParams);
        next.delete('invoice');
        setSearchParams(next, { replace: true });
        return;
      }
      invoiceDeepLinkHandled.current = linkKey;
      setFinancialDialog({
        open: true,
        mode: 'qr',
        billingScope: 'subscriber',
        billingId,
        amount: row?.amount,
      });
    } else {
      const row = publisherBillings.find((b) => b.billing_id === billingId);
      if (row?.payment_status === 'paid') {
        showError('Esta fatura já está paga.');
        invoiceDeepLinkHandled.current = linkKey;
        const next = new URLSearchParams(searchParams);
        next.delete('invoice');
        setSearchParams(next, { replace: true });
        return;
      }
      if (row && row.direction !== 'incoming') {
        showError('Esta fatura não é cobrança de entrada.');
        invoiceDeepLinkHandled.current = linkKey;
        const next = new URLSearchParams(searchParams);
        next.delete('invoice');
        setSearchParams(next, { replace: true });
        return;
      }
      invoiceDeepLinkHandled.current = linkKey;
      setFinancialDialog({
        open: true,
        mode: 'qr',
        billingScope: 'publisher',
        billingId,
        amount: row?.amount,
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete('invoice');
    setSearchParams(next, { replace: true });
  }, [searchParams, subscriberBillings, publisherBillings, billingType, loading]);

  const loadDashboard = async () => {
    try {
      const data = await billingControlApi.getDashboard({
        dueSoonDays: DUE_SOON_DAYS,
        publisherId:
          isStudioMode() && user?.publisherId != null ? Number(user.publisherId) : undefined,
      });
      setDashboard(data);
    } catch {
      setDashboard(null);
    }
  };

  const loadBillingCore = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadDashboard(),
        loadPlans(),
        isSubscriberUser ? Promise.resolve() : loadSubscriptions(),
      ]);
    } catch {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    await loadBillingCore();
    if (loadInvoices) {
      if (billingType === 'subscriber') await loadSubscriberBillings();
      if (billingType === 'publisher') await loadPublisherBillings();
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

  /** Evita corrida layout→estado vs primeiro loadAll: a query tem precedência quando presente. */
  const getEffectiveSubscriberBillingFilters = () => {
    const rawId = searchParams.get('subscriberId') ?? searchParams.get('subscriber_id');
    const parsedId = rawId != null && rawId !== '' ? parseInt(String(rawId), 10) : NaN;
    const idFromUrl = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : undefined;
    const subscriberId = idFromUrl ?? subscriberFilters.subscriberId;

    let dueFilter: '' | 'overdue' | 'due_soon' = subscriberFilters.dueFilter;
    if (searchParams.has('dueFilter')) {
      const rawDue = searchParams.get('dueFilter');
      dueFilter = rawDue === 'overdue' || rawDue === 'due_soon' ? rawDue : '';
    }

    const { subscriberId: _sid, dueFilter: _df, ...rest } = subscriberFilters;
    return { ...rest, subscriberId, dueFilter };
  };

  const loadSubscriberBillings = async () => {
    try {
      const ef = getEffectiveSubscriberBillingFilters();
      const { subscriberId, limit, ...rest } = ef;
      const effLimit = subscriberId != null ? Math.max(Number(limit) || 20, 50) : limit;
      const response = await subscriberBillingApi.getAll({
        ...rest,
        limit: effLimit,
        ...(subscriberId != null ? { subscriberId } : {}),
        dueFilter: ef.dueFilter || undefined,
        dueSoonDays: ef.dueFilter === 'due_soon' ? DUE_SOON_DAYS : undefined,
      });
      setSubscriberBillings(response.billings || []);
      setSubscriberBillingTotal(response.total ?? response.billings?.length ?? 0);
    } catch (e) {
      showError('Erro ao carregar faturas de assinantes');
    }
  };

  /** Atualiza a query (?subscriberId=) a partir do rascunho; o layout sincroniza o estado. */
  const applySubscriberIdFromDraftToUrl = useCallback(() => {
    const t = subscriberIdDraft.trim();
    const n = parseInt(t, 10);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!t || !Number.isFinite(n) || n < 1) {
          next.delete('subscriberId');
          next.delete('subscriber_id');
          next.delete('subscriberName');
        } else {
          next.set('subscriberId', String(n));
          next.delete('subscriber_id');
          next.delete('subscriberName');
        }
        return next;
      },
      { replace: true }
    );
  }, [subscriberIdDraft, setSearchParams]);

  /** Mantém `dueFilter` na URL alinhado ao select (evita deep link a forçar filtro após "Todos"). */
  const syncSubscriberDueFilterToUrl = useCallback(
    (dueFilter: '' | 'overdue' | 'due_soon') => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!dueFilter) next.delete('dueFilter');
          else {
            next.set('dueFilter', dueFilter);
            next.set('view', 'invoices');
            if (!next.get('type')) next.set('type', 'subscriber');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

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
      setPublisherBillingTotal(response.total ?? response.billings?.length ?? 0);
    } catch (e) {
      showError('Erro ao carregar faturas do exibidor');
    }
  };

  const applyInvoicePendingFilter = async () => {
    if (billingType !== 'subscriber') return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', 'invoices');
        next.set('type', 'subscriber');
        next.delete('dueFilter');
        return next;
      },
      { replace: true }
    );
    const next = { ...subscriberFilters, dueFilter: '' as const, status: 'pending', page: 1 };
    setSubscriberFilters(next);
    try {
      const { subscriberId, limit, ...rest } = next;
      const effLimit = subscriberId != null ? Math.max(Number(limit) || 20, 50) : limit;
      const response = await subscriberBillingApi.getAll({
        ...rest,
        limit: effLimit,
        ...(subscriberId != null ? { subscriberId } : {}),
        status: 'pending',
      });
      setSubscriberBillings(response.billings || []);
      setSubscriberBillingTotal(response.total ?? 0);
    } catch {
      showError('Erro ao filtrar faturas pendentes');
    }
  };

  const applyPublisherRepasseFilter = useCallback(async () => {
    setTabValue(2);
    setSearchParams({ type: 'publisher', view: 'invoices' });
    const next = {
      ...publisherFilters,
      billingType: 'revenue_share',
      direction: 'outgoing',
      paymentStatus: 'pending_payout',
      dueFilter: '' as '' | 'overdue' | 'due_soon',
      page: 1,
    };
    setPublisherFilters(next);
    try {
      const response = await publisherBillingApi.getAll({
        page: 1,
        limit: next.limit,
        billingType: 'revenue_share',
        direction: 'outgoing',
        paymentStatus: 'pending_payout',
      });
      setPublisherBillings(response.billings || []);
      setPublisherBillingTotal(response.total ?? 0);
    } catch {
      showError('Erro ao filtrar repasses');
    }
  }, [publisherFilters, setSearchParams]);

  const applyInvoiceDueFilter = async (filter: 'overdue' | 'due_soon' | '') => {
    if (billingType === 'subscriber') {
      syncSubscriberDueFilterToUrl(filter);
      const next = { ...subscriberFilters, dueFilter: filter, status: '', page: 1 };
      setSubscriberFilters(next);
      try {
        const { subscriberId, limit, ...rest } = next;
        const effLimit = subscriberId != null ? Math.max(Number(limit) || 20, 50) : limit;
        const response = await subscriberBillingApi.getAll({
          ...rest,
          limit: effLimit,
          ...(subscriberId != null ? { subscriberId } : {}),
          dueFilter: filter || undefined,
          dueSoonDays: filter === 'due_soon' ? DUE_SOON_DAYS : undefined,
        });
        setSubscriberBillings(response.billings || []);
        setSubscriberBillingTotal(response.total ?? 0);
      } catch {
        showError('Erro ao filtrar faturas');
      }
      try {
        await loadDashboard();
      } catch {
        /* KPIs opcionais */
      }
    } else if (billingType === 'publisher') {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('type', 'publisher');
          next.set('view', 'invoices');
          if (!filter) next.delete('dueFilter');
          else next.set('dueFilter', filter);
          return next;
        },
        { replace: true }
      );
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
        setPublisherBillingTotal(response.total ?? 0);
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
      const res = await financialAdminApi.recordPayment(id, { paymentMethod: 'pix' });
      await Promise.all([loadSubscriberBillings(), loadPublisherBillings(), loadDashboard()]);
      const repasseMsg = formatRevenueSharePayoutMessage(res.revenueSharePayout);
      showSuccess(repasseMsg ? `Pagamento registado. ${repasseMsg}` : 'Pagamento registado');
    } catch (e: any) {
      showError(pickApiErrorMessage(e, 'Erro ao registar pagamento'));
    }
  };

  const studioPublisherLocked =
    isStudioMode() && isPublisherUser && user?.publisherId != null;
  const issueDefaultPublisherId =
    user?.publisherId != null ? String(user.publisherId) : '';

  const openIssueInvoicesDialog = () => {
    setIssueInvoicesScope(
      billingType === 'publisher' ? 'publisher' : billingType === 'subscriber' ? 'subscriber' : 'all'
    );
    setIssueInvoicesOpen(true);
  };

  const handleIssueContractInvoicesConfirm = async (
    payload: Parameters<typeof financialAdminApi.issueInvoices>[0]
  ) => {
    setIssuingInvoices(true);
    try {
      const result = await financialAdminApi.issueInvoices(payload);
      await Promise.all([
        loadSubscriberBillings(),
        loadPublisherBillings(),
        loadDashboard(),
      ]);
      setIssueInvoicesOpen(false);
      showSuccess(formatIssueInvoicesMessage(result));
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao emitir faturas do período'));
    } finally {
      setIssuingInvoices(false);
    }
  };

  const handleGenerateRevenueSharePayouts = async () => {
    setGeneratingRevenueShare(true);
    try {
      const result = await financialAdminApi.issueRevenueSharePayouts({ sinceDays: 90 });
      await Promise.all([
        loadPublisherBillings(),
        loadSubscriberBillings(),
        loadDashboard(),
      ]);
      const repasseMsg = formatRevenueSharePayoutMessage(result);
      showSuccess(repasseMsg || formatIssueInvoicesMessage(result));
      if (result.created > 0) {
        void applyPublisherRepasseFilter();
      }
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao gerar repasses'));
    } finally {
      setGeneratingRevenueShare(false);
    }
  };

  const openFinancialDialog = (mode: FinancialDialogMode, billing: SubscriberBillingItem) => {
    setFinancialDialog({
      open: true,
      mode,
      billingScope: 'subscriber',
      billingId: billing.billing_id,
      amount: billing.amount,
    });
  };

  const openPublisherFinancialDialog = (mode: FinancialDialogMode, billing: PublisherBillingItem) => {
    setFinancialDialog({
      open: true,
      mode,
      billingScope: 'publisher',
      billingId: billing.billing_id,
      amount: billing.amount,
    });
  };

  const sendPublisherPaymentEmail = async (id: number) => {
    try {
      const result = await financialAdminApi.sendPublisherPaymentEmail(id);
      if (result.sent) showSuccess('E-mail de cobrança enviado');
      else showError(result.reason || 'Não foi possível enviar o e-mail');
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao enviar e-mail'));
    }
  };

  const startPublisherStripeCheckout = async (id: number) => {
    try {
      const { url } = await financialAdminApi.createPublisherStripeCheckout(id);
      if (url) window.location.href = url;
      else showError('Stripe não retornou URL de pagamento');
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao abrir checkout Stripe'));
    }
  };

  const markPublisherPaid = async (id: number) => {
    try {
      await financialAdminApi.recordPublisherPayment(id, { paymentMethod: 'pix' });
      await Promise.all([loadPublisherBillings(), loadDashboard()]);
      showSuccess('Pagamento registado');
    } catch (e: unknown) {
      showError(pickApiErrorMessage(e, 'Erro ao registar pagamento'));
    }
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
      isStudioMode() && isPublisherUser && Number.isFinite(pidFromUser)
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

  const billingSubtitle =
    billingView === 'invoices'
      ? billingType === 'publisher'
        ? 'Lista de faturas de exibidores'
        : 'Lista de faturas de anunciantes'
      : billingView === 'subscriptions'
        ? 'Assinaturas ativas e histórico'
        : 'Planos, controlo financeiro e KPIs';

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 } }}>
      <PageHeader
        title="Faturamento e Cobrança"
        subtitle={billingSubtitle}
        breadcrumbs={breadcrumbs}
        onRefresh={loadAll}
        loading={loading}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <BillingControlPanel
        dashboard={dashboard}
        loading={loading}
        showPublisherKpis={
          isStudioMode()
            ? billingType === 'publisher' || canViewAllBillingTypes
            : billingType === 'publisher' || canViewAllBillingTypes
        }
        showRevenueShareKpis={isStudioMode() && canViewAllBillingTypes}
        publisherLabel={isStudioMode() ? 'Exibidor (sistema)' : 'Publicadores'}
        onFilterInvoices={canViewAllBillingTypes || !isSubscriberUser ? applyInvoiceDueFilter : undefined}
        onFilterPendingInvoices={
          canViewAllBillingTypes || !isSubscriberUser ? applyInvoicePendingFilter : undefined
        }
        onFilterRevenueSharePayout={
          isStudioMode() && canViewAllBillingTypes ? () => void applyPublisherRepasseFilter() : undefined
        }
        onGenerateRevenueSharePayouts={
          isStudioMode() && canViewAllBillingTypes ? () => void handleGenerateRevenueSharePayouts() : undefined
        }
        generatingRevenueShare={generatingRevenueShare}
        contractsPath="/subscriber-contracts"
        publisherContractsPath="/publisher-contracts"
        formatCurrency={(n) => formatCurrency(n)}
      />

      {/* Filtro de tipo de billing (omitido no mono compacto para gestores: só anunciantes) */}
      {!compactBillingAdminOnly && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Tipo de Faturamento</InputLabel>
            <Select
              value={billingType}
              label="Tipo de Faturamento"
              onChange={(e) => {
                const type = e.target.value;
                setSearchParams({
                  type,
                  view: type === 'subscriber' || type === 'publisher' ? 'invoices' : 'plans',
                });
                setTabValue(type === 'subscriber' || type === 'publisher' ? 2 : 0);
              }}
            >
              {!isSubscriberUser && <MenuItem value="subscriber">Anunciantes</MenuItem>}
              {!isSubscriberUser && !(isStudioMode() && canViewAllBillingTypes) && (
                <MenuItem value="publisher">
                  {isStudioMode() ? 'Exibidor (sistema)' : 'Publicadores'}
                </MenuItem>
              )}
              {isSubscriberUser && <MenuItem value="subscriber">Anunciantes</MenuItem>}
            </Select>
          </FormControl>
        </Box>
      )}

      <Box sx={{ mb: 3 }}>
        <ResponsiveSectionNav
          sections={BILLING_SECTIONS}
          value={tabValue}
          onChange={handleBillingTabChange}
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
                    {billingIntervalLabel(sub.billing_interval)}
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
          {subscriberFilters.subscriberId != null && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.delete('subscriberId');
                      next.delete('subscriber_id');
                      next.delete('subscriberName');
                      next.delete('dueFilter');
                      next.delete('type');
                      next.set('view', 'plans');
                      return next;
                    });
                  }}
                >
                  Limpar filtro
                </Button>
              }
            >
              A mostrar apenas faturas do anunciante:{' '}
              <strong>
                {(() => {
                  const raw = searchParams.get('subscriberName');
                  if (raw) {
                    try {
                      return decodeURIComponent(raw);
                    } catch {
                      return raw;
                    }
                  }
                  return `#${subscriberFilters.subscriberId}`;
                })()}
              </strong>
              {subscriberFilters.dueFilter === 'overdue'
                ? ' — vencimento: só em atraso'
                : subscriberFilters.dueFilter === 'due_soon'
                  ? ` — vencimento: a vencer (${DUE_SOON_DAYS}d)`
                  : ''}
            </Alert>
          )}
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
                  syncSubscriberDueFilterToUrl('');
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
                  const dueFilter = e.target.value as '' | 'overdue' | 'due_soon';
                  setSubscriberFilters({
                    ...subscriberFilters,
                    dueFilter,
                    status: '',
                    page: 1,
                  });
                  syncSubscriberDueFilterToUrl(dueFilter);
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
            {!isSubscriberUser && (
              <>
                <TextField
                  size="small"
                  label="ID anunciante"
                  value={subscriberIdDraft}
                  onChange={(e) => setSubscriberIdDraft(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applySubscriberIdFromDraftToUrl();
                    }
                  }}
                  sx={{ width: 132 }}
                  inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    'aria-label': 'Filtrar faturas por ID do anunciante',
                  }}
                  helperText="Enter p/ aplicar"
                  FormHelperTextProps={{ sx: { m: 0, mt: 0.25 } }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => applySubscriberIdFromDraftToUrl()}
                  aria-label="Aplicar filtro de ID do anunciante na URL"
                >
                  Aplicar ID
                </Button>
              </>
            )}
            <Button startIcon={<Refresh />} variant="outlined" onClick={loadSubscriberBillings}>
              Atualizar
            </Button>
            {canCreateModernInvoices && (
              <>
                <Button
                  startIcon={<ReceiptLong />}
                  variant="outlined"
                  disabled={issuingInvoices}
                  onClick={openIssueInvoicesDialog}
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
                  {canViewAllBillingTypes && <TableCell>Contrato</TableCell>}
                  {canViewAllBillingTypes && <TableCell>Período</TableCell>}
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
                    {canViewAllBillingTypes && (
                      <TableCell>
                        {billing.contract_id ? `#${billing.contract_id}` : '—'}
                      </TableCell>
                    )}
                    {canViewAllBillingTypes && (
                      <TableCell>
                        {billing.period_start || billing.period_end
                          ? [
                              billing.period_start
                                ? new Date(billing.period_start).toLocaleDateString('pt-BR')
                                : '…',
                              billing.period_end
                                ? new Date(billing.period_end).toLocaleDateString('pt-BR')
                                : '…',
                            ].join(' – ')
                          : '—'}
                      </TableCell>
                    )}
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
                      {billing.status !== 'paid' && canPaySubscriberInvoices && (
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
                          <Tooltip title="Pagar com Stripe">
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => startStripeCheckout(billing.billing_id)}
                            >
                              <CreditCard />
                            </IconButton>
                          </Tooltip>
                          {canCreateModernInvoices && (
                            <>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              A mostrar {subscriberBillings.length} de {subscriberBillingTotal} fatura(s)
            </Typography>
            <TablePagination
              count={subscriberBillingTotal}
              page={Math.max(0, subscriberFilters.page - 1)}
              onPageChange={(_, page) =>
                setSubscriberFilters((prev) => ({ ...prev, page: page + 1 }))
              }
              rowsPerPage={subscriberFilters.limit}
              onRowsPerPageChange={(e) => {
                const limit = parseInt(e.target.value, 10);
                setSubscriberFilters((prev) => ({
                  ...prev,
                  limit: Number.isFinite(limit) ? limit : 20,
                  page: 1,
                }));
              }}
              rowsPerPageOptions={[20, 50, 100]}
              labelRowsPerPage="Por página"
            />
          </Box>
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
              <>
                <Button
                  startIcon={<ReceiptLong />}
                  variant="outlined"
                  disabled={issuingInvoices}
                  onClick={openIssueInvoicesDialog}
                >
                  Emitir faturas do período
                </Button>
                <Button startIcon={<Add />} variant="contained" onClick={() => setCreatePublisherOpen(true)}>
                  {isStudioMode() ? 'Nova fatura (exibidor)' : 'Nova fatura (publicador)'}
                </Button>
              </>
            )}
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  {!isStudioMode() && <TableCell>Publicador</TableCell>}
                  <TableCell>Campanha</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Direção</TableCell>
                  <TableCell>Valor</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Alerta</TableCell>
                  <TableCell>Pago em</TableCell>
                  <TableCell align="right">Ações</TableCell>
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
                    {!isStudioMode() && (
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
                    <TableCell align="right">
                      {billing.direction === 'outgoing' &&
                        billing.payment_status === 'pending_payout' &&
                        canCreateModernInvoices && (
                          <>
                            <Tooltip title="Enviar aviso de repasse por e-mail">
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => sendPublisherPaymentEmail(billing.billing_id)}
                              >
                                <Email />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Marcar repasse como pago">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => markPublisherPaid(billing.billing_id)}
                              >
                                <Payment />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      {billing.direction === 'incoming' &&
                        (billing.payment_status === 'pending' || billing.payment_status === 'overdue') &&
                        canPayPublisherInvoices && (
                          <>
                            <Tooltip title="QR Code PIX">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => openPublisherFinancialDialog('qr', billing)}
                              >
                                <QrCode2 />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Pagar com Stripe">
                              <IconButton
                                size="small"
                                color="secondary"
                                onClick={() => startPublisherStripeCheckout(billing.billing_id)}
                              >
                                <CreditCard />
                              </IconButton>
                            </Tooltip>
                            {canCreateModernInvoices && (
                              <>
                                <Tooltip title="Registar pagamento">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => openPublisherFinancialDialog('pay', billing)}
                                  >
                                    <Payment />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Enviar e-mail de cobrança">
                                  <IconButton
                                    size="small"
                                    color="info"
                                    onClick={() => sendPublisherPaymentEmail(billing.billing_id)}
                                  >
                                    <Email />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Marcar pago (rápido)">
                                  <IconButton
                                    size="small"
                                    onClick={() => markPublisherPaid(billing.billing_id)}
                                  >
                                    <Check />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </>
                        )}
                    </TableCell>
                  </TableRow>
                  );
                })}
                {publisherBillings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isStudioMode() ? 10 : 11} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {isStudioMode()
                          ? 'Nenhuma fatura do exibidor encontrada'
                          : 'Nenhuma fatura de publicador encontrada'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              A mostrar {publisherBillings.length} de {publisherBillingTotal} fatura(s)
            </Typography>
            <TablePagination
              count={publisherBillingTotal}
              page={Math.max(0, publisherFilters.page - 1)}
              onPageChange={(_, page) =>
                setPublisherFilters((prev) => ({ ...prev, page: page + 1 }))
              }
              rowsPerPage={publisherFilters.limit}
              onRowsPerPageChange={(e) => {
                const limit = parseInt(e.target.value, 10);
                setPublisherFilters((prev) => ({
                  ...prev,
                  limit: Number.isFinite(limit) ? limit : 20,
                  page: 1,
                }));
              }}
              rowsPerPageOptions={[20, 50, 100]}
              labelRowsPerPage="Por página"
            />
          </Box>
        </TabPanel>
      )}

      {canCreateModernInvoices && (
        <IssueInvoicesDialog
          open={issueInvoicesOpen}
          issuing={issuingInvoices}
          initialScope={issueInvoicesScope}
          defaultPublisherId={issueDefaultPublisherId}
          lockPublisherId={studioPublisherLocked}
          hidePublisherPicker={studioPublisherLocked}
          onClose={() => setIssueInvoicesOpen(false)}
          onConfirm={(payload) => handleIssueContractInvoicesConfirm(payload)}
        />
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
            {(!isStudioMode() || !isPublisherUser || user?.publisherId == null) && (
              <TextField
                fullWidth
                margin="normal"
                label="ID do publicador"
                value={newPublisherInvoice.publisherId}
                onChange={(e) => setNewPublisherInvoice({ ...newPublisherInvoice, publisherId: e.target.value })}
                helperText={
                  isStudioMode() && isPublisherUser && user?.publisherId == null
                    ? 'O seu utilizador não tem publisherId; indique o ID do exibidor.'
                    : undefined
                }
              />
            )}
            {isStudioMode() && isPublisherUser && user?.publisherId != null && (
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
        billingScope={financialDialog.billingScope}
        billingId={financialDialog.billingId}
        amount={financialDialog.amount}
        onClose={() =>
          setFinancialDialog({ open: false, mode: 'pay', billingScope: 'subscriber', billingId: null })
        }
        onSuccess={(info) => {
          if (financialDialog.billingScope === 'publisher') {
            void loadPublisherBillings();
          } else {
            void loadSubscriberBillings();
            void loadPublisherBillings();
          }
          void loadDashboard();
          showSuccess(info.message);
        }}
      />
    </Box>
  );
};

export default Billing;
