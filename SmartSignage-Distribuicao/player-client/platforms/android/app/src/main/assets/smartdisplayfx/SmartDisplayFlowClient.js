/**
 * SmartDisplayFlowClient - Cliente do protocolo SmartDisplayFlow
 * -----------------------------------------------------------------------------
 * Versão atual:
 *  - Usa transporte PLUGÁVEL (prioridade produção):
 *    - MqttWebSocketTransport (padrão, produção)
 *    - LocalStorageTransport (fallback para desenvolvimento)
 *  - Pensado para rodar em browser (webOS/Tizen/Android TV/Electron via WebView).
 *
 * API principal:
 *  - connect(siteId, totemId)
 *  - publishEffectTransfer(effectPayload)
 *  - sendInteractionEvent(event)
 *  - sendAiEvent(event)
 *  - onEffect(handler)
 *  - onTimeline(handler)      // reservado p/ evolução
 *  - onSyncTime(handler)      // reservado p/ evolução
 *  - onLog(handler)           // log callback opcional
 *
 * Transporte:
 *  - options.transport: implementação custom (opcional)
 *  - options.transportType: 'localstorage' | 'mqtt' (padrão: 'localstorage')
 *  - options.mqttUrl / options.mqttOptions / options.mqttPrefix
 */

export class SmartDisplayFlowClient {
  constructor(options = {}) {
    this.siteId = options.siteId || 'site-01';
    this.totemId = options.totemId || 'totem-01';
    this.connected = false;

    // Backend REST (opcional) para enviar eventos de interação/IA
    this.backendBaseUrl = options.backendBaseUrl || null;
    this.getAuthToken = options.getAuthToken || null;

    // Transporte pluggable (LocalStorage ou MQTT)
    this.transport =
      options.transport ||
      this._createTransport(options);

    this.logHandler = options.onLog || (() => {});
    this.effectHandlers = [];
    this.timelineHandlers = [];
    this.syncTimeHandlers = [];

    this._boundOnMessage = this._onMessage.bind(this);
    if (this.transport && typeof this.transport.subscribe === 'function') {
      this.transport.subscribe(this._boundOnMessage);
    }
  }

  setLogger(fn) {
    this.logHandler = typeof fn === 'function' ? fn : () => {};
  }

  /**
   * Cria transporte com base nas opções.
   * - Prioriza MQTT (produção)
   * - Fallback: LocalStorage (desenvolvimento)
   */
  _createTransport(options = {}) {
    const transportType = (options.transportType || 'auto').toLowerCase();

    // Se explicitamente solicitado LocalStorage (desenvolvimento/teste)
    if (transportType === 'localstorage') {
      this.log('SmartDisplayFlowClient: usando LocalStorageTransport (modo desenvolvimento)', {});
      return new LocalStorageTransport({
        prefix: options.prefix || 'sdfx:pub:',
      });
    }

    try {
      // 1. Tentar MQTT primeiro (produção)
      let mqttAvailable = false;
      let mqttLib = null;

      // 1.1 window.mqtt (CDN)
      if (typeof window !== 'undefined' && window.mqtt) {
        mqttAvailable = true;
        mqttLib = window.mqtt;
      }
      // 1.2 require('mqtt') (npm - Electron/Node)
      else if (typeof require !== 'undefined') {
        try {
          mqttLib = require('mqtt');
          mqttAvailable = true;
        } catch (e) {
          // ignore
        }
      }

      if (mqttAvailable && mqttLib) {
        const url = options.mqttUrl || options.brokerUrl || 'ws://localhost:9001';
        const prefix = options.mqttPrefix || 'smartdisplay';
        const mqttOptions = options.mqttOptions || {};

        this.log('SmartDisplayFlowClient: usando MqttWebSocketTransport (Android assets)', { url, prefix });
        return new MqttWebSocketTransport({
          url,
          siteId: this.siteId,
          prefix,
          mqttOptions,
          onLog: (msg, extra) => this.log(msg, extra),
        });
      }

      // 2. Fallback: LocalStorage (apenas desenvolvimento)
      this.log('SmartDisplayFlowClient: MQTT não disponível, usando LocalStorageTransport (fallback)', {});
      return new LocalStorageTransport({
        prefix: options.prefix || 'sdfx:pub:',
      });
    } catch (e) {
      this.log('SmartDisplayFlowClient: erro ao criar transporte, usando LocalStorageTransport (fallback)', {
        error: String(e),
      });
      return new LocalStorageTransport({
        prefix: options.prefix || 'sdfx:pub:',
      });
    }
  }

  log(msg, extra) {
    try {
      this.logHandler(msg, extra);
    } catch {
      // ignore
    }
  }

  connect(siteId, totemId) {
    if (siteId) this.siteId = siteId;
    if (totemId) this.totemId = totemId;
    this.connected = true;
    this.log(`SmartDisplayFlowClient conectado: site=${this.siteId}, totem=${this.totemId}`);
  }

  disconnect() {
    this.connected = false;
    this.log('SmartDisplayFlowClient desconectado');
  }

  // ---------------------------------------------------------------------------
  // Public API - handlers
  // ---------------------------------------------------------------------------

  onEffect(handler) {
    if (typeof handler === 'function') {
      this.effectHandlers.push(handler);
    }
  }

  onTimeline(handler) {
    if (typeof handler === 'function') {
      this.timelineHandlers.push(handler);
    }
  }

  onSyncTime(handler) {
    if (typeof handler === 'function') {
      this.syncTimeHandlers.push(handler);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API - publish
  // ---------------------------------------------------------------------------

  /**
   * Publica um comando de efeito direto (effect_transfer)
   * conforme SmartDisplayFlow.
   *
   * payload esperado (campos principais):
   * {
   *   effect_id: 'neon_warp_v1',
   *   from: { totem: 'TOTEM_001', edge: 'right' },
   *   to:   { totem: 'TOTEM_002', edge: 'left' },
   *   content_id: 123,
   *   start_ts: 'ISO-STRING',
   *   duration_ms: 1600,
   *   params: { ... }
   * }
   */
  publishEffectTransfer(payload) {
    if (!this.connected) {
      this.log('publishEffectTransfer chamado sem conexão ativa');
      return;
    }

    const msg = {
      msg_type: 'effect_transfer',
      site_id: this.siteId,
      effect_id: payload.effect_id || 'neon_warp_v1',
      from: payload.from || { totem: this.totemId, edge: 'right' },
      to: payload.to,
      content_id: payload.content_id ?? null,
      start_ts: payload.start_ts || new Date().toISOString(),
      duration_ms: payload.duration_ms ?? 1600,
      params: payload.params || {},
    };

    const topic = `${this.siteId}/effect`;
    this.transport.publish(topic, msg);
    this.log('effect_transfer publicado', { topic, msg });
  }

  /**
   * Envia evento de interação ao backend (REST) usando o contrato
   * de /api/smartdisplayfx/events/interaction
   */
  async sendInteractionEvent(event) {
    if (!this.backendBaseUrl) {
      this.log('sendInteractionEvent ignorado: backendBaseUrl não definido');
      return;
    }

    const body = {
      siteId: event.siteId || this.siteId,
      totemId: event.totemId || this.totemId,
      interactionType: event.interactionType,
      tagId: event.tagId,
      contentId: event.contentId,
      timestamp: event.timestamp || new Date().toISOString(),
      extra: event.extra || null,
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof this.getAuthToken === 'function') {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${this.backendBaseUrl}/api/smartdisplayfx/events/interaction`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        this.log('sendInteractionEvent falhou', { status: res.status, text });
      } else {
        this.log('sendInteractionEvent enviado', body);
      }
    } catch (e) {
      this.log('Erro em sendInteractionEvent', { error: String(e) });
    }
  }

  /**
   * Envia evento de IA ao backend (REST) usando o contrato
   * de /api/smartdisplayfx/events/ai
   */
  async sendAiEvent(event) {
    if (!this.backendBaseUrl) {
      this.log('sendAiEvent ignorado: backendBaseUrl não definido');
      return;
    }

    const body = {
      siteId: event.siteId || this.siteId,
      totemId: event.totemId || this.totemId,
      eventId: event.eventId || `ai_${Date.now()}`,
      eventType: event.eventType,
      payload: event.payload || {},
      timestamp: event.timestamp || new Date().toISOString(),
    };

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof this.getAuthToken === 'function') {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const res = await fetch(`${this.backendBaseUrl}/api/smartdisplayfx/events/ai`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        this.log('sendAiEvent falhou', { status: res.status, text });
      } else {
        this.log('sendAiEvent enviado', body);
      }
    } catch (e) {
      this.log('Erro em sendAiEvent', { error: String(e) });
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _onMessage(topic, payload) {
    if (!payload || typeof payload !== 'object') return;

    const type = payload.msg_type || payload.cmd;

    // Apenas processa mensagens do mesmo site
    if (payload.site_id && payload.site_id !== this.siteId) return;

    switch (type) {
      case 'effect_transfer':
        this._handleEffectTransfer(topic, payload);
        break;
      case 'timeline_update':
        this._handleTimelineUpdate(topic, payload);
        break;
      case 'sync_time':
        this._handleSyncTime(topic, payload);
        break;
      default:
        // ignorar por enquanto
        break;
    }
  }

  _handleEffectTransfer(topic, payload) {
    const fromTotem = payload.from?.totem;
    const toTotem = payload.to?.totem;

    // Este cliente só se interessa se:
    // - é o originador OU
    // - é o destino
    const isOrigin = fromTotem === this.totemId;
    const isTarget = toTotem === this.totemId;

    if (!isOrigin && !isTarget) return;

    this.log('effect_transfer recebido', { topic, payload, isOrigin, isTarget });

    for (const h of this.effectHandlers) {
      try {
        h(payload, { isOrigin, isTarget });
      } catch (e) {
        console.error('Erro em effectHandler', e);
      }
    }
  }

  _handleTimelineUpdate(topic, payload) {
    this.log('timeline_update recebido', { topic, payload });
    for (const h of this.timelineHandlers) {
      try {
        h(payload);
      } catch (e) {
        console.error('Erro em timelineHandler', e);
      }
    }
  }

  _handleSyncTime(topic, payload) {
    this.log('sync_time recebido', { topic, payload });
    for (const h of this.syncTimeHandlers) {
      try {
        h(payload);
      } catch (e) {
        console.error('Erro em syncTimeHandler', e);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Transporte baseado em localStorage (PoC)
// -----------------------------------------------------------------------------

class LocalStorageTransport {
  constructor({ prefix = 'sdfx:pub:' } = {}) {
    this.prefix = prefix;
    this.subscribers = [];

    window.addEventListener('storage', (ev) => {
      if (!ev.key || !ev.key.startsWith(this.prefix) || !ev.newValue) return;
      try {
        const msg = JSON.parse(ev.newValue);
        this._emit(msg.topic, msg.payload);
      } catch (e) {
        console.warn('SmartDisplayFlowClient LocalStorageTransport parse error', e);
      }
    });
  }

  subscribe(handler) {
    if (typeof handler === 'function') {
      this.subscribers.push(handler);
    }
  }

  publish(topic, payload) {
    const key = this.prefix + topic + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 8);
    const value = JSON.stringify({ topic, payload });
    try {
      localStorage.setItem(key, value);
      // Remover depois de um tempo para não poluir
      setTimeout(() => {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      }, 5000);
    } catch (e) {
      console.warn('SmartDisplayFlowClient LocalStorageTransport publish error', e);
    }
  }

  _emit(topic, payload) {
    for (const h of this.subscribers) {
      try {
        h(topic, payload);
      } catch (e) {
        console.error('Erro em subscriber LocalStorageTransport', e);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Transporte MQTT over WebSocket (produção / laboratório com broker real)
// -----------------------------------------------------------------------------

class MqttWebSocketTransport {
  constructor({ url, siteId, prefix = 'smartdisplay', mqttOptions = {}, onLog = () => {} } = {}) {
    this.url = url;
    this.siteId = siteId || 'site-01';
    this.prefix = prefix || 'smartdisplay';
    this.mqttOptions = mqttOptions || {};
    this.subscribers = [];
    this.client = null;
    this.connected = false;
    this.onLog = typeof onLog === 'function' ? onLog : () => {};

    this._initClient();
  }

  _log(msg, extra) {
    try {
      this.onLog(`[MqttTransport] ${msg}`, extra);
    } catch {
      // ignore
    }
  }

  _initClient() {
    try {
      // Tentar múltiplas fontes para mqtt
      let mqttLib = null;
      
      // 1. window.mqtt (CDN - webOS/Tizen)
      if (typeof window !== 'undefined' && window.mqtt) {
        mqttLib = window.mqtt;
      }
      // 2. require('mqtt') (npm - Electron)
      else if (typeof require !== 'undefined') {
        try {
          mqttLib = require('mqtt');
        } catch (e) {
          // require não disponível ou mqtt não instalado
        }
      }

      if (!mqttLib) {
        this._log('mqtt não encontrado (window.mqtt ou require); transporte MQTT desabilitado', {});
        return;
      }

      const client = mqttLib.connect(this.url, this.mqttOptions);
      this.client = client;

      client.on('connect', () => {
        this.connected = true;
        this._log('conectado ao broker MQTT', { url: this.url });

        // Assinar tópicos principais SmartDisplayFX
        const base = `${this.prefix}/${this.siteId}`;
        client.subscribe(`${base}/effect`);
        client.subscribe(`${base}/timeline`);
        client.subscribe(`${base}/sync/time`);
      });

      client.on('message', (topic, payloadBuffer) => {
        try {
          const text = payloadBuffer.toString();
          const payload = JSON.parse(text);
          // Repassar para os subscribers (SmartDisplayFlowClient)
          this._emit(topic, payload);
        } catch (e) {
          this._log('erro ao processar mensagem MQTT', { error: String(e) });
        }
      });

      client.on('error', (err) => {
        this.connected = false;
        this._log('erro na conexão MQTT', { error: String(err) });
      });

      client.on('close', () => {
        this.connected = false;
        this._log('conexão MQTT fechada', {});
      });
    } catch (e) {
      this._log('falha ao inicializar cliente MQTT', { error: String(e) });
    }
  }

  subscribe(handler) {
    if (typeof handler === 'function') {
      this.subscribers.push(handler);
    }
  }

  /**
   * Publica mensagem no broker.
   * O SmartDisplayFlowClient envia topic = `${siteId}/effect`, etc.
   * Aqui convertemos para: `${prefix}/${topic}` (ex.: smartdisplay/site-01/effect),
   * alinhado com o backend.
   */
  publish(topic, payload) {
    if (!this.client || !this.connected) {
      this._log('publish chamado mas MQTT não está conectado', { topic });

      // Opcional: ainda assim emitir localmente para facilitar debug
      this._emit(topic, payload);
      return;
    }

    try {
      const fullTopic = `${this.prefix}/${topic}`;
      const text = JSON.stringify(payload);
      this.client.publish(fullTopic, text);
      this._log('publish enviado', { fullTopic });
    } catch (e) {
      this._log('erro ao publicar mensagem MQTT', { error: String(e), topic });
    }
  }

  _emit(topic, payload) {
    for (const h of this.subscribers) {
      try {
        h(topic, payload);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Erro em subscriber MqttWebSocketTransport', e);
      }
    }
  }
}


