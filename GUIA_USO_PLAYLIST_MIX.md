# Guia de Uso - Mix Inteligente de Playlists

**Versão:** 2.1.0  
**Data:** Dezembro 2025

## 📖 Índice

1. [Visão Geral](#visão-geral)
2. [Conceitos Básicos](#conceitos-básicos)
3. [Configuração Inicial](#configuração-inicial)
4. [Criando Regras de Mixagem](#criando-regras-de-mixagem)
5. [Atualizando Contexto de IA](#atualizando-contexto-de-ia)
6. [Gerando Mixagens](#gerando-mixagens)
7. [Webhooks](#webhooks)
8. [Exemplos Práticos](#exemplos-práticos)
9. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O sistema de Mix Inteligente de Playlists combina automaticamente múltiplas playlists e campanhas para criar uma playlist final otimizada para cada totem, usando:

- **Regras Sistemáticas**: Prioridade, horário, tags, subscriber
- **Inteligência Artificial**: Análise de sentimento, contexto, histórico
- **Campos Comerciais**: Tier, time share, limites de impressão

---

## Conceitos Básicos

### Tipos de Regras

1. **Systematic** (`systematic`): Apenas regras sistemáticas (prioridade, horário, tags)
2. **AI** (`ai`): Apenas inteligência artificial
3. **Hybrid** (`hybrid`): Combinação de sistemático + IA

### Estratégias de Rotação

- `round_robin`: Intercala itens de diferentes campanhas
- `priority`: Ordena por prioridade
- `weighted`: Ordena por peso calculado
- `ai_optimized`: Otimização baseada em IA

### Campos Comerciais

- **Commercial Tier**: `premium`, `standard`, `remnant`
- **Time Share**: Porcentagem de tempo alocada (0-100)
- **Max Consecutive Slots**: Máximo de slots consecutivos da mesma campanha
- **Impression Limits**: Min/max de impressões por hora

---

## Configuração Inicial

### 1. Criar Regra Padrão

```bash
POST /api/playlist-mix/rules
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Regra Padrão Systemática",
  "description": "Regra padrão usando apenas regras sistemáticas",
  "rule_type": "systematic",
  "priority_weight": 1.0,
  "time_weight": 1.0,
  "tag_weight": 0.5,
  "subscriber_weight": 0.5,
  "ai_enabled": false,
  "max_items_per_playlist": 50,
  "rotation_strategy": "priority",
  "shuffle_enabled": false,
  "is_default": true,
  "is_active": true
}
```

### 2. Criar Regra com IA

```bash
POST /api/playlist-mix/rules
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Regra Híbrida com IA",
  "description": "Regra combinando sistemático com IA",
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
  "max_items_per_playlist": 50,
  "rotation_strategy": "ai_optimized",
  "shuffle_enabled": false,
  "is_active": true
}
```

---

## Criando Regras de Mixagem

### Regra por Totem Específico

```bash
POST /api/playlist-mix/rules
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Regra Shopping Food Court",
  "description": "Regra específica para totem do food court",
  "totem_id": 5,
  "rule_type": "hybrid",
  "priority_weight": 1.2,
  "time_weight": 0.8,
  "tag_weight": 1.0,
  "subscriber_weight": 0.7,
  "ai_enabled": true,
  "use_sentiment_analysis": true,
  "max_items_per_playlist": 60,
  "rotation_strategy": "ai_optimized",
  "is_active": true
}
```

### Listar Regras

```bash
GET /api/playlist-mix/rules?totemId=5
Authorization: Bearer {token}
```

### Atualizar Regra

```bash
PUT /api/playlist-mix/rules/{ruleId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "max_items_per_playlist": 75,
  "rotation_strategy": "weighted"
}
```

---

## Atualizando Contexto de IA

### Atualizar Contexto do Totem

```bash
POST /api/playlist-mix/context/{totemId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "pedestrian_count": 45,
  "pedestrian_density": "high",
  "sentiment_score": 0.75,
  "sentiment_label": "positive",
  "emotion_tags": ["happy", "engaged", "interested"],
  "time_of_day": "lunch",
  "day_type": "weekday",
  "performance_metrics": {
    "engagement_rate": 0.82,
    "avg_view_duration": 25.5
  }
}
```

### Obter Contexto Atual

```bash
GET /api/playlist-mix/context/{totemId}
Authorization: Bearer {token}
```

### Via Heartbeat do Totem

O contexto de IA também pode ser atualizado automaticamente via heartbeat:

```bash
POST /api/totems/{totemId}/heartbeat
Content-Type: application/json

{
  "status": "online",
  "version": "2.1.0",
  "metrics": {
    "cpu": 45,
    "memory": 60
  },
  "aiContext": {
    "pedestrian_count": 30,
    "sentiment_score": 0.65
  }
}
```

---

## Gerando Mixagens

### Gerar Mixagem Manualmente

```bash
POST /api/totems/{totemId}/playlist/mix/generate
Authorization: Bearer {token}
```

### Obter Mixagem Atual

```bash
GET /api/totems/{totemId}/playlist/mix
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "mix_id": 123,
    "totem_id": 5,
    "mix_version": 3,
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
        "tags": ["promocao", "black-friday"],
        "duration": 30
      },
      // ... mais itens
    ],
    "total_items": 50,
    "total_duration": 3600,
    "mix_strategy": "hybrid",
    "is_current": true,
    "generated_at": "2025-12-22T10:30:00Z"
  }
}
```

### Histórico de Mixagens

```bash
GET /api/playlist-mix/history?totemId=5&page=1&limit=20&strategy=hybrid
Authorization: Bearer {token}
```

---

## Webhooks

### Configurar Webhook para Mixagem Gerada

```bash
POST /api/webhooks
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Notificação Mixagem",
  "url": "https://seu-servidor.com/webhook/mix",
  "secret": "seu-secret-key",
  "channels": ["playlist-mix"],
  "events": ["playlist_mix.generated"],
  "enabled": true,
  "retryCount": 3,
  "timeoutMs": 5000
}
```

### Payload do Webhook

Quando uma mixagem é gerada, o webhook recebe:

```json
{
  "event": "playlist_mix.generated",
  "payload": {
    "totem_id": 5,
    "mix_id": 123,
    "mix_version": 3,
    "total_items": 50,
    "total_duration": 3600,
    "strategy": "hybrid",
    "rule_id": 2,
    "generated_at": "2025-12-22T10:30:00Z"
  },
  "timestamp": "2025-12-22T10:30:01Z"
}
```

---

## Exemplos Práticos

### Exemplo 1: Configuração Completa

```javascript
// 1. Criar regra de mixagem
const rule = await fetch('/api/playlist-mix/rules', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'Regra Premium Shopping',
    rule_type: 'hybrid',
    ai_enabled: true,
    use_sentiment_analysis: true,
    rotation_strategy: 'ai_optimized',
    is_active: true
  })
});

// 2. Atualizar contexto de IA
await fetch(`/api/playlist-mix/context/${totemId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    pedestrian_count: 50,
    pedestrian_density: 'high',
    sentiment_score: 0.8
  })
});

// 3. Gerar mixagem
const mix = await fetch(`/api/totems/${totemId}/playlist/mix/generate`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// 4. Obter mixagem atual
const currentMix = await fetch(`/api/totems/${totemId}/playlist/mix`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Exemplo 2: Usando Campos Comerciais

Configure campanhas com campos comerciais:

```bash
PUT /api/campaigns/{campaignId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "commercial_tier": "premium",
  "default_time_share_percent": 30,
  "max_consecutive_slots": 3
}
```

E configure time share por publisher:

```bash
PUT /api/campaigns/{campaignId}/publishers/{publisherId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "time_share_percent": 25,
  "min_impressions_per_hour": 10,
  "max_impressions_per_hour": 30,
  "daypart_config": {
    "morning": { "enabled": true, "time_share": 20 },
    "afternoon": { "enabled": true, "time_share": 30 },
    "evening": { "enabled": true, "time_share": 25 }
  }
}
```

---

## Troubleshooting

### Mixagem não está sendo gerada

1. Verifique se há regra ativa para o totem:
   ```bash
   GET /api/playlist-mix/rules?totemId={totemId}
   ```

2. Verifique se há campanhas ativas associadas ao totem
3. Verifique logs do backend para erros

### IA não está funcionando

1. Verifique se `ai_enabled` está `true` na regra
2. Verifique se o provider de IA está configurado (variáveis de ambiente)
3. Verifique se há contexto de IA atualizado para o totem

### Webhook não está sendo chamado

1. Verifique se webhook está habilitado:
   ```bash
   GET /api/webhooks
   ```

2. Verifique se o evento `playlist_mix.generated` está na lista de eventos
3. Verifique logs do backend para erros de webhook

### Cache não está funcionando

1. O cache é opcional e funciona apenas se Redis estiver habilitado
2. Se Redis não estiver disponível, o sistema continua funcionando sem cache
3. Cache de regras: 1 hora
4. Cache de mixagens: 30 minutos

---

## Próximos Passos

- Configure regras apropriadas para seus totens
- Atualize contexto de IA regularmente (ou configure via heartbeat)
- Monitore analytics de mixagens
- Configure webhooks para notificações
- Ajuste campos comerciais nas campanhas

---

**Para mais informações, consulte:**
- `MANUAL_TECNICO.md` - Manual técnico completo
- `ESQUEMA_BANCO_DADOS.md` - Esquema do banco de dados
- Swagger UI: `http://localhost:3000/api-docs`

