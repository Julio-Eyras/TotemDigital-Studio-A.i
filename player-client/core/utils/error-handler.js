/**
 * Error Handler - Core
 * Tratamento centralizado de erros
 */

class ErrorHandler {
  constructor(logger, apiClient) {
    this.logger = logger;
    this.apiClient = apiClient;
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorWindow = 60000; // 1 minuto
    this.errors = [];
  }

  /**
   * Trata erro
   */
  handle(error, context = {}) {
    this.errorCount++;
    const errorInfo = {
      error: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    };

    this.errors.push(errorInfo);

    // Limpar erros antigos
    this.cleanOldErrors();

    // Log local
    this.logger.error('Error handled', error, context);

    // Enviar ao backend (não bloqueante)
    if (this.apiClient) {
      this.apiClient.sendErrorLog(error, {
        ...context,
        errorCount: this.errorCount,
      }).catch(() => {
        // Falha silenciosa
      });
    }

    // Se muitos erros em pouco tempo, pode ser problema crítico
    if (this.errorCount >= this.maxErrors) {
      this.handleCriticalError();
    }
  }

  /**
   * Limpa erros antigos
   */
  cleanOldErrors() {
    const now = Date.now();
    this.errors = this.errors.filter(err => {
      const errTime = new Date(err.timestamp).getTime();
      return (now - errTime) < this.errorWindow;
    });
    this.errorCount = this.errors.length;
  }

  /**
   * Trata erro crítico
   */
  handleCriticalError() {
    this.logger.error('Critical error threshold reached', new Error('Too many errors'));
    
    // Tentar reiniciar aplicativo ou entrar em modo seguro
    if (typeof window !== 'undefined' && window.location) {
      // Em web, pode recarregar página
      // window.location.reload();
    }
  }

  /**
   * Reseta contador de erros
   */
  reset() {
    this.errorCount = 0;
    this.errors = [];
  }

  /**
   * Verifica se há muitos erros
   */
  hasTooManyErrors() {
    return this.errorCount >= this.maxErrors;
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
} else {
  window.ErrorHandler = ErrorHandler;
}

