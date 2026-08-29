# Equivalência dos players vs Player-AD 2.15 / 115

**Fonte de verdade:** `Player-AD/` (`versionName` 2.15, `versionCode` 115) — `Player-AD-Vs2.15-build-115.apk`.  
**Objectivo:** replicar no resto do sistema **todas** as funcionalidades, regras de negócio e protocolos do Player-AD.  
**Smart TV (webOS / Tizen):** o que o SO não permite = **N/D** (desabilitado / indisponível), não é dívida de implementação.

| Tipo | Significado |
|------|-------------|
| **Ref** | Implementação de referência (Player-AD) |
| **Eq** | Paridade de contrato e comportamento |
| **Parc** | Protocolo ou regra só a meias |
| **Falta** | Deve existir nesta plataforma; ainda não |
| **N/D** | Indisponível no SO / não é player de reprodução |

Monitores (`Player-iPhone`, `Player-AD-MON`) **não** são players de campo: entram na última coluna só para não os misturar com kiosk.

O player Linux de campo é **só** `Player-Linux/` (não há segunda linha Chromium/kiosk).

---

## 1. Versões no mapa

| Código | Projecto | Papel | Alvo de paridade | Estado vs 2.15 |
|--------|----------|--------|------------------|----------------|
| **AD** | `Player-AD/` | TV box Android (campo) | — | **100%** referência |
| **Linux** | `Player-Linux/` | Totem / PC Linux | Alvo 2.15/115 | **~50%** — sync/ACK/EMPTY_PLAN; GStreamer/HTML/OTA/kiosk em falta |
| **WOS** | `Player-WOS/` | LG webOS (Smart TV) | Mesmo contrato HTTP | **~45%** + N/D de campo Android |
| **Tizen** | `player-client/platforms/tizen/` | Samsung Tizen (Smart TV) | Contrato `/api/player/*` | **~40%** + N/D |
| **Web** | `player-web/` | Browser / laboratório | Dispatch + cache + ACK | **~55%**; reboot/Wi‑Fi/OTA = N/D |
| **MON** | `Player-iPhone/` · `Player-AD-MON/` | Monitor JWT (painel) | Telemetria web | **0%** playback; fora do kiosk |

O Player-Linux tem de **retargetar 2.15/115** (hoje o README/parity citam 2.13). Deltas 2.14–2.15: escape de kiosk; HOME persistente.

---

## 2. Protocolos HTTP (mesmo contrato que o AD)

| L3 contrato | AD | Linux | WOS | Tizen | Web |
|-------------|----|-------|-----|-------|-----|
| `GET /api/player/token` | Ref | Eq | Parc | Parc | Eq |
| `POST /api/player/sync` (preferido) + fallback HB | Ref | Eq | Eq | Eq | Eq |
| `POST /api/player/heartbeat` + métricas | Ref | Eq | Eq | Eq | Eq |
| `GET /api/player/dispatch` condicionado (`needsDispatch`) | Ref | Eq | Eq | Parc | Eq |
| `GET /api/player/config` | Ref | Eq | Parc | Parc | Parc |
| `POST /api/player/command-result` at-most-once | Ref | Eq | Eq | Eq | Eq |
| Telemetria events v2 / fila persistente | Ref | Parc (jsonl) | Parc | Parc | Parc |
| OTA report no HB | Ref | Falta (.deb/AppImage) | **N/D** | **N/D** | **N/D** |

`platform` no HB: AD `android` · Linux `linux` · WOS `webos` · Tizen `tizen` · Web `web`.

---

## 3. Regras de negócio (RN-PAD)

| Regra | AD | Linux | WOS | Tizen | Web |
|-------|----|-------|-----|-------|-----|
| RN-PAD-001 EMPTY_PLAN estável (sem reboot loop) | Ref | Eq | Eq | Parc | Eq |
| RN-PAD-002 Recibo **antes** do efeito (comandos destrutivos) | Ref | Eq | Eq | Eq | Eq |
| RN-PAD-003 Duplicata = ACK sem reexecutar | Ref | Eq | Eq | Eq | Eq |
| RN-PAD-004 Display idle (agenda; index=0) | Ref | Eq (lógica) | Parc (overlay) | Parc | Parc (overlay) |
| RN-PAD-005 Dispatch só se needsDispatch / safety | Ref | Eq | Eq | Parc | Eq |
| RN-PAD-006 HB fora do caminho crítico de render | Ref | Parc | Parc | Parc | Parc |
| RN-PAD-007 `device_id` trim+uppercase | Ref | Eq | Eq | Eq | Eq |
| Plano ONLINE → PERSISTIDO → FALLBACK local | Ref | Eq (ficheiros) | Parc (localStorage) | Parc | Parc |
| Vinhetas só no fallback mix N:1 | Ref | Eq (regra) | Falta | Falta | Falta |
| Poll adaptativo + idle fora de horário | Ref | Eq (lógica) | Falta | Falta | Falta |
| Estados ACTIVE / EMPTY / UNAVAILABLE | Ref | Parc | Falta | Falta | Falta |

---

## 4. Playback e cache

| L3 | AD | Linux | WOS | Tizen | Web |
|----|----|-------|-----|-------|-----|
| Vídeo FIT 9:16 (720×1280, sem distorção) | Ref | Falta (GStreamer) | Parc | Parc (HLS) | Parc |
| Imagem (duração default 10 s) | Ref | Falta | Parc | Parc | Parc |
| HTML / WebView (default 60 s, mín 30) | Ref | Falta (WebKit fase 2) | Parc | N/D / Parc | Parc |
| Loop sem bloquear rede entre mídias | Ref | Falta | Parc | Parc | Parc |
| Cache `{mediaId}.{ext}` + metadata + LRU | Ref | Parc | Falta | Parc | Parc (IndexedDB) |
| Checksum / contentVersion | Ref | Parc | Falta | Parc | Parc |
| Áudio mute por default | Ref | Eq (regra) | Verificar | Verificar | Verificar |
| Transição véu preto | Ref | Falta | Falta | Falta | Falta |
| Rotação viewport / `displayRotation` | Ref | Falta (compositor) | **N/D** | **N/D** | **N/D** |

---

## 5. Comandos remotos (`pendingCommands`)

| type | AD | Linux | WOS | Tizen | Web |
|------|----|-------|-----|-------|-----|
| `refresh_dispatch` / `sync_now` | Ref | Eq | Eq | Eq | Eq |
| `invalidate_*` / `purge_cache` | Ref | Eq | Eq | Parc | Eq |
| `config` / `apply_player_config` | Ref | Eq | Eq | Parc | Eq |
| `restart` / `restart_app` | Ref | Eq | Parc (reload app) | Parc | **N/D** |
| `reboot` / `reset_board` | Ref | Parc (`systemctl`) | **N/D** | **N/D** | **N/D** |
| `configure_wifi` | Ref | Falta (NM fase 2) | **N/D** | **N/D** | **N/D** |
| `display_force_on/off/clear` | Ref | Eq | Parc (overlay) | Parc | Parc |
| `capture_screen` / `screenshot` | Ref | Falta | **N/D** | **N/D** | **N/D** |
| `update` / `ota_rollback` | Ref (APK SHA-256) | Falta (.deb) | **N/D** | **N/D** | **N/D** |

WOS/Web: heartbeat **pode** trazer a lista; **executar + ACK** é a dívida (excepto N/D).

---

## 6. Campo, kiosk, instalação (Android-first)

| L3 | AD | Linux | WOS | Tizen | Web |
|----|----|-------|-----|-------|-----|
| Kiosk lock-task + HOME persistente (2.15) | Ref | Falta (X11/Wayland / systemd) | **N/D** | **N/D** | **N/D** |
| Escape 3× OK → config + Settings | Ref | Falta | **N/D** | **N/D** | **N/D** |
| Boot completed / autostart 24/7 | Ref | Falta (systemd) | Parc (app TV) | Parc | **N/D** |
| Kit pendrive + ADB + instalador APK 1.7 | Ref | Outro kit (não APK) | **N/D** | **N/D** | **N/D** |
| Logos / bootanimation | Ref | Falta | **N/D** | **N/D** | **N/D** |
| Debug 5 toques / 3 toques | Ref | Falta | Falta | Falta | Parc |
| USB storage externo primeiro | Ref | Parc (`/proc/mounts`) | **N/D** / limitado | limitado | **N/D** |
| `su` / reboot privilegiado | Ref | Parc (systemd) | **N/D** | **N/D** | **N/D** |
| Cue Maestro no APK | Fora 0.1 lab | Fora | Fora | Fora | Fora |

---

## 7. Superfície replicável vs N/D (planeamento)

Percentagem = julgamento contra o **catálogo AD 2.15**, excluindo linhas N/D dessa coluna (Smart TV não é penalizada por não ter lock-task Android).

| Plataforma | Replicável (excl. N/D) | Feito | Falta | Prioridade |
|------------|------------------------|-------|-------|------------|
| Player-AD 2.15 | 100% | 100% | 0 | Referência |
| Player-Linux | ~90% (sem APK/ADB) | ~40% | playback/HTML/OTA/kiosk/Wi‑Fi/screenshot; retarget 2.15 | **P0** |
| Player-WOS | ~55% (resto N/D) | ~30% | contrato + RN-PAD + comandos não N/D; N/D ficam desligados | **P1** Smart TV |
| Tizen | ~55% | ~25% | alinhar a WOS (mesmo contrato, HLS onde o SO exigir) | **P1** Smart TV |
| player-web | ~50% | ~40% | **não** executar reboot/wifi/OTA; sim ACK de purge/refresh/config | **P2** lab |
| iPhone / AD-MON | 0% kiosk | monitor | fora deste plano | — |

---

## 8. Ordem de trabalho (cruzamento)

1. **Contrato único** — todos os players de reprodução: token → sync/HB → dispatch condicionado → command-result; RN-PAD-001..007; `device_id` canónico.
2. **Player-Linux → 2.15** — actualizar `PARITY-PLAYER-AD-2.13.md` para 2.15/115; fechar GStreamer FIT, HTML, kiosk systemd, OTA Linux, NM Wi‑Fi, screenshot.
3. **WOS / Tizen** — mesmo subconjunto de protocolo e RN; na UI/API marcar reboot, Wi‑Fi, OTA APK, kiosk HOME, ADB, screenshot como **desabilitado**.
4. **player-web** — executar só comandos seguros no browser (`refresh_dispatch`, `purge` limitado por quota, `config`); resto N/D.
5. **Não misturar** monitores (iPhone/MON) neste backlog de kiosk.

Smart TV: o servidor deve aceitar ACK `unsupported` / não reenviar comandos N/D em loop.
