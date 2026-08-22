# API e configuração — Player-Linux

Contrato idêntico ao Player-AD 2.13, excepto `platform: "linux"`.

## Endpoints

| Uso | Método | Path |
|-----|--------|------|
| Token | GET | `/api/player/token?uin&deviceId` |
| Sync (preferido) | POST | `/api/player/sync?uin&token&deviceId` |
| Heartbeat (fallback) | POST | `/api/player/heartbeat?uin&token&deviceId` |
| Dispatch | GET | `/api/player/dispatch?uin&token&deviceId&timezone` |
| Command result | POST | `/api/player/command-result` |
| OTA status | POST | `/api/player/ota-status` |
| Events | POST | `/api/player/sync` ou `/events/batch` ou `/event` |

### Body heartbeat (dentro do sync)

```json
{
  "uin": "…",
  "deviceId": "…",
  "status": "online",
  "platform": "linux",
  "version": "0.1.0",
  "appVersion": "0.1.0"
}
```

### Sync envelope

```json
{
  "schemaVersion": 1,
  "syncId": "uuid-or-monotonic",
  "heartbeat": { },
  "knownPlanVersion": "…"
}
```

## `player-config.json`

Mesmas chaves que `install-pendrive/config/exemplo-player-config.json`:

| Chave | Default |
|-------|---------|
| `serverUrl` | obrigatório |
| `uin` | obrigatório |
| `deviceId` | obrigatório |
| `acceptImagesInPlaylist` | true |
| `allowPlaybackAudio` | false |
| `mediaTransitionEnabled` | 1 |
| `fallbackPropagandasPerVinheta` | 3 |
| `batimentoCardiaco` | 30 (≥15) |
| `maxSecondsWithoutServerCheck` | 180 (≥30) |
| `pollAdaptive` | objeto (ver exemplo) |
| `storage` | `path_override` recomendado no Linux |
| `storagePathOverride` | path absoluto data root |
| `maxCacheSizeMb` | 1000 |
| `maxCachePercentOfVolume` | null |
| `kioskMode` | `strong` \| `immersive` |
| `displayRotation` | 0–3 |
| `screenOrientation` | portrait \| landscape \| … |

## Display schedule (`display-schedule.json`)

| Campo | Tipo |
|-------|------|
| `enabled` | bool |
| `timezone` | IANA (ex. `America/Sao_Paulo`) |
| `daysOfWeek` | 0–6 |
| `onTime` / `offTime` | `HH:mm` |
| `keepAliveWhileOff` | bool |
| `keepAliveIntervalMinutes` | 5–30 |
| `forceMode` | `on` \| `off` \| null |

## Plano de dispatch (campos usados)

`mediaItems[]`: `mediaId`, `url`/`file_path`/`src`, `duration`/`display_seconds`, `mediaType`, `order`, `tags`, `metadata.contentVersion`, `metadata.deliveryRotation`, `metadata.deliveryBakeVersion`.
