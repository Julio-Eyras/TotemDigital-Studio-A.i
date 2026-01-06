# Pontos de Login do Sistema

**Data:** 2026-01-03  
**Versão:** 2.1.0

---

## 🔐 PONTOS DE LOGIN

### 1. **Usuários do Sistema** (Administradores, Operadores)

**URL:** `http://192.168.1.110/login`

**Quem usa:**
- ✅ `owner_system` - Proprietário do sistema
- ✅ `admin_sql` - Administrador SQL
- ✅ `admin` - Administrador do tenant
- ✅ `operador_tecnico` - Operador técnico
- ✅ `operador_faturamento` - Operador de faturamento
- ✅ `operador_comercial` - Operador comercial
- ✅ `operator` - Operador genérico
- ✅ `gerente_marketing` - Gerente de marketing
- ✅ `editoracao` - Edição
- ✅ `visualizador` - Visualizador

**Credenciais padrão:**
- Usuário: `admin`
- Senha: `admin123`

**Após login:**
- Redireciona para: `/dashboard`
- Usa layout: `Layout.tsx` (menu principal do sistema)

---

### 2. **Subscribers** (Assinantes)

**URL:** `http://192.168.1.110/subscriber-login`

**Quem usa:**
- ✅ `subscriber_user` - Usuário de subscriber (user_type = 'subscriber_user')

**Autenticação:**
- Usa **email** do subscriber (não username)
- Senha do usuário vinculado ao subscriber

**Após login:**
- Redireciona para: `/subscriber/dashboard`
- Usa layout: `SubscriberLayout.tsx` (menu específico para subscribers)

**Subdomínio (opcional):**
- `http://subscriber.192.168.1.110` (se DNS local configurado)
- `http://subscriber.sistema.com` (se domínio configurado)

---

### 3. **Publishers** (Publicadores)

**URL:** `http://192.168.1.110/publisher-login` ⚠️ **A CRIAR**

**Quem usa:**
- ✅ `publisher_user` - Usuário de publisher (user_type = 'publisher_user')

**Autenticação:**
- Usa **username** ou **email** do usuário vinculado ao publisher
- Senha do usuário vinculado ao publisher

**Após login:**
- Redireciona para: `/dashboard` (ou `/publisher/dashboard`)
- Usa layout: `PublisherLayout.tsx` (menu específico para publishers)

**Subdomínio (opcional):**
- `http://publisher.192.168.1.110` (se DNS local configurado)
- `http://publisher.sistema.com` (se domínio configurado)

**Nota:** Atualmente publishers usam o login principal (`/login`), mas deveriam ter login próprio.

---

## 📋 RESUMO DOS PONTOS DE LOGIN

| Tipo de Usuário | URL Principal | URL Subdomínio | Layout |
|----------------|---------------|----------------|--------|
| **Sistema** | `/login` | - | `Layout.tsx` |
| **Subscribers** | `/subscriber-login` | `subscriber.*` | `SubscriberLayout.tsx` |
| **Publishers** | `/publisher-login` ⚠️ | `publisher.*` | `PublisherLayout.tsx` |

---

## 🔧 IMPLEMENTAÇÃO NECESSÁRIA

### 1. Criar Página de Login para Publishers

**Arquivo:** `frontend/src/pages/PublisherLogin/PublisherLogin.tsx`

**Funcionalidades:**
- Formulário de login (username/email + senha)
- Validação de credenciais
- Redirecionamento para `/dashboard` ou `/publisher/dashboard`
- Usar `PublisherLayout` após login

### 2. Adicionar Rota no App.tsx

```typescript
<Route
  path="/publisher-login"
  element={
    isAuthenticated ? (
      <Navigate to="/dashboard" />
    ) : (
      <PublisherLogin />
    )
  }
/>
```

### 3. Atualizar Nginx (se necessário)

O Nginx já está configurado para servir subdomínios, mas pode precisar de ajustes para a rota `/publisher-login`.

---

## 🎯 FLUXO DE AUTENTICAÇÃO

### Sistema (Administradores/Operadores)

```
1. Acessa: http://192.168.1.110/login
2. Informa: username + senha
3. Backend valida: /api/auth/login
4. Redireciona: /dashboard
5. Layout: Layout.tsx (menu principal)
```

### Subscribers

```
1. Acessa: http://192.168.1.110/subscriber-login
2. Informa: email + senha
3. Backend valida: /api/auth/subscriber-login
4. Redireciona: /subscriber/dashboard
5. Layout: SubscriberLayout.tsx (menu subscriber)
```

### Publishers

```
1. Acessa: http://192.168.1.110/publisher-login (A CRIAR)
2. Informa: username/email + senha
3. Backend valida: /api/auth/login (ou criar /api/auth/publisher-login)
4. Redireciona: /dashboard
5. Layout: PublisherLayout.tsx (menu publisher)
```

---

## 📝 NOTAS

### Publishers Atualmente

- ⚠️ **Problema:** Publishers estão usando o login principal (`/login`)
- ✅ **Solução:** Criar página específica `/publisher-login`
- ✅ **Alternativa:** Detectar `user_type = 'publisher_user'` no login principal e redirecionar para `PublisherLayout`

### Subdomínios

- Subdomínios são **opcionais** e dependem de configuração DNS
- Se não configurado, usar URLs diretas: `/login`, `/subscriber-login`, `/publisher-login`
- Se configurado, usar: `publisher.sistema.com`, `subscriber.sistema.com`

---

**Última atualização:** 2026-01-03
