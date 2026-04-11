# Correções de Erros de Compilação TypeScript

**Data:** 2026-01-03  
**Problema:** 7 erros de compilação TypeScript no backend

---

## 🔴 Erros Corrigidos

### 1. `auth.middleware.ts:162` - Tipo genérico em `findFirst`

**Erro:**
```typescript
const effectiveFlags = await db.findFirst<UserFlags>(`...`);
```

**Correção:**
```typescript
const effectiveFlags = await db.findFirst(`...`) as UserFlags | null;
```

**Motivo:** O método `findFirst` do `DatabaseWrapper` não aceita tipos genéricos.

---

### 2. `flagAuth.middleware.ts:6` - Import não usado

**Erro:**
```typescript
import { Request, Response, NextFunction } from 'express';
// Request não estava sendo usado
```

**Correção:**
```typescript
import { Response, NextFunction } from 'express';
```

---

### 3. `flagAuth.middleware.ts:7` - Módulo não encontrado

**Erro:**
```typescript
import { AuthenticatedRequest } from '../types/express';
// Arquivo não existe
```

**Correção:**
```typescript
import { AuthenticatedRequest } from './auth.middleware';
```

**Motivo:** `AuthenticatedRequest` está definido em `auth.middleware.ts`, não em `types/express.ts`.

---

### 4. `flagAuth.middleware.ts:15` e `86` - Nem todos os caminhos retornam valor

**Erro:**
```typescript
return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // Alguns caminhos não tinham return explícito
}
```

**Correção:**
```typescript
return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Adicionado tipo de retorno Promise<void>
  // Adicionado return explícito antes de res.status() e next()
}
```

**Mudanças:**
- Adicionado tipo de retorno `Promise<void>`
- Substituído `return res.status()` por `res.status(); return;`
- Substituído `return next()` por `next(); return;`

---

### 5. `subdomain.middleware.ts:20` - Variável não usada

**Erro:**
```typescript
const host = req.get('host') || '';
// host não estava sendo usado
```

**Correção:**
```typescript
// Removida variável host (não necessária)
const hostname = req.hostname || '';
```

---

### 6. `flagChecker.ts:6` - Membro não exportado

**Erro:**
```typescript
import { db } from '../config/database';
// db não é exportado
```

**Correção:**
```typescript
import { getDatabase } from '../config/database';
// Usar getDatabase() em cada função
```

**Mudanças em todas as funções:**
- `getRoleFlagsDefault()`: Adicionado `const db = getDatabase();`
- `getUserFlags()`: Adicionado `const db = getDatabase();`
- `updateUserFlags()`: Adicionado `const db = getDatabase();` e trocado `execute` por `executeRaw`
- `getUserEffectiveFlags()`: Adicionado `const db = getDatabase();`
- Removidos tipos genéricos de `findFirst` (usar `as UserFlags | null`)

---

## ✅ Status

Todos os 7 erros foram corrigidos. O código deve compilar sem erros agora.

---

## 📝 Notas

1. **DatabaseWrapper:** O `getDatabase()` retorna um `DatabaseWrapper` que tem métodos `findFirst`, `executeRaw`, `tableExists`, etc.

2. **Tipos genéricos:** O `DatabaseWrapper.findFirst()` não aceita tipos genéricos. Use type assertion (`as Type`) quando necessário.

3. **execute vs executeRaw:** O `DatabaseWrapper` tem apenas `executeRaw()`, não `execute()`.

---

**Última atualização:** 2026-01-03
