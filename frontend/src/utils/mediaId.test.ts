import { normalizeMediaItem, resolveMediaId, sanitizeMediaIdList } from './mediaId';

describe('mediaId utils', () => {
  it('resolveMediaId aceita id ou media_id', () => {
    expect(resolveMediaId({ id: 12 })).toBe(12);
    expect(resolveMediaId({ media_id: 7 })).toBe(7);
    expect(resolveMediaId({})).toBeNull();
  });

  it('sanitizeMediaIdList remove null, NaN e duplicados', () => {
    expect(sanitizeMediaIdList([12, null, undefined, NaN, 12, 0])).toEqual([12]);
  });

  it('normalizeMediaItem unifica id e media_id', () => {
    const item = normalizeMediaItem({ id: 5, name: 'test', mediaType: 'image' });
    expect(item.media_id).toBe(5);
    expect(item.id).toBe(5);
    expect(item.media_type).toBe('image');
  });
});
