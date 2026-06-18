import { DispatchPlan } from '../../../types/dispatcherTotem.types';
import {
  appendGlobalVinhetasToDispatchPlan,
  GlobalVinhetaRow,
} from '../../../services/dispatchVinhetaEnrichment';
import { VINHETA_GLOBAL_TAG, VINHETA_TAG } from '../../../utils/vinhetaTags';

function basePlan(): DispatchPlan {
  return {
    totemId: 1,
    timestamp: new Date('2026-06-15T12:00:00Z'),
    playlistId: 10,
    playlistName: 'Campanha A',
    mediaItems: [
      {
        mediaId: 100,
        order: 1,
        duration: 15,
        mediaType: 'image',
        url: '/uploads/subscriber/1/banner.jpg',
        mediaName: 'Banner',
        fileName: 'banner.jpg',
        cacheBucket: 'propagandas',
      },
    ],
    totalDuration: 15,
    priority: 1,
    source: 'campaign',
    sourceId: 5,
    sourceName: 'Campanha A',
    validityStart: new Date('2026-06-15T00:00:00Z'),
    validityEnd: new Date('2026-06-16T00:00:00Z'),
    metadata: {},
  };
}

const globalRow = (overrides: Partial<GlobalVinhetaRow> = {}): GlobalVinhetaRow => ({
  media_id: 200,
  name: 'Abertura',
  file_name: 'abertura.mp4',
  file_path: '/uploads/subscriber/1/vinhetas/abertura.mp4',
  media_type: 'video',
  mime_type: 'video/mp4',
  duration_seconds: 8,
  width: 1920,
  height: 1080,
  tags: [VINHETA_TAG, VINHETA_GLOBAL_TAG],
  ...overrides,
});

describe('dispatchVinhetaEnrichment', () => {
  describe('appendGlobalVinhetasToDispatchPlan', () => {
    it('anexa vinhetas globais com cacheBucket vinhetas', () => {
      const enriched = appendGlobalVinhetasToDispatchPlan(basePlan(), [globalRow()]);
      expect(enriched.mediaItems).toHaveLength(2);
      const vinheta = enriched.mediaItems[1];
      expect(vinheta.mediaId).toBe(200);
      expect(vinheta.cacheBucket).toBe('vinhetas');
      expect(enriched.metadata?.globalVinhetasAppended).toBe(1);
    });

    it('não duplica media_id já presente no plano', () => {
      const plan = basePlan();
      plan.mediaItems.push({
        ...plan.mediaItems[0],
        mediaId: 200,
        cacheBucket: 'propagandas',
      });
      const enriched = appendGlobalVinhetasToDispatchPlan(plan, [globalRow()]);
      expect(enriched.mediaItems.filter((i) => i.mediaId === 200)).toHaveLength(1);
      expect(enriched.metadata?.globalVinhetasAppended).toBeUndefined();
    });

    it('retorna plano inalterado quando não há vinhetas', () => {
      const plan = basePlan();
      const enriched = appendGlobalVinhetasToDispatchPlan(plan, []);
      expect(enriched).toBe(plan);
    });
  });
});
