# Player-iPhone

Aplicação **iOS (iPhone)** de **monitorização** para o TotemDigital Studio / Smart Signage.

| Campo | Valor |
|-------|--------|
| Pasta | `Player-iPhone/` (alinhada a `Player-AD` / `Player-Linux`) |
| Papel | **Só monitor** — não é player, totem nem kiosk |
| Dispositivos | iPhone, **iOS 16+** |
| Idioma UI/docs | Português |
| Versão MVP | `0.1.0` (build 1) |
| Bundle ID | `br.com.smartchannel.playeriphone` |

## O que faz (MVP)

1. **Login** JWT (`POST /api/auth/login`) com URL de servidor editável; **2FA** se a API exigir (`POST /api/auth/2fa/verify`); refresh (`POST /api/auth/refresh`).
2. **Lista de totens** (`GET /api/totems`) — estado online/offline, último heartbeat, contagem de mídias.
3. **Monitor** — metadados de now playing (nome, tipo, playlist, progresso estimado, stale) via:
   - WebSocket `/ws?token=…` + `subscribe_playback_state`
   - Poll REST `GET /api/totems/:id/playback-state` (~10–15 s)
   - Lease opcional `telemetry-observation` start/renew/stop enquanto o ecrã Monitor está visível
4. **Definições** — URL do servidor, intervalo de poll, logout, versão.

Tokens JWT ficam no **Keychain**. URL do servidor e preferências não-secretas em **UserDefaults**.

## O que NÃO faz

- Não chama `/api/player/*`
- Não envia heartbeat com `platform: ios`
- Não reproduz mídia / kiosk / OTA
- Não tem remoto (screenshot, restart, Wi‑Fi) no MVP

Ver [docs/PARITY-PLAYER-AD-2.13.md](./docs/PARITY-PLAYER-AD-2.13.md).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/ARQUITETURA.md](./docs/ARQUITETURA.md) | Módulos SwiftUI, fluxo auth/telemetria |
| [docs/PARITY-PLAYER-AD-2.13.md](./docs/PARITY-PLAYER-AD-2.13.md) | O que **não** se porta do Player-AD |

## Abrir no Mac / Xcode

Este repositório pode ser editado em Windows; a **compilação iOS exige macOS + Xcode**.

### Opção A — XcodeGen (recomendado)

```bash
brew install xcodegen   # se ainda não tiver
cd Player-iPhone
xcodegen generate       # cria Player-iPhone.xcodeproj a partir de project.yml
open Player-iPhone.xcodeproj
```

No Xcode: escolha um simulador iPhone (iOS 16+) ou dispositivo, e **Run** (⌘R).

### Opção B — Projecto manual no Xcode

1. Xcode → **File → New → Project → iOS → App**
2. Product Name: `Player-iPhone`
3. Interface: **SwiftUI**, Language: **Swift**, mínimo **iOS 16**
4. Bundle Identifier: `br.com.smartchannel.playeriphone`
5. Apague o `ContentView.swift` / `*App.swift` gerados
6. Arraste a pasta `Player-iPhone/App/` para o projecto (Copy se necessário; **Create groups**)
7. Em **Target → Info**, use `App/Resources/Info.plist` (ou copie as chaves ATS / display name)
8. Active **Signing** com a sua equipa Apple
9. Run

### ATS / rede local

`Info.plist` inclui `NSAllowsLocalNetworking` para testes em LAN (`http://192.168…`). Para HTTP claro em hosts não-locais, ajuste ATS conscientemente.

## API usada (já existente no backend)

| Método | Caminho | Uso |
|--------|---------|-----|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/2fa/verify` | 2FA após login |
| POST | `/api/auth/refresh` | Renovar JWT |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/totems` | Lista |
| GET | `/api/totems/:id` | Detalhe |
| GET | `/api/totems/:id/playback-state` | Estado quente |
| WS | `/ws?token=…` | `subscribe_playback_state` / `totem_playback_state` |
| POST/PUT/DELETE | `/api/totems/:id/telemetry-observation/*` | Lease enquanto Monitor está aberto |

Contratos alinhados ao frontend (`authApi`, `totemApi`, `useTotemPlaybackTelemetry`, `normalizePlaybackState`).

## Estado actual (0.1.0)

- [x] Estrutura SwiftUI + docs
- [x] Auth + Keychain + 2FA
- [x] Lista de totens
- [x] Monitor metadados (WS + REST + lease)
- [x] Definições (URL, logout, versão)
- [ ] Geração automática de `.xcodeproj` no CI macOS
- [ ] Remoto / screenshot (fora de escopo MVP)
- [ ] iPad / Apple TV (fase posterior)

## Próximos passos sugeridos

1. Gerar o projecto no Mac com `xcodegen generate` e validar build no simulador.
2. Testar login + 2FA contra uma instalação real.
3. Abrir um totem online e confirmar progresso / stale / idle / display_off.
4. (Fase 2) widgets, notificações push de offline, iPad layout.
