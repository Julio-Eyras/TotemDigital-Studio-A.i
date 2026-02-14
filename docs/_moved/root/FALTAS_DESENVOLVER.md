# O Que Falta Desenvolver - Mix Inteligente de Playlists

**Data:** Dezembro 2025 (atualizado 26/01/2026)  
**Status:** Maioria implementada – itens restantes listados

## 📋 Resumo

Este documento lista funcionalidades do sistema de mixagem inteligente. **A maioria foi implementada.** Itens marcados com ✅ estão concluídos. Itens ❌ ainda pendentes.

---

## 🔴 Crítico (Alta Prioridade)

### 1. **Endpoint para Atualizar Contexto de IA**
**Status:** ✅ **IMPLEMENTADO** (POST/PUT /api/playlist-mix/context/:totemId)

**Descrição:** Endpoint para receber dados de contexto de IA dos totens (transeuntes, sentimento, ambiente).

**O que falta:**
- `POST /api/playlist-mix/context/:totemId` - Receber e atualizar contexto de IA
- Integração com sistemas de detecção (câmeras, sensores)
- Validação de dados recebidos

**Localização:** `backend/src/routes/playlist-mix.ts`

**Exemplo de payload:**
```json
{
  "pedestrian_count": 15,
  "pedestrian_density": "high",
  "pedestrian_demographics": {
    "age_groups": {"18-30": 8, "31-50": 5, "50+": 2},
    "gender": {"male": 9, "female": 6}
  },
  "sentiment_score": 0.75,
  "sentiment_label": "positive",
  "emotion_tags": ["happy", "engaged"],
  "weather_context": {
    "temperature": 25,
    "condition": "sunny"
  }
}
```

---

### 2. **Serviço de Atualização de Contexto de IA**
**Status:** ✅ **IMPLEMENTADO** (totemPlaylistMixService.updateAIContext)

**Descrição:** Método no `TotemPlaylistMixService` para atualizar/salvar contexto de IA.

**O que falta:**
- `updateAIContext(totemId, contextData)` - Atualizar ou criar contexto
- `upsertAIContext(totemId, contextData)` - Inserir ou atualizar
- Lógica de agregação de dados históricos

**Localização:** `backend/src/services/totemPlaylistMixService.ts`

---

### 3. **Integração com Heartbeat do Totem**
**Status:** ✅ **IMPLEMENTADO** (totemService.processHeartbeat chama updateAIContext)

**Descrição:** Quando o totem envia heartbeat, atualizar contexto de IA se disponível nos dados do heartbeat.

**O que falta:**
- Modificar `processHeartbeat()` em `TotemService` para extrair dados de IA
- Chamar `updateAIContext()` se dados disponíveis
- Atualizar interface `HeartbeatData` para incluir contexto de IA

**Localização:** `backend/src/services/totemService.ts`

---

## 🟡 Importante (Média Prioridade)

### 4. **Frontend - Gerenciamento de Regras de Mixagem**
**Status:** ✅ **IMPLEMENTADO** (PlaylistMixRules.tsx)

**Descrição:** Interface para criar, editar, visualizar e deletar regras de mixagem.

**O que falta:**
- Página/componente `PlaylistMixRules.tsx`
- Formulário para criar/editar regras
- Listagem de regras
- Configuração de pesos e estratégias
- Ativação/desativação de regras

**Localização:** `frontend/src/pages/PlaylistMix/` (criar)

**Recursos:**
- CRUD completo de regras
- Visualização de regras por totem
- Teste de regras em tempo real
- Pré-visualização de mixagem

---

### 5. **Frontend - Visualização de Playlist Mixada**
**Status:** ✅ **IMPLEMENTADO** (PlaylistMix.tsx)

**Descrição:** Interface para visualizar a playlist mixada atual de um totem.

**O que falta:**
- Componente `TotemMixPlaylistView.tsx`
- Visualização dos itens ordenados
- Informações de peso e prioridade
- Contexto usado na mixagem
- Histórico de versões

**Localização:** `frontend/src/pages/Totems/` ou componente dedicado

**Recursos:**
- Visualização em tempo real
- Detalhes de cada item (origem, peso, motivo)
- Botão para regenerar mixagem
- Comparação de versões

---

### 6. **Frontend - Visualização de Contexto de IA**
**Status:** ✅ **IMPLEMENTADO** (AIContextDashboard.tsx)

**Descrição:** Dashboard para visualizar contexto de IA de cada totem.

**O que falta:**
- Componente `AIContextDashboard.tsx`
- Gráficos de transeuntes ao longo do tempo
- Análise de sentimento
- Métricas de performance
- Configuração de alertas

**Localização:** `frontend/src/pages/AIContext/` (criar)

**Recursos:**
- Gráficos em tempo real
- Histórico de dados
- Exportação de dados
- Alertas configuráveis

---

### 7. **Frontend - Histórico de Mixagens**
**Status:** ✅ **IMPLEMENTADO** (PlaylistMixAnalytics.tsx)

**Descrição:** Visualização do histórico de mixagens para análise.

**O que falta:**
- Componente `MixHistory.tsx`
- Tabela/listagem de histórico
- Filtros por totem, data, estratégia
- Análise de performance
- Comparação de estratégias

**Localização:** `frontend/src/pages/PlaylistMix/` (criar)

**Recursos:**
- Filtros avançados
- Exportação de relatórios
- Gráficos de performance
- A/B testing de estratégias

---

### 8. **Dados Iniciais (Seeds)**
**Status:** ✅ **IMPLEMENTADO** (seeds-playlist-mix.sql)

**Descrição:** Script SQL com regra padrão de mixagem e dados de exemplo.

**O que falta:**
- Inserir regra padrão global em `playlist_mix_rules`
- Dados de exemplo de contexto de IA
- Exemplos de mixagens

**Localização:** `database/carga-inicial-2025.sql` (seed principal) ou novo arquivo `database/seeds-playlist-mix.sql`

**Exemplo:**
```sql
-- Regra padrão global
INSERT INTO playlist_mix_rules (
  name, rule_type, priority_weight, time_weight, 
  tag_weight, subscriber_weight, is_default, is_active
) VALUES (
  'Regra Padrão Systemática',
  'systematic',
  1.0, 1.0, 0.5, 0.5,
  true, true
);
```

---

### 9. **API Service no Frontend**
**Status:** ✅ **IMPLEMENTADO** (playlistMixApi.ts)

**Descrição:** Serviços/APIs no frontend para consumir endpoints de mixagem.

**O que falta:**
- `frontend/src/services/api/playlistMixApi.ts`
- Métodos para todas as operações de mixagem
- TypeScript interfaces/types
- Integração com React Query

**Localização:** `frontend/src/services/api/playlistMixApi.ts` (criar)

**Métodos necessários:**
- `getMixRules()`
- `getMixRule(id)`
- `createMixRule(data)`
- `updateMixRule(id, data)`
- `deleteMixRule(id)`
- `getAIContext(totemId)`
- `updateAIContext(totemId, data)`
- `getCurrentMix(totemId)`
- `generateMix(totemId)`
- `getMixHistory(filters)`

---

## 🟢 Melhorias (Baixa Prioridade)

### 10. **Documentação Swagger/OpenAPI**
**Status:** ❌ Não implementado

**Descrição:** Documentar novos endpoints na especificação OpenAPI.

**O que falta:**
- Adicionar endpoints de mixagem ao Swagger
- Documentar schemas (MixRule, AIContext, etc.)
- Exemplos de requisições/respostas

**Localização:** `backend/src/config/swagger.ts`

---

### 11. **Testes Automatizados**
**Status:** ❌ Não implementado

**Descrição:** Testes unitários e de integração para mixagem.

**O que falta:**
- Testes do `TotemPlaylistMixService`
- Testes dos endpoints de API
- Testes de funções SQL
- Testes de integração end-to-end

**Localização:** `backend/tests/` (criar se não existir)

---

### 12. **Otimização de Performance**
**Status:** ⚠️ Parcialmente implementado

**Descrição:** Cache e otimizações para mixagem.

**O que falta:**
- Cache de mixagens geradas
- Cache de regras de mixagem
- Índices adicionais no banco se necessário
- Otimização de queries de mixagem

**Localização:** `backend/src/services/totemPlaylistMixService.ts`

---

### 13. **Webhooks e Notificações**
**Status:** ❌ Não implementado

**Descrição:** Notificar quando nova mixagem é gerada ou contexto de IA é atualizado.

**O que falta:**
- Webhook quando mixagem é gerada
- Webhook quando contexto de IA muda significativamente
- Notificações no frontend

**Localização:** `backend/src/services/webhookService.ts` (se existir)

---

### 14. **Scheduler para Regeneração Automática**
**Status:** ✅ **IMPLEMENTADO** (PlaylistMixWorker)

**Descrição:** Agendar regeneração automática de mixagens baseado em tempo ou eventos.

**O que falta:**
- Job para regenerar mixagens periodicamente
- Regeneração quando campanhas mudam
- Regeneração quando contexto de IA muda significativamente

**Localização:** `backend/src/workers/` ou `backend/src/schedulers/`

---

### 15. **Validações Avançadas**
**Status:** ⚠️ Básico implementado

**Descrição:** Validações mais rigorosas de dados.

**O que falta:**
- Validação de pesos (soma total, limites)
- Validação de contexto de IA (ranges válidos)
- Validação de estratégias vs. regras disponíveis
- Validação de compatibilidade de regras

**Localização:** `backend/src/services/totemPlaylistMixService.ts`

---

### 16. **Relatórios e Analytics**
**Status:** ❌ Não implementado

**Descrição:** Relatórios de performance de mixagens.

**O que falta:**
- Relatório de eficácia por estratégia
- Análise de contexto de IA ao longo do tempo
- Comparação de mixagens
- Recomendações automáticas

**Localização:** `backend/src/services/reportsService.ts`

---

### 17. **Integração com Serviços de IA Externos**
**Status:** ⚠️ Estrutura existe, integração não

**Descrição:** Integração real com APIs de IA (OpenAI, Anthropic, Ollama) para análise.

**O que falta:**
- Integração com serviços de detecção de transeuntes
- Integração com análise de sentimento
- Processamento de imagens/vídeo para análise
- Webhooks de sistemas externos

**Localização:** `backend/src/services/aiService.ts` e novos serviços

---

### 18. **Machine Learning para Otimização**
**Status:** ❌ Não implementado

**Descrição:** ML para otimizar pesos e estratégias baseado em performance.

**O que falta:**
- Coleta de dados de treinamento
- Modelo de ML para otimização
- Treinamento e inferência
- Feedback loop

**Localização:** Novo módulo `backend/src/services/mlOptimizationService.ts`

---

## 📊 Resumo por Prioridade

### 🔴 Crítico (3 itens)
1. Endpoint para atualizar contexto de IA
2. Serviço de atualização de contexto
3. Integração com heartbeat

### 🟡 Importante (6 itens)
4. Frontend - Gerenciamento de regras
5. Frontend - Visualização de mixagem
6. Frontend - Visualização de contexto de IA
7. Frontend - Histórico
8. Seeds/dados iniciais
9. API Service no frontend

### 🟢 Melhorias (9 itens)
10. Documentação Swagger
11. Testes automatizados
12. Otimização de performance
13. Webhooks e notificações
14. Scheduler para regeneração
15. Validações avançadas
16. Relatórios e analytics
17. Integração com serviços de IA externos
18. Machine Learning

---

## 🎯 Próximos Passos Recomendados

1. **Imediato:** Implementar endpoints e serviços de contexto de IA (#1, #2, #3)
2. **Curto Prazo:** Frontend básico de visualização (#4, #5, #9)
3. **Médio Prazo:** Frontend completo e seeds (#6, #7, #8)
4. **Longo Prazo:** Melhorias e integrações avançadas (#10-18)

---

## ✅ O Que Já Está Pronto

- ✅ Estrutura de banco de dados completa
- ✅ Funções SQL implementadas
- ✅ Triggers configurados
- ✅ Serviço backend de mixagem básico
- ✅ Endpoints de API básicos (CRUD regras, obter mixagem)
- ✅ Integração com TotemService
- ✅ Algoritmos de mixagem (systematic, ai, hybrid)
- ✅ Estratégias de rotação
- ✅ Cálculo de pesos
- ✅ Documentação de implementação

---

**Última atualização:** Dezembro 2025


