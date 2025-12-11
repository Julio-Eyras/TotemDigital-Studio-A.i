/**
 * Interruption Manager - Smart Signage Pro v2.1
 * Gerencia interrupções de conteúdo baseado em prioridade
 */

class InterruptionManager {
  constructor() {
    this.currentContent = null;
    this.interruptionQueue = [];
    this.isInterrupted = false;
    this.pausedPosition = 0; // Posição onde foi pausado
    this.onInterruptCallback = null;
    this.onResumeCallback = null;
  }

  /**
   * Processa sinal de interrupção
   */
  async handleInterrupt(signal) {
    console.log('[InterruptionManager] Recebido sinal:', signal);

    // 1. Verificar se pode interromper
    if (!this.canInterrupt(signal.priority)) {
      console.log('[InterruptionManager] Não pode interromper, adicionando à fila');
      this.interruptionQueue.push(signal);
      return;
    }

    // 2. Pausar conteúdo atual
    if (this.currentContent && !this.isInterrupted) {
      await this.pauseCurrentContent();
    }

    // 3. Carregar conteúdo interativo
    const interactiveContent = await this.loadInteractiveContent(signal.contentId);

    // 4. Exibir conteúdo interativo
    await this.displayContent(interactiveContent, signal);

    // 5. Marcar como interrompido
    this.isInterrupted = true;

    // 6. Agendar retorno ao conteúdo normal
    if (signal.duration) {
      setTimeout(() => {
        this.resumeNormalContent();
      }, signal.duration);
    } else if (signal.autoResume !== false) {
      // Retomar após 10 segundos por padrão
      setTimeout(() => {
        this.resumeNormalContent();
      }, 10000);
    }
  }

  /**
   * Verifica se pode interromper conteúdo atual
   */
  canInterrupt(newPriority) {
    if (!this.currentContent) return true;
    if (this.isInterrupted) {
      // Se já está interrompido, só pode interromper se nova prioridade for maior
      return newPriority > this.getCurrentPriority();
    }

    const currentPriority = this.getContentPriority(this.currentContent);

    // Regras de interrupção:
    // - INTERACTIVE (3) sempre interrompe
    // - CRITICAL (2) interrompe HIGH (1) e NORMAL (0)
    // - HIGH (1) interrompe apenas NORMAL (0)
    // - NORMAL (0) nunca interrompe

    if (newPriority === 3) return true; // INTERACTIVE
    if (newPriority === 2 && currentPriority < 2) return true; // CRITICAL
    if (newPriority === 1 && currentPriority === 0) return true; // HIGH

    return false;
  }

  /**
   * Obtém prioridade do conteúdo atual
   */
  getCurrentPriority() {
    if (!this.currentContent) return 0;
    return this.getContentPriority(this.currentContent);
  }

  /**
   * Obtém prioridade de um conteúdo
   */
  getContentPriority(content) {
    // Prioridade pode vir do conteúdo ou ser inferida
    if (content.priority) {
      const priorityMap = {
        'normal': 0,
        'high': 1,
        'critical': 2,
        'interactive': 3
      };
      return priorityMap[content.priority] || 0;
    }
    return 0; // NORMAL por padrão
  }

  /**
   * Pausa conteúdo atual
   */
  async pauseCurrentContent() {
    console.log('[InterruptionManager] Pausando conteúdo atual');
    
    if (this.currentContent && this.currentContent.player) {
      // Salvar posição atual
      this.pausedPosition = this.currentContent.player.currentTime || 0;
      
      // Pausar reprodução
      await this.currentContent.player.pause();
    }

    if (this.onInterruptCallback) {
      this.onInterruptCallback(this.currentContent);
    }
  }

  /**
   * Carrega conteúdo interativo
   */
  async loadInteractiveContent(contentId) {
    console.log('[InterruptionManager] Carregando conteúdo interativo:', contentId);
    
    // Buscar conteúdo do cache local ou servidor
    const cacheManager = window.playlistCacheManager;
    if (cacheManager) {
      const content = await cacheManager.getMedia(contentId);
      if (content) {
        return content;
      }
    }

    // Se não estiver em cache, buscar do servidor
    const apiClient = window.apiClient;
    if (apiClient) {
      const response = await apiClient.get(`/api/media/${contentId}`);
      return response.data;
    }

    throw new Error(`Conteúdo ${contentId} não encontrado`);
  }

  /**
   * Exibe conteúdo interativo
   */
  async displayContent(content, signal) {
    console.log('[InterruptionManager] Exibindo conteúdo interativo:', content);

    // Notificar player para exibir conteúdo
    const mediaPlayer = window.mediaPlayer;
    if (mediaPlayer) {
      await mediaPlayer.play(content, {
        interrupt: true,
        metadata: signal.metadata
      });
    }

    // Notificar servidor (analytics)
    await this.notifyServer(signal);
  }

  /**
   * Retoma conteúdo normal após interrupção
   */
  async resumeNormalContent() {
    console.log('[InterruptionManager] Retomando conteúdo normal');

    this.isInterrupted = false;

    // Verificar se há mais interrupções na fila
    if (this.interruptionQueue.length > 0) {
      const nextSignal = this.interruptionQueue.shift();
      console.log('[InterruptionManager] Processando próxima interrupção da fila');
      await this.handleInterrupt(nextSignal);
      return;
    }

    // Retomar conteúdo normal
    if (this.currentContent && this.currentContent.player) {
      // Retomar da posição onde foi pausado
      this.currentContent.player.currentTime = this.pausedPosition;
      await this.currentContent.player.play();
    }

    if (this.onResumeCallback) {
      this.onResumeCallback(this.currentContent);
    }
  }

  /**
   * Define conteúdo atual
   */
  setCurrentContent(content) {
    this.currentContent = content;
    this.isInterrupted = false;
    this.pausedPosition = 0;
  }

  /**
   * Notifica servidor sobre interrupção
   */
  async notifyServer(signal) {
    try {
      const apiClient = window.apiClient;
      if (apiClient) {
        await apiClient.post('/api/analytics/interruptions', {
          type: signal.type,
          contentId: signal.contentId,
          priority: signal.priority,
          metadata: signal.metadata,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[InterruptionManager] Erro ao notificar servidor:', error);
    }
  }

  /**
   * Callbacks
   */
  onInterrupt(callback) {
    this.onInterruptCallback = callback;
  }

  onResume(callback) {
    this.onResumeCallback = callback;
  }

  /**
   * Limpa fila de interrupções
   */
  clearQueue() {
    this.interruptionQueue = [];
  }

  /**
   * Obtém status atual
   */
  getStatus() {
    return {
      isInterrupted: this.isInterrupted,
      currentContent: this.currentContent ? {
        id: this.currentContent.id,
        priority: this.getContentPriority(this.currentContent)
      } : null,
      queueLength: this.interruptionQueue.length,
      pausedPosition: this.pausedPosition
    };
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.InterruptionManager = InterruptionManager;
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InterruptionManager;
}

