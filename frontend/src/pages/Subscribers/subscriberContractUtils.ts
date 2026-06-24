import { CreateContractRequest } from '../../services/api';
import {
  formatDateForApi,
  formatDateForInput,
  getDefaultContractStartDate,
} from '../../utils/businessDate';
import {
  billingIntervalLabel,
  buildContractEndDate,
  clampContractEndDate,
  getBillingIntervalOptionsForPlan,
  getDefaultContractEndDate,
  getPlanAvailableIntervals,
  getPlanDefaultBillingInterval,
  getPlanPriceForInterval,
  isContractEndDateValid,
  normalizeBillingInterval,
  resolveContractBillingInterval,
} from '../../utils/billingIntervals';

export { formatDateForInput, formatDateForApi as formatDateForAPI, getDefaultContractStartDate };

export const buildContractEndDateForStart = (
  startYmd?: string,
  billingInterval?: string,
  currentEnd?: string
): string => {
  const start = startYmd || getDefaultContractStartDate();
  const interval = normalizeBillingInterval(billingInterval || 'month');
  const defaultEnd = buildContractEndDate(start, interval);
  return clampContractEndDate(start, currentEnd || defaultEnd, interval);
};

export const getPlanIdFromOption = (plan: any): number | undefined => {
  const id = plan?.planId ?? plan?.plan_id;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export const getPlanCurrency = (plan: any): string => String(plan?.currency || 'BRL').toUpperCase();

export const formatCurrencyAmount = (amount?: number | null, currency: string = 'BRL') => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(n);
};

export const getPlanOptionLabel = (plan: any): string => {
  const currency = getPlanCurrency(plan);
  const iv = resolveContractBillingInterval(plan);
  const amount = getPlanPriceForInterval(plan, iv);
  const offered = getPlanAvailableIntervals(plan).map((c) => billingIntervalLabel(c)).join(', ');
  const value =
    amount != null
      ? ` — ref. ${formatCurrencyAmount(amount, currency)} (${billingIntervalLabel(iv)})`
      : '';
  const intervals = offered ? ` · ${offered}` : '';
  return `${plan?.name || 'Plano'}${value}${intervals}`;
};

export const getContractIntervalOptions = (planId: number | undefined, plans: any[]) => {
  const plan = plans.find((p) => getPlanIdFromOption(p) === planId);
  return getBillingIntervalOptionsForPlan(plan);
};

export const getSelectedPlanValueHelper = (
  planId: number | undefined,
  plans: any[],
  billingInterval?: string
): string => {
  const plan = plans.find((p) => getPlanIdFromOption(p) === planId);
  if (!plan) return 'Valor fechado neste contrato';
  const iv = normalizeBillingInterval(billingInterval ?? getPlanDefaultBillingInterval(plan));
  const ref = getPlanPriceForInterval(plan, iv);
  if (ref == null) return 'Informe o valor acordado para este contrato';
  return `Referência do plano (${billingIntervalLabel(iv)}): ${formatCurrencyAmount(ref, getPlanCurrency(plan))} — pode negociar abaixo`;
};

export const applyPlanToContractForm = <T extends CreateContractRequest>(
  form: T,
  planId: number | undefined,
  plans: any[],
  intervalOverride?: string
): T => {
  const plan = plans.find((p) => getPlanIdFromOption(p) === planId);
  if (!planId || !plan) {
    return { ...form, plan_id: planId } as T;
  }
  const interval = resolveContractBillingInterval(plan, intervalOverride ?? form.billing_interval);
  const refAmount = getPlanPriceForInterval(plan, interval);
  const start = formatDateForInput(form.start_date) || getDefaultContractStartDate();
  const end = clampContractEndDate(start, formatDateForInput(form.end_date), interval);
  return {
    ...form,
    plan_id: planId,
    billing_interval: interval,
    payment_terms: billingIntervalLabel(interval),
    currency: getPlanCurrency(plan),
    start_date: start,
    end_date: end,
    ...(refAmount != null ? { total_amount: refAmount } : {}),
  } as T;
};

export const applyContractBillingInterval = <T extends CreateContractRequest>(
  form: T,
  plans: any[],
  interval: string
): T => {
  const plan = plans.find((p) => getPlanIdFromOption(p) === form.plan_id);
  const code = resolveContractBillingInterval(plan, interval);
  const refAmount = plan ? getPlanPriceForInterval(plan, code) : undefined;
  const start = formatDateForInput(form.start_date) || getDefaultContractStartDate();
  const end = clampContractEndDate(start, formatDateForInput(form.end_date), code);
  return {
    ...form,
    billing_interval: code,
    payment_terms: billingIntervalLabel(code),
    end_date: end,
    ...(refAmount != null ? { total_amount: refAmount } : {}),
  } as T;
};

export const applyContractStartDate = <T extends CreateContractRequest>(form: T, startYmd: string): T =>
  ({
    ...form,
    start_date: startYmd,
    end_date: getDefaultContractEndDate(startYmd),
  }) as T;

export const applyContractEndDate = <T extends CreateContractRequest>(form: T, endYmd: string): T => {
  const start = formatDateForInput(form.start_date) || getDefaultContractStartDate();
  const interval = normalizeBillingInterval(form.billing_interval || 'month');
  return {
    ...form,
    end_date: clampContractEndDate(start, endYmd, interval),
  } as T;
};

export const validateSubscriberContractForm = (
  form: CreateContractRequest,
  plans: any[]
): string | null => {
  const start = formatDateForInput(form.start_date) || getDefaultContractStartDate();
  const end =
    formatDateForInput(form.end_date) || buildContractEndDateForStart(start, form.billing_interval);
  const interval = normalizeBillingInterval(form.billing_interval || 'month');
  if (!isContractEndDateValid(start, end, interval)) {
    return 'Data de término deve cobrir pelo menos um período do intervalo de cobrança escolhido';
  }
  if (form.plan_id) {
    const plan = plans.find((p) => getPlanIdFromOption(p) === form.plan_id);
    const available = getPlanAvailableIntervals(plan);
    if (available.length === 0) {
      return 'O plano selecionado não possui preços por intervalo configurados';
    }
    if (!available.includes(interval)) {
      return 'Intervalo de cobrança não disponível para este plano';
    }
  }
  return null;
};

export const filterEditableContracts = (contracts: any[]): any[] =>
  contracts.filter((c: any) => String(c?.status || '').toLowerCase() !== 'cancelled');

export const generateSubscriberContractNumber = (
  subscriberId: number,
  existingContracts: Array<{ contract_number?: string }>
): string => {
  const parseSeq = (n: string) => {
    if (!n || typeof n !== 'string') return 0;
    const parts = n.trim().split('.');
    const last = parts[parts.length - 1];
    const num = parseInt(last, 10);
    return Number.isNaN(num) ? 0 : num;
  };
  const maxSeq =
    existingContracts.length === 0
      ? 0
      : Math.max(0, ...existingContracts.map((c) => parseSeq(c.contract_number || '')));
  return `SUB-${subscriberId}.${String(maxSeq + 1).padStart(6, '0')}`;
};

export const emptySubscriberContractForm = (): CreateContractRequest => {
  const start = getDefaultContractStartDate();
  return {
    contract_number: '',
    contract_type: 'advertising',
    title: '',
    description: '',
    start_date: start,
    end_date: buildContractEndDateForStart(start, 'month'),
    currency: 'BRL',
    total_amount: undefined,
    billing_interval: 'month',
    status: 'draft',
    plan_id: undefined,
  };
};
