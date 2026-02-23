/**
 * Validadores Específicos para Contratos
 */

import { body, query } from 'express-validator';

/**
 * Validadores para criação de subscriber contract
 */
export const createSubscriberContractValidators = [
  body('subscriber_id').optional().isInt({ min: 1 }).withMessage('subscriber_id deve ser um número inteiro maior que 0'),
  body('contract_number').notEmpty().withMessage('Número do contrato é obrigatório'),
  body('contract_type').isIn(['advertising', 'subscription', 'partnership']).withMessage('Tipo de contrato inválido'),
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('start_date').isISO8601().withMessage('Data de início inválida'),
  body('end_date').optional().isISO8601().withMessage('Data de término inválida'),
  body('plan_id').optional().isInt({ min: 1 }).withMessage('plan_id deve ser um número inteiro maior que 0'),
  body('total_amount').optional().isFloat({ min: 0 }).withMessage('total_amount deve ser um número positivo'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }).withMessage('Moeda deve ter 3 caracteres (ex: BRL)'),
  body('status').optional().isIn(['draft', 'active', 'expired', 'terminated', 'cancelled']).withMessage('Status inválido'),
  body('publisherIds').optional().isArray().withMessage('publisherIds deve ser um array'),
 
];

/**
 * Validadores para atualização de subscriber contract
 */
export const updateSubscriberContractValidators = [
  body('contract_number').optional().notEmpty().withMessage('Número do contrato não pode ser vazio'),
  body('contract_type').optional().isIn(['advertising', 'subscription', 'partnership']).withMessage('Tipo de contrato inválido'),
  body('title').optional().notEmpty().withMessage('Título não pode ser vazio'),
  body('start_date').optional().isISO8601().withMessage('Data de início inválida'),
  body('end_date').optional().isISO8601().withMessage('Data de término inválida'),
  body('plan_id').optional().isInt({ min: 1 }).withMessage('plan_id deve ser um número inteiro maior que 0'),
  body('total_amount').optional().isFloat({ min: 0 }).withMessage('total_amount deve ser um número positivo'),
  body('status').optional().isIn(['draft', 'active', 'expired', 'terminated', 'cancelled']).withMessage('Status inválido'),
  body('publisherIds').optional().isArray().withMessage('publisherIds deve ser um array'),
];

/**
 * Validadores para criação de publisher contract
 */
export const createPublisherContractValidators = [
  body('contract_number').notEmpty().withMessage('Número do contrato é obrigatório'),
  body('contract_type').isIn(['revenue_share', 'subscription', 'partnership', 'hybrid']).withMessage('Tipo de contrato inválido'),
  body('title').notEmpty().withMessage('Título é obrigatório'),
  body('start_date').isISO8601().withMessage('Data de início inválida'),
  body('end_date').optional().isISO8601().withMessage('Data de término inválida'),
  body('publisher_id').optional().isInt({ min: 1 }).withMessage('publisher_id deve ser um número inteiro maior que 0'),
 
  body('revenue_share_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('revenue_share_percentage deve ser entre 0 e 100'),
  body('minimum_payout_amount').optional().isFloat({ min: 0 }).withMessage('minimum_payout_amount deve ser um número positivo'),
];

/**
 * Validadores para atualização de publisher contract
 */
export const updatePublisherContractValidators = [
  body('contract_type').optional().isIn(['revenue_share', 'subscription', 'partnership', 'hybrid']).withMessage('Tipo de contrato inválido'),
  body('status').optional().isIn(['draft', 'active', 'expired', 'terminated', 'cancelled']).withMessage('Status inválido'),
  body('revenue_share_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('revenue_share_percentage deve ser entre 0 e 100'),
  body('minimum_payout_amount').optional().isFloat({ min: 0 }).withMessage('minimum_payout_amount deve ser um número positivo'),
];

/**
 * Validadores para filtros de contratos
 */
export const contractFilterValidators = [
  query('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  query('publisherId').optional().isInt({ min: 1 }).withMessage('publisherId deve ser um número inteiro maior que 0'),
  query('planId').optional().isInt({ min: 1 }).withMessage('planId deve ser um número inteiro maior que 0'),
  query('status').optional().isString().withMessage('Status deve ser uma string'),
  query('contractType').optional().isString().withMessage('contractType deve ser uma string'),
  query('activeOnly').optional().isIn(['true', 'false', '1', '0']).withMessage('activeOnly deve ser "true" ou "false"'),
];
