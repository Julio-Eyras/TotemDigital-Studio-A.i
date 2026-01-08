/**
 * Validadores Específicos para Media
 */

import { body, query } from 'express-validator';

/**
 * Validadores para filtros de media
 */
export const mediaFilterValidators = [
  query('type').optional().isIn(['image', 'video', 'audio']).withMessage('Tipo deve ser: image, video ou audio'),
  query('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  query('search').optional().isString().withMessage('Busca deve ser uma string'),
];

/**
 * Validadores para atualização de media
 */
export const updateMediaValidators = [
  body('name').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Nome deve ter entre 1 e 100 caracteres'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
  body('tags').optional().isString().withMessage('Tags deve ser uma string'),
  body('status').optional().isString().withMessage('Status deve ser uma string'),
  body('approvalStatus').optional().isString().withMessage('approvalStatus deve ser uma string'),
  body('rejectionReason').optional().isString().withMessage('rejectionReason deve ser uma string'),
];
