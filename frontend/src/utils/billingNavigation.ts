/**
 * Sincronização URL ↔ abas da página de faturamento.
 */
export type BillingView = 'plans' | 'subscriptions' | 'invoices';

export const BILLING_VIEW_TABS: BillingView[] = ['plans', 'subscriptions', 'invoices'];

export function parseBillingView(searchParams: URLSearchParams): BillingView {
  const raw = searchParams.get('view');
  if (raw === 'subscriptions' || raw === 'invoices' || raw === 'plans') {
    return raw;
  }

  const type = searchParams.get('type');
  const hasDue = searchParams.has('dueFilter');
  const rawId = searchParams.get('subscriberId') ?? searchParams.get('subscriber_id');
  const hasSubId =
    rawId != null &&
    rawId !== '' &&
    Number.isFinite(parseInt(String(rawId), 10)) &&
    parseInt(String(rawId), 10) > 0;

  if (type === 'subscriber' || type === 'publisher' || hasDue || hasSubId) {
    return 'invoices';
  }

  return 'plans';
}

export function tabIndexFromBillingView(view: BillingView): number {
  if (view === 'subscriptions') return 1;
  if (view === 'invoices') return 2;
  return 0;
}

export function billingViewFromTabIndex(tab: number): BillingView {
  return BILLING_VIEW_TABS[tab] ?? 'plans';
}

export function shouldLoadBillingInvoices(
  searchParams: URLSearchParams,
  billingType: string
): boolean {
  return (
    parseBillingView(searchParams) === 'invoices' &&
    (billingType === 'subscriber' || billingType === 'publisher')
  );
}
