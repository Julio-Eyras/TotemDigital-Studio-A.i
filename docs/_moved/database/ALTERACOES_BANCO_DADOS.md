# 📊 Alterações no Banco de Dados

## 🎯 Resumo das Mudanças

### ✅ Alterações Implementadas

1. **Adicionada coluna `subscriber_id` na tabela `users`**
   - Suporta roles de subscriber (`subscriber_user`)
   - Permite relacionamento com tabela `subscribers`

2. **Ajustada constraint `chk_users_tenant_logic`**
   - Agora permite `publisher_id` OU `subscriber_id` (ou ambos)
   - Valida que tenant users não têm nenhum dos dois

3. **Removida coluna `client_id` (se existir)**
   - Sistema não usa mais `client_id`
   - Usa apenas `publisher_id` e `subscriber_id`

## 📋 Scripts de Migração

### Migração 003: Adicionar subscriber_id

**Arquivo**: `database/migrations/003-add-subscriber-id-to-users.sql`

**O que faz**:
- ✅ Adiciona coluna `subscriber_id INTEGER` na tabela `users`
- ✅ Adiciona foreign key para `subscribers(subscriber_id)`
- ✅ Ajusta constraint `chk_users_tenant_logic`
- ✅ Cria índice para performance

**Como executar**:
```sql
\i database/migrations/003-add-subscriber-id-to-users.sql
```

Ou via psql:
```bash
psql -U postgres -d smartsignage_pro -f database/migrations/003-add-subscriber-id-to-users.sql
```

### Migração 004: Remover client_id

**Arquivo**: `database/migrations/004-remove-client-id-references.sql`

**O que faz**:
- ✅ Verifica se `client_id` existe
- ✅ Remove foreign key e índice relacionados
- ✅ Remove a coluna `client_id`

**Como executar**:
```sql
\i database/migrations/004-remove-client-id-references.sql
```

Ou via psql:
```bash
psql -U postgres -d smartsignage_pro -f database/migrations/004-remove-client-id-references.sql
```

## 🔄 Estrutura Atual da Tabela `users`

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    
    -- Relacionamentos
    publisher_id INTEGER,      -- FK para publishers (roles de publisher)
    subscriber_id INTEGER,      -- FK para subscribers (roles de subscriber) [NOVO]
    
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

## 🚀 Como Aplicar as Migrações

### Opção 1: Via psql (Recomendado)

```bash
# Conectar ao banco
psql -U postgres -d smartsignage_pro

# Executar migrações
\i database/migrations/003-add-subscriber-id-to-users.sql
\i database/migrations/004-remove-client-id-references.sql
```

### Opção 2: Via linha de comando

```bash
psql -U postgres -d smartsignage_pro -f database/migrations/003-add-subscriber-id-to-users.sql
psql -U postgres -d smartsignage_pro -f database/migrations/004-remove-client-id-references.sql
```

### Opção 3: Via pgAdmin ou DBeaver

1. Abra o arquivo `003-add-subscriber-id-to-users.sql`
2. Execute o script
3. Abra o arquivo `004-remove-client-id-references.sql`
4. Execute o script

## ✅ Verificação

Após executar as migrações, verifique:

```sql
-- Verificar se subscriber_id foi adicionado
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name IN ('publisher_id', 'subscriber_id', 'client_id')
ORDER BY column_name;

-- Verificar constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'users'
AND constraint_name LIKE '%tenant%' OR constraint_name LIKE '%subscriber%';

-- Verificar foreign keys
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'users'
AND tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name IN ('publisher_id', 'subscriber_id');
```

## ⚠️ Importante

1. **Backup**: Sempre faça backup antes de executar migrações
2. **Ordem**: Execute as migrações na ordem (003, depois 004)
3. **Testes**: Teste em ambiente de desenvolvimento primeiro
4. **Dados**: Se houver dados existentes, verifique se não há dependências

## 📝 Notas

- A coluna `subscriber_id` é opcional (pode ser NULL)
- A constraint permite que um usuário tenha `publisher_id` OU `subscriber_id` (ou ambos para `publisher_subscriber`)
- Tenant users (`is_tenant_user = true`) não podem ter `publisher_id` nem `subscriber_id`
- A coluna `client_id` será removida se existir (sistema não usa mais)
