/**
 * @deprecated Dead code — rotas activas usam express-validator em `backend/src/validators/*`.
 * Não importar; referência histórica até remoção em v6.x+.
 */
import Joi from 'joi';

export const createUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  role: Joi.string().valid('admin', 'gerente_marketing', 'editoracao', 'visualizador', 'manager', 'user').default('user'),
  isActive: Joi.boolean().default(true)
});

export const updateUserSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30),
  email: Joi.string().email(),
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  role: Joi.string().valid('admin', 'gerente_marketing', 'editoracao', 'visualizador', 'manager', 'user'),
  isActive: Joi.boolean()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

export const assignRoleSchema = Joi.object({
  roleId: Joi.string().uuid().required()
});

export const assignPermissionSchema = Joi.object({
  permissionId: Joi.string().uuid().required()
});
