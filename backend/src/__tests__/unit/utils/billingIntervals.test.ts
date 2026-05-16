import {
  getPlanPriceForInterval,
  getStripePriceIdForInterval,
  normalizeBillingInterval,
  periodBoundsFromContractStart,
  resolveInvoicePeriodBounds,
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
});
