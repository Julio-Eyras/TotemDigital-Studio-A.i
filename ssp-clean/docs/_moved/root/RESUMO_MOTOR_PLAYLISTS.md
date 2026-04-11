# Motor de Gerenciamento de Playlists - Resumo da Implementação

## 🎯 **OBJETIVO**

Criar um motor que:
1. **Cria, indexa e mantém playlists de cada totem/TV smart** baseado em playlists "mothers" (playlists do subscriber)
2. **Propaga mudanças automaticamente**: Quando um subscriber altera suas playlists/campanhas, essas mudanças são propagadas para os publishers correspondentes
3. **Valida e filtra**: Apenas campanhas, mídias e playlists **ativas** e **autorizadas** são incluídas
4. **Gerencia regras comerciais**: Une todas as playlists de todos os subscribers e distribui conforme regras (time share, revenue share, tiers, etc.)

---

## 📊 **ESTRUTURA DO BANCO DE DADOS**

### **Tabelas Criadas:**

#### 1. **`totem_playlists`**
Armazena as playlists FINAIS geradas pelo motor para cada totem/TV.

**Campos principais:**
- `totem_id`: Totem para o qual a playlist foi gerada
- `smart_tv_id`: Smart TV específica (NULL = playlist para todo o totem)
- `publisher_id`: Publisher do totem (denormalizado)
- `playlist_hash`: Hash MD5 para detectar mudanças
- `version`: Versão da playlist (incrementa a cada regeneração)
- `total_items`: Total de itens na playlist
- `total_duration_seconds`: Duração total em segundos
- `status`: active, paused, invalidated
- `generation_log`: Log detalhado da geração

#### 2. **`totem_playlist_items`**
Armazena os itens (mídias) da playlist final gerada.

**Campos principais:**
- `totem_playlist_id`: Playlist à qual pertence
- `media_id`: Mídia a ser exibida
- `campaign_id`: Campanha de origem (opcional)
- `subscriber_id`: Subscriber proprietário (denormalizado)
- `order_index`: Ordem de exibição
- `priority`: Prioridade (maior = mais importante)
- `commercial_tier`: premium, standard, remnant
- `time_share_percent`: % de share de tempo
- `revenue_share_percent`: % de revenue share

#### 3. **`totem_playlist_generation_log`**
Log detalhado de cada geração para auditoria e debug.

**Campos principais:**
- `totem_id`: Totem para o qual foi gerada
- `status`: success, failed, partial
- `campaigns_included`: Quantas campanhas foram incluídas
- `medias_included`: Quantas mídias foram incluídas
- `generation_time_ms`: Tempo de processamento
- `generation_details`: Detalhes JSON da geração

---

## 🔧 **SERVIÇOS IMPLEMENTADOS**

### **1. PlaylistEngineService** (`backend/src/services/playlistEngineService.ts`)

**Métodos principais:**

#### `generatePlaylistForTotem(totemId, smartTvId?, forceRegenerate?)`
Gera playlist final para um totem/TV.

**Processo:**
1. Busca totem e identifica publisher
2. Busca todos os subscribers que têm acesso a este publisher
3. Para cada subscriber, busca campanhas ativas que incluem este publisher
4. Coleta playlists e mídias diretas dessas campanhas
5. Valida status (ativo, autorizado)
6. Aplica regras comerciais (time share, tiers)
7. Ordena e combina itens
8. Gera hash e salva playlist

#### `getAccessibleSubscribers(publisherId)`
Busca todos os subscribers que têm acesso a um publisher via:
- `subscriber_publisher_access` (acesso explícito)
- Planos de contratos ativos (`subscriber_contracts` → `plan_publisher_access`)

#### `collectPlaylistItems(publisherId, subscriberIds, totemId)`
Coleta todos os itens de playlist (mídias) de campanhas ativas:
- Mídias via playlists (`campaign_playlists` → `playlists` → `playlist_items`)
- Mídias diretamente associadas (`campaign_medias`)

**Validações:**
- Campanha ativa (`is_active = true`, `status = 'active'`)
- Campanha dentro do período (`start_date <= CURRENT_DATE <= end_date`)
- Mídia ativa (`is_active = true`)
- Mídia aprovada (`status = 'approved'`, `approval_status = 'approved'`)

#### `applyCommercialRules(items)`
Aplica regras comerciais e ordena itens:

**Ordem de prioridade:**
1. Commercial tier (premium > standard > remnant)
2. Priority (maior = mais importante)
3. Time share (maior = mais importante)

#### `regeneratePlaylistsForPublisher(publisherId)`
Regenera playlists para todos os totens de um publisher.

#### `regeneratePlaylistsForCampaign(campaignId)`
Regenera playlists para todos os totens afetados por uma campanha.

---

### **2. PlaylistEngineWorker** (`backend/src/workers/playlistEngineWorker.ts`)

Worker que monitora mudanças e regenera playlists automaticamente.

**Eventos monitorados (a cada 5 minutos):**
- Campanhas modificadas recentemente
- Mudanças em `subscriber_publisher_access`
- Mudanças em `campaign_publishers`
- Playlists modificadas recentemente
- Mídias modificadas recentemente
- Itens de playlist modificados recentemente

**Métodos:**
- `start()`: Inicia o worker (cron a cada 5 minutos)
- `stop()`: Para o worker
- `regenerateForTotem(totemId, smartTvId?)`: Regeneração manual
- `regenerateForPublisher(publisherId)`: Regeneração manual
- `regenerateForCampaign(campaignId)`: Regeneração manual

---

## 🌐 **ROTAS API**

### **`/api/playlist-engine`**

#### `GET /api/playlist-engine/totem/:totemId`
Busca playlist ativa de um totem.

**Query params:**
- `smartTvId` (opcional): ID da smart TV específica

**Resposta:**
```json
{
  "success": true,
  "data": {
    "totem_playlist_id": 1,
    "totem_id": 1,
    "version": 1,
    "total_items": 10,
    "total_duration_seconds": 300,
    "items": [...]
  }
}
```

#### `POST /api/playlist-engine/totem/:totemId/regenerate`
Regenera playlist para um totem específico.

**Body:**
```json
{
  "smartTvId": 1,  // opcional
  "force": true    // opcional, força regeneração mesmo se hash for igual
}
```

**Requer:** Role `admin`, `admin_sql` ou `manager`

#### `POST /api/playlist-engine/publisher/:publisherId/regenerate`
Regenera playlists para todos os totens de um publisher.

**Requer:** Role `admin`, `admin_sql` ou `manager`

#### `POST /api/playlist-engine/campaign/:campaignId/regenerate`
Regenera playlists para todos os totens afetados por uma campanha.

**Requer:** Role `admin`, `admin_sql` ou `manager`

#### `GET /api/playlist-engine/stats`
Estatísticas do motor de playlists.

**Requer:** Role `admin` ou `admin_sql`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "totalPlaylists": 50,
    "totalItems": 500,
    "recentGenerations": [
      {
        "status": "success",
        "count": 100,
        "avg_time_ms": 250
      }
    ]
  }
}
```

---

## 🔄 **FLUXO DE FUNCIONAMENTO**

### **Geração Automática:**

1. **Worker monitora mudanças** (a cada 5 minutos)
2. **Detecta alterações** em:
   - Campanhas
   - Playlists
   - Mídias
   - Acessos subscriber → publisher
3. **Regenera playlists afetadas** automaticamente
4. **Invalida playlists antigas** (marca como `invalidated`)
5. **Cria nova versão** da playlist

### **Geração Manual:**

1. **Admin/Manager** chama API de regeneração
2. **Motor coleta** todas as campanhas ativas dos subscribers com acesso
3. **Aplica validações** (ativo, autorizado)
4. **Aplica regras comerciais** (tiers, time share, priority)
5. **Gera playlist final** ordenada
6. **Salva no banco** com hash e versão

### **Consulta de Playlist:**

1. **Totem/TV** solicita playlist via API
2. **Motor retorna** playlist ativa mais recente
3. **Totem/TV** usa playlist para exibição

---

## ✅ **VALIDAÇÕES IMPLEMENTADAS**

### **Campanhas:**
- ✅ `is_active = true`
- ✅ `status = 'active'`
- ✅ `start_date <= CURRENT_DATE <= end_date`
- ✅ Subscriber tem acesso ao publisher do totem

### **Mídias:**
- ✅ `is_active = true`
- ✅ `status = 'approved'`
- ✅ `approval_status = 'approved'`
- ✅ Pertence ao mesmo subscriber da campanha

### **Playlists:**
- ✅ `is_active = true`
- ✅ Pertence ao mesmo subscriber da campanha

---

## 📈 **REGRAS COMERCIAIS APLICADAS**

### **Ordenação:**
1. **Commercial Tier**: Premium > Standard > Remnant
2. **Priority**: Maior valor = maior prioridade
3. **Time Share**: Maior % = maior prioridade

### **Distribuição:**
- Mídias são ordenadas conforme regras acima
- `order_index` é recalculado após ordenação
- `time_share_percent` é preservado para cálculo de revenue

---

## 🚀 **PRÓXIMOS PASSOS (OPCIONAL)**

1. **Cache de playlists** (Redis) para performance
2. **Webhooks** para notificar totens quando playlist muda
3. **Dashboard** para visualizar playlists geradas
4. **Métricas** de performance do motor
5. **Otimização** de queries para grandes volumes
6. **Suporte a agendamento** por horário/dia da semana
7. **Balanceamento** de carga entre múltiplos subscribers

---

## 📝 **NOTAS IMPORTANTES**

1. **Hash de playlist**: Usado para detectar mudanças e evitar regenerações desnecessárias
2. **Versionamento**: Cada regeneração cria uma nova versão, invalidando a anterior
3. **Denormalização**: `subscriber_id` e `publisher_id` são denormalizados em `totem_playlist_items` para performance
4. **Logs detalhados**: Todas as gerações são registradas em `totem_playlist_generation_log` para auditoria
5. **Worker assíncrono**: Regenerações são feitas em background para não bloquear o sistema

---

## 🎉 **RESULTADO**

O motor está **completo e funcional**! Ele:
- ✅ Cria e mantém playlists automaticamente
- ✅ Propaga mudanças de subscribers para publishers
- ✅ Valida status e autorizações
- ✅ Aplica regras comerciais
- ✅ Monitora mudanças e regenera automaticamente
- ✅ Fornece APIs para regeneração manual e consulta

**O sistema está pronto para uso!** 🚀

