# ADR-0004 — Telemetria detalhada sob pedido (lease)

- **Estado:** Aceite  
- **Data:** 2026-08-09  
- **Módulos:** `telemetry-heartbeat`, `publish-totem`, `player-ad`

## Contexto

Amostrar métricas finas (ExoPlayer, heap, cache) em todos os totens o tempo todo explode tráfego à medida que a rede cresce.

## Decisão

Separar:

- **Presença** — heartbeat  
- **Estado actual** — eventos `media.play.*` + WS `totem_playback_state`  
- **Observação detalhada** — lease REST start/renew/stop; Player envia `player.observation.sample` só com lease activo  

UI: diagnóstico ao vivo opcional no card; painel expansível de métricas.

## Consequências

- Tráfego detalhado só quando um operador observa.
- Estado normal de mídia não depende do diagnóstico.
- Totem desabilitado não observa.

## Alternativas rejeitadas

- Amostragem contínua global — custo de rede.
- Meter métricas finas no heartbeat sempre — acopla presença a detalhe.
