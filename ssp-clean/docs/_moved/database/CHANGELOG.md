# Changelog - SmartChannel Database Schema

## v2.1 - 2025-01-XX

### ✅ Melhorias de Performance
- Adicionados índices compostos para queries frequentes
- Índices para ordenação e paginação (DESC)
- Otimizações em relacionamentos comuns

### ✅ Integrações Completas

#### 2FA/MFA Support
- Adicionada tabela `user_two_factor` para autenticação de dois fatores
- Adicionada tabela `two_factor_attempts` para auditoria
- Suporte a TOTP (Time-based One-Time Password)

#### Plans and Subscriptions
- Adicionada tabela `plans` para planos de assinatura
- Adicionada tabela `subscriptions` para assinaturas dos clientes
- Adicionada tabela `stripe_customers` para integração Stripe
- Modificada tabela `billing` com colunas Stripe:
  - `stripe_invoice_id`
  - `stripe_payment_intent_id`
  - `subscription_id`
- Planos padrão inseridos: Básico, Profissional, Enterprise

#### Remote Commands Enhancements
- Adicionada tabela `remote_screenshots` para screenshots remotos
- Modificada tabela `remote_commands` com colunas:
  - `sent_at`
  - `completed_at`
  - `error_message`
  - `updated_at`

#### OTA Updates System
- Adicionada tabela `ota_updates` para atualizações Over-The-Air
- Adicionada tabela `totem_update_status` para status de atualização
- Suporte a rollout gradual e múltiplas plataformas

#### Interactive Features
- Adicionada tabela `tags` para tags RFID/NFC/QR
- Adicionada tabela `recognized_persons` para reconhecimento facial
- Adicionada tabela `interaction_logs` para histórico de interações
- Adicionada tabela `totem_network` para rede de totens

### 📊 Estatísticas
- **Novas tabelas:** 12
- **Tabelas modificadas:** 1
- **Índices criados:** 30+
- **Planos padrão:** 3

---

## v2.0 - 2025-11-08

### Base Schema
- Tabelas principais: clients, users, hosts, locals, totems
- Sistema de campanhas e playlists
- Sistema de mídias e analytics
- RBAC e auditoria
- Export queries e schedules
- Reports system
- Event logs

---

## Como Adicionar Novas Entradas

Ao fazer alterações no `smartchannel-db-v2-refactored-apply-all.sql`, adicione uma entrada aqui:

```markdown
## v2.X - YYYY-MM-DD

### Nome da Feature
- Descrição das alterações
- Tabelas adicionadas/modificadas
- Índices criados
```

