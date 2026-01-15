# Documentação das Tabelas - SmartSignage Pro

## 📊 Visão Geral

Este documento descreve todas as tabelas do banco de dados, seus relacionamentos e propósitos.

## 🗂️ Índice por Módulo

### 1. Autenticação e Usuários
- [users](#users)
- [user_two_factor](#user_two_factor)
- [two_factor_attempts](#two_factor_attempts)
- [password_reset_tokens](#password_reset_tokens)
- [roles](#roles)
- [permissions](#permissions)
- [user_roles](#user_roles)
- [role_permissions](#role_permissions)

### 2. Clientes e Organização
- [clients](#clients)
- [hosts](#hosts)
- [locals](#locals)

### 3. Totens e Dispositivos
- [totems](#totems)
- [smart_tvs](#smart_tvs)
- [totem_network](#totem_network)
- [totem_update_status](#totem_update_status)
- [totem_ml_config](#totem_ml_config)

### 4. Campanhas e Conteúdo
- [campaigns](#campaigns)
- [medias](#medias)
- [playlists](#playlists)
- [playlist_items](#playlist_items)
- [smart_playlists](#smart_playlists)
- [campaign_playlists](#campaign_playlists)
- [campaign_totems](#campaign_totems)

### 5. Billing e Assinaturas
- [plans](#plans)
- [subscriptions](#subscriptions)
- [stripe_customers](#stripe_customers)
- [billing](#billing)
- [payments](#payments)

### 6. Analytics e Métricas
- [analytics_sessions](#analytics_sessions)
- [analytics_emotions](#analytics_emotions)
- [analytics_gestures](#analytics_gestures)
- [analytics_qr_scans](#analytics_qr_scans)
- [aggregated_metrics](#aggregated_metrics)

### 7. QR Codes e Links
- [qr_codes](#qr_codes)
- [short_links](#short_links)

### 8. Controle Remoto
- [remote_commands](#remote_commands)
- [remote_screenshots](#remote_screenshots)

### 9. OTA Updates
- [ota_updates](#ota_updates)
- [totem_update_status](#totem_update_status)

### 10. Features Interativas
- [tags](#tags)
- [recognized_persons](#recognized_persons)
- [interaction_logs](#interaction_logs)
- [totem_network](#totem_network)

### 11. Logs e Auditoria
- [event_logs](#event_logs)
- [execution_logs](#execution_logs)
- [system_logs](#system_logs)
- [audit_logs](#audit_logs)
- [alert_logs](#alert_logs)

### 12. IA e ML
- [ai_models](#ai_models)
- [ml_models](#ml_models)
- [emotion_data](#emotion_data)
- [gesture_data](#gesture_data)
- [behavior_data](#behavior_data)
- [ml_sessions](#ml_sessions)

### 13. Workflows e Aprovação
- [approval_workflows](#approval_workflows)

### 14. Webhooks e Alertas
- [webhook_configs](#webhook_configs)
- [webhook_deliveries](#webhook_deliveries)
- [alert_rules](#alert_rules)

### 15. Export e Relatórios
- [export_queries](#export_queries)
- [export_schedules](#export_schedules)
- [export_executions](#export_executions)
- [reports](#reports)
- [report_templates](#report_templates)

### 16. Agendamentos
- [advanced_schedules](#advanced_schedules)
- [schedule_executions](#schedule_executions)

### 17. Configurações
- [system_settings](#system_settings)
- [device_certificates](#device_certificates)

---

## 📋 Detalhamento das Tabelas

### users

**Descrição:** Usuários do sistema

**Colunas Principais:**
- `id` - ID único
- `username` - Nome de usuário (único)
- `email` - Email (único)
- `password_hash` - Hash da senha
- `role` - Papel (admin, manager, operator, viewer, client)
- `client_id` - Cliente associado
- `is_active` - Status ativo/inativo

**Relacionamentos:**
- `client_id` → `clients.client_id`
- Relacionado com: `user_two_factor`, `user_roles`, `audit_logs`

**Índices:**
- `idx_users_username` - Busca por username
- `idx_users_client_id` - Busca por cliente

---

### clients

**Descrição:** Clientes do sistema

**Colunas Principais:**
- `client_id` - ID único
- `name` - Nome do cliente
- `email` - Email (único)
- `contact_name` - Nome do contato
- `phone` - Telefone
- `is_active` - Status ativo/inativo

**Relacionamentos:**
- Relacionado com: `users`, `campaigns`, `medias`, `subscriptions`

**Índices:**
- `idx_campaigns_client_id` - Busca por cliente

---

### totems

**Descrição:** Totens/dispositivos de exibição

**Colunas Principais:**
- `totem_id` - ID único
- `identifier` - Identificador único
- `uin` - Unique Identifier Number
- `device_id` - ID do dispositivo
- `local_id` - Local associado
- `status` - Status (online, offline, error, maintenance)
- `last_heartbeat` - Último heartbeat
- `current_playlist_id` - Playlist atual

**Relacionamentos:**
- `local_id` → `locals.local_id`
- `client_id` → `clients.client_id`
- Relacionado com: `playlists`, `campaign_totems`, `remote_commands`, `execution_logs`

**Índices:**
- `idx_totems_identifier` - Busca por identificador
- `idx_totems_status` - Busca por status
- `idx_totems_last_heartbeat` - Monitoramento

---

### campaigns

**Descrição:** Campanhas de publicidade

**Colunas Principais:**
- `campaign_id` - ID único
- `client_id` - Cliente associado
- `title` - Título da campanha
- `campaign_type` - Tipo (general, scheduled)
- `status` - Status (draft, active, paused, finished)
- `start_date` - Data de início
- `end_date` - Data de fim

**Relacionamentos:**
- `client_id` → `clients.client_id`
- Relacionado com: `campaign_playlists`, `campaign_totems`, `playlists`

**Índices:**
- `idx_campaigns_client_id` - Busca por cliente
- `idx_campaigns_status` - Busca por status

---

### medias

**Descrição:** Arquivos de mídia (vídeos, imagens, áudios)

**Colunas Principais:**
- `media_id` - ID único
- `client_id` - Cliente associado
- `name` - Nome do arquivo
- `file_path` - Caminho do arquivo
- `media_type` - Tipo (image, video, audio)
- `duration_seconds` - Duração (para vídeo/áudio)
- `size_bytes` - Tamanho em bytes
- `status` - Status (draft, review, published, archived)

**Relacionamentos:**
- `client_id` → `clients.client_id`
- `created_by` → `users.id`
- Relacionado com: `playlist_items`, `execution_logs`, `tags`, `recognized_persons`

**Índices:**
- `idx_medias_client_id` - Busca por cliente
- `idx_medias_status` - Busca por status

---

### plans

**Descrição:** Planos de assinatura

**Colunas Principais:**
- `plan_id` - ID único
- `name` - Nome do plano
- `slug` - Slug único
- `price_monthly` - Preço mensal
- `price_yearly` - Preço anual
- `features` - Features do plano (JSONB)
- `limits` - Limites do plano (JSONB)
- `stripe_product_id` - ID do produto no Stripe

**Relacionamentos:**
- Relacionado com: `subscriptions`

**Índices:**
- `idx_plans_slug` - Busca por slug
- `idx_plans_is_active` - Busca por planos ativos

---

### subscriptions

**Descrição:** Assinaturas dos clientes

**Colunas Principais:**
- `subscription_id` - ID único
- `client_id` - Cliente associado
- `plan_id` - Plano associado
- `stripe_subscription_id` - ID da assinatura no Stripe
- `status` - Status (active, canceled, past_due, etc.)
- `current_period_start` - Início do período atual
- `current_period_end` - Fim do período atual

**Relacionamentos:**
- `client_id` → `clients.client_id`
- `plan_id` → `plans.plan_id`
- Relacionado com: `billing`

**Índices:**
- `idx_subscriptions_client_id` - Busca por cliente
- `idx_subscriptions_status` - Busca por status
- `idx_subscriptions_stripe_subscription_id` - Integração Stripe

---

### event_logs

**Descrição:** Logs de eventos importantes para BI

**Colunas Principais:**
- `id` - ID único
- `event_type` - Tipo do evento
- `entity_type` - Tipo da entidade
- `entity_id` - ID da entidade
- `totem_id` - Totem associado
- `campaign_id` - Campanha associada
- `metadata` - Dados adicionais (JSONB)
- `timestamp` - Data/hora do evento

**Relacionamentos:**
- `totem_id` → `totems.totem_id`
- `campaign_id` → `campaigns.campaign_id`
- `media_id` → `medias.media_id`

**Índices:**
- `idx_event_logs_event_type` - Busca por tipo
- `idx_event_logs_totem_id` - Busca por totem
- `idx_event_logs_timestamp` - Busca por data
- `idx_event_logs_bi` - Índice composto para BI

---

### tags

**Descrição:** Tags RFID/NFC/QR para interação

**Colunas Principais:**
- `id` - ID único
- `tag_id` - ID único da tag
- `tag_type` - Tipo (rfid, nfc, qr_code, barcode)
- `content_id` - Conteúdo associado
- `is_active` - Status ativo/inativo

**Relacionamentos:**
- `content_id` → `medias.media_id`
- Relacionado com: `interaction_logs`

**Índices:**
- `idx_tags_tag_id` - Busca por tag ID
- `idx_tags_tag_type` - Busca por tipo
- `idx_tags_content_id` - Busca por conteúdo

---

### recognized_persons

**Descrição:** Pessoas reconhecidas para personalização

**Colunas Principais:**
- `id` - ID único
- `person_id` - ID único da pessoa
- `name` - Nome (opcional)
- `features` - Características faciais (JSON)
- `content_id` - Conteúdo personalizado
- `is_active` - Status ativo/inativo

**Relacionamentos:**
- `content_id` → `medias.media_id`
- Relacionado com: `interaction_logs`

**Índices:**
- `idx_recognized_persons_person_id` - Busca por pessoa
- `idx_recognized_persons_content_id` - Busca por conteúdo

---

### interaction_logs

**Descrição:** Histórico de interações dos totens

**Colunas Principais:**
- `id` - ID único
- `totem_id` - Totem associado
- `interaction_type` - Tipo (facial_recognition, tag_id, touch, gesture)
- `interaction_data` - Dados da interação (JSONB)
- `content_id` - Conteúdo exibido
- `person_id` - ID da pessoa (se reconhecida)
- `tag_id` - ID da tag (se aplicável)
- `timestamp` - Data/hora da interação

**Relacionamentos:**
- `totem_id` → `totems.totem_id`
- `content_id` → `medias.media_id`

**Índices:**
- `idx_interaction_logs_totem_id` - Busca por totem
- `idx_interaction_logs_type` - Busca por tipo
- `idx_interaction_logs_timestamp` - Busca por data

---

### ota_updates

**Descrição:** Atualizações Over-The-Air para players

**Colunas Principais:**
- `id` - ID único
- `version` - Versão da atualização
- `platform` - Plataforma (webos, tizen, android, linux, windows, all)
- `file_path` - Caminho do arquivo
- `file_size` - Tamanho do arquivo
- `checksum` - SHA256 do arquivo
- `status` - Status (draft, testing, active, paused, completed)
- `rollout_percentage` - Porcentagem de rollout (0-100)

**Relacionamentos:**
- `created_by` → `users.id`
- Relacionado com: `totem_update_status`

**Índices:**
- `idx_ota_updates_platform` - Busca por plataforma
- `idx_ota_updates_status` - Busca por status
- `idx_ota_updates_version` - Busca por versão

---

## 🔗 Diagrama de Relacionamentos Principais

```
clients
  ├── users
  ├── campaigns
  │   ├── campaign_playlists
  │   ├── campaign_totems
  │   └── playlists
  ├── medias
  │   └── playlist_items
  ├── subscriptions
  │   └── plans
  └── billing
      └── payments

totems
  ├── playlists
  ├── remote_commands
  ├── remote_screenshots
  ├── execution_logs
  ├── analytics_sessions
  ├── totem_update_status
  ├── totem_network
  └── interaction_logs

tags ──┐
       ├── interaction_logs
recognized_persons ──┘
```

---

## 📝 Notas Importantes

1. **Foreign Keys:** Todas as foreign keys usam `ON DELETE CASCADE` ou `ON DELETE SET NULL` conforme apropriado
2. **Índices:** Criados para campos frequentemente consultados
3. **JSONB:** Usado para campos flexíveis (metadata, features, config)
4. **Timestamps:** Todas as tabelas têm `created_at` e muitas têm `updated_at`
5. **Soft Delete:** Muitas tabelas usam `is_active` para soft delete

---

## 🔄 Atualizações

Este documento deve ser atualizado sempre que:
- Novas tabelas forem adicionadas
- Relacionamentos forem modificados
- Índices forem criados/removidos
- Estruturas significativas forem alteradas

