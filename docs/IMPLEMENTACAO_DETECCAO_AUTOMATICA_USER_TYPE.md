# Implementação: Detecção Automática de `user_type` no Login

**Data:** 2026-01-03  
**Status:** Aprovado para implementação

---

## 🎯 OBJETIVO

Implementar detecção automática do `user_type` após login bem-sucedido e redirecionar automaticamente para o layout e dashboard correto.

---

## 📋 SITUAÇÃO ATUAL

### Backend
- ✅ Tabela `users` tem campo `user_type` (`'system_user' | 'subscriber_user' | 'publisher_user'`)
- ✅ `AuthService.login()` retorna `user_type` na resposta
- ✅ Middleware de autenticação já carrega `user_type`

### Frontend
- ✅ `Login.tsx` faz login mas sempre redireciona para `/dashboard`
- ✅ `App.tsx` já tem lógica para detectar subdomínio e usar layouts diferentes
- ✅ `SubscriberLogin.tsx` existe mas pode ser opcional

---

## 🔧 IMPLEMENTAÇÃO

### 1. Atualizar `Login.tsx`

**Arquivo:** `frontend/src/pages/Login/Login.tsx`

**Mudanças:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  try {
    const result = await dispatch(login(formData)).unwrap();
    
    // Detectar user_type e redirecionar automaticamente
    const user = result.user || JSON.parse(localStorage.getItem('user') || '{}');
    const userType = user.user_type || user.userType;
    
    if (userType === 'subscriber_user') {
      navigate('/subscriber/dashboard');
    } else if (userType === 'publisher_user') {
      navigate('/dashboard'); // PublisherLayout será aplicado automaticamente
    } else {
      navigate('/dashboard'); // Layout padrão para system_user
    }
  } catch (error) {
    // Error is handled by the auth slice
  }
};
```

### 2. Atualizar `App.tsx` - Seleção de Layout

**Arquivo:** `frontend/src/App.tsx`

**Mudanças na função `getLayout()`:**
```typescript
const getLayout = (children: React.ReactNode) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userType = user.user_type || user.userType;
  
  // Prioridade: subdomínio > user_type
  if (subdomainType === 'publisher') {
    return <PublisherLayout>{children}</PublisherLayout>;
  }
  
  if (subdomainType === 'subscriber') {
    return <SubscriberLayout>{children}</SubscriberLayout>;
  }
  
  // Se não houver subdomínio, usar user_type
  if (userType === 'publisher_user') {
    return <PublisherLayout>{children}</PublisherLayout>;
  }
  
  if (userType === 'subscriber_user') {
    return <SubscriberLayout>{children}</SubscriberLayout>;
  }
  
  // Layout padrão para system_user
  return <Layout>{children}</Layout>;
};
```

### 3. Atualizar `ProtectedRoute` em `App.tsx`

**Mudanças:**
```typescript
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userType = user.user_type || user.userType;
  
  // Validar acesso por subdomínio OU user_type
  if (subdomainType === 'publisher') {
    if (userType !== 'publisher_user' && 
        !['owner_system', 'admin_sql', 'admin'].includes(user.role) &&
        !user.publisherId) {
      return <Navigate to="/login" />;
    }
  }
  
  if (subdomainType === 'subscriber') {
    if (userType !== 'subscriber_user' && 
        !['owner_system', 'admin_sql', 'admin'].includes(user.role) &&
        !user.subscriberId) {
      return <Navigate to="/login" />;
    }
  }

  return getLayout(children);
};
```

---

## 🎯 FLUXO DE LOGIN

### 1. Usuário acessa `/login`
```
http://192.168.1.110/login
```

### 2. Informa credenciais (username + senha)
```
Username: publisher_user_1
Password: ********
```

### 3. Backend valida e retorna `user_type`
```json
{
  "token": "...",
  "user": {
    "id": 1,
    "username": "publisher_user_1",
    "user_type": "publisher_user",
    "publisher_id": 5,
    ...
  }
}
```

### 4. Frontend detecta `user_type` e redireciona
```typescript
if (user.user_type === 'publisher_user') {
  navigate('/dashboard'); // PublisherLayout será aplicado
}
```

### 5. `App.tsx` aplica layout correto
```typescript
if (userType === 'publisher_user') {
  return <PublisherLayout>{children}</PublisherLayout>;
}
```

---

## 📊 CASOS DE USO

### Caso 1: System User
```
Login → user_type = 'system_user' → /dashboard → Layout.tsx
```

### Caso 2: Subscriber User
```
Login → user_type = 'subscriber_user' → /subscriber/dashboard → SubscriberLayout.tsx
```

### Caso 3: Publisher User
```
Login → user_type = 'publisher_user' → /dashboard → PublisherLayout.tsx
```

### Caso 4: Subdomínio Publisher
```
publisher.sistema.com → Login → user_type = 'publisher_user' → /dashboard → PublisherLayout.tsx
```

### Caso 5: Subdomínio Subscriber
```
subscriber.sistema.com → Login → user_type = 'subscriber_user' → /subscriber/dashboard → SubscriberLayout.tsx
```

---

## ✅ VANTAGENS

1. **Simplicidade:** Um único ponto de login
2. **Centralização:** Lógica na tabela `users`
3. **Manutenibilidade:** Menos código duplicado
4. **Flexibilidade:** Funciona com ou sem subdomínios
5. **Compatibilidade:** `/subscriber-login` pode ser mantido como opcional

---

## 🔄 COMPATIBILIDADE

### `/subscriber-login` (Opcional)
- ✅ Pode ser mantido para compatibilidade
- ✅ Redireciona para `/subscriber/dashboard`
- ✅ Usa `SubscriberLayout.tsx`

### Subdomínios
- ✅ `publisher.sistema.com` → `PublisherLayout`
- ✅ `subscriber.sistema.com` → `SubscriberLayout`
- ✅ Domínio principal → Layout baseado em `user_type`

---

## 📝 CHECKLIST

- [ ] Atualizar `Login.tsx` para detectar `user_type`
- [ ] Implementar redirecionamento automático
- [ ] Atualizar `getLayout()` em `App.tsx`
- [ ] Atualizar `ProtectedRoute` em `App.tsx`
- [ ] Testar login com `system_user`
- [ ] Testar login com `subscriber_user`
- [ ] Testar login com `publisher_user`
- [ ] Testar com subdomínios
- [ ] Validar layouts corretos

---

**Última atualização:** 2026-01-03
