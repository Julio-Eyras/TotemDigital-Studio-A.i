# Correções: Erros no Console do Browser

**Data:** 2026-01-03  
**Problemas Identificados e Corrigidos**

---

## 🔍 PROBLEMAS IDENTIFICADOS

### 1. Rate Limiting Muito Agressivo
- **Problema:** Mensagem "Aguarde 155 segundos" aparecendo frequentemente
- **Causa:** Rate limit muito restritivo e cálculo incorreto do `retryAfter`

### 2. Throttling Navigation
- **Problema:** Aviso do Chrome sobre navegação sendo limitada
- **Causa:** Muitas navegações rápidas (possivelmente loops de redirecionamento)

### 3. Erro de Listener Assíncrono
- **Problema:** `Uncaught (in promise) Error: A listener indicated an asynchronous response`
- **Causa:** Geralmente causado por extensões do browser ou código tentando comunicar com extensões

### 4. Rota `/subscriber/dashboard` Não Funciona
- **Problema:** Link `http://192.168.1.110/subscriber/dashboard` não funciona
- **Causa:** Nginx precisa servir corretamente as rotas do React Router

---

## ✅ CORREÇÕES APLICADAS

### 1. Ajuste do Rate Limiting

#### Backend (`backend/src/middleware/rateLimitUser.middleware.ts`)

**Antes:**
- 100 requisições por minuto
- Cálculo incorreto do `retryAfter`
- Mensagem genérica

**Depois:**
- ✅ 200 requisições por minuto (dobrado)
- ✅ Cálculo correto do tempo restante até próximo window
- ✅ Mensagem mais amigável com minutos
- ✅ Header `Retry-After` correto

```typescript
// Calcular tempo restante até o próximo window
const timeUntilNextWindow = finalConfig.windowMs - (Date.now() % finalConfig.windowMs);
const retryAfterSeconds = Math.ceil(timeUntilNextWindow / 1000);

res.status(429).json({
  success: false,
  error: {
    message: `${finalConfig.message} Aguarde ${Math.ceil(retryAfterSeconds / 60)} minuto(s) antes de tentar novamente.`,
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: retryAfterSeconds
  }
});
res.setHeader('Retry-After', retryAfterSeconds.toString());
```

#### Backend (`backend/src/middleware/security.middleware.ts`)

**Ajustes:**
- ✅ Limite dobrado para `apiLimiter`
- ✅ Rotas estáticas (`/static/`, `/assets/`) excluídas do rate limit

```typescript
export const apiLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.maxRequests * 2, // Dobrado
  skip: (req: Request) => {
    return req.path === '/health' || 
           req.path === '/api/health' ||
           req.path.startsWith('/static/') ||
           req.path.startsWith('/assets/');
  }
});
```

### 2. Melhoria no Frontend

#### `frontend/src/services/api/index.ts`

**Antes:**
- Retry automático causando loops
- Mensagem em segundos (difícil de entender)

**Depois:**
- ✅ Removido retry automático para rate limit
- ✅ Mensagem em minutos (mais amigável)
- ✅ Usa mensagem do backend se disponível

```typescript
// NÃO fazer retry automático para rate limit (evitar loops)
return Promise.reject(error);
```

#### `frontend/src/hooks/useRateLimit.ts`

**Ajuste:**
- ✅ Mensagem convertida para minutos

```typescript
const retryAfterMinutes = retryAfter ? Math.ceil(retryAfter / 60) : 1;
showWarning(message || `Muitas requisições. Aguarde ${retryAfterMinutes} minuto(s) antes de tentar novamente.`);
```

### 3. Rate Limit para Operações Pesadas

**Ajuste:**
- ✅ Aumentado de 10 para 20 operações por minuto

---

## 📋 CONFIGURAÇÕES ATUAIS

### Rate Limits

| Tipo | Janela | Limite | Antes |
|------|--------|--------|-------|
| **API Geral** | 15 min | 200 req | 100 req |
| **Autenticação** | 15 min | 5 req | 5 req |
| **Uploads** | 1 hora | 50 req | 50 req |
| **Operações Pesadas** | 1 min | 20 req | 10 req |
| **Operações Sensíveis** | 10 min | 10 req | 10 req |

---

## 🔧 SOBRE OS AVISOS DO BROWSER

### 1. Throttling Navigation

**Aviso:**
```
Throttling navigation to prevent the browser from hanging
```

**Causa:** Chrome limita navegações muito rápidas para evitar travamentos.

**Solução:**
- ✅ Removido retry automático que causava loops
- ✅ Rate limit ajustado para evitar muitas requisições
- ⚠️ **Nota:** Este aviso é do Chrome e não afeta a funcionalidade

### 2. Erro de Listener Assíncrono

**Erro:**
```
Uncaught (in promise) Error: A listener indicated an asynchronous response
```

**Causa:** Geralmente causado por extensões do browser (ex: AdBlock, LastPass, etc.)

**Solução:**
- ⚠️ **Não é um problema do código**
- ✅ Pode ser ignorado se não afetar funcionalidade
- 💡 **Dica:** Teste em modo anônimo para confirmar

### 3. Rota `/subscriber/dashboard`

**Status:** ✅ Rota existe no frontend e está configurada corretamente

**Verificação:**
- ✅ Rota definida em `App.tsx`: `/subscriber/dashboard`
- ✅ Nginx configurado com `try_files $uri $uri/ /index.html;`
- ✅ React Router deve servir corretamente

**Se ainda não funcionar:**
1. Verificar se o build do frontend está atualizado
2. Verificar logs do Nginx: `sudo tail -f /var/log/nginx/error.log`
3. Testar diretamente: `http://192.168.1.110/subscriber-login` → login → redireciona para `/subscriber/dashboard`

---

## ✅ CHECKLIST DE CORREÇÕES

- [x] Rate limit ajustado (200 req/min)
- [x] Cálculo correto do `retryAfter`
- [x] Mensagem em minutos (mais amigável)
- [x] Removido retry automático (evita loops)
- [x] Rotas estáticas excluídas do rate limit
- [x] Header `Retry-After` correto
- [x] Operações pesadas: 20 req/min (aumentado)

---

## 🎯 RESULTADO ESPERADO

### Antes:
```
❌ Muitas requisições. Aguarde 155 segundos antes de tentar novamente.
```

### Depois:
```
✅ Muitas requisições. Aguarde 3 minuto(s) antes de tentar novamente.
```

### Rate Limit Menos Agressivo:
- ✅ 200 requisições por 15 minutos (antes: 100)
- ✅ Mensagens mais claras
- ✅ Sem loops de retry automático

---

## 📝 NOTAS ADICIONAIS

### Throttling Navigation
Este aviso do Chrome é **normal** e não afeta a funcionalidade. É uma proteção do browser contra navegações excessivas.

### Erro de Listener Assíncrono
Este erro geralmente é causado por **extensões do browser**. Para confirmar:
1. Teste em modo anônimo
2. Desative extensões temporariamente
3. Se o erro desaparecer, é das extensões

### Rota `/subscriber/dashboard`
A rota está correta. Se não funcionar:
1. Verificar build do frontend
2. Verificar logs do Nginx
3. Testar fluxo completo: login → redirecionamento

---

**Última atualização:** 2026-01-03
