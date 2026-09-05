/**
 * SPRINT-3 - Unit Tests — Dispatcher Versioning & Dedup
 *
 * Escopo:
 *   1. computeDispatchVersionHash — estabilidade / colisão, (S1–S5)
 *   2. DispatchDedupStore — LRU, TTL, singleton reset (D1–D5)
 *
 * NÃO testamos pipeline de dispatch() — isso é Integration (precisa de DB/Redis).
 * O pipeline tem coverage no dispatcher-totem.*.test.ts separados.
 */

import {
  computeDispatchVersionHash,
  DispatchDedupStore,
  getSharedDedupStore,
  _testing_setSharedDedup,
} from '../../../utils/dispatchDedup';
import type { DispatchPlan, DispatchMediaItem } from '../../../types/dispatcherTotem.types';

// ============================================================
// Helpers (factory de dados
// ============================================================

function makePlan(overrides: Partial<DispatchPlan> = {}): DispatchPlan {
  const baseItems: DispatchMediaItem[] = [
    {
      mediaId: 1001,
      order: 0,
      duration: 10,
      url: '/assets/a.mp4',
      mediaType: 'video',
      cacheBucket: 'propagandas',
      mediaName: 'Mídia A',
      contentHash: 'sha256_a',
    },
    {
      mediaId: 1002,
      order: 1,
      duration: 5,
      url: '/assets/b.jpg',
      mediaType: 'image',
      cacheBucket: 'propagandas',
      mediaName: 'Mídia B',
    },
  ];
  return {
    totemId: 42,
    timestamp: new Date('2025-01-01T10:00:00.000Z'),
    playlistId: 55,
    playlistName: 'Playlist Teste',
    mediaItems: baseItems,
    totalDuration: 15,
    priority: 50,
    source: 'campaign',
    sourceId: 77,
    validityStart: new Date('2025-01-01T00:00:00.000Z'),
    validityEnd: new Date('2025-12-31T23:59:59.000Z'),
    metadata: {
      platform: 'android',
      orientation: 'landscape',
      resolution: '1920x1080',
      transientDiagnosticsUrl: '/x',
      defaultAd: true,
    },
    cacheKey: 'cache:abc',
    cacheExpiresAt: new Date(),
    ...overrides,
  };
}

// ============================================================
// S — computeDispatchVersionHash
// ============================================================

describe('computeDispatchVersionHash', () => {
  it('S1. hash é idêntico para planos idênticos (mesmos mediaIds/ordem/duração)', () => {
    const a = makePlan();
    const b = makePlan({
      // timestamp / metadata transient diferentes, mas conteudo igual
      timestamp: new Date('2099-06-06'),
      cacheKey: 'outra-chave-cache',
      cacheExpiresAt: new Date('2099-01-01'),
      metadata: { platform: 'ios',
      ...a.metadata,
      totallyRandomField: 'qualquer-coisa',
    },
    });

    const ha = computeDispatchVersionHash(a);
    const hb = computeDispatchVersionHash(b);
    expect(ha).toEqual(hb);
    expect(ha).toMatch(/^[0-9a-f]{16}$/); // 16 chars hex
  });

  it('S2. mudar mediaId altera o hash (diferente)', () => {
    const a = makePlan();
    const b = makePlan({
      mediaItems: a.mediaItems.map((m) => ({ ...m })),
    });
    (b.mediaItems[0] as DispatchMediaItem).mediaId = 9999;
    expect(computeDispatchVersionHash(a)).not.toEqual(computeDispatchVersionHash(b));
  });

  it('S3. mudar ordem dos items NÃO altera o hash? Deve ordenar internamente pelo order', () => {
    const a = makePlan();
    const b = makePlan({
      // Ordem invertida na lista, mas order numérico preservado
      mediaItems: [...a.mediaItems].reverse(),
    });
    expect(computeDispatchVersionHash(a)).toEqual(computeDispatchVersionHash(b));
  });

  it('S4. mudar priority altera hash', () => {
    const a = makePlan();
    const b = makePlan({ priority: a.priority + 1 });
    expect(computeDispatchVersionHash(a)).not.toEqual(computeDispatchVersionHash(b));
  });

  it('S5. preferMediaContentHash: se ambas mídia tem contentHash, url/mediaId mudam mas contentHash igual → hash igual', () => {
    const a = makePlan({ mediaItems: [
      { mediaId: 1, order: 0, duration: 5, url: '/a.mp4', mediaType: 'video', cacheBucket: 'propagandas', contentHash: 'xxx' },
    ] });
    const b = makePlan({ mediaItems: [
      { mediaId: 999, order: 0, duration: 5, url: '/b.mp4', mediaType: 'video', cacheBucket: 'propagandas', contentHash: 'xxx' },
    ] });
    // SEM preferMediaContentHash → muda
    expect(computeDispatchVersionHash(a)).not.toEqual(computeDispatchVersionHash(b));
    // COM preferMediaContentHash → NÃO muda (mesmo contentHash)
    const ha = computeDispatchVersionHash(a, { preferMediaContentHash: true });
    const hb = computeDispatchVersionHash(b, { preferMediaContentHash: true });
    expect(ha).toEqual(hb);
  });
});

// ============================================================
// D — DispatchDedupStore
// ============================================================

describe('DispatchDedupStore', () => {
  let store: DispatchDedupStore;
  beforeEach(() => {
    store = new DispatchDedupStore({ ttlMs: 60_000, maxEntries: 3 });
  });

  it('D1. primeira chamada não é duplicado', () => {
    const r = store.checkAndRecord(1, 'hash1', { now: 1000 });
    expect(r.isDuplicate).toBe(false);
    expect(r.versionHash).toBe('hash1');
    expect(store.size).toBe(1);
  });

  it('D2. mesma hash dentro do mesmo totem = duplicado', () => {
    store.checkAndRecord(1, 'hash1', { now: 1000 });
    const r = store.checkAndRecord(1, 'hash1', { now: 2000 });
    expect(r.isDuplicate).toBe(true);
    expect(r.ageMs).toBe(1000);
  });

  it('D3. TTL expirado → não duplicado', () => {
    store.checkAndRecord(1, 'hash1', { now: 0 });
    const r = store.checkAndRecord(1, 'hash1', { now: 120_000 });
    expect(r.isDuplicate).toBe(false);
  });

  it('D4. LRU com maxEntries = 3', () => {
    store.checkAndRecord(1, 'h1', { now: 1000 });
    store.checkAndRecord(2, 'h2', { now: 1000 });
    store.checkAndRecord(3, 'h3', { now: 1000 });
    expect(store.size).toBe(3);
    // Re-acessar totem 1 (move to latest, mais novo)
    store.checkAndRecord(1, 'h1b', { now: 2000 });
    // Adicionar 4 totem
    store.checkAndRecord(4, 'h4', { now: 3000 });
    expect(store.size).toBe(3);
    // totem 2 (o mais antigo, removido
    expect(store.peek(2)).toBeUndefined();
    // 1, 3, 4 estão presentes
    expect(store.peek(1)).toBeDefined();
    expect(store.peek(3)).toBeDefined();
    expect(store.peek(4)).toBeDefined();
  });

  it('D5. reset() apaga tudo', () => {
    store.checkAndRecord(1, 'h1');
    store.checkAndRecord(2, 'h2');
    store.reset();
    expect(store.size).toBe(0);
    expect(store.peek(1)).toBeUndefined();
  });
});

// ============================================================
// Singleton
// ============================================================

describe('sharedDedup singleton', () => {
  afterEach(() => {
    _testing_setSharedDedup(null);
  });
  it('instância única', () => {
    const a = getSharedDedupStore({ maxEntries: 10 });
    const b = getSharedDedupStore({ maxEntries: 9999 });
    expect(a).toBe(b);
    a.checkAndRecord(99, 'aaa', {});
    expect(b.size).toBe(1);
  });
});
