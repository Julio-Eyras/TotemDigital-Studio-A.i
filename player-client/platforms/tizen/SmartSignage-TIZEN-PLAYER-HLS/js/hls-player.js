/**
 * HLSPlayer - Player de vídeo HLS usando HTML5 nativo (Tizen)
 * Sem bibliotecas externas - usa apenas <video> nativo do Tizen
 */

class HLSPlayer {
  constructor(containerId = 'player') {
    this.video = document.getElementById(containerId);
    if (!this.video) {
      throw new Error(`Elemento com id "${containerId}" não encontrado`);
    }

    this.currentStream = null;
    this.watchdogInterval = null;
    this.lastActivity = Date.now();
    
    // Configurar eventos
    this.setupEventListeners();
  }

  _coverVeil() {
    let veil = document.getElementById("media-transition-veil");
    if (!veil) {
      veil = document.createElement("div");
      veil.id = "media-transition-veil";
      veil.style.cssText =
        "position:fixed;inset:0;background:#000;z-index:9998;opacity:1;pointer-events:none;";
      document.body.appendChild(veil);
    }
    veil.style.display = "block";
    veil.style.opacity = "1";
    setTimeout(() => {
      veil.style.transition = "opacity 60ms";
      veil.style.opacity = "0";
      setTimeout(() => { veil.style.display = "none"; }, 80);
    }, 280);
  }

  /**
   * Configura event listeners do vídeo
   */
  setupEventListeners() {
    // Evento de erro
    this.video.addEventListener('error', (e) => {
      console.error('[HLSPlayer] Erro no vídeo:', e);
      this.lastActivity = Date.now();
      
      // Disparar evento customizado para FallbackManager
      if (this.onError) {
        this.onError(e);
      }
    });

    // Evento de play
    this.video.addEventListener('play', () => {
      console.log('[HLSPlayer] Reprodução iniciada');
      this.lastActivity = Date.now();
    });

    // Evento de pause
    this.video.addEventListener('pause', () => {
      console.log('[HLSPlayer] Reprodução pausada');
      this.lastActivity = Date.now();
    });

    // Evento de ended
    this.video.addEventListener('ended', () => {
      console.log('[HLSPlayer] Reprodução finalizada');
      this.lastActivity = Date.now();
    });

    // Evento de loadedmetadata
    this.video.addEventListener('loadedmetadata', () => {
      console.log('[HLSPlayer] Metadados carregados');
      this.lastActivity = Date.now();
    });

    // Evento de canplay
    this.video.addEventListener('canplay', () => {
      console.log('[HLSPlayer] Vídeo pronto para reprodução');
      this.lastActivity = Date.now();
    });
  }

  /**
   * Reproduz stream HLS
   * @param {string} streamUrl - URL do arquivo .m3u8
   * @returns {Promise}
   */
  async play(streamUrl) {
    // Não fazer nada se já está reproduzindo o mesmo stream
    if (this.currentStream === streamUrl && !this.video.paused) {
      console.log('[HLSPlayer] Stream já está sendo reproduzido:', streamUrl);
      return Promise.resolve();
    }

    console.log('[HLSPlayer] Trocando para stream:', streamUrl);
    this.currentStream = streamUrl;
    this._coverVeil();

    try {
      // Definir source do vídeo
      this.video.src = streamUrl;
      
      // Carregar vídeo
      this.video.load();

      // Tentar reproduzir
      const playPromise = this.video.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('[HLSPlayer] Reprodução iniciada com sucesso');
        this.lastActivity = Date.now();
      }
    } catch (error) {
      console.error('[HLSPlayer] Erro ao reproduzir:', error);
      throw error;
    }
  }

  /**
   * Para a reprodução
   */
  stop() {
    console.log('[HLSPlayer] Parando reprodução');
    this.video.pause();
    this.video.src = '';
    this.currentStream = null;
    this.lastActivity = Date.now();
  }

  /**
   * Pausa a reprodução
   */
  pause() {
    this.video.pause();
    this.lastActivity = Date.now();
  }

  /**
   * Resume a reprodução
   */
  resume() {
    this.video.play().catch(error => {
      console.error('[HLSPlayer] Erro ao retomar:', error);
    });
    this.lastActivity = Date.now();
  }

  /**
   * Define volume (0.0 a 1.0)
   */
  setVolume(volume) {
    this.video.volume = Math.max(0, Math.min(1, volume));
    this.video.muted = volume === 0;
    this.lastActivity = Date.now();
  }

  /**
   * Obtém URL do stream atual
   */
  getCurrentStream() {
    return this.currentStream;
  }

  /**
   * Obtém status do player
   */
  getStatus() {
    if (this.video.paused) return 'PAUSED';
    if (this.video.ended) return 'ENDED';
    if (this.video.error) return 'ERROR';
    if (this.video.readyState >= 3) return 'PLAYING';
    return 'LOADING';
  }

  /**
   * Inicia watchdog para detectar freezes
   * @param {number} interval - Intervalo em ms (padrão: 20000)
   */
  startWatchdog(interval = 20000) {
    if (this.watchdogInterval) {
      console.warn('[HLSPlayer] Watchdog já está ativo');
      return;
    }

    console.log(`[HLSPlayer] Watchdog iniciado (intervalo: ${interval}ms)`);

    this.watchdogInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - this.lastActivity;

      // Verificar se player está travado
      if (this.video.readyState < 3 || this.video.paused) {
        console.warn('[HLSPlayer] Watchdog: Player travado, reiniciando...');
        this.restart();
        return;
      }

      // Verificar se há muito tempo sem atividade (mais de 30 segundos)
      if (timeSinceActivity > 30000 && !this.video.paused) {
        console.warn('[HLSPlayer] Watchdog: Sem atividade há muito tempo, verificando estado...');
        // Tentar retomar reprodução
        this.video.play().catch(() => {
          console.warn('[HLSPlayer] Watchdog: Falha ao retomar, recarregando stream...');
          this.restart();
        });
      }
    }, interval);
  }

  /**
   * Para o watchdog
   */
  stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
      console.log('[HLSPlayer] Watchdog parado');
    }
  }

  /**
   * Reinicia o player (recarrega stream atual)
   */
  restart() {
    const currentStream = this.currentStream;
    console.log('[HLSPlayer] Reiniciando player...');
    
    this.video.load();
    
    if (currentStream) {
      this.video.src = currentStream;
      this.video.play().catch(error => {
        console.error('[HLSPlayer] Erro ao reiniciar:', error);
      });
    }
    
    this.lastActivity = Date.now();
  }

  /**
   * Callback para erros (pode ser definido externamente)
   */
  onError(error) {
    // Implementado pelo FallbackManager
  }
}

// Exportar para uso global
window.HLSPlayer = HLSPlayer;

