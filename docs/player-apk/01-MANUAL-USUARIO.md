# Player-AD — Manual do usuário

**Versão de referência:** 2.12 (build 112)

## Instalação

1. Baixe somente o APK marcado como versão oficial de produção, **ou** use o assistente `Instala-Player-TotemDigital.apk`.
2. Confirme a versão, o build e o SHA-256 apresentados no painel (quando aplicável).
3. No TV Box, permita temporariamente a instalação por fonte externa.
4. Instale o APK sem remover a versão anterior, preservando configuração e cache.
5. Abra o Player-AD e confirme o UIN, o Device ID e a URL do servidor.

### Assistente `Instala-Player-TotemDigital`

APK separado que instala/atualiza o Player-AD e **pergunta** se deseja trocar os logos de arranque (Android + MBox → TotemDigital). Logos exigem root (SuperSU → Permitir). Ver [../instalacao/04-PLAYER-AD.md](../instalacao/04-PLAYER-AD.md).

## Ativação

O Player-AD apresenta um UIN. Cadastre ou aprove esse UIN no painel, mantenha o
Device ID em maiúsculas e associe o totem ao local correto.

## Configuração no aparelho

1. Com o player a reproduzir, dê **3 toques rápidos** no canto OK / centro do ecrã.
2. Abre a tela de configuração (o kiosk fica relaxado).
3. Confirme `serverUrl`, UIN e Device ID → **Aplicar e iniciar**.

### Wi‑Fi

Na mesma tela de configuração:

- veja o **SSID actual**;
- **Procurar redes** → escolha a rede → senha → **Ligar**;
- se o OEM bloquear o scan: **Abrir Wi‑Fi do sistema** ou **Abrir Settings**.

Sem nenhuma rede (nem cabo), só esta configuração local resolve. Com Internet já activa, o painel também pode enviar o comando remoto `configure_wifi` (Controle remoto / Editar totem).

## Operação diária

- O player recebe agenda, plano de reprodução, comandos e atualização pelo heartbeat.
- A tela preta fora do horário significa `Tela desligada por agenda`, não falha.
- Não limpe dados do aplicativo durante atualização normal.
- Em caso de falha, registre horário, UIN, versão e mensagem exibida antes de reiniciar.

## Atualização

Atualizações OTA são oferecidas somente quando uma versão Android está ativa e
designada para o canal de produção. O arquivo é validado por SHA-256 antes da
instalação.

Referência detalhada: `Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md`.
