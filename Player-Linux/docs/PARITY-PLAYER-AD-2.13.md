# Parity — Player-Linux ↔ Player-AD 2.15 / 115

**Fonte de verdade Android:** `Player-AD` (`versionName` 2.15, `versionCode` 115).  
**Este documento** define o contrato de parity que o Player-Linux deve cumprir.

> O ficheiro antigo `PARITY-PLAYER-AD-2.13.md` foi retargetado para 2.15 (kiosk HOME persistente, escape 3× OK no Android — no Linux via compositor/systemd).

## 1. Identidade

| | Player-AD | Player-Linux |
|---|---|---|
| App / binário | `br.com.smartchannel.playerad` | `player-linux` |
| Versão alvo de regras | 2.15 / 115 | mesma regra de negócio; versão do binário própria (`PLAYER_LINUX_VERSION`) |
| `platform` no heartbeat | `android` | **`linux`** |
| Log de operações | `player-ad-operations.log` | `player-linux-operations.log` |
| Tag log | `Player-AD` | `Player-Linux` |

## 2. Checklist de funcionalidades

| Área | Obrigatório | Notas Linux |
|------|-------------|-------------|
| Token `GET /api/player/token` | sim | libcurl |
| Sync preferido `POST /api/player/sync` | sim | fallback heartbeat se 404/405 |
| Heartbeat + `pendingCommands` + OTA + schedule | sim | |
| Dispatch `GET /api/player/dispatch` | só quando precisa | arranque / needsDispatch / safety |
| Plano ONLINE → PERSISTED → FALLBACK_LOCAL | sim | mesmos ficheiros |
| Remover vinhetas do plano online; mix N:1 só no fallback | sim | |
| Horário de tela (overlay preto, processo vivo) | sim | janela preta / blank DRM |
| `forceMode` on/off/clear | sim | preservar local se servidor omitir |
| Cache LRU + `contentVersion` + metadata.json | sim | |
| Poll adaptativo + idle fora de horário | sim | |
| Comandos remotos (tabela abaixo) | sim | reboot/wifi = systemd/NM |
| Telemetria events v2 | sim | jsonl |
| Vídeo FIT 9:16 (sem faixas se canvas 720×1280) | sim | GStreamer `fit` / letterbox controlado |
| Imagem duração default 10s | sim | |
| HTML duração default 60s (mín 30) | fase 2 | WebKitGTK |
| Áudio mute por default | sim | |
| Transição véu preto | sim | |
| Kiosk fullscreen | fase 2 | X11/Wayland |
| `displayRotation` 0–3 | fase 2 | |
| OTA | fase 2 | `.deb` / AppImage + SHA-256 |
| Wi‑Fi remoto | fase 2 | NetworkManager D-Bus |
| Screenshot comando | fase 2 | |

## 3. Comandos remotos (parity)

| type | Comportamento |
|------|----------------|
| `invalidate_media` / `_playlist` / `_campaign` | limpa cache + refresh |
| `refresh_dispatch` / `sync_now` | força dispatch |
| `content_version_check` | compara versões |
| `purge_cache` | apaga ficheiros (mantém histórico se existir) |
| `restart` / `restart_app` | reinicia processo |
| `reboot` / `reset_board` | `systemctl reboot` (se permitido) |
| `capture_screen` / `screenshot` | JPEG no ACK |
| `config` / `apply_player_config` | aplica config |
| `configure_wifi` | NetworkManager |
| `display_force_on` / `off` / `clear` | forceMode |
| `update` | OTA Linux |
| `ota_rollback` | rollback pacote |

ACK: `POST /api/player/command-result` — dedup at-most-once.

## 4. Viewport / mídia

- Canvas alvo em retrato: **720×1280** (9:16), como no fix Player-AD 2.13.
- Escala vídeo: **FIT** (contain), sem distorção; sem faixas quando aspectos coincidem.
- Bake ≥3: ficheiro neutro; montagem no player. Bake ≤2: legado.

## 5. O que NÃO portar à letra

- `FileProvider` / install APK → instalador nativo Linux.
- `user_rotation` Allwinner → rotação via compositor / transform.
- Leanback / Android TV launcher → entrada systemd / autostart.
- WebView Android → WebKitGTK / CEF (fase 2).

## 6. Critério de “parity OK”

1. Mesmo `uin`+`deviceId`+`serverUrl` recebe o mesmo dispatch que o Android.
2. Heartbeat reporta `platform=linux` e versão do binário.
3. Fora do horário de tela: ecrã preto, heartbeat continua.
4. Log de operações legível com as mesmas categorias (`HEARTBEAT`, `DISPATCH`, `PLAYBACK`, …).
5. Mídia 1080×1920 em viewport 720×1280 sem faixas pretas (FIT exacto).
