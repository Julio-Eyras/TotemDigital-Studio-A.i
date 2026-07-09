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
  body('name').optional({ nullable: true }).isString().isLength({ min: 1, max: 100 }).withMessage('Nome deve ter entre 1 e 100 caracteres'),
  body('description').optional({ nullable: true }).isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
  body('tags').optional({ nullable: true }).custom((value) => {
    // Aceitar string ou array (será convertido para string na rota)
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return true;
    if (Array.isArray(value)) return true;
    return false;
  }).withMessage('Tags deve ser uma string ou array'),
  body('status').optional({ nullable: true }).isString().withMessage('Status deve ser uma string'),
  body('approvalStatus').optional({ nullable: true }).isIn(['pending', 'approved', 'rejected']).withMessage('approvalStatus deve ser: pending, approved ou rejected'),
  body('rejectionReason').optional({ nullable: true }).isString().withMessage('rejectionReason deve ser uma string'),
  body('isActive').optional({ nullable: true }).isBoolean().withMessage('isActive deve ser boolean'),
];
