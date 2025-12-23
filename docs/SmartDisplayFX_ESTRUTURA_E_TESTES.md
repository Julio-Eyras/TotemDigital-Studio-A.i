## SmartDisplayFX – Estrutura Completa e Plano de Testes (sem MOCK)

Este documento descreve a **arquitetura alvo (sem mocks)** do SmartDisplayFX e o plano de testes teóricos/simulações para validar o sistema de ponta a ponta.

---

### 1. Arquitetura Alvo (Produção)

#### 1.1. Componentes principais

- **Player FX (Edge / Totem)**
  - App SmartDisplayFX rodando em:
    - webOS, Tizen, Android TV (WebApp/Native WebView),
    - Linux/Windows (Electron em SBC).
  - Usa:
    - `SmartDisplayFlowClient` (versão final) com:
      - Transporte MQTT/WebSocket real (sem localStorage),
      - Envio de `interaction` e `ai_event` via REST ou MQ,
      - Recebimento de `effect_transfer` e `timeline_update`.
  - Integração com:
    - Player principal (`player-client`) para saber:
      - `contentId` atual,
      - estado de playback,
      - modo atual (ambient, promo, evento).

- **Broker de Mensagens (Site / Loja)**
  - **MQTT Broker** com WebSocket habilitado (Mosquitto/EMQX):
    - Tópicos: `smartdisplay/{site}/{totem}/heartbeat`, `/ai_event`, `/interaction`, `/effect`, `/timeline`, `/sync/time`, `/fx_telemetry`.
  - Opcional: bridge com backend central (replicação seletiva de tópicos).

- **Backend SmartSignage‑Pro (Central)**
  - **FxOrchestratorService**:
    - Consome eventos (REST ou MQ) de interação/IA;
    - Usa `tags`, `totem_network`, `interaction_logs`, `recognized_persons`, `event_logs`;
    - Gera `effect_transfer` e `timeline_update`;
    - Registra regras e execuções em `event_logs`.
  - **FX Message Bridge**:
    - Publica mensagens em MQTT/WebSocket nos tópicos corretos;
    - Opcionalmente lê `fx_telemetry` para estatísticas.

#### 1.2. Fluxo normal (produção)

1. Totem inicia Player FX:
   - Autentica no backend (JWT),
   - Conecta ao broker MQTT (usando credenciais/siteId/totemId),
   - Envia `heartbeat` periódico.

2. O player detecta interação/IA:
   - Ex.: leitura de TAG, gesto, perfil, atenção alta.
   - Envia:
     - `interaction` / `ai_event` → backend via REST (atual) ou tópico MQTT (futuro).

3. Backend (FxOrchestratorService):
   - Recebe evento (`/api/smartdisplayfx/events/...` ou via broker),
   - Busca contexto em:
     - `tags`, `totem_network`, `recognized_persons`, campanhas/playlist,
   - Aplica regras:
     - decide `effectId`, `fromTotem`, `toTotem`, `contentId`,
   - Registra regra aplicada em `event_logs`,
   - Gera mensagem `effect_transfer` e publica em `smartdisplay/{site}/effect`.

4. Player FX (totens envolvidos):
   - Recebe `effect_transfer` via MQTT/WebSocket,
   - Agenda efeito para `start_ts`,
   - Dispara animações Neon Warp / Ripple / Ambient nas bordas corretas,
   - Opcional: envia `fx_telemetry` com resultado da execução.

---

### 2. Estrutura de Código Alvo (alto nível)

#### 2.1. Player-SmartDisplayFX-client

- `core/sync/SmartDisplayFlowClient.js`
  - Versão final:
    - Implementa transporte MQTT/WebSocket (substituindo LocalStorageTransport);
    - Mantém métodos:
      - `connect(siteId, totemId)`,
      - `publishEffectTransfer`,
      - `sendInteractionEvent` (REST/MQ),
      - `sendAiEvent` (REST/MQ),
      - `onEffect`, `onTimeline`, `onSyncTime`.

- `core/fx/FxEngine.js`
  - Responsável por:
    - registrar tipos de efeitos (`neon_warp_v1`, `ripple_sync_v1`, etc.);
    - renderizar efeitos em Canvas/WebGL para cada painel/totem;
    - expor API:
      - `playEffect(effectPayload, { isOrigin, isTarget })`.

- `core/integration/PlayerBridge.js`
  - Liga FX com o player atual:
    - lê status do conteúdo atual,
    - sabe quando pode interromper ou sobrepor conteúdo.

#### 2.2. Backend

- `services/fxOrchestratorService.ts`
  - Já criado e agora usando:
    - `tags`, `totem_network`, `event_logs`.
  - Próximos aprofundamentos:
    - integração com campanhas/playlist (usar `campaigns`, `playlists`);
    - regras mais ricas baseadas em horário, dia da semana, site, segmento.

- `routes/smartdisplayfx.ts`
  - Entradas principais:
    - `POST /events/interaction`
    - `POST /events/ai`
    - `POST /debug/trigger-effect`
  - Futuro:
    - rotas de configuração de regras e de visualização de status FX.

---

### 3. Plano de Testes Teóricos e Simulações

#### 3.1. Testes de fluxo de interação (TAG)

**Cenário:** Cliente aproxima um cartão/tag NFC em frente a um totem.

1. Player FX lê TAG e envia:
   - `interactionType = 'tag_id'`,
   - `tagId = 'TAG-ABC-123'`,
   - `siteId`, `totemId`.
2. Backend:
   - `TagService.getTagContent('TAG-ABC-123')` → retorna `contentId`.
   - `findTargetTotem(totemId)` → busca vizinho em `totem_network`.
   - `triggerEffect` com:
     - `effectId = 'neon_warp_v1'`,
     - `fromTotemId = totemId` (origem),
     - `toTotemId = vizinho` (destino),
     - `contentId` da tag.
   - Registra regra em `event_logs` (`smartdisplayfx_rule`) e efeito em `smartdisplayfx_effect`.
3. Player FX:
   - Recebe `effect_transfer` entre os dois totens,
   - Reproduz o efeito Neon Warp conforme `start_ts` e `duration_ms`.

**Verificações (teóricas):**
- Entrada correta em `event_logs` com:
  - `entity_type = 'smartdisplayfx_rule'` e metadata da regra,
  - `entity_type = 'smartdisplayfx_effect'` e metadata do efeito.
- Efeito visual percebido como “propaganda viajando” de um totem ao outro.

#### 3.2. Testes de fluxo de IA (atenção/humor)

**Cenário:** IA local detecta público jovem, feliz, com atenção alta.

1. Player envia `ai_event`:
   - `eventType = 'facial_estimate'`,
   - `payload = { age_bucket: '18-25', mood: 'happy', attention_ms: 3500 }`.
2. Backend:
   - `getSegmentFromAiPayload` → `segment = 'YOUNG'`.
   - `attention_ms >= 2000` ou `mood === 'happy'` → dispara `ambient_wave_v1`.
   - Usa `findTargetTotem` para destino.
   - Registra regra `ai_based` e efeito em `event_logs`.
3. Player FX:
   - Recebe `effect_transfer` e executa efeito ambient (onda suave) entre totens.

**Verificações:**
- Segmento derivado (`YOUNG`) armazenado em metadata.
- Efeito ambient compatível com público alvo (ex.: campanha jovem).

#### 3.3. Testes de rede estrela (totem_network)

**Cenário:** Rede com 3 totens (`A`, `B`, `C`) em totem_network.

1. `totem_network` define:
   - `A` → `nearby_totems = [B, C]`;
2. Interação ocorre em `A`:
   - Orquestrador escolhe `B` como destino por padrão (primeiro vizinho).
3. Testes teóricos:
   - Validar regra de escolha simples (primeiro vizinho).
   - Próximas melhorias:
     - round‑robin entre vizinhos;
     - escolha baseada em métricas (ex.: totem menos ocupado).

#### 3.4. Testes de falha e robustez

- **MQTT/WS indisponível**:
  - Orquestrador ainda registra regras e efeitos em `event_logs`;
  - Player FX pode ter fallback: modo solo (efeitos locais).
- **Sem entrada em `totem_network`**:
  - `findTargetTotem` retorna o próprio `fromTotemId` → efeito local, sem rede.
- **Tag sem `contentId`**:
  - Regras definem conteúdo padrão para efeito (ex.: campanha genérica do site).

---

### 4. Pequenas Melhorias Planejadas (Curto Prazo)

- **Regras mais ricas**:
  - Combinar:
    - `interactionType`,
    - segmento IA,
    - horário/dia da semana,
    - tipo de campanha ativa.
  - Mapear para diferentes `effectId` e estilos visuais (temas).

- **Camada de configuração de regras**:
  - Usar `system_settings` ou tabela própria para:
    - habilitar/desabilitar tipos de efeitos por site;
    - definir prioridades (ex.: evento global > promo > ambient).

- **Telemetria de FX (`fx_telemetry`)**:
  - Player FX enviar:
    - sucesso/falha,
    - atraso real vs `start_ts`,
    - FPS aproximado ou “qualidade”.
  - Backend armazenar em `event_logs` ou tabela específica.

---

### 5. Integração Completa: Orquestrador → Bridge → Player FX

#### 5.1. Fluxo de Integração Backend

**FxOrchestratorService → FxMessageBridge:**

1. **`triggerEffect(params)`**:
   - Constrói payload `effect_transfer` via `buildEffectTransferPayload()`;
   - Chama `FxMessageBridge.publishEffect(effectMessage)`;
   - Registra em `event_logs` (tipo `smartdisplayfx_effect`) para auditoria/BI.

2. **`generateTimeline(siteId)`**:
   - Gera timeline FX (quando houver eventos);
   - Chama `FxMessageBridge.publishTimeline(timelineMessage)` se timeline contiver eventos;
   - Retorna timeline para uso futuro.

**FxMessageBridge:**

- **Com MQTT habilitado** (`SMARTDISPLAYFX_MQTT_ENABLED=true`):
  - Conecta ao broker MQTT (via `mqtt` client);
  - Publica mensagens em tópicos: `smartdisplay/{siteId}/effect` e `smartdisplay/{siteId}/timeline`;
  - QoS 0 (at-most-once delivery).

- **Sem MQTT** (`SMARTDISPLAYFX_MQTT_ENABLED=false` ou não configurado):
  - Modo "log-only": registra mensagens em logs via `loggerHelper`;
  - Não bloqueia o sistema; permite desenvolvimento/testes sem broker.

#### 5.2. Fluxo de Integração Player FX (Cliente)

**SmartDisplayFlowClient → FxEngine → PlayerBridge:**

1. **`SmartDisplayFlowClient`**:
   - Recebe `effect_transfer` via MQTT/WebSocket (ou localStorage em PoC);
   - Dispara handler `onEffect(payload, { isOrigin, isTarget })`.

2. **`FxEngine`**:
   - Recebe chamada via `playEffect(effectPayload, context)`;
   - Verifica se efeito está registrado (`effects.get(effectId)`);
   - Agenda execução conforme `start_ts` e `duration_ms`;
   - Renderiza efeito em loop de animação (`requestAnimationFrame`);
   - Remove efeito após `duration_ms`.

3. **`PlayerBridge`**:
   - Fornece contexto ao `FxEngine`:
     - `getCurrentContentId()`: conteúdo atual;
     - `getCurrentPlaybackState()`: estado de playback;
     - `getCurrentMode()`: modo do player (normal/promo/event);
     - `canInterrupt()`: se pode interromper conteúdo;
     - `allowsFxEffects()`: se permite efeitos FX.

#### 5.3. Variáveis de Ambiente (Backend)

**Arquivo:** `backend/.env` ou `backend/env.example`

```bash
# SmartDisplayFX - MQTT Configuration
SMARTDISPLAYFX_MQTT_ENABLED=false          # true para habilitar MQTT
SMARTDISPLAYFX_MQTT_URL=ws://localhost:9001  # URL do broker (WebSocket ou mqtt://)
SMARTDISPLAYFX_MQTT_USERNAME=               # Opcional: username para autenticação
SMARTDISPLAYFX_MQTT_PASSWORD=               # Opcional: password para autenticação
SMARTDISPLAYFX_MQTT_PREFIX=smartdisplay    # Prefixo dos tópicos (padrão: smartdisplay)
```

**Configuração em `backend/src/config/env.ts`:**

```typescript
messagingConfig: {
  mqtt: {
    enabled: process.env.SMARTDISPLAYFX_MQTT_ENABLED === 'true',
    url: process.env.SMARTDISPLAYFX_MQTT_URL || 'ws://localhost:9001',
    username: process.env.SMARTDISPLAYFX_MQTT_USERNAME || undefined,
    password: process.env.SMARTDISPLAYFX_MQTT_PASSWORD || undefined,
    prefix: process.env.SMARTDISPLAYFX_MQTT_PREFIX || 'smartdisplay',
  },
}
```

**Uso em Produção:**

- **Desenvolvimento/Testes**: `SMARTDISPLAYFX_MQTT_ENABLED=false` (log-only).
- **Produção**: `SMARTDISPLAYFX_MQTT_ENABLED=true` + broker configurado (Mosquitto/EMQX).

#### 5.4. Estrutura de Tópicos MQTT

- **Effect Transfer**: `smartdisplay/{siteId}/effect`
  - Payload: `FxEffectMessage` (JSON)
  - Publicado por: `FxMessageBridge.publishEffect()`
  - Consumido por: `SmartDisplayFlowClient` (player clients)

- **Timeline Update**: `smartdisplay/{siteId}/timeline`
  - Payload: `FxTimelineMessage` (JSON)
  - Publicado por: `FxMessageBridge.publishTimeline()`
  - Consumido por: `SmartDisplayFlowClient` (player clients)

- **Heartbeat** (futuro): `smartdisplay/{siteId}/{totemId}/heartbeat`
- **AI Event** (futuro): `smartdisplay/{siteId}/{totemId}/ai_event`
- **Interaction** (futuro): `smartdisplay/{siteId}/{totemId}/interaction`
- **FX Telemetry** (futuro): `smartdisplay/{siteId}/{totemId}/fx_telemetry`

#### 5.5. Observabilidade e Admin (Planejado)

**Painel Admin (Frontend):**

- **Fonte de dados**: `event_logs` (filtros):
  - `entity_type = 'smartdisplayfx_rule'`: regras aplicadas;
  - `entity_type = 'smartdisplayfx_effect'`: efeitos disparados.

- **Queries sugeridas**:
  ```sql
  -- Últimos efeitos FX
  SELECT * FROM event_logs
  WHERE entity_type = 'smartdisplayfx_effect'
  ORDER BY created_at DESC
  LIMIT 50;

  -- Últimas regras aplicadas
  SELECT * FROM event_logs
  WHERE entity_type = 'smartdisplayfx_rule'
  ORDER BY created_at DESC
  LIMIT 50;

  -- Métricas por site
  SELECT 
    metadata->>'siteId' as site_id,
    COUNT(*) as total_effects,
    COUNT(DISTINCT metadata->>'effectId') as unique_effects
  FROM event_logs
  WHERE entity_type = 'smartdisplayfx_effect'
  GROUP BY metadata->>'siteId';
  ```

- **Componente React sugerido**: `SmartDisplayFxDashboard.tsx`
  - Lista últimos efeitos/regras;
  - Filtros: site, totem, período, tipo de efeito;
  - Gráficos: volume de efeitos por hora/dia.

---

### 6. Próximos Passos (Implementação)

1. ✅ **Integração Orquestrador → Bridge**: Concluído
   - `FxOrchestratorService.triggerEffect()` chama `FxMessageBridge.publishEffect()`
   - `FxOrchestratorService.generateTimeline()` chama `FxMessageBridge.publishTimeline()`

2. ✅ **FxEngine e PlayerBridge (Cliente)**: Concluído
   - `FxEngine.js`: motor de efeitos com registro e renderização
   - `PlayerBridge.js`: interface com player principal

3. ⏳ **Transporte MQTT/WebSocket no SmartDisplayFlowClient**: Pendente
   - Substituir `LocalStorageTransport` por transporte MQTT/WebSocket real
   - Manter compatibilidade com localStorage para PoC

4. ⏳ **Painel Admin para SmartDisplayFX**: Pendente
   - Componente React lendo `event_logs`
   - Filtros e métricas básicas

5. ⏳ **Testes End-to-End**: Pendente
   - Cenários: TAG → efeito, IA → efeito, rede estrela


