/**
 * Storage Service Tests - Smart Signage v2.1
 */

const writeFileSync = jest.fn();
const appendFileSync = jest.fn();
const chmodSync = jest.fn();
const mkdirSync = jest.fn();
const existsSync = jest.fn();
const unlinkSync = jest.fn();
const renameSync = jest.fn();
const copyFileSync = jest.fn();
const statSync = jest.fn();
const readdirSync = jest.fn();
const readFileSync = jest.fn();
const rmSync = jest.fn();

jest.mock('fs', () => ({
  writeFileSync,
  appendFileSync,
  chmodSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  renameSync,
  copyFileSync,
  statSync,
  readdirSync,
  readFileSync,
  rmSync,
}));

import path from 'path';
import { StorageService } from '../../services/storageService';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UPLOAD_PATH = '/tmp/storage-tests';
    service = new StorageService();
  });

  describe('saveMediaFile', () => {
    it('deve salvar arquivo de mídia criando diretório e retornando caminho sanitizado', async () => {
      existsSync.mockReturnValue(false);

      const buffer = Buffer.from('teste');
      const filePath = await service.saveMediaFile({
        buffer,
        originalname: 'video.mp4',
        mimetype: 'video/mp4',
        size: 1024,
      }, 1, 'Video Demo');

      const expectedDir = path.join('/tmp/storage-tests', 'uploads', 'client-1', 'medias');
      const expectedFile = path.join(expectedDir, 'Video_Demo.mp4');

      expect(mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true });
      expect(chmodSync).toHaveBeenCalledWith(expectedDir, 0o755);
      expect(writeFileSync).toHaveBeenCalledWith(expectedFile, buffer);
      expect(chmodSync).toHaveBeenCalledWith(expectedFile, 0o644);
      expect(filePath).toBe(expectedFile);
    });
  });

  describe('deleteMediaFile', () => {
    it('deve remover arquivo de mídia e thumbnail associado', async () => {
      existsSync.mockImplementation((targetPath: string) => {
        if (targetPath.endsWith('_thumb.jpg')) {
          return true;
        }
        if (targetPath.endsWith('.mp4')) {
          return true;
        }
        return false;
      });

      await service.deleteMediaFile('/tmp/storage-tests/uploads/client-1/medias/video.mp4');

      expect(unlinkSync).toHaveBeenCalledWith('/tmp/storage-tests/uploads/client-1/medias/video.mp4');
      expect(unlinkSync).toHaveBeenCalledWith('/tmp/storage-tests/uploads/client-1/medias/video_thumb.jpg');
    });
  });

  describe('validate helpers', () => {
    it('deve validar tipo e tamanho de arquivo', () => {
      expect(service.validateFileType('image/png', ['image/png', 'image/jpeg'])).toBe(true);
      expect(service.validateFileType('video/mp4', ['image/png'])).toBe(false);

      expect(service.validateFileSize(500, 1000)).toBe(true);
      expect(service.validateFileSize(1500, 1000)).toBe(false);
    });
  });
});
