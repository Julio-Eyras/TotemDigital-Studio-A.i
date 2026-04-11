import Joi from 'joi';

export const createClientSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  address: Joi.string().max(255).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(50).optional(),
  zipCode: Joi.string().max(20).optional(),
  country: Joi.string().max(50).default('Brasil'),
  isActive: Joi.boolean().default(true),
  notes: Joi.string().max(1000).optional()
});

export const updateClientSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  email: Joi.string().email(),
  phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/),
  address: Joi.string().max(255),
  city: Joi.string().max(100),
  state: Joi.string().max(50),
  zipCode: Joi.string().max(20),
  country: Joi.string().max(50),
  isActive: Joi.boolean(),
  notes: Joi.string().max(1000)
});
