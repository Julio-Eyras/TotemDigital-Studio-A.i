## SmartDisplayFX – Orquestrador FX no Backend

Este documento define o **serviço de orquestração** do SmartDisplayFX no backend SmartSignage‑Pro.

---

### 1. Papel do FX Orchestrator

O **FX Orchestrator** é o componente responsável por:

- Receber **eventos de contexto**:
  - `ai_event` (idade aproximada, humor, atenção, gestos);
  - `interaction` (tags RFID/NFC/QR, toque, gestos, presença);
  - estado de campanhas/playlists/totens.
- Aplicar **regras e inteligência** para decidir:
  - quais efeitos visuais (Neon Warp / Ripple / etc.) serão disparados;
  - quais totens participam (origem, destinos);
  - qual conteúdo será exibido junto com o efeito.
- Publicar **mensagens SmartDisplayFlow**:
  - `timeline_update` (timeline global para o site);
  - `effect_transfer` (efeitos diretos entre totens);
  - opcionalmente `sync_time`.

Ele **não substitui** o player nem a lógica de campanhas; apenas decide **“como”** e **“quando”** aplicar efeitos FX com base em dados já existentes.

---

### 2. Integrações com o Backend Atual

O FX Orchestrator deve reutilizar serviços e tabelas já implementados:

- **Tabelas**:
  - `tags` – mapeamento de `tag_id` → `content_id`.
  - `recognized_persons` – mapeamento de pessoa/perfil → `content_id`.
  - `interaction_logs` – histórico de interações (facial, tag, gestos, touch).
  - `totem_network` – redes de totens (rede estrela, vizinhos, grupos).
  - `event_logs` – registro de eventos importantes (usar para `fx_*`).
  - `campaigns`, `playlists`, `totems` – contexto de campanhas e dispositivos.

- **Serviços**:
  - `TagService` – resolve tags para conteúdo.
  - `FacialRecognitionService` – resolve pessoa/perfil → conteúdo.
  - `VisualNetworkService` / rotas `/api/network` – redes de totens, nearby-totems.
  - `EventLogService` – registrar eventos FX (publicação, execução, falha).
  - `CacheService` – cachear regras/segmentações por site.

- **Protocolo SmartDisplayFlow**:
  - Definido em `SmartDisplayFX_PROTOCOLO_SMARTDISPLAYFLOW.md`.
  - Mensagens principais: `ai_event`, `interaction`, `timeline_update`, `effect_transfer`, `fx_telemetry`.

---

### 3. Arquitetura Lógica do Orquestrador

#### 3.1. Componentes

- **FxOrchestratorService** (backend TypeScript):
  - API de alto nível:
    - `handleAiEvent(event)`
    - `handleInteraction(event)`
    - `generateTimelineForSite(siteId)`
    - `triggerEffectBetweenTotems(params)`
  - Usa:
    - `TagService`, `FacialRecognitionService`, `CacheService`, `EventLogService`.

- **FX Message Bridge**:
  - Camada fina que fala com:
    - MQTT Broker (quando existir);
    - ou WebSocket interno;
    - ou, em PoC, apenas grava logs/DB.
  - Responsável por publicar:
    - `timeline_update` em `smartdisplay/{site}/timeline`;
    - `effect_transfer` em `smartdisplay/{site}/effect` ou `smartdisplay/{site}/{totem}/effect`.

- **Rules Engine (versão simples)**:
  - Primeira versão pode ser apenas funções TypeScript:
    - `selectEffectForContext(ctx)`
    - `selectTargetsForEffect(ctx)`
    - `selectContentForEffect(ctx)`
  - Mais tarde pode evoluir para:
    - DSL de regras ou armazenar regras em `system_settings`/tabela própria.

#### 3.2. Fluxos Principais

1. **Interação por Tag (RFID/NFC/QR)**:
   - Totem lê tag → envia `interaction`/`ai_event` para backend.
   - Backend:
     - registra em `interaction_logs`;
     - consulta `TagService` → `content_id`;
     - consulta `totem_network` para saber vizinhos (rede estrela).
   - FX Orchestrator:
     - escolhe efeito (ex.: `neon_warp_v1`);
     - decide originador (totem atual) e destino (vizinho principal);
     - publica `effect_transfer` com `start_ts` futuro imediato.

2. **Reconhecimento Facial / Perfil**:
   - Totem detecta público com certo perfil → envia `ai_event`.
   - Backend:
     - registra em `interaction_logs`;
     - opcionalmente usa `recognized_persons` ou segmentação aproximada.
   - FX Orchestrator:
     - decide se deve “promover” campanha específica (ex.: games para jovens);
     - dispara `timeline_update` com sequência de efeitos para totens do site.

3. **Campanha especial (evento global na loja)**:
   - Usuário no admin aciona manualmente “modo evento” para um site:
     - rota REST: `POST /api/smartdisplayfx/sites/{siteId}/event-mode`.
   - FX Orchestrator:
     - gera uma timeline específica (ex.: 5 minutos de efeitos coordenados);
     - publica `timeline_update` e, opcionalmente, `sync_time`.

---

### 4. Design de Serviço TypeScript (Esqueleto)

Sugestão de arquivo: `backend/src/services/fxOrchestratorService.ts`

Responsabilidades:

- API pública:
  - `handleInteractionEvent(event: FxInteractionEvent)`
  - `handleAiEvent(event: FxAiEvent)`
  - `triggerEffect(params: FxEffectTriggerParams)`
  - `generateTimeline(siteId: string): Promise<FxTimeline>`
- Interno:
  - selecionar efeito (`selectEffectForContext`);
  - selecionar conteúdo (`selectContentForContext`);
  - selecionar totens envolvidos (`selectTotemsForEffect`);
  - publicar mensagem via FX Message Bridge.

---

### 5. Integração com SmartDisplayFlow (Mensagens)

O Orquestrador **não** fala diretamente com o player; ele apenas publica/consome mensagens seguindo o protocolo:

- **Entrada**:
  - `ai_event` / `interaction` (pode chegar via REST ou via bridge MQTT/WebSocket).

- **Saída**:
  - `timeline_update` – quando gera sequências de efeitos.
  - `effect_transfer` – quando dispara um efeito imediato entre totens.

No PoC inicial, podemos:

- Tratar `ai_event`/`interaction` via rotas REST (`/api/smartdisplayfx/events`);
- Usar o `EventLogService` para registrar quando um efeito FX foi disparado;
- No futuro, conectar o Orquestrador a um broker MQTT real.

---

### 6. Próximo Passo Técnico

1. Criar o arquivo `backend/src/services/fxOrchestratorService.ts` com:
   - interfaces `FxInteractionEvent`, `FxAiEvent`, `FxEffectTriggerParams`, `FxTimelineEvent`;
   - classe `FxOrchestratorService` com métodos vazios (só logs) e TODOs;
   - uso de `TagService`, `EventLogService` e `CacheService` por injeção simples ou lazy get.
2. (Opcional imediato) Criar uma rota de debug:
   - `POST /api/smartdisplayfx/debug/trigger-effect`
   - que chama `FxOrchestratorService.triggerEffect` com parâmetros de teste.


