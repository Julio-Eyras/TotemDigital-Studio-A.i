import {
  assertContractEndDateValid,
  getDefaultContractEndDate,
  getMinContractEndDate,
  getPlanAvailableIntervals,
  getPlanPriceForInterval,
  getStripePriceIdForInterval,
  normalizeBillingInterval,
  periodBoundsFromContractStart,
  resolveContractBillingInterval,
  resolveInvoicePeriodBounds,
  resolvePublisherContractBillingInterval,
  validatePlanPriceConfiguration,
} from '../../../utils/billingIntervals';

describe('billingIntervals', () => {
  it('normaliza rótulos legados', () => {
    expect(normalizeBillingInterval('Quadrimestral')).toBe('four_month');
    expect(normalizeBillingInterval('anual')).toBe('year');
  });

  it('resolve preço por intervalo', () => {
    const plan = {
      price_monthly: 100,
      price_four_month: 380,
      price_semester: 550,
      price_yearly: 1000,
    };
    expect(getPlanPriceForInterval(plan, 'semester')).toBe(550);
    expect(getPlanPriceForInterval(plan, 'four_month')).toBe(380);
  });

  it('resolve stripe price id por intervalo', () => {
    const plan = {
      stripe_price_id_monthly: 'price_m',
      stripe_price_id_four_month: 'price_4m',
      stripe_price_id_semester: 'price_s',
      stripe_price_id_yearly: 'price_y',
    };
    expect(getStripePriceIdForInterval(plan, 'four_month')).toBe('price_4m');
    expect(getStripePriceIdForInterval(plan, 'year')).toBe('price_y');
  });

  it('calcula período ancorado no início do contrato', () => {
    const period = periodBoundsFromContractStart('month', '2026-03-15', new Date('2026-05-20'));
    expect(period.start).toBe('2026-05-15');
    expect(period.end).toBe('2026-06-14');
  });

  it('resolveInvoicePeriodBounds usa start_date quando informado', () => {
    const period = resolveInvoicePeriodBounds('month', '2026-01-10', new Date('2026-02-15'));
    expect(period.start).toBe('2026-02-10');
    expect(period.end).toBe('2026-03-09');
  });

  it('lista intervalos ativos do plano (preço > 0)', () => {
    const plan = { price_monthly: 100, price_four_month: 400 };
    expect(getPlanAvailableIntervals(plan)).toEqual(['month', 'four_month']);
  });

  it('resolve intervalo do contrato dentro dos ativos do plano', () => {
    const plan = {
      price_monthly: 100,
      price_four_month: 380,
      billing_interval: 'four_month',
    };
    expect(resolveContractBillingInterval(plan, 'year')).toBe('four_month');
    expect(resolveContractBillingInterval(plan)).toBe('four_month');
  });

  it('valida vigência mínima do contrato pelo intervalo', () => {
    expect(getMinContractEndDate('2026-05-16', 'four_month')).toBe('2026-09-16');
    expect(getDefaultContractEndDate('2026-05-16')).toBe('2027-05-16');
    expect(() =>
      assertContractEndDateValid('2026-05-16', '2026-06-01', 'four_month')
    ).toThrow();
    expect(() =>
      assertContractEndDateValid('2026-05-16', '2026-09-16', 'four_month')
    ).not.toThrow();
  });

  it('resolve intervalo de contrato da organização (billing_interval ou legado)', () => {
    expect(
      resolvePublisherContractBillingInterval({ subscription_interval: 'quadrimestral' })
    ).toBe('four_month');
    expect(resolvePublisherContractBillingInterval({ billing_interval: 'year' })).toBe('year');
  });

  it('exige ao menos um preço e referência com preço no plano', () => {
    expect(() =>
      validatePlanPriceConfiguration({ price_monthly: 0, price_four_month: 0 }, 'month')
    ).toThrow(/pelo menos um preço/i);
    expect(() =>
      validatePlanPriceConfiguration({ price_four_month: 500, billing_interval: 'month' }, 'month')
    ).toThrow(/referência/i);
    expect(() =>
      validatePlanPriceConfiguration({ price_four_month: 500, billing_interval: 'four_month' }, 'four_month')
    ).not.toThrow();
  });
});
