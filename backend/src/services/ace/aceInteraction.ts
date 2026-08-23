import { randomUUID } from 'crypto';
import {
  ACE_IDENTITY_FIELDS,
  ACE_SCHEMA,
  AceGatewayDecision,
  AceInteraction,
  AudienceContext,
} from './aceTypes';

const FACIAL_LEAK_VALUES = new Set(['facial_recognition', 'facial_estimate']);

function collectIdentityLeaks(value: unknown, depth = 0): string[] {
  if (!value || typeof value !== 'object' || depth > 4) {
    return [];
  }
  const rec = value as Record<string, unknown>;
  const leaked: string[] = ACE_IDENTITY_FIELDS.filter((key) => key in rec);
  for (const key of ['interactionType', 'eventType'] as const) {
    if (typeof rec[key] === 'string' && FACIAL_LEAK_VALUES.has(rec[key] as string)) {
      leaked.push('facial_recognition');
    }
  }
  for (const nested of Object.values(rec)) {
    leaked.push(...collectIdentityLeaks(nested, depth + 1));
  }
  return [...new Set(leaked)];
}

function asBool(value: unknown): boolean {
  return value === true;
}

export function parseAnonymousInteraction(
  body: Record<string, unknown>
): AceGatewayDecision & { totemId: number | null; interaction: AceInteraction | null } {
  const leaked = collectIdentityLeaks(body);
  if (leaked.length > 0) {
    return {
      status: 'refused',
      code: 'IDENTITY_LEAK',
      errors: [`campo de identidade: ${leaked.join(', ')}`],
      payload: body,
      totemId: null,
      interaction: null,
    };
  }

  const totemId = Number(body.totem_id ?? body.totemId);
  if (!Number.isFinite(totemId) || totemId < 1) {
    return {
      status: 'refused',
      code: 'SCHEMA_INVALID',
      errors: ['totem_id inválido'],
      payload: body,
      totemId: null,
      interaction: null,
    };
  }

  const type = typeof body.interactionType === 'string' ? body.interactionType : '';
  const nested =
    body.interaction && typeof body.interaction === 'object'
      ? (body.interaction as Record<string, unknown>)
      : {};

  const interaction: AceInteraction = {
    touch: asBool(body.touch) || asBool(nested.touch) || type === 'touch',
    qr: asBool(body.qr) || asBool(nested.qr) || type === 'qr',
    nfc:
      asBool(body.nfc) ||
      asBool(nested.nfc) ||
      type === 'nfc' ||
      type === 'tag_id',
  };

  if (!interaction.touch && !interaction.qr && !interaction.nfc) {
    return {
      status: 'refused',
      code: 'SCHEMA_INVALID',
      errors: ['interaction precisa de touch, qr ou nfc (bool anónimo)'],
      payload: body,
      totemId,
      interaction: null,
    };
  }

  return {
    status: 'accepted',
    code: null,
    errors: [],
    payload: { totem_id: totemId, interaction },
    totemId,
    interaction,
  };
}

export function seedContextFromInteraction(
  totemId: number,
  interaction: AceInteraction,
  siteId?: string
): AudienceContext {
  const now = new Date();
  const hour = now.getHours();
  return {
    schema: ACE_SCHEMA,
    context_id: randomUUID(),
    observed_at: now.toISOString(),
    totem_id: totemId,
    ...(siteId ? { site_id: siteId } : {}),
    privacy: { gateway: 'ace/0.1', identity_dropped: true, image_dropped: true },
    presence: true,
    count: 1,
    group: false,
    density: 'low',
    motion: { approaching: 0, passing: 0, stopped: 1, leaving: 0 },
    attention: 'low',
    dwell_ms: 0,
    interaction,
    clock: {
      hour_local: hour,
      day_of_week: now.getDay(),
      store_open: hour >= 7 && hour < 22,
    },
    confidence: 0.9,
    session_id: `ephemeral-ix-${randomUUID().slice(0, 8)}`,
  };
}

export function mergeInteractionIntoContext(
  ctx: AudienceContext,
  interaction: AceInteraction
): AudienceContext {
  const next: AudienceContext = {
    ...ctx,
    observed_at: new Date().toISOString(),
    interaction: {
      touch: Boolean(ctx.interaction?.touch || interaction.touch),
      qr: Boolean(ctx.interaction?.qr || interaction.qr),
      nfc: Boolean(ctx.interaction?.nfc || interaction.nfc),
    },
  };
  if (next.interaction.touch || next.interaction.qr || next.interaction.nfc) {
    next.presence = true;
    if (next.count < 1) {
      next.count = 1;
    }
    if (next.attention === 'none') {
      next.attention = 'low';
    }
  }
  return next;
}
