## Arquitetura SmartDisplayFX 2.0 (Alinhada ao SmartSignage‑Pro)

### Papel do SmartDisplayFX

- **Segundo player especializado (FX)**: não substitui o `player-client`, complementa.
- Focado em:
  - efeitos visuais entre totens em **rede estrela** (Neon Warp Flow / Ripple Sync);
  - interfaces futuristas (glassmorphism, neon, partículas, HUD);
  - uso de IA para direcionar conteúdo (edge + backend).

### Componentes principais

- **Edge / Totem (Smart TV / SBC)**:
  - Cliente HTML5/JS (`SmartDisplayFX`) rodando em:
    - webOS (WebApp),
    - Tizen,
    - Android TV (WebView/Chromium),
    - Linux/Windows (Electron em SBC).
  - Módulos:
    - `FX Engine` (WebGL/Canvas + GSAP/PixiJS);
    - `Sync Client` (MQTT over WebSocket / WebSocket fallback);
    - `AI Edge` (MediaPipe / ONNX Runtime Web / TF.js);
    - `Local Cache` (reutiliza conceitos de `player-client`).

- **Servidor Local (Site / Loja)**:
  - Broker MQTT (ex.: Mosquitto/EMQX) com WebSocket habilitado.
  - Opcionalmente um **orquestrador local** que:
    - recebe eventos dos totens (AI, tags, presença);
    - aplica regras locais;
    - publica timeline e efeitos para o site.

- **Backend Central (SmartSignage‑Pro)**:
  - Já existente:
    - `tags`, `recognized_persons`, `interaction_logs`, `totem_network`, `event_logs`;
    - OTA (`ota_updates`, `totem_update_status`);
    - billing, reports, dashboards.
  - Extensões para SmartDisplayFX:
    - endpoints para publicar **timelines** e **efeitos** (SmartDisplayFlow);
    - motor de recomendação/regras (pode reaproveitar `interaction_logs` + `event_logs`).

### Mensageria e sincronização

- Protocolo recomendado: **MQTT over WebSocket** com tópicos como:
  - `smartdisplay/{site}/{totem}/heartbeat`
  - `smartdisplay/{site}/timeline`
  - `smartdisplay/{site}/{totem}/effect`
  - `smartdisplay/{site}/{totem}/ai_event`
  - `smartdisplay/{site}/sync/time`

- Conceito de **timeline global**:
  - backend/orquestrador publica eventos com `start_ts` absoluto (ISO/UTC);
  - totens sincronizam relógio (NTP/time sync) e executam efeitos via GSAP timelines.

- Operação **offline com servidor local**:
  - se internet cair, broker + orquestrador local mantêm:
    - playlists locais,
    - regras e efeitos,
    - propagandas dirigidas.
  - totens usam último timeline retido + cache de mídia.

### IA híbrida (edge + cloud)

- **No totem (edge)**:
  - tarefas leves:
    - presença / contagem de pessoas;
    - faixa etária aproximada (buckets);
    - humor simples (feliz / neutro / surpreso);
    - atenção (tempo olhando para a tela);
    - gestos básicos (sim/não/acenar);
    - leitura de tags (NFC/RFID/QR via `TagReaderService` e backend `/tags`).
  - gera eventos anônimos (`ai_event`) → nunca envia imagem crua.

- **No backend**:
  - agrega eventos por totem/horário/campanha;
  - aplica regras e recomendações;
  - atualiza timelines e campanhas ativas.

### Integração com o que já existe

- Reaproveita:
  - tabelas: `tags`, `recognized_persons`, `interaction_logs`, `totem_network`, `event_logs`, `ota_updates`;
  - serviços backend: `TagService`, `FacialRecognitionService`, `VisualNetworkService`, `RemoteCommandService`, `OTAUpdateService`;
  - rotas: `/api/tags`, `/api/facial-recognition`, `/api/network`, `/api/ota-updates`, `/api/player/heartbeat`.

- SmartDisplayFX:
  - consome as mesmas APIs;
  - envia eventos adicionais (ex.: `ai_event`, `fx_telemetry`);
  - recebe comandos de efeito (`effect_transfer`, `fx_mode_change`).

### Protótipo inicial

- Arquivo: `prototype/SmartDisplayFX_NeonWarp.html`
  - Demonstra:
    - efeito Neon Warp Flow entre “totem A” e “totem B” (simulado entre abas);
    - sincronização simples usando `localStorage` (PoC) → depois trocar por MQTT;
    - base visual (canvas + partículas + transição lateral).

### Roadmap resumido

1. **Fase 1 (PoC web)**:
   - Protótipo NeonWarp em browser desktop;
   - simulação de vários totens (abas) e efeitos sincronizados.
2. **Fase 2 (MQTT real + servidor local)**:
   - acoplar broker Mosquitto;
   - mock de orquestrador publicando `timeline`/`effect`.
3. **Fase 3 (Plataformas reais)**:
   - empacotar para webOS → Tizen → Android TV → Linux/SBC;
   - integrar com heartbeat/OTA existentes;
   - testes de performance e IA edge.


