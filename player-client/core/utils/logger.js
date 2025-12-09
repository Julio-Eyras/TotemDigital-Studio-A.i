/**
 * Logger - Core
 * Sistema de logging compartilhado
 */

class Logger {
  constructor(apiClient, level = 'info') {
    this.apiClient = apiClient;
    this.level = level;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
  }

  /**
   * Log de erro
   */
  error(message, error, metadata = {}) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, error, metadata);
      
      // Enviar ao backend se disponível
      if (this.apiClient && error) {
        this.apiClient.sendErrorLog(error, {
          message,
          ...metadata,
        }).catch(() => {
          // Falha silenciosa
        });
      }
    }
  }

  /**
   * Log de aviso
   */
  warn(message, metadata = {}) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, metadata);
    }
  }

  /**
   * Log de informação
   */
  info(message, metadata = {}) {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, metadata);
    }
  }

  /**
   * Log de debug
   */
  debug(message, metadata = {}) {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, metadata);
    }
  }

  /**
   * Verifica se deve logar
   */
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  /**
   * Define nível de log
   */
  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    }
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logger;
} else {
  window.Logger = Logger;
}

