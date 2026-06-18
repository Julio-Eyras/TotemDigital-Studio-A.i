import {
  expandMixItemsForPlaybackCycle,
  interleaveMixItemPools,
} from '../../../utils/mixPlaybackCycle';

describe('mixPlaybackCycle', () => {
  it('intercala pools diretas e playlist no mix', () => {
    const directs = [{ media_id: 1 }, { media_id: 2 }, { media_id: 3 }];
    const playlists = [{ media_id: 101 }, { media_id: 102 }];
    expect(interleaveMixItemPools(directs, playlists, 3).map((i) => i.media_id)).toEqual([
      1, 2, 3, 101, 102,
    ]);
  });

  it('expande ciclo de reprodução sem colapsar em 1 item', () => {
    const items = [
      { media_id: 10, campaign_id: 1 },
      { media_id: 20, campaign_id: 2 },
    ];
    const expanded = expandMixItemsForPlaybackCycle(items, 6);
    expect(expanded).toHaveLength(6);
    expect(expanded.map((i) => i.media_id)).toEqual([10, 20, 10, 20, 10, 20]);
  });
});
