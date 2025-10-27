import Joi from 'joi';

export const createTotemSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  location: Joi.string().min(2).max(255).required(),
  clientId: Joi.string().uuid().required(),
  model: Joi.string().max(100).optional(),
  serialNumber: Joi.string().max(100).optional(),
  macAddress: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).optional(),
  ipAddress: Joi.string().ip().optional(),
  resolution: Joi.string().pattern(/^\d+x\d+$/).optional(),
  orientation: Joi.string().valid('landscape', 'portrait').default('landscape'),
  isActive: Joi.boolean().default(true),
  notes: Joi.string().max(1000).optional()
});

export const updateTotemSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  location: Joi.string().min(2).max(255),
  clientId: Joi.string().uuid(),
  model: Joi.string().max(100),
  serialNumber: Joi.string().max(100),
  macAddress: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/),
  ipAddress: Joi.string().ip(),
  resolution: Joi.string().pattern(/^\d+x\d+$/),
  orientation: Joi.string().valid('landscape', 'portrait'),
  isActive: Joi.boolean(),
  notes: Joi.string().max(1000)
});
