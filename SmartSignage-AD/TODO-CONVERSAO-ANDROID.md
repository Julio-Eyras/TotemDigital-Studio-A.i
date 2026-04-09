# TODO - Conversao SmartSignage-AD para Android

Data de inicio: 2026-04-07

## Fase 0 - Bootstrap do projeto

- [x] Criar estrutura `SmartSignage-AD/` no repositorio.
- [x] Criar modulo Android `app` com `build.gradle`, manifest e `MainActivity`.
- [x] Definir package base `br.com.smartchannel.smartsignagead`.
- [x] Criar documento inicial de arquitetura.

## Fase 1 - Base de dominio e configuracao

- [x] Definir `AppConfig` Android (serverUrl, uin, deviceId, modo).
- [x] Implementar loader de config local (JSON interno + externo).
- [x] Criar logger operacional (`SmartSignageAdLogger`).

## Fase 2 - Integracao backend (paridade Player-AD)

- [x] Implementar `DispatcherApiClient` (token/heartbeat/dispatch).
- [x] Implementar `PlayerEventsClient` (eventos de playback).
- [x] Implementar renovacao resiliente de token em 401.

## Fase 3 - Playback e fallback

- [x] Integrar Media3 ExoPlayer.
- [x] Implementar `PlayerController` (loop, refresh por ciclo).
- [x] Persistir ultimo `DispatchPlan` em disco.
- [x] Implementar fallback `ONLINE -> PERSISTED -> FALLBACK_LOCAL`.
- [x] Parametrizar proporcao `fallbackPropagandasPerVinheta`.

## Fase 4 - Operacao e instalacao

- [x] Criar tela debug/config e status offline.
- [x] Criar scripts de build/install ADB para SmartSignage-AD.
- [x] Criar kit install-pendrive dedicado.

## Fase 5 - Finalizacao de entrega

- [x] Criar manual operacional final do SmartSignage-AD.
- [x] Gerar PDF oficial do manual.
- [x] Criar script para preparar kit de distribuicao automaticamente.
- [x] Atualizar README com fluxo final de build/distribuicao.

## Execucao do TODO nesta iteracao

- [x] Fase 0 executada.
- [x] Fase 1 executada.
- [x] Fase 2 executada.
- [x] Fase 3 executada.
- [x] Fase 4 executada.
- [x] Fase 5 executada.
- [x] TODO concluido (fim a fim).
