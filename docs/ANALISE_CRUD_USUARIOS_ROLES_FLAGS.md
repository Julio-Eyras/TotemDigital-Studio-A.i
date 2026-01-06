# 📋 Análise CRUD de Usuários - Roles e Flags

## 🔍 Situação Atual

### Backend (`backend/src/routes/users.ts`)

**Problemas identificados**:
1. ❌ Validação de roles limitada - não inclui novas roles (`owner_system`, `operador_tecnico`, `operador_faturamento`, `operador_comercial`, `publisher_user`, `subscriber_user`, `publisher_subscriber`)
2. ❌ Não suporta criação/edição de flags (`flag_smart_0` a `flag_smart_9`)
3. ❌ Não suporta `userType` na criação/edição
4. ❌ Não suporta `publisherId`/`subscriberId` na criação/edição
5. ❌ Ainda usa `clientId` (deprecated)
6. ❌ `authorizeRole` não inclui `owner_system` em todas as rotas

**Rotas existentes**:
- `GET /api/users` - Listar (apenas `admin`, `admin_sql`)
- `GET /api/users/:id` - Obter (apenas `admin`, `admin_sql`)
- `POST /api/users` - Criar (apenas `admin`, `admin_sql`)
- `PUT /api/users/:id` - Atualizar (apenas `admin`, `admin_sql`)
- `DELETE /api/users/:id` - Excluir (apenas `admin`, `admin_sql`)
- `GET /api/users/:id/roles` - Listar roles
- `POST /api/users/:id/roles` - Definir roles (apenas `admin_sql`)
- `POST /api/users/:id/roles/:roleId` - Adicionar role (apenas `admin_sql`)
- `DELETE /api/users/:id/roles/:roleId` - Remover role (apenas `admin_sql`)

### Frontend

**Necessidades**:
- Formulário de criação/edição com suporte para:
  - Novas roles
  - Flags (`flag_smart_0` a `flag_smart_9`)
  - `userType` (`system_user`, `subscriber_user`, `publisher_user`, `publisher_subscriber`)
  - `publisherId`/`subscriberId`
- Interface para gerenciar flags do usuário
- Visualização de flags ativas

## ✅ Correções Necessárias

### 1. Atualizar Validações de Roles

**Arquivo**: `backend/src/routes/users.ts`

```typescript
// ANTES
body('role').isIn(['admin', 'gerente_marketing', 'editoracao', 'visualizador', 'user', 'client'])

// DEPOIS
body('role').isIn([
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
])
```

### 2. Adicionar Suporte para Flags

**Novas rotas necessárias**:
- `GET /api/users/:id/flags` - Obter flags do usuário
- `PUT /api/users/:id/flags` - Atualizar flags do usuário
- `POST /api/users/:id/flags/:flagName` - Ativar flag específica
- `DELETE /api/users/:id/flags/:flagName` - Desativar flag específica

### 3. Atualizar `authorizeRole` para incluir `owner_system`

**Arquivo**: `backend/src/routes/users.ts`

```typescript
// ANTES
authorizeRole(['admin', 'admin_sql'])

// DEPOIS
authorizeRole(['admin', 'admin_sql', 'owner_system'])
```

### 4. Adicionar Campos no CreateUserRequest/UpdateUserRequest

**Arquivo**: `backend/src/services/userService.ts`

```typescript
export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  name: string;
  role: string;
  publisherId?: number; // NOVO
  subscriberId?: number; // NOVO
  userType?: 'system_user' | 'subscriber_user' | 'publisher_user' | 'publisher_subscriber'; // NOVO
  isTenantUser?: boolean; // NOVO
  flags?: { // NOVO
    flag_smart_0?: boolean;
    flag_smart_1?: boolean;
    // ... até flag_smart_9
  };
  clientId?: number; // DEPRECADO
}
```

### 5. Garantir Acesso Total para `owner_system` e `admin_sql`

**Verificar em todas as rotas**:
- `owner_system` e `admin_sql` devem ter acesso total (bypass de flags e permissões)
- Adicionar verificação no início de cada rota:
  ```typescript
  if (req.user.role === 'owner_system' || req.user.role === 'admin_sql') {
    // Acesso total - pular verificações
  }
  ```

## 📝 Checklist de Implementação

### Backend
- [ ] Atualizar validações de roles em `users.ts`
- [ ] Adicionar `owner_system` em todas as rotas de `authorizeRole`
- [ ] Criar rotas para gerenciar flags (`/api/users/:id/flags`)
- [ ] Atualizar `CreateUserRequest` e `UpdateUserRequest` para incluir flags e userType
- [ ] Atualizar `createUser` e `updateUser` para salvar flags
- [ ] Garantir que `owner_system` e `admin_sql` têm acesso total

### Frontend
- [ ] Atualizar formulário de criação/edição de usuários
- [ ] Adicionar seção de flags no formulário
- [ ] Adicionar seletor de `userType`
- [ ] Adicionar seletor de `publisherId`/`subscriberId`
- [ ] Atualizar lista de roles disponíveis
- [ ] Criar interface para visualizar flags ativas

## 🎯 Próximos Passos

1. **Imediato**: Atualizar validações e incluir `owner_system` em todas as rotas
2. **Curto prazo**: Implementar rotas de flags
3. **Médio prazo**: Atualizar frontend com novos campos
4. **Longo prazo**: Criar interface visual para gerenciamento de flags
