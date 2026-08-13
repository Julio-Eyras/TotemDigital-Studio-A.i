/**
 * Copyright (c) 2026 Julio Cesar Eyras (J.C.E.)
 * Eyras Sistemas e Soluções — Todos os direitos reservados.
 */

import {
  buildDirectFirstPublishSteps,
  directFirstPublishProgress,
  snapshotFromLists,
} from './directFirstPublishChecklist';

describe('directFirstPublishChecklist', () => {
  it('marca etapas na ordem Direct (org → local → totem → mídia → publicar)', () => {
    const empty = snapshotFromLists({ publishers: [], totems: [], mediaCount: 0 });
    const emptySteps = buildDirectFirstPublishSteps(empty);
    expect(emptySteps.map((s) => s.id)).toEqual(['org', 'local', 'totem', 'media', 'publish']);
    expect(emptySteps.every((s) => !s.complete)).toBe(true);
    expect(directFirstPublishProgress(emptySteps).nextStep?.id).toBe('org');

    const ready = snapshotFromLists({
      publishers: [{ locals_count: 1 }],
      totems: [{ status: 'offline', media_count: 2, media_count_total: 2 }],
      mediaCount: 3,
    });
    const readySteps = buildDirectFirstPublishSteps(ready);
    expect(readySteps.every((s) => s.complete)).toBe(true);
    expect(directFirstPublishProgress(readySteps).allComplete).toBe(true);
    expect(ready.onlineTotemCount).toBe(0);
  });

  it('usa fallback de locais quando locals_count não vem na org', () => {
    const snap = snapshotFromLists({
      publishers: [{}],
      totems: [],
      mediaCount: 0,
      localFallbackCount: 2,
    });
    expect(snap.localCount).toBe(2);
    expect(buildDirectFirstPublishSteps(snap).find((s) => s.id === 'local')?.complete).toBe(true);
  });

  it('só conta publicação quando o totem tem mídia ligada', () => {
    const snap = snapshotFromLists({
      publishers: [{ locals_count: 1 }],
      totems: [{ status: 'online', media_count: 0 }],
      mediaCount: 1,
    });
    const steps = buildDirectFirstPublishSteps(snap);
    expect(steps.find((s) => s.id === 'totem')?.complete).toBe(true);
    expect(steps.find((s) => s.id === 'media')?.complete).toBe(true);
    expect(steps.find((s) => s.id === 'publish')?.complete).toBe(false);
    expect(directFirstPublishProgress(steps).nextStep?.id).toBe('publish');
  });
});
