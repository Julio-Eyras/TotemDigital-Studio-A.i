# SmartSignage Pro - Schema Refatorado v2.0

## 📋 Visão Geral

Este conjunto de scripts SQL recria o banco de dados do SmartSignage Pro do zero, incorporando todas as renomeações e melhorias aprovadas:

- **`clients` → `subscribers`** (Anunciantes/Assinantes)
- **`hosts` → `publishers`** (Publicadores/Clientes do Sistema)
- **Tabelas de billing separadas** (`subscriber_billing`, `publisher_billing`)
- **Tabelas de contratos** (`subscriber_contracts`, `publisher_contracts`)
- **Triggers automáticos** para `updated_at`
- **Índices otimizados** (incluindo parciais e compostos)
- **Views e Materialized Views** para consultas frequentes
- **Validações JSONB** e constraints de negócio

## 📁 Estrutura dos Scripts

### Scripts Principais (Executar nesta ordem)

1. **`part1-schema-setup.sql`**
   - Cria schema `public`
   - Tabela de versionamento (`schema_version`)

2. **`part2-tables-base.sql`**
   - Tabelas base sem FKs externas:
     - `subscribers` (antes: `clients`)
     - `publishers` (antes: `hosts`)
     - `users`, `roles`, `permissions`, `plans`
     - `system_settings`, `ai_models`, etc.

3. **`part3-tables-dependent.sql`**
   - Tabelas que dependem das base:
     - `locals`, `totems`, `smart_tvs`
     - `campaigns`, `medias`, `playlists`, `playlist_items`

4. **`part4-billing-contracts.sql`**
   - `subscriber_billing` (billing de anunciantes)
   - `publisher_billing` (billing de publishers - revenue share/subscription)
   - `subscriber_contracts`, `publisher_contracts`

5. **`part5-tables-relationships.sql`**
   - Tabelas de relacionamento N:N:
     - `subscriptions`, `user_roles`, `role_permissions`
     - `campaign_playlists`, `campaign_totems`, `campaign_publishers`, `campaign_locals`
     - `playlist_approvals`

6. **`part6-tables-other.sql`**
   - Outras tabelas:
     - Analytics (`analytics_sessions`, `analytics_emotions`, etc.)
     - Logs (`execution_logs`, `event_logs`, `audit_logs`)
     - ML/AI (`totem_ml_config`, `emotion_data`, etc.)
     - Controle remoto (`remote_commands`)
     - OTA (`ota_updates`, `totem_update_status`)
     - SmartDisplayFX (`fx_effects`, `fx_rules`, etc.)
     - Relatórios, QR codes, etc.

7. **`part7-foreign-keys.sql`**
   - Todas as Foreign Keys em ordem correta

8. **`part8-indexes.sql`**
   - Índices simples, compostos e parciais
   - Otimizados para queries frequentes

9. **`part9-triggers-functions.sql`**
   - Funções SQL úteis
   - Triggers para `updated_at` automático
   - Validações JSONB
   - Derivação automática de IDs relacionados

10. **`part10-views.sql`**
    - Views simples
    - Materialized Views para performance

### Script Master

**`apply-all.sql`** - Executa todos os scripts na ordem correta

## 🚀 Como Usar

### Opção 1: Usando o Script Master (Recomendado)

```bash
psql -U postgres -d smartchannel_db -f database/smartchannel-db-v2-refactored-apply-all.sql
```

### Opção 2: Executando Manualmente

```bash
# 1. Conectar ao banco
psql -U postgres -d smartchannel_db

# 2. Executar cada parte na ordem
\i database/smartchannel-db-v2-refactored-part1-schema-setup.sql
\i database/smartchannel-db-v2-refactored-part2-tables-base.sql
\i database/smartchannel-db-v2-refactored-part3-tables-dependent.sql
\i database/smartchannel-db-v2-refactored-part4-billing-contracts.sql
\i database/smartchannel-db-v2-refactored-part5-tables-relationships.sql
\i database/smartchannel-db-v2-refactored-part6-tables-other.sql
\i database/smartchannel-db-v2-refactored-part7-foreign-keys.sql
\i database/smartchannel-db-v2-refactored-part8-indexes.sql
\i database/smartchannel-db-v2-refactored-part9-triggers-functions.sql
\i database/smartchannel-db-v2-refactored-part10-views.sql
```

## ⚠️ IMPORTANTE

### ⚠️ Banco de Dados do Zero

Este script **recria o banco do zero**. Não há migração de dados legado.

**Se você precisa preservar dados existentes, faça backup antes!**

```bash
# Backup do banco atual
pg_dump -U postgres smartchannel_db > backup_antes_v2.sql

# Criar novo banco vazio
createdb -U postgres smartchannel_db_v2

# Aplicar scripts
psql -U postgres -d smartchannel_db_v2 -f database/smartchannel-db-v2-refactored-apply-all.sql
```

### Atualização de Materialized Views

As Materialized Views precisam ser atualizadas periodicamente:

```sql
REFRESH MATERIALIZED VIEW mv_publisher_revenue_share_consolidated;
REFRESH MATERIALIZED VIEW mv_totem_executions_last_24h;
```

Recomenda-se criar um job (cron ou pg_cron) para atualizar essas views.

## 🔍 Validação

Após aplicar os scripts, você pode validar a instalação:

```sql
-- Verificar número de tabelas
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- Verificar Foreign Keys
SELECT COUNT(*) as total_fks
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'FOREIGN KEY';

-- Verificar triggers
SELECT COUNT(*) as total_triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Verificar índices
SELECT COUNT(*) as total_indices
FROM pg_indexes
WHERE schemaname = 'public';
```

## 📊 Estrutura do Schema

### Principais Entidades

```
subscribers (Anunciantes)
  ├── campaigns
  ├── medias
  └── subscriber_billing

publishers (Publicadores)
  ├── locals
  │   └── totems
  │       └── smart_tvs
  ├── users
  ├── subscriptions
  └── publisher_billing

campaigns (N:M)
  ├── campaign_totems
  ├── campaign_publishers
  ├── campaign_locals
  └── campaign_playlists
```

### Fluxo de Billing

```
subscriber (anunciante) → paga → TENANT (plataforma)
                             ↓
                    revenue_share → publisher (publicador)
```

## 🔧 Melhorias Implementadas

1. ✅ Renomeações (`clients` → `subscribers`, `hosts` → `publishers`)
2. ✅ Billing separado (subscriber_billing, publisher_billing)
3. ✅ Contratos (subscriber_contracts, publisher_contracts)
4. ✅ Triggers automáticos para `updated_at`
5. ✅ Validações JSONB
6. ✅ Índices parciais para performance
7. ✅ Views e Materialized Views
8. ✅ Constraints de negócio (CHECK)
9. ✅ Derivação automática de IDs relacionados
10. ✅ Workflow de aprovação de playlists

## 📝 Notas de Migração

### Código Backend/Frontend

Após aplicar o schema, você precisará atualizar:

1. **Backend:**
   - Todas as referências a `clients` → `subscribers`
   - Todas as referências a `hosts` → `publishers`
   - Queries de billing (agora são 2 tabelas)
   - Queries de contratos (novas tabelas)

2. **Frontend:**
   - APIs que usam `client_id` → `subscriber_id`
   - APIs que usam `host_id` → `publisher_id`
   - Componentes de billing
   - Componentes de contratos

## 📚 Documentação Relacionada

- `docs/PLANO_ACAO_RENOMENACOES_METICULOSO.md` - Plano detalhado de implementação
- `docs/SUGESTOES_MELHORIAS_PLANO.md` - Melhorias aprovadas
- `docs/ANALISE_COMPLETA_MODELO_ER.md` - Análise completa do modelo ER
- `docs/ANALISE_BILLING_MODELO_NEGOCIO.md` - Modelo de billing detalhado

## 🆘 Troubleshooting

### Erro: "relation already exists"

Se você tentar executar novamente, pode haver conflitos. Use:

```sql
-- Dropar schema completamente (CUIDADO!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

### Erro: "foreign key constraint fails"

Verifique se executou os scripts na ordem correta (especialmente as FKs após as tabelas).

### Materialized View desatualizada

Lembre-se de atualizar periodicamente:

```sql
REFRESH MATERIALIZED VIEW nome_da_view;
```

## 📧 Suporte

Para questões ou problemas, consulte a documentação completa em `docs/`.

