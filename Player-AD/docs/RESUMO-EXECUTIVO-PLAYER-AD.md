# Player-AD — Resumo Executivo

Data: 2026-04-07

## Objetivo do sistema

O `Player-AD` é um player Android TV para exibição de campanhas de mídia com alta disponibilidade operacional, mesmo em cenários de rede instável.

## Capacidades-chave

- Recebe plano de mídia online (`heartbeat` + `dispatch`).
- Faz cache local de conteúdo para reduzir dependência de rede.
- Reproduz vídeo e imagem em loop contínuo.
- Opera em fallback offline com:
  - último plano persistido;
  - playlist local de `propagandas` e `vinhetas`.
- Suporte operacional com tela de debug, logs e estado offline.

## Arquitetura em alto nível

- **UI/Orquestração:** `MainActivity`, `DebugConfigActivity`.
- **Playback:** `PlayerController` + Media3 (`ExoPlayer`).
- **Integração API:** `DispatcherApiClient`, `PlayerEventsClient`.
- **Persistência local:** `MediaCacheManager`, `AppDirs`, arquivos de estado/log.
- **Boot/Kiosk:** `BootCompletedReceiver`, modo imersivo fullscreen.

## Valor para operação

- Continuidade de reprodução mesmo sem backend disponível.
- Diagnóstico rápido em campo (debug UI + log operacional).
- Instalação flexível:
  - via ADB (suporte técnico);
  - via pendrive (operação local sem notebook).

## Riscos e controles

- **Conflito de assinatura APK:** mitigado por fluxo de desinstalação/reinstalação.
- **Mudanças de contrato backend:** concentradas em clientes API e parser de dispatch.
- **Problemas de storage/dispositivo:** mitigados por fallback de diretório (`externalFilesDir` -> `filesDir`).

## Indicadores recomendados (governança)

- taxa de sucesso de `heartbeat` e `dispatch`;
- percentual de tempo em `ONLINE` vs `PERSISTED` vs `FALLBACK_LOCAL`;
- incidência de crash por versão;
- tempo médio de atualização em campo.

## Próximos passos sugeridos

- padronizar versionamento de release (`versionCode`/`versionName`);
- incluir rotina automática de validação pós-instalação;
- consolidar dashboard simples de saúde do player por dispositivo.
