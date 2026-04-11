# Mapa de funcionamento e features dos players por plataforma

Documento de referência rápida: como cada player funciona e que funcionalidades suporta.  
Design: **DESIGN_PLAYER_PLATAFORMAS_STORAGE_E_DOWNLOAD.md**.  
**Features e mensagens (estruturas request/response):** **FEATURES_E_MENSAGENS_PLAYERS_POR_PLATAFORMA.md**.

---

## 1. Visão geral (tabela resumo)

| Plataforma        | Projeto / path principal                    | Fluxo de conteúdo        | Storage propagandas     | Config API (`storageUseExternalFirst`) | Player / reprodução      | Debug storage | Observações |
|-------------------|---------------------------------------------|--------------------------|--------------------------|----------------------------------------|--------------------------|---------------|-------------|
| **Android TV**    | `platforms/android/SmartSignage-ANDROID-PLAYER` | DispatchPlan (prioridade) + fallback legado | ✅ StorageHelper, interno + USB, externo 1º; **propagandas criada ao arranque** | ✅ Antes de carregar plano             | ExoPlayer, path local    | ✅ Painel     | Kotlin; token via getDeviceToken |
| **Linux Electron** | `platforms/linux-electron`                  | DispatchPlan + fallback playlist legada | ✅ StorageHelper, `/proc/mounts` USB; **propagandas criada ao arranque** | ✅ Em cada loadAndStartPlaylist        | `<video>`/`<img>`, file:// | ✅ Painel     | Node + Electron; STORAGE_PATH, STORAGE_USE_EXTERNAL_FIRST |
| **Linux C++**     | `platforms/linux-cpp`                       | Playlist legada (`/api/player/playlist`) | ✅ StorageHelper C++, path local preferido; **propagandas criada ao arranque** | ✅ Em main (getConfig)                 | MediaPlayer, file:// se existir local | ❌           | C++; ficheiros em propagandas podem ser colocados por outro processo |
| **webOS (LG)**    | `platforms/webos/SmartSignage-LG-PLAYER`    | DispatchPlan + fallback legado | ✅ StorageHelper, /media/internal, /media/external; **propagandas criada ao arranque** | ✅ applyPlayerConfigFromApi em loadAndStartPlaylist | HTML5 video/img, file:// | ❌           | JS; webOS FileSystem API (luna) |
| **Tizen (Samsung)** | `platforms/tizen/SmartSignage-TIZEN-PLAYER-HLS` | DispatchPlan (stream HLS) + cache propagandas | ✅ StorageHelper, documents + removable; **propagandas criada ao arranque** | ✅ applyPlayerConfigFromApi antes getDispatchPlan | HLS player + path local | ❌           | JS; Tizen FileSystem API |
| **Linux/Windows (Node)** | `platforms/linux-windows`               | DispatchPlan, cache, servidor HTTP local | CacheManager (não StorageHelper propagandas unificado) | —                        | MediaPlayer.js           | —             | Node; servidor HTTP para totens locais |
| **Windows Electron** | `platforms/windows-electron`              | (variante Electron)      | —                        | —                                      | —                        | —             | Em avaliação |

---

## 2. Fluxo de funcionamento por plataforma

### 2.1 Android TV

```
Início
  → getDeviceToken (UIN, deviceId, platform)
  → getConfig() → storageHelper.useExternalFirst
  → loadFromDispatchPlan (token, UIN, deviceId, timezone)
  → MediaCacheManager.processDispatchPlan (download para getWritePropagandasDir)
  → playNext(): resolveMediaPath(mediaId) → file:// ou URL remota
  → ExoPlayer play (loop ao fim da lista)
  → Atualização periódica + heartbeat
```

**Features:** DispatchPlan, token de dispositivo, StorageHelper (interno + getExternalFilesDirs), MediaCacheManager com checksum, resolução externo→interno, config API, painel Debug com info de storage, fallback playlist legada e modo offline (último plano em cache).

**Paths:** Interno `getFilesDir()/propagandas`, externo `getExternalFilesDirs()[1+]/propagandas`.  
**Config:** `GET /api/player/config` → `storageUseExternalFirst` (Boolean).

---

### 2.2 Linux (Electron)

```
Início
  → get-config (main process: storagePath, useExternalFirst)
  → getDeviceToken
  → StorageHelper(pathBase, useExternalFirst), MediaCacheManager(storageHelper)
  → loadAndStartPlaylist:
       applyPlayerConfigFromApi() → storageHelper.useExternalFirst
       loadFromDispatchPlan → processDispatchPlan (download para getWritePropagandasDir)
       playNext(): getLocalPath(mediaId, ext) → file:// ou URL
  → MediaPlayer (video/img) em loop
  → setInterval loadAndStartPlaylist, scheduler check
```

**Features:** DispatchPlan, StorageHelper (interno + USB via `/proc/mounts`), MediaCacheManager, convenção `{mediaId}.{ext}` em propagandas, config API em cada carga, painel Debug (storage roots, ordem, ficheiros), fallback playlist legada e último plano em cache.

**Paths:** Interno `STORAGE_PATH` ou `~/.cache/smartsignage`; USB em `/media/*`, `/mnt/*`.  
**Env:** `STORAGE_PATH`, `STORAGE_USE_EXTERNAL_FIRST` (main); config também via `config.json` e API.

---

### 2.3 Linux (C++)

```
Início
  → APIClient(apiBaseURL, totemUIN, totemSecret)
  → getConfig() → storageHelper.setUseExternalFirst(storageUseExternalFirst)
  → authenticateTotem()
  → heartbeatService.start()
  → loadPlaylist() → getPlaylist() [API legada /api/player/playlist]
Loop:
  → needsUpdate() → loadPlaylist()
  → getNextItem()
  → storageHelper.resolveMediaPath(item->id, "") → path local em propagandas
  → Se path existe: play(file:// + path); senão: play(item->url)
  → mediaPlayer->waitForCompletion()
```

**Features:** Playlist legada (não DispatchPlan), StorageHelper C++ (interno + USB `/proc/mounts`), config API para `storageUseExternalFirst`, reprodução preferindo ficheiro local em propagandas. Sem download integrado: ficheiros em propagandas devem existir (script externo ou evolução futura).

**Paths:** Interno `STORAGE_PATH` ou `~/.cache/smartsignage`; USB em `/media/*`, `/mnt/*`.  
**Env:** `STORAGE_PATH`, `STORAGE_USE_EXTERNAL_FIRST`, `API_BASE_URL`, `TOTEM_UIN`, `TOTEM_SECRET`.

---

### 2.4 webOS (LG)

```
Início
  → loadConfig (config.json, webOS service)
  → TotemConnectionManager (totem local vs servidor)
  → StorageHelper(useExternalFirst), MediaCacheManager(storageHelper)
  → getDeviceToken (se USE_DISPATCHER)
  → loadAndStartPlaylist:
       applyPlayerConfigFromApi() → storageHelper.useExternalFirst
       loadFromDispatchPlan → getDispatchPlan (uin, token, deviceId, timezone)
       processDispatchPlan (webOS file API: write em getWritePropagandasDir)
       playNext(): getLocalPath(mediaId, ext) → file:// ou URL
  → MediaPlayer (playVideo / playImage) em loop
  → Fallback: último DispatchPlan em cache; depois playlist legada
```

**Features:** DispatchPlan, TotemConnectionManager, StorageHelper (interno + externo via webOS file API), MediaCacheManager com convenção `{mediaId}.{ext}`, config API, reprodução com path local (file://), modo offline.

**Paths:** Interno `/media/internal/smartsignage/propagandas`, externo `/media/external/smartsignage/propagandas` (quando disponível).  
**API webOS:** `luna://com.webos.service.file` (exists, write, read, remove).

---

### 2.5 Tizen (Samsung)

```
Início
  → loadConfig, ensureUIN, getDeviceId
  → TotemConnectionManager
  → StorageHelper(useExternalFirst), MediaCacheManager(storageHelper)
  → getDeviceToken / getToken
  → applyPlayerConfigFromApi() → storageHelper.useExternalFirst
  → getDispatchPlan() [fetch /player/dispatch?uin,token,...]
  → processDispatchPlan (Tizen FileSystem: documents + path completo)
  → extractStreamUrlFromDispatchPlan (HLS) ou path local
  → HLSPlayer / fallback; getLocalPath(mediaId, ext) quando aplicável
```

**Features:** DispatchPlan (incl. stream HLS), StorageHelper (documents + removable), MediaCacheManager com path completo e `{mediaId}.{ext}`, config API, path local quando ficheiro em propagandas.

**Paths:** Relativos a `tizen.filesystem`: interno `smartsignage/propagandas`, externo `removable/.../smartsignage/propagandas`.  
**API Tizen:** `tizen.filesystem.resolve('documents')`, `resolve('removable')`; createDirectory, createFile, openStream.

---

### 2.6 Linux/Windows (Node)

```
Início
  → apiClient, cacheManager (MediaCacheManager), httpServer, TotemConnectionManager
  → getDeviceToken, syncDispatchPlan (getDispatchPlan, processDispatchPlan)
  → Servidor HTTP local serve mídias do cache para outros totens
  → Loop: playNext (currentDispatchPlan.mediaItems), MediaPlayer
  → Atualização periódica do DispatchPlan
```

**Features:** DispatchPlan, cache local, servidor HTTP para descoberta e entrega de mídia a outros totens; não usa o mesmo StorageHelper/propagandas que as outras plataformas (estrutura de cache própria).

---

## 3. Matriz de features (sim/não)

| Feature | Android | Linux Electron | Linux C++ | webOS | Tizen | Linux/Win Node |
|--------|---------|----------------|-----------|-------|-------|----------------|
| DispatchPlan (API dispatch) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Playlist legada (/api/player/playlist) | ✅ fallback | ✅ fallback | ✅ | ✅ fallback | — | — |
| Token de dispositivo (getDeviceToken) | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Storage interno + externo (USB) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Pasta fixa `propagandas` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Convenção `{mediaId}.{ext}` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Externo por defeito (useExternalFirst) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Config API (storageUseExternalFirst) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Download para propagandas (HTTPS) | ✅ | ✅ | ❌ * | ✅ | ✅ | ✅ (cache) |
| Resolução path local (externo→interno) | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Reprodução file:// quando existe local | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| Modo offline (último plano em cache) | ✅ | ✅ | — | ✅ | ✅ | — |
| Heartbeat | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Painel Debug (storage) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| TotemConnectionManager (totem local) | — | — | — | ✅ | ✅ | ✅ |
| SmartDisplayFX (efeitos/MQTT) | — | ✅ | ❌ | ✅ | — | — |

\* Linux C++ não faz download; usa ficheiros já presentes em propagandas (ex.: colocados por script ou por outra app).

---

## 4. Variáveis de ambiente e config por plataforma

| Plataforma | Env / config | Descrição |
|------------|----------------|-----------|
| Android | (SharedPreferences / config remota) | API_BASE_URL, TOTEM_UIN, TOTEM_SECRET; storage via API |
| Linux Electron | `STORAGE_PATH`, `STORAGE_USE_EXTERNAL_FIRST` (main) | Path base; preferir externo (true/false). Também config.json e API |
| Linux C++ | `STORAGE_PATH`, `STORAGE_USE_EXTERNAL_FIRST`, `API_BASE_URL`, `TOTEM_UIN`, `TOTEM_SECRET` | Path base; preferir externo; backend e totem |
| webOS | config.json, webOS config service | API_BASE_URL, TOTEM_UIN, etc.; storage via API |
| Tizen | config (config.example.json) | apiUrl, uin, etc.; use_external_first; storage via API |
| Backend | `PLAYER_STORAGE_USE_EXTERNAL_FIRST` | Default true; enviado em GET /api/player/config |

---

## 5. Endpoints da API utilizados

| Endpoint | Android | Linux El. | Linux C++ | webOS | Tizen |
|----------|---------|-----------|-----------|-------|-------|
| GET /api/player/token | ✅ | ✅ | ❌ | ✅ | ✅ |
| GET /api/player/config | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /api/player/dispatch (ou /player/dispatch) | ✅ | ✅ | ❌ | ✅ | ✅ (fetch) |
| GET /api/player/playlist | fallback | fallback | ✅ | fallback | — |
| POST /api/player/heartbeat | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /api/media/:id/download (ou equivalente) | ✅ | ✅ | ❌ | ✅ | ✅ |

---

## 6. Ficheiros-chave por plataforma

| Plataforma | Storage | Cache/Download | App / fluxo principal |
|------------|---------|----------------|------------------------|
| Android | `storage/StorageHelper.kt` | `cache/MediaCacheManager.kt` | `viewmodels/PlayerViewModel.kt`, `core/PlaylistManager.kt` |
| Linux Electron | `renderer/src/js/storage/StorageHelper.js` | `renderer/src/js/cache/MediaCacheManager.js` | `renderer/src/js/app.js`, main `main.js` |
| Linux C++ | `include/storage/StorageHelper.h`, `src/storage/StorageHelper.cpp` | — | `src/main.cpp`, `core/PlaylistManager.cpp` |
| webOS | `src/js/storage/StorageHelper.js` | `src/js/cache/MediaCacheManager.js` | `src/js/app.js` |
| Tizen | `js/storage/StorageHelper.js` | `js/cache/MediaCacheManager.js` | `js/app.js` |

---

*Documento gerado para referência dos players em player-client. Atualizar conforme evolução das plataformas.*
