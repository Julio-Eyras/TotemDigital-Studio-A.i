# TODO: Novas versões das plataformas (player-client)

Referência: **docs/DESIGN_PLAYER_PLATAFORMAS_STORAGE_E_DOWNLOAD.md**  
**Mapa de funcionamento e features:** **docs/MAPA_PLAYERS_POR_PLATAFORMA.md**

Ordem de implementação: **1) Android TV → 2) LG (webOS) → 3) Tizen → 4) Linux.**

Avalie este TODO antes de iniciar a implementação. Cada secção pode ser expandida em tarefas técnicas concretas na fase de desenvolvimento.

---

## Estado atual (retomada)

- **Storage externo por defeito (design 3.3):** Implementado em **Android**, **Linux (Electron)**, **webOS**, **Tizen** e **Linux C++**. Por defeito usa USB/externo primeiro; fallback para interno. Configurável via API `GET /api/player/config` → `storageUseExternalFirst` (e env onde aplicável).
- **Android:** StorageHelper; aplica config da API; path `/propagandas`, download e resolução conforme design.
- **Linux (Electron):** StorageHelper; aplica config em cada `loadAndStartPlaylist()`; path base e USB via `/proc/mounts`; Debug panel.
- **webOS (prioridade 2):** StorageHelper (`js/storage/StorageHelper.js`); MediaCacheManager em `.../propagandas/` com convenção `{mediaId}.{ext}`; aplica config da API em `loadAndStartPlaylist()`; reprodução com path local. Interno + externo (/media/internal, /media/external quando disponível).
- **Tizen (prioridade 3):** StorageHelper (`js/storage/StorageHelper.js`); MediaCacheManager em `.../propagandas/` com `{mediaId}.{ext}`; aplica config da API antes de getDispatchPlan; paths relativos a `documents` (Tizen FileSystem API).
- **Linux C++ (plataforma adicionada):** StorageHelper em C++ (`include/storage/StorageHelper.h`, `src/storage/StorageHelper.cpp`); path interno (env `STORAGE_PATH` ou `~/.cache/smartsignage`), USB via `/proc/mounts`; aplica `storageUseExternalFirst` da API em `main`; reprodução preferindo `resolveMediaPath()` (file:// quando existir em propagandas). Variável de ambiente `STORAGE_USE_EXTERNAL_FIRST`.
- **Backend:** `GET /api/player/config` devolve `storageUseExternalFirst` (env `PLAYER_STORAGE_USE_EXTERNAL_FIRST`, default true).

---

## Regras comuns a todas as plataformas (checklist por app)

- [ ] **Path fixo `/propagandas`**  
  Mídias sempre em `{pathBase}/propagandas/`. Nome do ficheiro: `{mediaId}.{ext}` (mediaId = UIN do backend).

- [ ] **Deteção de storage (interno + USB)**  
  Detetar interno e USB (quando montada); quando USB presente, usar ambos. **Por defeito: externo primeiro, depois interno** (configurável na opção administrativa). Pasta `propagandas` em cada storage.

- [ ] **Download Web (HTTPS)**  
  Obter playlist via API; para cada item a baixar: GET na `url`, gravar em `.../propagandas/{mediaId}.{ext}`, sobrescrever se existir.

- [ ] **Detecção de alteração**  
  Comparar plano recebido com último plano (playlistId, quantidade, ordem, checksums); só baixar itens novos ou com checksum diferente.

- [ ] **Reprodução do path local em loop**  
  Reproduzir sempre do ficheiro local (path resolvido: interno ou USB). Ao terminar a playlist, recomeçar do primeiro item (loop infinito).

- [ ] **Botão [Debug] com info de storage**  
  Painel de debug deve mostrar: storages detetados (path interno, path USB ou “USB não presente”), ordem de resolução, opcionalmente listagem/conta de ficheiros em `propagandas` e espaço livre; ação “Atualizar info storage” ou equivalente.

---

## 1. Android TV (prioridade 1)

**Projeto base:** `platforms/android/SmartSignage-ANDROID-PLAYER` (ou criar `SmartSignage-ANDROID-TV-PLAYER` se for variante TV dedicada).

| # | Tarefa | Detalhe |
|---|--------|---------|
| 1.1 | Estrutura do projeto | Garantir que o app é Android TV (Leanback opcional), com target SDK e permissões para storage interno e USB (StorageManager / volumes externos). |
| 1.2 | Path base e propagandas | Definir pathBase interno = `getFilesDir()` ou `getExternalFilesDir()`; criar/garantir pasta `propagandas` em `{pathBase}/propagandas/`. |
| 1.3 | Deteção de storage (interno + USB) | Implementar deteção: interno = path do app; USB = volumes externos via StorageManager. **Ordem por defeito: externo primeiro, depois interno** (configurável). ✅ Feito em Android (StorageHelper). |
| 1.4 | Download para propagandas | Ao receber DispatchPlan, comparar com plano anterior; para itens novos/alterados, fazer GET na `url` e gravar em `{pathBase}/propagandas/{mediaId}.{ext}`. Preferir pathBase = externo quando configurado. ✅ Feito em Android. |
| 1.5 | Resolução de path para reprodução | Dado `mediaId` + ext: resolver na ordem configurada (por defeito: externo primeiro, depois interno). ✅ Feito em Android (resolveMediaPath). |
| 1.6 | Player nativo: ExoPlayer | Usar ExoPlayer para vídeo e imagem (ou ImageView para imagens). Fonte = path local (file:// ou ContentResolver). Playlist em memória; ao terminar item, próximo; ao terminar lista, voltar ao primeiro (loop). |
| 1.7 | Heartbeat e API | Manter/criar cliente API: validação totem, heartbeat, GET DispatchPlan. UIN e token como já existem. |
| 1.8 | Debug: painel com storage | Botão [Debug] (ou ecrã de debug): ao ativar, mostrar path interno, path USB (ou “não presente”), ordem de resolução; botão “Atualizar info storage” que lista/conta ficheiros em cada `propagandas` e espaço livre. |
| 1.9 | Validação de espaço | Antes de download: verificar espaço livre; se insuficiente, remover ficheiros antigos (LRU ou fora do plano atual) em cada storage usado. |

---

## 2. LG (webOS) (prioridade 2)

**Projeto base:** `platforms/webos/SmartSignage-LG-PLAYER`.

| # | Tarefa | Detalhe |
|---|--------|---------|
| 2.1 | Path base e propagandas | Path interno `/media/internal/smartsignage`, externo `/media/external/smartsignage` quando disponível. Pasta `propagandas` em cada. ✅ Feito (StorageHelper). |
| 2.2 | Deteção de storage (interno + USB) | Ordem por defeito: **externo primeiro**. StorageHelper com `_checkExternalAvailable()` (webOS file API). ✅ Feito. |
| 2.3 | Download para propagandas | MediaCacheManager usa StorageHelper.getWritePropagandasDir(); convenção `{mediaId}.{ext}`. ✅ Feito. |
| 2.4 | Detecção de alteração | ProcessDispatchPlan com checksum; só baixar alterados. ✅ Existente. |
| 2.5 | Player: HTML5 ou AVPlay | Reprodução com path local (file://) quando getLocalPath (resolveMediaPath) encontrar ficheiro em propagandas. ✅ Feito. |
| 2.6 | Config da API | applyPlayerConfigFromApi() em loadAndStartPlaylist(); storageUseExternalFirst. ✅ Feito. |

---

## 3. Tizen (Samsung) (prioridade 3)

**Projeto base:** `platforms/tizen/SmartSignage-TIZEN-PLAYER-HLS`.

| # | Tarefa | Detalhe |
|---|--------|---------|
| 3.1 | Path base e propagandas | Paths relativos a `documents`: interno `smartsignage/propagandas`, externo `removable/.../smartsignage/propagandas` quando disponível. ✅ Feito (StorageHelper). |
| 3.2 | Deteção de storage (interno + USB) | Ordem por defeito: **externo primeiro**. StorageHelper com `_checkExternalAvailable()` (tizen.filesystem 'removable'). ✅ Feito. |
| 3.3 | Download para propagandas | MediaCacheManager com storageHelper; convenção `{mediaId}.{ext}`; saveFile com path completo. ✅ Feito. |
| 3.4 | Detecção de alteração | processDispatchPlan com checksum; só baixar alterados. ✅ Existente. |
| 3.5 | Player | HLS player; getLocalPath (resolveMediaPath) para path local quando disponível. ✅ Integrado. |
| 3.6 | Config da API | applyPlayerConfigFromApi() antes de getDispatchPlan(); storageUseExternalFirst. ✅ Feito. |

---

## 4. Linux (prioridade 4)

**Projetos base:** `platforms/linux-electron`, **`platforms/linux-cpp`** (C++), e/ou `platforms/linux-windows` (Node).

| # | Tarefa | Detalhe |
|---|--------|---------|
| 4.1 | Path base e propagandas | Electron: path configurável (STORAGE_PATH ou ~/.cache/smartsignage). C++: idem (env STORAGE_PATH ou ~/.cache/smartsignage). ✅ Feito em ambos. |
| 4.2 | Deteção de storage (interno + USB) | Electron e C++: interno + USB via `/proc/mounts` (/media, /mnt). **Ordem por defeito: externo primeiro**. ✅ Feito em ambos. |
| 4.3 | Download para propagandas | Electron: MediaCacheManager. C++: player usa ficheiros já em propagandas (resolveMediaPath); download pode ser adicionado (script ou módulo futuro). ✅ Electron feito; C++ com resolução de path local. |
| 4.4 | Detecção de alteração | Electron: comparar plano; só baixar alterados. C++: playlist legada; DispatchPlan pode ser adicionado. ✅ Electron feito. |
| 4.5 | Player | Electron: `<video>`/`<img>` com file://. C++: MediaPlayer com URL ou file:// quando resolveMediaPath encontrar ficheiro. ✅ Feito em ambos. |
| 4.6 | Debug / Config | Electron: painel Debug + config da API. C++: aplica getConfig() → storageUseExternalFirst em main. ✅ Feito. |
| 4.7 | Linux C++ como plataforma | StorageHelper C++ (include/storage, src/storage); env STORAGE_USE_EXTERNAL_FIRST; reprodução preferindo path local em propagandas. ✅ Plataforma adicionada. |

---

## 5. Shared / reutilização

| # | Tarefa | Detalhe |
|---|--------|---------|
| 5.1 | Contrato da API (DispatchPlan) | Documentar formato do DispatchPlan (playlistId, mediaItems com mediaId, url, duration, metadata.checksum, etc.) para todas as plataformas consumirem igual. |
| 5.2 | Lógica de “PlaylistChangeDetector” | Algoritmo comum (comparar playlistId, count, order, checksums) pode ser documentado ou partilhado em código (JS para web/LG/Tizen/Electron; portar para Kotlin/C++ onde fizer sentido). |
| 5.3 | Convenção de extensão | Obter `ext` de metadata (mimeType/extension), URL ou mediaType; mapeamento MIME→ext único no doc para todas as plataformas. |

---

## 6. Ordem sugerida de execução (para avaliar)

1. **Android TV** – Implementar 1.1–1.9 (path, storage, download, ExoPlayer, debug).
2. **LG webOS** – Implementar 2.1–2.6 (path, storage, download, player HTML5/AVPlay, debug).
3. **Tizen** – Implementar 3.1–3.6 (path, storage, download, player, debug).
4. **Linux** – Implementar 4.1–4.7 (path, storage, download, mpv ou GStreamer, debug; variantes Electron/C++).

Dentro de cada plataforma, ordem sugerida: path base + propagandas → deteção interno/USB → download → resolução de path → player em loop → debug storage.

---

## 7. Notas

- **mediaId**: O backend envia já UIN (alfanumérico ou UUID); o player usa como nome de ficheiro `{mediaId}.{ext}` sem sanitizar.
- **Backend**: Alterações no backend (descartar mídias inexistentes, alertar, sanitização) estão no doc de design; não fazem parte deste TODO de player-client, mas a API de playlist deve estar estável para os clients consumirem.
- **Player-web**: Mantido como referência; não está em player-client. As mesmas regras (propagandas, storage, loop, debug) aplicam-se aos players em player-client.

---

*Documento para avaliação antes de iniciar a implementação. Após aprovação, pode-se detalhar cada item em issues ou tarefas de desenvolvimento.*
