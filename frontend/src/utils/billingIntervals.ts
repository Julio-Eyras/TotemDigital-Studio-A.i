/**
 * Intervalos de cobrança (plano + contrato) — espelho do backend.
 */
import { todayYmd } from './businessDate';

export const BILLING_INTERVAL_CODES = ['month', 'four_month', 'semester', 'year'] as const;
export type BillingIntervalCode = (typeof BILLING_INTERVAL_CODES)[number];

export const BILLING_INTERVAL_OPTIONS: { value: BillingIntervalCode; label: string }[] = [
  { value: 'month', label: 'Mensal' },
  { value: 'four_month', label: 'Quadrimestral' },
  { value: 'semester', label: 'Semestral' },
  { value: 'year', label: 'Anual' },
];

export const BILLING_INTERVAL_LABELS: Record<BillingIntervalCode, string> = {
  month: 'Mensal',
  four_month: 'Quadrimestral',
  semester: 'Semestral',
  year: 'Anual',
};

export function normalizeBillingInterval(raw?: string | null): BillingIntervalCode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'year' || s === 'anual' || s === 'annual') return 'year';
  if (s === 'four_month' || s === 'quadrimestral') return 'four_month';
  if (s === 'semester' || s === 'semestral' || s === 'semiannual') return 'semester';
  if (s === 'month' || s === 'mensal' || s === 'monthly') return 'month';
  return 'month';
}

export function billingIntervalLabel(code?: string | null): string {
  const n = normalizeBillingInterval(code);
  return BILLING_INTERVAL_LABELS[n];
}

export function monthsForBillingInterval(interval: string): number {
  switch (normalizeBillingInterval(interval)) {
    case 'year':
      return 12;
    case 'four_month':
      return 4;
    case 'semester':
      return 6;
    default:
      return 1;
  }
}

export type PlanPriceFields = {
  price_monthly?: number;
  priceMonthly?: number;
  price_four_month?: number;
  priceFourMonth?: number;
  price_semester?: number;
  priceSemester?: number;
  price_yearly?: number;
  priceYearly?: number;
  billing_interval?: string;
  billingInterval?: string;
};

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getPlanPriceForInterval(plan: PlanPriceFields | null | undefined, interval: string): number | undefined {
  if (!plan) return undefined;
  const code = normalizeBillingInterval(interval);
  switch (code) {
    case 'year':
      return num(plan.priceYearly ?? plan.price_yearly);
    case 'four_month':
      return num(plan.priceFourMonth ?? plan.price_four_month);
    case 'semester':
      return num(plan.priceSemester ?? plan.price_semester);
    default:
      return num(plan.priceMonthly ?? plan.price_monthly);
  }
}

/** Intervalos oferecidos pelo plano (preço > 0). */
export function getPlanAvailableIntervals(plan: PlanPriceFields | null | undefined): BillingIntervalCode[] {
  if (!plan) return [];
  return BILLING_INTERVAL_CODES.filter((code) => getPlanPriceForInterval(plan, code) != null);
}

export function getBillingIntervalOptionsForPlan(plan: PlanPriceFields | null | undefined) {
  const available = getPlanAvailableIntervals(plan);
  if (available.length === 0) return BILLING_INTERVAL_OPTIONS;
  return BILLING_INTERVAL_OPTIONS.filter((opt) => available.includes(opt.value));
}

export function getPlanDefaultBillingInterval(plan: PlanPriceFields | null | undefined): BillingIntervalCode {
  return normalizeBillingInterval(plan?.billingInterval ?? plan?.billing_interval ?? 'month');
}

/** Intervalo do contrato: preferido se ativo no plano; senão referência do plano; senão primeiro ativo. */
export function resolveContractBillingInterval(
  plan: PlanPriceFields | null | undefined,
  preferred?: string | null
): BillingIntervalCode {
  const available = getPlanAvailableIntervals(plan);
  if (available.length === 0) {
    return preferred ? normalizeBillingInterval(preferred) : 'month';
  }
  if (preferred) {
    const p = normalizeBillingInterval(preferred);
    if (available.includes(p)) return p;
  }
  const ref = getPlanDefaultBillingInterval(plan);
  if (available.includes(ref)) return ref;
  return available[0];
}

export function getPlanContractAmount(plan: PlanPriceFields | null | undefined, interval?: string): number | undefined {
  const iv = interval ?? resolveContractBillingInterval(plan);
  return getPlanPriceForInterval(plan, iv);
}

function parseYmd(input: string): Date {
  const [y, m, d] = String(input).split('T')[0].split('-').map((x) => parseInt(x, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = out.getDate();
  out.setMonth(out.getMonth() + months);
  if (out.getDate() < day) {
    out.setDate(0);
  }
  return out;
}

/** Término padrão: um ano após o início. */
export function getDefaultContractEndDate(startDateYmd: string): string {
  return formatYmd(addMonths(parseYmd(startDateYmd), 12));
}

/** Vigência mínima: duração de um período do intervalo escolhido. */
export function getMinContractEndDate(startDateYmd: string, billingInterval: string): string {
  return formatYmd(addMonths(parseYmd(startDateYmd), monthsForBillingInterval(billingInterval)));
}

export function clampContractEndDate(
  startDateYmd: string,
  endDateYmd: string | null | undefined,
  billingInterval: string
): string {
  const min = getMinContractEndDate(startDateYmd, billingInterval);
  const candidate = endDateYmd?.trim() ? String(endDateYmd).split('T')[0] : getDefaultContractEndDate(startDateYmd);
  return candidate < min ? min : candidate;
}

/** Término padrão do contrato (1 ano ou mínimo do intervalo, o que for maior). */
export function buildContractEndDate(
  startDateYmd?: string,
  billingInterval?: string | null
): string {
  const start = startDateYmd?.trim() || todayYmd();
  return clampContractEndDate(start, undefined, billingInterval ?? 'month');
}

export function isContractEndDateValid(
  startDateYmd: string,
  endDateYmd: string | null | undefined,
  billingInterval: string
): boolean {
  if (!endDateYmd?.trim()) return true;
  const end = String(endDateYmd).split('T')[0];
  return end >= getMinContractEndDate(startDateYmd, billingInterval);
}

export function contractEndDateHelperText(startDateYmd: string, billingInterval: string): string {
  const min = getMinContractEndDate(startDateYmd, billingInterval);
  const minBr = new Date(min + 'T12:00:00').toLocaleDateString('pt-BR');
  return `Padrão: 1 ano após o início. Mínimo para ${billingIntervalLabel(billingInterval)}: ${minBr}`;
}

/** Valida plano: pelo menos um preço; intervalo de referência com preço. */
export type PlanStripePriceFields = PlanPriceFields & {
  stripePriceIdMonthly?: string;
  stripePriceIdFourMonth?: string;
  stripePriceIdSemester?: string;
  stripePriceIdYearly?: string;
};

const STRIPE_PRICE_FIELD_BY_INTERVAL: Record<
  BillingIntervalCode,
  keyof Pick<
    PlanStripePriceFields,
    'stripePriceIdMonthly' | 'stripePriceIdFourMonth' | 'stripePriceIdSemester' | 'stripePriceIdYearly'
  >
> = {
  month: 'stripePriceIdMonthly',
  four_month: 'stripePriceIdFourMonth',
  semester: 'stripePriceIdSemester',
  year: 'stripePriceIdYearly',
};

/** Campos Stripe Price ID apenas para intervalos com preço configurado no plano. */
export function getStripePriceFieldsForPlan(plan: PlanStripePriceFields | null | undefined) {
  return getPlanAvailableIntervals(plan).map((code) => ({
    interval: code,
    label: BILLING_INTERVAL_LABELS[code],
    field: STRIPE_PRICE_FIELD_BY_INTERVAL[code],
  }));
}

export function resolvePublisherContractBillingInterval(data: {
  billing_interval?: string | null;
  subscription_interval?: string | null;
}): BillingIntervalCode | null {
  const raw = data.billing_interval ?? data.subscription_interval;
  if (raw == null || String(raw).trim() === '') return null;
  return normalizeBillingInterval(raw);
}

export function validatePlanPriceConfiguration(
  plan: PlanPriceFields,
  referenceInterval?: string | null
): { ok: true } | { ok: false; message: string } {
  const available = getPlanAvailableIntervals(plan);
  if (available.length === 0) {
    return { ok: false, message: 'Informe pelo menos um preço por intervalo de cobrança' };
  }
  const ref = normalizeBillingInterval(referenceInterval ?? getPlanDefaultBillingInterval(plan));
  if (!available.includes(ref)) {
    return {
      ok: false,
      message: `O intervalo de referência (${billingIntervalLabel(ref)}) precisa ter preço configurado`,
    };
  }
  return { ok: true };
}
