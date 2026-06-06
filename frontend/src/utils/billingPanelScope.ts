import type { BillingView } from './billingNavigation';

export type BillingPanelScope = 'overview' | 'subscriber-invoices' | 'publisher-invoices';

export function resolveBillingPanelScope(
  billingView: BillingView,
  billingType: string
): BillingPanelScope {
  if (billingView === 'invoices' && billingType === 'subscriber') {
    return 'subscriber-invoices';
  }
  if (billingView === 'invoices' && billingType === 'publisher') {
    return 'publisher-invoices';
  }
  return 'overview';
}
