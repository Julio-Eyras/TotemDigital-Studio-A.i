# TotemDigital Player (Electron) — esqueleto V3x

Piloto suportado continua a ser **Chromium kiosk** (`docs/PLAYER_OFICIAL_V3X.md`). Esta pasta é um **ponto de partida** para empacotar o mesmo `player-web` numa janela dedicada.

## Requisitos

- Node.js 18+
- `npm install` nesta pasta

## Executar

```bash
cd electron-player
npm install
PLAYER_URL=https://seu-servidor/caminho-do-player/ npm start
```

Variáveis opcionais:

| Variável | Efeito |
|----------|--------|
| `PLAYER_URL` | URL completa do player (obrigatória em produção). |
| `TOTEMDIGITAL_KIOSK=1` | Inicia em ecrã inteiro. |
| `TOTEMDIGITAL_OPEN_DEVTOOLS=1` | Abre DevTools. |

## Próximos passos

Ver `docs/ELECTRON_PLAYER_V3X_NEXT.md` (OTA, branding, `electron-builder` para `.deb` / `.AppImage`).
