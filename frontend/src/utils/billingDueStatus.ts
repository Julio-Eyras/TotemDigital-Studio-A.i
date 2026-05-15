/**
 * Semáforo visual para faturas e contratos (vencido / a vencer / ok).
 */

export type DueAlertLevel = 'error' | 'warning' | 'success' | 'neutral';

export interface InvoiceDueInput {
  status?: string;
  payment_status?: string;
  due_date?: string | null;
  is_overdue?: boolean;
  is_due_soon?: boolean;
  days_overdue?: number;
  days_until_due?: number | null;
}

const PAID_STATUSES = new Set(['paid', 'refunded', 'cancelled']);

function parseDay(raw?: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getInvoiceDueAlertLevel(
  invoice: InvoiceDueInput,
  dueSoonDays = 30
): DueAlertLevel {
  const status = String(invoice.payment_status || invoice.status || '').toLowerCase();
  if (PAID_STATUSES.has(status)) return 'success';
  if (status === 'cancelled') return 'neutral';

  if (invoice.is_overdue || status === 'overdue') return 'error';

  const due = parseDay(invoice.due_date);
  if (due) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(12, 0, 0, 0);
    const diffMs = dueDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return 'error';
    if (diffDays <= dueSoonDays) return 'warning';
    return 'neutral';
  }

  if (invoice.is_due_soon) return 'warning';
  return 'neutral';
}

export function getInvoiceDueLabel(invoice: InvoiceDueInput, dueSoonDays = 30): string | null {
  const level = getInvoiceDueAlertLevel(invoice, dueSoonDays);
  if (level === 'error') {
    const days = invoice.days_overdue;
    return days && days > 0 ? `Vencida há ${days} dia(s)` : 'Vencida';
  }
  if (level === 'warning') {
    const days = invoice.days_until_due;
    if (days != null && days >= 0) return `Vence em ${days} dia(s)`;
    return `Vence em até ${dueSoonDays} dias`;
  }
  return null;
}

export function invoiceRowSx(level: DueAlertLevel): Record<string, unknown> | undefined {
  if (level === 'error') {
    return { bgcolor: 'error.light', '&:hover': { bgcolor: 'error.light' }, opacity: 0.95 };
  }
  if (level === 'warning') {
    return { bgcolor: 'warning.light', '&:hover': { bgcolor: 'warning.light' }, opacity: 0.95 };
  }
  return undefined;
}

export function contractEndAlertLevel(
  endDate?: string | null,
  status?: string,
  dueSoonDays = 30
): DueAlertLevel {
  const st = String(status || '').toLowerCase();
  if (['expired', 'terminated', 'cancelled'].includes(st)) return 'error';

  const end = parseDay(endDate);
  if (!end) return 'neutral';

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(12, 0, 0, 0);
  const diffDays = Math.round((endDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return 'error';
  if (diffDays <= dueSoonDays) return 'warning';
  return 'success';
}
