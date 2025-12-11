/**
 * Reports Service Tests - Smart Signage v2.1
 * Testes unitários para ReportsService
 */

import { ReportsService } from '../../services/reportsService';
import { getDatabase } from '../../config/database';
import { AIService } from '../../services/aiService';
import fs from 'fs';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do AIService
jest.mock('../../services/aiService', () => ({
  AIService: jest.fn(),
}));

// Mock do fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('ReportsService', () => {
  let reportsService: ReportsService;
  let mockDb: any;
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    mockAIService = {
      generateAnalysis: jest.fn().mockResolvedValue({ insights: [] }),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (AIService as jest.Mock).mockImplementation(() => mockAIService);
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    // Mock do AuditService
    (global as any).auditServiceInstance = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    reportsService = new ReportsService();
  });

  describe('generateReport', () => {
    it('deve gerar relatório com dados válidos', async () => {
      const mockReport = {
        id: 1,
        type: 'analytics',
        title: 'Relatório Teste',
        status: 'completed',
        format: 'pdf',
        createdAt: '2024-01-01',
      };

      mockDb.executeRaw
        .mockResolvedValueOnce({ lastInsertRowid: 1 }) // Criar registro
        .mockResolvedValueOnce({ rows: [] }) // Atualizar status para generating
        .mockResolvedValueOnce({ rows: [] }); // Atualizar status para completed

      mockDb.findFirst.mockResolvedValue(mockReport);

      // Mock dos métodos privados via spy
      const generateReportDataSpy = jest.spyOn(reportsService as any, 'generateReportData')
        .mockResolvedValue({
          recordCount: 100,
          generationTime: 1000,
          data: {},
        });
      
      const generateReportFileSpy = jest.spyOn(reportsService as any, 'generateReportFile')
        .mockResolvedValue({
          filePath: '/path/to/report.pdf',
          fileSize: 1024,
          downloadUrl: '/api/reports/1/download',
        });

      const result = await reportsService.generateReport(
        {
          type: 'analytics',
          title: 'Relatório Teste',
          filters: {
            format: 'pdf',
          },
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    });
  });

  describe('getReportById', () => {
    it('deve retornar relatório quando encontrado', async () => {
      const mockReport = {
        id: 1,
        type: 'analytics',
        title: 'Relatório Teste',
        status: 'completed',
      };

      mockDb.findFirst.mockResolvedValue(mockReport);

      const result = await reportsService.getReportById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('deve retornar null quando relatório não encontrado', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await reportsService.getReportById(999);

      expect(result).toBeNull();
    });
  });

  describe('getReports', () => {
    it('deve listar relatórios com paginação', async () => {
      const mockReports = [
        {
          id: 1,
          type: 'analytics',
          title: 'Relatório 1',
          status: 'completed',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockReports);
      mockDb.findFirst.mockResolvedValue({ total: 1 });

      const result = await reportsService.getReports(1, 20);

      expect(result.reports).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('deleteReport', () => {
    it('deve deletar relatório existente', async () => {
      const mockReport = {
        id: 1,
        filePath: '/path/to/report.pdf',
      };

      mockDb.findFirst.mockResolvedValue(mockReport);
      mockDb.executeRaw.mockResolvedValue({ rows: [] });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await reportsService.deleteReport(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM reports'),
        [1]
      );
    });
  });

  describe('incrementDownloadCount', () => {
    it('deve incrementar contador de downloads', async () => {
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await reportsService.incrementDownloadCount(1);

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE reports'),
        expect.arrayContaining([1])
      );
    });
  });

  describe('createReportTemplate', () => {
    it('deve criar template de relatório', async () => {
      const mockTemplate = {
        id: 1,
        name: 'Template Teste',
        type: 'analytics',
        isDefault: false,
        createdAt: '2024-01-01',
      };

      mockDb.findFirst.mockResolvedValue(null); // Template não existe
      mockDb.executeRaw.mockResolvedValue({ lastInsertRowid: 1 });
      mockDb.findFirst.mockResolvedValueOnce(mockTemplate);

      const result = await reportsService.createReportTemplate(
        {
          name: 'Template Teste',
          description: 'Descrição',
          type: 'analytics',
          templateConfig: {},
        },
        1
      );

      expect(result).toBeDefined();
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });
  });

  describe('getReportTemplates', () => {
    it('deve listar templates de relatório', async () => {
      const mockTemplates = [
        {
          id: 1,
          name: 'Template 1',
          type: 'analytics',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockTemplates);

      const result = await reportsService.getReportTemplates();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

