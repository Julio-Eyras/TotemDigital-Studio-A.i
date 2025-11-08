/**
 * Media Service Tests - Smart Signage v2.1
 * Testes unitários para MediaService
 */

import { MediaService } from '../../services/mediaService';
import { getDatabase } from '../../config/database';
import { StorageService } from '../../services/storageService';
import sharp from 'sharp';
import fs from 'fs';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do StorageService
jest.mock('../../services/storageService', () => ({
  StorageService: jest.fn(),
}));

// Mock do sharp
jest.mock('sharp', () => {
  return jest.fn(() => ({
    metadata: jest.fn().mockResolvedValue({ width: 1920, height: 1080 }),
    resize: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({}),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
  }));
});

// Mock do fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

describe('MediaService', () => {
  let mediaService: MediaService;
  let mockDb: any;
  let mockStorageService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
    };

    mockStorageService = {
      saveFile: jest.fn().mockResolvedValue('/path/to/file'),
      deleteFile: jest.fn().mockResolvedValue(true),
      deleteMediaFile: jest.fn().mockResolvedValue(true),
      getFileUrl: jest.fn().mockReturnValue('http://example.com/file'),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);
    (StorageService as jest.Mock).mockImplementation(() => mockStorageService);

    // Mock do AuditService
    (global as any).auditServiceInstance = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mediaService = new MediaService();
  });

  describe('getMedia', () => {
    it('deve listar mídia com paginação', async () => {
      const mockMedia = [
        {
          id: 1,
          name: 'media1.jpg',
          title: 'Media 1',
          mediaType: 'image',
          status: 'published',
          sizeBytes: 1024,
          createdAt: '2024-01-01',
          filePath: '/opt/smart-signage/public/assets/media1.jpg',
          tags: '[]',
        },
      ];

      mockDb.findMany.mockResolvedValue(mockMedia);
      mockDb.findFirst.mockResolvedValue({ total: 1 });

      const result = await mediaService.getMedia(1, 20);

      expect(result.media).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve filtrar mídia por tipo', async () => {
      mockDb.findMany.mockResolvedValue([]);
      mockDb.findFirst.mockResolvedValue({ total: 0 });

      await mediaService.getMedia(1, 20, { mediaType: 'image' });

      expect(mockDb.findMany).toHaveBeenCalledWith(
        expect.stringContaining('media_type ='),
        expect.arrayContaining(['image'])
      );
    });
  });

  describe('getMediaById', () => {
    it('deve retornar mídia quando encontrada', async () => {
      const mockMedia = {
        id: 1,
        name: 'media1.jpg',
        title: 'Media 1',
        mediaType: 'image',
        status: 'published',
        filePath: '/path/to/file.jpg',
        sizeBytes: 1024,
        tags: '[]',
      };

      mockDb.findFirst.mockResolvedValue(mockMedia);

      const result = await mediaService.getMediaById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.downloadUrl).toBeDefined();
    });

    it('deve retornar null quando mídia não encontrada', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await mediaService.getMediaById(999);

      expect(result).toBeNull();
    });
  });

  describe('updateMedia', () => {
    it('deve atualizar mídia existente', async () => {
      const mockMedia = {
        id: 1,
        name: 'media1.jpg',
        title: 'Media Atualizada',
        mediaType: 'image',
        status: 'published',
        filePath: '/opt/smart-signage/public/assets/media1.jpg',
        tags: [],
      } as any;

      jest.spyOn(mediaService, 'getMediaById')
        .mockResolvedValueOnce({ ...mockMedia })
        .mockResolvedValueOnce({ ...mockMedia });

      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await mediaService.updateMedia(1, {
        title: 'Media Atualizada',
      }, 1);

      expect(result).toMatchObject({ id: 1, title: 'Media Atualizada' });
      expect(mockDb.executeRaw).toHaveBeenCalled();
    });

    it('deve lançar erro quando mídia não existe', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      await expect(
        mediaService.updateMedia(999, { title: 'Teste' }, 1)
      ).rejects.toThrow();
    });
  });

  describe('deleteMedia', () => {
    it('deve deletar mídia existente', async () => {
      jest.spyOn(mediaService, 'getMediaById').mockResolvedValue({
        id: 1,
        filePath: '/opt/smart-signage/public/assets/media1.jpg',
        mediaType: 'image',
        tags: [],
      } as any);

      mockDb.findFirst.mockResolvedValue({ count: 0 });
      mockDb.executeRaw.mockResolvedValue({ rows: [] });
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await mediaService.deleteMedia(1, 1);

      expect(mockDb.executeRaw).toHaveBeenCalled();
      expect(mockStorageService.deleteMediaFile).toHaveBeenCalled();
    });
  });

  describe('processMediaById', () => {
    it('deve processar mídia (imagem)', async () => {
      const mockMedia = {
        id: 1,
        name: 'image.jpg',
        mediaType: 'image',
        filePath: '/path/to/image.jpg',
        mimeType: 'image/jpeg',
      };

      mockDb.findFirst.mockResolvedValue(mockMedia);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test'));
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await mediaService.processMediaById(1, {
        generateThumbnail: true,
        optimize: true,
      });

      expect(result).toBeDefined();
      expect(sharp).toHaveBeenCalled();
    });
  });

  describe('getThumbnail', () => {
    it('deve retornar URL do thumbnail quando existe', async () => {
      const mockMedia = {
        id: 1,
        filePath: '/path/to/image.jpg',
        mediaType: 'image',
      };

      mockDb.findFirst.mockResolvedValue(mockMedia);
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await mediaService.getThumbnail(1);

      expect(result).toBeDefined();
    });

    it('deve retornar null quando thumbnail não existe', async () => {
      mockDb.findFirst.mockResolvedValue({
        id: 1,
        filePath: '/path/to/image.jpg',
      });
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await mediaService.getThumbnail(1);

      expect(result).toBeNull();
    });
  });
});

