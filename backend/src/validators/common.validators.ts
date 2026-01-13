/**
 * Validadores Comuns Centralizados
 * Reutilizáveis em múltiplas rotas
 */

import { body, query, param } from 'express-validator';

/**
 * Validadores de paginação padrão
 */
export const paginationValidators = [
  query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro maior que 0'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit deve ser um número inteiro entre 1 e 100'),
];

/**
 * Validadores de busca padrão
 */
export const searchValidators = [
  query('search').optional().isString().withMessage('Busca deve ser uma string'),
];

/**
 * Validadores de ordenação padrão
 */
export const sortValidators = [
  query('sortBy').optional().isString().withMessage('sortBy deve ser uma string'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('sortOrder deve ser "asc" ou "desc"'),
];

/**
 * Validadores de filtro de data
 */
export const dateRangeValidators = [
  query('createdFrom').optional().isISO8601().withMessage('createdFrom deve ser uma data válida (ISO8601)'),
  query('createdTo').optional().isISO8601().withMessage('createdTo deve ser uma data válida (ISO8601)'),
  query('startDate').optional().isISO8601().withMessage('startDate deve ser uma data válida (ISO8601)'),
  query('endDate').optional().isISO8601().withMessage('endDate deve ser uma data válida (ISO8601)'),
];

/**
 * Validadores de ID numérico
 * Função que retorna validadores para um parâmetro de rota específico
 */
export const idParamValidator = (paramName: string = 'id') => [
  param(paramName).isInt({ min: 1 }).withMessage(`${paramName} deve ser um número inteiro maior que 0`),
];

/**
 * Validadores de ID numérico (padrão 'id')
 * Mantido para compatibilidade com código existente que usa spread operator
 */
export const idParamValidatorDefault = idParamValidator('id');

/**
 * Validadores de subscriberId
 */
export const subscriberIdValidators = [
  body('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  query('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
];

/**
 * Validadores de contractId
 */
export const contractIdValidators = [
  body('contract_id').optional().isInt({ min: 1 }).withMessage('contract_id deve ser um número inteiro maior que 0'),
  query('contractId').optional().isInt({ min: 1 }).withMessage('contractId deve ser um número inteiro maior que 0'),
];

/**
 * Validadores de publisherId
 */
export const publisherIdValidators = [
  body('publisher_id').optional().isInt({ min: 1 }).withMessage('publisher_id deve ser um número inteiro maior que 0'),
  query('publisherId').optional().isInt({ min: 1 }).withMessage('publisherId deve ser um número inteiro maior que 0'),
];

/**
 * Validadores de status
 */
export const statusValidators = [
  query('status').optional().isString().withMessage('Status deve ser uma string'),
  query('is_active').optional().isBoolean().withMessage('is_active deve ser um booleano'),
  body('status').optional().isString().withMessage('Status deve ser uma string'),
  body('is_active').optional().isBoolean().withMessage('is_active deve ser um booleano'),
];

/**
 * Validadores de email
 */
export const emailValidators = [
  body('email').optional().isEmail().withMessage('Email deve ser válido'),
];

/**
 * Validadores de telefone
 */
export const phoneValidators = [
  body('phone').optional().isString().withMessage('Telefone deve ser uma string'),
  body('whatsapp').optional().isString().withMessage('WhatsApp deve ser uma string'),
];

/**
 * Validadores de nome
 */
export const nameValidators = [
  body('name').notEmpty().withMessage('Nome é obrigatório').isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
];

/**
 * Validadores de descrição
 */
export const descriptionValidators = [
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
];

/**
 * Validadores completos para listagem (pagination + search + sort + dateRange)
 */
export const listValidators = [
  ...paginationValidators,
  ...searchValidators,
  ...sortValidators,
  ...dateRangeValidators,
];

/**
 * Validadores para criação de recursos básicos
 */
export const createResourceValidators = [
  ...nameValidators,
  ...descriptionValidators,
  ...emailValidators,
  ...phoneValidators,
];

/**
 * Validadores para atualização de recursos básicos
 */
export const updateResourceValidators = [
  ...idParamValidatorDefault,
  body('name').optional().notEmpty().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  ...descriptionValidators,
  ...emailValidators,
  ...phoneValidators,
];
