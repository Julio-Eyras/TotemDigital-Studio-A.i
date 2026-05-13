# Player Electron V3x — próxima etapa (Fase 4)

O piloto oficial continua com **Chromium em modo kiosk** (`scripts/install-player-v3x-linux-kiosk.sh` e `docs/PLAYER_OFICIAL_V3X.md`).

## Objetivo do pacote Electron

- Janela dedicada fullscreen, sem barra de URL.
- **Branding** (ícone, nome, splash).
- **OTA** alinhada ao fluxo existente de updates do player-web quando aplicável.
- Mesma base de URL e ativação que o kiosk atual.

Implementação inicial: pasta `electron-player/` (`npm install` + `PLAYER_URL=... npm start`) e provisionador opcional `scripts/install-player-v3x-electron.sh` (mesmos `--server` / `--uin` que o kiosk). Próximos passos técnicos:

1. Empacotar `player-web` estático ou manter só URL configurável (`PLAYER_URL`).
2. **Branding** e **OTA** (ícone, nome, canal de updates).
3. Integração com autostart no SO (systemd user, semelhante ao script kiosk).

Quando esta etapa for prioritária, criar issue interna com critérios de aceite: build `.deb`/`.AppImage`, teste em Mini-PC, e verificação `scripts/verify-player-v3x-kiosk.sh` adaptada ou script irmão para Electron.
