/** Tipos ACE 0.1 — lab TotemDigital-Studio-A.i. Sem PII. */

export const ACE_SCHEMA = 'ace/0.1';
export const ACE_STALE_MAX_SECONDS = 3;
export const ACE_CONFIDENCE_MIN = 0.5;

export const ACE_IDENTITY_FIELDS = [
  'person_id',
  'face',
  'embedding',
  'image',
  'mood',
  'age',
  'age_bucket',
  'gender',
  'emotion',
  'features',
  'name',
  'tag_id',
  'tagId',
  'uid',
  'nfc_uid',
  'nfc_id',
  'card_id',
  'rfid',
  'rfid_id',
] as const;

export type AceRefuseCode =
  | 'IDENTITY_LEAK'
  | 'STALE_CONTEXT'
  | 'LOW_CONFIDENCE'
  | 'ACE_DISABLED'
  | 'SCHEMA_INVALID';

export type AceAttention = 'none' | 'low' | 'medium' | 'high';
export type AceDensity = 'low' | 'medium' | 'high';
export type AceHintCategory = 'PREMIUM' | 'STANDARD' | 'FILL';

export interface AcePrivacy {
  gateway: string;
  identity_dropped: boolean;
  image_dropped: boolean;
}

export interface AceMotion {
  approaching: number;
  passing: number;
  stopped: number;
  leaving: number;
}

export interface AceInteraction {
  touch: boolean;
  qr: boolean;
  nfc: boolean;
}

export interface AceClock {
  hour_local: number;
  day_of_week: number;
  store_open: boolean;
}

export interface AudienceContext {
  schema: string;
  context_id: string;
  observed_at: string;
  totem_id: number;
  site_id?: string;
  privacy: AcePrivacy;
  presence: boolean;
  count: number;
  group: boolean;
  density: AceDensity;
  motion: AceMotion;
  attention: AceAttention;
  dwell_ms: number;
  interaction: AceInteraction;
  clock: AceClock;
  confidence: number;
  session_id: string;
}

export interface AceHint {
  category: AceHintCategory;
  priority_delta: number;
  reason: string;
}

export interface AceGatewayDecision {
  status: 'accepted' | 'refused';
  code: AceRefuseCode | null;
  errors: string[];
  payload: Record<string, unknown>;
}

export interface AceDispatchAudit {
  enabled: boolean;
  code: AceRefuseCode | 'HINT_APPLIED' | 'NO_HINT' | 'NO_CONTEXT' | null;
  hint: AceHint | null;
}
