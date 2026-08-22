# Arquitectura — Player-AD-MON

## Papel

Cliente **só monitor**: autenticar um operador, listar totens e acompanhar metadados do que está a reproduzir (nome, tipo, progresso, online/offline, stale). Sem mídia local e sem controlo remoto.

## Camadas

```text
UI (Compose)
  LoginScreen / TotemListScreen / MonitorScreen / SettingsScreen
        │
ViewModels
  AuthViewModel / TotemListViewModel / MonitorViewModel / SettingsViewModel
        │
Repositórios & serviços
  AuthRepository · TotemRepository · PlaybackTelemetryService
        │
Rede
  ApiClient (OkHttp REST) · OkHttp WebSocket
        │
Persistência
  AppSettings (SharedPreferences) · SecureTokenStore (EncryptedSharedPreferences)
```

## Fluxo Monitor (foreground)

1. `MonitorViewModel` cria `PlaybackTelemetryService` e chama `start(totemId)`.
2. Serviço:
   - liga WS em `/ws?token=…`
   - envia `subscribe_playback_state` com `{ totemId }`
   - faz poll REST a `GET /api/totems/:id/playback-state` (10 s se WS desligado, 15 s se ligado)
   - opcionalmente mantém lease `telemetry-observation` (start/renew/stop) — falhas não bloqueiam o monitor
3. Mensagens WS `totem_playback_state` e respostas REST passam por `PlaybackNormalize` (paridade com frontend / iPhone).
4. Ao sair do ecrã (`ViewModel.onCleared`): `unsubscribe`, fecha WS, `stop` do lease.

## APIs usadas

| Método | Caminho |
|--------|---------|
| POST | `/api/auth/login` |
| POST | `/api/auth/2fa/verify` |
| POST | `/api/auth/refresh` |
| POST | `/api/auth/logout` |
| GET | `/api/totems` |
| GET | `/api/totems/:id` |
| GET | `/api/totems/:id/playback-state` |
| POST/PUT/DELETE | `/api/totems/:id/telemetry-observation/*` |
| WS | `/ws?token=…` |

## Segurança

- Access + refresh tokens em EncryptedSharedPreferences (AES-GCM via AndroidX Security Crypto).
- URL do servidor em prefs normais (não secreta).
- Sem kiosk, sem `RECEIVE_BOOT_COMPLETED`, sem instalador de pacotes.

## Build

Módulo Gradle autónomo (como `Player-AD/`), AGP 8.3 / Kotlin 1.9 / Compose.  
Nome do artefacto: `Player-AD-MON-Vs{versionName}-build-{versionCode}.apk`.
