# Exemplos Práticos - Rede Estrela SmartDisplayFX

## 📊 Diagrama Visual da Estrutura

```
┌─────────────────────────────────────────────────────────────┐
│                    fx_sites (Centro)                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ site_id: "loja-centro-01"                            │  │
│  │ name: "Loja Centro - Andar 1"                        │  │
│  │ broker_url: "ws://mqtt-broker.local:9001"            │  │
│  │ broker_config: { username, password, topics, qos }   │  │
│  │ config: { max_totems, sync_tolerance_ms, ... }        │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ (1:N)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ fx_totem_    │  │ fx_totem_    │  │ fx_totem_    │
│ sites        │  │ sites        │  │ sites        │
│              │  │              │  │              │
│ totem_id:100 │  │ totem_id:101 │  │ totem_id:102 │
│ role:master  │  │ role:partici │  │ role:partici │
│ pos_x:0      │  │ pos_x:100    │  │ pos_x:200    │
│ pos_y:0      │  │ pos_y:0      │  │ pos_y:0      │
└──────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
                  [Broker MQTT]
                  (Comunicação)
```

---

## 💻 Exemplos de Código TypeScript

### 1. Criar Site e Adicionar Totens

```typescript
import { getFxSiteService } from '../services/fxSiteService';

const siteService = getFxSiteService();

// 1. Criar site
const site = await siteService.createSite({
  site_id: 'loja-centro-01',
  name: 'Loja Centro - Andar 1',
  description: 'Rede de totens do andar térreo',
  client_id: 1,
  broker_url: 'ws://mqtt-broker.local:9001',
  broker_type: 'mqtt',
  broker_config: {
    username: 'smartdisplay',
    password: 'secure_password',
    topics: {
      effect: 'smartdisplay/loja-centro-01/effect',
      timeline: 'smartdisplay/loja-centro-01/timeline',
      sync_time: 'smartdisplay/loja-centro-01/sync_time'
    },
    qos: {
      effect: 0,
      timeline: 1,
      sync_time: 1
    }
  },
  sync_interval_ms: 2000,
  time_sync_enabled: true,
  config: {
    max_totems: 10,
    sync_tolerance_ms: 100,
    visualization: {
      layout: 'grid',
      columns: 3
    }
  }
});

// 2. Adicionar totens ao site
await siteService.addTotemToSite('loja-centro-01', 100, 'master', 0, 0);
await siteService.addTotemToSite('loja-centro-01', 101, 'participant', 100, 0);
await siteService.addTotemToSite('loja-centro-01', 102, 'participant', 200, 0);
```

### 2. Buscar Totens de um Site

```typescript
const totems = await siteService.getTotemsForSite('loja-centro-01');

console.log(`Site tem ${totems.length} totens:`);
totems.forEach(totem => {
  console.log(`- Totem ${totem.totem_id}: ${totem.role} (${totem.position_x}, ${totem.position_y})`);
});

// Saída:
// Site tem 3 totens:
// - Totem 100: master (0, 0)
// - Totem 101: participant (100, 0)
// - Totem 102: participant (200, 0)
```

### 3. Usar no FxOrchestratorService

```typescript
// O FxOrchestratorService usa automaticamente:
const toTotemId = await this.findTargetTotem(siteId, fromTotemId);

// Internamente faz:
// 1. Busca totens do site via fx_totem_sites
// 2. Prioriza totem "master"
// 3. Escolhe aleatoriamente entre participantes
// 4. Fallback para totem_network se necessário
```

### 4. Consultar Rede Completa

```typescript
// Buscar site com todos os totens
const site = await siteService.getSiteById('loja-centro-01');
const totems = await siteService.getTotemsForSite('loja-centro-01');

const networkInfo = {
  site: {
    id: site.site_id,
    name: site.name,
    broker: site.broker_url,
    totemCount: totems.length
  },
  totems: totems.map(t => ({
    id: t.totem_id,
    role: t.role,
    position: { x: t.position_x, y: t.position_y }
  }))
};

console.log(JSON.stringify(networkInfo, null, 2));
```

---

## 🔄 Fluxo Completo de Uso

### Cenário: Criar Rede e Orquestrar Efeito

```typescript
// 1. Criar site
const site = await siteService.createSite({
  site_id: 'loja-centro-01',
  name: 'Loja Centro',
  broker_url: 'ws://mqtt.local:9001',
  client_id: 1
});

// 2. Adicionar totens
await siteService.addTotemToSite('loja-centro-01', 100, 'master');
await siteService.addTotemToSite('loja-centro-01', 101, 'participant');
await siteService.addTotemToSite('loja-centro-01', 102, 'participant');

// 3. Evento de interação chega
const fxOrchestrator = getFxOrchestratorService();
await fxOrchestrator.handleInteractionEvent({
  siteId: 'loja-centro-01',
  totemId: '100',
  interactionType: 'tag_id',
  tagId: 'tag-123',
  timestamp: new Date().toISOString()
});

// 4. Sistema internamente:
// - Busca regras ativas do site
// - Avalia condições
// - Encontra totem de destino via fx_totem_sites
// - Publica effect_transfer via MQTT
// - Registra telemetria
```

---

## 📋 Estrutura JSON Completa

### Site com Configuração Completa

```json
{
  "site_id": "loja-centro-01",
  "name": "Loja Centro - Andar 1",
  "description": "Rede de totens do andar térreo",
  "client_id": 1,
  "broker_url": "ws://mqtt-broker.local:9001",
  "broker_type": "mqtt",
  "broker_config": {
    "username": "smartdisplay",
    "password": "secure_password",
    "topics": {
      "effect": "smartdisplay/loja-centro-01/effect",
      "timeline": "smartdisplay/loja-centro-01/timeline",
      "sync_time": "smartdisplay/loja-centro-01/sync_time",
      "telemetry": "smartdisplay/loja-centro-01/telemetry"
    },
    "qos": {
      "effect": 0,
      "timeline": 1,
      "sync_time": 1,
      "telemetry": 0
    },
    "retain": {
      "effect": false,
      "timeline": true,
      "sync_time": false,
      "telemetry": false
    }
  },
  "sync_interval_ms": 2000,
  "time_sync_enabled": true,
  "config": {
    "max_totems": 10,
    "sync_tolerance_ms": 100,
    "heartbeat_interval_ms": 5000,
    "visualization": {
      "layout": "grid",
      "columns": 3,
      "spacing": 50,
      "show_labels": true
    },
    "effects": {
      "default_duration_ms": 1600,
      "max_concurrent": 3
    }
  },
  "is_active": true,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### Relação Totem-Site

```json
{
  "id": 1,
  "totem_id": 100,
  "site_id": "loja-centro-01",
  "role": "master",
  "position_x": 0,
  "position_y": 0,
  "is_active": true,
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

---

## 🎯 Casos de Uso

### Caso 1: Loja com Múltiplos Andares

```typescript
// Andar 1
await siteService.createSite({
  site_id: 'loja-centro-01',
  name: 'Loja Centro - Andar 1',
  broker_url: 'ws://mqtt-andar1.local:9001',
  client_id: 1
});

// Andar 2
await siteService.createSite({
  site_id: 'loja-centro-02',
  name: 'Loja Centro - Andar 2',
  broker_url: 'ws://mqtt-andar2.local:9001',
  client_id: 1
});

// Totens do andar 1
await siteService.addTotemToSite('loja-centro-01', 100, 'master');
await siteService.addTotemToSite('loja-centro-01', 101, 'participant');

// Totens do andar 2
await siteService.addTotemToSite('loja-centro-02', 200, 'master');
await siteService.addTotemToSite('loja-centro-02', 201, 'participant');
```

### Caso 2: Rede com Layout Visual

```typescript
// Criar site
const site = await siteService.createSite({
  site_id: 'showroom-01',
  name: 'Showroom Principal',
  broker_url: 'ws://mqtt.local:9001',
  config: {
    visualization: {
      layout: 'grid',
      columns: 4,
      spacing: 100
    }
  }
});

// Adicionar totens em grid 4x3
let position = 0;
for (let y = 0; y < 3; y++) {
  for (let x = 0; x < 4; x++) {
    const totemId = 100 + position;
    const role = position === 0 ? 'master' : 'participant';
    
    await siteService.addTotemToSite(
      'showroom-01',
      totemId,
      role,
      x * 100,
      y * 100
    );
    
    position++;
  }
}
```

### Caso 3: Atualizar Configuração de Rede

```typescript
// Atualizar intervalo de sincronização
await siteService.updateSite('loja-centro-01', {
  sync_interval_ms: 1000, // Reduzir para 1 segundo
  config: {
    max_totems: 20,
    sync_tolerance_ms: 50,
    effects: {
      default_duration_ms: 2000,
      max_concurrent: 5
    }
  }
});
```

---

## 🔍 Queries SQL Diretas

### Listar Todos os Sites com Totens

```sql
SELECT 
  s.site_id,
  s.name,
  s.broker_url,
  COUNT(ts.totem_id) as totem_count,
  COUNT(CASE WHEN ts.role = 'master' THEN 1 END) as master_count
FROM fx_sites s
LEFT JOIN fx_totem_sites ts ON s.site_id = ts.site_id AND ts.is_active = true
WHERE s.is_active = true
GROUP BY s.site_id, s.name, s.broker_url
ORDER BY s.name;
```

### Buscar Totens de um Site com Informações do Totem

```sql
SELECT 
  ts.id,
  ts.totem_id,
  ts.role,
  ts.position_x,
  ts.position_y,
  t.name as totem_name,
  t.identifier,
  t.status as totem_status
FROM fx_totem_sites ts
JOIN totems t ON ts.totem_id = t.totem_id
WHERE ts.site_id = 'loja-centro-01' 
  AND ts.is_active = true
  AND t.is_active = true
ORDER BY ts.role DESC, ts.totem_id ASC;
```

### Buscar Sites sem Totens

```sql
SELECT 
  s.site_id,
  s.name,
  s.created_at
FROM fx_sites s
LEFT JOIN fx_totem_sites ts ON s.site_id = ts.site_id AND ts.is_active = true
WHERE s.is_active = true
  AND ts.id IS NULL;
```

---

## 📊 Estatísticas da Rede

### Contar Totens por Role

```typescript
const totems = await siteService.getTotemsForSite('loja-centro-01');

const stats = {
  total: totems.length,
  master: totems.filter(t => t.role === 'master').length,
  participant: totems.filter(t => t.role === 'participant').length,
  observer: totems.filter(t => t.role === 'observer').length
};

console.log(stats);
// { total: 5, master: 1, participant: 3, observer: 1 }
```

### Visualizar Topologia

```typescript
const totems = await siteService.getTotemsForSite('loja-centro-01');

const topology = {
  bounds: {
    minX: Math.min(...totems.map(t => t.position_x || 0)),
    maxX: Math.max(...totems.map(t => t.position_x || 0)),
    minY: Math.min(...totems.map(t => t.position_y || 0)),
    maxY: Math.max(...totems.map(t => t.position_y || 0))
  },
  totems: totems.map(t => ({
    id: t.totem_id,
    role: t.role,
    position: { x: t.position_x || 0, y: t.position_y || 0 }
  }))
};

console.log(JSON.stringify(topology, null, 2));
```

---

## ⚠️ Validações e Regras

### Regras de Negócio

1. **Um totem só pode estar em um site por vez**
   - Constraint `UNIQUE(totem_id, site_id)` garante isso
   - Se tentar adicionar o mesmo totem, atualiza os dados

2. **Site deve ter pelo menos um totem para funcionar**
   - Validação no `FxOrchestratorService.generateTimeline()`

3. **Role "master" é opcional**
   - Se não houver master, escolhe aleatoriamente entre participants

4. **Posições são opcionais**
   - Úteis apenas para visualização
   - Não afetam a lógica de orquestração

---

## 🚀 Integração com Player Cliente

### Como o Player se Conecta

```javascript
// 1. Player busca seu site_id (via API ou config)
const siteId = 'loja-centro-01';

// 2. Busca configuração do site
const siteResponse = await fetch(`/api/smartdisplayfx/sites/${siteId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const site = await siteResponse.json();

// 3. Conecta ao broker MQTT
const mqtt = require('mqtt');
const client = mqtt.connect(site.data.broker_url, {
  username: site.data.broker_config.username,
  password: site.data.broker_config.password
});

// 4. Subscreve nos topics do site
client.subscribe(`smartdisplay/${siteId}/effect`);
client.subscribe(`smartdisplay/${siteId}/timeline`);
client.subscribe(`smartdisplay/${siteId}/sync_time`);

// 5. Processa mensagens
client.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  
  if (topic.includes('/effect')) {
    // Executar efeito FX
    executeEffect(data);
  } else if (topic.includes('/timeline')) {
    // Atualizar timeline
    updateTimeline(data);
  } else if (topic.includes('/sync_time')) {
    // Sincronizar tempo
    syncTime(data);
  }
});
```

---

**Documentação criada em:** 2025-01-XX  
**Versão:** 1.0  
**Status:** ✅ Completo

