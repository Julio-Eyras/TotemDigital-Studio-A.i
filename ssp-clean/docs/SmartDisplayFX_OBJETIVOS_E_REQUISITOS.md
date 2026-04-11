## SmartDisplayFX – Objetivos, Conversa e Requisitos Consolidados

### 1. Visão Geral da Feature

**SmartDisplayFX** é a camada de **apresentação e efeitos visuais avançados** para o ecossistema SmartSignage‑Pro / SmartChannel, focada em:

- **Rede em estrela de totens**: um conjunto de totens ligados a um “centro” (servidor/broker) com orquestração visual coordenada.
- **Propagandas fluindo entre telas**: sensação de que o conteúdo “viaja” de um totem a outro (Neon Warp / Ripple Flow / SmartDisplayFlow).
- **Interfaces modernas e imersivas**: glassmorphism, neon glow, partículas, HUD, efeitos WebGL/Canvas.
- **Interação inteligente**: uso de IA, tags (RFID/NFC/QR), e dados de comportamento para escolher e priorizar o que mostrar.

SmartDisplayFX **não substitui** o player atual – ele:

- complementa o `player-client/` existente (que já cuida de playlist, cache, heartbeat, OTA, logs, interações básicas);
- funciona como um **FX layer / player avançado**, especializado em experiências visuais sofisticadas e coordenação entre totens.

---

### 2. Objetivos de Negócio

- **Diferencial de produto**:
  - Criar uma experiência visual única, de “vitrine inteligente” e “rede viva” de telas, indo além do digital signage tradicional.
  - Posicionar o SmartSignage‑Pro como solução premium com **experiência de marca** forte (efeitos, ambientação, storytelling visual).

- **Aumento de engajamento e atenção**:
  - Aumentar tempo de olhar para a tela (eye‑time).
  - Criar momentos “WOW” (efeitos entre telas, animações coordenadas) que gerem mais memorização da marca/loja.

- **Personalização de campanhas**:
  - Usar IA, tags e contexto para direcionar anúncios:
    - por faixa etária aproximada / humor;
    - por tipo de interação (gesto, toque, aproximação);
    - por leitura de tag (cartão, crachá, NFC, QR, etc.).

- **Suporte a campanhas especiais e eventos**:
  - Modos especiais (lançamentos, Black Friday, eventos esportivos) com:
    - playlists e efeitos sincronizados em toda a rede da loja;
    - transições temáticas (Neon Warp, Matrix Flow, Holographic Swipe).

---

### 3. Objetivos Técnicos

1. **Efeitos visuais sincronizados entre totens**:
   - Implementar efeitos como **Neon Warp Flow** e **Ripple Sync Flow**:
     - propaganda “nasce” em um totem;
     - um rastro/onda/glow neon “viaja” virtualmente na rede;
     - outro totem recebe a mesma propaganda em sincronia com o efeito.

2. **Rede em estrela com orquestração central**:
   - Adotar MQTT over WebSocket (ou WebSocket puro) para:
     - enviar **timeline global** de FX;
     - sincronizar início de efeitos usando timestamp absoluto (`start_ts`).

3. **IA híbrida (edge + backend)**:
   - No totem:
     - IA leve em browser ou app nativo (MediaPipe, ONNX Web, TF.js):
       - presença, faixa etária aproximada, humor simples, gestos básicos;
       - sem enviar imagem crua (somente eventos anônimos).
   - No backend:
     - agregação de `interaction_logs` + `event_logs`;
     - motor de recomendação e regras que decide:
       - qual efeito usar;
       - em quais totens;
       - quando iniciar cada sequência.

4. **Integração total com o ecossistema existente**:
   - Reutilizar:
     - tabelas: `tags`, `recognized_persons`, `interaction_logs`, `totem_network`, `event_logs`, `ota_updates`, `totem_update_status`;
     - serviços: `TagService`, `FacialRecognitionService`, `VisualNetworkService`, `RemoteCommandService`, `OTAUpdateService`;
     - rotas: `/api/tags`, `/api/facial-recognition`, `/api/network`, `/api/ota-updates`, `/api/player/heartbeat`.
   - Operar em conjunto com:
     - cache local de playlists e mídia (`LocalPlaylistManager`);
     - sistema interativo (prioridades, interrupção, tags/rostos);
     - OTA para atualização do cliente SmartDisplayFX.

---

### 4. Fontes da Conversa e Ideias Incorporadas

- Arquivo **“SmartDisplayFX Prototype (Neon Warp Flow).MD”**:
  - Conceito de “propagandas fluindo entre totens em rede estrela”.
  - Sugestão de efeitos: Ripple Sync Flow, Neon Warp, Liquid Flow, Holographic Swipe, Matrix Data Flow, Particle Burst.
  - Tecnologias propostas:
    - WebGL (Three.js / PixiJS), GSAP, shaders, partículas.
    - WebSocket / MQTT, WebRTC DataChannel (baixa latência).
  - Uso de IA:
    - reconhecimento de gestos;
    - faixa etária e humor aproximados;
    - heatmap de atenção, classificação de comportamento.

- Documento **ARQUITETURA_PLAYER_CLIENT_AVANCADO.md**:
  - Cache local inteligente (Local Storage / IndexedDB).
  - Sistema de prioridades (normal/high/critical/interactive).
  - Interrupção inteligente, reconhecimento de rosto, tags, rede visual.

- Documento **ARQUITETURA_SMARTDISPLAYFX.md**:
  - Definição do SmartDisplayFX como **segundo player FX**.
  - Componentes: FX Engine, Sync Client (MQTT/WebSocket), AI Edge, Local Cache.
  - Operação com broker local (site/loja) e backend central.
  - Conceito de timeline global (eventos com `start_ts`).

- Implementações atuais:
  - Player interativo (`player-client/core/...`).
  - Backend com suporte a tags, reconhecimento, rede, OTA.
  - Protótipo `player-client/examples/usage-interactive.html`.
  - Protótipo inicial FX: `Player-SmartDisplayFX-client/prototype/SmartDisplayFX_NeonWarp.html`.

---

### 5. Dados que SmartDisplayFX Usa e Gera

**Entradas (dados que consome):**

- **Do backend**:
  - playlists e mídias (ids de conteúdo, duração, tipo);
  - estado e posição dos totens (`totems`, `totem_network`);
  - campaign/playlist context (`campaigns`, `playlists`, `campaign_totems`);
  - regras e configurações de FX (novas entidades no futuro).

- **Do player / edge**:
  - eventos de interação:
    - `interaction_logs` (facial_recognition, tag_id, touch, gesture);
    - `ai_event` (via canal MQTT/WebSocket ou REST).
  - heartbeat e telemetria:
    - status do totem, versão, modo FX atual.

**Saídas (dados que produz):**

- **Comandos de FX / timeline**:
  - mensagens tipo:
    - `effect_transfer` (Neon Warp Flow de totem A → B);
    - `fx_mode_change` (modo ambient, promo, evento especial);
    - `timeline` com sequências de efeitos e conteúdos.

- **Logs e métricas de FX**:
  - `fx_telemetry`:
    - sucesso/falha de execução de efeitos;
    - tempos de início/fim vs `start_ts` (latência real);
    - FPS aproximado ou “qualidade de renderização” (para diagnóstico).
  - agregações:
    - tempo de atenção durante efeitos;
    - comparação de campanhas com e sem SmartDisplayFX.

---

### 6. Requisitos Funcionais (alto nível)

1. **Sincronização entre totens**
   - RF1.1: permitir que um efeito seja iniciado em vários totens com base em um `start_ts` comum.
   - RF1.2: suportar papéis:
     - totem originador (envia efeito / “lança” a propaganda);
     - totem alvo (recebe e exibe a propaganda com entrada especial);
     - totem neutro (pode apenas ambientar / mostrar background FX).

2. **Catálogo de efeitos**
   - RF2.1: definir um conjunto inicial de efeitos:
     - Neon Warp Flow;
     - Ripple Sync Flow;
     - Holographic Swipe;
     - Matrix Data Flow;
     - Particle Burst / Teleport;
   - RF2.2: cada efeito deve ter parâmetros configuráveis:
     - duração, intensidade, cores, direção (esquerda→direita, etc.);
     - quais totens participam (grupo da rede estrela).

3. **Regras inteligentes de acionamento**
   - RF3.1: permitir regras baseadas em:
     - faixa etária aproximada;
     - humor (feliz, neutro, surpreso);
     - hora do dia / dia da semana;
     - tipo de tag lida;
     - tipo de interação (gesto, toque, aproximação).
   - RF3.2: integrar essas regras com o sistema já existente (`interaction_logs`, `tags`, `recognized_persons`).

4. **Compatibilidade multi-plataforma**
   - RF4.1: SmartDisplayFX deve rodar em:
     - webOS, Tizen, Android TV, Linux/Windows (Electron).
   - RF4.2: efeitos devem ser pensados para hardware modesto:
     - fallback graceful (efeito mais “leve” quando o device não aguenta o full FX).

5. **Operação offline / site local**
   - RF5.1: se a conexão com backend central cair:
     - continuar usando broker local + regras locais;
     - continuar executando timelines retidas + conteúdos em cache.

---

### 7. Requisitos Não Funcionais

- **Performance**:
  - efeitos devem manter a experiência fluida (FPS aceitável) em TVs e SBCs;
  - latência de sincronização entre totens deve ser pequena o suficiente para percepção de continuidade.

- **Escalabilidade**:
  - arquitetura deve suportar dezenas de totens em um mesmo site;
  - orquestração via MQTT/WebSocket deve ser enxuta (mensagens leves).

- **Segurança e privacidade**:
  - não enviar imagens/vídeo bruto para o backend para IA;
  - apenas eventos derivados (anônimos) de análise local;
  - seguir políticas de LGPD/GDPR para dados de comportamento.

- **Observabilidade**:
  - métricas de execução de FX (sucesso/falha, latência, FPS aproximado);
  - logs integrados com `event_logs` e sistema de logging central.

---

### 8. Roadmap de Implementação (resumo)

1. **Fase 1 – PoC de Efeitos (web)**  
   - Evoluir `SmartDisplayFX_NeonWarp.html` para:
     - separar claramente engine de FX vs comunicação;
     - parametrizar efeitos (duração, cores, direção, etc.).
   - Simular múltiplos totens em abas usando `localStorage` (já iniciado).

2. **Fase 2 – Mensageria Real (MQTT/WebSocket)**  
   - Introduzir broker MQTT (ex.: Mosquitto) e trocar `localStorage` por tópicos reais.
   - Definir payloads de mensagens (`effect_transfer`, `timeline`, `ai_event`, etc.).

3. **Fase 3 – Integração com Backend e Dados Reais**  
   - Ligar SmartDisplayFX aos dados e APIs existentes:
     - tags, recognized_persons, interaction_logs, ota_updates.
   - Criar endpoints específicos de SmartDisplayFlow (timeline/efeitos).

4. **Fase 4 – Portabilidade para Plataformas Reais**  
   - Adaptar/embalar o cliente SmartDisplayFX para:
     - webOS, Tizen, Android TV, Linux/Windows (Electron).
   - Testar desempenho e ajustes finos de UX em cada plataforma.

---

### 9. Próximo Passo Imediato

- Refinar o **protocolo de mensagens** SmartDisplayFX (SmartDisplayFlow) a partir deste documento:
  - estruturar JSONs de `effect_transfer`, `timeline`, `ai_event`;
  - mapear estes eventos para tabelas/serviços já existentes;
  - definir estrutura mínima de um “FX Orchestrator” no backend.


