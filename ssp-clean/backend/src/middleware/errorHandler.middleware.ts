/**
 * Error Handler Middleware - Smart Signage Pro v3.1
 * Middleware avançado para tratamento de erros e logging
 */

import { Request, Response, NextFunction } from 'express';
import { logError, logWarn } from '../utils/loggerHelper';
import { getNotificationService } from '../services/notificationService';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
  details?: Record<string, unknown>;
}

/**
 * Classe de erro customizada
 */
export class CustomError extends Error implements AppError {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware de tratamento de erros
 */
export const errorHandler = async (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Se já foi enviada resposta, passar para próximo handler
  if (res.headersSent) {
    return next(err);
  }

  // Determinar status code
  const statusCode = (err as AppError).statusCode || 500;
  const code = (err as AppError).code || 'INTERNAL_ERROR';
  const isOperational = (err as AppError).isOperational !== false;

  // Log do erro
  const errorContext = {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    user: (req as any).user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };

  if (statusCode >= 500) {
    // Erro do servidor - log completo
    await logError('Erro do servidor', err as Error, errorContext);
    
    // Enviar notificação para admins em caso de erro crítico
    if (statusCode >= 500) {
      try {
        const notificationService = getNotificationService();
        await notificationService.sendNotification({
          type: 'error',
          title: 'Erro Crítico no Sistema',
          message: `Erro ${code} em ${req.method} ${req.path}`,
          data: {
            error: err.message,
            statusCode,
            path: req.path
          }
        });
      } catch {
        // Ignorar erros ao enviar notificação
      }
    }
  } else {
    // Erro do cliente - log como warning
    await logWarn('Erro do cliente', {
      error: err.message,
      code,
      statusCode,
      ...errorContext
    });
  }

  // Resposta ao cliente
  const response: Record<string, unknown> = {
    success: false,
    error: {
      message: isOperational ? err.message : 'Erro interno do servidor',
      code,
      statusCode
    },
    timestamp: new Date().toISOString()
  };

  // Adicionar detalhes em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    response.error = {
      ...(response.error || {}),
      stack: err.stack,
      details: (err as AppError).details
    };
  }

  res.status(statusCode).json(response);
};

/**
 * Middleware para capturar erros assíncronos
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Criar erro customizado
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: Record<string, unknown>
): CustomError {
  return new CustomError(message, statusCode, code, true, details);
}

/**
 * Erros comuns pré-definidos
 */
export const Errors = {
  NotFound: (resource: string) => createError(
    `${resource} não encontrado`,
    404,
    'NOT_FOUND',
    { resource }
  ),
  Unauthorized: (message: string = 'Não autorizado') => createError(
    message,
    401,
    'UNAUTHORIZED'
  ),
  Forbidden: (message: string = 'Acesso negado') => createError(
    message,
    403,
    'FORBIDDEN'
  ),
  BadRequest: (message: string, details?: Record<string, unknown>) => createError(
    message,
    400,
    'BAD_REQUEST',
    details
  ),
  ValidationError: (message: string, details?: Record<string, unknown>) => createError(
    message,
    422,
    'VALIDATION_ERROR',
    details
  ),
  Conflict: (message: string, details?: Record<string, unknown>) => createError(
    message,
    409,
    'CONFLICT',
    details
  ),
  InternalError: (message: string = 'Erro interno do servidor') => createError(
    message,
    500,
    'INTERNAL_ERROR'
  )
};

