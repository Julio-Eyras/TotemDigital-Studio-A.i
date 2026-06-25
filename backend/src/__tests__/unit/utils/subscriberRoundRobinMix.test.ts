import {
  expandMixItemsForPlaybackCycle,
  interleaveMixItemPools,
} from '../../../utils/mixPlaybackCycle';
import {
  interleaveSubscriberRoundRobin,
  SubscriberMixItem,
} from '../../../utils/subscriberRoundRobinMix';

describe('subscriberRoundRobinMix', () => {
  it('intercala filas de anunciantes em round-robin', () => {
    const pools = new Map<number, SubscriberMixItem[]>([
      [3, [{ media_id: 1, subscriber_id: 3 }, { media_id: 2, subscriber_id: 3 }, { media_id: 3, subscriber_id: 3 }]],
      [5, [{ media_id: 11, subscriber_id: 5 }, { media_id: 12, subscriber_id: 5 }]],
      [7, [{ media_id: 21, subscriber_id: 7 }]],
    ]);

    expect(interleaveSubscriberRoundRobin(pools).map((i) => i.media_id)).toEqual([
      1, 11, 21, 2, 12, 3,
    ]);
  });

  it('expande ciclo após round-robin multi-anunciante', () => {
    const pools = new Map<number, SubscriberMixItem[]>([
      [1, [{ media_id: 10, subscriber_id: 1 }]],
      [2, [{ media_id: 20, subscriber_id: 2 }]],
    ]);
    const base = interleaveSubscriberRoundRobin(pools);
    const expanded = expandMixItemsForPlaybackCycle(base, 6);
    expect(expanded.map((i) => i.media_id)).toEqual([10, 20, 10, 20, 10, 20]);
  });

  it('mantém interleaveMixItemPools para diretas vs playlist na campanha', () => {
    const directs = [{ media_id: 1 }, { media_id: 2 }, { media_id: 3 }];
    const playlists = [{ media_id: 101 }];
    expect(interleaveMixItemPools(directs, playlists, 3).map((i) => i.media_id)).toEqual([1, 2, 3, 101]);
  });
});
