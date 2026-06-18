import {
  VINHETA_GLOBAL_TAG,
  VINHETA_TAG,
  hasVinhetaGlobalTag,
  hasVinhetaTag,
  mergeVinhetaTags,
  normalizeTagList,
} from '../../../utils/vinhetaTags';

describe('vinhetaTags', () => {
  describe('normalizeTagList', () => {
    it('normaliza array, string e valores vazios', () => {
      expect(normalizeTagList([' Vinheta ', 'PROMO'])).toEqual(['vinheta', 'promo']);
      expect(normalizeTagList('vinheta, vinheta_global')).toEqual(['vinheta', 'vinheta_global']);
      expect(normalizeTagList(null)).toEqual([]);
    });
  });

  describe('hasVinhetaTag / hasVinhetaGlobalTag', () => {
    it('detecta tags de vinheta', () => {
      expect(hasVinhetaTag(['promo', VINHETA_TAG])).toBe(true);
      expect(hasVinhetaGlobalTag([VINHETA_TAG, VINHETA_GLOBAL_TAG])).toBe(true);
      expect(hasVinhetaGlobalTag([VINHETA_TAG])).toBe(false);
    });
  });

  describe('mergeVinhetaTags', () => {
    it('garante vinheta e adiciona global quando solicitado', () => {
      expect(mergeVinhetaTags(['promo'], true)).toEqual(['promo', VINHETA_TAG, VINHETA_GLOBAL_TAG]);
    });

    it('remove global quando desmarcado', () => {
      expect(mergeVinhetaTags(['promo', VINHETA_TAG, VINHETA_GLOBAL_TAG], false)).toEqual([
        'promo',
        VINHETA_TAG,
      ]);
    });
  });
});
