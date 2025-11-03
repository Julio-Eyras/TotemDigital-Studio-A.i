/**
 * Auth Middleware - Smart Signage v2.0
 * Middleware de autenticação JWT
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
    clientId?: number;
  };
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Verificar se usuário ainda existe e está ativo
    const db = getDatabase();
    const user = await db.findFirst(`
      SELECT id, username, email, role, client_id, is_active
      FROM users 
      WHERE id = ? AND is_active = true
    `, [decoded.userId]);

    if (!user) {
      res.status(401).json({
        error: 'Usuário não encontrado ou inativo',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Adicionar dados do usuário à requisição
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email || '',
      role: user.role,
      clientId: user.client_id
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

    console.error('❌ Erro no middleware de auth:', error.message);
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
      console.error('❌ Erro no middleware de permissão:', error.message);
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

  // Admin pode acessar qualquer cliente
  if (req.user.role === 'admin') {
    next();
    return;
  }

  // Outros usuários só podem acessar dados do próprio cliente
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
  res: Response,
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Verificar se usuário ainda existe e está ativo
    const db = getDatabase();
    const user = await db.findFirst(`
      SELECT id, username, email, role, client_id, is_active
      FROM users 
      WHERE id = ? AND is_active = true
    `, [decoded.userId]);

    if (user) {
      req.user = {
        id: user.id,
        username: user.username,
        email: user.email || '',
        role: user.role,
        clientId: user.client_id
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
  const correctPin = process.env.PLAYER_ABANDON_PIN || '1234';

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
