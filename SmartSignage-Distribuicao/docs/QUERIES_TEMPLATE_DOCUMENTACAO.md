# Queries Template - Documentação Completa
## Queries Complexas com JOINs para Exportação e Dashboard

---

## 📊 **Visão Geral**

Foram criadas **15 queries template** complexas com múltiplos JOINs, organizadas por módulo/funcionalidade, parametrizáveis e reutilizáveis.

---

## 🎯 **Características das Queries**

### ✅ **Implementado**
- ✅ Queries complexas com múltiplos JOINs
- ✅ Queries agregadas (COUNT, SUM, AVG, MAX, MIN)
- ✅ Queries detalhadas (todos os campos)
- ✅ Filtros dinâmicos parametrizáveis
- ✅ Paginação (LIMIT/OFFSET)
- ✅ Ordenação específica
- ✅ Organização por módulo/funcionalidade
- ✅ Templates parametrizáveis e reutilizáveis
- ✅ Otimizadas para performance (com índices)

---

## 📋 **Queries Criadas por Módulo**

### **E. EXECUÇÃO E MONITORAMENTO (Prioritário)** - 4 queries

#### **E1. Logs de Execução Completo**
- **Objetivo**: Ver histórico de execuções com contexto completo
- **Uso**: Dashboard, Relatórios, Debug
- **JOINs**: 
  - execution_logs → totems → locals → hosts
  - execution_logs → clients
  - execution_logs → campaigns
  - execution_logs → medias
- **Parâmetros**: client_id, totem_id, campaign_id, start_date, end_date, status, play_success
- **Campos**: 25+ campos incluindo totem, localização, cliente, campanha, mídia

#### **E2. Comandos Remotos por Totem**
- **Objetivo**: Monitorar comandos enviados aos totens
- **Uso**: Debug, Monitoramento, Auditoria
- **JOINs**: 
  - remote_commands → totems → locals → hosts
  - remote_commands → users (created_by)
  - totems → campaign_totems → campaigns → clients
- **Parâmetros**: totem_id, command_type, status, created_by, start_date, end_date
- **Campos**: 15+ campos incluindo totem, localização, criador, cliente

#### **E3. Performance de Playlists por Totem**
- **Objetivo**: Analisar execução de playlists com detalhes
- **Uso**: Analytics, Otimização, Relatórios
- **JOINs**: 
  - execution_logs → totems → locals → hosts
  - execution_logs → campaigns → playlists → playlist_items
  - execution_logs → clients
- **Parâmetros**: totem_id, playlist_id, campaign_id, start_date, end_date
- **Agregações**: COUNT(DISTINCT media_id), SUM(display_seconds)
- **Campos**: 20+ campos incluindo totem, playlist, campanha, mídias, estatísticas

#### **E4. Estatísticas de Execução Agregadas**
- **Objetivo**: Métricas agregadas de execução por período
- **Uso**: Dashboard, Relatórios, Analytics
- **JOINs**: 
  - execution_logs → totems
  - execution_logs → campaigns → clients
- **Parâmetros**: client_id, totem_id, campaign_id, start_date, end_date, granularity
- **Agregações**: COUNT, SUM, AVG, MIN, MAX, COUNT(DISTINCT)
- **Granularidade**: 'day' ou 'hour'
- **Campos**: 15+ campos incluindo período, totem, campanha, cliente, métricas agregadas

---

### **G. RBAC E AUDITORIA (Prioritário)** - 4 queries

#### **G1. Usuários com Roles e Permissões Completas**
- **Objetivo**: Ver permissões completas de usuários
- **Uso**: Administração, Segurança, Auditoria
- **JOINs**: 
  - users → clients
  - users → user_roles → roles
  - roles → role_permissions → permissions
- **Parâmetros**: user_id, role_id, client_id, is_active, role_name
- **Agregações**: JSON_AGG para roles e permissions
- **Campos**: 20+ campos incluindo usuário, cliente, roles (JSON), permissions (JSON), contagens

#### **G2. Logs de Auditoria com Contexto Completo**
- **Objetivo**: Ver histórico de ações com contexto completo
- **Uso**: Auditoria, Segurança, Compliance
- **JOINs**: 
  - audit_logs → users → clients
  - Subqueries para entity_name baseado no tipo
- **Parâmetros**: user_id, entity, entity_id, action, start_date, end_date
- **Campos**: 15+ campos incluindo log, usuário, cliente, nome da entidade

#### **G3. Atividades de Usuários por Período**
- **Objetivo**: Analisar atividade de usuários ao longo do tempo
- **Uso**: Analytics, Segurança, Auditoria
- **JOINs**: 
  - audit_logs → users → clients
- **Parâmetros**: user_id, client_id, start_date, end_date, granularity
- **Agregações**: COUNT, COUNT(DISTINCT), COUNT(CASE WHEN ...)
- **Granularidade**: 'day' ou 'hour'
- **Campos**: 15+ campos incluindo período, usuário, cliente, métricas agregadas por ação

#### **G4. Permissões por Role e Recurso**
- **Objetivo**: Ver mapeamento completo de permissões por role
- **Uso**: Administração, Configuração, Segurança
- **JOINs**: 
  - roles → role_permissions → permissions
  - roles → user_roles
- **Parâmetros**: role_id, resource, action
- **Agregações**: JSON_AGG para permissions, COUNT(DISTINCT) por recurso
- **Campos**: 15+ campos incluindo role, permissions (JSON), contagens por recurso, total

---

### **A. GESTÃO DE TOTEMS E LOCALIZAÇÃO** - 1 query

#### **A1. Lista de Totems com Localização Completa**
- **Objetivo**: Visualizar totems com informações de local, host e cliente
- **Uso**: Dashboard, Monitoramento, Administração
- **JOINs**: 
  - totems → locals → hosts
  - totems → smart_tvs
  - totems → playlists
  - totems → campaign_totems → campaigns → clients
  - totems → execution_logs
- **Parâmetros**: totem_id, host_id, local_id, client_id, status, active
- **Agregações**: COUNT(DISTINCT playlist_id), COUNT(DISTINCT campaign_id), COUNT(DISTINCT log_id), MAX(executed_at)
- **Campos**: 30+ campos incluindo totem, localização, smart TV, cliente, estatísticas

---

### **B. GESTÃO DE CAMPANHAS** - 1 query

#### **B1. Campanhas com Detalhes Completos**
- **Objetivo**: Visualizar campanhas com todos os detalhes relacionados
- **Uso**: Dashboard, Administração, Relatórios
- **JOINs**: 
  - campaigns → clients
  - campaigns → campaign_totems → totems
  - campaigns → playlists
  - campaigns → campaign_playlists
  - campaigns → qr_codes
  - campaigns → short_links
  - campaigns → execution_logs
- **Parâmetros**: campaign_id, client_id, status, campaign_type, is_active, start_date, end_date
- **Agregações**: COUNT(DISTINCT totem_id), COUNT(DISTINCT playlist_id), COUNT(DISTINCT qr_code), COUNT(DISTINCT short_link), COUNT(DISTINCT log_id), COUNT(CASE WHEN ...)
- **Campos**: 25+ campos incluindo campanha, cliente, estatísticas completas

---

### **C. GESTÃO DE MÍDIAS** - 1 query

#### **C1. Mídias com Detalhes e Workflow**
- **Objetivo**: Visualizar mídias com informações de aprovação e uso
- **Uso**: Dashboard, Administração, Workflow
- **JOINs**: 
  - medias → clients
  - medias → users (created_by)
  - medias → approval_workflows → users (reviewed_by)
  - medias → playlist_items → playlists
  - medias → execution_logs
- **Parâmetros**: media_id, client_id, status, media_type, workflow_status, created_by
- **Agregações**: COUNT(DISTINCT playlist_item_id), COUNT(DISTINCT playlist_id), COUNT(DISTINCT log_id), COUNT(CASE WHEN ...)
- **Campos**: 25+ campos incluindo mídia, cliente, criador, workflow, estatísticas

---

### **D. ANALYTICS E RELATÓRIOS** - 1 query

#### **D1. Sessões de Analytics por Totem com Demografia**
- **Objetivo**: Analisar interações por totem com informações demográficas
- **Uso**: Analytics, Relatórios, Marketing
- **JOINs**: 
  - analytics_sessions → totems → locals → hosts
  - totems → campaign_totems → campaigns → clients
  - analytics_sessions → analytics_emotions
  - analytics_sessions → analytics_gestures
- **Parâmetros**: totem_id, session_id, start_date, end_date, host_id, client_id
- **Agregações**: COUNT(DISTINCT emotion_id), COUNT(CASE WHEN emotion = ...), AVG(confidence), COUNT(DISTINCT gesture_id)
- **Campos**: 25+ campos incluindo sessão, totem, localização, cliente, métricas de emoções e gestos

---

### **H. EXPORTAÇÃO (Novo Sistema)** - 3 queries

#### **H1. Queries de Exportação com Criador**
- **Objetivo**: Ver queries de exportação com informações do criador
- **Uso**: Administração, Auditoria
- **JOINs**: 
  - export_queries → users (created_by)
  - export_queries → export_schedules
  - export_queries → export_executions
- **Parâmetros**: query_id, created_by, provider, enabled
- **Agregações**: COUNT(DISTINCT schedule_id), COUNT(DISTINCT execution_id), COUNT(CASE WHEN ...), MAX(executed_at)
- **Campos**: 15+ campos incluindo query, criador, estatísticas

#### **H2. Agendamentos de Exportação Completos**
- **Objetivo**: Ver agendamentos com query e criador
- **Uso**: Administração, Monitoramento
- **JOINs**: 
  - export_schedules → export_queries
  - export_schedules → users (created_by)
  - export_schedules → export_executions
- **Parâmetros**: schedule_id, query_id, enabled, created_by
- **Agregações**: COUNT(DISTINCT execution_id), COUNT(CASE WHEN status = ...), MAX(completed_at), SUM(records_exported), SUM(file_size)
- **Campos**: 20+ campos incluindo schedule, query, criador, estatísticas

#### **H3. Histórico de Execuções Completo**
- **Objetivo**: Ver histórico completo de execuções com detalhes
- **Uso**: Debug, Auditoria, Relatórios
- **JOINs**: 
  - export_executions → export_schedules → users (created_by)
  - export_executions → export_queries
- **Parâmetros**: execution_id, schedule_id, query_id, status, start_date, end_date
- **Campos**: 15+ campos incluindo execução, schedule, query, criador, duração calculada

---

## 🔧 **Como Usar as Queries**

### **1. Parâmetros Dinâmicos**

Todas as queries usam comentários `-- AND campo = :parametro` para filtros dinâmicos. Remova o `--` e substitua `:parametro` pelo valor real.

**Exemplo:**
```sql
-- Query original
WHERE 1=1
    -- AND el.client_id = :client_id

-- Query com filtro ativo
WHERE 1=1
    AND el.client_id = 123
```

### **2. Paginação**

Todas as queries suportam paginação com comentários no final:
```sql
-- LIMIT :limit OFFSET :offset
```

**Exemplo:**
```sql
ORDER BY el.executed_at DESC
LIMIT 50 OFFSET 0  -- Primeira página (50 registros)
LIMIT 50 OFFSET 50 -- Segunda página (próximos 50 registros)
```

### **3. Ordenação**

Todas as queries têm `ORDER BY` definido, mas podem ser modificadas conforme necessário.

### **4. Agregações**

Queries agregadas usam `GROUP BY` e funções de agregação. Certifique-se de incluir todos os campos não agregados no `GROUP BY`.

---

## 📊 **Estatísticas das Queries**

- **Total de queries**: 15
- **Módulos**: 6 (E, G, A, B, C, D, H)
- **Queries prioritárias**: 8 (E1-E4, G1-G4)
- **Queries com JOINs múltiplos**: 15
- **Queries agregadas**: 8
- **Queries detalhadas**: 15
- **Queries parametrizáveis**: 15
- **Queries com paginação**: 15

---

## 🚀 **Próximos Passos**

1. **Testar queries** - Executar cada query e validar resultados
2. **Otimizar performance** - Adicionar índices se necessário
3. **Criar queries no sistema** - Adicionar ao sistema de exportação
4. **Documentar parâmetros** - Criar documentação de API se necessário
5. **Criar dashboards** - Usar queries para dashboards

---

## 📝 **Notas Importantes**

1. **Parâmetros**: Todos os parâmetros são opcionais. Se não precisar filtrar, deixe o comentário `--` no lugar.
2. **Performance**: Queries complexas podem ser lentas com muitos JOINs. Use índices e filtros adequados.
3. **Agregações**: Queries agregadas devem ser usadas com cuidado - podem retornar muitos dados.
4. **Paginação**: Sempre use paginação para queries que podem retornar muitos registros.
5. **Ordenação**: Modifique `ORDER BY` conforme necessário para cada caso de uso.

---

**Arquivo**: `database/queries-templates.sql`
**Versão**: 1.0.0
**Data**: Hoje

