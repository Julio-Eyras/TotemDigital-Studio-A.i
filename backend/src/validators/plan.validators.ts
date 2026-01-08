/**
 * Validadores Específicos para Limites de Plano
 */

import { query } from 'express-validator';

/**
 * Validadores para validação de limites de plano
 */
export const planLimitsValidators = [
  query('resourceType').isIn(['media', 'playlist', 'campaign']).withMessage('Tipo de recurso inválido. Deve ser: media, playlist ou campaign'),
];

/**
 * Validadores para validação de storage
 */
export const storageValidators = [
  query('fileSizeBytes').isInt({ min: 0 }).withMessage('fileSizeBytes deve ser um número inteiro maior ou igual a 0'),
];

/**
 * Validadores para validação de acesso a totem
 */
export const totemAccessValidators = [
  query('totemId').isInt({ min: 1 }).withMessage('totemId deve ser um número inteiro maior que 0'),
];
