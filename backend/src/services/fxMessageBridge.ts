/**
 * FxMessageBridge - Ponte de Mensageria SmartDisplayFX
 *
 * Responsável por publicar mensagens SmartDisplayFlow (effect_transfer,
 * timeline_update, sync_time, fx_telemetry) em um broker MQTT (via WebSocket
 * ou TCP) OU, em ambientes sem broker, registrar os eventos apenas em log.
 *
 * Esta é a interface de saída do FxOrchestratorService.
 */

// MQTT é opcional - apenas importar se disponível
import { normalizeError } from '../utils/errors';
let mqtt: any;
try {
  const mqttModule = require('mqtt');
  mqtt = mqttModule.default || mqttModule;
} catch {
  // MQTT não está instalado - usar modo log-only
  mqtt = null;
}
import { logInfo, logError, logWarn } from '../utils/loggerHelper';
import { messagingConfig } from '../config/env';

export interface FxEffectMessage {
  msg_type: 'effect_transfer';
  site_id: string;
  effect_id: string;
  from: { totem: string; edge: string };
  to: { totem: string; edge: string };
  content_id: number | null;
  start_ts: string;
  duration_ms: number;
  params?: Record<string, any>;
}

export interface FxTimelineMessage {
  msg_type: 'timeline_update';
  site_id: string;
  timeline_id: string;
  version: number;
  generated_at: string;
  events: any[];
}

export interface FxSyncTimeMessage {
  msg_type: 'sync_time';
  site_id: string;
  server_time: string;
  server_timestamp: number;
}

export interface FxAceHintMessage {
  msg_type: 'ace.hint';
  schema: 'ace/0.1';
  totem_id: number;
  site_id?: string;
  category: 'PREMIUM' | 'STANDARD' | 'FILL';
  priority_delta: number;
  reason: string;
}

export interface FxTelemetryMessage {
  msg_type: 'fx_telemetry';
  site_id: string;
  totem_id: string;
  effect_id: string;
  event_id?: string;
  content_id?: number;
  planned_start_ts?: string;
  actual_start_ts?: string;
  ended_at?: string;
  duration_ms?: number;
  avg_fps?: number;
  status: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export class FxMessageBridge {
  private client: any = null;
  private connected = false;

  constructor() {
    if (messagingConfig.mqtt.enabled) {
      this.connect();
    } else {
      logWarn('FxMessageBridge iniciado sem MQTT (mensagens serão apenas logadas)', {});
    }
  }

  private connect() {
    try {
      const url = messagingConfig.mqtt.url;
      const options: Record<string, unknown> = {
        username: messagingConfig.mqtt.username || undefined,
        password: messagingConfig.mqtt.password || undefined,
        reconnectPeriod: 5000,
      };

      if (mqtt) {
        this.client = mqtt.connect(url, options);
      } else {
        throw new Error('MQTT não está disponível');
      }

      this.client.on('connect', () => {
        this.connected = true;
        logInfo('FxMessageBridge conectado ao MQTT', { url });
      });

      this.client.on('error', async (err: Error) => {
        this.connected = false;
        await logError('FxMessageBridge MQTT error', err, { url }).catch(() => {});
      });

      this.client.on('close', () => {
        this.connected = false;
        logWarn('FxMessageBridge MQTT desconectado, tentando reconectar...', { url });
      });} catch (error: unknown) {
      const e = normalizeError(error);
      logError('FxMessageBridge não conseguiu iniciar conexão MQTT', e.error, {
        url: messagingConfig.mqtt.url,
      }).catch(() => {});
    }
  }

  /**
   * Publica um effect_transfer em smartdisplay/{site_id}/effect
   */
  async publishEffect(effect: FxEffectMessage): Promise<void> {
    const topic = this.buildTopic(effect.site_id, 'effect');

    if (!this.connected || !this.client) {
      // Sem broker: logar apenas (não é mock, mas modo "log-only")
      await logWarn('FxMessageBridge.publishEffect (MQTT indisponível, log-only)', {
        topic,
        effect,
      }).catch(() => {});
      return;
    }

    try {
      const payload = JSON.stringify(effect);
      this.client.publish(topic, payload, { qos: 0 }, (err: Error | null) => {
        if (err) {
          logError('FxMessageBridge publishEffect erro', err, { topic }).catch(() => {});
        } else {
          logInfo('FxMessageBridge publishEffect ok', { topic });
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxMessageBridge publishEffect exception', e.error, { topic }).catch(() => {});
    }
  }

  /**
   * Publica uma timeline FX em smartdisplay/{site_id}/timeline
   */
  async publishTimeline(timeline: FxTimelineMessage): Promise<void> {
    const topic = this.buildTopic(timeline.site_id, 'timeline');

    if (!this.connected || !this.client) {
      await logWarn('FxMessageBridge.publishTimeline (MQTT indisponível, log-only)', {
        topic,
        timelineId: timeline.timeline_id,
      }).catch(() => {});
      return;
    }

    try {
      const payload = JSON.stringify(timeline);
      this.client.publish(topic, payload, { qos: 0 }, (err: Error | null) => {
        if (err) {
          logError('FxMessageBridge publishTimeline erro', err, { topic }).catch(() => {});
        } else {
          logInfo('FxMessageBridge publishTimeline ok', { topic });
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxMessageBridge publishTimeline exception', e.error, { topic }).catch(() => {});
    }
  }

  /**
   * Publica uma mensagem de sincronização de tempo em smartdisplay/{site_id}/sync_time
   */
  async publishSyncTime(siteId: string): Promise<void> {
    const topic = this.buildTopic(siteId, 'sync_time');
    const now = Date.now();
    const serverTime = new Date(now).toISOString();

    const message: FxSyncTimeMessage = {
      msg_type: 'sync_time',
      site_id: siteId,
      server_time: serverTime,
      server_timestamp: now,
    };

    if (!this.connected || !this.client) {
      await logWarn('FxMessageBridge.publishSyncTime (MQTT indisponível, log-only)', {
        topic,
        siteId,
      }).catch(() => {});
      return;
    }

    try {
      const payload = JSON.stringify(message);
      this.client.publish(topic, payload, { qos: 1 }, (err: Error | null) => {
        if (err) {
          logError('FxMessageBridge publishSyncTime erro', err, { topic }).catch(() => {});
        } else {
          logInfo('FxMessageBridge publishSyncTime ok', { topic, serverTime });
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxMessageBridge publishSyncTime exception', e.error, { topic }).catch(() => {});
    }
  }

  /**
   * Publica telemetria de execução de efeito em smartdisplay/{site_id}/telemetry
   */
  async publishTelemetry(telemetry: FxTelemetryMessage): Promise<void> {
    const topic = this.buildTopic(telemetry.site_id, 'telemetry');

    if (!this.connected || !this.client) {
      await logWarn('FxMessageBridge.publishTelemetry (MQTT indisponível, log-only)', {
        topic,
        totemId: telemetry.totem_id,
        effectId: telemetry.effect_id,
      }).catch(() => {});
      return;
    }

    try {
      const payload = JSON.stringify(telemetry);
      this.client.publish(topic, payload, { qos: 0 }, (err: Error | null) => {
        if (err) {
          logError('FxMessageBridge publishTelemetry erro', err, { topic }).catch(() => {});
        } else {
          logInfo('FxMessageBridge publishTelemetry ok', { topic });
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxMessageBridge publishTelemetry exception', e.error, { topic }).catch(() => {});
    }
  }

  /**
   * Publica hint ACE sanitizado (sem snapshot, sem PII) em smartdisplay/{site}/ace_hint.
   * Sem broker: log-only, como as outras publicações.
   */
  async publishAceHint(message: FxAceHintMessage): Promise<void> {
    const siteId = message.site_id || 'lab';
    const topic = this.buildTopic(siteId, 'ace_hint');

    if (!this.connected || !this.client) {
      await logWarn('FxMessageBridge.publishAceHint (MQTT indisponível, log-only)', {
        topic,
        totemId: message.totem_id,
        category: message.category,
      }).catch(() => {});
      return;
    }

    try {
      const payload = JSON.stringify(message);
      this.client.publish(topic, payload, { qos: 0 }, (err: Error | null) => {
        if (err) {
          logError('FxMessageBridge publishAceHint erro', err, { topic }).catch(() => {});
        } else {
          logInfo('FxMessageBridge publishAceHint ok', { topic, category: message.category });
        }
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('FxMessageBridge publishAceHint exception', e.error, { topic }).catch(() => {});
    }
  }

  /**
   * Verifica se está conectado ao broker
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Reconecta ao broker (se desconectado)
   */
  reconnect(): void {
    if (!this.connected && messagingConfig.mqtt.enabled) {
      this.connect();
    }
  }

  private buildTopic(siteId: string, suffix: string): string {
    const base = messagingConfig.mqtt.prefix || 'smartdisplay';
    return `${base}/${siteId}/${suffix}`;
  }
}

let fxMessageBridgeInstance: FxMessageBridge | null = null;

export function getFxMessageBridge(): FxMessageBridge {
  if (!fxMessageBridgeInstance) {
    fxMessageBridgeInstance = new FxMessageBridge();
  }
  return fxMessageBridgeInstance;
}

