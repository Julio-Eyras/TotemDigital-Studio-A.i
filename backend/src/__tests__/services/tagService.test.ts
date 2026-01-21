/**
 * Tag Service Tests - Smart Signage v2.1
 * Testes unitários para o serviço de tags com suporte a metadata JSONB
 */

import { TagService, getTagService } from '../../services/tagService';
import { getDatabase } from '../../config/database';

// Mocks
jest.mock('../../config/database');
jest.mock('../../utils/loggerHelper', () => ({
  logInfo: jest.fn().mockResolvedValue(undefined),
  logError: jest.fn().mockResolvedValue(undefined),
  logDebug: jest.fn().mockResolvedValue(undefined),
}));

describe('TagService', () => {
  let tagService: TagService;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      executeRaw: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    tagService = getTagService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrUpdateTag', () => {
    it('deve criar uma nova tag com metadata', async () => {
      const request = {
        tagId: 'TAG001',
        tagType: 'rfid' as const,
        name: 'Tag de Teste',
        description: 'Descrição da tag',
        metadata: { category: 'produto', location: 'loja1' },
      };

      mockDb.findFirst.mockResolvedValue(null); // Tag não existe
      mockDb.executeRaw.mockResolvedValue({
        rows: [{
          id: 1,
          tag_id: 'TAG001',
          tag_type: 'rfid',
          name: 'Tag de Teste',
          description: 'Descrição da tag',
          content_id: null,
          metadata: JSON.stringify({ category: 'produto', location: 'loja1' }),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await tagService.createOrUpdateTag(request);

      expect(result.tagId).toBe('TAG001');
      expect(result.tagType).toBe('rfid');
      expect(result.name).toBe('Tag de Teste');
      expect(result.metadata).toEqual({ category: 'produto', location: 'loja1' });
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tags'),
        expect.arrayContaining([
          'TAG001',
          'rfid',
          'Tag de Teste',
          'Descrição da tag',
          null,
          JSON.stringify({ category: 'produto', location: 'loja1' }),
        ])
      );
    });

    it('deve atualizar uma tag existente', async () => {
      const request = {
        tagId: 'TAG001',
        tagType: 'nfc' as const,
        name: 'Tag Atualizada',
        metadata: { category: 'promocao' },
      };

      mockDb.findFirst.mockResolvedValue({
        id: 1,
        tag_id: 'TAG001',
        tag_type: 'rfid',
        name: 'Tag Original',
      });

      mockDb.executeRaw.mockResolvedValue({
        rows: [{
          id: 1,
          tag_id: 'TAG001',
          tag_type: 'nfc',
          name: 'Tag Atualizada',
          description: null,
          content_id: null,
          metadata: JSON.stringify({ category: 'promocao' }),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await tagService.createOrUpdateTag(request);

      expect(result.tagId).toBe('TAG001');
      expect(result.tagType).toBe('nfc');
      expect(result.name).toBe('Tag Atualizada');
      expect(result.metadata).toEqual({ category: 'promocao' });
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tags'),
        expect.arrayContaining([
          'nfc',
          'Tag Atualizada',
          null,
          null,
          JSON.stringify({ category: 'promocao' }),
          'TAG001',
        ])
      );
    });

    it('deve usar metadata vazio se não fornecido', async () => {
      const request = {
        tagId: 'TAG002',
        tagType: 'qr_code' as const,
      };

      mockDb.findFirst.mockResolvedValue(null);
      mockDb.executeRaw.mockResolvedValue({
        rows: [{
          id: 2,
          tag_id: 'TAG002',
          tag_type: 'qr_code',
          name: null,
          description: null,
          content_id: null,
          metadata: '{}',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      const result = await tagService.createOrUpdateTag(request);

      expect(result.tagId).toBe('TAG002');
      expect(result.metadata).toBeUndefined(); // metadata vazio não deve ser retornado
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['{}'])
      );
    });
  });

  describe('getContentForTag', () => {
    it('deve retornar conteúdo da tag quando encontrada', async () => {
      const tagId = 'TAG001';
      const mockTag = {
        id: 1,
        tag_id: 'TAG001',
        tag_type: 'rfid',
        name: 'Tag Teste',
        content_id: 123,
        metadata: JSON.stringify({ category: 'produto' }),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.findFirst.mockResolvedValue(mockTag);

      const result = await tagService.getContentForTag(tagId);

      expect(result.contentId).toBe(123);
      expect(result.tag).not.toBeNull();
      expect(result.tag?.tagId).toBe('TAG001');
      expect(result.tag?.metadata).toEqual({ category: 'produto' });
    });

    it('deve retornar null quando tag não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await tagService.getContentForTag('INVALID');

      expect(result.contentId).toBeNull();
      expect(result.tag).toBeNull();
    });

    it('deve retornar null quando tag está inativa', async () => {
      mockDb.findFirst.mockResolvedValue(null); // WHERE is_active = true não encontra

      const result = await tagService.getContentForTag('INACTIVE');

      expect(result.contentId).toBeNull();
      expect(result.tag).toBeNull();
    });
  });

  describe('getAllTags', () => {
    it('deve listar todas as tags', async () => {
      const mockTags = [
        {
          id: 1,
          tag_id: 'TAG001',
          tag_type: 'rfid',
          name: 'Tag 1',
          metadata: JSON.stringify({ category: 'produto' }),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          tag_id: 'TAG002',
          tag_type: 'nfc',
          name: 'Tag 2',
          metadata: '{}',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.findMany.mockResolvedValue(mockTags);

      const result = await tagService.getAllTags();

      expect(result).toHaveLength(2);
      expect(result[0].tagId).toBe('TAG001');
      expect(result[0].metadata).toEqual({ category: 'produto' });
      expect(result[1].tagId).toBe('TAG002');
      expect(result[1].metadata).toBeUndefined();
    });

    it('deve filtrar por tipo de tag', async () => {
      mockDb.findMany.mockResolvedValue([]);

      await tagService.getAllTags({ tagType: 'rfid' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('tag_type'),
        ['rfid']
      );
    });

    it('deve filtrar por status ativo', async () => {
      mockDb.findMany.mockResolvedValue([]);

      await tagService.getAllTags({ isActive: true });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        [true]
      );
    });

    it('deve limitar resultados', async () => {
      mockDb.findMany.mockResolvedValue([]);

      await tagService.getAllTags({ limit: 10 });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        [10]
      );
    });
  });

  describe('deactivateTag', () => {
    it('deve desativar uma tag', async () => {
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await tagService.deactivateTag('TAG001');

      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tags'),
        expect.arrayContaining(['TAG001'])
      );
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('is_active = false'),
        ['TAG001']
      );
    });
  });

  describe('mapToTag', () => {
    it('deve parsear metadata quando for string JSON', async () => {
      const mockTag = {
        id: 1,
        tag_id: 'TAG001',
        tag_type: 'rfid',
        name: 'Tag Teste',
        metadata: JSON.stringify({ category: 'produto', price: 99.99 }),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.findFirst.mockResolvedValue(mockTag);

      const result = await tagService.getContentForTag('TAG001');

      expect(result.tag?.metadata).toEqual({ category: 'produto', price: 99.99 });
    });

    it('deve usar metadata quando já for objeto', async () => {
      const mockTag = {
        id: 1,
        tag_id: 'TAG001',
        tag_type: 'rfid',
        name: 'Tag Teste',
        metadata: { category: 'produto' },
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.findFirst.mockResolvedValue(mockTag);

      const result = await tagService.getContentForTag('TAG001');

      expect(result.tag?.metadata).toEqual({ category: 'produto' });
    });

    it('deve retornar undefined quando metadata está vazio', async () => {
      const mockTag = {
        id: 1,
        tag_id: 'TAG001',
        tag_type: 'rfid',
        name: 'Tag Teste',
        metadata: '{}',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.findFirst.mockResolvedValue(mockTag);

      const result = await tagService.getContentForTag('TAG001');

      expect(result.tag?.metadata).toBeUndefined();
    });
  });
});
