# Implementação: Suporte a `publisher_subscriber` (Publisher que também anuncia)

**Data:** 2026-01-03  
**Status:** ✅ Implementado

---

## 🎯 OBJETIVO

Adicionar suporte ao tipo de usuário `publisher_subscriber` - um Publisher que também anuncia (é tanto Publisher quanto Subscriber).

---

## 📋 CONTEXTO

### Tipos de Usuário Existentes

1. **`system_user`** - Usuários do sistema (admins, operadores)
2. **`subscriber_user`** - Anunciantes/Assinantes que compram espaço publicitário
3. **`publisher_user`** - Publicadores que instalam totens e Smart TVs
4. **`publisher_subscriber`** - **NOVO**: Publisher que também anuncia (dupla função)

### Caso de Uso

Um Publisher pode também ser um Subscriber quando:
- Instala totens em seus locais (Publisher)
- E também anuncia em totens de outros Publishers (Subscriber)

---

## 🔧 IMPLEMENTAÇÃO

### 1. Schema do Banco de Dados

**Arquivo:** `database/smartchannel-db-v2-refactored-part2-tables-base.sql`

**Mudanças:**
```sql
-- ANTES
CONSTRAINT chk_users_user_type 
    CHECK (user_type IN ('system_user', 'subscriber_user', 'publisher_user')),

-- DEPOIS
CONSTRAINT chk_users_user_type 
    CHECK (user_type IN ('system_user', 'subscriber_user', 'publisher_user', 'publisher_subscriber')),

-- Comentário atualizado
COMMENT ON COLUMN users.user_type IS 'Tipo: system_user, subscriber_user, publisher_user, publisher_subscriber (Publisher que também anuncia)';
```

### 2. Backend

#### 2.1. Auth Middleware

**Arquivo:** `backend/src/middleware/auth.middleware.ts`

**Mudanças:**
```typescript
// ANTES
userType?: 'system_user' | 'subscriber_user' | 'publisher_user';

// DEPOIS
userType?: 'system_user' | 'subscriber_user' | 'publisher_user' | 'publisher_subscriber';
```

### 3. Frontend

#### 3.1. Auth Slice

**Arquivo:** `frontend/src/store/slices/authSlice.ts`

**Mudanças:**
```typescript
// ANTES
user_type?: 'system_user' | 'subscriber_user' | 'publisher_user';

// DEPOIS
user_type?: 'system_user' | 'subscriber_user' | 'publisher_user' | 'publisher_subscriber';
```

#### 3.2. Login Page

**Arquivo:** `frontend/src/pages/Login/Login.tsx`

**Mudanças:**
```typescript
// ANTES
if (userType === 'publisher_user') {
  navigate('/dashboard');
}

// DEPOIS
if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
  navigate('/dashboard'); // PublisherLayout será aplicado automaticamente
}
```

#### 3.3. App.tsx - Layout Selection

**Arquivo:** `frontend/src/App.tsx`

**Mudanças:**
```typescript
// Prioridade 2: user_type (quando não há subdomínio)
if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
  return <PublisherLayout>{children}</PublisherLayout>;
}
```

#### 3.4. App.tsx - Subdomain Validation

**Arquivo:** `frontend/src/App.tsx`

**Mudanças:**
```typescript
// Publisher subdomain: aceita publisher_user, publisher_subscriber ou admins
if (subdomainType === 'publisher') {
  if (user.user_type !== 'publisher_user' && 
      user.user_type !== 'publisher_subscriber' &&
      user.role !== 'owner_system' && 
      user.role !== 'admin_sql' && 
      user.role !== 'admin' &&
      !user.publisherId) {
    return <Navigate to="/login" />;
  }
}

// Subscriber subdomain: aceita subscriber_user, publisher_subscriber ou admins
if (subdomainType === 'subscriber') {
  if (user.user_type !== 'subscriber_user' && 
      user.user_type !== 'publisher_subscriber' &&
      user.role !== 'owner_system' && 
      user.role !== 'admin_sql' && 
      user.role !== 'admin' &&
      !user.subscriberId) {
    return <Navigate to="/login" />;
  }
}
```

#### 3.5. Role Permissions

**Arquivo:** `frontend/src/utils/rolePermissions.ts`

**Mudanças:**
- Adicionado `publisher_subscriber` nas permissões onde `publisher_user` está presente:
  - `/dashboard`
  - `/smart-tvs`
  - `/locals`
  - `/billing` (pode ver faturamento como subscriber)
  - `/billing/invoices`
  - `/billing/payments`
  - `/billing/history`
  - `/smart-tvs/by-totem`

#### 3.6. useFlags Hook

**Arquivo:** `frontend/src/hooks/useFlags.ts`

**Mudanças:**
```typescript
// ANTES
isPublisher: user?.role === 'publisher_user' || user?.publisherId !== undefined,
isSubscriber: user?.role === 'subscriber_user' || user?.subscriberId !== undefined,

// DEPOIS
isPublisher: user?.role === 'publisher_user' || 
            user?.user_type === 'publisher_user' || 
            user?.user_type === 'publisher_subscriber' || 
            user?.publisherId !== undefined,
isSubscriber: user?.role === 'subscriber_user' || 
             user?.user_type === 'subscriber_user' || 
             user?.user_type === 'publisher_subscriber' || 
             user?.subscriberId !== undefined,
isPublisherSubscriber: user?.user_type === 'publisher_subscriber', // NOVO
```

---

## 🎯 COMPORTAMENTO

### Login e Redirecionamento

**`publisher_subscriber`**:
- ✅ Redireciona para `/dashboard` (como `publisher_user`)
- ✅ Usa `PublisherLayout` automaticamente
- ✅ Pode acessar subdomínio `publisher.*`
- ✅ Pode acessar subdomínio `subscriber.*`

### Permissões de Menu

**`publisher_subscriber`** tem acesso a:
- ✅ Todos os itens de menu de `publisher_user`:
  - Dashboard Publisher
  - Meus Locais
  - Meus Totens
  - Minhas Smart TVs
  - Analytics
  - Configurações
- ✅ Itens de menu de `subscriber_user` relacionados a faturamento:
  - Faturamento (se tiver `flag_smart_3`)
  - Faturas
  - Pagamentos
  - Histórico

### Subdomínios

**`publisher_subscriber`** pode acessar:
- ✅ `publisher.*` - Interface de Publisher
- ✅ `subscriber.*` - Interface de Subscriber

---

## 📊 COMPARAÇÃO: Tipos de Usuário

| Tipo | Publisher | Subscriber | Acesso Publisher Subdomain | Acesso Subscriber Subdomain | Layout |
|------|-----------|------------|----------------------------|-----------------------------|--------|
| `system_user` | ❌ | ❌ | ✅ (admins) | ✅ (admins) | `Layout.tsx` |
| `subscriber_user` | ❌ | ✅ | ❌ | ✅ | `SubscriberLayout.tsx` |
| `publisher_user` | ✅ | ❌ | ✅ | ❌ | `PublisherLayout.tsx` |
| `publisher_subscriber` | ✅ | ✅ | ✅ | ✅ | `PublisherLayout.tsx` |

---

## ✅ CHECKLIST

- [x] Schema do banco atualizado (CHECK constraint)
- [x] Backend: Auth middleware atualizado (tipos TypeScript)
- [x] Frontend: Auth slice atualizado (interface User)
- [x] Frontend: Login page atualizado (redirecionamento)
- [x] Frontend: App.tsx atualizado (layout selection)
- [x] Frontend: App.tsx atualizado (validação de subdomínios)
- [x] Frontend: Role permissions atualizado (permissões de menu)
- [x] Frontend: useFlags hook atualizado (helpers)

---

## 🔍 EXEMPLOS DE USO

### Exemplo 1: Criar Usuário `publisher_subscriber`

```sql
INSERT INTO users (
  username, 
  email, 
  password_hash, 
  publisher_id, 
  subscriber_id,
  user_type,
  is_tenant_user,
  role
) VALUES (
  'shopping.anunciante',
  'anunciante@shopping.com',
  '$2b$12$...',
  1, -- publisher_id
  1, -- subscriber_id (derivado ou direto)
  'publisher_subscriber',
  false,
  'publisher_user'
);
```

### Exemplo 2: Verificar Tipo no Frontend

```typescript
const { isPublisher, isSubscriber, isPublisherSubscriber } = useFlags();

if (isPublisherSubscriber) {
  // Usuário é Publisher que também anuncia
  // Mostrar opções de Publisher E Subscriber
}
```

### Exemplo 3: Validação de Acesso

```typescript
// No backend ou frontend
if (user.user_type === 'publisher_subscriber') {
  // Tem acesso a:
  // - Recursos de Publisher (totens, locais, smart TVs)
  // - Recursos de Subscriber (campanhas, mídias, faturamento)
}
```

---

## 📝 NOTAS

1. **Layout Padrão**: `publisher_subscriber` usa `PublisherLayout` por padrão (mesmo comportamento de `publisher_user`)

2. **Subdomínios**: Pode acessar ambos os subdomínios (`publisher.*` e `subscriber.*`)

3. **Permissões**: Herda permissões de ambos (`publisher_user` + `subscriber_user` para faturamento)

4. **Flags**: Flags são verificadas normalmente (ex: `flag_smart_3` para faturamento)

---

**Última atualização:** 2026-01-03
