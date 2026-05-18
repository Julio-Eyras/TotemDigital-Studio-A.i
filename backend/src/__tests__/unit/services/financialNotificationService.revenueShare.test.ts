const findFirst = jest.fn();
const findMany = jest.fn();

jest.mock('../../../config/database', () => ({
  getDatabase: () => ({ findFirst, findMany }),
}));

jest.mock('../../../services/emailService', () => ({
  emailService: {
    sendEmail: jest.fn(),
  },
}));

import { FinancialNotificationService } from '../../../services/financialNotificationService';
import { emailService } from '../../../services/emailService';

const sendEmail = emailService.sendEmail as jest.Mock;

jest.mock('../../../utils/loggerHelper', () => ({
  logInfo: jest.fn(async () => undefined),
  logError: jest.fn(async () => undefined),
}));

describe('FinancialNotificationService.sendPublisherRevenueSharePayoutEmail', () => {
  beforeEach(() => {
    findFirst.mockReset();
    findMany.mockReset();
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({ success: true, messageId: '1' });
  });

  it('envia e-mail para repasse outgoing pending_payout', async () => {
    findFirst.mockResolvedValue({
      billing_id: 5,
      amount: 250,
      currency: 'BRL',
      due_date: '2026-06-01',
      invoice_number: 'REP-1',
      description: 'Repasse 30%',
      payment_status: 'pending_payout',
      direction: 'outgoing',
      billing_type: 'revenue_share',
      publisher_name: 'Exibidor A',
      publisher_email: 'pub@example.com',
    });

    const svc = new FinancialNotificationService();
    const result = await svc.sendPublisherRevenueSharePayoutEmail(5);

    expect(result.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'pub@example.com',
        subject: expect.stringContaining('Repasse exibidor'),
      })
    );
  });

  it('sendPublisherPaymentEmail delega outgoing para repasse', async () => {
    findFirst.mockResolvedValue({
      billing_id: 6,
      amount: 100,
      currency: 'BRL',
      due_date: '2026-06-01',
      invoice_number: 'REP-2',
      description: 'Repasse',
      payment_status: 'pending_payout',
      direction: 'outgoing',
      billing_type: 'revenue_share',
      publisher_name: 'Exibidor B',
      publisher_email: 'b@example.com',
    });

    const svc = new FinancialNotificationService();
    const result = await svc.sendPublisherPaymentEmail(6);

    expect(result.sent).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });
});
