# Guia de Aplicação da Migration 002

## 📋 Visão Geral

Este guia descreve como aplicar a migration 002 que adiciona:
- Sistema de flags de permissão (Flag_smart_0 a Flag_smart_9)
- Novas roles: `owner_system`, `operador_tecnico`, `operador_faturamento`, `operador_comercial`
- Tabelas: `user_flags`, `role_flags_default`

---

## 🚀 Método 1: Script Automatizado (Recomendado)

### Passo 1: Executar Script

```bash
cd /caminho/para/SmartSignage-Pro
./scripts/apply-migration-002.sh
```

O script irá:
- Verificar dependências
- Carregar variáveis de ambiente
- Aplicar a migration
- Verificar se tudo foi criado corretamente

### Passo 2: Verificar Resultado

O script mostrará um resumo do que foi criado. Verifique se:
- ✅ Tabelas `user_flags` e `role_flags_default` foram criadas
- ✅ 4 novas roles foram criadas
- ✅ Flags padrão foram configuradas para pelo menos 8 roles

---

## 🔧 Método 2: Manual (PostgreSQL)

### Passo 1: Conectar ao Banco

```bash
psql -U smartsignage -d smartsignage -h localhost
```

### Passo 2: Aplicar Migration

```sql
\i database/migrations/002-add-flags-and-operator-roles.sql
```

Ou copie e cole o conteúdo do arquivo diretamente no psql.

### Passo 3: Verificar

```sql
-- Verificar tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('user_flags', 'role_flags_default');

-- Verificar roles
SELECT name, description 
FROM roles 
WHERE name IN ('owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial');

-- Verificar flags padrão
SELECT role, 
       flag_smart_0, flag_smart_1, flag_smart_2, 
       flag_smart_3, flag_smart_4, flag_smart_5,
       flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
FROM role_flags_default
ORDER BY role;
```

---

## ✅ Verificação Pós-Migration

### 1. Verificar Tabelas

```sql
-- Estrutura da tabela user_flags
\d user_flags

-- Estrutura da tabela role_flags_default
\d role_flags_default
```

### 2. Verificar Roles

```sql
SELECT * FROM roles 
WHERE name IN ('owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial')
ORDER BY name;
```

### 3. Verificar Flags Padrão

```sql
-- Ver todas as flags padrão
SELECT * FROM role_flags_default ORDER BY role;

-- Ver flags de uma role específica
SELECT * FROM role_flags_default WHERE role = 'owner_system';
```

### 4. Testar Função

```sql
-- Testar função get_user_effective_flags
SELECT * FROM get_user_effective_flags(1);
```

---

## 👤 Criar Usuário Owner System

Após aplicar a migration, você pode criar um usuário owner_system:

```sql
-- 1. Criar usuário (ajuste os valores)
INSERT INTO users (
    username, 
    email, 
    password_hash, 
    role, 
    user_type, 
    is_tenant_user,
    is_active
) VALUES (
    'owner',
    'owner@sistema.com',
    '$2b$12$...', -- Hash da senha (use bcrypt)
    'owner_system',
    'system_user',
    true,
    true
);

-- 2. Verificar flags (owner_system tem todas)
SELECT * FROM get_user_effective_flags(
    (SELECT id FROM users WHERE username = 'owner')
);
```

**Nota:** Use o backend para criar usuários com hash de senha correto.

---

## 🔄 Rollback (Se Necessário)

Se precisar reverter a migration:

```sql
BEGIN;

-- Remover função
DROP FUNCTION IF EXISTS get_user_effective_flags(INTEGER);

-- Remover tabelas
DROP TABLE IF EXISTS user_flags CASCADE;
DROP TABLE IF EXISTS role_flags_default CASCADE;

-- Remover roles (opcional - apenas se não houver usuários usando)
DELETE FROM roles 
WHERE name IN ('owner_system', 'operador_tecnico', 'operador_faturamento', 'operador_comercial');

COMMIT;
```

---

## 🧪 Testes Pós-Migration

### 1. Testar Backend

```bash
# Reiniciar backend
cd backend
npm run build
npm start

# Verificar logs para erros
tail -f logs/app.log
```

### 2. Testar API

```bash
# Fazer login e verificar se flags são carregadas
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Verificar resposta - deve incluir flags no user object
```

### 3. Testar Frontend

1. Fazer login
2. Verificar no console do navegador se `user.flags` está presente
3. Testar acesso a rotas protegidas por flags

---

## 📝 Checklist

- [ ] Migration aplicada com sucesso
- [ ] Tabelas criadas (`user_flags`, `role_flags_default`)
- [ ] Roles criadas (4 novas roles)
- [ ] Flags padrão configuradas (8+ roles)
- [ ] Função `get_user_effective_flags` criada
- [ ] Backend reiniciado
- [ ] Testes realizados
- [ ] Usuário owner_system criado (se necessário)

---

## 🆘 Troubleshooting

### Erro: "relation already exists"

A migration já foi aplicada. Para reaplicar, primeiro faça rollback.

### Erro: "permission denied"

Verifique se o usuário do banco tem permissões para criar tabelas e funções.

### Erro: "role already exists"

As roles já existem. Isso é normal se a migration foi aplicada parcialmente antes.

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
