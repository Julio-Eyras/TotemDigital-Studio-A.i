# Paridade vs Player-AD (kiosk)

Documento de diferenças entre **Player-AD-MON** (monitor) e **Player-AD** (player operacional em TV/STB).

| Área | Player-AD (kiosk) | Player-AD-MON |
|------|-------------------|---------------|
| Função | Reproduzir playlist no ecrã | Observar o que o totem está a reproduzir |
| Utilizador | Dispositivo / kiosk | Operador humano (JWT) |
| applicationId | `br.com.smartchannel.playerad` | `br.com.smartchannel.playeradmon` |
| APK | `Player-AD-Vs*-build-*.apk` | `Player-AD-MON-Vs*-build-*.apk` |
| `/api/player/*` | Sim (heartbeat, dispatch, events) | **Não** |
| Heartbeat `platform` | Sim (android) | **Não** |
| OTA | Sim | **Não** |
| Kiosk / lock task / HOME | Sim | **Não** |
| Boot receiver | Sim | **Não** |
| ExoPlayer / cache de mídia | Sim | **Não** |
| Comandos remotos | Recebe e executa | **Não envia nem executa** |
| Auth operador | Não (token de player) | Login + 2FA + refresh |
| WS playback | N/A (é a fonte) | Subscreve `subscribe_playback_state` |
| URL servidor | Config de player / provisioning | Editável nas Definições |

## Relação com Player-iPhone

Player-AD-MON e Player-iPhone partilham o **mesmo contrato de produto** (monitor-only, metadados, mesmas rotas REST/WS).  
Player-AD continua a ser o **endpoint de reprodução** no terreno; MON/iPhone apenas observam telemetria já publicada pelo backend.

## O que não alterar neste módulo

- Schema DB / enums OTA `ios`/`android`
- Código operacional de `Player-AD/` (salvo referência documental)
- Endpoints de comando remoto ou dispatch de player
