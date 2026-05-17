/**
 * Smoke: InvoiceService exporta geração alinhada aos intervalos.
 */
import { InvoiceService } from '../../../services/invoiceService';

describe('InvoiceService', () => {
  it('expõe generateSubscriptionInvoices e alias generateMonthlyInvoices', () => {
    const svc = new InvoiceService();
    expect(typeof svc.generateSubscriptionInvoices).toBe('function');
    expect(typeof svc.generateMonthlyInvoices).toBe('function');
    expect(typeof svc.sendInvoiceNotifications).toBe('function');
  });
});
