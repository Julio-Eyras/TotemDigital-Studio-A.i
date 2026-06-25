import { MixPlaybackItem } from './mixPlaybackCycle';

/** Item com fila por anunciante (subscriber). */
export interface SubscriberMixItem extends MixPlaybackItem {
  subscriber_id: number;
  campaign_id?: number;
}

/**
 * Intercala filas de anunciantes em round-robin: a1, b1, c1, a2, b2, …
 * Ordem estável dos anunciantes = ordem numérica de subscriber_id.
 */
export function interleaveSubscriberRoundRobin<T extends SubscriberMixItem>(
  poolsBySubscriber: Map<number, T[]>
): T[] {
  if (poolsBySubscriber.size === 0) return [];

  const subscriberIds = [...poolsBySubscriber.keys()].sort((a, b) => a - b);
  const queues = subscriberIds.map((id) => [...(poolsBySubscriber.get(id) || [])]);
  const mixed: T[] = [];

  let added = true;
  while (added) {
    added = false;
    for (let i = 0; i < queues.length; i++) {
      const next = queues[i].shift();
      if (next != null) {
        mixed.push({ ...next, order_index: mixed.length + 1 });
        added = true;
      }
    }
  }

  return mixed;
}
