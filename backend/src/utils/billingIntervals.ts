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

/** Intervalo canónico em contratos de exibidor (billing_interval ou legado subscription_interval). */
export function resolvePublisherContractBillingInterval(data: {
  billing_interval?: string | null;
  subscription_interval?: string | null;
}): BillingIntervalCode | null {
  const raw = data.billing_interval ?? data.subscription_interval;
  if (raw == null || String(raw).trim() === '') return null;
  return normalizeBillingInterval(raw);
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
  stripe_price_id_monthly?: string | null;
  stripePriceIdMonthly?: string | null;
  stripe_price_id_four_month?: string | null;
  stripePriceIdFourMonth?: string | null;
  stripe_price_id_semester?: string | null;
  stripePriceIdSemester?: string | null;
  stripe_price_id_yearly?: string | null;
  stripePriceIdYearly?: string | null;
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

export function getStripePriceIdForInterval(
  plan: PlanPriceRow | null | undefined,
  interval: string
): string | undefined {
  if (!plan) return undefined;
  const code = normalizeBillingInterval(interval);
  switch (code) {
    case 'year':
      return plan.stripePriceIdYearly ?? plan.stripe_price_id_yearly ?? undefined;
    case 'four_month':
      return plan.stripePriceIdFourMonth ?? plan.stripe_price_id_four_month ?? undefined;
    case 'semester':
      return plan.stripePriceIdSemester ?? plan.stripe_price_id_semester ?? undefined;
    default:
      return plan.stripePriceIdMonthly ?? plan.stripe_price_id_monthly ?? undefined;
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

function parseYmd(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
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

/** Período de faturação alinhado ao calendário (legado / fallback). */
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

/**
 * Período de faturação ancorado na data de início do contrato (solução B).
 * O período que contém `ref` é calculado em ciclos de N meses desde `contractStart`.
 */
export function periodBoundsFromContractStart(
  interval: string,
  contractStart: string | Date,
  ref: Date = new Date()
): { start: string; end: string; label: string } {
  const step = monthsForBillingInterval(interval);
  const anchor = parseYmd(contractStart);
  const refD = parseYmd(ref);
  const code = normalizeBillingInterval(interval);

  let n = 0;
  for (let guard = 0; guard < 5000; guard++) {
    const periodStart = addMonths(anchor, n * step);
    const nextStart = addMonths(anchor, (n + 1) * step);
    const periodEnd = new Date(nextStart);
    periodEnd.setDate(periodEnd.getDate() - 1);

    if (refD >= periodStart && refD <= periodEnd) {
      const label = `${formatYmd(periodStart)}_${code}`;
      return { start: formatYmd(periodStart), end: formatYmd(periodEnd), label };
    }
    if (refD < periodStart) {
      const label = `${formatYmd(periodStart)}_${code}`;
      return { start: formatYmd(periodStart), end: formatYmd(periodEnd), label };
    }
    n++;
  }

  return periodBoundsForInterval(interval, ref);
}

/** Resolve período: contrato com start_date usa aniversário; senão calendário. */
export function resolveInvoicePeriodBounds(
  interval: string,
  contractStart: string | Date | null | undefined,
  ref: Date = new Date()
): { start: string; end: string; label: string } {
  if (contractStart) {
    return periodBoundsFromContractStart(interval, contractStart, ref);
  }
  return periodBoundsForInterval(interval, ref);
}

/** Intervalos oferecidos pelo plano (preço > 0). */
export function getPlanAvailableIntervals(plan: PlanPriceRow | null | undefined): BillingIntervalCode[] {
  if (!plan) return [];
  return BILLING_INTERVAL_CODES.filter((code) => getPlanPriceForInterval(plan, code) != null);
}

export function resolveContractBillingInterval(
  plan: PlanPriceRow | null | undefined,
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
  const candidate = endDateYmd?.trim()
    ? String(endDateYmd).split('T')[0]
    : getDefaultContractEndDate(startDateYmd);
  return candidate < min ? min : candidate;
}

export function assertContractEndDateValid(
  startDateYmd: string,
  endDateYmd: string | null | undefined,
  billingInterval: string
): void {
  if (!endDateYmd?.trim()) return;
  const end = String(endDateYmd).split('T')[0];
  const min = getMinContractEndDate(startDateYmd, billingInterval);
  if (end < min) {
    throw new Error(
      `Data de término deve ser pelo menos ${min} (duração mínima: ${billingIntervalLabel(billingInterval)})`
    );
  }
}

export function validatePlanPriceConfiguration(
  plan: PlanPriceRow,
  referenceInterval?: string | null
): void {
  const available = getPlanAvailableIntervals(plan);
  if (available.length === 0) {
    throw new Error('Informe pelo menos um preço por intervalo de cobrança');
  }
  const ref = normalizeBillingInterval(referenceInterval ?? getPlanDefaultBillingInterval(plan));
  if (!available.includes(ref)) {
    throw new Error(
      `O intervalo de referência (${billingIntervalLabel(ref)}) precisa ter preço configurado`
    );
  }
}
