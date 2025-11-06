/**
 * Billing Service Tests - Smart Signage v2.1
 */

import { BillingService } from '../../services/billingService';
import { getDatabase } from '../../config/database';

const logMock = jest.fn().mockResolvedValue(undefined);

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/auditService', () => ({
  AuditService: jest.fn().mockImplementation(() => ({ log: logMock })),
}));

describe('BillingService', () => {
  let service: BillingService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    delete (global as any).auditServiceInstance;

    mockDb = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      executeRaw: jest.fn().mockResolvedValue({ rows: [] }),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    service = new BillingService();
  });

  describe('getBillings', () => {
    it('deve listar faturas com informações adicionais', async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      mockDb.findMany.mockResolvedValueOnce([
        {
          id: 1,
          clientId: 2,
          amount: 100,
          status: 'pending',
          dueDate: pastDate,
        },
      ]);
      mockDb.findFirst.mockResolvedValueOnce({ total: '1' });

      const result = await service.getBillings(1, 10);

      expect(result.total).toBe('1');
      expect(result.billings).toHaveLength(1);
      expect(result.billings[0]).toMatchObject({ isOverdue: true });
    });
  });

  describe('createBilling', () => {
    it('deve criar fatura e registrar auditoria', async () => {
      const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const createdBilling = {
        id: 10,
        clientId: 1,
        amount: 250,
        status: 'pending',
        dueDate,
      };

      mockDb.findFirst
        .mockResolvedValueOnce({ client_id: 1 }) // cliente
        .mockResolvedValueOnce({ campaign_id: 2 }) // campanha
        .mockResolvedValueOnce({ totem_id: 3 }) // totem
        .mockResolvedValueOnce(createdBilling); // getBillingById

      mockDb.executeRaw.mockResolvedValueOnce({ lastInsertRowid: 10 });

      const result = await service.createBilling({
        clientId: 1,
        campaignId: 2,
        totemId: 3,
        billingType: 'subscription',
        amount: 250,
        description: 'Mensalidade',
        dueDate,
      }, 99);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO billing'), expect.any(Array));
      expect(logMock).toHaveBeenCalledWith('billing', 'created', 99, expect.objectContaining({ billingId: 10 }));
      expect(result).toEqual(expect.objectContaining({ id: 10, amount: 250 }));
    });
  });

  describe('updateBilling', () => {
    it('deve atualizar fatura existente e registrar auditoria', async () => {
      const existingBilling = {
        id: 10,
        clientId: 1,
        amount: 250,
        status: 'pending',
        dueDate: new Date().toISOString(),
      };
      const updatedBilling = { ...existingBilling, status: 'paid' };

      mockDb.findFirst
        .mockResolvedValueOnce(existingBilling) // getBillingById
        .mockResolvedValueOnce(updatedBilling); // getBillingById após update

      const result = await service.updateBilling(10, { status: 'paid' }, 55);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('UPDATE billing'), expect.arrayContaining(['paid', 10]));
      expect(logMock).toHaveBeenCalledWith('billing', 'updated', 55, expect.objectContaining({ billingId: 10 }));
      expect(result.status).toBe('paid');
    });
  });

  describe('deleteBilling', () => {
    it('deve remover fatura pendente', async () => {
      mockDb.findFirst.mockResolvedValueOnce({
        id: 5,
        clientId: 1,
        amount: 100,
        status: 'pending',
        dueDate: new Date().toISOString(),
      });

      await service.deleteBilling(5, 77);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM billing'), [5]);
      expect(logMock).toHaveBeenCalledWith('billing', 'deleted', 77, expect.objectContaining({ billingId: 5 }));
    });
  });
});
