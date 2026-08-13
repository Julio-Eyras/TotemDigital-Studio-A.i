/**
 * Copyright (c) 2026 Julio Cesar Eyras (J.C.E.)
 * Eyras Sistemas e Soluções — Todos os direitos reservados.
 */

import { useEffect, useMemo, useState } from 'react';
import { localApi, mediaApi, publisherApi } from '../services/api';
import {
  DirectFirstPublishSnapshot,
  snapshotFromLists,
} from '../utils/directFirstPublishChecklist';

function unwrapList(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;
  if (res && typeof res === 'object') {
    const row = res as { data?: unknown; media?: unknown };
    if (Array.isArray(row.data)) return row.data;
    if (Array.isArray(row.media)) return row.media;
  }
  return [];
}

function readTotal(res: unknown, fallbackLen: number): number {
  if (res && typeof res === 'object' && typeof (res as { total?: unknown }).total === 'number') {
    return Math.max(0, Number((res as { total: number }).total) || 0);
  }
  return fallbackLen;
}

export function useDirectFirstPublishSnapshot(
  totems: unknown[],
  enabled: boolean
): DirectFirstPublishSnapshot | null {
  const [extra, setExtra] = useState<{
    publishers: Array<{ locals_count?: unknown; localsCount?: unknown }>;
    mediaCount: number;
    localFallbackCount: number;
  } | null>(null);

  const totemSignature = useMemo(
    () =>
      (totems || [])
        .map((row) => {
          const t = row as Record<string, unknown>;
          return `${t.totem_id ?? t.id ?? ''}:${t.media_count ?? ''}:${t.media_count_total ?? ''}:${t.status ?? ''}`;
        })
        .join('|'),
    [totems]
  );

  useEffect(() => {
    if (!enabled) {
      setExtra(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pubRes, mediaRes] = await Promise.all([
          publisherApi.getAll({ limit: 50, active_only: true }),
          mediaApi.getAll({ limit: 1 }),
        ]);
        const publishers = unwrapList(pubRes) as Array<{
          locals_count?: unknown;
          localsCount?: unknown;
        }>;
        const mediaList = unwrapList(mediaRes);
        const mediaCount = readTotal(mediaRes, mediaList.length);
        const localsFromOrgs = publishers.reduce((sum, publisher) => {
          const n = Number(publisher.locals_count ?? publisher.localsCount ?? 0);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        let localFallbackCount = 0;
        if (publishers.length > 0 && localsFromOrgs === 0) {
          try {
            const localRes = await localApi.getAll({ limit: 50, active_only: true });
            localFallbackCount = unwrapList(localRes).length;
          } catch {
            localFallbackCount = 0;
          }
        }
        if (!cancelled) {
          setExtra({ publishers, mediaCount, localFallbackCount });
        }
      } catch {
        if (!cancelled) {
          setExtra({ publishers: [], mediaCount: 0, localFallbackCount: 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, totemSignature]);

  return useMemo(() => {
    if (!enabled || !extra) return null;
    return snapshotFromLists({
      publishers: extra.publishers,
      totems: (totems || []) as Array<{
        status?: unknown;
        media_count?: unknown;
        media_count_total?: unknown;
      }>,
      mediaCount: extra.mediaCount,
      localFallbackCount: extra.localFallbackCount,
    });
  }, [enabled, extra, totems]);
}
