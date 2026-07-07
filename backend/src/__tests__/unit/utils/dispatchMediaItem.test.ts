import { buildDispatchMediaItem, extractFileNameFromPath } from '../../../utils/dispatchMediaItem';

describe('dispatchMediaItem', () => {
  describe('extractFileNameFromPath', () => {
    it('extrai nome do ficheiro de caminhos Unix e Windows', () => {
      expect(extractFileNameFromPath('/uploads/subscriber/42/promo.mp4')).toBe('promo.mp4');
      expect(extractFileNameFromPath('C:\\media\\vinhetas\\abertura.webm')).toBe('abertura.webm');
    });
  });

  describe('buildDispatchMediaItem', () => {
    it('inclui mediaName e fileName no item de dispatch', () => {
      const item = buildDispatchMediaItem({
        mediaId: 10,
        order: 1,
        displaySeconds: 15,
        mediaType: 'image',
        filePath: '/uploads/subscriber/1/banner-principal.jpg',
        name: 'Banner Principal',
        fileName: 'banner-principal.jpg',
      });

      expect(item.mediaName).toBe('Banner Principal');
      expect(item.fileName).toBe('banner-principal.jpg');
      expect(item.mediaId).toBe(10);
      expect(item.order).toBe(1);
      expect(item.duration).toBe(15);
    });

    it('usa fileName da URL quando name não existe', () => {
      const item = buildDispatchMediaItem({
        mediaId: 11,
        order: 2,
        mediaType: 'video',
        durationSeconds: 30,
        filePath: '/uploads/subscriber/2/clip.mp4',
      });

      expect(item.mediaName).toBe('clip.mp4');
      expect(item.fileName).toBe('clip.mp4');
      expect(item.duration).toBeNull();
      expect(item.metadata?.durationSeconds).toBe(30);
    });

    it('infere vídeo por extensão mesmo com mediaType incorreto na playlist', () => {
      const item = buildDispatchMediaItem({
        mediaId: 12,
        order: 1,
        displaySeconds: 10,
        mediaType: 'image',
        mimeType: 'video/mp4',
        filePath: '/uploads/subscriber/3/promo.mp4',
      });

      expect(item.mediaType).toBe('video');
      expect(item.duration).toBeNull();
    });

    it('inclui contentVersion em metadata quando há dados de versão', () => {
      const item = buildDispatchMediaItem({
        mediaId: 13,
        order: 1,
        filePath: '/uploads/subscriber/1/banner.jpg',
        updatedAt: '2026-06-23T12:00:00.000Z',
        fileSizeBytes: 4096,
      });

      expect(item.metadata?.contentVersion).toBe(
        '2026-06-23T12:00:00.000Z|4096|/uploads/subscriber/1/banner.jpg|'
      );
    });
  });
});
