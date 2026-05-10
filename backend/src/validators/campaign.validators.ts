/**
 * Validadores Específicos para Campanhas
 */

import { body, query } from 'express-validator';

/**
 * Validadores para criação de campanha
 */
export const createCampaignValidators = [
  body('clientId').optional({ checkFalsy: true, nullable: true }).isInt({ min: 1 }).toInt().withMessage('clientId deve ser um número inteiro maior que 0'),
  body('subscriberId').optional({ checkFalsy: true, nullable: true }).isInt({ min: 1 }).toInt().withMessage('subscriberId deve ser um número inteiro maior que 0'),
  body('contractId').optional({ checkFalsy: true, nullable: true }).isInt({ min: 1 }).toInt().withMessage('contractId deve ser um número inteiro maior que 0'),
  body('title').notEmpty().withMessage('Título é obrigatório').isLength({ min: 3, max: 200 }).withMessage('Título deve ter entre 3 e 200 caracteres'),
  body('categorySegment').optional({ checkFalsy: true, nullable: true }).isString().isLength({ max: 100 }).withMessage('Categoria/Segmento deve ter no máximo 100 caracteres'),
  body('category_segment').optional({ checkFalsy: true, nullable: true }).isString().isLength({ max: 100 }).withMessage('Categoria/Segmento deve ter no máximo 100 caracteres'),
  body('description').optional({ checkFalsy: true, nullable: true }).isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
  body('campaignType').optional({ checkFalsy: true, nullable: true }).isString().withMessage('Tipo de campanha deve ser uma string'),
  body('priority').optional({ checkFalsy: true, nullable: true }).isInt({ min: 0, max: 10 }).toInt().withMessage('Prioridade deve ser entre 0 e 10'),
  body('startDate').optional({ checkFalsy: true, nullable: true }).isISO8601().withMessage('Data de início inválida'),
  body('endDate').optional({ checkFalsy: true, nullable: true }).isISO8601().withMessage('Data de término inválida'),
  body('startTime').optional({ checkFalsy: true, nullable: true }).matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de início inválida (formato: HH:mm)'),
  body('endTime').optional({ checkFalsy: true, nullable: true }).matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de término inválida (formato: HH:mm)'),
  body('daysOfWeek').optional({ checkFalsy: true, nullable: true }).isArray().withMessage('daysOfWeek deve ser um array'),
  body('status').optional({ checkFalsy: true, nullable: true }).isIn(['draft', 'pending_approval', 'active', 'approved', 'paused', 'finished', 'cancelled', 'deleted']).withMessage('Status inválido'),
  body('isActive').optional({ checkFalsy: true, nullable: true }).isBoolean().toBoolean().withMessage('isActive deve ser um booleano'),
  body('publisherIds').optional({ checkFalsy: true, nullable: true }).isArray().withMessage('publisherIds deve ser um array'),
  body('playlistIds').optional({ checkFalsy: true, nullable: true }).isArray().withMessage('playlistIds deve ser um array'),
  body('mediaIds').optional({ checkFalsy: true, nullable: true }).isArray().withMessage('mediaIds deve ser um array'),
];

/**
 * Validadores para atualização de campanha
 */
export const updateCampaignValidators = [
  body('title').optional({ nullable: true }).notEmpty().isLength({ min: 3, max: 200 }).withMessage('Título deve ter entre 3 e 200 caracteres'),
  body('categorySegment').optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage('Categoria/Segmento deve ter no máximo 100 caracteres'),
  body('category_segment').optional({ nullable: true }).isString().isLength({ max: 100 }).withMessage('Categoria/Segmento deve ter no máximo 100 caracteres'),
  body('description').optional({ nullable: true }).isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
  body('campaignType').optional({ nullable: true }).isString().withMessage('Tipo de campanha deve ser uma string'),
  body('campaign_type').optional({ nullable: true }).isString().withMessage('Tipo de campanha deve ser uma string'),
  body('priority').optional({ nullable: true }).isInt({ min: 0, max: 10 }).toInt().withMessage('Prioridade deve ser entre 0 e 10'),
  body('contractId').optional({ checkFalsy: true, nullable: true }).isInt({ min: 1 }).toInt().withMessage('contractId deve ser um número inteiro maior que 0'),
  body('contract_id').optional({ checkFalsy: true, nullable: true }).isInt({ min: 1 }).toInt().withMessage('contract_id deve ser um número inteiro maior que 0'),
  body('startDate').optional({ nullable: true }).isISO8601().withMessage('Data de início inválida'),
  body('endDate').optional({ nullable: true }).isISO8601().withMessage('Data de término inválida'),
  body('startTime').optional({ nullable: true }).matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de início inválida'),
  body('endTime').optional({ nullable: true }).matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de término inválida'),
  body('daysOfWeek').optional({ nullable: true }).isArray().withMessage('daysOfWeek deve ser um array'),
  body('status').optional({ nullable: true }).isIn(['draft', 'pending_approval', 'active', 'approved', 'paused', 'finished', 'cancelled', 'deleted']).withMessage('Status inválido'),
  body('isActive').optional({ nullable: true }).isBoolean().withMessage('isActive deve ser um booleano'),
  body('publisherIds').optional({ nullable: true }).isArray().withMessage('publisherIds deve ser um array'),
  body('totemIds').optional({ nullable: true }).isArray().withMessage('totemIds deve ser um array'),
  body('totem_ids').optional({ nullable: true }).isArray().withMessage('totem_ids deve ser um array'),
  body('playlistIds').optional({ nullable: true }).isArray().withMessage('playlistIds deve ser um array'),
  body('mediaIds').optional({ nullable: true }).isArray().withMessage('mediaIds deve ser um array'),
];

/**
 * Validadores para filtros de campanhas
 */
export const campaignFilterValidators = [
  query('clientId').optional().isInt({ min: 1 }).withMessage('clientId deve ser um número inteiro maior que 0'),
  query('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  query('status').optional().isString().withMessage('Status deve ser uma string'),
  query('campaignType').optional().isString().withMessage('campaignType deve ser uma string'),
  query('isActive').optional().isBoolean().withMessage('isActive deve ser um booleano'),
  query('search').optional().isString().withMessage('Busca deve ser uma string'),
];

/**
 * Validadores para reordenar mídias em campanha
 */
export const reorderCampaignMediasValidators = [
  body('mediaIds').isArray({ min: 1 }).withMessage('mediaIds deve ser um array com pelo menos um item'),
  body('mediaIds.*').isInt({ min: 1 }).withMessage('Cada ID de mídia deve ser um número inteiro maior que 0'),
];

/**
 * Validadores para reordenar playlists em campanha
 */
export const reorderCampaignPlaylistsValidators = [
  body('playlistIds').isArray({ min: 1 }).withMessage('playlistIds deve ser um array com pelo menos um item'),
  body('playlistIds.*').isInt({ min: 1 }).withMessage('Cada ID de playlist deve ser um número inteiro maior que 0'),
];
