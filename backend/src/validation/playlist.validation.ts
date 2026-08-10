/**
 * @deprecated Dead code — rotas activas usam express-validator em `backend/src/validators/*`.
 * Não importar; referência histórica até remoção em v6.x+.
 */
import Joi from 'joi';

export const createPlaylistSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(1000).optional(),
  isActive: Joi.boolean().default(true),
  isLoop: Joi.boolean().default(true),
  totalDuration: Joi.number().min(1).optional(),
  notes: Joi.string().max(1000).optional()
});

export const updatePlaylistSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  description: Joi.string().max(1000),
  isActive: Joi.boolean(),
  isLoop: Joi.boolean(),
  totalDuration: Joi.number().min(1),
  notes: Joi.string().max(1000)
});

export const addPlaylistItemSchema = Joi.object({
  mediaId: Joi.string().uuid().required(),
  order: Joi.number().min(0).optional(),
  duration: Joi.number().min(1).optional(),
  startTime: Joi.date().optional(),
  endTime: Joi.date().optional(),
  isActive: Joi.boolean().default(true)
});
