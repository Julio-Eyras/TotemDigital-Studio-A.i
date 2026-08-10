/**
 * @deprecated Dead code — rotas activas usam express-validator em `backend/src/validators/*`.
 * Não importar; referência histórica até remoção em v6.x+.
 */
import Joi from 'joi';

export const uploadMediaSchema = Joi.object({
  title: Joi.string().min(2).max(200).required(),
  description: Joi.string().max(1000).optional(),
  tags: Joi.array().items(Joi.string().max(50)).optional(),
  category: Joi.string().max(100).optional(),
  duration: Joi.number().min(1).optional(),
  isActive: Joi.boolean().default(true),
  notes: Joi.string().max(1000).optional()
});

export const updateMediaSchema = Joi.object({
  title: Joi.string().min(2).max(200),
  description: Joi.string().max(1000),
  tags: Joi.array().items(Joi.string().max(50)),
  category: Joi.string().max(100),
  duration: Joi.number().min(1),
  isActive: Joi.boolean(),
  notes: Joi.string().max(1000)
});
