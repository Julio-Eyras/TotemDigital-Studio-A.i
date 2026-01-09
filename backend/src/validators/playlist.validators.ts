/**
 * Validadores Específicos para Playlists
 */

import { body, query } from 'express-validator';

/**
 * Validadores para criação de playlist
 */
export const createPlaylistValidators = [
  body('name').notEmpty().withMessage('Nome é obrigatório').isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
  body('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  body('clientId').optional().isInt({ min: 1 }).withMessage('clientId (deprecated) deve ser um número inteiro maior que 0'),
];

/**
 * Validadores para atualização de playlist
 */
export const updatePlaylistValidators = [
  body('name').optional().notEmpty().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
  body('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  body('clientId').optional().isInt({ min: 1 }).withMessage('clientId (deprecated) deve ser um número inteiro maior que 0'),
];

/**
 * Validadores para adicionar mídia à playlist
 */
export const addMediaToPlaylistValidators = [
  body('mediaId').isInt({ min: 1 }).withMessage('ID da mídia é obrigatório'),
  body('orderIndex').optional().isInt({ min: 0 }).withMessage('orderIndex deve ser um número inteiro maior ou igual a 0'),
  body('duration').optional().isInt({ min: 1000 }).withMessage('Duração deve ser no mínimo 1000ms'),
];

/**
 * Validadores para atualizar duração de item de playlist
 */
export const updatePlaylistItemDurationValidators = [
  body('duration').isInt({ min: 1000, max: 300000 }).withMessage('Duração deve estar entre 1000ms (1s) e 300000ms (300s)'),
];

/**
 * Validadores para reordenar itens de playlist
 */
export const reorderPlaylistItemsValidators = [
  body('items').isArray({ min: 1 }).withMessage('items deve ser um array com pelo menos um item'),
  body('items.*.itemId').isInt({ min: 1 }).withMessage('Cada itemId deve ser um número inteiro maior que 0'),
  body('items.*.orderIndex').isInt({ min: 0 }).withMessage('Cada orderIndex deve ser um número inteiro maior ou igual a 0'),
];

/**
 * Validadores para filtros de playlist
 */
export const playlistFilterValidators = [
  query('subscriberId').optional().isInt({ min: 1 }).withMessage('subscriberId deve ser um número inteiro maior que 0'),
  query('clientId').optional().isInt({ min: 1 }).withMessage('clientId (deprecated) deve ser um número inteiro maior que 0'),
  query('search').optional().isString().withMessage('Busca deve ser uma string'),
];
