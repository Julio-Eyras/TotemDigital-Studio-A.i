export interface OverdueBillingItem {
  billingId: number;
  description: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  daysOverdue: number;
}

export interface OverdueBillingSummary {
  count: number;
  totalAmount: number;
  currency: string;
  graceDays: number;
  maxDaysOverdue: number;
  items: OverdueBillingItem[];
}
