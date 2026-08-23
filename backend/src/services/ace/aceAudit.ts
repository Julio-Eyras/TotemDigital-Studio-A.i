import { ACE_IDENTITY_FIELDS, AceHint, AudienceContext } from './aceTypes';

export type AceAuditSource = 'context' | 'interaction' | 'dispatch' | 'refuse';

export interface AceAuditRecord {
  at: string;
  source: AceAuditSource;
  totem_id: number | null;
  code: string | null;
  hint: AceHint | null;
  snapshot: Record<string, unknown> | null;
  errors?: string[];
}

const RING_MAX = 20;

function onlyBools(value: unknown, keys: string[]): Record<string, boolean> {
  const src = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const out: Record<string, boolean> = {};
  for (const key of keys) {
    out[key] = src[key] === true;
  }
  return out;
}

function onlyInts(value: unknown, keys: string[]): Record<string, number> {
  const src = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const out: Record<string, number> = {};
  for (const key of keys) {
    const n = Number(src[key]);
    out[key] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  return out;
}

/** Whitelist. Nunca copia person_id, tag_id, session_id nem chaves desconhecidas. */
export function sanitizeAceForLog(
  ctx: AudienceContext | Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!ctx || typeof ctx !== 'object') {
    return null;
  }
  const src = ctx as Record<string, unknown>;
  const clockSrc =
    src.clock && typeof src.clock === 'object' ? (src.clock as Record<string, unknown>) : {};
  const hour = Number(clockSrc.hour_local);
  const dow = Number(clockSrc.day_of_week);

  const out: Record<string, unknown> = {
    schema: 'ace/0.1',
    totem_id: Number(src.totem_id) || null,
    observed_at: typeof src.observed_at === 'string' ? src.observed_at : null,
    site_id: typeof src.site_id === 'string' ? src.site_id : undefined,
    privacy: { gateway: 'ace/0.1', identity_dropped: true, image_dropped: true },
    presence: src.presence === true,
    count: Number.isFinite(Number(src.count)) ? Math.max(0, Math.floor(Number(src.count))) : 0,
    group: src.group === true,
    density: src.density === 'high' || src.density === 'medium' ? src.density : 'low',
    motion: onlyInts(src.motion, ['approaching', 'passing', 'stopped', 'leaving']),
    attention:
      src.attention === 'high' || src.attention === 'medium' || src.attention === 'low'
        ? src.attention
        : 'none',
    dwell_ms: Number.isFinite(Number(src.dwell_ms))
      ? Math.max(0, Math.floor(Number(src.dwell_ms)))
      : 0,
    interaction: onlyBools(src.interaction, ['touch', 'qr', 'nfc']),
    clock: {
      hour_local: Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.floor(hour))) : 0,
      day_of_week: Number.isFinite(dow) ? Math.min(6, Math.max(0, Math.floor(dow))) : 0,
      store_open: clockSrc.store_open === true,
    },
    confidence: Number.isFinite(Number(src.confidence))
      ? Math.min(1, Math.max(0, Number(src.confidence)))
      : 0,
  };

  if (out.site_id == null) {
    delete out.site_id;
  }

  for (const key of ACE_IDENTITY_FIELDS) {
    delete out[key];
  }
  delete out.session_id;
  delete out.context_id;
  return out;
}

class AceAuditRing {
  private byTotem = new Map<number, AceAuditRecord[]>();
  private orphans: AceAuditRecord[] = [];

  push(record: AceAuditRecord): void {
    const key = record.totem_id;
    if (key == null || key < 1) {
      this.orphans = [...this.orphans, record].slice(-RING_MAX);
      return;
    }
    const next = [...(this.byTotem.get(key) || []), record].slice(-RING_MAX);
    this.byTotem.set(key, next);
  }

  list(totemId: number): AceAuditRecord[] {
    return [...(this.byTotem.get(totemId) || [])].reverse();
  }

  clear(): void {
    this.byTotem.clear();
    this.orphans = [];
  }
}

let ring = new AceAuditRing();

export function resetAceAuditRingForTests(): void {
  ring = new AceAuditRing();
}

export function listAceAudit(totemId: number): AceAuditRecord[] {
  return ring.list(totemId);
}

function persistAceHintToEventLogs(record: AceAuditRecord): void {
  if (process.env.NODE_ENV === 'test' || process.env.ACE_AUDIT_PERSIST === '0') {
    return;
  }
  void (async () => {
    try {
      const { EventType, getEventLogService } = await import('../eventLogService');
      await getEventLogService().logEvent({
        eventType: EventType.ACE_HINT,
        entityType: 'ace',
        entityId: record.totem_id ?? undefined,
        totemId: record.totem_id ?? undefined,
        metadata: {
          schema: 'ace/0.1',
          source: record.source,
          code: record.code,
          hint: record.hint,
          snapshot: record.snapshot,
          errors: record.errors,
          at: record.at,
        },
      });
    } catch {
      // ACE nunca derruba o fluxo se o Postgres falhar
    }
  })();
}

export function recordAceAudit(input: {
  source: AceAuditSource;
  totemId?: number | null;
  code: string | null;
  hint?: AceHint | null;
  context?: AudienceContext | Record<string, unknown> | null;
  errors?: string[];
}): AceAuditRecord {
  const snapshot =
    input.source === 'refuse' ? null : sanitizeAceForLog(input.context ?? null);
  const record: AceAuditRecord = {
    at: new Date().toISOString(),
    source: input.source,
    totem_id: input.totemId != null && Number.isFinite(Number(input.totemId))
      ? Number(input.totemId)
      : null,
    code: input.code,
    hint: input.hint ?? null,
    snapshot,
    errors: input.errors,
  };
  ring.push(record);
  persistAceHintToEventLogs(record);
  return record;
}
