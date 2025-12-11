/**
 * AI Service Tests - Smart Signage v2.1
 */

import axios from 'axios';
import { AIService } from '../../services/aiService';
import { getDatabase } from '../../config/database';

const logMock = jest.fn().mockResolvedValue(undefined);

jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

jest.mock('../../services/auditService', () => ({
  AuditService: jest.fn().mockImplementation(() => ({ log: logMock })),
}));

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AIService', () => {
  let service: AIService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    delete (global as any).auditServiceInstance;

    mockDb = {
      executeRaw: jest.fn().mockResolvedValue(undefined),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
  });

  describe('processRequest', () => {
    it('deve processar requisição via Ollama e salvar histórico', async () => {
      process.env.AI_PROVIDER = 'ollama';
      process.env.OLLAMA_BASE_URL = 'http://ollama.local';
      process.env.AI_ENABLED = 'true';

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: 'Olá!',
          model: 'llama2',
          created_at: new Date().toISOString(),
        },
      });

      service = new AIService();

      const result = await service.processRequest({ prompt: 'Olá, IA!' }, 7);

      expect(mockedAxios.post).toHaveBeenCalledWith('http://ollama.local/api/generate', expect.objectContaining({ model: 'llama2' }));
      expect(mockDb.executeRaw).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_requests'), expect.any(Array));
      expect(result.response).toBe('Olá!');
      expect(result.provider).toBe('ollama');
    });

    it('deve lançar erro quando serviço de IA estiver desabilitado', async () => {
      process.env.AI_PROVIDER = 'ollama';
      process.env.AI_ENABLED = 'false';

      service = new AIService();

      await expect(service.processRequest({ prompt: 'Teste' }, 1)).rejects.toThrow('Serviço de IA desabilitado');
    });
  });

  describe('getAIRequests', () => {
    it('deve listar requisições com paginação e filtros', async () => {
      mockDb.findMany.mockResolvedValueOnce([
        {
          id: 'req-1',
          prompt: 'Pergunta?',
          response: 'Resposta.',
          model: 'llama2',
          provider: 'ollama',
          tokensUsed: 120,
          cost: 0.05,
          processingTime: 500,
          timestamp: '2024-01-01T10:00:00Z',
          metadata: null,
        },
      ]);
      mockDb.findFirst.mockResolvedValueOnce({ total: '1' });

      service = new AIService();

      const result = await service.getAIRequests(1, 20, { provider: 'ollama' });

      expect(mockDb.findMany).toHaveBeenCalledWith(expect.stringContaining('provider = ?'), expect.arrayContaining(['ollama', 20, 0]));
      expect(result.requests).toHaveLength(1);
      expect(result.total).toBe('1');
    });
  });

  describe('getAIUsageStats', () => {
    it('deve calcular estatísticas de uso', async () => {
      mockDb.findFirst
        .mockResolvedValueOnce({ total: 5 }) // totalRequests
        .mockResolvedValueOnce({ total: 500 }) // totalTokens
        .mockResolvedValueOnce({ total: 12.5 }) // totalCost
        .mockResolvedValueOnce({ requests: 3, tokens: 300, cost: 7.5 }); // recentActivity

      mockDb.findMany
        .mockResolvedValueOnce([{ provider: 'ollama', requests: 3, tokens: 300, cost: 7.5 }])
        .mockResolvedValueOnce([{ model: 'llama2', requests: 4, tokens: 400, cost: 10 }]);

      service = new AIService();

      const stats = await service.getAIUsageStats();

      expect(stats.totalRequests).toBe(5);
      expect(stats.totalTokens).toBe(500);
      expect(stats.totalCost).toBe(12.5);
      expect(stats.byProvider[0]).toMatchObject({ provider: 'ollama' });
      expect(stats.byModel[0]).toMatchObject({ model: 'llama2' });
    });
  });
});
