# ADR-0003 — Entrega híbrida de comandos remotos

- **Estado:** Aceite  
- **Data:** 2026-08-09  
- **Módulos:** `remote-control`, `player-ad`, `telemetry-heartbeat`

## Contexto

Entregar comandos só no heartbeat atrasava 30–600s. Usar só eventos falhava quando não havia tráfego (tela off, fila vazia).

## Decisão

1. Incluir `pendingCommands` nas respostas de `/api/player/sync` (eventos).  
2. Manter heartbeat como fallback.  
3. Reentregar automaticamente **apenas** comandos idempotentes.  
4. Comandos destrutivos: at-most-once (sem reentrega automática; recibo persistente no Player antes do efeito).  
5. ACK HTTP deve validar 2xx.

## Consequências

- Latência típica cai para o intervalo de flush de eventos (~segundos) quando há telemetria.
- Em idle/off, heartbeat continua a entregar.
- WebSocket/MQTT autenticado por dispositivo fica como evolução futura.

## Alternativas rejeitadas

- Só eventos — falha sem tráfego.
- Reentrega universal de todos os `sent` — causou risco de reboot em loop.
