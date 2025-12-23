/**
 * CommandFetcher - Busca comandos do backend via HTTP polling
 * Intervalo padrão: 15 segundos
 */

class CommandFetcher {
  constructor(apiUrl, tvId, interval = 15000) {
    this.apiUrl = apiUrl;
    this.tvId = tvId;
    this.interval = interval;
    this.pollingInterval = null;
    this.token = null;
    this.onCommand = null; // Callback para processar comandos
  }

  /**
   * Define token de autenticação
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Inicia polling de comandos
   */
  start() {
    if (this.pollingInterval) {
      console.warn('[CommandFetcher] Polling já está ativo');
      return;
    }

    console.log(`[CommandFetcher] Iniciando polling (intervalo: ${this.interval}ms)`);
    
    // Buscar comandos imediatamente
    this.fetchCommand();

    // Depois, buscar periodicamente
    this.pollingInterval = setInterval(() => {
      this.fetchCommand();
    }, this.interval);
  }

  /**
   * Para o polling
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('[CommandFetcher] Polling parado');
    }
  }

  /**
   * Busca comandos do backend
   */
  async fetchCommand() {
    try {
      const url = `${this.apiUrl}/tv/${this.tvId}/command`;
      const headers = {};

      // Adicionar token se disponível
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Nenhum comando disponível - normal
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const command = await response.json();
      
      if (command && command.action) {
        console.log('[CommandFetcher] Comando recebido:', command.action);
        await this.processCommand(command);
      }

      return command;
    } catch (error) {
      console.warn('[CommandFetcher] Erro ao buscar comando:', error.message);
      return null;
    }
  }

  /**
   * Processa comando recebido
   */
  async processCommand(command) {
    if (this.onCommand) {
      // Delegar processamento para callback externo (app.js)
      await this.onCommand(command);
    } else {
      console.warn('[CommandFetcher] Nenhum handler de comando definido');
    }
  }
}

// Exportar para uso global
window.CommandFetcher = CommandFetcher;

