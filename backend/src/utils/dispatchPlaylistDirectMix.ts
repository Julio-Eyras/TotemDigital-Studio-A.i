/**
 * Alinhado ao player (`fallbackPropagandasPerVinheta`, default 3).
 * No dispatch de campanha: N mídias diretas : 1 item de playlist.
 */
export const DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA = 3;

export interface DispatchConsolidatedRow {
  media_id: number;
  order_index: number;
  duration: number | null;
  name: string | null;
  file_name: string | null;
  file_path: string | null;
  media_type: string | null;
  tags: unknown;
  width: number | null;
  height: number | null;
  mime_type: string | null;
  duration_seconds: number | null;
  source: 'playlist' | 'campaign';
  source_priority: number;
}

export function interleaveDirectAndPlaylistItems(
  directItems: DispatchConsolidatedRow[],
  playlistItems: DispatchConsolidatedRow[],
  ratio: number = DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA
): DispatchConsolidatedRow[] {
  const n = Math.max(1, Math.floor(Number(ratio) || DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA));

  const playlistMediaIds = new Set(playlistItems.map((item) => Number(item.media_id)));
  const directs = directItems.filter((item) => !playlistMediaIds.has(Number(item.media_id)));

  if (directs.length === 0) return [...playlistItems];
  if (playlistItems.length === 0) return [...directs];

  const mixed: DispatchConsolidatedRow[] = [];
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
