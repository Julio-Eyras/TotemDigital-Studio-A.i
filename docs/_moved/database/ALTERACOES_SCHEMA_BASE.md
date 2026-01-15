# 📊 Alterações no Schema Base do Banco de Dados

## 🎯 Resumo das Mudanças

### ✅ Alterações Implementadas no Schema Base

**Arquivo**: `database/smartchannel-db-v2-refactored-part2-tables-base.sql`

1. **Adicionada coluna `subscriber_id` na tabela `users`**
   - Tipo: `INTEGER`
   - Nullable: `YES` (pode ser NULL)
   - Foreign Key para `subscribers(subscriber_id)`
   - Comentário: "FK para subscriber (NULL se for tenant user ou publisher)"

2. **Ajustada constraint `chk_users_tenant_logic`**
   - Antes: validava apenas `publisher_id`
   - Agora: valida que tenant users não têm `publisher_id` nem `subscriber_id`
   - Permite que não-tenant users tenham `publisher_id` OU `subscriber_id` (ou ambos)

3. **Adicionadas Foreign Keys**
   - `fk_users_publisher`: referencia `publishers(publisher_id)`
   - `fk_users_subscriber`: referencia `subscribers(subscriber_id)`

**Arquivo**: `database/smartchannel-db-v2-refactored-part8-indexes.sql`

4. **Adicionado índice para `subscriber_id`**
   - `idx_users_subscriber`: índice parcial para `subscriber_id` onde não é NULL

## 📋 Estrutura Final da Tabela `users`

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- Relacionamentos
    publisher_id INTEGER,      -- FK para publishers
    subscriber_id INTEGER,      -- FK para subscribers [NOVO]
    
    -- Tipo e tenant
    user_type TEXT NOT NULL DEFAULT 'publisher_user',
        -- 'system_user', 'subscriber_user', 'publisher_user', 'publisher_subscriber'
    is_tenant_user BOOLEAN DEFAULT false,
    
    -- Dados do usuário
    role TEXT,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_users_user_type 
        CHECK (user_type IN ('system_user', 'subscriber_user', 'publisher_user', 'publisher_subscriber')),
    CONSTRAINT chk_users_tenant_logic 
        CHECK (
            (is_tenant_user = true AND publisher_id IS NULL AND subscriber_id IS NULL) OR
            (is_tenant_user = false)
        ),
    
    -- Foreign Keys
    CONSTRAINT fk_users_publisher 
        FOREIGN KEY (publisher_id) 
        REFERENCES publishers(publisher_id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_users_subscriber 
        FOREIGN KEY (subscriber_id) 
        REFERENCES subscribers(subscriber_id) 
        ON DELETE SET NULL
);
```

## ✅ Índices Criados

**Arquivo**: `database/smartchannel-db-v2-refactored-part8-indexes.sql`

```sql
CREATE INDEX IF NOT EXISTS idx_users_publisher ON users(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscriber ON users(subscriber_id) WHERE subscriber_id IS NOT NULL; -- NOVO
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(is_tenant_user) WHERE is_tenant_user = true;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
```

## 🔄 Como Aplicar

Como o sistema está sendo criado do zero, essas alterações já estão nos arquivos do schema base. Ao executar os scripts SQL na ordem correta, o banco será criado com essas estruturas:

1. Execute `database/smartchannel-db-v2-refactored-part2-tables-base.sql` (tabelas base)
2. Execute `database/smartchannel-db-v2-refactored-part8-indexes.sql` (índices)

## ⚠️ Importante

- ✅ Não há migrações necessárias - alterações estão no schema base
- ✅ Sistema está sendo criado do zero
- ✅ Todas as alterações estão nos arquivos SQL principais
- ✅ Compatível com a lógica implementada no backend

## 📝 Notas

- A coluna `subscriber_id` é opcional (pode ser NULL)
- A constraint permite que um usuário tenha `publisher_id` OU `subscriber_id` (ou ambos para `publisher_subscriber`)
- Tenant users (`is_tenant_user = true`) não podem ter `publisher_id` nem `subscriber_id`
- Foreign keys com `ON DELETE SET NULL` para manter integridade referencial
