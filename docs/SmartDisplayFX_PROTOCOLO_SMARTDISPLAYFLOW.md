## Protocolo SmartDisplayFlow – Mensagens e Tópicos

Este documento define o **protocolo lógico** de mensageria do SmartDisplayFX (camada FX em rede estrela), para ser usado sobre **MQTT over WebSocket** ou WebSocket puro.

---

### 1. Conceitos Básicos

- **Site**: agrupamento lógico de totens (ex.: loja, praça de alimentação).  
  - Identificador: `site_id` (string curta, ex.: `"site-01"`).
- **Totem**: dispositivo individual (TV/SBC) participante da rede estrela.  
  - Identificador: `totem_id` (ex.: `"TOTEM_001"`).
- **FX Orchestrator**:
  - Componente (no backend ou servidor local) que:
    - recebe eventos (`ai_event`, `interaction`, `tag`, etc.);
    - aplica regras/inteligência;
    - publica **timelines** e **efeitos** para os totens (`effect_transfer`, `timeline_update`).
- **Timeline Global**:
  - Sequência de eventos com timestamp absoluto (`start_ts` em ISO/UTC).
  - Cada totem executa localmente de forma sincronizada com o relógio.

---

### 2. Espaço de Tópicos (MQTT / WebSocket)

Padrão de tópicos (exemplo MQTT):

- **Heartbeat / Presença**
  - `smartdisplay/{site_id}/{totem_id}/heartbeat`

- **Eventos de IA e Interação**
  - `smartdisplay/{site_id}/{totem_id}/ai_event`
  - `smartdisplay/{site_id}/{totem_id}/interaction`

- **Comandos de FX / Timeline**
  - `smartdisplay/{site_id}/timeline`  
    (timeline global para o site)
  - `smartdisplay/{site_id}/{totem_id}/effect`  
    (efeitos direcionados por totem)

- **Sincronização de Tempo**
  - `smartdisplay/{site_id}/sync/time`

- **Telemetria de FX**
  - `smartdisplay/{site_id}/{totem_id}/fx_telemetry`

> Em WebSocket puro, o mesmo modelo pode ser usado com `type` + `topic` em JSON.

---

### 3. Mensagens – Modelos JSON

#### 3.1. Heartbeat (`heartbeat`)

Tópico:  
`smartdisplay/{site_id}/{totem_id}/heartbeat`

```json
{
  "msg_type": "heartbeat",
  "site_id": "site-01",
  "totem_id": "TOTEM_001",
  "fx_version": "1.0.0",
  "player_version": "2.1.0",
  "status": "online",
  "uptime_sec": 12345,
  "current_content_id": 123,
  "current_effect_id": "neon_warp_v1",
  "timestamp": "2025-01-01T12:34:56.789Z"
}
```

Uso:
- Presença em tempo real.
- Diagnóstico de versão/mode do SmartDisplayFX.

---

#### 3.2. Evento de IA / Interação (`ai_event`, `interaction`)

Tópico:  
`smartdisplay/{site_id}/{totem_id}/ai_event`

```json
{
  "msg_type": "ai_event",
  "site_id": "site-01",
  "totem_id": "TOTEM_001",
  "event_id": "evt_abc123",
  "source": "edge_ai",
  "event_type": "facial_estimate",
  "payload": {
    "age_bucket": "18-25",
    "mood": "happy",
    "attention_ms": 3200,
    "gender_guess": "unknown"
  },
  "timestamp": "2025-01-01T12:35:10.123Z"
}
```

Tópico alternativo para interações genéricas:  
`smartdisplay/{site_id}/{totem_id}/interaction`

```json
{
  "msg_type": "interaction",
  "site_id": "site-01",
  "totem_id": "TOTEM_001",
  "interaction_type": "tag_id", 
  "tag_id": "TAG-ABC-123",
  "content_id": 456,
  "extra": {
    "x": 0.5,
    "y": 0.8
  },
  "timestamp": "2025-01-01T12:35:15.000Z"
}
```

Mapeamento no backend:
- `ai_event` → pode ser persistido em `interaction_logs` / tabelas específicas de analytics.
- `interaction` → já mapeia diretamente em `interaction_logs` (via tipo `facial_recognition`, `tag_id`, `gesture`, `touch`).

---

#### 3.3. Timeline Global (`timeline_update`)

Tópico:  
`smartdisplay/{site_id}/timeline`

```json
{
  "msg_type": "timeline_update",
  "site_id": "site-01",
  "timeline_id": "tl_2025_01_01_manha",
  "version": 3,
  "generated_at": "2025-01-01T12:30:00.000Z",
  "events": [
    {
      "event_id": "fx_evt_001",
      "start_ts": "2025-01-01T12:40:00.000Z",
      "effect_type": "neon_warp_v1",
      "from_totem": "TOTEM_001",
      "to_totems": ["TOTEM_002", "TOTEM_003"],
      "content_id": 321,
      "duration_ms": 2000,
      "params": {
        "color_a": "#00ffd5",
        "color_b": "#6b00ff",
        "intensity": 0.8
      }
    },
    {
      "event_id": "fx_evt_002",
      "start_ts": "2025-01-01T12:45:00.000Z",
      "effect_type": "ripple_sync_v1",
      "from_totem": "TOTEM_002",
      "to_totems": ["TOTEM_001"],
      "content_id": 654,
      "duration_ms": 1800,
      "params": {
        "wave_count": 3
      }
    }
  ]
}
```

Uso nos totens:
- Cada totem:
  - Recebe a timeline;
  - Seleciona apenas eventos onde participa (`from_totem` ou `to_totems`);
  - Agenda execuções locais com base no `start_ts`.

---

#### 3.4. Comando de Efeito Direto (`effect_transfer`)

Tópico:  
`smartdisplay/{site_id}/{totem_id}/effect`  
(*ou* broadcast em `smartdisplay/{site_id}/effect` com filtro por `from`/`to`)

```json
{
  "msg_type": "effect_transfer",
  "site_id": "site-01",
  "effect_id": "neon_warp_v1",
  "from": {
    "totem": "TOTEM_001",
    "edge": "right"
  },
  "to": {
    "totem": "TOTEM_002",
    "edge": "left"
  },
  "content_id": 321,
  "start_ts": "2025-01-01T12:40:00.500Z",
  "duration_ms": 1600,
  "params": {
    "color_a": "#00ffd5",
    "color_b": "#6b00ff",
    "trail_particles": 32
  }
}
```

Execução:
- Totem originador (`from.totem`) inicia efeito de “saída” (warp saindo da tela).
- Totem destino (`to.totem`) inicia efeito de “entrada” (warp chegando).
- Ambos usam o mesmo `start_ts` para manter a ilusão de continuidade.

---

#### 3.5. Sincronização de Tempo (`sync_time`)

Tópico:  
`smartdisplay/{site_id}/sync/time`

```json
{
  "msg_type": "sync_time",
  "site_id": "site-01",
  "server_time": "2025-01-01T12:34:56.789Z",
  "time_source": "ntp",
  "drift_hint_ms": 15
}
```

Uso:
- Totens ajustam relógio interno (ou aplicam offset local) para reduzir drift.
- Importante para execução precisa de `start_ts`.

---

#### 3.6. Telemetria de FX (`fx_telemetry`)

Tópico:  
`smartdisplay/{site_id}/{totem_id}/fx_telemetry`

```json
{
  "msg_type": "fx_telemetry",
  "site_id": "site-01",
  "totem_id": "TOTEM_001",
  "effect_id": "neon_warp_v1",
  "event_id": "fx_evt_001",
  "content_id": 321,
  "started_at": "2025-01-01T12:40:00.502Z",
  "ended_at": "2025-01-01T12:40:02.120Z",
  "planned_start_ts": "2025-01-01T12:40:00.500Z",
  "avg_fps": 55,
  "status": "success",
  "error": null
}
```

Mapeamento:
- Pode alimentar:
  - `event_logs` com `event_type = 'fx_execution'`;
  - estrutura própria de métricas se necessário.

---

### 4. Integração com o Backend (Tabelas Existentes)

- `interaction_logs`:
  - Recebe eventos de `interaction` / `ai_event` (já mapeados pelo backend).

- `tags`:
  - Resolvidos a partir de `tag_id` em eventos de interação;
  - Permitem vincular `content_id` específico para certos efeitos/campanhas.

- `recognized_persons`:
  - Usados pelo motor para escolher conteúdo personalizado por pessoa/perfil.

- `totem_network`:
  - Informa quais totens fazem parte da mesma “rede estrela”;
  - Ajuda a decidir rotas de efeitos (quem é neighbor, quem é destino).

- `event_logs`:
  - Armazena eventos importantes:
    - `fx_timeline_published`, `fx_effect_triggered`, `fx_execution_result`.

- `ota_updates` / `totem_update_status`:
  - Usados para garantir que todos os totens participantes tenham versão compatível do SmartDisplayFX.

---

### 5. Requisitos de Implementação (Resumo)

1. **Broker / Canal de Mensageria**
   - Preferência: MQTT com WebSocket habilitado (Mosquitto/EMQX).
   - Alternativa: WebSocket próprio com mensagens JSON equivalentes.

2. **SDK SmartDisplayFX (lado totem)**
   - Abstração de subscribe/publish (MQTT/WebSocket).
   - Scheduler de efeitos baseado em `start_ts`.
   - Módulo para envio de:
     - `heartbeat`, `ai_event`, `interaction`, `fx_telemetry`.

3. **FX Orchestrator (lado servidor)**
   - Serviço que:
     - consome `ai_event` / `interaction` / dados de campanhas;
     - gera `timeline_update` e `effect_transfer`;
     - respeita regras de negócio definidas (horários, segmentos, etc.).

4. **Persistência e Observabilidade**
   - Armazenar:
     - eventos chaves em `event_logs`;
     - interações em `interaction_logs`;
     - estatísticas de FX em estrutura própria ou reaproveitando analytics.

---

### 6. Próximo Passo

- **Implementar o SDK SmartDisplayFX (lado totem)** no projeto `Player-SmartDisplayFX-client`:
  - Criar módulo `core/sync/SmartDisplayFlowClient.js` com:
    - conexão (mock com `localStorage`, depois MQTT/WebSocket);
    - handlers para `timeline_update`, `effect_transfer`, `sync_time`;
    - API simples para o FX Engine disparar/receber efeitos.


