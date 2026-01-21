/**
 * Webhook Service - Smart Signage Pro v3.1
 * Serviço para gerenciar webhooks configuráveis
 */

import { getDatabase } from '../config/database';
import { logInfo, logError, logDebug } from '../utils/loggerHelper';
import axios from 'axios';
import * as crypto from 'crypto';

export interface Webhook {
  id: number;
  name: string;
  url: string;
  secret?: string;
  channels: string[];
  events: string[];
  enabled: boolean;
  retryCount: number;
  timeoutMs: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  secret?: string;
  channels: string[];
  events: string[];
  enabled?: boolean;
  retryCount?: number;
  timeoutMs?: number;
}

export interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  secret?: string;
  channels?: string[];
  events?: string[];
  enabled?: boolean;
  retryCount?: number;
  timeoutMs?: number;
}

export class WebhookService {
  private get db() {
    return getDatabase();
  }

  /**
   * Validar formato de URL
   */
  private validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Aceitar apenas http e https
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Criar webhook
   */
  async createWebhook(data: CreateWebhookRequest): Promise<Webhook> {
    try {
      // Validar formato de URL
      if (!this.validateUrl(data.url)) {
        throw new Error('URL inválida. Use formato http:// ou https://');
      }

      // Validar que channels e events não estão vazios
      if (!data.channels || data.channels.length === 0) {
        throw new Error('Channels é obrigatório e deve conter pelo menos um canal');
      }

      if (!data.events || data.events.length === 0) {
        throw new Error('Events é obrigatório e deve conter pelo menos um evento');
      }

      const query = `
        INSERT INTO webhooks (
          name, url, secret, channels, events, enabled, retry_count, timeout_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await this.db.executeRaw(query, [
        data.name,
        data.url,
        data.secret || null,
        JSON.stringify(data.channels),
        JSON.stringify(data.events),
        data.enabled !== undefined ? data.enabled : true,
        data.retryCount || 3,
        data.timeoutMs || 5000
      ]);

      const webhook = this.mapRowToWebhook(result.rows[0]);
      await logInfo('Webhook criado', { webhookId: webhook.id, name: webhook.name });
      return webhook;
    } catch (error: any) {
      await logError('Erro ao criar webhook', error, data);
      throw new Error(`Erro ao criar webhook: ${error.message}`);
    }
  }

  /**
   * Listar webhooks
   */
  async getAllWebhooks(filters?: {
    enabled?: boolean;
    channel?: string;
    event?: string;
  }): Promise<Webhook[]> {
    try {
      let whereClause = '1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (filters?.enabled !== undefined) {
        whereClause += ` AND enabled = $${paramIndex}`;
        params.push(filters.enabled);
        paramIndex++;
      }

      if (filters?.channel) {
        // channels/events são TEXT[] no schema (não JSONB)
        whereClause += ` AND channels @> ARRAY[$${paramIndex}]::text[]`;
        params.push(filters.channel);
        paramIndex++;
      }

      if (filters?.event) {
        // channels/events são TEXT[] no schema (não JSONB)
        whereClause += ` AND events @> ARRAY[$${paramIndex}]::text[]`;
        params.push(filters.event);
        paramIndex++;
      }

      const query = `SELECT * FROM webhooks WHERE ${whereClause} ORDER BY created_at DESC`;
      const result = await this.db.findMany(query, params);

      return result.map(row => this.mapRowToWebhook(row));
    } catch (error: any) {
      await logError('Erro ao listar webhooks', error, filters);
      throw new Error(`Erro ao listar webhooks: ${error.message}`);
    }
  }

  /**
   * Obter webhook por ID
   */
  async getWebhookById(id: number): Promise<Webhook | null> {
    try {
      const result = await this.db.findFirst('SELECT * FROM webhooks WHERE id = $1', [id]);
      return result ? this.mapRowToWebhook(result) : null;
    } catch (error: any) {
      await logError('Erro ao buscar webhook', error, { id });
      throw new Error(`Erro ao buscar webhook: ${error.message}`);
    }
  }

  /**
   * Atualizar webhook
   */
  async updateWebhook(id: number, data: UpdateWebhookRequest): Promise<Webhook> {
    try {
      // Validar URL se fornecida
      if (data.url !== undefined && !this.validateUrl(data.url)) {
        throw new Error('URL inválida. Use formato http:// ou https://');
      }

      // Validar channels se fornecido
      if (data.channels !== undefined && (!Array.isArray(data.channels) || data.channels.length === 0)) {
        throw new Error('Channels deve ser um array com pelo menos um canal');
      }

      // Validar events se fornecido
      if (data.events !== undefined && (!Array.isArray(data.events) || data.events.length === 0)) {
        throw new Error('Events deve ser um array com pelo menos um evento');
      }

      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
      }

      if (data.url !== undefined) {
        updates.push(`url = $${paramIndex}`);
        params.push(data.url);
        paramIndex++;
      }

      if (data.secret !== undefined) {
        updates.push(`secret = $${paramIndex}`);
        params.push(data.secret || null);
        paramIndex++;
      }

      if (data.channels !== undefined) {
        updates.push(`channels = $${paramIndex}`);
        params.push(JSON.stringify(data.channels));
        paramIndex++;
      }

      if (data.events !== undefined) {
        updates.push(`events = $${paramIndex}`);
        params.push(JSON.stringify(data.events));
        paramIndex++;
      }

      if (data.enabled !== undefined) {
        updates.push(`enabled = $${paramIndex}`);
        params.push(data.enabled);
        paramIndex++;
      }

      if (data.retryCount !== undefined) {
        updates.push(`retry_count = $${paramIndex}`);
        params.push(data.retryCount);
        paramIndex++;
      }

      if (data.timeoutMs !== undefined) {
        updates.push(`timeout_ms = $${paramIndex}`);
        params.push(data.timeoutMs);
        paramIndex++;
      }

      if (updates.length === 0) {
        return await this.getWebhookById(id) as Webhook;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);

      const query = `
        UPDATE webhooks
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.executeRaw(query, params);
      const webhook = this.mapRowToWebhook(result.rows[0]);
      await logInfo('Webhook atualizado', { webhookId: webhook.id });
      return webhook;
    } catch (error: any) {
      await logError('Erro ao atualizar webhook', error, { id, data });
      throw new Error(`Erro ao atualizar webhook: ${error.message}`);
    }
  }

  /**
   * Deletar webhook
   */
  async deleteWebhook(id: number): Promise<void> {
    try {
      const result = await this.db.executeRaw('DELETE FROM webhooks WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        throw new Error(`Webhook com ID ${id} não encontrado`);
      }
      await logInfo('Webhook deletado', { webhookId: id });
    } catch (error: any) {
      await logError('Erro ao deletar webhook', error, { id });
      throw new Error(`Erro ao deletar webhook: ${error.message}`);
    }
  }

  /**
   * Disparar webhook para um evento
   */
  async triggerWebhook(event: string, payload: Record<string, any>): Promise<void> {
    try {
      const webhooks = await this.getAllWebhooks({
        enabled: true,
        event
      });

      if (webhooks.length === 0) {
        await logDebug('Nenhum webhook configurado para evento', { event });
        return;
      }

      const webhookPayload = {
        event,
        payload,
        timestamp: new Date().toISOString()
      };

      for (const webhook of webhooks) {
        await this.sendWebhook(webhook, webhookPayload);
      }
    } catch (error: any) {
      await logError('Erro ao disparar webhook', error, { event });
    }
  }

  /**
   * Enviar webhook com retry
   */
  private async sendWebhook(webhook: Webhook, payload: Record<string, any>, attempt: number = 1): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'SmartSignage-Pro/3.1'
      };

      // Adicionar assinatura se secret configurado
      if (webhook.secret) {
        const signature = crypto
          .createHmac('sha256', webhook.secret)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
      }

      await axios.post(webhook.url, payload, {
        headers,
        timeout: webhook.timeoutMs
      });

      await logInfo('Webhook enviado com sucesso', {
        webhookId: webhook.id,
        url: webhook.url,
        event: payload.event
      });
    } catch (error: any) {
      await logError('Erro ao enviar webhook', error, {
        webhookId: webhook.id,
        url: webhook.url,
        attempt
      });

      // Retry se ainda houver tentativas
      if (attempt < webhook.retryCount) {
        const delay = Math.pow(2, attempt) * 1000; // Backoff exponencial
        await new Promise(resolve => setTimeout(resolve, delay));
        await this.sendWebhook(webhook, payload, attempt + 1);
      }
    }
  }

  /**
   * Mapear row do banco para objeto Webhook
   */
  private mapRowToWebhook(row: any): Webhook {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      secret: row.secret || undefined,
      channels: Array.isArray(row.channels) ? row.channels : JSON.parse(row.channels || '[]'),
      events: Array.isArray(row.events) ? row.events : JSON.parse(row.events || '[]'),
      enabled: row.enabled,
      retryCount: row.retry_count || 3,
      timeoutMs: row.timeout_ms || 5000,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// Singleton
let webhookServiceInstance: WebhookService | null = null;

export function getWebhookService(): WebhookService {
  if (!webhookServiceInstance) {
    webhookServiceInstance = new WebhookService();
  }
  return webhookServiceInstance;
}

