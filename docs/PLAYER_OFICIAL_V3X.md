# Player Oficial V3x

Data: 2026-05-12

## Objetivo

Definir um caminho suportado para os primeiros pilotos do TotemDigital V3x usando Linux Mini-PC com Chromium em modo kiosk.

Este guia nao substitui os players Android/Web. Ele define a opcao recomendada para instalacoes comerciais em que precisamos de autostart, watchdog simples, diagnostico local e menor fragmentacao de hardware.

## Perfil Recomendado

- Mini-PC Linux ou Ubuntu Desktop/Lubuntu.
- Saida HDMI ligada diretamente na TV/totem.
- Rede cabeada sempre que possivel.
- Chromium/Chrome em modo kiosk.
- Player servido pelo backend em `/player`.

## Fluxo De Provisionamento

1. Cadastre a tela em `Totens` e copie o codigo de ativacao.
2. Instale o backend TotemDigital em servidor acessivel pela rede local ou cloud.
3. No Mini-PC, execute o provisionador:

```bash
scripts/install-player-v3x-linux-kiosk.sh \
  --server http://IP-OU-DOMINIO \
  --uin TD-1234-ABCD \
  --register \
  --install-deps
```

4. Aprove o hardware no painel quando ele aparecer como aguardando aprovacao.
5. Reinicie a sessao grafica ou o equipamento para validar o autostart.

## O Que O Script Configura

- Arquivo de configuracao em `~/.config/totemdigital/player-v3x.env`.
- Runner local em `~/.local/bin/totemdigital-player-v3x-kiosk`.
- Por defeito: entrada de autostart em `~/.config/autostart/totemdigital-player-v3x.desktop`.
- Com `--systemd-user`: unidade `totemdigital-player-v3x.service` em `~/.config/systemd/user/` (sem ficheiro autostart, para nao arrancar o Chromium duas vezes).
- Loop watchdog simples: se o Chromium sair, ele abre novamente apos 5 segundos.
- Log local em `~/.local/state/totemdigital/player-v3x-kiosk.log`.

## Systemd User (Opcional)

Em ambientes Ubuntu/Debian com sessao grafica, o systemd do utilizador costuma integrar-se melhor com reinicios e `journalctl` do que apenas o autostart XDG.

```bash
scripts/install-player-v3x-linux-kiosk.sh \
  --server http://IP-OU-DOMINIO \
  --uin TD-1234-ABCD \
  --systemd-user \
  --install-deps
```

Depois da instalacao (se `systemctl` existir no PATH):

```bash
systemctl --user start totemdigital-player-v3x.service
```

Ver estado:

```bash
systemctl --user status totemdigital-player-v3x.service
```

## Linger (Opcional, Com Sudo)

`loginctl enable-linger` faz o **systemd user** desse utilizador arrancar no boot da maquina (util para SSH, timers e unidades user antes do primeiro login interativo). O Chromium do totem **continua a depender** da sessao grafica (`After=graphical-session.target` na unidade); em piloto mantenha **login automatico** na consola do totem.

```bash
scripts/install-player-v3x-linux-kiosk.sh \
  --server http://IP-OU-DOMINIO \
  --uin TD-1234-ABCD \
  --systemd-user \
  --linger \
  --install-deps
```

Confirmar:

```bash
loginctl show-user "$(id -un)" -p Linger
```

## Flags Chromium (Hardening Leve)

O runner passa flags adicionais para reduzir trafego em segundo plano e superficie de extensao: `disable-dev-shm-usage`, `disable-extensions`, `disable-sync`, `disable-background-networking`, `disable-default-apps`, alem do modo kiosk existente. Nao usa modo anonimo (preserva IndexedDB do player).

## Politicas Chromium Geridas (Opcional)

Ficheiro de referencia no repositorio: `player-web/chromium-policies/managed-totemdigital-v3x.json` (ferramentas de programador desligadas, modo anonimo indisponivel, popups bloqueados por politica).

Com o provisionador:

```bash
scripts/install-player-v3x-linux-kiosk.sh \
  --server http://IP-OU-DOMINIO \
  --uin TD-1234-ABCD \
  --install-chromium-policy \
  --install-deps
```

Isto copia o JSON para `/etc/chromium/policies/managed/` e `/etc/chromium-browser/policies/managed/` (sudo). Se o binario for **Google Chrome**, tambem instala em `/etc/opt/chrome/policies/managed/`. Se for **Chromium snap**, copia para `~/snap/chromium/common/chromium/policies/managed/` (sem sudo).

Para apontar para outro JSON: `TOTEMDIGITAL_POLICY_SRC=/caminho/politica.json` antes do comando.

Reinicie o Chromium ou a sessao grafica depois de instalar politicas.

## Verificacao Pos Instalacao

Depois do provisionamento, no mini-PC:

```bash
scripts/verify-player-v3x-kiosk.sh
```

Lista `OK` / `WARN` / `FAIL` (config, runner, autostart ou systemd, log, politicas em `/etc` ou snap) e tenta `GET /player` se existir `curl`. Codigo de saida: 0 sem bloqueios, 1 com avisos, 2 com falhas.

## Comandos Uteis

Testar sem escrever arquivos:

```bash
scripts/install-player-v3x-linux-kiosk.sh \
  --server http://192.168.1.10 \
  --uin TD-1234-ABCD \
  --dry-run
```

Executar manualmente:

```bash
~/.local/bin/totemdigital-player-v3x-kiosk
```

Ver logs:

```bash
less ~/.local/state/totemdigital/player-v3x-kiosk.log
```

Alterar URL/codigo:

```bash
nano ~/.config/totemdigital/player-v3x.env
```

## Log Do Kiosk

- Ficheiro: `~/.local/state/totemdigital/player-v3x-kiosk.log` (arranques do Chromium e mensagens do runner).
- O runner **roda o log** quando ultrapassa ~5 MB, mantendo as ultimas ~4000 linhas (evita encher o disco em piloto).
- Acompanhar em tempo real: `tail -f ~/.local/state/totemdigital/player-v3x-kiosk.log`
- Com **systemd user**, pode tambem usar `journalctl --user -u totemdigital-player-v3x.service -f` se redirecionar a unidade para o journal no futuro; hoje o stdout do Chromium vai sobretudo para o ficheiro acima.

## Criterio De Aceite Para Piloto

- O player abre sozinho apos login da sessao grafica.
- A tela exibe o fluxo de ativacao ou reproduz conteudo aprovado.
- Se o Chromium fechar, o runner reabre automaticamente.
- O painel mostra `last_heartbeat`, status online/offline e resumo de saude.
- O operador consegue reinstalar usando apenas servidor, codigo de ativacao e este script.

## Relacao Com O Player Web

O mesmo fluxo de ativacao e cache offline do `player-web` aplica-se ao kiosk: a URL `/player` carrega o bundle com IndexedDB. Quando a rede cai e volta, o player reenvia heartbeat e tenta atualizar o dispatch automaticamente.

## Alternativa Experimental: Electron

Para uma janela dedicada sem barra de URL (Node.js no totem), existe um **shell inicial** em `electron-player/` e um provisionador opcional:

```bash
scripts/install-player-v3x-electron.sh \
  --server http://IP-OU-DOMINIO \
  --uin TD-1234-ABCD \
  --register
```

Isto executa `npm install` em `electron-player/`, grava `~/.config/totemdigital/player-v3x-electron.env` com `PLAYER_URL` (mesmo formato de query que o kiosk) e instala o runner `~/.local/bin/totemdigital-player-v3x-electron`. Opcional: `--systemd-user` para unidade `totemdigital-player-v3x-electron.service`.

**Piloto suportado** continua a ser **Chromium kiosk** (politicas, flags e script principal acima). Electron nao substitui ainda OTA/branding comercial; ver `docs/ELECTRON_PLAYER_V3X_NEXT.md`.

## Limites Desta Fase

- Tanto o autostart XDG como o servico systemd user dependem de uma sessao grafica iniciada para esse utilizador (login automatico continua a ser o padrao em piloto).
- O watchdog cobre queda do Chromium, mas nao reinicia o sistema operacional.
- Rotacao `portrait` usa `xrandr` quando disponivel.
- **Empacotamento Electron** completo (OTA proprias, instalador `.deb` / branding de loja) e MDM a nivel de frota ficam para uma etapa posterior; o caminho suportado em piloto continua a ser Chromium em kiosk com politicas e flags acima. O script Electron e a pasta `electron-player/` sao ponto de partida tecnico.
