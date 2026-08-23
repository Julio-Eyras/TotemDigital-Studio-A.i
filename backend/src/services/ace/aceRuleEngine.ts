import { AceHint, AudienceContext } from './aceTypes';

/**
 * Regras 0.1: hint para o Dispatcher, nunca escolha de media_id.
 * Prioridade local / Direct continua a ganhar no motor existente.
 */
export function aceContextToHint(ctx: AudienceContext): AceHint | null {
  if (!ctx.presence || ctx.count < 1) {
    return null;
  }

  if (ctx.attention === 'high' && ctx.dwell_ms >= 4000) {
    return {
      category: 'PREMIUM',
      priority_delta: 30,
      reason: 'AUDIENCE.ATTENTION=HIGH AND DWELL_MS>=4000',
    };
  }

  if (ctx.interaction?.nfc || ctx.interaction?.qr) {
    return {
      category: 'STANDARD',
      priority_delta: 20,
      reason: 'AUDIENCE.INTERACTION.NFC_OR_QR',
    };
  }

  if (ctx.count >= 2 && (ctx.attention === 'high' || ctx.attention === 'medium')) {
    return {
      category: 'STANDARD',
      priority_delta: 10,
      reason: 'AUDIENCE.COUNT>=2 AND ATTENTION>=MEDIUM',
    };
  }

  if (ctx.interaction?.touch) {
    return {
      category: 'STANDARD',
      priority_delta: 8,
      reason: 'AUDIENCE.INTERACTION.TOUCH',
    };
  }

  if (ctx.motion?.approaching >= 1) {
    return {
      category: 'STANDARD',
      priority_delta: 5,
      reason: 'AUDIENCE.APPROACHING>=1',
    };
  }

  return null;
}

export function applyAceHintToWeight(
  weight: number,
  hint: AceHint | null,
  aceEnabled: boolean,
  commercialTier?: string
): number {
  if (!aceEnabled || !hint) {
    return weight;
  }

  let next = weight + hint.priority_delta;
  if (hint.category === 'PREMIUM' && commercialTier === 'premium') {
    next += 5;
  }
  if (hint.category === 'FILL' && commercialTier === 'remnant') {
    next += 3;
  }
  return Math.max(0, next);
}

export function isAceEnabledInCapabilities(capabilities: unknown): boolean {
  let cap: Record<string, unknown> | null = null;
  if (typeof capabilities === 'string') {
    try {
      cap = JSON.parse(capabilities) as Record<string, unknown>;
    } catch {
      return false;
    }
  } else if (capabilities && typeof capabilities === 'object') {
    cap = capabilities as Record<string, unknown>;
  }
  if (!cap) {
    return false;
  }
  if (cap.ace_enabled === true) {
    return true;
  }
  const ace = cap.ace;
  if (ace && typeof ace === 'object' && (ace as Record<string, unknown>).enabled === true) {
    return true;
  }
  return false;
}
