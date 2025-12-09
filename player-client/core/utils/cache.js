/**
 * Cache - Core
 * Sistema de cache local simples
 */

class Cache {
  constructor() {
    this.storage = {};
    this.maxSize = 50 * 1024 * 1024; // 50MB padrão
    this.currentSize = 0;
  }

  /**
   * Obtém item do cache
   */
  async get(key) {
    const item = this.storage[key];
    if (!item) {
      return null;
    }

    // Verificar expiração
    if (item.expires && new Date() > new Date(item.expires)) {
      delete this.storage[key];
      this.currentSize -= item.size;
      return null;
    }

    return item.value;
  }

  /**
   * Define item no cache
   */
  async set(key, value, ttl = 3600000) { // 1 hora padrão
    const serialized = JSON.stringify(value);
    const size = new Blob([serialized]).size;

    // Verificar se há espaço
    if (this.currentSize + size > this.maxSize) {
      await this.evictOldest();
    }

    const expires = new Date(Date.now() + ttl);
    this.storage[key] = {
      value,
      expires: expires.toISOString(),
      size,
      timestamp: new Date().toISOString(),
    };

    this.currentSize += size;
  }

  /**
   * Remove item do cache
   */
  async delete(key) {
    const item = this.storage[key];
    if (item) {
      this.currentSize -= item.size;
      delete this.storage[key];
    }
  }

  /**
   * Limpa todo o cache
   */
  async clear() {
    this.storage = {};
    this.currentSize = 0;
  }

  /**
   * Remove itens mais antigos para liberar espaço
   */
  async evictOldest() {
    const items = Object.entries(this.storage)
      .map(([key, item]) => ({ key, ...item }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Remover 20% dos itens mais antigos
    const toRemove = Math.ceil(items.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      await this.delete(items[i].key);
    }
  }

  /**
   * Define tamanho máximo do cache
   */
  setMaxSize(size) {
    this.maxSize = size;
    if (this.currentSize > this.maxSize) {
      this.evictOldest();
    }
  }
}

// Exportar para diferentes ambientes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Cache;
} else {
  window.Cache = Cache;
}

