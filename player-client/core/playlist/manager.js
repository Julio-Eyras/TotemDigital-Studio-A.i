/**
 * Playlist Manager - Core
 * Gerenciador de playlist compartilhado
 */

class PlaylistManager {
  constructor(apiClient, cache) {
    this.apiClient = apiClient;
    this.cache = cache;
    this.currentPlaylist = null;
    this.currentIndex = 0;
    this.lastUpdate = null;
  }

  /**
   * Carrega playlist do servidor com validações de contrato
   */
  async loadPlaylist() {
    try {
      const playlist = await this.apiClient.getPlaylist();
      
      // Validar playlist
      if (!this.validatePlaylist(playlist)) {
        throw new Error('Invalid playlist format');
      }

      // Validar se campanha tem contrato válido (se aplicável)
      if (playlist.campaign_id && playlist.contract_valid === false) {
        console.warn('Campanha sem contrato válido, usando fallback');
        // Filtrar itens de campanha sem contrato válido
        if (playlist.items && Array.isArray(playlist.items)) {
          playlist.items = playlist.items.filter(item => {
            // Manter itens que não são de campanha ou que têm contrato válido
            return !item.campaign_id || item.contract_valid !== false;
          });
        }
      }

      // Validar acesso ao totem (se informação disponível)
      if (playlist.access_granted === false) {
        console.warn('Acesso ao totem negado via contratos/planos');
        throw new Error('Acesso negado: totem não acessível através de contratos/planos ativos');
      }

      this.currentPlaylist = playlist;
      this.lastUpdate = new Date();
      this.currentIndex = 0;

      // Cache local
      if (this.cache) {
        await this.cache.set('playlist', playlist);
        await this.cache.set('playlist_last_update', this.lastUpdate.toISOString());
      }

      return playlist;
    } catch (error) {
      console.error('Failed to load playlist:', error);
      
      // Tratamento específico para erros de validação
      if (error.status === 403 || error.code === 'FORBIDDEN') {
        console.error('Acesso negado ao totem:', error.details || error.message);
        // Tentar usar playlist padrão ou cache
      }
      
      // Tentar carregar do cache
      if (this.cache) {
        const cached = await this.cache.get('playlist');
        if (cached) {
          console.log('Using cached playlist');
          this.currentPlaylist = cached;
          return cached;
        }
      }

      throw error;
    }
  }

  /**
   * Valida formato da playlist
   */
  validatePlaylist(playlist) {
    if (!playlist || !Array.isArray(playlist.items)) {
      return false;
    }

    // Validar cada item
    for (const item of playlist.items) {
      if (!item.id || !item.type || !item.url) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtém próximo item da playlist
   */
  getNextItem() {
    if (!this.currentPlaylist || !this.currentPlaylist.items.length) {
      return null;
    }

    const item = this.currentPlaylist.items[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.currentPlaylist.items.length;
    
    return item;
  }

  /**
   * Obtém item atual
   */
  getCurrentItem() {
    if (!this.currentPlaylist || !this.currentPlaylist.items.length) {
      return null;
    }

    return this.currentPlaylist.items[this.currentIndex];
  }

  /**
   * Obtém item por ID
   */
  getItemById(id) {
    if (!this.currentPlaylist) {
      return null;
    }

    return this.currentPlaylist.items.find(item => item.id === id);
  }

  /**
   * Verifica se playlist precisa ser atualizada
   */
  needsUpdate(updateInterval = 300000) { // 5 minutos padrão
    if (!this.lastUpdate) {
      return true;
    }

    const now = new Date();
    const diff = now - this.lastUpdate;
    return diff >= updateInterval;
  }

  /**
   * Reseta playlist
   */
  reset() {
    this.currentPlaylist = null;
    this.currentIndex = 0;
    this.lastUpdate = null;
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaylistManager;
} else {
  window.PlaylistManager = PlaylistManager;
}

