import { AceHint } from './aceTypes';

export interface AceHintWire {
  msg_type: 'ace.hint';
  schema: 'ace/0.1';
  totem_id: number;
  site_id?: string;
  category: AceHint['category'];
  priority_delta: number;
  reason: string;
}

export function toAceHintWire(
  totemId: number,
  hint: AceHint,
  siteId?: string
): AceHintWire {
  return {
    msg_type: 'ace.hint',
    schema: 'ace/0.1',
    totem_id: totemId,
    ...(siteId ? { site_id: siteId } : {}),
    category: hint.category,
    priority_delta: hint.priority_delta,
    reason: hint.reason,
  };
}

export function publishAceHintWire(totemId: number, hint: AceHint | null, siteId?: string): void {
  if (!hint || process.env.NODE_ENV === 'test') {
    return;
  }
  void (async () => {
    try {
      const { getFxMessageBridge } = await import('../fxMessageBridge');
      await getFxMessageBridge().publishAceHint(toAceHintWire(totemId, hint, siteId));
    } catch {
      // ACE nunca derruba FX/MQTT
    }
  })();
}

export function fxRuleMatchesAceHint(
  conditions: Record<string, unknown> | null | undefined,
  hint: AceHint | null
): boolean {
  if (!conditions || conditions.ace_category == null) {
    return true;
  }
  if (!hint) {
    return false;
  }
  const raw = conditions.ace_category;
  const cats = Array.isArray(raw) ? raw : [raw];
  return cats.includes(hint.category);
}
