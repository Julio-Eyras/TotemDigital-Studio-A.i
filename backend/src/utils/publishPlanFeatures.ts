/**
 * Verifica recursos do plano ativo do anunciante (ex.: vídeo IA = Premium).
 */

import { getSubscriberService } from '../services/subscriberService';

function parseFeatures(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

export async function subscriberHasPremiumAiVideo(subscriberId: number): Promise<boolean> {
  const plans = await getSubscriberService().getActivePlans(subscriberId);
  for (const plan of plans) {
    const slug = String(plan.slug || '').toLowerCase();
    if (slug.includes('premium') || slug.includes('pro-plus') || slug.includes('enterprise')) {
      return true;
    }
    const features = parseFeatures(plan.features);
    if (features.ai_video === true || features.ai_video_generation === true) {
      return true;
    }
  }
  return false;
}

export async function subscriberHasAiTextAssist(subscriberId: number): Promise<boolean> {
  const plans = await getSubscriberService().getActivePlans(subscriberId);
  if (plans.length === 0) return true;
  for (const plan of plans) {
    const features = parseFeatures(plan.features);
    if (features.ai_text === false || features.ai_text_assist === false) {
      return false;
    }
  }
  return true;
}
