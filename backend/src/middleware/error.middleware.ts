/**
 * Error Middleware - Smart Signage v2.0
 * Middleware para tratamento de erros
 */

import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/auditService';
import { logError } from '../utils/loggerHelper';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = async (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statusCode = err.statusCode || 500;
    const isOperational = err.isOperational !== false;

    // Log do erro
    await logError('Erro capturado pelo error handler', err, {
      statusCode,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Log de auditoria para erros operacionais
    if (isOperational && req.user?.id) {
      try {
        const auditService = new AuditService();
        await auditService.log('error', 'occurred', req.user.id, {
          error: err.message,
          statusCode,
          url: req.url,
          method: req.method
        });
      } catch (auditError) {
        await logError('Erro ao registrar auditoria no error handler', auditError, { 
          originalError: err.message,
          statusCode 
        });
      }
    }

    // Resposta baseada no ambiente
    if (process.env.NODE_ENV === 'development') {
      res.status(statusCode).json({
        success: false,
        error: {
          message: err.message,
          statusCode,
          stack: err.stack,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // Em produção, não expor detalhes do erro
      res.status(statusCode).json({
        success: false,
        error: {
          message: isOperational ? err.message : 'Erro interno do servidor',
          statusCode,
          timestamp: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    // Se o error handler falhar, usar console.error como último recurso
    console.error('❌ Erro crítico no error handler:', error);
    try {
      await logError('Erro crítico no error handler', error, {});
    } catch {
      // Ignorar se até o log falhar
    }
    res.status(500).json({
      success: false,
      error: {
        message: 'Erro interno do servidor',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new CustomError(`Rota não encontrada: ${req.originalUrl}`, 404);
  next(error);
};

export const validationErrorHandler = (message: string) => {
  return new CustomError(message, 400);
};

export const unauthorizedErrorHandler = (message: string = 'Não autorizado') => {
  return new CustomError(message, 401);
};

export const forbiddenErrorHandler = (message: string = 'Acesso negado') => {
  return new CustomError(message, 403);
};

export const notFoundErrorHandler = (message: string = 'Recurso não encontrado') => {
  return new CustomError(message, 404);
};

export const conflictErrorHandler = (message: string = 'Conflito de recursos') => {
  return new CustomError(message, 409);
};

export const unprocessableEntityErrorHandler = (message: string = 'Entidade não processável') => {
  return new CustomError(message, 422);
};

export const tooManyRequestsErrorHandler = (message: string = 'Muitas requisições') => {
  return new CustomError(message, 429);
};

export const internalServerErrorHandler = (message: string = 'Erro interno do servidor') => {
  return new CustomError(message, 500);
};

export const serviceUnavailableErrorHandler = (message: string = 'Serviço indisponível') => {
  return new CustomError(message, 503);
};
