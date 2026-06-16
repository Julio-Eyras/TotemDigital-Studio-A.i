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
    });
  });
});
