import { DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA } from './dispatchPlaylistDirectMix';

/** Item mínimo para intercalar / expandir ciclo de reprodução no mix. */
export interface MixPlaybackItem {
  media_id: number;
  campaign_id?: number;
  subscriber_id?: number;
  order_index?: number;
}

/**
 * N diretas : 1 playlist (mesma regra do dispatch de campanha).
 */
export function interleaveMixItemPools<T extends MixPlaybackItem>(
  directItems: T[],
  playlistItems: T[],
  ratio: number = DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA
): T[] {
  const n = Math.max(1, Math.floor(Number(ratio) || DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA));
  const playlistIds = new Set(playlistItems.map((i) => Number(i.media_id)));
  const directs = directItems.filter((i) => !playlistIds.has(Number(i.media_id)));

  if (directs.length === 0) return [...playlistItems];
  if (playlistItems.length === 0) return [...directs];

  const mixed: T[] = [];
  let directIdx = 0;
  let playlistIdx = 0;
  let directsSincePlaylist = 0;

  while (directIdx < directs.length || playlistIdx < playlistItems.length) {
    if (
      directIdx < directs.length &&
      (directsSincePlaylist < n || playlistIdx >= playlistItems.length)
    ) {
      mixed.push(directs[directIdx++]);
      directsSincePlaylist++;
      continue;
    }
    if (playlistIdx < playlistItems.length) {
      mixed.push(playlistItems[playlistIdx++]);
      directsSincePlaylist = 0;
      continue;
    }
    break;
  }

  return mixed;
}

/**
 * Monta lista de reprodução para o player (repetição permitida).
 * Com várias mídias: expande até ~3× para o ciclo não colapsar num plano curto.
 * Com uma única mídia distinta: **não** triplica — o player faz loop no índice;
 * triplicar forçava 3 teardowns ExoPlayer do mesmo ficheiro (flick a cada fim).
 */
export function expandMixItemsForPlaybackCycle<T extends MixPlaybackItem>(
  orderedItems: T[],
  maxItems: number
): T[] {
  if (!orderedItems.length) return [];
  const cap = Math.max(1, Math.min(maxItems || 50, 1000));
  const distinctIds = new Set(orderedItems.map((i) => Number(i.media_id)));
  if (distinctIds.size <= 1) {
    const src = orderedItems[0];
    return [{ ...src, order_index: 1 }];
  }

  const unique = orderedItems.length;
  const target = Math.min(cap, Math.max(unique, Math.min(unique * 3, cap)));

  const result: T[] = [];
  for (let i = 0; i < target; i++) {
    const src = orderedItems[i % unique];
    result.push({
      ...src,
      order_index: i + 1,
    });
  }
  return result;
}
