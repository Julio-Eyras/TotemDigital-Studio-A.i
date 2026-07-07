import {
  DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA,
  DispatchConsolidatedRow,
  interleaveDirectAndPlaylistItems,
} from '../../../utils/dispatchPlaylistDirectMix';

function row(
  mediaId: number,
  source: 'playlist' | 'campaign',
  orderIndex = mediaId
): DispatchConsolidatedRow {
  return {
    media_id: mediaId,
    order_index: orderIndex,
    duration: 10,
    name: `${source}-${mediaId}`,
    file_name: `${mediaId}.mp4`,
    file_path: `/uploads/${mediaId}.mp4`,
    media_type: 'video',
    tags: [],
    width: null,
    height: null,
    mime_type: 'video/mp4',
    duration_seconds: 10,
    updated_at: null,
    file_size_bytes: null,
    source,
    source_priority: source === 'playlist' ? 0 : 1,
  };
}

describe('dispatchPlaylistDirectMix', () => {
  it('intercala N diretas : 1 playlist (ratio 3)', () => {
    const directs = [row(1, 'campaign'), row(2, 'campaign'), row(3, 'campaign'), row(4, 'campaign')];
    const playlists = [row(101, 'playlist'), row(102, 'playlist')];

    const mixed = interleaveDirectAndPlaylistItems(directs, playlists, 3);

    expect(mixed.map((i) => i.media_id)).toEqual([1, 2, 3, 101, 4, 102]);
  });

  it('usa default ratio alinhado ao player', () => {
    const directs = [row(1, 'campaign'), row(2, 'campaign'), row(3, 'campaign'), row(4, 'campaign')];
    const playlists = [row(101, 'playlist')];

    const mixed = interleaveDirectAndPlaylistItems(directs, playlists);

    expect(mixed.map((i) => i.media_id)).toEqual([1, 2, 3, 101, 4]);
    expect(DEFAULT_FALLBACK_PROPAGANDAS_PER_VINHETA).toBe(3);
  });

  it('retorna só diretas quando não há playlist', () => {
    const directs = [row(1, 'campaign'), row(2, 'campaign')];
    expect(interleaveDirectAndPlaylistItems(directs, [], 3).map((i) => i.media_id)).toEqual([1, 2]);
  });

  it('retorna só playlist quando não há diretas', () => {
    const playlists = [row(101, 'playlist'), row(102, 'playlist')];
    expect(interleaveDirectAndPlaylistItems([], playlists, 3).map((i) => i.media_id)).toEqual([101, 102]);
  });

  it('remove duplicata da pool direta quando media_id já está na playlist', () => {
    const shared = row(99, 'playlist');
    const directs = [row(1, 'campaign'), { ...row(99, 'campaign') }, row(2, 'campaign')];
    const playlists = [shared, row(100, 'playlist')];

    const mixed = interleaveDirectAndPlaylistItems(directs, playlists, 2);

    expect(mixed.map((i) => i.media_id)).toEqual([1, 2, 99, 100]);
  });
});
