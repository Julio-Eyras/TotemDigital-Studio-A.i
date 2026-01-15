# 🔧 Implementação - Estrutura de Acessos e Hierarquia

**Data:** 2024-01-XX  
**Versão:** v2.1

---

## 📋 ATUALIZAÇÃO DO SCHEMA SQL

**Nota:** Como o sistema está sendo criado do zero, não precisamos de migrations separadas. As roles e permissões foram adicionadas diretamente no schema refatorado `database/smartchannel-db-v2-refactored-apply-all.sql`.

### ✅ O que foi adicionado ao `smartchannel-db-v2-refactored-apply-all.sql`:

1. **Roles hierárquicas** (6 níveis)
2. **Permissões completas** (todas as ações por recurso)
3. **Relações role-permissão** (atribuição automática)

### Estrutura Adicionada:

```sql
-- Roles inseridas:
- admin_sql (Top hierarquia - Dados + Sistema)
- operator (Top hierarquia - Apenas Sistema, SEM dados de clientes)
- admin (Administrador do Cliente)
- manager (Gerente do Cliente)
- viewer (Visualizador)
- client (Cliente Final - Player)

-- Atualizar role 'admin' existente (se necessário)
UPDATE roles SET
  description = 'Administrador do Cliente - Acesso total aos dados do próprio cliente'
WHERE name = 'admin';

-- Atualizar role 'manager' existente (se necessário)
UPDATE roles SET
  description = 'Gerente do Cliente - Acesso limitado aos dados do cliente'
WHERE name = 'manager';

-- Atualizar role 'viewer' existente (se necessário)
UPDATE roles SET
  description = 'Visualizador - Apenas leitura de dados do cliente'
WHERE name = 'viewer';

-- Atualizar role 'client' existente (se necessário)
UPDATE roles SET
  description = 'Cliente Final (Player) - Acesso apenas via API do player'
WHERE name = 'client';
```

### Permissões Criadas

```sql
-- Todas as permissões foram inseridas no smartchannel-db-v2-refactored-apply-all.sql

-- Permissões do Sistema
INSERT INTO permissions (name, resource, action, description) VALUES
  -- Sistema
  ('system.read', 'system', 'read', 'Ler configurações do sistema'),
  ('system.update', 'system', 'update', 'Atualizar configurações do sistema'),
  ('system.maintenance', 'system', 'maintenance', 'Manutenção do sistema'),
  
  -- Banco de Dados
  ('database.read', 'database', 'read', 'Ler dados gerais da base de dados'),
  ('database.write', 'database', 'write', 'Escrever na base de dados'),
  ('database.backup', 'database', 'backup', 'Criar backups'),
  ('database.restore', 'database', 'restore', 'Restaurar backups'),
  ('database.migrate', 'database', 'migrate', 'Executar migrações'),
  
  -- Usuários
  ('users.read', 'users', 'read', 'Ler usuários'),
  ('users.create', 'users', 'create', 'Criar usuários'),
  ('users.update', 'users', 'update', 'Atualizar usuários'),
  ('users.delete', 'users', 'delete', 'Deletar usuários'),
  
  -- Roles
  ('roles.read', 'roles', 'read', 'Ler roles'),
  ('roles.create', 'roles', 'create', 'Criar roles'),
  ('roles.update', 'roles', 'update', 'Atualizar roles'),
  ('roles.delete', 'roles', 'delete', 'Deletar roles'),
  
  -- Permissões
  ('permissions.read', 'permissions', 'read', 'Ler permissões'),
  ('permissions.create', 'permissions', 'create', 'Criar permissões'),
  ('permissions.update', 'permissions', 'update', 'Atualizar permissões'),
  ('permissions.delete', 'permissions', 'delete', 'Deletar permissões'),
  
  -- Clientes
  ('clients.read', 'clients', 'read', 'Ler clientes'),
  ('clients.create', 'clients', 'create', 'Criar clientes'),
  ('clients.update', 'clients', 'update', 'Atualizar clientes'),
  ('clients.delete', 'clients', 'delete', 'Deletar clientes'),
  
  -- Campanhas
  ('campaigns.read', 'campaigns', 'read', 'Ler campanhas'),
  ('campaigns.create', 'campaigns', 'create', 'Criar campanhas'),
  ('campaigns.update', 'campaigns', 'update', 'Atualizar campanhas'),
  ('campaigns.delete', 'campaigns', 'delete', 'Deletar campanhas'),
  
  -- Mídia
  ('medias.read', 'medias', 'read', 'Ler mídia'),
  ('medias.create', 'medias', 'create', 'Criar mídia'),
  ('medias.update', 'medias', 'update', 'Atualizar mídia'),
  ('medias.delete', 'medias', 'delete', 'Deletar mídia'),
  ('medias.download', 'medias', 'download', 'Download de mídia'),
  
  -- Playlists
  ('playlists.read', 'playlists', 'read', 'Ler playlists'),
  ('playlists.create', 'playlists', 'create', 'Criar playlists'),
  ('playlists.update', 'playlists', 'update', 'Atualizar playlists'),
  ('playlists.delete', 'playlists', 'delete', 'Deletar playlists'),
  ('playlists.download', 'playlists', 'download', 'Download de playlists'),
  
  -- Totens
  ('totems.read', 'totems', 'read', 'Ler totens'),
  ('totems.create', 'totems', 'create', 'Criar totens'),
  ('totems.update', 'totems', 'update', 'Atualizar totens'),
  ('totems.delete', 'totems', 'delete', 'Deletar totens'),
  ('totems.restart', 'totems', 'restart', 'Reiniciar totem'),
  ('totems.screenshot', 'totems', 'screenshot', 'Capturar screenshot'),
  ('totems.logs', 'totems', 'logs', 'Acessar logs do totem'),
  
  -- Relatórios
  ('reports.read', 'reports', 'read', 'Ler relatórios'),
  ('reports.create', 'reports', 'create', 'Criar relatórios'),
  ('reports.update', 'reports', 'update', 'Atualizar relatórios'),
  ('reports.delete', 'reports', 'delete', 'Deletar relatórios'),
  ('reports.export', 'reports', 'export', 'Exportar relatórios'),
  
  -- Billing
  ('billing.read', 'billing', 'read', 'Ler dados de billing'),
  ('billing.create', 'billing', 'create', 'Criar dados de billing'),
  ('billing.update', 'billing', 'update', 'Atualizar dados de billing'),
  ('billing.delete', 'billing', 'delete', 'Deletar dados de billing'),
  
  -- Configurações
  ('settings.read', 'settings', 'read', 'Ler configurações'),
  ('settings.update', 'settings', 'update', 'Atualizar configurações'),
  
  -- Logs
  ('logs.read', 'logs', 'read', 'Ler logs'),
  ('logs.export', 'logs', 'export', 'Exportar logs'),
  
  -- OTA Updates
  ('ota.read', 'ota', 'read', 'Ler atualizações OTA'),
  ('ota.create', 'ota', 'create', 'Criar atualizações OTA'),
  ('ota.update', 'ota', 'update', 'Atualizar atualizações OTA'),
  ('ota.delete', 'ota', 'delete', 'Deletar atualizações OTA'),
  
  -- SmartDisplayFX
  ('smartdisplayfx.read', 'smartdisplayfx', 'read', 'Ler SmartDisplayFX'),
  ('smartdisplayfx.update', 'smartdisplayfx', 'update', 'Atualizar SmartDisplayFX'),
  ('smartdisplayfx.config', 'smartdisplayfx', 'config', 'Configurar SmartDisplayFX'),
  ('smartdisplayfx.logs', 'smartdisplayfx', 'logs', 'Acessar logs do SmartDisplayFX'),
  
  -- Auditoria
  ('audit.read', 'audit', 'read', 'Ler logs de auditoria'),
  ('audit.export', 'audit', 'export', 'Exportar logs de auditoria'),
  
  -- Backup
  ('backup.read', 'backup', 'read', 'Ler backups'),
  ('backup.create', 'backup', 'create', 'Criar backups'),
  ('backup.restore', 'backup', 'restore', 'Restaurar backups'),
  
  -- Monitoramento
  ('monitoring.read', 'monitoring', 'read', 'Ler monitoramento'),
  ('monitoring.update', 'monitoring', 'update', 'Atualizar monitoramento'),
  
  -- Player
  ('player.authenticate', 'player', 'authenticate', 'Autenticar player'),
  ('player.heartbeat', 'player', 'heartbeat', 'Enviar heartbeat'),
  ('player.playlist.download', 'player', 'playlist.download', 'Download de playlist'),
  ('player.media.download', 'player', 'media.download', 'Download de mídia'),
  ('player.logs.upload', 'player', 'logs.upload', 'Upload de logs'),
  ('player.screenshot.upload', 'player', 'screenshot.upload', 'Upload de screenshot')
ON CONFLICT (name) DO NOTHING;
```

### Relações Role-Permissão

```sql
-- Todas as relações foram criadas no smartchannel-db-v2-refactored-apply-all.sql

-- ADMIN_SQL: Todas as permissões
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin_sql'
ON CONFLICT DO NOTHING;

-- OPERATOR: Apenas permissões do sistema (sem dados de clientes)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'operator'
  AND (
    p.resource IN ('system', 'settings', 'logs', 'ota', 'smartdisplayfx', 'monitoring', 'backup')
    OR (p.resource = 'totems' AND p.action IN ('read', 'update', 'restart', 'screenshot', 'logs'))
  )
ON CONFLICT DO NOTHING;

-- ADMIN: Permissões do cliente (próprio cliente)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.resource IN ('clients', 'users', 'campaigns', 'medias', 'playlists', 'totems', 'reports', 'analytics', 'billing', 'smartdisplayfx', 'audit', 'settings')
  AND p.resource NOT IN ('system', 'database', 'roles', 'permissions')
ON CONFLICT DO NOTHING;

-- MANAGER: Permissões limitadas do cliente
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manager'
  AND p.resource IN ('campaigns', 'medias', 'playlists', 'totems', 'reports', 'analytics', 'smartdisplayfx')
  AND p.action IN ('read', 'create', 'update', 'delete')
  AND p.resource NOT IN ('users', 'billing', 'clients')
ON CONFLICT DO NOTHING;

-- VIEWER: Apenas leitura
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'viewer'
  AND p.action = 'read'
  AND p.resource IN ('campaigns', 'medias', 'playlists', 'totems', 'reports', 'analytics', 'smartdisplayfx')
ON CONFLICT DO NOTHING;

-- CLIENT: Apenas permissões do player
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'client'
  AND p.resource = 'player'
ON CONFLICT DO NOTHING;
```

---

## 🔧 MIDDLEWARE DE PROTEÇÃO

### 1. Bloquear Acesso a Dados do Cliente (OPERATOR)

```typescript
// backend/src/middleware/operatorProtection.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { logWarn } from '../utils/loggerHelper';

/**
 * Middleware para bloquear acesso de OPERATOR a dados de clientes
 */
export const blockClientDataAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user?.role === 'operator') {
    // Recursos bloqueados para OPERATOR
    const blockedResources = [
      'campaigns',
      'medias',
      'playlists',
      'reports',
      'billing',
      'clients',
      'analytics',
      'smartdisplayfx' // Bloqueado, exceto config/logs técnicos
    ];

    // Extrair recurso da URL
    const pathParts = req.path.split('/').filter(p => p);
    const resource = pathParts[1]; // Ex: /api/campaigns -> campaigns

    if (blockedResources.includes(resource)) {
      // Exceções: SmartDisplayFX config/logs técnicos
      if (resource === 'smartdisplayfx') {
        const action = pathParts[2]; // Ex: /api/smartdisplayfx/logs -> logs
        if (action === 'logs' || action === 'config') {
          // Permitir acesso a logs/config técnicos
          next();
          return;
        }
      }

      // Exceções: Totens (apenas dados técnicos)
      if (resource === 'totems') {
        const action = pathParts[2]; // Ex: /api/totems/restart -> restart
        const allowedActions = ['restart', 'screenshot', 'logs', 'status'];
        if (allowedActions.includes(action)) {
          // Permitir ações técnicas
          next();
          return;
        }
      }

      logWarn('OPERATOR tentou acessar dados de cliente', {
        userId: req.user.id,
        username: req.user.username,
        resource,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        error: 'Acesso negado. Operadores não podem acessar dados de clientes.',
        code: 'CLIENT_DATA_ACCESS_DENIED',
        resource
      });
      return;
    }
  }

  next();
};
```

### 2. Requerer ADMIN_SQL

```typescript
// backend/src/middleware/adminSql.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Middleware para requerer role ADMIN_SQL
 */
export const requireAdminSql = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED'
    });
    return;
  }

  if (req.user.role !== 'admin_sql') {
    res.status(403).json({
      error: 'Acesso negado. Requer role ADMIN_SQL.',
      code: 'ADMIN_SQL_REQUIRED',
      current: req.user.role
    });
    return;
  }

  next();
};
```

### 3. Auditoria para ADMIN_SQL e OPERATOR

```typescript
// backend/src/middleware/auditSystemUsers.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AuditService } from '../services/auditService';

const auditService = new AuditService();

/**
 * Middleware para auditar ações de ADMIN_SQL e OPERATOR
 */
export const auditSystemUsers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.user && (req.user.role === 'admin_sql' || req.user.role === 'operator')) {
    // Capturar resposta original
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Registrar auditoria
      auditService.log(
        'system',
        `${req.method.toLowerCase()}_${req.path.replace(/\//g, '_')}`,
        req.user!.id,
        {
          role: req.user!.role,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          body: sanitizeForAudit(body)
        }
      ).catch(() => {}); // Não bloquear se auditoria falhar

      return originalJson(body);
    };
  }

  next();
};

function sanitizeForAudit(body: any): any {
  if (!body) return body;
  
  // Remover dados sensíveis
  const sanitized = { ...body };
  if (sanitized.password) delete sanitized.password;
  if (sanitized.password_hash) delete sanitized.password_hash;
  if (sanitized.token) delete sanitized.token;
  
  return sanitized;
}
```

---

## 📝 ATUALIZAR ROTAS

### Exemplo: Rotas de Campanhas

```typescript
// backend/src/routes/campaigns.ts

import { Router } from 'express';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { blockClientDataAccess } from '../middleware/operatorProtection.middleware';
import { requireClientAccess } from '../middleware/auth.middleware';

const router = Router();

// Aplicar bloqueio de dados do cliente para OPERATOR
router.use(blockClientDataAccess);

// GET /api/campaigns - Listar campanhas
router.get(
  '/',
  authMiddleware,
  authorizeRole(['admin', 'manager', 'viewer', 'admin_sql']), // OPERATOR não pode
  requireClientAccess, // Verificar acesso ao cliente
  async (req, res) => {
    // Implementação...
  }
);

// POST /api/campaigns - Criar campanha
router.post(
  '/',
  authMiddleware,
  authorizeRole(['admin', 'manager', 'admin_sql']), // OPERATOR não pode
  requireClientAccess,
  async (req, res) => {
    // Implementação...
  }
);
```

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Schema SQL atualizado** - Roles e permissões adicionadas ao `smartchannel-db-v2-refactored-apply-all.sql`
2. ✅ **Middlewares criados** - `operatorProtection.middleware.ts`, `adminSql.middleware.ts`, `auditSystemUsers.middleware.ts`
3. ⏳ **Atualizar todas as rotas** - Adicionar proteções nas rotas existentes
4. ⏳ **Testar hierarquia** - Validar bloqueios e permissões
5. ⏳ **Atualizar frontend** - Interface baseada em roles

---

**Última atualização:** 2024-01-XX

