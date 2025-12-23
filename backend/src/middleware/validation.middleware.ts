import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logError, sanitizeForLogging } from '../utils/loggerHelper';

/**
 * Middleware para validar requisições usando express-validator
 */
export const validateRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Sanitizar body antes de logar
    const sanitizedBody = sanitizeForLogging(req.body);
    
    // Criar Error object com mensagem de validação
    const validationError = new Error('Erro de validação de entrada');
    validationError.name = 'ValidationError';
    
    // Logar erro de validação (não bloqueante)
    logError('Erro de validação', validationError, {
      errors: errors.array(),
      body: sanitizedBody,
      file: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null,
      url: req.url,
      method: req.method
    }).catch(() => {
      // Fallback silencioso se logging falhar
    });
    
    res.status(400).json({
      error: 'Dados de entrada inválidos',
      message: 'Verifique os dados enviados',
      details: errors.array()
    });
    return;
  }
  
  return next();
};

/**
 * Middleware para validar parâmetros de paginação
 */
export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  const { page, limit } = req.query;
  
  if (page && (isNaN(Number(page)) || Number(page) < 1)) {
    return res.status(400).json({
      error: 'Parâmetro page deve ser um número inteiro maior que 0'
    });
  }
  
  if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    return res.status(400).json({
      error: 'Parâmetro limit deve ser um número inteiro entre 1 e 100'
    });
  }
  
  return next();
};

/**
 * Middleware para validar IDs numéricos
 */
export const validateNumericId = (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  
  if (!id || isNaN(Number(id)) || Number(id) < 1) {
    return res.status(400).json({
      error: 'ID deve ser um número inteiro maior que 0'
    });
  }
  
  return next();
};

/**
 * Middleware para validar datas
 */
export const validateDateRange = (req: Request, res: Response, next: NextFunction) => {
  const { startDate, endDate } = req.query;
  
  if (startDate && isNaN(Date.parse(startDate as string))) {
    return res.status(400).json({
      error: 'startDate deve ser uma data válida no formato ISO 8601'
    });
  }
  
  if (endDate && isNaN(Date.parse(endDate as string))) {
    return res.status(400).json({
      error: 'endDate deve ser uma data válida no formato ISO 8601'
    });
  }
  
  if (startDate && endDate && new Date(startDate as string) > new Date(endDate as string)) {
    return res.status(400).json({
      error: 'startDate deve ser anterior a endDate'
    });
  }
  
  return next();
};

/**
 * Middleware para validar arquivos de upload
 */
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      error: 'Nenhum arquivo foi enviado'
    });
  }
  
  return next();
};

/**
 * Middleware para validar tamanho de arquivo
 */
export const validateFileSize = (maxSizeInMB: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    
    if (file && file.size > maxSizeInBytes) {
      return res.status(400).json({
        error: `Arquivo muito grande. Tamanho máximo permitido: ${maxSizeInMB}MB`
      });
    }
    
    return next();
  };
};

/**
 * Middleware para validar tipos de arquivo
 */
export const validateFileType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    
    if (file && !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: `Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(', ')}`
      });
    }
    
    return next();
  };
};

/**
 * Middleware para sanitizar entrada de dados
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  // Sanitizar strings removendo caracteres perigosos
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };
  
  // Sanitizar body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    });
  }
  
  // Sanitizar query parameters
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string);
      }
    });
  }
  
  return next();
};

/**
 * Middleware para validar permissões de acesso
 */
export const validatePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Usuário não autenticado'
      });
    }
    
    if (!user.permissions || !user.permissions.includes(permission)) {
      return res.status(403).json({
        error: 'Permissão insuficiente'
      });
    }
    
    return next();
  };
};

/**
 * Middleware para validar role de usuário
 */
export const validateRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Usuário não autenticado'
      });
    }
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: 'Role insuficiente'
      });
    }
    
    return next();
  };
};

/**
 * Middleware para validar rate limiting
 */
export const validateRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Limpar requisições antigas
    for (const [key, value] of requests.entries()) {
      if (value.resetTime < windowStart) {
        requests.delete(key);
      }
    }
    
    // Verificar limite
    const clientRequests = requests.get(clientId);
    if (!clientRequests) {
      requests.set(clientId, { count: 1, resetTime: now });
    } else if (clientRequests.resetTime < windowStart) {
      requests.set(clientId, { count: 1, resetTime: now });
    } else if (clientRequests.count >= maxRequests) {
      return res.status(429).json({
        error: 'Muitas requisições. Tente novamente mais tarde.'
      });
    } else {
      clientRequests.count++;
    }
    
    return next();
  };
};
