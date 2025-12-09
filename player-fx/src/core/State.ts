/**
 * State - SmartDisplayFX Player State Management
 * Gerencia estado do player
 */

export interface PlayerState {
  // Status
  isConnected: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  
  // Sincronização
  serverTimeOffset: number; // Offset em ms entre servidor e cliente
  lastSyncTime: number;
  
  // Timeline
  currentTimeline: {
    timelineId: string;
    version: number;
    events: any[];
    activeEventIndex: number;
  } | null;
  
  // Efeitos ativos
  activeEffects: Map<string, {
    effectId: string;
    startTime: number;
    duration: number;
    params: any;
  }>;
  
  // Cache
  cachedContent: Map<string, any>;
  
  // Telemetria
  telemetryQueue: Array<{
    effectId: string;
    status: 'success' | 'failed' | 'timeout' | 'cancelled';
    duration: number;
    metadata: any;
  }>;
}

export function getInstance(): State {
  if (!State.instance) {
    State.instance = new State();
  }
  return State.instance;
}

export class State {
  private static instance: State;
  private state: PlayerState;

  private constructor() {
    this.state = {
      isConnected: false,
      isPlaying: false,
      isPaused: false,
      serverTimeOffset: 0,
      lastSyncTime: 0,
      currentTimeline: null,
      activeEffects: new Map(),
      cachedContent: new Map(),
      telemetryQueue: [],
    };
  }

  static getInstance(): State {
    if (!State.instance) {
      State.instance = new State();
    }
    return State.instance;
  }

  /**
   * Obtém estado completo
   */
  get(): PlayerState {
    return { ...this.state };
  }

  /**
   * Atualiza estado
   */
  update(updates: Partial<PlayerState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Adiciona efeito ativo
   */
  addActiveEffect(id: string, effect: {
    effectId: string;
    startTime: number;
    duration: number;
    params: any;
  }): void {
    this.state.activeEffects.set(id, effect);
  }

  /**
   * Remove efeito ativo
   */
  removeActiveEffect(id: string): void {
    this.state.activeEffects.delete(id);
  }

  /**
   * Limpa efeitos expirados
   */
  clearExpiredEffects(currentTime: number): void {
    for (const [id, effect] of this.state.activeEffects.entries()) {
      if (currentTime >= effect.startTime + effect.duration) {
        this.state.activeEffects.delete(id);
      }
    }
  }

  /**
   * Adiciona conteúdo ao cache
   */
  cacheContent(key: string, content: any): void {
    this.state.cachedContent.set(key, content);
  }

  /**
   * Obtém conteúdo do cache
   */
  getCachedContent(key: string): any | undefined {
    return this.state.cachedContent.get(key);
  }

  /**
   * Adiciona telemetria à fila
   */
  queueTelemetry(telemetry: {
    effectId: string;
    status: 'success' | 'failed' | 'timeout' | 'cancelled';
    duration: number;
    metadata: any;
  }): void {
    this.state.telemetryQueue.push(telemetry);
  }

  /**
   * Obtém e limpa fila de telemetria
   */
  flushTelemetryQueue(): Array<typeof this.state.telemetryQueue[0]> {
    const queue = [...this.state.telemetryQueue];
    this.state.telemetryQueue = [];
    return queue;
  }

  /**
   * Calcula tempo sincronizado (tempo do servidor)
   */
  getSyncedTime(): number {
    return Date.now() + this.state.serverTimeOffset;
  }

  /**
   * Atualiza offset de tempo do servidor
   */
  updateTimeSync(serverTime: number, clientTime: number): void {
    this.state.serverTimeOffset = serverTime - clientTime;
    this.state.lastSyncTime = Date.now();
  }
}

