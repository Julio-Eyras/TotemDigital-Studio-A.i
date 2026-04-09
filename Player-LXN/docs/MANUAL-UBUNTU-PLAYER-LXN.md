# Player-LXN no Ubuntu

Data: 2026-04-07

## 1) Objetivo

Executar o `Player-LXN` no Ubuntu em modo kiosk, iniciando automaticamente no boot/login.

## 2) Arquitetura recomendada

- HTTP local: `python3 -m http.server` servido por `systemd --user`.
- Frontend do player acessado em `http://127.0.0.1:17890`.
- Chromium em modo kiosk via arquivo `.desktop` no autostart.

## 3) Pre-requisitos Ubuntu

```bash
sudo apt update
sudo apt install -y python3 chromium-browser
```

## 4) Instalação

```bash
cd /caminho/Player-LXN/scripts
chmod +x install-player-lxn.sh
./install-player-lxn.sh
```

## 4.1) Instalação one-click (Ubuntu)

```bash
cd /caminho/Player-LXN/scripts
chmod +x install-player-lxn-ubuntu-oneclick.sh
./install-player-lxn-ubuntu-oneclick.sh
```

Esse script:

- instala dependências (`python3`, `chromium-browser`);
- aplica permissões de execução;
- roda setup completo;
- mostra status final.

O script cria:

- serviço: `~/.config/systemd/user/player-lxn-http.service`
- autostart: `~/.config/autostart/player-lxn-kiosk.desktop`

## 5) Configuração do player

Arquivo:

- `Player-LXN/config/player-config.json`

Campos principais:

- `serverUrl`
- `uin`
- `deviceId`
- `fallbackPropagandasPerVinheta`
- `fallbackPropagandas`
- `fallbackVinhetas`

Depois de alterar a configuração, reinicie o serviço.

## 6) Operação diária

Dar permissão de execução (uma vez):

```bash
cd /caminho/Player-LXN/scripts
chmod +x *.sh
```

Status:

```bash
./status-player-lxn.sh
```

Reiniciar:

```bash
./restart-player-lxn.sh
```

Atualizar (com pull + restart):

```bash
./update-player-lxn.sh
```

## 7) Comandos systemd úteis

```bash
systemctl --user status player-lxn-http.service
systemctl --user restart player-lxn-http.service
journalctl --user -u player-lxn-http.service -n 100 --no-pager
```

## 8) Troubleshooting

- Chromium não abre no boot:
  - validar arquivo em `~/.config/autostart/player-lxn-kiosk.desktop`.
- Tela preta:
  - abrir no navegador: `http://127.0.0.1:17890`.
  - verificar status do serviço `player-lxn-http.service`.
- Sem comunicação com backend:
  - revisar `serverUrl`, firewall e rede.
  - revisar `uin` e `deviceId`.
