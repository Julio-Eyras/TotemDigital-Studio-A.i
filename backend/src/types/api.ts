/**
 * Tipos de API - Smart Signage Pro v3.1
 * Tipos específicos para rotas e endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse, PaginationParams, CommonFilters } from './shared';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Request tipado com autenticação (alias para compatibilidade)
 */
export type AuthenticatedRequestType = AuthenticatedRequest;

// Re-export para compatibilidade
export type { AuthenticatedRequest, AuthenticatedRequestWithUser } from '../middleware/auth.middleware';

/**
 * Handler de rota tipado
 */
export type RouteHandler = (
  req: AuthenticatedRequestType,
  res: Response<ApiResponse>,
  next: NextFunction
) => Promise<void> | void;

/**
 * Middleware tipado
 */
export type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

/**
 * Parâmetros de query comuns
 */
export interface QueryParams extends PaginationParams, CommonFilters {
  clientId?: number;
  userId?: number;
  status?: string;
  type?: string;
}

/**
 * Parâmetros de rota comuns
 */
export interface RouteParams {
  id?: string;
  userId?: string;
  clientId?: string;
  totemId?: string;
  campaignId?: string;
  mediaId?: string;
  playlistId?: string;
}

/**
 * Body de criação genérico
 */
export interface CreateBody {
  name?: string;
  description?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Body de atualização genérico
 */
export interface UpdateBody extends Partial<CreateBody> {
  id?: number;
}

/**
 * Resposta de criação
 */
export interface CreateResponse<T = unknown> extends ApiResponse<T> {
  data: T;
  message: string;
}

/**
 * Resposta de atualização
 */
export interface UpdateResponse<T = unknown> extends ApiResponse<T> {
  data: T;
  message: string;
}

/**
 * Resposta de deleção
 */
export interface DeleteResponse extends ApiResponse {
  message: string;
}

/**
 * Resposta de listagem paginada
 */
export interface ListResponse<T = unknown> extends ApiResponse<T[]> {
  data: T[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

