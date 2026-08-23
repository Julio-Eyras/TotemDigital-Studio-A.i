import { getAceHintStore } from './aceHintStore';
import { parseAnonymousInteraction } from './aceInteraction';
import { recordAceAudit } from './aceAudit';
import { AceHint } from './aceTypes';

interface FxInteractionLike {
  siteId: string;
  totemId: string;
  interactionType: string;
  extra?: Record<string, unknown> | null;
}

interface FxAiLike {
  totemId: string;
  eventType: string;
  payload?: Record<string, unknown> | null;
}

export type AceFxBridgeResult =
  | { status: 'ok'; totemId: number; interactionType: 'touch' | 'qr' | 'nfc' }
  | { status: 'refuse'; code: string; errors: string[]; totemId: number | null }
  | { status: 'skip'; reason: string };

function parseNumericTotemId(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return Math.floor(n);
}

/** Copia o evento FX sem UID, tag_id, mood ou face. */
export function mapFxInteractionToAce(event: FxInteractionLike): AceFxBridgeResult {
  const totemId = parseNumericTotemId(event.totemId);
  if (event.interactionType === 'facial_recognition') {
    return {
      status: 'refuse',
      code: 'IDENTITY_LEAK',
      errors: ['FX facial_recognition não entra no ACE'],
      totemId,
    };
  }
  if (event.interactionType === 'gesture') {
    return { status: 'skip', reason: 'gesture fora do ACE 0.1' };
  }
  if (totemId == null) {
    return { status: 'skip', reason: 'totemId FX não numérico' };
  }

  let interactionType: 'touch' | 'qr' | 'nfc' | null = null;
  if (event.interactionType === 'touch') {
    interactionType = 'touch';
  } else if (event.interactionType === 'tag_id') {
    const extra = event.extra && typeof event.extra === 'object' ? event.extra : {};
    interactionType = extra.channel === 'qr' || extra.qr === true ? 'qr' : 'nfc';
  }
  if (!interactionType) {
    return { status: 'skip', reason: `interactionType ${event.interactionType}` };
  }

  return { status: 'ok', totemId, interactionType };
}

export function reviewFxAiEventForAce(event: FxAiLike): AceFxBridgeResult {
  const totemId = parseNumericTotemId(event.totemId);
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const identityKeys = ['mood', 'age', 'age_bucket', 'face', 'person_id', 'embedding', 'gender'];
  const leaked = identityKeys.filter((key) => key in payload);
  if (
    event.eventType === 'facial_estimate' ||
    event.eventType === 'facial_recognition' ||
    leaked.length > 0
  ) {
    return {
      status: 'refuse',
      code: 'IDENTITY_LEAK',
      errors: [`FX AI identidade: ${leaked.join(', ') || event.eventType}`],
      totemId,
    };
  }
  return { status: 'skip', reason: 'FX AI não alimenta o ACE 0.1' };
}

export function ingestFxInteractionForAce(event: FxInteractionLike): AceHint | null {
  try {
    const mapped = mapFxInteractionToAce(event);
    if (mapped.status === 'refuse') {
      recordAceAudit({
        source: 'refuse',
        totemId: mapped.totemId,
        code: mapped.code,
        errors: mapped.errors,
      });
      return null;
    }
    if (mapped.status === 'skip') {
      return null;
    }

    const parsed = parseAnonymousInteraction({
      totem_id: mapped.totemId,
      site_id: event.siteId,
      interactionType: mapped.interactionType,
    });
    if (parsed.status !== 'accepted' || !parsed.totemId || !parsed.interaction) {
      recordAceAudit({
        source: 'refuse',
        totemId: mapped.totemId,
        code: parsed.code,
        errors: parsed.errors,
      });
      return null;
    }

    const hint = getAceHintStore().mergeInteraction(
      parsed.totemId,
      parsed.interaction,
      event.siteId
    );
    const stored = getAceHintStore().get(parsed.totemId);
    recordAceAudit({
      source: 'interaction',
      totemId: parsed.totemId,
      code: hint ? 'HINT_APPLIED' : 'NO_HINT',
      hint,
      context: stored?.context ?? null,
    });
    return hint;
  } catch {
    return null;
  }
}

export function rejectFxAiEventForAce(event: FxAiLike): void {
  try {
    const reviewed = reviewFxAiEventForAce(event);
    if (reviewed.status === 'refuse') {
      recordAceAudit({
        source: 'refuse',
        totemId: reviewed.totemId,
        code: reviewed.code,
        errors: reviewed.errors,
      });
    }
  } catch {
    // ACE nunca derruba o FX
  }
}
