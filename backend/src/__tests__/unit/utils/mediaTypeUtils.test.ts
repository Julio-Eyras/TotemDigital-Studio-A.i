import {
  isVideoOrAudioMediaType,
  resolveLogicalMediaType,
} from '../../../utils/mediaTypeUtils';

describe('mediaTypeUtils', () => {
  describe('isVideoOrAudioMediaType', () => {
    it('reconhece tipos lógicos e MIME', () => {
      expect(isVideoOrAudioMediaType('video')).toBe(true);
      expect(isVideoOrAudioMediaType('audio')).toBe(true);
      expect(isVideoOrAudioMediaType('video/mp4')).toBe(true);
      expect(isVideoOrAudioMediaType('image')).toBe(false);
    });
  });

  describe('resolveLogicalMediaType', () => {
    it('prioriza extensão e MIME sobre media_type incorreto', () => {
      expect(
        resolveLogicalMediaType({
          mediaType: 'image',
          mimeType: 'video/mp4',
          filePath: '/uploads/promo.mp4',
        })
      ).toBe('video');
    });
  });
});
