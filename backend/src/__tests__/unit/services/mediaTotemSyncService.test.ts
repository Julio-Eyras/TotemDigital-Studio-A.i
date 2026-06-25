import { buildMediaContentVersion } from '../../../services/mediaTotemSyncService';

describe('mediaTotemSyncService', () => {
  describe('buildMediaContentVersion', () => {
    it('combina updatedAt, tamanho, caminho e CRC para versionar conteúdo', () => {
      const version = buildMediaContentVersion({
        updatedAt: '2026-06-23T12:00:00.000Z',
        fileSizeBytes: 1024,
        filePath: '/uploads/subscriber/1/promo.mp4',
        fileCrc: 'abc123',
      });

      expect(version).toBe(
        '2026-06-23T12:00:00.000Z|1024|/uploads/subscriber/1/promo.mp4|abc123'
      );
    });

    it('usa strings vazias quando campos não existem', () => {
      expect(buildMediaContentVersion({})).toBe('|||');
    });
  });
});
