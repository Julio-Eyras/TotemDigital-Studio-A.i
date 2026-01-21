/**
 * Helper functions para padronizar formato de resposta da API
 * Centraliza estrutura de respostas
 */

/**
 * Formata resposta de sucesso padronizada
 */
export function successResponse<T = any>(
  data: T,
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: any;
  }
) {
  return {
    success: true,
    data,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {})
  };
}

/**
 * Formata resposta de erro padronizada
 */
export function errorResponse(
  message: string,
  error?: string,
  details?: any,
  _statusCode?: number // Parâmetro reservado para uso futuro
) {
  return {
    success: false,
    error: message,
    message: error || message,
    ...(details && Object.keys(details).length > 0 ? { details } : {})
  };
}

/**
 * Formata resposta paginada padronizada
 */
export function paginatedResponse<T = any>(
  items: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  }
) {
  return successResponse(items, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page * pagination.limit < pagination.total,
      hasPrev: pagination.page > 1
    }
  });
}
