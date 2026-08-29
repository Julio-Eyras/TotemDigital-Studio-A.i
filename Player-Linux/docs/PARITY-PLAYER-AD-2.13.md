# Parity — Player-Linux ↔ Player-AD 2.15 / 115

**Fonte de verdade Android:** `Player-AD` (`versionName` 2.15, `versionCode` 115).  
**Este documento** define o contrato de parity que o Player-Linux deve cumprir.

> O ficheiro antigo `PARITY-PLAYER-AD-2.13.md` foi retargetado para 2.15 (kiosk HOME persistente, escape 3× OK no Android — no Linux via systemd + SIGUSR1).

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
| Heartbeat + `pendingCommands` + OTA + schedule | sim | `currentVersion` / `updateStatus` no HB |
| `GET /api/player/config` | sim | aplica `heartbeatInterval` |
| Dispatch `GET /api/player/dispatch` | só quando precisa | arranque / needsDispatch / safety |
| Plano ONLINE → PERSISTED → FALLBACK_LOCAL | sim | mesmos ficheiros |
| Remover vinhetas do plano online; mix N:1 só no fallback | sim | |
| Horário de tela (overlay preto, processo vivo) | sim | idle no loop; heartbeat continua |
| `forceMode` on/off/clear | sim | preservar local se servidor omitir |
| Cache LRU + `contentVersion` + metadata.json | sim | `maxCacheSizeMb` |
| Poll adaptativo + idle fora de horário | sim | merge do JSON do HB |
| Comandos remotos (tabela abaixo) | sim | reboot/wifi = systemd/NM |
| Telemetria events v2 | sim | jsonl |
| Vídeo FIT 9:16 (sem faixas se canvas 720×1280) | sim | GStreamer `videoscale add-borders` |
| Imagem duração default 10s | sim | `imagefreeze` |
| HTML duração default 60s (mín 30) | sim | Chromium `--kiosk` |
| Áudio mute por default | sim | `volume=0` no playbin |
| Transição véu preto | sim | `videotestsrc pattern=black` ~300 ms |
| Kiosk fullscreen | sim | xset/unclutter + systemd |
| `displayRotation` 0–3 | sim | xrandr |
| OTA | sim | `.deb` + SHA-256 + `prev.deb` rollback |
| Wi‑Fi remoto | sim | `nmcli device wifi connect` |
| Screenshot comando | sim | grim / import / scrot → JPEG base64 no ACK |
| Escape kiosk | sim | `SIGUSR1` / `scripts/kiosk-escape.sh` |

## 3. Comandos remotos (parity)

| type | Comportamento |
|------|----------------|
| `invalidate_media` / `_playlist` / `_campaign` | limpa cache + refresh |
| `refresh_dispatch` / `sync_now` | força dispatch |
| `content_version_check` | compara versões |
| `purge_cache` | apaga ficheiros (mantém histórico se existir) |
| `restart` / `restart_app` | ACK **antes**; pára o processo (systemd relança) |
| `reboot` / `reset_board` | ACK **antes**; `systemctl reboot` |
| `capture_screen` / `screenshot` | JPEG no ACK |
| `config` / `apply_player_config` | aplica config + kiosk/rotação |
| `configure_wifi` | NetworkManager |
| `display_force_on` / `off` / `clear` | forceMode |
| `update` | ACK **antes**; OTA `.deb` |
| `ota_rollback` | ACK **antes**; `prev.deb` |

ACK: `POST /api/player/command-result` — dedup at-most-once. Recibos em `remote-command-receipts.json`.

## 4. Viewport / mídia

- Canvas alvo em retrato: **720×1280** (9:16), como no fix Player-AD 2.13.
- Escala vídeo: **FIT** (contain), sem distorção; sem faixas quando aspectos coincidem.
- Bake ≥3: ficheiro neutro; montagem no player. Bake ≤2: legado.

## 5. O que NÃO portar à letra

- `FileProvider` / install APK → `dpkg` / `scripts/install-player-linux.sh`.
- `user_rotation` Allwinner → xrandr.
- Leanback / Android TV launcher → systemd `WantedBy=graphical.target`.
- WebView Android → Chromium `--kiosk` (WebKitGTK continua opcional).
- Logos / bootanimation do instalador APK 1.7 → kit Linux à parte.

## 6. Critério de “parity OK”

1. Mesmo `uin`+`deviceId`+`serverUrl` recebe o mesmo dispatch que o Android.
2. Heartbeat reporta `platform=linux` e versão do binário.
3. Fora do horário de tela: ecrã preto, heartbeat continua.
4. Log de operações legível com as mesmas categorias (`HEARTBEAT`, `DISPATCH`, `PLAYBACK`, …).
5. Mídia 1080×1920 em viewport 720×1280 sem faixas pretas (FIT exacto).
6. EMPTY_PLAN **não** dispara fallback nem reboot loop (RN-PAD-001).
