# Player-AD — Funcionalidades e funções

## Reprodução

- vídeos, imagens e conteúdo HTML;
- ordem determinística e próxima mídia;
- looping sem bloqueio de rede entre mídias;
- rotação e adaptação ao viewport do TV Box;
- fallback local e cache persistente.

## Operação remota

- heartbeat adaptativo;
- plano versionado e estados `ACTIVE`, `EMPTY` e `UNAVAILABLE`;
- comandos remotos e aplicação de configuração;
- `configure_wifi` (SSID/senha) quando o totem já tem Internet;
- agenda de ligar/desligar;
- modo quiosque e watchdog;
- escape de campo: 3 toques OK → config com Wi‑Fi local e abertura de Settings do SO.

## Telemetria

- início, término e erro de mídia;
- estado atual e próxima mídia;
- observação detalhada sob demanda;
- relógio, armazenamento, versão, cache e estado do display;
- fila persistente com idempotência.

## Atualização

- upload e gerenciamento OTA;
- rollout gradual;
- versão oficial designada por canal;
- download com SHA-256;
- estado por totem e histórico administrativo.

## Instalação de campo

- ADB;
- kit pendrive;
- instalador `Instala-Player-TotemDigital-Vs{versão}-build-{código}.apk` (Player-AD + pergunta dos logos de boot);
- reinstalação assistida;
- preservação de configuração em atualização sobreposta.
