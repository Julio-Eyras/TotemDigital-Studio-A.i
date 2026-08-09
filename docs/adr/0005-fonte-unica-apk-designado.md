# ADR-0005 — Fonte única do APK designado

- **Estado:** Aceite  
- **Data:** 2026-08-09  
- **Módulos:** `player-apk-settings`, `ota-updates`, `player-ad`, `settings`

## Contexto

Havia risco de o painel, o OTA e o heartbeat apontarem para versões Android diferentes.

## Decisão

Tabela `player_release_channels` como ponteiro único `(platform, channel) → designated_update_id`.

- Activar OTA Android actualiza a designação de `production`.  
- Settings → APK e download autenticado leem esse ponteiro.  
- Heartbeat Android consulta a mesma fonte.

## Consequências

- Uma versão oficial por canal.
- Documentação do Player servida por API autenticada.
- Instalações antigas precisam de apply-schema para criar a tabela.

## Alternativas rejeitadas

- “Último active por ORDER BY id” sem ponteiro — race e ambiguidade.
- Download público sem auth — risco de distribuição descontrolada.
