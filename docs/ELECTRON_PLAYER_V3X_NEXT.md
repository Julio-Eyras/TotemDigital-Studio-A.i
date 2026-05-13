# Player Electron V3x — próxima etapa (Fase 4)

O piloto oficial continua com **Chromium em modo kiosk** (`scripts/install-player-v3x-linux-kiosk.sh` e `docs/PLAYER_OFICIAL_V3X.md`).

## Objetivo do pacote Electron

- Janela dedicada fullscreen, sem barra de URL.
- **Branding** (ícone, nome, splash).
- **OTA** alinhada ao fluxo existente de updates do player-web quando aplicável.
- Mesma base de URL e ativação que o kiosk atual.

## Trabalho típico (não iniciado neste repositório)

1. Repositório ou pasta `electron-player/` com `electron`, `electron-builder`.
2. Carregar `player-web` empacotado ou URL configurável (`PLAYER_URL`).
3. Integração com políticas de SO (autostart) semelhante ao script systemd atual.

Quando esta etapa for prioritária, criar issue interna com critérios de aceite: build `.deb`/`.AppImage`, teste em Mini-PC, e verificação `scripts/verify-player-v3x-kiosk.sh` adaptada ou script irmão para Electron.
