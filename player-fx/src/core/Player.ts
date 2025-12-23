/**
 * Player - SmartDisplayFX Plus Player Core
 * Classe principal do player
 */

import { Config, getInstance as getConfig } from './Config';
import { State, getInstance as getState } from './State';
import { MQTTClient } from '../mqtt/MQTTClient';
import { EffectEngine } from '../effects/EffectEngine';

export interface PlayerOptions {
  totemId: string;
  siteId: string;
  brokerUrl?: string;
  apiBaseUrl?: string;
  debug?: boolean;
}

export class SmartDisplayFXPlayer {
  private config: Config;
  private state: State;
  private mqttClient: MQTTClient;
  private effectEngine: EffectEngine;
  private animationFrameId: number | null = null;
  private syncIntervalId: number | null = null;

  constructor(options: PlayerOptions) {
    this.config = getConfig();
    this.state = getState();

    // Configurar
    this.config.update({
      totemId: options.totemId,
      siteId: options.siteId,
      brokerUrl: options.brokerUrl,
      apiBaseUrl: options.apiBaseUrl || 'http://localhost:3000',
      debug: options.debug || false,
    });

    // Inicializar componentes
    this.mqttClient = new MQTTClient(this.config);
    this.effectEngine = new EffectEngine(this.config);
  }

  /**
   * Inicializa o player
   */
  async init(): Promise<void> {
    try {
      console.log('🎬 Inicializando SmartDisplayFX Player...');

      // Carregar configuração
      await this.config.load();

      // Inicializar MQTT
      await this.mqttClient.connect();
      this.mqttClient.onMessage((topic, message) => {
        this.handleMQTTMessage(topic, message);
      });

      // Inicializar Effect Engine
      await this.effectEngine.init();

      // Iniciar loop de renderização
      this.startRenderLoop();

      // Iniciar sincronização de tempo
      if (this.config.getValue('timeSyncEnabled')) {
        this.startTimeSync();
      }

      this.state.update({ isConnected: true, isPlaying: true });

      console.log('✅ SmartDisplayFX Player inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar player:', error);
      throw error;
    }
  }

  /**
   * Inicia o player
   */
  async start(): Promise<void> {
    await this.init();
  }

  /**
   * Para o player
   */
  stop(): void {
    console.log('🛑 Parando SmartDisplayFX Player...');

    // Parar loop de renderização
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Parar sincronização
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    // Desconectar MQTT
    this.mqttClient.disconnect();

    // Limpar efeitos
    this.effectEngine.cleanup();

    this.state.update({ isConnected: false, isPlaying: false });
    console.log('✅ Player parado');
  }

  /**
   * Processa mensagens MQTT
   */
  private handleMQTTMessage(topic: string, message: any): void {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;

      if (topic.includes('/effect')) {
        this.handleEffectMessage(data);
      } else if (topic.includes('/timeline')) {
        this.handleTimelineMessage(data);
      } else if (topic.includes('/sync_time')) {
        this.handleSyncTimeMessage(data);
      } else if (topic.includes('/telemetry')) {
        this.handleTelemetryMessage(data);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem MQTT:', error);
    }
  }

  /**
   * Processa mensagem de efeito
   */
  private handleEffectMessage(data: any): void {
    const { effect_id, from, to, content_id, start_ts, duration_ms, params } = data;
    const totemId = this.config.getValue('totemId');

    // Verificar se é para este totem
    if (to !== totemId && !to.includes(totemId)) {
      return;
    }

    // Agendar efeito
    const startTime = new Date(start_ts).getTime();
    const currentTime = this.state.getSyncedTime();

    if (startTime > currentTime) {
      // Agendar para o futuro
      setTimeout(() => {
        this.effectEngine.playEffect(effect_id, params, duration_ms, content_id);
      }, startTime - currentTime);
    } else {
      // Executar imediatamente
      this.effectEngine.playEffect(effect_id, params, duration_ms, content_id);
    }
  }

  /**
   * Processa mensagem de timeline
   */
  private handleTimelineMessage(data: any): void {
    const { timeline_id, version, events } = data;
    
    this.state.update({
      currentTimeline: {
        timelineId: timeline_id,
        version,
        events,
        activeEventIndex: 0,
      },
    });

    // Processar eventos da timeline
    this.processTimelineEvents();
  }

  /**
   * Processa mensagem de sincronização de tempo
   */
  private handleSyncTimeMessage(data: any): void {
    const { server_time, server_timestamp } = data;
    const clientTime = Date.now();
    const serverTime = new Date(server_time).getTime();

    this.state.updateTimeSync(serverTime, clientTime);
  }

  /**
   * Processa mensagem de telemetria
   */
  private handleTelemetryMessage(data: any): void {
    // Telemetria recebida de outros totens (para monitoramento)
    if (this.config.getValue('debug')) {
      console.log('📊 Telemetria recebida:', data);
    }
  }

  /**
   * Processa eventos da timeline
   */
  private processTimelineEvents(): void {
    const timeline = this.state.get().currentTimeline;
    if (!timeline) return;

    const currentTime = this.state.getSyncedTime();

    for (let i = timeline.activeEventIndex; i < timeline.events.length; i++) {
      const event = timeline.events[i];
      const eventTime = new Date(event.startTs).getTime();

      if (eventTime <= currentTime && eventTime + event.durationMs > currentTime) {
        // Evento ativo
        this.effectEngine.playEffect(
          event.effectType,
          event.params || {},
          event.durationMs,
          event.contentId
        );
        timeline.activeEventIndex = i;
      } else if (eventTime > currentTime) {
        // Evento futuro - agendar
        setTimeout(() => {
          this.effectEngine.playEffect(
            event.effectType,
            event.params || {},
            event.durationMs,
            event.contentId
          );
        }, eventTime - currentTime);
      }
    }
  }

  /**
   * Inicia loop de renderização
   */
  private startRenderLoop(): void {
    const render = () => {
      const currentTime = this.state.getSyncedTime();

      // Limpar efeitos expirados
      this.state.clearExpiredEffects(currentTime);

      // Renderizar efeitos
      this.effectEngine.render(currentTime);

      // Enviar telemetria pendente
      this.flushTelemetry();

      this.animationFrameId = requestAnimationFrame(render);
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  /**
   * Inicia sincronização de tempo
   */
  private startTimeSync(): void {
    const syncInterval = this.config.getValue('syncIntervalMs');
    
    this.syncIntervalId = window.setInterval(() => {
      // Solicitar sincronização de tempo do backend
      fetch(`${this.config.getValue('apiBaseUrl')}/api/smartdisplayfx/sync-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: this.config.getValue('siteId'),
        }),
      }).catch(error => {
        console.error('Erro ao sincronizar tempo:', error);
      });
    }, syncInterval);
  }

  /**
   * Envia telemetria pendente
   */
  private flushTelemetry(): void {
    const queue = this.state.flushTelemetryQueue();
    if (queue.length === 0) return;

    // Enviar para backend
    queue.forEach(telemetry => {
      fetch(`${this.config.getValue('apiBaseUrl')}/api/smartdisplayfx/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totem_id: this.config.getValue('totemId'),
          effect_id: telemetry.effectId,
          status: telemetry.status,
          duration_ms: telemetry.duration,
          metadata: telemetry.metadata,
        }),
      }).catch(error => {
        console.error('Erro ao enviar telemetria:', error);
      });
    });
  }
}

