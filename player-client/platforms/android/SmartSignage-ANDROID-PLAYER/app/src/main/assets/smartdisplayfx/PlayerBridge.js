/**
 * PlayerBridge - Ponte de Integração com o Player Principal
 *
 * Responsável por:
 *  - ler status do conteúdo atual do player (contentId, estado de playback, modo);
 *  - saber quando pode interromper ou sobrepor conteúdo;
 *  - fornecer informações contextuais para o FxEngine.
 *
 * Esta é uma interface abstrata que deve ser implementada conforme
 * a plataforma e o player específico (webOS, Tizen, Android TV, Electron).
 */

export class PlayerBridge {
  constructor(options = {}) {
    this.playerInstance = options.playerInstance || null;
    this.logHandler = options.onLog || (() => {});
    this.onContentChange = options.onContentChange || null;
    this.onPlaybackStateChange = options.onPlaybackStateChange || null;

    // Estado atual (cache)
    this.currentContentId = null;
    this.currentPlaybackState = 'idle'; // 'idle' | 'playing' | 'paused' | 'loading'
    this.currentMode = 'normal'; // 'normal' | 'promo' | 'event' | 'ambient'
    this.currentPlaylistId = null;
    this.currentCampaignId = null;
  }

  setLogger(fn) {
    this.logHandler = typeof fn === 'function' ? fn : () => {};
  }

  log(msg, extra) {
    try {
      this.logHandler(msg, extra);
    } catch {
      // ignore
    }
  }

  /**
   * Conecta ao player principal (deve ser implementado pela plataforma).
   */
  connect() {
    this.log('PlayerBridge.connect: método base (deve ser sobrescrito)');
  }

  /**
   * Desconecta do player principal.
   */
  disconnect() {
    this.log('PlayerBridge.disconnect');
    this.currentContentId = null;
    this.currentPlaybackState = 'idle';
    this.currentMode = 'normal';
  }

  /**
   * Obtém o contentId atual do player.
   * @returns {number|null}
   */
  getCurrentContentId() {
    return this.currentContentId;
  }

  /**
   * Obtém o estado de playback atual.
   * @returns {string} 'idle' | 'playing' | 'paused' | 'loading'
   */
  getCurrentPlaybackState() {
    return this.currentPlaybackState;
  }

  /**
   * Obtém o modo atual do player.
   * @returns {string} 'normal' | 'promo' | 'event' | 'ambient'
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * Obtém o playlistId atual.
   * @returns {number|null}
   */
  getCurrentPlaylistId() {
    return this.currentPlaylistId;
  }

  /**
   * Obtém o campaignId atual.
   * @returns {number|null}
   */
  getCurrentCampaignId() {
    return this.currentCampaignId;
  }

  /**
   * Verifica se o player está em um estado que permite interrupção/sobreposição.
   * @returns {boolean}
   */
  canInterrupt() {
    // Por padrão, permite interrupção se estiver playing ou paused
    return this.currentPlaybackState === 'playing' || this.currentPlaybackState === 'paused';
  }

  /**
   * Verifica se o player está em modo que permite efeitos FX.
   * @returns {boolean}
   */
  allowsFxEffects() {
    // Por padrão, permite em todos os modos exceto se estiver em modo especial
    return this.currentMode !== 'maintenance';
  }

  /**
   * Atualiza o estado interno (chamado por implementações específicas).
   */
  updateState(state) {
    const oldContentId = this.currentContentId;
    const oldPlaybackState = this.currentPlaybackState;
    const oldMode = this.currentMode;

    if (state.contentId !== undefined) {
      this.currentContentId = state.contentId;
    }
    if (state.playbackState !== undefined) {
      this.currentPlaybackState = state.playbackState;
    }
    if (state.mode !== undefined) {
      this.currentMode = state.mode;
    }
    if (state.playlistId !== undefined) {
      this.currentPlaylistId = state.playlistId;
    }
    if (state.campaignId !== undefined) {
      this.currentCampaignId = state.campaignId;
    }

    // Notificar mudanças
    if (oldContentId !== this.currentContentId && this.onContentChange) {
      try {
        this.onContentChange(this.currentContentId, oldContentId);
      } catch (e) {
        this.log('PlayerBridge: erro em onContentChange', { error: String(e) });
      }
    }

    if (oldPlaybackState !== this.currentPlaybackState && this.onPlaybackStateChange) {
      try {
        this.onPlaybackStateChange(this.currentPlaybackState, oldPlaybackState);
      } catch (e) {
        this.log('PlayerBridge: erro em onPlaybackStateChange', { error: String(e) });
      }
    }
  }

  /**
   * Obtém informações completas do estado atual (para debug/logging).
   * @returns {Object}
   */
  getState() {
    return {
      contentId: this.currentContentId,
      playbackState: this.currentPlaybackState,
      mode: this.currentMode,
      playlistId: this.currentPlaylistId,
      campaignId: this.currentCampaignId,
      canInterrupt: this.canInterrupt(),
      allowsFxEffects: this.allowsFxEffects(),
    };
  }
}

/**
 * PlayerBridge para ambiente web/browser (exemplo básico).
 * Pode ser usado em protótipos ou players baseados em HTML5.
 */
export class WebPlayerBridge extends PlayerBridge {
  constructor(options = {}) {
    super(options);
    this.videoElement = options.videoElement || null;
    this.pollInterval = options.pollInterval || 1000; // ms
    this.pollTimer = null;
  }

  connect() {
    super.connect();
    this.log('WebPlayerBridge: conectado');

    // Polling básico (em produção, usar eventos do player)
    if (this.videoElement) {
      this.videoElement.addEventListener('play', () => {
        this.updateState({ playbackState: 'playing' });
      });
      this.videoElement.addEventListener('pause', () => {
        this.updateState({ playbackState: 'paused' });
      });
      this.videoElement.addEventListener('loadstart', () => {
        this.updateState({ playbackState: 'loading' });
      });
      this.videoElement.addEventListener('ended', () => {
        this.updateState({ playbackState: 'idle' });
      });
    }

    // Polling periódico (fallback)
    this.pollTimer = setInterval(() => {
      this._pollState();
    }, this.pollInterval);
  }

  disconnect() {
    super.disconnect();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.log('WebPlayerBridge: desconectado');
  }

  _pollState() {
    if (!this.videoElement) return;

    let playbackState = 'idle';
    if (this.videoElement.readyState >= 2) {
      if (this.videoElement.paused) {
        playbackState = 'paused';
      } else {
        playbackState = 'playing';
      }
    } else {
      playbackState = 'loading';
    }

    // Tentar extrair contentId de data-attributes ou metadata
    const contentId = this.videoElement.dataset?.contentId
      ? parseInt(this.videoElement.dataset.contentId, 10)
      : null;

    this.updateState({
      playbackState,
      contentId,
    });
  }
}

