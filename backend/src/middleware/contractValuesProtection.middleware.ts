/**
 * Middleware para proteger valores contratuais sensíveis
 * Remove campos reservados da resposta baseado no role do usuário
 */

import { Request, Response, NextFunction } from 'express';

// Roles que podem ver valores contratuais sensíveis
const AUTHORIZED_ROLES = ['admin', 'admin_sql', 'owner_system', 'operador_faturamento'];

// Campos sensíveis que devem ser ocultados
const SENSITIVE_FIELDS = [
  'total_amount',
  'payment_terms',
  'revenue_share_percentage',
  'revenue_share_rules',
  'minimum_payout_amount',
  'subscription_amount',
];

/**
 * Middleware para proteger valores contratuais na resposta
 */
export const protectContractValues = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  const canViewSensitiveValues = Boolean(user && AUTHORIZED_ROLES.includes(user.role));

  // Interceptar resposta
  const originalJson = res.json.bind(res);
  
  res.json = function (data: unknown) {
    if (!canViewSensitiveValues && data != null && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      // Se for array, processar cada item
      if (Array.isArray(d.data)) {
        (d.data as unknown[]) = (d.data as unknown[]).map(
          (contract) => sanitizeContract(contract as Record<string, unknown>)
        );
      } else if (Array.isArray(data)) {
        return originalJson(
          (data as unknown[]).map((contract) =>
            sanitizeContract(contract as Record<string, unknown>)
          )
        );
      } else if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
        // Se for objeto único
        d.data = sanitizeContract(d.data as Record<string, unknown>);
      } else if (typeof data === 'object') {
        // Se for objeto direto
        return originalJson(sanitizeContract(data as Record<string, unknown>));
      }
    }
    
    return originalJson(data);
  };

  next();
};

/**
 * Remove campos sensíveis de um contrato
 */
function sanitizeContract<T extends Record<string, unknown>>(contract: T): T {
  if (!contract || typeof contract !== 'object') {
    return contract;
  }

  const sanitized: Record<string, unknown> = { ...contract };
  
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  return sanitized as T;
}
