/**
 * Tipos Compartilhados - Smart Signage Pro v3.1
 * Tipos comuns usados em todo o sistema para eliminar `any`
 */

/**
 * Resposta padrão da API
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiError;
  timestamp?: string;
}

/**
 * Erro padrão da API
 */
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Request com usuário autenticado
 */
export interface AuthenticatedRequest {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    clientId?: number;
  };
}

/**
 * Resultado de query do banco de dados
 */
export interface DatabaseResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * Resposta de serviço padronizada
 */
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginação padrão
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Filtros comuns
 */
export interface CommonFilters {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

/**
 * Metadata genérica
 */
export type Metadata = Record<string, unknown>;

/**
 * Opções de configuração
 */
export type ConfigOptions = Record<string, string | number | boolean | null | undefined>;

/**
 * Callback genérico
 */
export type Callback<T = void> = (error?: Error | null, result?: T) => void;

/**
 * Async callback genérico
 */
export type AsyncCallback<T = void> = (error?: Error | null, result?: T) => Promise<void>;

/**
 * Event handler genérico
 */
export type EventHandler<T = unknown> = (data: T) => void | Promise<void>;

/**
 * Validator function
 */
export type Validator<T = unknown> = (value: T) => boolean | string;

/**
 * Transform function
 */
export type Transform<TInput = unknown, TOutput = unknown> = (input: TInput) => TOutput;

/**
 * Filter function
 */
export type Filter<T = unknown> = (item: T) => boolean;

/**
 * Mapper function
 */
export type Mapper<TInput = unknown, TOutput = unknown> = (item: TInput, index?: number) => TOutput;

/**
 * Reducer function
 */
export type Reducer<T = unknown, TAccumulator = unknown> = (
  accumulator: TAccumulator,
  current: T,
  index?: number
) => TAccumulator;

