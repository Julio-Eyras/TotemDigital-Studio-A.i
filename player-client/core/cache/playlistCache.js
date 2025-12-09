/**
 * Playlist Cache - Core
 * Sistema de cache local para playlists
 */

class PlaylistCache {
  constructor(storage) {
    this.storage = storage; // IndexedDB, localStorage, ou similar
  }

  /**
   * Salva playlist no cache
   */
  async savePlaylist(playlist) {
    const cacheData = {
      data: playlist,
      version: playlist.version || this.generateVersion(playlist),
      timestamp: new Date().toISOString(),
      checksum: await this.calculateChecksum(playlist)
    };

    await this.storage.set('playlist:current', cacheData);
    await this.storage.set('playlist:version', cacheData.version);
    await this.storage.set('playlist:lastUpdate', cacheData.timestamp);

    return cacheData;
  }

  /**
   * Obtém playlist do cache
   */
  async getPlaylist() {
    const cached = await this.storage.get('playlist:current');
    return cached ? cached.data : null;
  }

  /**
   * Obtém versão da playlist em cache
   */
  async getVersion() {
    return await this.storage.get('playlist:version');
  }

  /**
   * Verifica se playlist precisa ser atualizada
   */
  async needsUpdate(serverVersion) {
    const localVersion = await this.getVersion();
    if (!localVersion) {
      return true; // Não há cache local
    }

    return localVersion !== serverVersion;
  }

  /**
   * Compara duas playlists e identifica diferenças
   */
  async comparePlaylists(localPlaylist, serverPlaylist) {
    if (!localPlaylist) {
      return {
        isNew: true,
        newItems: serverPlaylist.items || [],
        updatedItems: [],
        removedItems: []
      };
    }

    const localItems = new Map(
      (localPlaylist.items || []).map(item => [item.media_id, item])
    );
    const serverItems = new Map(
      (serverPlaylist.items || []).map(item => [item.media_id, item])
    );

    const newItems = [];
    const updatedItems = [];
    const removedItems = [];

    // Itens novos ou atualizados
    for (const [mediaId, serverItem] of serverItems) {
      const localItem = localItems.get(mediaId);
      if (!localItem) {
        newItems.push(serverItem);
      } else if (this.isItemUpdated(localItem, serverItem)) {
        updatedItems.push(serverItem);
      }
    }

    // Itens removidos
    for (const [mediaId, localItem] of localItems) {
      if (!serverItems.has(mediaId)) {
        removedItems.push(localItem);
      }
    }

    return {
      isNew: false,
      newItems,
      updatedItems,
      removedItems,
      unchangedItems: Array.from(serverItems.values()).filter(
        item => !newItems.includes(item) && !updatedItems.includes(item)
      )
    };
  }

  /**
   * Verifica se um item foi atualizado
   */
  isItemUpdated(localItem, serverItem) {
    // Comparar versão, checksum, ou outros campos relevantes
    const localVersion = localItem.media?.version || localItem.version;
    const serverVersion = serverItem.media?.version || serverItem.version;

    if (localVersion !== serverVersion) {
      return true;
    }

    // Comparar checksum se disponível
    const localChecksum = localItem.media?.checksum || localItem.checksum;
    const serverChecksum = serverItem.media?.checksum || serverItem.checksum;

    if (localChecksum && serverChecksum && localChecksum !== serverChecksum) {
      return true;
    }

    // Comparar outros campos relevantes
    return (
      localItem.order_index !== serverItem.order_index ||
      localItem.duration !== serverItem.duration
    );
  }

  /**
   * Gera versão para playlist
   */
  generateVersion(playlist) {
    // Usar timestamp ou hash dos IDs dos itens
    const itemsHash = (playlist.items || [])
      .map(item => `${item.media_id}:${item.order_index}`)
      .join(',');
    
    return btoa(itemsHash).substring(0, 32) + '_' + Date.now();
  }

  /**
   * Calcula checksum da playlist
   */
  async calculateChecksum(playlist) {
    const data = JSON.stringify({
      id: playlist.id,
      items: (playlist.items || []).map(item => ({
        id: item.item_id || item.id,
        media_id: item.media_id,
        order: item.order_index || item.order,
        duration: item.duration
      }))
    });

    // Usar crypto.subtle se disponível
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
    }

    // Fallback simples
    return btoa(data).substring(0, 32);
  }

  /**
   * Limpa cache de playlist
   */
  async clear() {
    await this.storage.delete('playlist:current');
    await this.storage.delete('playlist:version');
    await this.storage.delete('playlist:lastUpdate');
  }

  /**
   * Obtém última atualização
   */
  async getLastUpdate() {
    return await this.storage.get('playlist:lastUpdate');
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PlaylistCache;
} else {
  window.PlaylistCache = PlaylistCache;
}

