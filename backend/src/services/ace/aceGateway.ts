import {
  ACE_CONFIDENCE_MIN,
  ACE_IDENTITY_FIELDS,
  ACE_STALE_MAX_SECONDS,
  AceGatewayDecision,
  TotemAcePolicy,
} from './aceTypes';

function parseObservedAt(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function aceGatewayDecide(
  payload: Record<string, unknown>,
  options: {
    now?: Date;
    aceEnabled?: boolean;
    confidenceMin?: number;
    staleMaxSeconds?: number;
    totemPolicy?: TotemAcePolicy;
  } = {}
): AceGatewayDecision {
  const now = options.now ?? new Date();
  const aceEnabled = options.aceEnabled !== false;
  const confidenceMin = options.confidenceMin ?? ACE_CONFIDENCE_MIN;
  const staleMaxSeconds = options.staleMaxSeconds ?? ACE_STALE_MAX_SECONDS;
  const totemPolicy: TotemAcePolicy = options.totemPolicy ?? {};

  if (!aceEnabled) {
    return {
      status: 'refused',
      code: 'ACE_DISABLED',
      errors: ['ACE opt-in off (default Direct).'],
      payload,
    };
  }

  if (totemPolicy.ace_disabled_locally === true) {
    return {
      status: 'refused',
      code: 'TOTEM_PRIVACY_DISABLED',
      errors: ['ACE desativado na política do totem (flag local de privacidade).'],
      payload,
    };
  }

  const leaked = ACE_IDENTITY_FIELDS.filter((key) => key in payload);
  const privacy = (payload.privacy && typeof payload.privacy === 'object'
    ? payload.privacy
    : {}) as Record<string, unknown>;
  const identityDropped = privacy.identity_dropped === true;
  const imageDropped = privacy.image_dropped === true;
  const lgpdConsentGiven = privacy.lgpd_consent_given === true;

  if (leaked.length > 0 || !identityDropped || !imageDropped) {
    const errors: string[] = [];
    if (leaked.length) errors.push(`campo de identidade: ${leaked.join(', ')}`);
    if (!identityDropped) errors.push('privacy.identity_dropped deve ser true');
    if (!imageDropped) errors.push('privacy.image_dropped deve ser true');
    return { status: 'refused', code: 'IDENTITY_LEAK', errors, payload };
  }

  if (totemPolicy.require_lgpd_consent === true && !lgpdConsentGiven) {
    return {
      status: 'refused',
      code: 'LGPD_CONSENT_REQUIRED',
      errors: ['privacy.lgpd_consent_given=true requerido pela política do totem (LGPD).'],
      payload,
    };
  }

  if (payload.schema !== 'ace/0.1') {
    return {
      status: 'refused',
      code: 'SCHEMA_INVALID',
      errors: ['schema deve ser ace/0.1'],
      payload,
    };
  }

  const observed = parseObservedAt(payload.observed_at);
  if (!observed) {
    return {
      status: 'refused',
      code: 'SCHEMA_INVALID',
      errors: ['observed_at inválido'],
      payload,
    };
  }

  const ageS = (now.getTime() - observed.getTime()) / 1000;
  if (ageS > staleMaxSeconds) {
    return {
      status: 'refused',
      code: 'STALE_CONTEXT',
      errors: [`observed_at tem ${ageS.toFixed(1)}s (max ${staleMaxSeconds}s)`],
      payload,
    };
  }

  const confidence = Number(payload.confidence);
  if (!Number.isFinite(confidence) || confidence < confidenceMin) {
    return {
      status: 'refused',
      code: 'LOW_CONFIDENCE',
      errors: [`confidence ${confidence} < ${confidenceMin}`],
      payload,
    };
  }

  return { status: 'accepted', code: null, errors: [], payload };
}

