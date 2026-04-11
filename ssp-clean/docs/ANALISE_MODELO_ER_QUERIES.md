# Análise do Modelo ER e Proposta de Queries
## Mapeamento de Relacionamentos e Funcionalidades de Negócio

---

## 📊 **Modelo ER - Relacionamentos Identificados**

### **1. Hierarquia Organizacional**

```
clients (1) ──→ (N) users
clients (1) ──→ (N) campaigns
clients (1) ──→ (N) medias
```

### **2. Estrutura de Localização**

```
hosts (1) ──→ (N) locals
locals (1) ──→ (N) totems
totems (1) ──→ (1) smart_tvs
```

### **3. Campanhas e Mídias**

```
campaigns (1) ──→ (N) campaign_playlists
campaigns (1) ──→ (N) campaign_totems
campaigns (1) ──→ (N) qr_codes
campaigns (1) ──→ (N) short_links
```

### **4. Playlists e Mídias**

```
totems (1) ──→ (N) playlists
campaigns (1) ──→ (N) playlists
playlists (1) ──→ (N) playlist_items
playlist_items (N) ──→ (1) medias
```

### **5. Analytics e Monitoramento**

```
totems (1) ──→ (N) analytics_sessions
analytics_sessions (1) ──→ (N) analytics_emotions
analytics_sessions (1) ──→ (N) analytics_gestures
qr_codes (1) ──→ (N) analytics_qr_scans
totems (1) ──→ (N) analytics_qr_scans
```

### **6. Execução e Logs**

```
totems (1) ──→ (N) execution_logs
clients (1) ──→ (N) execution_logs
campaigns (1) ──→ (N) execution_logs
medias (1) ──→ (N) execution_logs
totems (1) ──→ (N) remote_commands
users (1) ──→ (N) remote_commands
```

### **7. ML e AI**

```
totems (1) ──→ (1) totem_ml_config
totems (1) ──→ (N) emotion_data
totems (1) ──→ (N) gesture_data
totems (1) ──→ (N) behavior_data
ml_sessions (N) ──→ (1) totems
```

### **8. RBAC e Auditoria**

```
users (N) ──→ (M) roles (via user_roles)
roles (N) ──→ (M) permissions (via role_permissions)
users (1) ──→ (N) audit_logs
```

### **9. Exportação (Novo)**

```
users (1) ──→ (N) export_queries
users (1) ──→ (N) export_schedules
export_queries (1) ──→ (N) export_schedules
export_schedules (1) ──→ (N) export_executions
export_queries (1) ──→ (N) export_executions
```

---

## 🎯 **Funcionalidades de Negócio Identificadas**

### **A. Gestão de Totems e Localização**

#### **A1. Lista de Totems com Localização Completa**
- **Objetivo**: Visualizar totems com informações de local, host e cliente
- **Relacionamentos**: 
  - totems → locals → hosts
  - totems → clients (via campaigns → clients?)

#### **A2. Totems por Host/Local**
- **Objetivo**: Filtrar totems por localização
- **Relacionamentos**: hosts → locals → totems

#### **A3. Status de Totems (Online/Offline)**
- **Objetivo**: Monitorar status e última atividade
- **Relacionamentos**: totems (último heartbeat)

---

### **B. Gestão de Campanhas**

#### **B1. Campanhas com Detalhes do Cliente**
- **Objetivo**: Listar campanhas com informações do cliente
- **Relacionamentos**: campaigns → clients

#### **B2. Campanhas Ativas por Totem**
- **Objetivo**: Ver quais campanhas estão ativas em cada totem
- **Relacionamentos**: campaigns → campaign_totems → totems

#### **B3. Campanhas com Playlists e Mídias**
- **Objetivo**: Visualizar estrutura completa de campanha
- **Relacionamentos**: 
  - campaigns → campaign_playlists → playlists
  - playlists → playlist_items → medias

#### **B4. Campanhas com Totens e Locais**
- **Objetivo**: Ver distribuição geográfica das campanhas
- **Relacionamentos**: 
  - campaigns → campaign_totems → totems → locals → hosts

---

### **C. Gestão de Mídias**

#### **C1. Mídias por Cliente**
- **Objetivo**: Listar mídias do cliente
- **Relacionamentos**: medias → clients

#### **C2. Mídias com Criador**
- **Objetivo**: Ver quem criou cada mídia
- **Relacionamentos**: medias → users (created_by)

#### **C3. Mídias em Playlists**
- **Objetivo**: Ver em quais playlists cada mídia está
- **Relacionamentos**: medias → playlist_items → playlists

#### **C4. Mídias por Status de Aprovação**
- **Objetivo**: Filtrar mídias por workflow de aprovação
- **Relacionamentos**: medias → approval_workflows → users (reviewed_by)

---

### **D. Analytics e Relatórios**

#### **D1. Sessões de Analytics por Totem**
- **Objetivo**: Analisar interações por totem
- **Relacionamentos**: 
  - analytics_sessions → totems → locals → hosts

#### **D2. Emoções Detectadas com Demografia**
- **Objetivo**: Análise de emoções por perfil demográfico
- **Relacionamentos**: 
  - analytics_emotions → analytics_sessions → totems
  - emotion_data → totems

#### **D3. Gestos e Ações**
- **Objetivo**: Analisar gestos detectados e ações disparadas
- **Relacionamentos**: 
  - analytics_gestures → analytics_sessions → totems
  - gesture_data → totems

#### **D4. Scans de QR Codes**
- **Objetivo**: Analisar performance de QR codes
- **Relacionamentos**: 
  - analytics_qr_scans → qr_codes → campaigns
  - analytics_qr_scans → totems → locals

#### **D5. Métricas Agregadas**
- **Objetivo**: Visualizar métricas consolidadas
- **Relacionamentos**: 
  - aggregated_metrics → totems
  - aggregated_metrics → campaigns
  - aggregated_metrics → medias

---

### **E. Execução e Monitoramento**

#### **E1. Logs de Execução Completo**
- **Objetivo**: Ver histórico de execuções com contexto
- **Relacionamentos**: 
  - execution_logs → totems → locals
  - execution_logs → clients
  - execution_logs → campaigns
  - execution_logs → medias

#### **E2. Comandos Remotos por Totem**
- **Objetivo**: Monitorar comandos enviados
- **Relacionamentos**: 
  - remote_commands → totems
  - remote_commands → users (created_by)

#### **E3. Performance de Playlists**
- **Objetivo**: Analisar execução de playlists
- **Relacionamentos**: 
  - execution_logs → playlists (via campaign → playlist)
  - execution_logs → medias

---

### **F. ML e AI**

#### **F1. Configuração ML por Totem**
- **Objetivo**: Ver configurações de ML de cada totem
- **Relacionamentos**: totem_ml_config → totems

#### **F2. Dados de Emoção com Contexto**
- **Objetivo**: Analisar emoções com informações do totem
- **Relacionamentos**: 
  - emotion_data → totems → locals

#### **F3. Sessões ML Completas**
- **Objetivo**: Ver sessões ML com dados agregados
- **Relacionamentos**: 
  - ml_sessions → totems
  - ml_sessions → emotion_data (via session_id)
  - ml_sessions → gesture_data (via session_id)

---

### **G. RBAC e Auditoria**

#### **G1. Usuários com Roles e Permissões**
- **Objetivo**: Ver permissões completas de usuários
- **Relacionamentos**: 
  - users → user_roles → roles
  - roles → role_permissions → permissions

#### **G2. Logs de Auditoria com Usuário**
- **Objetivo**: Ver histórico de ações com contexto
- **Relacionamentos**: audit_logs → users

---

### **H. Exportação (Novo Sistema)**

#### **H1. Queries com Criador**
- **Objetivo**: Ver quem criou cada query
- **Relacionamentos**: export_queries → users (created_by)

#### **H2. Agendamentos com Query e Criador**
- **Objetivo**: Ver agendamentos completos
- **Relacionamentos**: 
  - export_schedules → export_queries
  - export_schedules → users (created_by)

#### **H3. Execuções com Detalhes**
- **Objetivo**: Ver histórico completo de execuções
- **Relacionamentos**: 
  - export_executions → export_schedules
  - export_executions → export_queries

---

## 💡 **Proposta de Queries SELECT com JOINs**

### **Aguardando Debates sobre:**

1. **Quais funcionalidades são prioritárias?**
2. **Quais queries serão mais usadas?**
3. **Precisamos de queries agregadas ou apenas detalhadas?**
4. **Quais filtros são essenciais?**
5. **Precisamos de paginação/ordenação?**
6. **Queries devem ser otimizadas para performance?**

---

## 📝 **Próximos Passos**

1. **Debater prioridades** - Quais funcionalidades são mais importantes?
2. **Definir queries base** - Quais serão as queries fundamentais?
3. **Definir estrutura** - Como organizar as queries (por módulo/funcionalidade)?
4. **Implementar** - Criar queries e adicionar ao sistema de exportação

---

**Aguardando feedback para prosseguir com a implementação!**

