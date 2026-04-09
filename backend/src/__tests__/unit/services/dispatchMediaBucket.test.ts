import { resolveDispatchCacheBucket } from '../../../services/dispatchMediaBucket';

describe('resolveDispatchCacheBucket', () => {
  it('deve retornar vinhetas quando tags contem vinheta', () => {
    expect(resolveDispatchCacheBucket({ tags: ['promo', 'vinheta'] })).toBe('vinhetas');
  });

  it('deve retornar vinhetas quando file_path aponta para pasta vinhetas', () => {
    expect(resolveDispatchCacheBucket({ file_path: '/assets/vinhetas/opening.mp4' })).toBe('vinhetas');
  });

  it('deve retornar propagandas por padrao', () => {
    expect(resolveDispatchCacheBucket({ tags: ['lancamento'] })).toBe('propagandas');
  });
});
