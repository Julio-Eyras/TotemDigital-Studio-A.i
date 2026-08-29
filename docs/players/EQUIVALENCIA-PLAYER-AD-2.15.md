# Equivalência dos players vs Player-AD 2.15 / 115

**Fonte de verdade:** `Player-AD/` (`versionName` 2.15, `versionCode` 115) — `Player-AD-Vs2.15-build-115.apk`.  
**Objectivo:** replicar no resto do sistema **todas** as funcionalidades, regras de negócio e protocolos do Player-AD.  
**Smart TV (webOS / Tizen):** o que o SO não permite = **N/D** (desabilitado / indisponível), não é dívida de implementação.

Não existe player HTML de browser neste repositório. Campo: **Player-AD**, **Player-Linux**, **Player-WOS**, **Tizen**. Contrato HTTP: `/api/player/*`.

| Tipo | Significado |
|------|-------------|
| **Ref** | Implementação de referência (Player-AD) |
| **Eq** | Paridade de contrato e comportamento |
| **Parc** | Protocolo ou regra só a meias |
| **Falta** | Deve existir nesta plataforma; ainda não |
| **N/D** | Indisponível no SO / não é player de reprodução |

Monitores (`Player-iPhone`, `Player-AD-MON`) **não** são players de campo.

O player Linux de campo é **só** `Player-Linux/`.

---

## 1. Versões no mapa

| Código | Projecto | Papel | Alvo de paridade | Estado vs 2.15 |
|--------|----------|--------|------------------|----------------|
| **AD** | `Player-AD/` | TV box Android (campo) | — | **100%** referência |
| **Linux** | `Player-Linux/` | Totem / PC Linux | Alvo 2.15/115 | **~93%** do replicável |
| **WOS** | `Player-WOS/` | LG webOS (Smart TV) | Mesmo contrato HTTP | **~96%** do replicável + N/D de campo Android |
| **Tizen** | `player-client/platforms/tizen/` | Samsung Tizen (Smart TV) | Contrato `/api/player/*` | **~92%** do replicável + N/D |
| **MON** | `Player-iPhone/` · `Player-AD-MON/` | Monitor JWT (painel) | Telemetria web | **0%** playback; fora do kiosk |

Deltas 2.14–2.15 no AD: escape de kiosk; HOME persistente. No Linux: `scripts/kiosk-escape.sh` (SIGUSR1) + `player-linux.service`.

---

## 2. Protocolos HTTP (mesmo contrato que o AD)

| L3 contrato | AD | Linux | WOS | Tizen |
|-------------|----|-------|-----|-------|
| `GET /api/player/token` | Ref | Eq | Parc | Parc |
| `POST /api/player/sync` (preferido) + fallback HB | Ref | Eq | Eq | Eq |
| `POST /api/player/heartbeat` + métricas | Ref | Eq | Eq | Eq |
| `GET /api/player/dispatch` condicionado (`needsDispatch`) | Ref | Eq | Eq | Eq |
| `GET /api/player/config` | Ref | Eq | Eq | Eq |
| `POST /api/player/command-result` at-most-once | Ref | Eq | Eq | Eq |
| Telemetria events v2 / fila persistente | Ref | Eq (jsonl + POST `/event`) | Parc | Parc |
| OTA report no HB + `POST /api/player/ota-status` | Ref | Eq (`.deb`) | **N/D** | **N/D** |

`platform` no HB: AD `android` · Linux `linux` · WOS `webos` · Tizen `tizen`.

---

## 3. Regras de negócio (RN-PAD)

| Regra | AD | Linux | WOS | Tizen |
|-------|----|-------|-----|-------|
| RN-PAD-001 EMPTY_PLAN estável (sem reboot loop) | Ref | Eq | Eq | Parc |
| RN-PAD-002 Recibo **antes** do efeito (comandos destrutivos) | Ref | Eq | Eq | Eq |
| RN-PAD-003 Duplicata = ACK sem reexecutar | Ref | Eq | Eq | Eq |
| RN-PAD-004 Display idle (agenda; index=0) | Ref | Eq | Eq (overlay) | Parc |
| RN-PAD-005 Dispatch só se needsDispatch / safety | Ref | Eq | Eq | Parc |
| RN-PAD-006 HB fora do caminho crítico de render | Ref | Eq (thread) | Parc | Parc |
| RN-PAD-007 `device_id` trim+uppercase | Ref | Eq | Eq | Eq |
| Plano ONLINE → PERSISTIDO → FALLBACK local | Ref | Eq (ficheiros) | Eq (localStorage) | Parc |
| Vinhetas só no fallback mix N:1 | Ref | Eq | Eq | Eq |
| Poll adaptativo + idle fora de horário | Ref | Eq | Eq | Eq |
| Estados ACTIVE / EMPTY / UNAVAILABLE | Ref | Eq | Eq | Parc |

---

## 4. Playback e cache

| L3 | AD | Linux | WOS | Tizen |
|----|----|-------|-----|-------|
| Vídeo FIT 9:16 (720×1280, sem distorção) | Ref | Eq (GStreamer) | Parc | Parc (HLS) |
| Imagem (duração default 10 s) | Ref | Eq | Eq | Parc |
| HTML / WebView (default 60 s, mín 30) | Ref | Eq (Chromium kiosk) | Eq (iframe) | N/D / Parc |
| Loop sem bloquear rede entre mídias | Ref | Eq | Parc | Parc |
| Cache `{mediaId}.{ext}` + metadata + LRU | Ref | Eq | Eq (IndexedDB) | Eq (ficheiro LRU) |
| Checksum / contentVersion | Ref | Eq | Eq (SHA-256 + contentVersion) | Eq (SHA-256 + contentVersion) |
| Áudio mute por default | Ref | Eq | Eq | Verificar |
| Transição véu preto | Ref | Eq | Eq | Eq |
| Rotação viewport / `displayRotation` | Ref | Eq (xrandr) | **N/D** | **N/D** |

---

## 5. Comandos remotos (`pendingCommands`)

| type | AD | Linux | WOS | Tizen |
|------|----|-------|-----|-------|
| `refresh_dispatch` / `sync_now` | Ref | Eq | Eq | Eq |
| `invalidate_*` / `purge_cache` | Ref | Eq | Eq | Eq |
| `config` / `apply_player_config` | Ref | Eq | Eq | Parc |
| `restart` / `restart_app` | Ref | Eq | Parc (reload app) | Parc |
| `reboot` / `reset_board` | Ref | Eq (`systemctl`) | **N/D** | **N/D** |
| `configure_wifi` | Ref | Eq (`nmcli`) | **N/D** | **N/D** |
| `display_force_on/off/clear` | Ref | Eq | Eq | Parc |
| `capture_screen` / `screenshot` | Ref | Eq | **N/D** | **N/D** |
| `update` / `ota_rollback` | Ref (APK SHA-256) | Eq (`.deb`) | **N/D** | **N/D** |

WOS: comandos N/D fazem ACK `unsupported` (servidor não reenvia em loop).

---

## 6. Campo, kiosk, instalação (Android-first)

| L3 | AD | Linux | WOS | Tizen |
|----|----|-------|-----|-------|
| Kiosk lock-task + HOME persistente (2.15) | Ref | Eq (systemd + xset) | **N/D** | **N/D** |
| Escape 3× OK → config + Settings | Ref | Eq (`SIGUSR1` / `kiosk-escape.sh`) | **N/D** | **N/D** |
| Boot completed / autostart 24/7 | Ref | Eq (systemd + xdg autostart) | Parc (app TV) | Parc |
| Kit pendrive + ADB + instalador APK 1.7 | Ref | Outro kit (`install-player-linux.sh`) | **N/D** | **N/D** |
| Logos / bootanimation | Ref | Eq splash `branding/logo.png`; plymouth = SO (doc) | **N/D** | **N/D** |
| Debug 5 toques / 3 toques | Ref | Parc (SIGUSR1; sem overlay X11) | Eq (3× / 1200 ms) | Eq (3× / 1200 ms) |
| USB storage externo primeiro | Ref | Parc (`/proc/mounts`) | **N/D** / limitado | limitado |
| `su` / reboot privilegiado | Ref | Eq (systemd) | **N/D** | **N/D** |
| Cue Maestro no APK | Fora 0.1 lab | Fora | Fora | Fora |

---

## 7. Superfície replicável vs N/D (planeamento)

Percentagem = julgamento contra o **catálogo AD 2.15**, excluindo linhas N/D dessa coluna.

| Plataforma | Replicável (excl. N/D) | Feito | Falta | Prioridade |
|------------|------------------------|-------|-------|------------|
| Player-AD 2.15 | 100% | 100% | 0 | Referência |
| Player-Linux | ~90% (sem APK/ADB) | **~93%** | plymouth/bootanimation de firmware (SO, não o binário) | **P0** residual |
| Player-WOS | ~55% (resto N/D) | **~96%** desse 55% | HB no mesmo JS do vídeo | **P1** Smart TV |
| Tizen | ~55% | **~92%** desse 55% | EMPTY_PLAN / needsDispatch parciais | **P1** Smart TV |
| iPhone / AD-MON | 0% kiosk | monitor | fora deste plano | — |

---

## 8. Ordem de trabalho (cruzamento)

1. **Contrato único** — `cursor/player-ad-215-parity` (Linux, WOS, Tizen HLS).
2. **Player-Linux fase 2** — GStreamer FIT, HTML Chromium, systemd, OTA `.deb`, NM Wi‑Fi, screenshot, SIGUSR1.
3. **WOS** — véu, HTML iframe, GET config, poll adaptativo, cache LRU IndexedDB, debug 3 toques.
4. **Tizen** — `/api/player/dispatch`, vinhetas, véu, poll no HB, LRU ficheiro, debug 3 toques, `purge_cache`.
5. **Não misturar** monitores (iPhone/MON) neste backlog de kiosk.

Smart TV: o servidor aceita ACK `unsupported` / não reenvia comandos N/D em loop.
