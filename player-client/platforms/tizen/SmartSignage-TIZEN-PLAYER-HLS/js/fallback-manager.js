/**
 * FallbackManager - Gerencia fallback offline quando stream principal falha
 * Prioridade: Pendrive/USB → SSD → Cache
 */

class FallbackManager {
  constructor(primaryStream, fallbackUrls = []) {
    this.primaryStream = primaryStream;
    this.fallbackUrls = Array.isArray(fallbackUrls) ? fallbackUrls : [fallbackUrls];
    this.fallbackActive = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.currentFallbackIndex = 0;
    this.player = null; // Referência ao HLSPlayer
    this.retryInterval = null;
  }

  /**
   * Define referência ao player
   */
  setPlayer(player) {
    this.player = player;
  }

  /**
   * Configura fallback URLs
   */
  setFallbackUrls(urls) {
    this.fallbackUrls = Array.isArray(urls) ? urls : [urls];
  }

  /**
   * Adiciona URL de fallback
   */
  addFallbackUrl(url) {
    if (!this.fallbackUrls.includes(url)) {
      this.fallbackUrls.push(url);
    }
  }

  /**
   * Handler de erro - chamado quando stream principal falha
   */
  async handleError() {
    this.retryCount++;

    console.log(`[Fallback] Erro no stream principal (tentativa ${this.retryCount}/${this.maxRetries})`);

    if (this.retryCount <= this.maxRetries) {
      // Tentar stream principal novamente após delay
      setTimeout(async () => {
        try {
          console.log('[Fallback] Tentando reconectar ao stream principal...');
          if (this.player) {
            await this.player.play(this.primaryStream);
            this.retryCount = 0; // Reset se sucesso
          }
        } catch (error) {
          console.warn('[Fallback] Falha ao reconectar:', error);
          if (this.retryCount >= this.maxRetries) {
            this.activateFallback();
          }
        }
      }, 3000);
    } else {
      // Ativar fallback após max tentativas
      this.activateFallback();
    }
  }

  /**
   * Ativa fallback (reproduz vídeo local)
   */
  activateFallback() {
    if (this.fallbackActive) {
      console.log('[Fallback] Fallback já está ativo');
      return;
    }

    if (this.fallbackUrls.length === 0) {
      console.warn('[Fallback] Nenhuma URL de fallback configurada');
      return;
    }

    console.log('[Fallback] Ativando fallback offline');
    this.fallbackActive = true;

    // Tentar próximo fallback disponível
    this.tryNextFallback();
  }

  /**
   * Tenta próximo fallback disponível
   */
  async tryNextFallback() {
    if (this.currentFallbackIndex >= this.fallbackUrls.length) {
      console.error('[Fallback] Todos os fallbacks falharam');
      this.currentFallbackIndex = 0; // Reset para próxima tentativa
      return;
    }

    const fallbackUrl = this.fallbackUrls[this.currentFallbackIndex];
    console.log(`[Fallback] Tentando fallback ${this.currentFallbackIndex + 1}/${this.fallbackUrls.length}:`, fallbackUrl);

    try {
      if (this.player) {
        // Configurar loop para fallback
        if (this.player.video) {
          this.player.video.loop = true;
        }
        
        await this.player.play(fallbackUrl);
        console.log('[Fallback] Fallback ativado com sucesso');
        
        // Tentar retornar ao stream principal periodicamente
        this.startPrimaryStreamRetry();
      }
    } catch (error) {
      console.warn(`[Fallback] Falha ao ativar fallback ${fallbackUrl}:`, error);
      this.currentFallbackIndex++;
      setTimeout(() => this.tryNextFallback(), 5000);
    }
  }

  /**
   * Inicia tentativas periódicas de retornar ao stream principal
   */
  startPrimaryStreamRetry() {
    // Limpar intervalo anterior se existir
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }

    // Tentar stream principal a cada 60 segundos
    this.retryInterval = setInterval(() => {
      this.tryPrimaryStream();
    }, 60000);
  }

  /**
   * Tenta retornar ao stream principal
   */
  async tryPrimaryStream() {
    try {
      console.log('[Fallback] Testando se stream principal voltou...');
      
      // Testar se stream principal está disponível
      // Usar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const testResponse = await fetch(this.primaryStream, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (testResponse.ok) {
        console.log('[Fallback] Stream principal recuperado! Retornando...');
        this.fallbackActive = false;
        this.retryCount = 0;
        this.currentFallbackIndex = 0;

        // Parar retry interval
        if (this.retryInterval) {
          clearInterval(this.retryInterval);
          this.retryInterval = null;
        }

        // Retornar ao stream principal
        if (this.player) {
          if (this.player.video) {
            this.player.video.loop = false; // Desabilitar loop
          }
          await this.player.play(this.primaryStream);
        }
      }
    } catch (error) {
      // Stream ainda indisponível - continuar em fallback
      console.log('[Fallback] Stream principal ainda indisponível');
    }
  }

  /**
   * Reseta estado do fallback
   */
  reset() {
    this.fallbackActive = false;
    this.retryCount = 0;
    this.currentFallbackIndex = 0;

    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * Verifica se fallback está ativo
   */
  isActive() {
    return this.fallbackActive;
  }
}

// Exportar para uso global
window.FallbackManager = FallbackManager;

