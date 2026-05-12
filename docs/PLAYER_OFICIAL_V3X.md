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

## Criterio De Aceite Para Piloto

- O player abre sozinho apos login da sessao grafica.
- A tela exibe o fluxo de ativacao ou reproduz conteudo aprovado.
- Se o Chromium fechar, o runner reabre automaticamente.
- O painel mostra `last_heartbeat`, status online/offline e resumo de saude.
- O operador consegue reinstalar usando apenas servidor, codigo de ativacao e este script.

## Relacao Com O Player Web

O mesmo fluxo de ativacao e cache offline do `player-web` aplica-se ao kiosk: a URL `/player` carrega o bundle com IndexedDB. Quando a rede cai e volta, o player reenvia heartbeat e tenta atualizar o dispatch automaticamente.

## Limites Desta Fase

- Tanto o autostart XDG como o servico systemd user dependem de uma sessao grafica iniciada para esse utilizador (login automatico continua a ser o padrao em piloto).
- O watchdog cobre queda do Chromium, mas nao reinicia o sistema operacional.
- Rotacao `portrait` usa `xrandr` quando disponivel.
- MDM, hardening completo e empacotamento Electron ficam para uma etapa posterior.
