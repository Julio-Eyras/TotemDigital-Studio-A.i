/**
 * WebhookService Tests
 * Testes unitários para o serviço de webhooks
 */

import { WebhookService } from '../../services/webhookService';
import { getDatabase } from '../../config/database';

// Mock do database
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn()
}));

// Mock do axios
jest.mock('axios', () => ({
  default: {
    post: jest.fn()
  }
}));

describe('WebhookService', () => {
  let webhookService: WebhookService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      executeRaw: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
    };
    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    webhookService = new WebhookService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWebhook', () => {
    it('deve criar webhook com sucesso', async () => {
      const webhookData = {
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        channels: ['alerts'],
        events: ['test']
      };

      mockDb.executeRaw.mockResolvedValue({
        rows: [{
          id: 1,
          name: webhookData.name,
          url: webhookData.url,
          channels: JSON.stringify(webhookData.channels),
          events: JSON.stringify(webhookData.events),
          enabled: true,
          retry_count: 3,
          timeout_ms: 5000,
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await webhookService.createWebhook(webhookData);

      expect(result).toBeDefined();
      expect(result.name).toBe(webhookData.name);
      expect(result.url).toBe(webhookData.url);
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro se dados inválidos', async () => {
      const webhookData = {
        name: '',
        url: 'invalid-url',
        channels: [],
        events: []
      };

      mockDb.executeRaw.mockRejectedValue(new Error('Invalid data'));

      await expect(webhookService.createWebhook(webhookData)).rejects.toThrow();
    });
  });

  describe('getAllWebhooks', () => {
    it('deve listar webhooks sem filtros', async () => {
      mockDb.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Webhook 1',
          url: 'https://example.com/webhook1',
          channels: JSON.stringify(['alerts']),
          events: JSON.stringify(['test']),
          enabled: true,
          retry_count: 3,
          timeout_ms: 5000,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const result = await webhookService.getAllWebhooks();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(mockDb.findMany).toHaveBeenCalled();
    });

    it('deve filtrar webhooks por enabled', async () => {
      mockDb.findMany.mockResolvedValue([]);

      await webhookService.getAllWebhooks({ enabled: true });

      expect(mockDb.findMany).toHaveBeenCalled();
      const callArgs = mockDb.findMany.mock.calls[0][0];
      expect(callArgs).toContain('enabled = $1');
    });
  });

  describe('getWebhookById', () => {
    it('deve retornar webhook existente', async () => {
      mockDb.findFirst.mockResolvedValue({
        id: 1,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        channels: JSON.stringify(['alerts']),
        events: JSON.stringify(['test']),
        enabled: true,
        retry_count: 3,
        timeout_ms: 5000,
        created_at: new Date(),
        updated_at: new Date()
      });

      const result = await webhookService.getWebhookById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('deve retornar null se webhook não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await webhookService.getWebhookById(999);

      expect(result).toBeNull();
    });
  });
});

