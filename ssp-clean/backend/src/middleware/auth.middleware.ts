/**
 * Auth Middleware - Smart Signage v2.0
 * Middleware de autenticação JWT
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';
import { config } from '../config/env';
import { UserFlags } from '../utils/flagChecker';

// Declaração de módulo para estender tipos do Express
declare global {
  namespace Express {
      interface Request {
      user?: {
        id: number;
        userId: number; // Alias para id (compatibilidade)
        username: string;
        email: string;
        role: string;
        publisherId?: number; // NOVO: FK para publishers
        subscriberId?: number; // NOVO: Para subscribers (derivado de publisher ou direto)
        clientId?: number; // DEPRECADO: Mantido para compatibilidade
        userType?: 'system_user' | 'subscriber_user' | 'publisher_user'; // NOVO
        isTenantUser?: boolean; // NOVO
        flags?: UserFlags; // NOVO: Flags de permissão do usuário
      };
      subscriberId?: number; // Adicionado pelo subscriberIsolationMiddleware
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    userId: number; // Alias para id (compatibilidade)
    username: string;
    email: string;
    role: string;
    publisherId?: number; // NOVO
    subscriberId?: number; // NOVO
    clientId?: number; // DEPRECADO
    userType?: 'system_user' | 'subscriber_user' | 'publisher_user'; // NOVO
    isTenantUser?: boolean; // NOVO
    flags?: UserFlags; // NOVO: Flags de permissão do usuário
  };
  subscriberId?: number; // Adicionado pelo subscriberIsolationMiddleware
}

// Tipo para quando user está garantido (após middleware de auth)
export interface AuthenticatedRequestWithUser extends Request {
  user: {
    id: number;
    userId: number;
    username: string;
    email: string;
    role: string;
    publisherId?: number; // NOVO
    subscriberId?: number; // NOVO
    clientId?: number; // DEPRECADO
    userType?: 'system_user' | 'subscriber_user' | 'publisher_user'; // NOVO
    isTenantUser?: boolean; // NOVO
    flags?: UserFlags; // NOVO
  };
  subscriberId?: number;
}

/**
 * Middleware de autenticação JWT
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Token de acesso não fornecido',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    
    if (!token) {
      res.status(401).json({
        error: 'Token de acesso inválido',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    // Verificar token
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // Verificar se usuário ainda existe e está ativo
    const db = getDatabase();
    const user = await db.findFirst(`
      SELECT 
        id, username, email, role, 
        publisher_id, user_type, is_tenant_user,
        is_active
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [decoded.userId]);

    if (!user) {
      res.status(401).json({
        error: 'Usuário não encontrado ou inativo',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Determinar subscriberId se aplicável
    // Prioridade: 1) subscriberId do token (login subscriber), 2) publisher com is_subscriber, 3) clientId do token
    let subscriberId: number | undefined = undefined;
    
    // 1. Se o token tem subscriberId (login subscriber)
    if (decoded.subscriberId) {
      subscriberId = decoded.subscriberId;
    } else if (user.publisher_id) {
      // 2. Buscar publisher e verificar se é subscriber
      const publisher = await db.findFirst(`
        SELECT publisher_id, is_subscriber, email
        FROM publishers 
        WHERE publisher_id = $1 AND COALESCE(is_active, true) = true
      `, [user.publisher_id]);
      
      if (publisher?.is_subscriber) {
        // Buscar subscriber pelo email do publisher
        const subscriber = await db.findFirst(`
          SELECT subscriber_id
          FROM subscribers
          WHERE email = $1 AND is_active = true
        `, [publisher.email]);
        
        if (subscriber) {
          subscriberId = subscriber.subscriber_id;
        }
      }
    }
    
    // 3. Fallback: usar clientId do token se disponível (compatibilidade)
    if (!subscriberId && decoded.clientId) {
      subscriberId = decoded.clientId;
    }

    // Carregar flags efetivas do usuário (personalizadas + padrão da role)
    // Usa função SQL get_user_effective_flags() quando disponível
    let userFlags: UserFlags | undefined = undefined;
    try {
      const flagsTableExists = await db.tableExists('user_flags');
      if (flagsTableExists) {
        // Tentar usar função SQL (mais eficiente)
        try {
          const effectiveFlags = await db.findFirst(`
            SELECT * FROM get_user_effective_flags($1)
          `, [user.id]) as UserFlags | null;
          
          if (effectiveFlags) {
            userFlags = effectiveFlags;
          } else {
            // Fallback: usar função TypeScript
            const { getUserEffectiveFlags } = await import('../utils/flagChecker');
            userFlags = await getUserEffectiveFlags({
              id: user.id,
              role: user.role,
              user_type: user.user_type,
              publisher_id: user.publisher_id
            });
          }
        } catch (sqlError) {
          // Se função SQL não existir, usar função TypeScript
          const { getUserEffectiveFlags } = await import('../utils/flagChecker');
          userFlags = await getUserEffectiveFlags({
            id: user.id,
            role: user.role,
            user_type: user.user_type,
            publisher_id: user.publisher_id
          });
        }
      }
    } catch (error) {
      // Se tabela não existir ainda, continuar sem flags
      // Usar logWarn de forma não-bloqueante (não esperar)
      import('../utils/loggerHelper').then(({ logWarn }) => {
        logWarn('Sistema de flags não disponível, continuando sem flags', { error: error instanceof Error ? error.message : String(error) }).catch(() => {});
      }).catch(() => {});
    }

    // Adicionar dados do usuário à requisição
    req.user = {
      id: user.id,
      userId: user.id, // Alias para compatibilidade com rotas que usam userId
      username: user.username,
      email: user.email || '',
      role: user.role,
      publisherId: user.publisher_id || undefined,
      subscriberId: subscriberId,
      clientId: subscriberId || undefined, // DEPRECADO: Usar subscriberId como fallback para compatibilidade
      userType: user.user_type || undefined,
      isTenantUser: user.is_tenant_user || false,
      flags: userFlags // NOVO: Flags de permissão
    };

    next();

  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Token inválido',
        code: 'INVALID_TOKEN'
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
      return;
    }

    await logError('Erro no middleware de auth', error, {
      errorName: error.name,
      url: req.url,
      method: req.method
    });
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Export aliases para compatibilidade
export const authenticateToken = authMiddleware;

// Middleware de autorização por role
export const authorizeRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // owner_system tem acesso total a todos os recursos (bypass completo)
    // admin_sql tem acesso a recursos técnicos e administrativos, mas ainda precisa de flags para operações específicas
    // Para operações que requerem flags específicas, use requireFlag() em conjunto com authorizeRole()
    if (req.user.role === 'owner_system') {
      next();
      return;
    }

    // admin_sql pode acessar rotas de admin, mas ainda precisa verificar flags quando aplicável
    // Se a rota requer uma role específica e admin_sql não está na lista, verificar se é admin_sql
    if (req.user.role === 'admin_sql' && (roles.includes('admin') || roles.includes('admin_sql'))) {
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Acesso negado. Permissões insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
      return;
    }

    next();
  };
};

/**
 * Middleware de autorização por role
 */
export const requireRole = (roles: string | string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Acesso negado. Permissão insuficiente.',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: userRole
      });
      return;
    }

    next();
  };
};

/**
 * Middleware de autorização por permissão
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Usuário não autenticado',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const db = getDatabase();
      const permission = await db.findFirst(`
        SELECT p.name
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.permission_id
        WHERE ur.user_id = ? AND p.resource = ? AND p.action = ?
      `, [req.user.id, resource, action]);

      if (!permission) {
        res.status(403).json({
          error: 'Acesso negado. Permissão insuficiente.',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: `${resource}.${action}`
        });
        return;
      }

      next();

    } catch (error: any) {
      await logError('Erro no middleware de permissão', error, {
        resource,
        action,
        userId: req.user?.id,
        url: req.url,
        method: req.method
      });
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Middleware para verificar se usuário pertence ao cliente
 */
export const requireClientAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED'
    });
    return;
  }

  // ADMIN_SQL pode acessar qualquer cliente (com restrições de privacidade)
  if (req.user.role === 'admin_sql') {
    next();
    return;
  }

  // OPERATOR não pode acessar dados de clientes (bloqueado pelo blockClientDataAccess)
  // Mas se chegou aqui, pode continuar (para rotas técnicas)
  if (req.user.role === 'operator') {
    next();
    return;
  }

  // ADMIN do cliente pode acessar qualquer cliente (próprio cliente)
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Outros usuários (gerente_marketing, editoracao, visualizador) só podem acessar dados do próprio cliente
  const clientId = req.params.clientId || req.body.clientId || req.query.clientId;
  
  if (clientId && req.user.clientId !== parseInt(clientId)) {
    res.status(403).json({
      error: 'Acesso negado. Você só pode acessar dados do seu cliente.',
      code: 'CLIENT_ACCESS_DENIED'
    });
    return;
  }

  next();
};

/**
 * Middleware opcional de autenticação (não falha se não houver token)
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      next();
      return;
    }

    // Verificar token
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // Verificar se usuário ainda existe e está ativo
    const db = getDatabase();
    const user = await db.findFirst(`
      SELECT 
        id, username, email, role, 
        publisher_id, user_type, is_tenant_user,
        is_active
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [decoded.userId]);

    if (user) {
      // Determinar subscriberId se aplicável (mesma lógica do authMiddleware)
      let subscriberId: number | undefined = undefined;
      if (user.publisher_id) {
        const publisher = await db.findFirst(`
          SELECT publisher_id, is_subscriber 
          FROM publishers 
          WHERE publisher_id = $1 AND COALESCE(is_active, true) = true
        `, [user.publisher_id]);
        
        if (publisher?.is_subscriber) {
          subscriberId = user.publisher_id;
        }
      }

      req.user = {
        id: user.id,
        userId: user.id, // Alias para compatibilidade
        username: user.username,
        email: user.email || '',
        role: user.role,
        publisherId: user.publisher_id || undefined,
        subscriberId: subscriberId,
        clientId: subscriberId || undefined, // DEPRECADO: Usar subscriberId como fallback
        userType: user.user_type || undefined,
        isTenantUser: user.is_tenant_user || false
      };
    }

    next();

  } catch (error) {
    // Em caso de erro, continua sem autenticação
    next();
  }
};

/**
 * Middleware para verificar PIN de abandono do player
 */
export const verifyAbandonPin = (req: Request, res: Response, next: NextFunction): void => {
  const { pin } = req.body;
  const correctPin = config.security.playerAbandonPin;

  if (!pin) {
    res.status(400).json({
      error: 'PIN é obrigatório',
      code: 'PIN_REQUIRED'
    });
    return;
  }

  if (pin !== correctPin) {
    res.status(401).json({
      error: 'PIN incorreto',
      code: 'INVALID_PIN'
    });
    return;
  }

  next();
};
