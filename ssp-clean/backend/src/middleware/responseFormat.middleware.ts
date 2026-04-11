/**
 * Middleware de Resposta Padronizada
 * Smart Signage Pro v2.1 - PLANO_MELHORIAS item 4
 *
 * Estende res.json para usar successResponse/errorResponse quando aplicável.
 * Uso: res.json(successResponse(data)) ou res.status(400).json(errorResponse('msg'))
 *
 * Para respostas que já seguem o padrão { success, data/error }, não altera.
 * Permite migração gradual das rotas.
 */

import { Request, Response, NextFunction } from 'express';
import { successResponse, errorResponse } from '../utils/apiResponse';

declare global {
  namespace Express {
    interface Response {
      successJson?: (data: unknown, meta?: Record<string, unknown>) => void;
      errorJson?: (message: string, error?: string, details?: Record<string, unknown>) => void;
    }
  }
}

/**
 * Middleware que adiciona helpers successJson e errorJson ao res
 * para padronizar respostas da API.
 */
export function responseFormatMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.successJson = (data: unknown, meta?: Record<string, unknown>) => {
    res.json(successResponse(data, meta));
  };

  res.errorJson = (message: string, error?: string, details?: Record<string, unknown>) => {
    res.status(res.statusCode >= 400 ? res.statusCode : 400).json(
      errorResponse(message, error, details)
    );
  };

  next();
}
