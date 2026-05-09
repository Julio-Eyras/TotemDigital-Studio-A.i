/**
 * Plan Access Management Page - Smart Signage v2.1
 * Página com abas para gerenciar Planos (CRUD) e escopo de acesso (publisher/local)
 */

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
  Checkbox,
  Switch,
  FormControlLabel,
  InputAdornment,
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
  Tabs,
  Tab,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  CheckCircle,
  Cancel,
  Info,
  Star,
  StarBorder,
  Business,
} from '@mui/icons-material';
import { planApi, Plan, CreatePlanRequest, UpdatePlanRequest } from '../../services/api';
import { publisherApi, Publisher } from '../../services/api';
import { subscriberAccessApi, PlanPublisherAccess } from '../../services/api';
import { totemApi, Player, localApi, Local } from '../../services/api';
import { TOTEMDIGITAL_COMPACT } from '../../config/featureFlags';
import { PageHeader } from '../../components/DataDisplay';
import ResponsiveSectionNav from '../../components/navigation/ResponsiveSectionNav';
import { getTotemIdFromRow, getTotemLocalIdFromRow, getTotemPublisherIdFromRow } from '../../utils/totemRowIds';
import { pickApiErrorMessage } from '../../utils/apiErrorMessage';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`plan-publisher-access-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 0.5, sm: 1, md: 2 } }}>{children}</Box>}
    </div>
  );
}

function formatTotemLabel(t: { totem_id?: number; name?: string; identifier?: string; uin?: string; id?: number }): string {
  const parts = [t.name, t.identifier, t.uin].filter(Boolean);
  const id = getTotemIdFromRow(t);
  return parts.length > 0 ? parts.join(' · ') : `Totem #${id ?? '?'}`;
}

function compareByName(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });
}

/** Alinhado a `Totems.tsx` / cadastro: só `false` explícito é inativo; `null`/`undefined` tratam como ativo. */
function getTotemIsActive(t: object): boolean {
  const row = t as Record<string, unknown>;
  if (row.is_active === false) return false;
  if (row.active === false) return false;
  if (row.isActive === false) return false;
  return true;
}

interface PlanAssociationEntry {
  publisherId: number;
  isAllowed: boolean;
  restrictions?: any;
  notes?: string;
  /** Modo compact: local usado na UI; persistência continua sendo publisher_id em plan_publisher_access */
  displayLabel?: string;
}

interface CompactTotemOption {
  totem: Player;
  publisherId?: number;
  isAlreadyLinked?: boolean;
}

interface CompactLocalOption {
  local: Local;
  publisherId?: number;
  isAlreadyLinked?: boolean;
}

interface CompactScopeRestrictions {
  compact_scope?: {
    local_ids?: number[];
    enabled_totem_ids_by_local?: Record<string, number[]>;
  };
}

const normalizePositiveIntArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((n) => Number.isInteger(n) && n > 0);
};

const PlanPublisherAccessPage: React.FC = () => {
  const theme = useTheme();
  const isMobileNav = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  const publisherEntityLabel = TOTEMDIGITAL_COMPACT ? 'Local' : 'Publisher';
  const accessEntityLabel = TOTEMDIGITAL_COMPACT ? 'Local' : publisherEntityLabel;
  const publishersOfPlanLabel = TOTEMDIGITAL_COMPACT ? 'Locais do Plano' : 'Publishers do Plano';
  const maintenanceTabLabel = TOTEMDIGITAL_COMPACT ? 'Manutenção de Locais' : 'Manutenção de Publicadores';
  const addPublisherLabel = TOTEMDIGITAL_COMPACT ? 'Adicionar Local ao Plano' : 'Adicionar Publisher ao Plano';
  const [tabValue, setTabValue] = useState(0);
  
  // Estados comuns
  const [plans, setPlans] = useState<Plan[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =============================================
  // ABA 1: CRUD DE PLANOS
  // =============================================
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planEditMode, setPlanEditMode] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [planDialogTab, setPlanDialogTab] = useState(0); // Aba do dialog do plano (0: Dados, 1: Publishers)
  const [planPublishers, setPlanPublishers] = useState<PlanAssociationEntry[]>([]);
  const [selectedPublisherForPlan, setSelectedPublisherForPlan] = useState<string>('');
  /** Modo compact: seleção por local_id */
  const [selectedLocalIdForPlan, setSelectedLocalIdForPlan] = useState<string>('');
  const [compactSelectedLocalIds, setCompactSelectedLocalIds] = useState<number[]>([]);
  const [compactEnabledTotemsByLocal, setCompactEnabledTotemsByLocal] = useState<Record<number, number[]>>({});
  const [localsCatalog, setLocalsCatalog] = useState<Local[]>([]);
  const [totemsCatalog, setTotemsCatalog] = useState<Player[]>([]);
  const [planMonthlyPriceText, setPlanMonthlyPriceText] = useState('');
  const [planYearlyPriceText, setPlanYearlyPriceText] = useState('');

  const [planFormData, setPlanFormData] = useState<CreatePlanRequest>({
    name: '',
    slug: '',
    description: '',
    priceMonthly: undefined,
    priceYearly: undefined,
    currency: 'BRL',
    billingInterval: 'month',
    stripePriceIdMonthly: '',
    stripePriceIdYearly: '',
    stripeProductId: '',
    features: {},
    limits: {},
    isActive: true,
    isPopular: false,
    sortOrder: 0,
  });

  // =============================================
  // ABA 2: MANUTENÇÃO DE ACESSO (publisher/local)
  // =============================================
  const [accessList, setAccessList] = useState<PlanPublisherAccess[]>([]);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [accessEditMode, setAccessEditMode] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<PlanPublisherAccess | null>(null);
  const [accessFilters, setAccessFilters] = useState({
    planId: '',
    publisherId: '',
  });
  const [accessFormData, setAccessFormData] = useState({
    planId: '',
    publisherId: '',
    isAllowed: true,
    restrictions: '',
    notes: '',
  });
  const [accessSelectedLocalId, setAccessSelectedLocalId] = useState<string>('');

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (tabValue === 1) {
      loadPublisherAccess();
    }
  }, [tabValue, accessFilters]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [plansRes, publishersRes] = await Promise.all([
        planApi.getAll(true), // Incluir inativos
        publisherApi.getAll({ active_only: true }),
      ]);

      setPlans(plansRes || []);
      setPublishers(publishersRes.data || []);

      if (TOTEMDIGITAL_COMPACT) {
        try {
          const [totemRes, localsRes] = await Promise.all([
            totemApi.getAll({ limit: 2000, page: 1 }),
            localApi.getAll({ limit: 2000, page: 1, active_only: true }),
          ]);
          setTotemsCatalog(totemRes.data || []);
          setLocalsCatalog(localsRes.data || []);
        } catch (e) {
          console.error('Erro ao carregar locais/totens para planos:', e);
          setTotemsCatalog([]);
          setLocalsCatalog([]);
        }
      } else {
        setTotemsCatalog([]);
        setLocalsCatalog([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      setError(pickApiErrorMessage(error, 'Erro ao carregar dados'));
    } finally {
      setLoading(false);
    }
  };

  const loadPublisherAccess = async () => {
    try {
      const accessRes = await subscriberAccessApi.getPlanPublisherAccess({
        planId: accessFilters.planId ? parseInt(accessFilters.planId) : undefined,
        publisherId: accessFilters.publisherId ? parseInt(accessFilters.publisherId) : undefined,
      });
      setAccessList(accessRes);
    } catch (error: any) {
      console.error('Erro ao carregar acessos:', error);
      setError(pickApiErrorMessage(error, 'Erro ao carregar acessos'));
    }
  };

  // =============================================
  // FUNÇÕES ABA 1: CRUD DE PLANOS
  // =============================================

  const getPlanId = (plan: Plan): number => {
    return plan.planId || plan.plan_id || 0;
  };

  const getPlanName = (plan: Plan): string => {
    return plan.name || '';
  };

  const getPlanPriceMonthly = (plan: Plan): number => {
    return plan.priceMonthly || plan.price_monthly || 0;
  };

  const getPlanPriceYearly = (plan: Plan): number | undefined => {
    return plan.priceYearly || plan.price_yearly;
  };

  const getPlanIsActive = (plan: Plan): boolean => {
    return plan.isActive !== undefined ? plan.isActive : plan.is_active !== false;
  };

  const getPlanIsPopular = (plan: Plan): boolean => {
    return plan.isPopular || plan.is_popular || false;
  };

  const getPlanSortOrder = (plan: Plan): number => {
    return plan.sortOrder || plan.sort_order || 0;
  };

  const loadPlanPublishers = async (planId: number) => {
    try {
      const accessRes = await subscriberAccessApi.getPlanPublisherAccess({ planId });
      const publishersData: PlanAssociationEntry[] = accessRes.map((access) => {
        const base: PlanAssociationEntry = {
          publisherId: access.publisher_id,
          isAllowed: access.is_allowed,
          restrictions: access.restrictions,
          notes: access.notes,
        };
        if (TOTEMDIGITAL_COMPACT) {
          const local = localsCatalog.find((l) => l.publisher_id === access.publisher_id);
          return {
            ...base,
            displayLabel: local ? `${local.name}${local.totem_count != null ? ` · ${local.totem_count} totem(ns)` : ''}` : access.publisher_name,
          };
        }
        return base;
      });
      setPlanPublishers(publishersData);
      if (TOTEMDIGITAL_COMPACT) {
        const localIdSet = new Set<number>();
        const enabledByLocalMap = new Map<number, Set<number>>();

        for (const access of accessRes) {
          const restrictions = ((access.restrictions || {}) as CompactScopeRestrictions) || {};
          const localIds = normalizePositiveIntArray(restrictions.compact_scope?.local_ids);
          localIds.forEach((localId) => localIdSet.add(localId));

          const enabledByLocalRaw = restrictions.compact_scope?.enabled_totem_ids_by_local || {};
          Object.entries(enabledByLocalRaw).forEach(([localIdKey, totemIds]) => {
            const localId = Number(localIdKey);
            if (!Number.isInteger(localId) || localId <= 0) return;
            const parsedTotemIds = normalizePositiveIntArray(totemIds);
            if (!enabledByLocalMap.has(localId)) {
              enabledByLocalMap.set(localId, new Set<number>());
            }
            const acc = enabledByLocalMap.get(localId)!;
            parsedTotemIds.forEach((totemId) => acc.add(totemId));
          });
        }

        const mergedLocalIds = [...localIdSet].sort((a, b) => a - b);
        const mergedEnabledByLocal: Record<number, number[]> = {};
        enabledByLocalMap.forEach((totemSet, localId) => {
          mergedEnabledByLocal[localId] = [...totemSet].sort((a, b) => a - b);
        });

        setCompactSelectedLocalIds(mergedLocalIds);
        setCompactEnabledTotemsByLocal(mergedEnabledByLocal);
      }
    } catch (error: any) {
      console.error('Erro ao carregar publishers do plano:', error);
      setPlanPublishers([]);
      if (TOTEMDIGITAL_COMPACT) {
        setCompactSelectedLocalIds([]);
        setCompactEnabledTotemsByLocal({});
      }
    }
  };

  const handleOpenPlanDialog = async (plan?: Plan) => {
    setPlanDialogTab(0); // Resetar para a primeira aba
    setSelectedPublisherForPlan('');
    setSelectedLocalIdForPlan('');
    if (plan) {
      setPlanEditMode(true);
      setSelectedPlan(plan);
      const pm = getPlanPriceMonthly(plan);
      const py = getPlanPriceYearly(plan);
      setPlanMonthlyPriceText(formatPlanCurrencyDisplay(pm));
      setPlanYearlyPriceText(py != null ? formatPlanCurrencyDisplay(py) : '');
      setPlanFormData({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || '',
        priceMonthly: pm,
        priceYearly: py,
        currency: plan.currency || 'BRL',
        billingInterval: plan.billingInterval || plan.billing_interval || 'month',
        stripePriceIdMonthly: plan.stripePriceIdMonthly || plan.stripe_price_id_monthly || '',
        stripePriceIdYearly: plan.stripePriceIdYearly || plan.stripe_price_id_yearly || '',
        stripeProductId: plan.stripeProductId || plan.stripe_product_id || '',
        features: plan.features || {},
        limits: plan.limits || {},
        isActive: getPlanIsActive(plan),
        isPopular: getPlanIsPopular(plan),
        sortOrder: getPlanSortOrder(plan),
      });
      const planId = getPlanId(plan);
      await loadPlanPublishers(planId);
    } else {
      setPlanEditMode(false);
      setSelectedPlan(null);
      setPlanMonthlyPriceText('');
      setPlanYearlyPriceText('');
      setPlanFormData({
        name: '',
        slug: '',
        description: '',
        priceMonthly: undefined,
        priceYearly: undefined,
        currency: 'BRL',
        billingInterval: 'month',
        stripePriceIdMonthly: '',
        stripePriceIdYearly: '',
        stripeProductId: '',
        features: {},
        limits: {},
        isActive: true,
        isPopular: false,
        sortOrder: 0,
      });
      setPlanPublishers([]);
    }
    setPlanDialogOpen(true);
  };

  const handleClosePlanDialog = () => {
    setPlanDialogOpen(false);
    setPlanEditMode(false);
    setSelectedPlan(null);
    setPlanDialogTab(0);
    setPlanPublishers([]);
    setSelectedPublisherForPlan('');
    setSelectedLocalIdForPlan('');
    setCompactSelectedLocalIds([]);
    setCompactEnabledTotemsByLocal({});
    setPlanMonthlyPriceText('');
    setPlanYearlyPriceText('');
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handlePlanNameChange = (name: string) => {
    setPlanFormData({ ...planFormData, name, slug: generateSlug(name) });
  };

  const formatPlanCurrencyDisplay = (value: number): string =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Permite apenas dígitos e uma vírgula decimal (até 2 casas), sem setas de number input. */
  const normalizeCurrencyDraft = (input: string): string => {
    let s = input.replace(/[^\d,]/g, '');
    const ci = s.indexOf(',');
    if (ci === -1) return s;
    const intPart = s.slice(0, ci);
    const fracPart = s.slice(ci + 1).replace(/,/g, '').slice(0, 2);
    return intPart + ',' + fracPart;
  };

  const draftToAmount = (draft: string): number | undefined => {
    let s = draft.trim().replace(/\s/g, '');
    if (!s || s === ',') return undefined;
    if (s.endsWith(',')) s = s.slice(0, -1);
    if (!s) return undefined;
    const normalized = s.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) return undefined;
    return Math.max(0, parsed);
  };

  const handleAddPublisherToPlan = () => {
    if (TOTEMDIGITAL_COMPACT) {
      if (!selectedLocalIdForPlan) return;
      const localId = parseInt(selectedLocalIdForPlan, 10);
      const alreadySelected = compactSelectedLocalIds.includes(localId);
      if (alreadySelected) {
        handleRemoveLocalFromPlan(localId);
        setSelectedLocalIdForPlan('');
        setError(null);
        return;
      }
      const selectedLocal = localsCatalog.find((l) => l.local_id === localId);
      if (!selectedLocal) return;
      const publisherId = selectedLocal.publisher_id;
      if (publisherId == null) {
        setError('Local sem exibidor associado. Verifique o cadastro do local.');
        return;
      }
      const existingIndex = planPublishers.findIndex((p) => p.publisherId === publisherId);
      const nextLabel = `${selectedLocal.name}${selectedLocal.totem_count != null ? ` · ${selectedLocal.totem_count} totem(ns)` : ''}`;
      const totemsFromLocal = compactActiveTotemsWithPublisher
        .filter(({ totem }) => getTotemLocalIdFromRow(totem) === selectedLocal.local_id)
        .map(({ totem }) => getTotemIdFromRow(totem))
        .filter((id): id is number => id !== undefined);
      setCompactSelectedLocalIds((prev) => (prev.includes(selectedLocal.local_id) ? prev : [...prev, selectedLocal.local_id]));
      setCompactEnabledTotemsByLocal((prev) => ({
        ...prev,
        [selectedLocal.local_id]: prev[selectedLocal.local_id] || totemsFromLocal,
      }));
      if (existingIndex >= 0) {
        // Em compact (publisher owner único), trocar o local de referência evita bloqueio/confusão de "já atrelado".
        setPlanPublishers(planPublishers.map((entry, idx) => (
          idx === existingIndex
            ? { ...entry, displayLabel: nextLabel }
            : entry
        )));
        setSelectedLocalIdForPlan('');
        setError(null);
        return;
      }
      setPlanPublishers([
        ...planPublishers,
        {
          publisherId,
          isAllowed: true,
          displayLabel: nextLabel,
          restrictions: {
            compact_scope: {
              local_ids: [selectedLocal.local_id],
            },
          },
        },
      ]);
      setSelectedLocalIdForPlan('');
      setError(null);
      return;
    }

    if (!selectedPublisherForPlan) return;
    const publisherId = parseInt(selectedPublisherForPlan, 10);
    if (planPublishers.some((p) => p.publisherId === publisherId)) {
      setError('Este publisher já está associado ao plano');
      return;
    }
    setPlanPublishers([...planPublishers, { publisherId, isAllowed: true }]);
    setSelectedPublisherForPlan('');
  };

  const handleRemovePublisherFromPlan = (publisherId: number) => {
    setPlanPublishers(planPublishers.filter(p => p.publisherId !== publisherId));
  };

  const handlePlanSubmit = async () => {
    try {
      setError(null);

      // Validar campos obrigatórios
      if (
        !planFormData.name ||
        !planFormData.slug ||
        planFormData.priceMonthly == null ||
        planFormData.priceMonthly <= 0
      ) {
        setError('Nome, slug e preço mensal maior que zero são obrigatórios');
        return;
      }

      // Validar JSON de recursos e limites
      let features = planFormData.features;
      let limits = planFormData.limits;
      
      if (typeof planFormData.features === 'string') {
        try {
          features = JSON.parse(planFormData.features);
        } catch (e) {
          setError('Recursos deve ser um JSON válido');
          return;
        }
      }
      
      if (typeof planFormData.limits === 'string') {
        try {
          limits = JSON.parse(planFormData.limits);
        } catch (e) {
          setError('Limites deve ser um JSON válido');
          return;
        }
      }

      let savedPlanId: number;
      if (planEditMode && selectedPlan) {
        const planId = getPlanId(selectedPlan);
        savedPlanId = planId;
        const updateData: UpdatePlanRequest = {
          name: planFormData.name,
          description: planFormData.description,
          priceMonthly: planFormData.priceMonthly,
          priceYearly: planFormData.priceYearly,
          stripePriceIdMonthly: planFormData.stripePriceIdMonthly || undefined,
          stripePriceIdYearly: planFormData.stripePriceIdYearly || undefined,
          features,
          limits,
          isActive: planFormData.isActive,
          isPopular: planFormData.isPopular,
          sortOrder: planFormData.sortOrder,
        };
        await planApi.update(planId, updateData);
      } else {
        const createData: CreatePlanRequest = {
          ...planFormData,
          priceMonthly: planFormData.priceMonthly,
          features,
          limits,
        };
        const createdPlan = await planApi.create(createData);
        savedPlanId = getPlanId(createdPlan);
      }

      // Salvar publishers do plano
      if (planPublishers.length > 0) {
        // Primeiro, obter publishers existentes para remover os que não estão mais na lista
        const existingAccess = await subscriberAccessApi.getPlanPublisherAccess({ planId: savedPlanId });
        const existingPublisherIds = existingAccess.map(a => a.publisher_id);
        const newPublisherIds = planPublishers.map(p => p.publisherId);
        
        // Remover publishers que não estão mais na lista
        for (const existingId of existingPublisherIds) {
          if (!newPublisherIds.includes(existingId)) {
            try {
              await subscriberAccessApi.removePlanPublisherAccess(savedPlanId, existingId);
            } catch (err) {
              console.error('Erro ao remover publisher do plano:', err);
            }
          }
        }

        // Adicionar/atualizar publishers
        for (const planPublisher of planPublishers) {
          try {
            const compactRestrictions = TOTEMDIGITAL_COMPACT
              ? {
                  ...(planPublisher.restrictions || {}),
                  compact_scope: {
                    local_ids: compactSelectedLocalIds,
                    enabled_totem_ids_by_local: Object.fromEntries(
                      Object.entries(compactEnabledTotemsByLocal).map(([localId, totemIds]) => [
                        String(localId),
                        totemIds,
                      ])
                    ),
                  },
                }
              : planPublisher.restrictions;
            await subscriberAccessApi.setPlanPublisherAccess({
              planId: Number(savedPlanId),
              publisherId: Number(planPublisher.publisherId),
              isAllowed: planPublisher.isAllowed === true,
              restrictions: compactRestrictions,
              notes: planPublisher.notes,
            });
          } catch (err) {
            console.error('Erro ao salvar publisher do plano:', err);
          }
        }
      } else if (planEditMode) {
        // Se está editando e não há publishers, remover todos
        const existingAccess = await subscriberAccessApi.getPlanPublisherAccess({ planId: savedPlanId });
        for (const access of existingAccess) {
          try {
            await subscriberAccessApi.removePlanPublisherAccess(savedPlanId, access.publisher_id);
          } catch (err) {
            console.error('Erro ao remover publisher do plano:', err);
          }
        }
      }

      handleClosePlanDialog();
      await loadAllData();
    } catch (error: any) {
      console.error('Erro ao salvar plano:', error);
      setError(pickApiErrorMessage(error, 'Erro ao salvar plano'));
    }
  };

  const handlePlanDelete = async (plan: Plan) => {
    const planId = getPlanId(plan);
    if (!window.confirm(`Tem certeza que deseja remover o plano "${getPlanName(plan)}"?`)) {
      return;
    }

    try {
      setError(null);
      await planApi.delete(planId);
      await loadAllData();
    } catch (error: any) {
      console.error('Erro ao remover plano:', error);
      setError(pickApiErrorMessage(error, 'Erro ao remover plano'));
    }
  };

  // =============================================
  // FUNÇÕES ABA 2: MANUTENÇÃO DE ACESSO (publisher/local)
  // =============================================

  const handleOpenAccessDialog = (access?: PlanPublisherAccess) => {
    if (access) {
      const matchedLocal = localsCatalog.find(
        (local) => local.publisher_id === access.publisher_id
      );
      setAccessEditMode(true);
      setSelectedAccess(access);
      setAccessSelectedLocalId(matchedLocal ? String(matchedLocal.local_id) : '');
      setAccessFormData({
        planId: access.plan_id.toString(),
        publisherId: access.publisher_id.toString(),
        isAllowed: access.is_allowed,
        restrictions: access.restrictions ? JSON.stringify(access.restrictions, null, 2) : '',
        notes: access.notes || '',
      });
    } else {
      setAccessEditMode(false);
      setSelectedAccess(null);
      setAccessSelectedLocalId('');
      setAccessFormData({
        planId: '',
        publisherId: '',
        isAllowed: true,
        restrictions: '',
        notes: '',
      });
    }
    setAccessDialogOpen(true);
  };

  const handleCloseAccessDialog = () => {
    setAccessDialogOpen(false);
    setAccessEditMode(false);
    setSelectedAccess(null);
  };

  const handleAccessSubmit = async () => {
    try {
      setError(null);

      let restrictions = null;
      if (accessFormData.restrictions.trim()) {
        try {
          restrictions = JSON.parse(accessFormData.restrictions);
        } catch (e) {
          setError('Restrições devem ser um JSON válido');
          return;
        }
      }

      await subscriberAccessApi.setPlanPublisherAccess({
        planId: parseInt(accessFormData.planId),
        publisherId: parseInt(accessFormData.publisherId),
        isAllowed: accessFormData.isAllowed,
        restrictions,
        notes: accessFormData.notes || undefined,
      });

      handleCloseAccessDialog();
      await loadPublisherAccess();
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      setError(pickApiErrorMessage(error, 'Erro ao salvar configuração'));
    }
  };

  const handleAccessDelete = async (planId: number, publisherId: number) => {
    if (!window.confirm('Tem certeza que deseja remover este acesso?')) {
      return;
    }

    try {
      setError(null);
      await subscriberAccessApi.removePlanPublisherAccess(planId, publisherId);
      await loadPublisherAccess();
    } catch (error: any) {
      console.error('Erro ao remover acesso:', error);
      setError(pickApiErrorMessage(error, 'Erro ao remover acesso'));
    }
  };

  const compactTotemOptions: CompactTotemOption[] = TOTEMDIGITAL_COMPACT
    ? totemsCatalog.map((totem) => ({
        totem,
        publisherId: getTotemPublisherIdFromRow(totem),
      }))
    : [];

  const compactTotemsWithPublisher = compactTotemOptions
    .filter((entry) => entry.publisherId != null)
    .map((entry) => ({
      ...entry,
      isAlreadyLinked: planPublishers.some((pp) => pp.publisherId === entry.publisherId),
    }));
  const compactActiveTotemsWithPublisher = compactTotemsWithPublisher.filter((entry) =>
    getTotemIsActive(entry.totem)
  );
  const compactTotemsBlockedByPublisher = compactTotemsWithPublisher.filter((entry) => entry.isAlreadyLinked);
  const compactLocalOptions: CompactLocalOption[] = TOTEMDIGITAL_COMPACT
    ? localsCatalog.map((local) => ({
        local,
        publisherId: local.publisher_id,
        isAlreadyLinked: false,
      }))
    : [];
  const compactActiveLocalsWithPublisher = compactLocalOptions
    .filter((entry) => entry.publisherId != null && entry.local.is_active !== false)
    .sort((a, b) => compareByName(String(a.local.name || ''), String(b.local.name || '')));
  const compactLocalsWithoutTotems = compactActiveLocalsWithPublisher.filter(
    (entry) => (entry.local.totem_count || 0) <= 0
  );
  const compactPlanLocals = localsCatalog
    .filter((local) => compactSelectedLocalIds.includes(local.local_id))
    .sort((a, b) => compareByName(String(a.name || ''), String(b.name || '')));
  const compactTotemsBySelectedLocal = compactPlanLocals.map((local) => {
    const localTotems = compactActiveTotemsWithPublisher
      .filter(({ totem }) => getTotemLocalIdFromRow(totem) === local.local_id)
      .map(({ totem }) => totem)
      .sort((a, b) =>
        compareByName(
          formatTotemLabel(a as { totem_id: number; name?: string; identifier?: string; uin?: string }),
          formatTotemLabel(b as { totem_id: number; name?: string; identifier?: string; uin?: string })
        )
      );
    return { local, totems: localTotems };
  });
  const compactBadgeCount = TOTEMDIGITAL_COMPACT ? compactSelectedLocalIds.length : planPublishers.length;
  const planSections = [
    { label: 'Planos (CRUD)', icon: Star },
    { label: maintenanceTabLabel, icon: Business },
  ] as const;

  const handleRemoveLocalFromPlan = (localId: number) => {
    const nextLocalIds = compactSelectedLocalIds.filter((id) => id !== localId);
    setCompactSelectedLocalIds(nextLocalIds);
    setCompactEnabledTotemsByLocal((prev) => {
      const next = { ...prev };
      delete next[localId];
      return next;
    });

    if (nextLocalIds.length === 0) {
      setPlanPublishers([]);
      return;
    }

    const referenceLocal = localsCatalog.find((local) => local.local_id === nextLocalIds[0]);
    if (!referenceLocal) return;
    const nextLabel = `${referenceLocal.name}${referenceLocal.totem_count != null ? ` · ${referenceLocal.totem_count} totem(ns) cadastrados` : ''}`;
    setPlanPublishers((prev) => (
      prev.length > 0
        ? [{ ...prev[0], displayLabel: nextLabel }]
        : prev
    ));
  };

  const toggleCompactLocalSelection = (localId: number) => {
    const alreadySelected = compactSelectedLocalIds.includes(localId);
    if (alreadySelected) {
      handleRemoveLocalFromPlan(localId);
      setError(null);
      return;
    }

    const selectedLocal = localsCatalog.find((l) => l.local_id === localId);
    if (!selectedLocal) return;
    const publisherId = selectedLocal.publisher_id;
    if (publisherId == null) {
      setError('Local sem exibidor associado. Verifique o cadastro do local.');
      return;
    }

    const existingIndex = planPublishers.findIndex((p) => p.publisherId === publisherId);
    const nextLabel = `${selectedLocal.name}${selectedLocal.totem_count != null ? ` · ${selectedLocal.totem_count} totem(ns)` : ''}`;
    const totemsFromLocal = compactActiveTotemsWithPublisher
      .filter(({ totem }) => getTotemLocalIdFromRow(totem) === selectedLocal.local_id)
      .map(({ totem }) => getTotemIdFromRow(totem))
      .filter((id): id is number => id !== undefined);

    setCompactSelectedLocalIds((prev) => (prev.includes(selectedLocal.local_id) ? prev : [...prev, selectedLocal.local_id]));
    setCompactEnabledTotemsByLocal((prev) => ({
      ...prev,
      [selectedLocal.local_id]: prev[selectedLocal.local_id] || totemsFromLocal,
    }));

    if (existingIndex >= 0) {
      setPlanPublishers(planPublishers.map((entry, idx) => (
        idx === existingIndex
          ? { ...entry, displayLabel: nextLabel }
          : entry
      )));
    } else {
      setPlanPublishers([
        ...planPublishers,
        {
          publisherId,
          isAllowed: true,
          displayLabel: nextLabel,
          restrictions: {
            compact_scope: {
              local_ids: [selectedLocal.local_id],
            },
          },
        },
      ]);
    }
    setError(null);
  };

  const toggleTotemForLocal = (localId: number, totemId: number) => {
    setCompactEnabledTotemsByLocal((prev) => {
      const current = prev[localId] || [];
      const next = current.includes(totemId)
        ? current.filter((id) => id !== totemId)
        : [...current, totemId];
      return {
        ...prev,
        [localId]: [...new Set(next)].sort((a, b) => a - b),
      };
    });
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, backgroundColor: theme.palette.grey[50], minHeight: '100vh' }}>
      <PageHeader
        title={TOTEMDIGITAL_COMPACT ? 'Planos' : 'Planos e Publicadores'}
        subtitle={
          TOTEMDIGITAL_COMPACT
            ? 'Gerencie planos e configure quais locais cada plano cobre no modo compacto'
            : 'Gerencie planos e configure quais publishers cada plano permite acessar'
        }
        actions={[
          ...(tabValue === 0
            ? [{
                label: 'Criar Plano',
                icon: <Add />,
                onClick: () => handleOpenPlanDialog(),
                variant: 'contained' as const,
              }]
            : []),
        ]}
      />

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <ResponsiveSectionNav
          sections={planSections}
          value={tabValue}
          onChange={setTabValue}
          isMobileNav={isMobileNav}
          idPrefix="plan-publisher-access"
        />

        {/* Loading */}
        {loading && <LinearProgress />}

        {/* ABA 1: CRUD DE PLANOS */}
        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Nome</strong></TableCell>
                  <TableCell><strong>Slug</strong></TableCell>
                  <TableCell><strong>Preço Mensal</strong></TableCell>
                  <TableCell><strong>Preço Anual</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Popular</strong></TableCell>
                  <TableCell><strong>Ordem</strong></TableCell>
                  <TableCell><strong>Ações</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Nenhum plano encontrado. Clique em "Criar Plano" para criar.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => (
                    <TableRow key={getPlanId(plan)}>
                      <TableCell>{getPlanName(plan)}</TableCell>
                      <TableCell>
                        <Chip label={plan.slug} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: plan.currency || 'BRL',
                        }).format(getPlanPriceMonthly(plan))}
                      </TableCell>
                      <TableCell>
                        {getPlanPriceYearly(plan)
                          ? new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: plan.currency || 'BRL',
                            }).format(getPlanPriceYearly(plan)!)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getPlanIsActive(plan) ? <CheckCircle /> : <Cancel />}
                          label={getPlanIsActive(plan) ? 'Ativo' : 'Inativo'}
                          color={getPlanIsActive(plan) ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {getPlanIsPopular(plan) ? (
                          <Star color="warning" />
                        ) : (
                          <StarBorder color="disabled" />
                        )}
                      </TableCell>
                      <TableCell>{getPlanSortOrder(plan)}</TableCell>
                      <TableCell>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleOpenPlanDialog(plan)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remover">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handlePlanDelete(plan)}
                          >
                            <Delete />
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

        {/* ABA 2: MANUTENÇÃO DE PUBLISHERS */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ flex: 1, mr: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={5}>
                  <FormControl fullWidth>
                    <InputLabel>Filtrar por Plano</InputLabel>
                    <Select
                      value={accessFilters.planId}
                      onChange={(e) => setAccessFilters({ ...accessFilters, planId: e.target.value })}
                      label="Filtrar por Plano"
                    >
                      <MenuItem value="">Todos</MenuItem>
                      {plans.map((plan) => (
                        <MenuItem key={getPlanId(plan)} value={getPlanId(plan).toString()}>
                          {getPlanName(plan)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {!TOTEMDIGITAL_COMPACT && (
                  <Grid item xs={12} md={5}>
                    <FormControl fullWidth>
                      <InputLabel>{`Filtrar por ${publisherEntityLabel}`}</InputLabel>
                      <Select
                        value={accessFilters.publisherId}
                        onChange={(e) => setAccessFilters({ ...accessFilters, publisherId: e.target.value })}
                        label={`Filtrar por ${publisherEntityLabel}`}
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
                )}
              </Grid>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleOpenAccessDialog()}
            >
              Nova Configuração
            </Button>
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Plano</strong></TableCell>
                  <TableCell><strong>{publisherEntityLabel}</strong></TableCell>
                  <TableCell><strong>Acesso Permitido</strong></TableCell>
                  <TableCell><strong>Restrições</strong></TableCell>
                  <TableCell><strong>Notas</strong></TableCell>
                  <TableCell><strong>Ações</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accessList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma configuração encontrada. Clique em "Nova Configuração" para criar.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  accessList.map((access) => (
                    <TableRow key={`${access.plan_id}-${access.publisher_id}`}>
                      <TableCell>{access.plan_name}</TableCell>
                      <TableCell>
                        {TOTEMDIGITAL_COMPACT
                          ? (access as any).local_name ||
                            localsCatalog.find((local) => local.publisher_id === access.publisher_id)?.name ||
                            'Local associado'
                          : access.publisher_name}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={access.is_allowed ? <CheckCircle /> : <Cancel />}
                          label={access.is_allowed ? 'Permitido' : 'Bloqueado'}
                          color={access.is_allowed ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {access.restrictions ? (
                          <Tooltip title={JSON.stringify(access.restrictions, null, 2)}>
                            <Chip
                              icon={<Info />}
                              label="Configurado"
                              size="small"
                              variant="outlined"
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Nenhuma
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {access.notes ? (
                          <Tooltip title={access.notes}>
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {access.notes}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleOpenAccessDialog(access)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remover">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleAccessDelete(access.plan_id, access.publisher_id)}
                          >
                            <Delete />
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
      </Card>

      {/* Dialog: CRUD Planos */}
      <Dialog open={planDialogOpen} onClose={handleClosePlanDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {planEditMode ? 'Editar Plano' : 'Criar Plano'}
        </DialogTitle>
        <DialogContent>
          <Tabs
            value={planDialogTab}
            onChange={(_, newValue) => setPlanDialogTab(newValue)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ mb: 3 }}
          >
            <Tab label="Dados do Plano" />
            <Tab 
              label={publishersOfPlanLabel}
              icon={compactBadgeCount > 0 ? <Chip label={compactBadgeCount} size="small" color="primary" /> : undefined}
              iconPosition="end" 
            />
          </Tabs>

          {/* Aba 1: Dados do Plano */}
          {planDialogTab === 0 && (
            <Box sx={{ pt: 2 }}>
              <TextField
              fullWidth
              label="Nome *"
              value={planFormData.name}
              onChange={(e) => handlePlanNameChange(e.target.value)}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Slug *"
              value={planFormData.slug}
              onChange={(e) => setPlanFormData({ ...planFormData, slug: e.target.value })}
              margin="normal"
              required
              helperText="Identificador único (gerado automaticamente a partir do nome)"
            />
            <TextField
              fullWidth
              label="Descrição"
              multiline
              rows={3}
              value={planFormData.description}
              onChange={(e) => setPlanFormData({ ...planFormData, description: e.target.value })}
              margin="normal"
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Preço Mensal *"
                  type="text"
                  value={planMonthlyPriceText}
                  onChange={(e) => {
                    const draft = normalizeCurrencyDraft(e.target.value);
                    setPlanMonthlyPriceText(draft);
                    const n = draftToAmount(draft);
                    setPlanFormData((prev) => ({ ...prev, priceMonthly: n }));
                  }}
                  onBlur={() => {
                    const n = draftToAmount(planMonthlyPriceText);
                    if (n != null) {
                      setPlanMonthlyPriceText(formatPlanCurrencyDisplay(n));
                      setPlanFormData((prev) => ({ ...prev, priceMonthly: n }));
                    }
                  }}
                  margin="normal"
                  required
                  placeholder="0,00"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', autoComplete: 'off' }}
                  helperText="Use vírgula para centavos (ex.: 99,90)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Preço Anual"
                  type="text"
                  value={planYearlyPriceText}
                  onChange={(e) => {
                    const draft = normalizeCurrencyDraft(e.target.value);
                    setPlanYearlyPriceText(draft);
                    const n = draftToAmount(draft);
                    setPlanFormData((prev) => ({ ...prev, priceYearly: n }));
                  }}
                  onBlur={() => {
                    const n = draftToAmount(planYearlyPriceText);
                    if (n != null) {
                      setPlanYearlyPriceText(formatPlanCurrencyDisplay(n));
                      setPlanFormData((prev) => ({ ...prev, priceYearly: n }));
                    } else {
                      setPlanYearlyPriceText('');
                      setPlanFormData((prev) => ({ ...prev, priceYearly: undefined }));
                    }
                  }}
                  margin="normal"
                  placeholder="0,00"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal', autoComplete: 'off' }}
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Moeda</InputLabel>
                  <Select
                    value={planFormData.currency}
                    onChange={(e) => setPlanFormData({ ...planFormData, currency: e.target.value })}
                    label="Moeda"
                  >
                    <MenuItem value="BRL">BRL (Real)</MenuItem>
                    <MenuItem value="USD">USD (Dólar)</MenuItem>
                    <MenuItem value="EUR">EUR (Euro)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Intervalo de Cobrança</InputLabel>
                  <Select
                    value={planFormData.billingInterval}
                    onChange={(e) => setPlanFormData({ ...planFormData, billingInterval: e.target.value })}
                    label="Intervalo de Cobrança"
                  >
                    <MenuItem value="month">Mensal</MenuItem>
                    <MenuItem value="year">Anual</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="ID do Produto Stripe"
                  value={planFormData.stripeProductId}
                  onChange={(e) => setPlanFormData({ ...planFormData, stripeProductId: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="ID do Preço Stripe (Mensal)"
                  value={planFormData.stripePriceIdMonthly}
                  onChange={(e) => setPlanFormData({ ...planFormData, stripePriceIdMonthly: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="ID do Preço Stripe (Anual)"
                  value={planFormData.stripePriceIdYearly}
                  onChange={(e) => setPlanFormData({ ...planFormData, stripePriceIdYearly: e.target.value })}
                  margin="normal"
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              label="Recursos (JSON)"
              multiline
              rows={4}
              value={typeof planFormData.features === 'string' ? planFormData.features : JSON.stringify(planFormData.features, null, 2)}
              onChange={(e) => setPlanFormData({ ...planFormData, features: e.target.value })}
              margin="normal"
              helperText="Objeto JSON com recursos do plano. Ex.: { 'recurso1': true, 'nivel': 'avancado' }"
            />
            <TextField
              fullWidth
              label="Limites (JSON)"
              multiline
              rows={4}
              value={typeof planFormData.limits === 'string' ? planFormData.limits : JSON.stringify(planFormData.limits, null, 2)}
              onChange={(e) => setPlanFormData({ ...planFormData, limits: e.target.value })}
              margin="normal"
              helperText="Objeto JSON com limites. Ex.: { 'totens': 10, 'campanhas': 50, 'armazenamento_gb': 100 }"
            />
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={planFormData.isActive}
                      onChange={(e) => setPlanFormData({ ...planFormData, isActive: e.target.checked })}
                    />
                  }
                  label="Ativo"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={planFormData.isPopular}
                      onChange={(e) => setPlanFormData({ ...planFormData, isPopular: e.target.checked })}
                    />
                  }
                  label="Popular"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Ordem de Exibição"
                  type="number"
                  value={planFormData.sortOrder}
                  onChange={(e) => setPlanFormData({ ...planFormData, sortOrder: parseInt(e.target.value) || 0 })}
                  margin="normal"
                />
              </Grid>
            </Grid>
            </Box>
          )}

          {/* Aba 2: Publishers do Plano */}
          {planDialogTab === 1 && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {publishersOfPlanLabel}
              </Typography>
              
              <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>{addPublisherLabel}</Typography>
                {TOTEMDIGITAL_COMPACT && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    No modo compact, selecione um local para escopo operacional do plano. Ao escolher um local, todos
                    os totems do local são considerados na operação.
                  </Typography>
                )}
                {TOTEMDIGITAL_COMPACT && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Escopo de seleção por local na interface (transição). A persistência atual ainda usa vínculo por
                    exibidor para manter compatibilidade.
                  </Alert>
                )}
                {TOTEMDIGITAL_COMPACT && localsCatalog.length === 0 && !loading && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Nenhum local encontrado. Cadastre locais em <strong>Locais</strong> e associe totems a eles.
                  </Alert>
                )}
                {TOTEMDIGITAL_COMPACT && localsCatalog.length > 0 && compactActiveLocalsWithPublisher.length === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Não há locais ativos com exibidor para seleção neste plano.
                  </Alert>
                )}
                {TOTEMDIGITAL_COMPACT && compactLocalsWithoutTotems.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                      {compactLocalsWithoutTotems.length} local(is) não têm totems ativos associados.
                    </Typography>
                    <List dense disablePadding sx={{ pl: 0, mt: 0.5 }}>
                      {compactLocalsWithoutTotems.map(({ local }) => (
                        <ListItem key={local.local_id} alignItems="flex-start" disableGutters sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={local.name}
                            secondary={`ID do local: ${local.local_id}`}
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Alert>
                )}
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={8}>
                    <FormControl fullWidth>
                      <InputLabel>{publisherEntityLabel}</InputLabel>
                      {TOTEMDIGITAL_COMPACT ? (
                        <Select
                          value={selectedLocalIdForPlan}
                          onChange={(e) => {
                            const value = String(e.target.value || '');
                            setSelectedLocalIdForPlan(value);
                            const localId = parseInt(value, 10);
                            if (!Number.isNaN(localId)) {
                              toggleCompactLocalSelection(localId);
                            }
                            setSelectedLocalIdForPlan('');
                          }}
                          label={publisherEntityLabel}
                        >
                          <MenuItem value="">{`Selecione um ${publisherEntityLabel.toLowerCase()}`}</MenuItem>
                          {compactActiveLocalsWithPublisher
                            .map(({ local }) => {
                              const isAlreadySelected = compactSelectedLocalIds.includes(local.local_id);
                              const linkedSuffix = isAlreadySelected ? ' · já selecionado' : '';
                              return (
                              <MenuItem
                                key={local.local_id}
                                value={String(local.local_id)}
                                sx={isAlreadySelected ? {
                                  color: 'success.main',
                                  fontWeight: 700,
                                  opacity: 0.8,
                                } : undefined}
                              >
                                {`${local.name} · ${local.totem_count || 0} totem(ns) cadastrados${linkedSuffix}`}
                              </MenuItem>
                              );
                            })}
                        </Select>
                      ) : (
                        <Select
                          value={selectedPublisherForPlan}
                          onChange={(e) => setSelectedPublisherForPlan(e.target.value)}
                          label={publisherEntityLabel}
                        >
                          <MenuItem value="">{`Selecione um ${publisherEntityLabel.toLowerCase()}`}</MenuItem>
                          {publishers
                            .filter((p) => !planPublishers.some((pp) => pp.publisherId === p.publisher_id))
                            .map((publisher) => (
                              <MenuItem key={publisher.publisher_id} value={publisher.publisher_id.toString()}>
                                {publisher.name}
                              </MenuItem>
                            ))}
                        </Select>
                      )}
                    </FormControl>
                  </Grid>
                  {!TOTEMDIGITAL_COMPACT && (
                    <Grid item xs={12} md={4}>
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={handleAddPublisherToPlan}
                        disabled={!selectedPublisherForPlan}
                        fullWidth
                      >
                        Adicionar
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {TOTEMDIGITAL_COMPACT && compactPlanLocals.length > 0 && (
                <Box sx={{ mb: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Totens habilitados por local
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    Selecione quais totems de cada local ficam habilitados para este plano.
                  </Typography>
                  {compactTotemsBySelectedLocal.map(({ local, totems }) => (
                    <Box key={local.local_id} sx={{ mb: 2, pb: 1, borderBottom: `1px dashed ${theme.palette.divider}` }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        {local.name}
                      </Typography>
                      {totems.length === 0 ? (
                        <Typography variant="caption" color="text.secondary">
                          Sem totems ativos neste local.
                        </Typography>
                      ) : (
                        <List dense sx={{ pt: 0 }}>
                          {totems
                            .map((totem) => {
                            const tid = getTotemIdFromRow(totem);
                            if (tid === undefined) return null;
                            const enabledTotems = compactEnabledTotemsByLocal[local.local_id] || [];
                            const checked = enabledTotems.includes(tid);
                            return (
                              <ListItem key={tid} disableGutters sx={{ py: 0 }}>
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={checked}
                                      onChange={() => toggleTotemForLocal(local.local_id, tid)}
                                      size="small"
                                    />
                                  }
                                  label={
                                    <Typography variant="body2">
                                      {formatTotemLabel(totem)}
                                    </Typography>
                                  }
                                />
                              </ListItem>
                            );
                          })
                            .filter(Boolean)}
                        </List>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {(TOTEMDIGITAL_COMPACT ? compactPlanLocals.length > 0 : planPublishers.length > 0) ? (
                <List>
                  {TOTEMDIGITAL_COMPACT
                    ? compactPlanLocals.map((local) => {
                        const activeTotems = compactActiveTotemsWithPublisher.filter(
                          ({ totem }) => getTotemLocalIdFromRow(totem) === local.local_id
                        );
                        const enabledTotems = compactEnabledTotemsByLocal[local.local_id] || [];
                        const sharedNotes = planPublishers[0]?.notes;
                        return (
                          <ListItem
                            key={local.local_id}
                            sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}
                          >
                            <ListItemIcon><Business /></ListItemIcon>
                            <ListItemText
                              primary={`${local.name} · ${local.totem_count || 0} totem(ns) cadastrados`}
                              secondary={
                                <Box sx={{ mt: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                    Totens ativos: {activeTotems.length} · habilitados no plano: {enabledTotems.length}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                    Escopo operacional: todos os totems do local selecionado.
                                  </Typography>
                                  <Box sx={{ mt: 1 }}>
                                    <Chip
                                      icon={<CheckCircle />}
                                      label="Acesso Permitido"
                                      color="success"
                                      size="small"
                                      sx={{ mr: 1 }}
                                    />
                                    {sharedNotes && (
                                      <Typography variant="caption" color="text.secondary">
                                        {sharedNotes}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              }
                            />
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveLocalFromPlan(local.local_id)}
                            >
                              <Delete />
                            </IconButton>
                          </ListItem>
                        );
                      })
                    : planPublishers.map((planPublisher) => {
                    const publisher = publishers.find((p) => p.publisher_id === planPublisher.publisherId);
                    const primaryLabel =
                      TOTEMDIGITAL_COMPACT && planPublisher.displayLabel
                        ? planPublisher.displayLabel
                        : publisher?.name || `${publisherEntityLabel} ID: ${planPublisher.publisherId}`;
                    return (
                      <ListItem 
                        key={planPublisher.publisherId} 
                        sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, mb: 1 }}
                      >
                        <ListItemIcon><Business /></ListItemIcon>
                        <ListItemText
                          primary={primaryLabel}
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              {TOTEMDIGITAL_COMPACT && publisher?.name && (
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                  Exibidor: {publisher.name}
                                </Typography>
                              )}
                              {TOTEMDIGITAL_COMPACT && (
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                                  Escopo operacional: todos os totems do local selecionado.
                                </Typography>
                              )}
                              <Box sx={{ mt: 1 }}>
                                <Chip
                                  icon={planPublisher.isAllowed ? <CheckCircle /> : <Cancel />}
                                  label={planPublisher.isAllowed ? 'Acesso Permitido' : 'Acesso Bloqueado'}
                                  color={planPublisher.isAllowed ? 'success' : 'error'}
                                  size="small"
                                  sx={{ mr: 1 }}
                                />
                                {planPublisher.notes && (
                                  <Typography variant="caption" color="text.secondary">
                                    {planPublisher.notes}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          }
                        />
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleRemovePublisherFromPlan(planPublisher.publisherId)}
                        >
                          <Delete />
                        </IconButton>
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Alert severity="info">
                  {`Nenhum ${publisherEntityLabel.toLowerCase()} associado a este plano. Você pode adicionar ${publisherEntityLabel.toLowerCase()}s através do campo acima.`}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePlanDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handlePlanSubmit}
            disabled={
              !planFormData.name ||
              !planFormData.slug ||
              planFormData.priceMonthly == null ||
              planFormData.priceMonthly <= 0
            }
          >
            {planEditMode ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Manutenção de entidade de acesso (publisher/totem) */}
      <Dialog open={accessDialogOpen} onClose={handleCloseAccessDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {accessEditMode ? 'Editar Configuração' : 'Nova Configuração'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Plano *</InputLabel>
              <Select
                value={accessFormData.planId}
                onChange={(e) => setAccessFormData({ ...accessFormData, planId: e.target.value })}
                label="Plano *"
                disabled={accessEditMode}
              >
                <MenuItem value="">Selecione um plano</MenuItem>
                {plans.map((plan) => (
                  <MenuItem key={getPlanId(plan)} value={getPlanId(plan).toString()}>
                    {getPlanName(plan)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal">
              <InputLabel>{`${accessEntityLabel} *`}</InputLabel>
              {TOTEMDIGITAL_COMPACT ? (
                <Select
                  value={accessSelectedLocalId}
                  onChange={(e) => {
                    const localId = e.target.value;
                    setAccessSelectedLocalId(localId);
                    const local = localsCatalog.find((l) => l.local_id === parseInt(localId, 10));
                    const publisherId = local?.publisher_id;
                    setAccessFormData({
                      ...accessFormData,
                      publisherId: publisherId != null ? String(publisherId) : '',
                    });
                  }}
                  label={`${accessEntityLabel} *`}
                  disabled={accessEditMode}
                >
                  <MenuItem value="">{`Selecione um ${accessEntityLabel.toLowerCase()}`}</MenuItem>
                  {compactActiveLocalsWithPublisher.map(({ local }) => {
                    return (
                      <MenuItem key={local.local_id} value={String(local.local_id)}>
                        {`${local.name} · ${local.totem_count || 0} totem(ns)`}
                      </MenuItem>
                    );
                  })}
                </Select>
              ) : (
                <Select
                  value={accessFormData.publisherId}
                  onChange={(e) => setAccessFormData({ ...accessFormData, publisherId: e.target.value })}
                  label={`${accessEntityLabel} *`}
                  disabled={accessEditMode}
                >
                  <MenuItem value="">{`Selecione um ${accessEntityLabel.toLowerCase()}`}</MenuItem>
                  {publishers.map((publisher) => (
                    <MenuItem key={publisher.publisher_id} value={publisher.publisher_id.toString()}>
                      {publisher.name}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </FormControl>
            {TOTEMDIGITAL_COMPACT && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Ambiente compacto com publisher único da instalação: selecione apenas o local e os totems desejados.
              </Typography>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={accessFormData.isAllowed}
                  onChange={(e) => setAccessFormData({ ...accessFormData, isAllowed: e.target.checked })}
                />
              }
              label="Acesso Permitido"
              sx={{ mt: 2 }}
            />

            <TextField
              fullWidth
              label="Restrições (JSON)"
              multiline
              rows={4}
              value={accessFormData.restrictions}
              onChange={(e) => setAccessFormData({ ...accessFormData, restrictions: e.target.value })}
              margin="normal"
              helperText="Exemplo: { 'max_campaigns': 10, 'revenue_share_min': 5 }"
              placeholder='{ "max_campaigns": 10, "revenue_share_min": 5 }'
            />

            <TextField
              fullWidth
              label="Notas"
              multiline
              rows={2}
              value={accessFormData.notes}
              onChange={(e) => setAccessFormData({ ...accessFormData, notes: e.target.value })}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAccessDialog}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleAccessSubmit}
            disabled={!accessFormData.planId || !accessFormData.publisherId}
          >
            {accessEditMode ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlanPublisherAccessPage;
