# Sistema de Flags e Permissões - Detalhes Técnicos

## 📌 Visão Geral

O sistema de flags (`Flag_smart_0` a `Flag_smart_9`) permite controle granular de permissões, complementando o sistema de roles. Cada flag representa uma permissão específica que pode ser atribuída a usuários individualmente ou por role padrão.

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `user_flags`

```sql
CREATE TABLE IF NOT EXISTS user_flags (
    user_id INTEGER NOT NULL PRIMARY KEY,
    
    -- Flags de Permissão (0-9)
    flag_smart_0 BOOLEAN DEFAULT false,  -- FLAG_TECHNICAL_ACCESS
    flag_smart_1 BOOLEAN DEFAULT false,  -- FLAG_OTA_UPDATES
    flag_smart_2 BOOLEAN DEFAULT false,  -- FLAG_SYSTEM_LOGS
    flag_smart_3 BOOLEAN DEFAULT false,  -- FLAG_BILLING_VIEW
    flag_smart_4 BOOLEAN DEFAULT false,  -- FLAG_BILLING_MANAGE
    flag_smart_5 BOOLEAN DEFAULT false,  -- FLAG_CONTRACTS
    flag_smart_6 BOOLEAN DEFAULT false,  -- FLAG_COMMERCIAL_VIEW
    flag_smart_7 BOOLEAN DEFAULT false,  -- FLAG_REPORTS_COMMERCIAL
    flag_smart_8 BOOLEAN DEFAULT false,  -- FLAG_PUBLISHER_FULL
    flag_smart_9 BOOLEAN DEFAULT false,  -- FLAG_SUBSCRIBER_FULL
    
    -- Metadados
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,  -- FK para users (quem atualizou)
    
    -- Constraints
    CONSTRAINT fk_user_flags_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_user_flags_updated_by 
        FOREIGN KEY (updated_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL
);

-- Índices
CREATE INDEX idx_user_flags_updated_at ON user_flags(updated_at);

-- Comentários
COMMENT ON TABLE user_flags IS 'Flags de permissão personalizadas por usuário';
COMMENT ON COLUMN user_flags.flag_smart_0 IS 'Acesso técnico (totens, TVs, players)';
COMMENT ON COLUMN user_flags.flag_smart_1 IS 'Gerenciar atualizações OTA';
COMMENT ON COLUMN user_flags.flag_smart_2 IS 'Acessar logs do sistema';
COMMENT ON COLUMN user_flags.flag_smart_3 IS 'Visualizar faturamento';
COMMENT ON COLUMN user_flags.flag_smart_4 IS 'Gerenciar faturamento';
COMMENT ON COLUMN user_flags.flag_smart_5 IS 'Gerenciar contratos';
COMMENT ON COLUMN user_flags.flag_smart_6 IS 'Visualizar dados comerciais';
COMMENT ON COLUMN user_flags.flag_smart_7 IS 'Acessar relatórios comerciais';
COMMENT ON COLUMN user_flags.flag_smart_8 IS 'Acesso completo de publisher';
COMMENT ON COLUMN user_flags.flag_smart_9 IS 'Acesso completo de subscriber';
```

### Tabela: `role_flags_default`

```sql
CREATE TABLE IF NOT EXISTS role_flags_default (
    role TEXT NOT NULL PRIMARY KEY,
    
    -- Flags de Permissão (0-9)
    flag_smart_0 BOOLEAN DEFAULT false,
    flag_smart_1 BOOLEAN DEFAULT false,
    flag_smart_2 BOOLEAN DEFAULT false,
    flag_smart_3 BOOLEAN DEFAULT false,
    flag_smart_4 BOOLEAN DEFAULT false,
    flag_smart_5 BOOLEAN DEFAULT false,
    flag_smart_6 BOOLEAN DEFAULT false,
    flag_smart_7 BOOLEAN DEFAULT false,
    flag_smart_8 BOOLEAN DEFAULT false,
    flag_smart_9 BOOLEAN DEFAULT false,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comentários
COMMENT ON TABLE role_flags_default IS 'Flags padrão por role (aplicadas quando usuário não tem flags personalizadas)';
```

### Dados Iniciais: `role_flags_default`

```sql
-- Inserir flags padrão por role
INSERT INTO role_flags_default (role, flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4, flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9) VALUES
-- Owner System: Todas as flags
('owner_system', true, true, true, true, true, true, true, true, true, true),

-- Admin SQL: Técnico + Faturamento + Comercial
('admin_sql', true, true, true, true, true, true, true, true, false, false),

-- Admin: Faturamento + Comercial
('admin', false, false, false, true, true, true, true, true, false, false),

-- Operador Técnico: Apenas flags técnicas
('operador_tecnico', true, true, true, false, false, false, false, false, false, false),

-- Operador Faturamento: Apenas flags de faturamento
('operador_faturamento', false, false, false, true, true, true, false, false, false, false),

-- Operador Comercial: Apenas flags comerciais
('operador_comercial', false, false, false, false, false, false, true, true, false, false),

-- Publisher User: Flag de publisher
('publisher_user', false, false, false, false, false, false, false, false, true, false),

-- Subscriber User: Flag de subscriber
('subscriber_user', false, false, false, false, false, false, false, false, false, true)

ON CONFLICT (role) DO NOTHING;
```

---

## 💻 Implementação Backend

### Utilitário: `flagChecker.ts`

```typescript
// backend/src/utils/flagChecker.ts

import { db } from '../config/database';

export interface UserFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

export interface UserWithFlags {
  id: number;
  role: string;
  user_type?: string;
  publisher_id?: number;
  subscriber_id?: number;
  flags?: UserFlags;
}

/**
 * Verifica se usuário tem uma flag específica
 */
export async function hasFlag(
  user: UserWithFlags, 
  flag: `flag_smart_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`
): Promise<boolean> {
  // 1. Owner system tem todas as flags
  if (user.role === 'owner_system') {
    return true;
  }
  
  // 2. Verificar flag personalizada do usuário
  if (user.flags && user.flags[flag]) {
    return true;
  }
  
  // 3. Buscar flags padrão da role
  const roleFlags = await getRoleFlagsDefault(user.role);
  if (roleFlags && roleFlags[flag]) {
    return true;
  }
  
  return false;
}

/**
 * Obtém flags padrão de uma role
 */
export async function getRoleFlagsDefault(role: string): Promise<UserFlags | null> {
  const result = await db.findFirst<UserFlags>(`
    SELECT 
      flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
      flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
    FROM role_flags_default
    WHERE role = $1
  `, [role]);
  
  return result || null;
}

/**
 * Obtém flags personalizadas de um usuário
 */
export async function getUserFlags(userId: number): Promise<UserFlags | null> {
  const result = await db.findFirst<UserFlags>(`
    SELECT 
      flag_smart_0, flag_smart_1, flag_smart_2, flag_smart_3, flag_smart_4,
      flag_smart_5, flag_smart_6, flag_smart_7, flag_smart_8, flag_smart_9
    FROM user_flags
    WHERE user_id = $1
  `, [userId]);
  
  return result || null;
}

/**
 * Atualiza flags de um usuário
 */
export async function updateUserFlags(
  userId: number, 
  flags: Partial<UserFlags>,
  updatedBy: number
): Promise<void> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  
  // Construir query dinâmica
  Object.keys(flags).forEach((key) => {
    if (key.startsWith('flag_smart_')) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(flags[key as keyof UserFlags]);
      paramIndex++;
    }
  });
  
  if (updates.length === 0) {
    return;
  }
  
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  updates.push(`updated_by = $${paramIndex}`);
  values.push(updatedBy);
  paramIndex++;
  
  // Verificar se registro existe
  const exists = await db.findFirst(`
    SELECT user_id FROM user_flags WHERE user_id = $1
  `, [userId]);
  
  if (exists) {
    // Atualizar
    await db.execute(`
      UPDATE user_flags
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
    `, [...values, userId]);
  } else {
    // Inserir
    await db.execute(`
      INSERT INTO user_flags (user_id, ${Object.keys(flags).join(', ')}, updated_by)
      VALUES ($${paramIndex}, ${values.map((_, i) => `$${i + 1}`).join(', ')})
    `, [...values, userId]);
  }
}

/**
 * Obtém todas as flags efetivas de um usuário (personalizadas + padrão da role)
 */
export async function getUserEffectiveFlags(user: UserWithFlags): Promise<UserFlags> {
  // 1. Owner system tem todas
  if (user.role === 'owner_system') {
    return {
      flag_smart_0: true, flag_smart_1: true, flag_smart_2: true,
      flag_smart_3: true, flag_smart_4: true, flag_smart_5: true,
      flag_smart_6: true, flag_smart_7: true, flag_smart_8: true,
      flag_smart_9: true
    };
  }
  
  // 2. Buscar flags personalizadas
  const userFlags = user.flags || await getUserFlags(user.id);
  
  // 3. Buscar flags padrão da role
  const roleFlags = await getRoleFlagsDefault(user.role);
  
  // 4. Combinar: flags personalizadas têm prioridade
  const effective: UserFlags = {
    flag_smart_0: userFlags?.flag_smart_0 ?? roleFlags?.flag_smart_0 ?? false,
    flag_smart_1: userFlags?.flag_smart_1 ?? roleFlags?.flag_smart_1 ?? false,
    flag_smart_2: userFlags?.flag_smart_2 ?? roleFlags?.flag_smart_2 ?? false,
    flag_smart_3: userFlags?.flag_smart_3 ?? roleFlags?.flag_smart_3 ?? false,
    flag_smart_4: userFlags?.flag_smart_4 ?? roleFlags?.flag_smart_4 ?? false,
    flag_smart_5: userFlags?.flag_smart_5 ?? roleFlags?.flag_smart_5 ?? false,
    flag_smart_6: userFlags?.flag_smart_6 ?? roleFlags?.flag_smart_6 ?? false,
    flag_smart_7: userFlags?.flag_smart_7 ?? roleFlags?.flag_smart_7 ?? false,
    flag_smart_8: userFlags?.flag_smart_8 ?? roleFlags?.flag_smart_8 ?? false,
    flag_smart_9: userFlags?.flag_smart_9 ?? roleFlags?.flag_smart_9 ?? false,
  };
  
  return effective;
}
```

### Middleware: Verificação de Flags

```typescript
// backend/src/middleware/flagAuth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { hasFlag } from '../utils/flagChecker';

/**
 * Middleware para verificar flag específica
 */
export const requireFlag = (flag: `flag_smart_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }
    
    const userHasFlag = await hasFlag(req.user, flag);
    
    if (!userHasFlag) {
      return res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSION',
        required_flag: flag
      });
    }
    
    next();
  };
};
```

### Exemplo de Uso em Rotas

```typescript
// backend/src/routes/totems.ts

import { requireFlag } from '../middleware/flagAuth.middleware';

// Rota que requer flag técnica
router.get('/totems', 
  authMiddleware,
  requireFlag('flag_smart_0'),  // Requer acesso técnico
  async (req, res) => {
    // ... lógica
  }
);

// Rota que requer flag de OTA
router.post('/totems/:id/ota-update',
  authMiddleware,
  requireFlag('flag_smart_1'),  // Requer permissão de OTA
  async (req, res) => {
    // ... lógica
  }
);
```

---

## 🎨 Implementação Frontend

### Hook: `useFlags`

```typescript
// frontend/src/hooks/useFlags.ts

import { useSelector } from 'react-redux';
import { RootState } from '../store';

export interface UserFlags {
  flag_smart_0: boolean;
  flag_smart_1: boolean;
  flag_smart_2: boolean;
  flag_smart_3: boolean;
  flag_smart_4: boolean;
  flag_smart_5: boolean;
  flag_smart_6: boolean;
  flag_smart_7: boolean;
  flag_smart_8: boolean;
  flag_smart_9: boolean;
}

export function useFlags() {
  const user = useSelector((state: RootState) => state.auth.user);
  
  const hasFlag = (flag: keyof UserFlags): boolean => {
    if (!user) return false;
    
    // Owner system tem todas
    if (user.role === 'owner_system') return true;
    
    // Verificar flag do usuário
    return user.flags?.[flag] ?? false;
  };
  
  return {
    flags: user?.flags,
    hasFlag,
    isOwner: user?.role === 'owner_system',
    isAdminSql: user?.role === 'admin_sql',
    isAdmin: user?.role === 'admin',
    isOperadorTecnico: user?.role === 'operador_tecnico',
    isOperadorFaturamento: user?.role === 'operador_faturamento',
    isOperadorComercial: user?.role === 'operador_comercial',
  };
}
```

### Componente: Verificação de Flag

```typescript
// frontend/src/components/FlagGuard.tsx

import React from 'react';
import { useFlags } from '../hooks/useFlags';

interface FlagGuardProps {
  flag: keyof UserFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FlagGuard: React.FC<FlagGuardProps> = ({ 
  flag, 
  children, 
  fallback = null 
}) => {
  const { hasFlag } = useFlags();
  
  if (!hasFlag(flag)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
};

// Uso:
// <FlagGuard flag="flag_smart_0">
//   <Button>Atualizar Totem</Button>
// </FlagGuard>
```

---

## 📊 Mapeamento de Flags para Funcionalidades

| Flag | Funcionalidade | Rotas Protegidas |
|------|----------------|------------------|
| `flag_smart_0` | Acesso técnico | `/totems`, `/smart-tvs`, `/players` |
| `flag_smart_1` | OTA Updates | `/ota-updates`, `POST /totems/:id/ota-update` |
| `flag_smart_2` | System Logs | `/admin-tools/logs`, `/system-logs` |
| `flag_smart_3` | Billing View | `GET /billing`, `GET /invoices` |
| `flag_smart_4` | Billing Manage | `POST /billing`, `PUT /invoices/:id` |
| `flag_smart_5` | Contracts | `/contracts`, `/plans` |
| `flag_smart_6` | Commercial View | `/publishers`, `/subscribers` (read-only) |
| `flag_smart_7` | Commercial Reports | `/reports/commercial` |
| `flag_smart_8` | Publisher Full | Todas rotas de publisher (com isolamento) |
| `flag_smart_9` | Subscriber Full | Todas rotas de subscriber (com isolamento) |

---

## 🔄 Fluxo de Verificação de Permissão

```
┌─────────────────────────────────────────┐
│ Requisição com Token JWT                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ authMiddleware                          │
│ • Valida token                          │
│ • Carrega user do banco                 │
│ • Adiciona user ao req.user             │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ requireFlag('flag_smart_X')             │
│ • Verifica se user.role = owner_system  │
│   → Se sim: PERMITIR                    │
│ • Busca flags personalizadas do user    │
│   → Se flag = true: PERMITIR            │
│ • Busca flags padrão da role           │
│   → Se flag = true: PERMITIR            │
│ • Caso contrário: NEGAR (403)           │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Handler da Rota                         │
│ • Executa lógica                        │
└─────────────────────────────────────────┘
```

---

## ✅ Checklist de Implementação

### Backend
- [ ] Criar tabelas `user_flags` e `role_flags_default`
- [ ] Inserir dados iniciais em `role_flags_default`
- [ ] Criar `utils/flagChecker.ts`
- [ ] Criar `middleware/flagAuth.middleware.ts`
- [ ] Atualizar `middleware/auth.middleware.ts` para carregar flags
- [ ] Aplicar `requireFlag` nas rotas apropriadas

### Frontend
- [ ] Criar `hooks/useFlags.ts`
- [ ] Criar `components/FlagGuard.tsx`
- [ ] Atualizar `store/slices/authSlice.ts` para incluir flags
- [ ] Atualizar `utils/rolePermissions.ts` para verificar flags
- [ ] Aplicar `FlagGuard` nos componentes apropriados

### Testes
- [ ] Testar verificação de flags por role padrão
- [ ] Testar flags personalizadas por usuário
- [ ] Testar owner_system (todas as flags)
- [ ] Testar negação de acesso sem flag
- [ ] Testar atualização de flags

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
