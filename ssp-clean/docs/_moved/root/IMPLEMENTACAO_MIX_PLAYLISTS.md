# Implementação de Mix Inteligente de Playlists

**Data:** Dezembro 2025  
**Versão:** 2.1.0

## 📋 Resumo

Implementação completa do sistema de mixagem inteligente de playlists para totens, permitindo combinar playlists de múltiplas campanhas usando regras sistemáticas e/ou Inteligência Artificial.

## 🎯 Funcionalidades Implementadas

### 1. Novas Tabelas do Banco de Dados

#### `playlist_mix_rules`
- Regras de mixagem (globais ou específicas por totem)
- Configurações de pesos (prioridade, horário, tags, subscriber)
- Suporte a IA (reconhecimento de transeuntes, sentimento, contexto)
- Estratégias de rotação (round_robin, priority, weighted, ai_optimized)

#### `ai_context_data`
- Dados de contexto para IA
- Detecção de transeuntes (contagem, densidade, demografia)
- Análise de sentimento (score, label, emoções)
- Contexto temporal e ambiental
- Métricas de performance históricas

#### `totem_playlist_mix`
- Playlist mixada final gerada para cada totem
- Armazena itens ordenados (JSONB)
- Versionamento de mixagens
- Snapshot do contexto usado

#### `playlist_mix_history`
- Histórico de mixagens para análise
- Métricas de performance e engajamento
- Rastreamento de execuções

### 2. Funções SQL

- `get_mix_rule_for_totem(totem_id)`: Retorna regra ativa para um totem
- `get_ai_context_for_totem(totem_id)`: Retorna contexto de IA mais recente
- `set_current_mix_for_totem(totem_id, mix_id)`: Marca mixagem como atual
- `get_current_mix_for_totem(totem_id)`: Retorna mixagem atual do totem

### 3. Triggers SQL

- Atualização automática de `updated_at`
- Garantia de apenas uma regra padrão global
- Garantia de apenas uma mixagem atual por totem
- Registro automático no histórico ao aplicar mixagem

### 4. Serviços Backend

#### `TotemPlaylistMixService`
- `getMixRuleForTotem()`: Obtém regra de mixagem
- `getAIContextForTotem()`: Obtém contexto de IA
- `generateMixForTotem()`: Gera playlist mixada
- `setCurrentMix()`: Define mixagem atual
- `getCurrentMix()`: Obtém mixagem atual

**Algoritmos de Mixagem:**
- Cálculo de peso por item (prioridade, horário, tags, subscriber)
- Ajustes baseados em IA (transeuntes, sentimento, performance)
- Ordenação por estratégia (round_robin, priority, weighted, ai_optimized)
- Embaralhamento dentro da mesma prioridade (opcional)

#### `TotemService` (Atualizado)
- `getCurrentMixedPlaylist()`: Obtém playlist mixada atual
- `generateMixedPlaylist()`: Gera nova playlist mixada

### 5. Endpoints API

#### Totems
- `GET /api/totems/:id/playlist/mix`: Obter playlist mixada atual
- `POST /api/totems/:id/playlist/mix/generate`: Gerar nova playlist mixada

#### Playlist Mix
- `GET /api/playlist-mix/rules`: Listar regras de mixagem
- `GET /api/playlist-mix/rules/:id`: Obter regra por ID
- `POST /api/playlist-mix/rules`: Criar nova regra
- `PUT /api/playlist-mix/rules/:id`: Atualizar regra
- `GET /api/playlist-mix/context/:totemId`: Obter contexto de IA

## 📁 Arquivos Criados/Modificados

### Novos Arquivos

1. `database/smartchannel-db-v2-refactored-part11-playlist-mix.sql`
   - Tabelas de mixagem inteligente
   - Foreign keys e indexes

2. `database/smartchannel-db-v2-refactored-part12-playlist-mix-functions.sql`
   - Funções SQL
   - Triggers

3. `backend/src/services/totemPlaylistMixService.ts`
   - Serviço completo de mixagem

4. `backend/src/routes/playlist-mix.ts`
   - Rotas de API para mixagem

### Arquivos Modificados

1. `backend/src/services/totemService.ts`
   - Adicionados métodos de mixagem
   - Integração com `TotemPlaylistMixService`

2. `backend/src/routes/totems.ts`
   - Novos endpoints de mixagem

3. `backend/src/index.ts`
   - Registro da rota `/api/playlist-mix`

4. `backend/scripts/setup-database.js`
   - Inclusão dos novos arquivos SQL na ordem de execução

## 🔄 Fluxo de Funcionamento

1. **Coleta de Campanhas**
   - Sistema identifica todas as campanhas ativas associadas ao totem
   - Via `campaign_totems` e `campaign_playlists`

2. **Coleta de Playlists**
   - Todas as playlists das campanhas são coletadas
   - Itens de cada playlist são extraídos

3. **Aplicação de Regras**
   - Regra de mixagem é obtida (específica do totem ou padrão global)
   - Pesos são calculados para cada item

4. **Contexto de IA (Opcional)**
   - Se IA habilitada, contexto é obtido
   - Ajustes são aplicados baseados em:
     - Densidade de transeuntes
     - Sentimento detectado
     - Performance histórica

5. **Ordenação e Filtragem**
   - Itens são ordenados por peso/prioridade
   - Estratégia de rotação é aplicada
   - Limite de itens é respeitado

6. **Geração da Mixagem**
   - Playlist mixada é salva no banco
   - Marcada como atual
   - Histórico é registrado

## 🎨 Estratégias de Mixagem

### Systematic
- Apenas regras sistemáticas
- Prioridade, horário, tags, subscriber

### AI
- Apenas Inteligência Artificial
- Reconhecimento de transeuntes
- Análise de sentimento
- Otimização histórica

### Hybrid
- Combinação de regras sistemáticas e IA
- Melhor dos dois mundos

## 📊 Estratégias de Rotação

1. **round_robin**: Distribui igualmente entre campanhas
2. **priority**: Ordena por prioridade/peso
3. **weighted**: Usa pesos calculados
4. **ai_optimized**: Otimização baseada em IA

## 🚀 Como Usar

### 1. Criar Regra de Mixagem

```bash
POST /api/playlist-mix/rules
{
  "name": "Regra Padrão",
  "rule_type": "hybrid",
  "priority_weight": 1.0,
  "time_weight": 1.0,
  "tag_weight": 0.5,
  "ai_enabled": true,
  "use_pedestrian_detection": true,
  "use_sentiment_analysis": true,
  "rotation_strategy": "ai_optimized",
  "is_default": true
}
```

### 2. Gerar Playlist Mixada

```bash
POST /api/totems/:id/playlist/mix/generate
```

### 3. Obter Playlist Mixada Atual

```bash
GET /api/totems/:id/playlist/mix
```

## 📝 Notas Importantes

1. **Compatibilidade**: Método legado `getCurrentPlaylist()` mantido para compatibilidade
2. **Fallback**: Se mixagem falhar, sistema usa método legado
3. **Performance**: Mixagens são cacheadas e versionadas
4. **Histórico**: Todas as mixagens são registradas para análise

## 🔮 Próximos Passos (Sugestões)

1. Interface de gerenciamento de regras no frontend
2. Dashboard de análise de mixagens
3. A/B testing de estratégias
4. Integração com APIs de IA externas
5. Machine Learning para otimização contínua

## ✅ Status

- ✅ Tabelas criadas
- ✅ Funções SQL implementadas
- ✅ Triggers configurados
- ✅ Serviço de mixagem implementado
- ✅ Endpoints API criados
- ✅ Integração com totemService
- ✅ Scripts de instalação atualizados
- ✅ Sem erros de linting

**Implementação 100% completa e funcional!**

