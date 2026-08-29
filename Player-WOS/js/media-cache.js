/**
 * Cache LRU de mídias no webOS (IndexedDB), paridade Player-AD / player-web.
 * HTML não é cacheado (iframe precisa da URL original).
 */
class PlayerMediaCache {
  constructor(options) {
    options = options || {};
    this.maxBytes = options.maxBytes || 400 * 1024 * 1024;
    this.dbName = options.dbName || "player-wos-media-cache";
    this.db = null;
    this._ready = this._open();
    this._objectUrls = {};
  }

  _open() {
    const self = this;
    if (!("indexedDB" in window)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const req = indexedDB.open(self.dbName, 1);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains("media")) {
          const store = db.createObjectStore("media", { keyPath: "key" });
          store.createIndex("lastAccessed", "lastAccessed", { unique: false });
        }
      };
      req.onsuccess = () => {
        self.db = req.result;
        resolve(self.db);
      };
    });
  }

  _cacheKey(item) {
    if (!item) return "";
    const id = item.mediaId;
    if (id != null && String(id).trim() !== "" && Number(id) !== 0) return String(id);
    return String(item.url || "");
  }

  _isHtml(item) {
    const type = String((item && item.mediaType) || "").toLowerCase();
    const url = String((item && item.url) || "");
    return type.indexOf("html") >= 0 || type.indexOf("web") >= 0 || /\.html?(\?|$)/i.test(url);
  }

  _blobUrl(key, blob) {
    if (this._objectUrls[key]) {
      try { URL.revokeObjectURL(this._objectUrls[key]); } catch (_) {}
    }
    const u = URL.createObjectURL(blob);
    this._objectUrls[key] = u;
    return u;
  }

  async _allRecords() {
    await this._ready;
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["media"], "readonly");
      const req = tx.objectStore("media").getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async _put(rec) {
    await this._ready;
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["media"], "readwrite");
      const req = tx.objectStore("media").put(rec);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _delete(key) {
    await this._ready;
    if (!this.db) return;
    if (this._objectUrls[key]) {
      try { URL.revokeObjectURL(this._objectUrls[key]); } catch (_) {}
      delete this._objectUrls[key];
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["media"], "readwrite");
      const req = tx.objectStore("media").delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _evictUntil(neededFree) {
    const rows = await this._allRecords();
    let used = rows.reduce((s, r) => s + (r.size || 0), 0);
    if (used + neededFree <= this.maxBytes) return;
    rows.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
    for (let i = 0; i < rows.length && used + neededFree > this.maxBytes; i += 1) {
      used -= rows[i].size || 0;
      await this._delete(rows[i].key);
    }
  }

  async ensureLocal(item) {
    const url = item && item.url ? String(item.url) : "";
    if (!url || this._isHtml(item) || /^blob:|^file:/i.test(url)) return url;
    const key = this._cacheKey(item);
    if (!key) return url;
    await this._ready;
    if (!this.db) return url;
    try {
      const rec = await new Promise((resolve, reject) => {
        const tx = this.db.transaction(["media"], "readonly");
        const req = tx.objectStore("media").get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      const version = String((item && (item.contentVersion || item.checksum)) || "");
      if (rec && rec.blob && (!version || rec.version === version)) {
        rec.lastAccessed = Date.now();
        await this._put(rec);
        return this._blobUrl(key, rec.blob);
      }
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return url;
      const blob = await res.blob();
      if (!blob || !blob.size) return url;
      await this._evictUntil(blob.size);
      await this._put({
        key: key,
        blob: blob,
        size: blob.size,
        version: version,
        lastAccessed: Date.now()
      });
      return this._blobUrl(key, blob);
    } catch (err) {
      if (typeof WosLogger !== "undefined") {
        WosLogger.warn("CACHE", "ensureLocal falhou, URL remota: " + (err && err.message ? err.message : err));
      }
      return url;
    }
  }

  async prefetch(items) {
    const list = Array.isArray(items) ? items : [];
    for (let i = 0; i < list.length; i += 1) {
      try { await this.ensureLocal(list[i]); } catch (_) {}
    }
  }

  async purgeAll() {
    await this._ready;
    Object.keys(this._objectUrls).forEach((k) => {
      try { URL.revokeObjectURL(this._objectUrls[k]); } catch (_) {}
    });
    this._objectUrls = {};
    if (!this.db) return { purged: true, indexedDb: false };
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(["media"], "readwrite");
      const req = tx.objectStore("media").clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return { purged: true, indexedDb: true };
  }
}

window.PlayerMediaCache = PlayerMediaCache;
