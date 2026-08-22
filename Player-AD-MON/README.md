# Player-AD-MON

App Android de **monitorização** de totens SmartSignage (metadados de reprodução).  
**Não** é kiosk, **não** é player, **não** envia comandos remotos.

Alinhado ao MVP do [`Player-iPhone/`](../Player-iPhone/) e ao hook web `useTotemPlaybackTelemetry`.

| | |
|---|---|
| Pasta | `Player-AD-MON/` |
| applicationId | `br.com.smartchannel.playeradmon` |
| Package Kotlin | `br.com.smartchannel.playeradmon` |
| versionName / versionCode | `1.0` / `1` |
| APK | `Player-AD-MON-Vs{versionName}-build-{versionCode}.apk` |

Exemplo: `Player-AD-MON-Vs1.0-build-1.apk`  
**Não** usar `Player-AD-release.apk` nem `Player-AD-MON-release.apk` como nome de distribuição.

## O que faz

1. Login JWT (`POST /api/auth/login`) + 2FA + refresh
2. Lista totens (`GET /api/totems`)
3. Monitor de um totem: `GET /api/totems/:id`, `GET …/playback-state`
4. WebSocket `/ws?token=…` com `subscribe_playback_state`
5. Poll REST ~10 s (WS desligado) / ~15 s (WS ligado) só com o ecrã Monitor aberto
6. URL do servidor editável nas Definições
7. JWT em EncryptedSharedPreferences

## O que **não** faz

- Preview AV / ExoPlayer / stream ao vivo
- Comandos remotos (screenshot, restart, Wi‑Fi, rotação, …)
- `/api/player/*`, heartbeat `platform`, OTA, kiosk, boot receiver de player

## Requisitos

- JDK 11+
- Android SDK (API 34; `minSdk` 26)
- Em `local.properties`: `sdk.dir=…` (copiado automaticamente de `Player-AD/` se existir)

## Gerar o APK

Na pasta do módulo (PowerShell ou CMD):

```bat
cd C:\TotemDigital-Studio\Player-AD-MON
gradlew.bat assembleRelease
```

APK gerado em:

```text
build\outputs\apk\release\Player-AD-MON-Vs1.0-build-1.apk
```

Cópia versionada no Git (`scripts\build-release.ps1` copia para aqui):

```text
Player-AD-MON\apk\Player-AD-MON-Vs1.0-build-1.apk
```

Debug:

```bat
gradlew.bat assembleDebug
```

Script auxiliar: `scripts\build-release.ps1`.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — camadas e fluxos
- [docs/PARITY-vs-PLAYER-AD.md](docs/PARITY-vs-PLAYER-AD.md) — diferenças vs Player-AD (kiosk)

## Relação com Player-iPhone

Contratos, normalização de playback e UX de monitor espelham o código Swift em `Player-iPhone/App/` (Auth, Totem, PlaybackTelemetry).  
A implementação Kotlin é independente; não partilha binário com o Player-AD operacional.
