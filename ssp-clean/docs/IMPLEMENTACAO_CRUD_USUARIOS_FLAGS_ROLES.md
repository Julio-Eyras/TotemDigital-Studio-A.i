# ✅ Implementação CRUD de Usuários - Flags e Roles

## 🎯 Objetivo

Adicionar suporte completo para flags (`flag_smart_0` a `flag_smart_9`) e novas roles no CRUD de usuários, garantindo que `owner_system` e `admin_sql` tenham acesso total.

## ✅ Mudanças Implementadas

### 1. **Validações Atualizadas** ✅

**Arquivo**: `backend/src/routes/users.ts`

**Mudanças**:
- ✅ Criadas constantes `VALID_ROLES`, `VALID_USER_TYPES`, `VALID_FLAGS`
- ✅ Atualizado `createUserValidator` para incluir todas as novas roles:
  - `owner_system`, `admin_sql`, `operador_tecnico`, `operador_faturamento`, `operador_comercial`
  - `publisher_user`, `subscriber_user`, `publisher_subscriber`
- ✅ Adicionada validação para `userType`, `publisherId`, `subscriberId`, `isTenantUser`, `flags`
- ✅ Atualizado `GET /api/users` para aceitar filtros por `userType`, `publisherId`, `subscriberId`
- ✅ Atualizado `PUT /api/users/:id` para aceitar todos os novos campos

**Roles válidas agora**:
```typescript
const VALID_ROLES = [
  'owner_system',
  'admin_sql',
  'admin',
  'operador_tecnico',
  'operador_faturamento',
  'operador_comercial',
  'gerente_marketing',
  'editoracao',
  'visualizador',
  'user',
  'client',
  'publisher_user',
  'subscriber_user',
  'publisher_subscriber'
];
```

### 2. **Acesso Total para `owner_system`** ✅

**Arquivo**: `backend/src/routes/users.ts`

**Mudanças**:
- ✅ Todas as rotas agora incluem `owner_system` em `authorizeRole`:
  - `GET /api/users` - `authorizeRole(['admin', 'admin_sql', 'owner_system'])`
  - `GET /api/users/:id` - `authorizeRole(['admin', 'admin_sql', 'owner_system'])`
  - `POST /api/users` - `authorizeRole(['admin', 'admin_sql', 'owner_system'])`
  - `PUT /api/users/:id` - `authorizeRole(['admin', 'admin_sql', 'owner_system'])`
  - `DELETE /api/users/:id` - `authorizeRole(['admin', 'admin_sql', 'owner_system'])`
  - `GET /api/users/:id/roles` - `authorizeRole(['admin', 'admin_sql', 'owner_system'])`
  - `POST /api/users/:id/roles` - `authorizeRole(['admin_sql', 'owner_system'])`
  - `POST /api/users/:id/roles/:roleId` - `authorizeRole(['admin_sql', 'owner_system'])`
  - `DELETE /api/users/:id/roles/:roleId` - `authorizeRole(['admin_sql', 'owner_system'])`

### 3. **Interfaces Atualizadas** ✅

**Arquivo**: `backend/src/services/userService.ts`

**Mudanças**:
- ✅ Criada interface `UserFlags` com todas as 10 flags
- ✅ Atualizado `CreateUserRequest`:
  - Adicionado suporte para todas as novas roles
  - Adicionado `subscriberId`
  - Adicionado `publisher_subscriber` em `userType`
  - Adicionado `flags?: Partial<UserFlags>`
- ✅ Atualizado `UpdateUserRequest`:
  - Mesmas mudanças de `CreateUserRequest`
  - Adicionado `flags?: Partial<UserFlags>`

### 4. **Novas Rotas para Flags** ✅

**Arquivo**: `backend/src/routes/users.ts`

**Rotas criadas**:
- ✅ `GET /api/users/:id/flags` - Obter flags de um usuário
  - Acesso: `admin`, `admin_sql`, `owner_system`
- ✅ `PUT /api/users/:id/flags` - Atualizar flags de um usuário
  - Acesso: `admin_sql`, `owner_system`
- ✅ `POST /api/users/:id/flags/:flagName` - Ativar flag específica
  - Acesso: `admin_sql`, `owner_system`
- ✅ `DELETE /api/users/:id/flags/:flagName` - Desativar flag específica
  - Acesso: `admin_sql`, `owner_system`

### 5. **Métodos no UserService** ✅

**Arquivo**: `backend/src/services/userService.ts`

**Métodos criados**:
- ✅ `getUserFlags(userId: number): Promise<UserFlags>`
  - Busca flags do usuário (user_flags) ou usa flags padrão da role
  - Retorna flags combinadas (user_flags > role_flags_default > false)
- ✅ `updateUserFlags(userId: number, flags: Partial<UserFlags>, updatedBy: number): Promise<void>`
  - Atualiza ou cria registro de flags do usuário
  - Suporta atualização parcial (apenas flags fornecidas)
- ✅ `setUserFlag(userId: number, flagName: keyof UserFlags, value: boolean, updatedBy: number): Promise<void>`
  - Ativa/desativa flag específica
  - Wrapper para `updateUserFlags`

**Métodos atualizados**:
- ✅ `createUser()` - Agora salva flags se fornecidas
- ✅ `updateUser()` - Agora atualiza flags se fornecidas

## 📋 Estrutura de Flags

```typescript
export interface UserFlags {
  flag_smart_0: boolean; // Acesso técnico (totens, Smart TVs, players)
  flag_smart_1: boolean; // OTA Updates
  flag_smart_2: boolean; // Admin Tools
  flag_smart_3: boolean; // Faturamento
  flag_smart_4: boolean; // (Reservado)
  flag_smart_5: boolean; // (Reservado)
  flag_smart_6: boolean; // (Reservado)
  flag_smart_7: boolean; // (Reservado)
  flag_smart_8: boolean; // (Reservado)
  flag_smart_9: boolean; // (Reservado)
}
```

## 🔄 Fluxo de Flags

1. **Busca de Flags**:
   - Primeiro tenta buscar em `user_flags` (flags específicas do usuário)
   - Se não encontrar, usa `role_flags_default` (flags padrão da role)
   - Se não encontrar, retorna `false` (padrão)

2. **Atualização de Flags**:
   - Se usuário já tem flags, atualiza apenas as flags fornecidas
   - Se usuário não tem flags, cria novo registro com todas as flags
   - Flags não fornecidas mantêm valores existentes ou padrão

## 🧪 Exemplos de Uso

### Criar usuário com flags:
```json
POST /api/users
{
  "username": "operador1",
  "email": "operador@example.com",
  "password": "senha123",
  "name": "Operador Técnico",
  "role": "operador_tecnico",
  "userType": "system_user",
  "isTenantUser": true,
  "flags": {
    "flag_smart_0": true,
    "flag_smart_1": true,
    "flag_smart_2": false
  }
}
```

### Atualizar flags de um usuário:
```json
PUT /api/users/123/flags
{
  "flag_smart_0": true,
  "flag_smart_3": true
}
```

### Ativar flag específica:
```
POST /api/users/123/flags/flag_smart_0
```

### Desativar flag específica:
```
DELETE /api/users/123/flags/flag_smart_0
```

## ✅ Checklist de Validação

- [x] Validações de roles atualizadas
- [x] Validações de userType atualizadas
- [x] Validações de flags adicionadas
- [x] `owner_system` adicionado em todas as rotas
- [x] Interfaces `CreateUserRequest` e `UpdateUserRequest` atualizadas
- [x] Rotas de flags criadas
- [x] Métodos de flags implementados no UserService
- [x] `createUser` salva flags
- [x] `updateUser` atualiza flags
- [x] `getUserFlags` busca flags combinadas
- [x] `updateUserFlags` cria/atualiza flags
- [x] `setUserFlag` ativa/desativa flag específica

## 🎯 Próximos Passos

1. **Frontend**: Atualizar formulários de criação/edição de usuários
2. **Frontend**: Adicionar interface para gerenciar flags
3. **Testes**: Criar testes unitários para novos métodos
4. **Documentação**: Atualizar documentação da API
