/**
 * Intervalos de cobrança: plano (tabela de preços) e contrato (valor acordado por período).
 */
export const BILLING_INTERVAL_CODES = ['month', 'four_month', 'semester', 'year'] as const;
export type BillingIntervalCode = (typeof BILLING_INTERVAL_CODES)[number];

export const BILLING_INTERVAL_LABELS: Record<BillingIntervalCode, string> = {
  month: 'Mensal',
  four_month: 'Quadrimestral',
  semester: 'Semestral',
  year: 'Anual',
};

export function isBillingIntervalCode(value: string): value is BillingIntervalCode {
  return (BILLING_INTERVAL_CODES as readonly string[]).includes(value);
}

/** Normaliza legado (payment_terms texto, year/month antigos). */
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

export type PlanPriceRow = {
  price_monthly?: number | string | null;
  priceMonthly?: number | string | null;
  price_four_month?: number | string | null;
  priceFourMonth?: number | string | null;
  price_semester?: number | string | null;
  priceSemester?: number | string | null;
  price_yearly?: number | string | null;
  priceYearly?: number | string | null;
  billing_interval?: string | null;
  billingInterval?: string | null;
};

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function getPlanPriceForInterval(plan: PlanPriceRow | null | undefined, interval: string): number | undefined {
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

/** Intervalo padrão do plano (referência para novos contratos). */
export function getPlanDefaultBillingInterval(plan: PlanPriceRow | null | undefined): BillingIntervalCode {
  return normalizeBillingInterval(plan?.billingInterval ?? plan?.billing_interval ?? 'month');
}

export function resolveContractAmountFromPlan(
  plan: PlanPriceRow | null | undefined,
  interval: string,
  explicitTotal?: number | null
): number | undefined {
  if (explicitTotal != null && Number.isFinite(Number(explicitTotal)) && Number(explicitTotal) > 0) {
    return Number(explicitTotal);
  }
  return getPlanPriceForInterval(plan, interval);
}

/** Período de faturação alinhado ao calendário (para emissão de faturas). */
export function periodBoundsForInterval(
  interval: string,
  ref: Date = new Date()
): { start: string; end: string; label: string } {
  const code = normalizeBillingInterval(interval);
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = (year: number, month1: number) => new Date(year, month1, 0).getDate();

  if (code === 'year') {
    return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) };
  }
  if (code === 'semester') {
    if (m < 6) {
      return { start: `${y}-01-01`, end: `${y}-06-30`, label: `${y}-S1` };
    }
    return { start: `${y}-07-01`, end: `${y}-12-31`, label: `${y}-S2` };
  }
  if (code === 'four_month') {
    if (m < 4) {
      return {
        start: `${y}-01-01`,
        end: `${y}-04-${pad(lastDay(y, 4))}`,
        label: `${y}-4M1`,
      };
    }
    if (m < 8) {
      return {
        start: `${y}-05-01`,
        end: `${y}-08-${pad(lastDay(y, 8))}`,
        label: `${y}-4M2`,
      };
    }
    return {
      start: `${y}-09-01`,
      end: `${y}-12-${pad(lastDay(y, 12))}`,
      label: `${y}-4M3`,
    };
  }
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    label: `${y}-${pad(m + 1)}`,
  };
}
