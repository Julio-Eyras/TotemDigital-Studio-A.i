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
  const user = (req as any).user;
  const canViewSensitiveValues = user && AUTHORIZED_ROLES.includes(user.role);

  // Interceptar resposta
  const originalJson = res.json.bind(res);
  
  res.json = function(data: any) {
    if (!canViewSensitiveValues && data) {
      // Se for array, processar cada item
      if (Array.isArray(data.data)) {
        data.data = data.data.map((contract: any) => sanitizeContract(contract));
      } else if (Array.isArray(data)) {
        data = data.map((contract: any) => sanitizeContract(contract));
      } else if (data.data && typeof data.data === 'object') {
        // Se for objeto único
        data.data = sanitizeContract(data.data);
      } else if (typeof data === 'object' && !Array.isArray(data)) {
        // Se for objeto direto
        data = sanitizeContract(data);
      }
    }
    
    return originalJson(data);
  };

  next();
};

/**
 * Remove campos sensíveis de um contrato
 */
function sanitizeContract(contract: any): any {
  if (!contract || typeof contract !== 'object') {
    return contract;
  }

  const sanitized = { ...contract };
  
  SENSITIVE_FIELDS.forEach(field => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });

  return sanitized;
}
