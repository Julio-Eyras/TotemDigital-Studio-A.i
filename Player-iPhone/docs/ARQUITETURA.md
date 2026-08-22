# Arquitectura — Player-iPhone

App **monitor** (SwiftUI). Não espelha os pacotes de playback/cache/OTA do Player-AD; alinha-se ao **painel web** (auth + totens + telemetria).

```text
Player-iPhone/
├── README.md
├── project.yml                 # XcodeGen → .xcodeproj (gerar no Mac)
├── docs/
│   ├── ARQUITETURA.md
│   └── PARITY-PLAYER-AD-2.13.md
└── App/
    ├── PlayerIPhoneApp.swift   # @main
    ├── AppVersion.swift
    ├── Resources/Info.plist
    ├── Models/                 # Auth, Totem, PlaybackState (+ normalize)
    ├── Services/               # APIClient, Auth, Totem, WS telemetria, Keychain, Settings
    ├── ViewModels/
    └── Views/                  # Login, Lista, Monitor, Definições
```

## Fluxo

```text
Login (URL servidor + user/pass)
  ├─ requiresTwoFactor? → 2FA → tokens
  └─ tokens → Keychain
        │
        ├─ Tab Totens → GET /api/totems
        │     └─ tap → Monitor
        │           ├─ GET /api/totems/:id
        │           ├─ WS subscribe_playback_state
        │           ├─ poll GET …/playback-state (10–15 s)
        │           └─ lease telemetry-observation (enquanto visível)
        └─ Tab Definições → URL / logout / versão
```

## Camadas

| Módulo | Responsabilidade |
|--------|------------------|
| `APIClient` | HTTP JSON, Bearer, refresh em 401 |
| `AuthService` | Login / 2FA / logout / estado sessão |
| `TotemService` | Lista, detalhe, playback-state, lease |
| `PlaybackTelemetryService` | WS + poll + normalização (paridade frontend) |
| `KeychainStore` | `access_token`, `refresh_token`, `user_json` |
| `AppSettings` | URL servidor + intervalo poll (UserDefaults) |

## Normalização de playback

`PlaybackNormalize` espelha `frontend/src/utils/playbackTelemetry.ts`:

- `displayIdle` → status `display_off`
- sem mídia com ecrã ligado → `idle`
- `stale` explícito ou passado do `expectedEndAt` (+ 15 s de graça)
- aceita camelCase e snake_case

## Storage

| Dado | Onde |
|------|------|
| JWT + refresh + user | Keychain (`br.com.smartchannel.playeriphone`) |
| URL servidor | UserDefaults |
| Intervalo poll | UserDefaults |

## Dependências

Só frameworks Apple: **SwiftUI**, **Foundation**, **Security** (Keychain), **URLSession** (HTTP + WebSocket). Sem SPM externo no MVP.

## Segurança / rede

- ATS: `NSAllowsLocalNetworking` para LAN de desenvolvimento.
- Servidor multi-instalação: URL completa editável (`https://host` ou `http://host:porta`); caminhos da API são absolutos a partir da raiz (`/api/…`, `/ws`).
