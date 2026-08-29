# TotemDigital Player (Electron) — esqueleto V3x

Piloto suportado: **Player-Linux** (GStreamer / Chromium kiosk de HTML de campanha). Esta pasta é um esqueleto Electron legado — não há página HTML `player-web` neste repositório.

## Requisitos

- Node.js 18+
- `npm install` nesta pasta

## Executar (manual)

```bash
cd electron-player
npm install
PLAYER_URL=https://seu-servidor/caminho-do-player/ npm start
```

## Provisionar no totem (Linux)

Com o repositorio ou pacote que inclua `scripts/` e `electron-player/`:

```bash
scripts/install-player-v3x-electron.sh \
  --server http://IP-OU-DOMINIO \
  --uin TD-1234-ABCD \
  --register
```

Opcoes: `--systemd-user`, `--dry-run`, `--install-deps` (curl). Gera `~/.config/totemdigital/player-v3x-electron.env` e o runner `~/.local/bin/totemdigital-player-v3x-electron`.

Verificação após instalar no mini-PC: `scripts/verify-player-v3x-electron.sh` (no repositório ou cópia do script).

Variáveis opcionais:

| Variável | Efeito |
|----------|--------|
| `PLAYER_URL` | URL completa do player (obrigatória em produção). |
| `TOTEMDIGITAL_KIOSK=1` | Inicia em ecrã inteiro. |
| `TOTEMDIGITAL_OPEN_DEVTOOLS=1` | Abre DevTools. |

## Próximos passos

Ver `docs/ELECTRON_PLAYER_V3X_NEXT.md` (OTA, branding, `electron-builder` para `.deb` / `.AppImage`).
