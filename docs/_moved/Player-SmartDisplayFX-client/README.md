## SmartDisplayFX Client

**SmartDisplayFX** é o novo player‑cliente especializado de efeitos avançados para o SmartSignage‑Pro / SmartChannel.

- **Objetivo**: interfaces dinâmicas, fluidas e futuristas (Neon Warp / Ripple Flow) para propagandas, menus e interações.
- **Plataformas alvo**: webOS (LG), Tizen (Samsung), Android TV e Linux/Windows (via Electron/SBC).
- **Integração**: trabalha em conjunto com o `player-client` atual e com o backend já existente (OTA, tags, interação, logs remotos).

### Relação com o player atual

- `player-client/` continua sendo o **player padrão** (playback, cache, IA interativa básica).
- `Player-SmartDisplayFX-client/` será o **FX layer / player avançado**, focado em:
  - efeitos de transição entre totens em rede estrela (SmartDisplayFlow);
  - animações WebGL/Canvas (Neon Warp, Ripple, Particle Burst);
  - orquestração em tempo real (via MQTT/WebSocket) usando as mesmas entidades: playlists, tags, interaction_logs, event_logs.

### Estrutura inicial

```text
Player-SmartDisplayFX-client/
  README.md                      # Visão geral
  ARQUITETURA_SMARTDISPLAYFX.md  # Arquitetura 2.0 (alto nível)
  prototype/
    SmartDisplayFX_NeonWarp.html # Protótipo HTML5/JS do efeito Neon Warp Flow
```

### Próximos passos sugeridos

1. Detalhar arquitetura em `ARQUITETURA_SMARTDISPLAYFX.md` alinhando:
   - MQTT/WebSocket, tópicos e mensagens;
   - uso de `interaction_logs`, `tags`, `recognized_persons` e `ota_updates`;
   - integração com o `player-client` (reutilizar cache, heartbeat, API).
2. Evoluir o protótipo `SmartDisplayFX_NeonWarp.html` para:
   - usar um broker MQTT real (Mosquitto) em vez de `localStorage`;
   - receber comandos reais do backend (mock → produção);
   - testar em webOS/Tizen/Android TV com ajustes de performance.


