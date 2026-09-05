/**
 * FxTimelineService - Gerenciamento de Timelines FX
 *
 * CRUD completo para timelines globais de efeitos FX para sites
 */

import * as crypto from 'crypto';
import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

export type FxEffectType = 'fade' | 'rotate' | 'split' | 'pan' | 'zoom' | 'transition' | 'custom';
export type FxTargetScope = 'single_totem' | 'site_all' | 'group';
export type FxTriggerType = 'schedule' | 'dispatch' | 'ace' | 'manual' | 'mqtt';

export interface FxEvent {
  event_id?: string;
  effect_type: FxEffectType;
  target_scope: FxTargetScope;
  target_ids?: string[];
  trigger_type: FxTriggerType;
  at_ms?: number;
  duration_ms?: number;
  /** Payload arbitrário (estruturado, dependendo do effect_type). */
  payload?: Record<string, unknown>;
  /** Identificador estável da versão do conteúdo (DispatchPlan.versionHash quando trigger=dispatch). */
  dispatch_version_hash?: string;
  [key: string]: unknown;
}

export interface FxTimeline {
  timeline_id: number;
  site_id: string;
  name?: string;
  version: number;
  /**
   * Eventos do FX timeline — schema flexível para compatibilidade retroativa com
   * o FxOrchestrator (FxTimelineEvent camelCase legado) e com o schema
   * estruturado FxEvent (snake_case) definido acima.
   */
  events: unknown[];
  generated_at: string;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  /** Hash estável (SHA-256 16 hex) dos eventos (sem transient fields) para dedup FX. */
  version_hash?: string;
}

export interface CreateFxTimelineRequest {
  site_id: string;
  name?: string;
  version?: number;
  events: unknown[];
  generated_at?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

export interface UpdateFxTimelineRequest {
  site_id?: string;
  name?: string;
  version?: number;
  events?: unknown[];
  generated_at?: string;
  starts_at?: string;
  ends_at?: string;
  is_active?: boolean;
}

export interface FxTimelineListResponse {
  data: FxTimeline[];
  total: number;
  page: number;
  limit: number;
}

/** Campos de evento transient que NÃO devem afetar o versionHash (datas, log, tracing). */
const FX_EVENT_TRANSIENT_KEYS = new Set([
  'generated_at',
  'created_at',
  'updated_at',
  'event_id',
  'trace_id',
  'span_id',
]);

/**
 * Gera um versionHash estável (SHA-256 truncado em 16 hex) para uma lista de eventos.
 * — Ignora fields transient (datas, tracing) em cada evento
 * — Ordenação é preservada (FX timeline SÍ depende da ordem dos eventos)
 * — Suporta tanto FxEvent (snake_case novo) quanto FxTimelineEvent (camelCase legado do Orchestrator)
 */
export function computeFxTimelineVersionHash(events: unknown[]): string {
  const stable = events.map((item) => {
    if (!item || typeof item !== 'object') return JSON.stringify(item);
    const ev = item as unknown as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    const keys = Object.keys(ev).filter((k) => !FX_EVENT_TRANSIENT_KEYS.has(k)).sort();
    for (const k of keys) normalized[k] = ev[k];
    return JSON.stringify(normalized);
  });
  const payload = stable.join('|');
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
}

export class FxTimelineService {
  private get db() {
    return getDatabase();
  }

  /**
   * Listar timelines com paginação e filtros
   */
  async getAllTimelines(params: {
    page?: number;
    limit?: number;
    search?: string;
    site_id?: string;
    isActive?: boolean;
  }): Promise<FxTimelineListResponse> {
    try {
      const { page = 1, limit = 20, search, site_id, isActive } = params;
      const offset = (page - 1) * limit;

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause += ` AND (name ILIKE $${paramIndex} OR site_id ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (site_id) {
        whereClause += ` AND site_id = $${paramIndex}`;
        queryParams.push(site_id);
        paramIndex++;
      }

      if (isActive !== undefined) {
        whereClause += ` AND is_active = $${paramIndex}`;
        queryParams.push(isActive);
        paramIndex++;
      }

      // Contar total
      const countQuery = `SELECT COUNT(*) as total FROM fx_timelines WHERE ${whereClause}`;
      const countResult = await this.db.findFirst(countQuery, queryParams);
      const total = parseInt(countResult?.total || '0', 10);

      // Buscar dados
      const dataQuery = `
        SELECT 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
        FROM fx_timelines
        WHERE ${whereClause}
        ORDER BY generated_at DESC, version DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);
      const dataResult = await this.db.findMany(dataQuery, queryParams);

      return {
        data: dataResult.map((r) => this.mapRowToTimeline(r)),
        total,
        page,
        limit,
      };} catch (error: unknown) {
        const e = normalizeError(error);

      const message = error instanceof Error ? e.message : String(error);
      await logError('FxTimelineService.getAllTimelines error', message, params);
      throw new Error(`Erro ao listar timelines: ${message}`);
    }
  }

  /**
   * Buscar timeline por ID
   */
  async getTimelineById(timelineId: number): Promise<FxTimeline | null> {
    try {
      const query = `
        SELECT 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
        FROM fx_timelines
        WHERE timeline_id = $1
      `;
      const result = await this.db.findFirst(query, [timelineId]);

      if (!result) {
        return null;
      }

      return this.mapRowToTimeline(result);} catch (error: unknown) {
        const e = normalizeError(error);

      const message = error instanceof Error ? e.message : String(error);
      await logError('FxTimelineService.getTimelineById error', message, { timelineId });
      throw new Error(`Erro ao buscar timeline: ${message}`);
    }
  }

  /**
   * Buscar timeline ativa mais recente para um site
   */
  async getActiveTimelineForSite(siteId: string): Promise<FxTimeline | null> {
    try {
      const query = `
        SELECT 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
        FROM fx_timelines
        WHERE site_id = $1 AND is_active = true
        ORDER BY generated_at DESC, version DESC
        LIMIT 1
      `;
      const result = await this.db.findFirst(query, [siteId]);

      if (!result) {
        return null;
      }

      return this.mapRowToTimeline(result);} catch (error: unknown) {
        const e = normalizeError(error);

      const message = error instanceof Error ? e.message : String(error);
      await logError('FxTimelineService.getActiveTimelineForSite error', message, { siteId });
      throw new Error(`Erro ao buscar timeline ativa: ${message}`);
    }
  }

  /**
   * Criar nova timeline
   */
  async createTimeline(data: CreateFxTimelineRequest): Promise<FxTimeline> {
    try {
      const query = `
        INSERT INTO fx_timelines (
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
      `;

      const params = [
        data.site_id,
        data.name || null,
        data.version || 1,
        JSON.stringify(data.events),
        data.generated_at ? new Date(data.generated_at) : new Date(),
        data.starts_at ? new Date(data.starts_at) : null,
        data.ends_at ? new Date(data.ends_at) : null,
        data.is_active !== undefined ? data.is_active : true,
      ];

      const result = await this.db.executeRaw(query, params);
      return this.mapRowToTimeline(result.rows[0]);} catch (error: unknown) {
        const e = normalizeError(error);

      const message = error instanceof Error ? e.message : String(error);
      await logError('FxTimelineService.createTimeline error', message, data);
      throw new Error(`Erro ao criar timeline: ${message}`);
    }
  }

  /**
   * Atualizar timeline
   */
  async updateTimeline(timelineId: number, data: UpdateFxTimelineRequest): Promise<FxTimeline> {
    try {
      const updates: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.site_id !== undefined) {
        updates.push(`site_id = $${paramIndex}`);
        params.push(data.site_id);
        paramIndex++;
      }

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
      }

      if (data.version !== undefined) {
        updates.push(`version = $${paramIndex}`);
        params.push(data.version);
        paramIndex++;
      }

      if (data.events !== undefined) {
        updates.push(`events = $${paramIndex}`);
        params.push(JSON.stringify(data.events));
        paramIndex++;
      }

      if (data.generated_at !== undefined) {
        updates.push(`generated_at = $${paramIndex}`);
        params.push(new Date(data.generated_at));
        paramIndex++;
      }

      if (data.starts_at !== undefined) {
        updates.push(`starts_at = $${paramIndex}`);
        params.push(data.starts_at ? new Date(data.starts_at) : null);
        paramIndex++;
      }

      if (data.ends_at !== undefined) {
        updates.push(`ends_at = $${paramIndex}`);
        params.push(data.ends_at ? new Date(data.ends_at) : null);
        paramIndex++;
      }

      if (data.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
        paramIndex++;
      }

      if (updates.length === 0) {
        const t = await this.getTimelineById(timelineId);
        if (!t) throw new Error(`Timeline com ID ${timelineId} não encontrada`);
        return t;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(timelineId);

      const query = `
        UPDATE fx_timelines
        SET ${updates.join(', ')}
        WHERE timeline_id = $${paramIndex}
        RETURNING 
          timeline_id,
          site_id,
          name,
          version,
          events,
          generated_at,
          starts_at,
          ends_at,
          is_active,
          created_at,
          updated_at
      `;

      const result = await this.db.executeRaw(query, params);

      if (result.rows.length === 0) {
        throw new Error(`Timeline com ID ${timelineId} não encontrada`);
      }

      return this.mapRowToTimeline(result.rows[0]);} catch (error: unknown) {
        const e = normalizeError(error);

      const message = error instanceof Error ? e.message : String(error);
      await logError('FxTimelineService.updateTimeline error', message, { timelineId, data });
      throw new Error(`Erro ao atualizar timeline: ${message}`);
    }
  }

  /**
   * Deletar timeline (soft delete: marca como inativa)
   */
  async deleteTimeline(timelineId: number): Promise<void> {
    try {
      const query = `
        UPDATE fx_timelines
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE timeline_id = $1
      `;
      const result = await this.db.executeRaw(query, [timelineId]);

      if (result.rowCount === 0) {
        throw new Error(`Timeline com ID ${timelineId} não encontrada`);
 
}} catch (error: unknown) {
        const e = normalizeError(error);

      const message = error instanceof Error ? e.message : String(error);
      await logError('FxTimelineService.deleteTimeline error', message, { timelineId });
      throw new Error(`Erro ao deletar timeline: ${message}`);
    }
  }

  /**
   * Mapear row do banco para objeto FxTimeline
   */
  private mapRowToTimeline(row: Record<string, unknown>): FxTimeline {
    let events: unknown[] = [];
    if (typeof row.events === 'string') {
      try {
        const parsed = JSON.parse(row.events);
        if (Array.isArray(parsed)) events = parsed;
      } catch {
        events = [];
      }
    } else if (Array.isArray(row.events)) {
      events = row.events;
    }

    return {
      timeline_id: Number(row.timeline_id),
      site_id: String(row.site_id),
      name: row.name ? String(row.name) : undefined,
      version: Number(row.version),
      events,
      generated_at: String(row.generated_at),
      starts_at: row.starts_at ? String(row.starts_at) : undefined,
      ends_at: row.ends_at ? String(row.ends_at) : undefined,
      is_active: row.is_active === true,
      created_at: String(row.created_at),
      updated_at: row.updated_at ? String(row.updated_at) : undefined,
      version_hash: computeFxTimelineVersionHash(events),
    };
  }
}

// Singleton opcional
let fxTimelineServiceInstance: FxTimelineService | null = null;

export function getFxTimelineService(): FxTimelineService {
  if (!fxTimelineServiceInstance) {
    fxTimelineServiceInstance = new FxTimelineService();
  }
  return fxTimelineServiceInstance;
}

