# Parity — Player-iPhone ↔ Player-AD 2.13 / 113

**Fonte de verdade Android (player):** `Player-AD` (`versionName` 2.13, `versionCode` 113).  
**Este documento** deixa claro que o Player-iPhone **não** é um porto do player — é um **cliente de monitorização** alinhado ao frontend web.

## 1. Identidade e papel

| | Player-AD | Player-iPhone |
|---|---|---|
| Papel | Player / kiosk no dispositivo de exibição | **Monitor** no telemóvel do operador |
| Bundle / app | `br.com.smartchannel.playerad` | `br.com.smartchannel.playeriphone` |
| `platform` heartbeat | `android` | **não envia** heartbeat de player |
| APIs `/api/player/*` | sim (token, sync, dispatch, …) | **não** |
| UI | Fullscreen playback | Lista + metadados now playing |

## 2. O que NÃO se porta do Player-AD

| Área Player-AD 2.13 | Player-iPhone |
|---------------------|---------------|
| Token player / sync / heartbeat | ❌ fora de escopo |
| Dispatch + planos ONLINE/PERSISTED/FALLBACK | ❌ |
| Cache de mídia / propagandas / vinhetas | ❌ |
| ExoPlayer / WebView / HTML | ❌ |
| Horário de tela / forceMode | ❌ (só **mostra** `display_off` se a telemetria o indicar) |
| Comandos remotos (restart, screenshot, Wi‑Fi, purge, …) | ❌ MVP (remoto = nenhum) |
| OTA / install APK | ❌ (e **não** se adiciona `platform: ios` ao OTA) |
| Kiosk / lock-task / rotação física | ❌ |
| Telemetria events-v2 jsonl no dispositivo | ❌ |
| Config `player-config.json` no aparelho | ❌ (só URL de servidor nas Definições) |

## 3. O que o MVP **sim** partilha com o ecossistema

| Capacidade | Fonte de verdade |
|------------|------------------|
| Login JWT + refresh + 2FA | Backend `/api/auth/*` + padrão frontend |
| Lista / detalhe de totens | `/api/totems`, `/api/totems/:id` |
| Estado de playback | `/playback-state` + WS `subscribe_playback_state` |
| Normalização now playing | Espelho de `normalizePlaybackState` |
| Lease observation | `telemetry-observation` start/renew/stop no ecrã Monitor |

## 4. Critério de “MVP OK”

1. Login contra instalação real (com e sem 2FA).
2. Lista mostra totens com online/offline e heartbeat.
3. Monitor actualiza metadados com WS; se WS cair, poll REST mantém dados.
4. Estados claros: offline (totem), empty, idle, display_off, stale.
5. Nenhum endpoint `/api/player/*` é chamado; nenhum heartbeat iOS.

## 5. Fase 2 (documentada, não implementada como produto)

- Remoto (screenshot / restart) — **não** no MVP por decisão de produto.
- iPad / landscape optimizado.
- Push quando totem fica offline.
- Widgets de “now playing”.
