import {
  buildContractEndDate,
  getPlanAvailableIntervals,
  getStripePriceFieldsForPlan,
  getMinContractEndDate,
  normalizeBillingInterval,
  resolveContractBillingInterval,
  validatePlanPriceConfiguration,
} from './billingIntervals';

describe('billingIntervals (frontend)', () => {
  it('normaliza rótulos de intervalo', () => {
    expect(normalizeBillingInterval('Quadrimestral')).toBe('four_month');
    expect(normalizeBillingInterval('anual')).toBe('year');
  });

  it('lista intervalos com preço no plano', () => {
    const plan = { priceMonthly: 100, priceFourMonth: 400 };
    expect(getPlanAvailableIntervals(plan)).toEqual(['month', 'four_month']);
  });

  it('expõe campos Stripe só para intervalos com preço', () => {
    const fields = getStripePriceFieldsForPlan({
      priceMonthly: 50,
      priceYearly: 500,
      stripePriceIdMonthly: 'pm',
      stripePriceIdYearly: 'py',
    });
    expect(fields.map((f) => f.field)).toEqual(['stripePriceIdMonthly', 'stripePriceIdYearly']);
  });

  it('resolve intervalo do contrato dentro dos ativos do plano', () => {
    const plan = { price_monthly: 100, price_four_month: 380, billing_interval: 'four_month' };
    expect(resolveContractBillingInterval(plan, 'year')).toBe('four_month');
  });

  it('valida configuração mínima do plano', () => {
    expect(validatePlanPriceConfiguration({ price_monthly: 100 }, 'month').ok).toBe(true);
    expect(validatePlanPriceConfiguration({ price_monthly: 0 }, 'month').ok).toBe(false);
  });

  it('buildContractEndDate respeita mínimo do intervalo', () => {
    const start = '2026-01-15';
    expect(buildContractEndDate(start, 'month') >= getMinContractEndDate(start, 'month')).toBe(true);
    expect(buildContractEndDate(start, 'year') >= getMinContractEndDate(start, 'year')).toBe(true);
  });
});
