# Exemplos de API - Mix de Playlists

**Versão:** 2.1.0

Coleção de exemplos práticos para usar a API de Mix de Playlists.

---

## 📋 Índice

1. [Autenticação](#autenticação)
2. [Regras de Mixagem](#regras-de-mixagem)
3. [Contexto de IA](#contexto-de-ia)
4. [Gerar Mixagens](#gerar-mixagens)
5. [Analytics e Histórico](#analytics-e-histórico)
6. [Webhooks](#webhooks)

---

## Autenticação

Todas as requisições (exceto webhooks públicos) requerem token JWT:

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "senha123"
  }'

# Resposta
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

Use o token em todas as requisições:
```bash
Authorization: Bearer {token}
```

---

## Regras de Mixagem

### 1. Criar Regra Systemática

```bash
curl -X POST http://localhost:3000/api/playlist-mix/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Regra Systemática Padrão",
    "description": "Regra usando apenas lógica sistemática",
    "rule_type": "systematic",
    "priority_weight": 1.0,
    "time_weight": 1.0,
    "tag_weight": 0.5,
    "subscriber_weight": 0.5,
    "ai_enabled": false,
    "max_items_per_playlist": 50,
    "rotation_strategy": "priority",
    "shuffle_enabled": false,
    "is_default": false,
    "is_active": true
  }'
```

### 2. Criar Regra Híbrida com IA

```bash
curl -X POST http://localhost:3000/api/playlist-mix/rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Regra IA Shopping",
    "description": "Regra híbrida com IA para shopping",
    "rule_type": "hybrid",
    "priority_weight": 1.0,
    "time_weight": 1.0,
    "tag_weight": 0.8,
    "subscriber_weight": 0.6,
    "ai_enabled": true,
    "ai_provider": "ollama",
    "ai_model": "llama2",
    "use_pedestrian_detection": true,
    "use_sentiment_analysis": true,
    "use_context_awareness": true,
    "use_historical_optimization": true,
    "max_items_per_playlist": 60,
    "rotation_strategy": "ai_optimized",
    "shuffle_enabled": false,
    "is_active": true
  }'
```

### 3. Listar Todas as Regras

```bash
curl -X GET "http://localhost:3000/api/playlist-mix/rules" \
  -H "Authorization: Bearer {token}"
```

### 4. Listar Regras de um Totem

```bash
curl -X GET "http://localhost:3000/api/playlist-mix/rules?totemId=5" \
  -H "Authorization: Bearer {token}"
```

### 5. Obter Regra por ID

```bash
curl -X GET "http://localhost:3000/api/playlist-mix/rules/1" \
  -H "Authorization: Bearer {token}"
```

### 6. Atualizar Regra

```bash
curl -X PUT http://localhost:3000/api/playlist-mix/rules/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "max_items_per_playlist": 75,
    "rotation_strategy": "weighted"
  }'
```

### 7. Deletar Regra

```bash
curl -X DELETE "http://localhost:3000/api/playlist-mix/rules/1" \
  -H "Authorization: Bearer {token}"
```

---

## Contexto de IA

### 1. Atualizar Contexto de IA

```bash
curl -X POST http://localhost:3000/api/playlist-mix/context/5 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "pedestrian_count": 45,
    "pedestrian_density": "high",
    "sentiment_score": 0.75,
    "sentiment_label": "positive",
    "emotion_tags": ["happy", "engaged", "interested"],
    "time_of_day": "lunch",
    "day_type": "weekday",
    "weather_context": {
      "condition": "sunny",
      "temperature": 25
    },
    "performance_metrics": {
      "engagement_rate": 0.82,
      "avg_view_duration": 25.5,
      "completion_rate": 0.75
    }
  }'
```

### 2. Obter Contexto Atual

```bash
curl -X GET "http://localhost:3000/api/playlist-mix/context/5" \
  -H "Authorization: Bearer {token}"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "context_id": 10,
    "totem_id": 5,
    "pedestrian_count": 45,
    "pedestrian_density": "high",
    "sentiment_score": 0.75,
    "sentiment_label": "positive",
    "emotion_tags": ["happy", "engaged"],
    "time_of_day": "lunch",
    "updated_at": "2025-12-22T12:30:00Z"
  }
}
```

---

## Gerar Mixagens

### 1. Gerar Nova Mixagem

```bash
curl -X POST "http://localhost:3000/api/totems/5/playlist/mix/generate" \
  -H "Authorization: Bearer {token}"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "mix_id": 123,
    "totem_id": 5,
    "rule_id": 2,
    "mix_version": 5,
    "total_items": 50,
    "total_duration": 3600,
    "mix_strategy": "hybrid",
    "is_current": true,
    "generated_at": "2025-12-22T10:30:00Z",
    "mix_items": [
      {
        "media_id": 10,
        "playlist_id": 2,
        "campaign_id": 1,
        "subscriber_id": 3,
        "order_index": 0,
        "weight": 1.5,
        "source": "campaign",
        "priority": 10,
        "tags": ["promocao"],
        "duration": 30
      }
      // ... mais itens
    ]
  }
}
```

### 2. Obter Mixagem Atual

```bash
curl -X GET "http://localhost:3000/api/totems/5/playlist/mix" \
  -H "Authorization: Bearer {token}"
```

---

## Analytics e Histórico

### 1. Obter Histórico de Mixagens

```bash
curl -X GET "http://localhost:3000/api/playlist-mix/history?totemId=5&page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```

**Com filtros:**
```bash
curl -X GET "http://localhost:3000/api/playlist-mix/history?totemId=5&strategy=hybrid&page=1&limit=20" \
  -H "Authorization: Bearer {token}"
```

### 2. Overview por Grupos

```bash
curl -X GET "http://localhost:3000/api/playlist-mix/overview?publisherId=1" \
  -H "Authorization: Bearer {token}"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalGroups": 3,
      "totalTotems": 12,
      "totalTvs": 15
    },
    "groups": [
      {
        "publisher_id": 1,
        "publisher_name": "Shopping Center",
        "local_id": 1,
        "local_name": "Food Court",
        "totem_count": 4,
        "tv_count": 5,
        "campaigns": [
          {
            "campaign_id": 1,
            "campaign_name": "Promoção Black Friday",
            "time_share_percent": 30,
            "total_items": 15,
            "total_duration": 900
          }
        ]
      }
    ]
  }
}
```

### 3. Analytics de Performance

```bash
curl -X GET "http://localhost:3000/api/playlist-mix/analytics?totemId=5&startDate=2025-12-01T00:00:00Z&endDate=2025-12-22T23:59:59Z" \
  -H "Authorization: Bearer {token}"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalMixes": 150,
      "averageEngagement": 0.82,
      "totalExecutions": 5000
    },
    "byStrategy": [
      {
        "strategy": "hybrid",
        "count": 80,
        "avgEngagement": 0.85,
        "totalExecutions": 3000
      },
      {
        "strategy": "systematic",
        "count": 70,
        "avgEngagement": 0.78,
        "totalExecutions": 2000
      }
    ],
    "trends": [
      {
        "date": "2025-12-22",
        "executions": 250,
        "avgEngagement": 0.83
      }
    ],
    "topMixes": [
      {
        "mix_id": 123,
        "totem_id": 5,
        "strategy": "hybrid",
        "engagement_score": 0.92,
        "executions": 500
      }
    ],
    "totemPerformance": [
      {
        "totem_id": 5,
        "totem_name": "Totem Food Court",
        "avgEngagement": 0.85,
        "totalExecutions": 1000
      }
    ]
  }
}
```

---

## Webhooks

### 1. Criar Webhook

```bash
curl -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "name": "Notificação Mixagem Gerada",
    "url": "https://seu-servidor.com/webhook/mix-generated",
    "secret": "seu-secret-key-aqui",
    "channels": ["playlist-mix"],
    "events": ["playlist_mix.generated"],
    "enabled": true,
    "retryCount": 3,
    "timeoutMs": 5000
  }'
```

### 2. Listar Webhooks

```bash
curl -X GET "http://localhost:3000/api/webhooks" \
  -H "Authorization: Bearer {token}"
```

### 3. Testar Webhook

```bash
curl -X POST "http://localhost:3000/api/webhooks/1/test" \
  -H "Authorization: Bearer {token}"
```

### 4. Payload Recebido no Webhook

Quando uma mixagem é gerada, seu servidor receberá:

```json
{
  "event": "playlist_mix.generated",
  "payload": {
    "totem_id": 5,
    "mix_id": 123,
    "mix_version": 5,
    "total_items": 50,
    "total_duration": 3600,
    "strategy": "hybrid",
    "rule_id": 2,
    "generated_at": "2025-12-22T10:30:00Z"
  },
  "timestamp": "2025-12-22T10:30:01Z"
}
```

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: sha256=abc123... (se secret configurado)
User-Agent: SmartSignage-Pro/3.1
```

**Verificar Assinatura (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  const calculated = hmac.update(JSON.stringify(payload)).digest('hex');
  return signature === `sha256=${calculated}`;
}
```

---

## Exemplos com JavaScript/TypeScript

### Exemplo Completo

```typescript
const API_BASE = 'http://localhost:3000/api';
const token = 'seu-token-aqui';

// 1. Criar regra
async function createMixRule() {
  const response = await fetch(`${API_BASE}/playlist-mix/rules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Regra Teste',
      rule_type: 'hybrid',
      ai_enabled: true,
      use_sentiment_analysis: true,
      rotation_strategy: 'ai_optimized',
      is_active: true
    })
  });
  
  return await response.json();
}

// 2. Atualizar contexto
async function updateAIContext(totemId: number) {
  const response = await fetch(`${API_BASE}/playlist-mix/context/${totemId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      pedestrian_count: 50,
      pedestrian_density: 'high',
      sentiment_score: 0.8,
      sentiment_label: 'positive'
    })
  });
  
  return await response.json();
}

// 3. Gerar mixagem
async function generateMix(totemId: number) {
  const response = await fetch(
    `${API_BASE}/totems/${totemId}/playlist/mix/generate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  return await response.json();
}

// 4. Fluxo completo
async function setupAndGenerateMix(totemId: number) {
  // Criar regra
  const rule = await createMixRule();
  console.log('Regra criada:', rule);
  
  // Atualizar contexto
  await updateAIContext(totemId);
  console.log('Contexto atualizado');
  
  // Gerar mixagem
  const mix = await generateMix(totemId);
  console.log('Mixagem gerada:', mix);
  
  return mix;
}
```

---

## Erros Comuns

### 401 Unauthorized
- Verifique se o token está correto
- Verifique se o token não expirou

### 404 Not Found
- Verifique se o ID do totem/regra existe
- Verifique a URL da API

### 400 Bad Request
- Verifique os dados enviados
- Verifique a validação dos campos

### 500 Internal Server Error
- Verifique os logs do backend
- Verifique se o banco de dados está acessível

---

**Para mais informações:**
- Swagger UI: `http://localhost:3000/api-docs`
- Manual Técnico: `MANUAL_TECNICO.md`
- Guia de Uso: `GUIA_USO_PLAYLIST_MIX.md`

