# Player-LXN

Versao Linux do player, espelhando a logica base do `Player-AD`:

- heartbeat + dispatch;
- playback de video/imagem em loop;
- fallback por plano persistido e fallback local;
- telemetria de playback.

## Recomendacao (sugestao principal)

Use **Chromium em modo kiosk + systemd user service**.

Vantagens:

- mais simples de operar em campo;
- atualizacao rapida por arquivos web;
- sem necessidade de empacotar Electron.

## Como instalar

```bash
cd /caminho/Player-LXN/scripts
chmod +x install-player-lxn.sh
./install-player-lxn.sh
```

## Ubuntu one-click (recomendado)

```bash
cd /caminho/Player-LXN/scripts
chmod +x install-player-lxn-ubuntu-oneclick.sh
./install-player-lxn-ubuntu-oneclick.sh
```

Depois configure autostart da sessao grafica:

```bash
chromium --kiosk --app=http://127.0.0.1:17890 --autoplay-policy=no-user-gesture-required
```

## Configuracao

Arquivo principal:

- `config/player-config.json`

Campos:

- `serverUrl`
- `uin`
- `deviceId`
- `acceptImagesInPlaylist`
- `fallbackPropagandasPerVinheta`
- `fallbackPropagandas`
- `fallbackVinhetas`
