/**
 * Intervalos de cobrança (plano + contrato) — espelho do backend.
 */
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

export function getPlanDefaultBillingInterval(plan: PlanPriceFields | null | undefined): BillingIntervalCode {
  return normalizeBillingInterval(plan?.billingInterval ?? plan?.billing_interval ?? 'month');
}

export function getPlanContractAmount(plan: PlanPriceFields | null | undefined, interval?: string): number | undefined {
  const iv = interval ?? getPlanDefaultBillingInterval(plan);
  return getPlanPriceForInterval(plan, iv);
}

/** Não sobrescreve valor já negociado (> 0). */
export function shouldApplyPlanReferenceAmount(currentTotal?: number | null): boolean {
  const n = Number(currentTotal);
  return !(Number.isFinite(n) && n > 0);
}
