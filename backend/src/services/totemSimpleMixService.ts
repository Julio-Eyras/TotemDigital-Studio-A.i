/**
 * Mix simples multi-anunciante: round-robin entre filas de cada subscriber.
 * Modo simples — sem agendamento na superfície; ordem interna = fila da campanha.
 */

import { logDebug } from '../utils/loggerHelper';
import { buildDispatchMediaItem } from '../utils/dispatchMediaItem';
import { sumDispatchMediaItemsPlanDuration } from '../utils/dispatchItemDuration';
import {
  expandMixItemsForPlaybackCycle,
} from '../utils/mixPlaybackCycle';
import {
  interleaveSubscriberRoundRobin,
  SubscriberMixItem,
} from '../utils/subscriberRoundRobinMix';
import { enrichDispatchPlanWithGlobalVinhetas } from './dispatchVinhetaEnrichment';
import { CandidateSchedule, DispatchPlan } from '../types/dispatcherTotem.types';
import { getDispatcherTotemService } from './dispatcherTotemService';

const MAX_PLAYBACK_CYCLE_ITEMS = 50;

export interface ConsolidatedCampaignItem {
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
}

export class TotemSimpleMixService {
  /**
   * Monta plano mixado quando há 2+ anunciantes com mídia reproduzível.
   * Retorna undefined se não houver mix multi-anunciante aplicável.
   */
  async buildPlan(
    candidates: CandidateSchedule[],
    totemId: number,
    timestamp: Date
  ): Promise<DispatchPlan | undefined> {
    const bySubscriber = new Map<number, CandidateSchedule[]>();
    for (const c of candidates) {
      const sid = Number(c.subscriberId);
      if (!Number.isFinite(sid) || sid <= 0) continue;
      const list = bySubscriber.get(sid) || [];
      list.push(c);
      bySubscriber.set(sid, list);
    }

    if (bySubscriber.size < 2) {
      return undefined;
    }

    const dispatcher = getDispatcherTotemService();
    const pools = new Map<number, SubscriberMixItem[]>();

    for (const [subscriberId, subscriberCampaigns] of bySubscriber) {
      const sorted = [...subscriberCampaigns].sort((a, b) => {
        const prio = (b.priority || 0) - (a.priority || 0);
        if (prio !== 0) return prio;
        return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
      });

      const queue: SubscriberMixItem[] = [];
      for (const camp of sorted) {
        const consolidated = await dispatcher.consolidateCampaignForDispatch(camp.campaignId);
        for (const item of consolidated.items) {
          queue.push({
            media_id: item.media_id,
            campaign_id: camp.campaignId,
            subscriber_id: subscriberId,
            order_index: queue.length + 1,
          });
        }
      }

      if (queue.length > 0) {
        pools.set(subscriberId, queue);
      }
    }

    if (pools.size < 2) {
      return undefined;
    }

    const interleaved = interleaveSubscriberRoundRobin(pools);
    if (interleaved.length === 0) {
      return undefined;
    }

    const expanded = expandMixItemsForPlaybackCycle(interleaved, MAX_PLAYBACK_CYCLE_ITEMS);
    const mediaItems = await this.resolveMediaItems(expanded);

    if (mediaItems.length === 0) {
      return undefined;
    }

    const subscriberIds = [...pools.keys()].sort((a, b) => a - b);
    const totalDuration = sumDispatchMediaItemsPlanDuration(mediaItems);

    await logDebug('[TotemSimpleMix] Plano round-robin multi-anunciante', {
      totemId,
      subscriberIds,
      subscribers: subscriberIds.length,
      interleavedUnique: interleaved.length,
      playbackItems: mediaItems.length,
    });

    const basePlan: DispatchPlan = {
      totemId,
      timestamp,
      playlistId: 0,
      playlistName: `Mix simples (${subscriberIds.length} anunciantes)`,
      mediaItems,
      totalDuration,
      priority: 0,
      source: 'mix',
      sourceId: totemId,
      sourceName: `Mix simples totem ${totemId}`,
      validityStart: timestamp,
      validityEnd: new Date(timestamp.getTime() + 24 * 60 * 60 * 1000),
      metadata: {
        simpleMode: true,
        mixStrategy: 'round_robin_subscribers',
        shuffleEachCycle: true,
        subscriberIds,
        interleavedUniqueCount: interleaved.length,
        playbackItemsCount: mediaItems.length,
      },
    };

    return enrichDispatchPlanWithGlobalVinhetas(basePlan, subscriberIds);
  }

  private async resolveMediaItems(
    items: SubscriberMixItem[]
  ): Promise<ReturnType<typeof buildDispatchMediaItem>[]> {
    const dispatcher = getDispatcherTotemService();
    const mediaById = new Map<number, ConsolidatedCampaignItem>();

    const campaignIds = [
      ...new Set(
        items
          .map((i) => Number(i.campaign_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    ];

    for (const campaignId of campaignIds) {
      const consolidated = await dispatcher.consolidateCampaignForDispatch(campaignId);
      for (const row of consolidated.items) {
        mediaById.set(row.media_id, row);
      }
    }

    const out: ReturnType<typeof buildDispatchMediaItem>[] = [];
    for (let i = 0; i < items.length; i++) {
      const ref = items[i];
      const row = mediaById.get(ref.media_id);
      if (!row?.file_path) continue;
      out.push(
        buildDispatchMediaItem({
          mediaId: row.media_id,
          order: i + 1,
          displaySeconds: row.duration,
          mediaType: row.media_type,
          durationSeconds: row.duration_seconds,
          filePath: row.file_path,
          name: row.name,
          fileName: row.file_name,
          width: row.width,
          height: row.height,
          mimeType: row.mime_type,
          tags: row.tags,
        })
      );
    }
    return out;
  }
}

let instance: TotemSimpleMixService | null = null;

export function getTotemSimpleMixService(): TotemSimpleMixService {
  if (!instance) {
    instance = new TotemSimpleMixService();
  }
  return instance;
}
