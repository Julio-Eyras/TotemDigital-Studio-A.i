/**
 * auth.domain.validators.ts — VALIDADORES COMPARTILHADOS DE AUTENTICAÇÃO
 *
 * Schema de validação agnóstico de framework (Joi + type predicates TS) para os
 * contratos de request de Auth. Compartilhados entre:
 *  - rotas (express-validator chain)
 *  - authService (verificações defensivas runtime)
 *  - testes (unitários de shape)
 *  - frontend React Hook Form (yupResolver compatível — usar os campos/rules abaixo)
 *
 * NÃO usar como middleware express diretamente (o middleware usa express-validator
 * chain). Usar os helpers `validateAuthRequestShape` como guard defensivo em
 * services / jobs assíncronos.
 */

import * as Joi from 'joi';

// -----------------------------------------------------------------------------
// 1) CONSTANTES DE REGRA
// -----------------------------------------------------------------------------

export const AUTH_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 64,
  TOTEM_ID_MIN: 1,
  EMAIL_REGEX:
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
} as const;

// -----------------------------------------------------------------------------
// 2) JOI SCHEMAS (reutilizáveis → testes + validação defensiva runtime)
// -----------------------------------------------------------------------------

/** LoginRequest (usuário admin/publisher/subscriber genérico). */
export const LoginRequestSchema = Joi.object({
  username: Joi.string()
    .min(AUTH_RULES.USERNAME_MIN_LENGTH)
    .max(AUTH_RULES.USERNAME_MAX_LENGTH)
    .required()
    .messages({
      'string.min': `username deve ter pelo menos ${AUTH_RULES.USERNAME_MIN_LENGTH} caracteres`,
      'string.max': `username deve ter no máximo ${AUTH_RULES.USERNAME_MAX_LENGTH} caracteres`,
      'any.required': 'username é obrigatório',
    }),
  password: Joi.string()
    .min(AUTH_RULES.PASSWORD_MIN_LENGTH)
    .max(AUTH_RULES.PASSWORD_MAX_LENGTH)
    .required()
    .messages({
      'string.min': `password deve ter pelo menos ${AUTH_RULES.PASSWORD_MIN_LENGTH} caracteres`,
      'string.max': `password deve ter no máximo ${AUTH_RULES.PASSWORD_MAX_LENGTH} caracteres`,
      'any.required': 'password é obrigatório',
    }),
  totemId: Joi.number().integer().min(AUTH_RULES.TOTEM_ID_MIN).optional().messages({
    'number.base': 'totemId deve ser um número inteiro positivo',
    'number.min': 'totemId deve ser ≥ 1',
  }),
  remember: Joi.boolean().optional(),
  twoFactorCode: Joi.string().alphanum().length(6).optional().messages({
    'string.length': 'twoFactorCode deve ter exatamente 6 caracteres alfanuméricos',
  }),
})
  .unknown(false)
  .messages({
    'object.unknown': 'Campo desconhecido em LoginRequest: "{{#key}}"',
  });

/** SubscriberLoginRequest (login com email opcional ou subscriberId). */
export const SubscriberLoginRequestSchema = LoginRequestSchema.concat(
  Joi.object({
    subscriberId: Joi.number().integer().min(1).optional().messages({
      'number.base': 'subscriberId deve ser um número inteiro positivo',
    }),
    email: Joi.string().pattern(AUTH_RULES.EMAIL_REGEX).optional().messages({
      'string.pattern.base': 'email deve ter formato user@domain.tld',
    }),
  })
);

/** RegisterRequest (novo usuário). */
export const RegisterRequestSchema = Joi.object({
  username: Joi.string()
    .min(AUTH_RULES.USERNAME_MIN_LENGTH)
    .max(AUTH_RULES.USERNAME_MAX_LENGTH)
    .required(),
  email: Joi.string().pattern(AUTH_RULES.EMAIL_REGEX).required().messages({
    'any.required': 'email é obrigatório',
    'string.pattern.base': 'email deve ter formato user@domain.tld',
  }),
  password: Joi.string()
    .min(AUTH_RULES.PASSWORD_MIN_LENGTH)
    .max(AUTH_RULES.PASSWORD_MAX_LENGTH)
    .required(),
  first_name: Joi.string().min(1).max(120).optional(),
  last_name: Joi.string().min(1).max(120).optional(),
  subscriberId: Joi.number().integer().min(1).optional(),
  role: Joi.string().min(2).max(64).optional(),
  user_type: Joi.string().valid('admin', 'publisher', 'subscriber', 'operator').optional(),
}).unknown(false);

/** ChangePasswordRequest (autenticado). */
export const ChangePasswordRequestSchema = Joi.object({
  oldPassword: Joi.string()
    .min(AUTH_RULES.PASSWORD_MIN_LENGTH)
    .max(AUTH_RULES.PASSWORD_MAX_LENGTH)
    .required()
    .messages({ 'any.required': 'oldPassword é obrigatório' }),
  newPassword: Joi.string()
    .min(AUTH_RULES.PASSWORD_MIN_LENGTH)
    .max(AUTH_RULES.PASSWORD_MAX_LENGTH)
    .required()
    .messages({ 'any.required': 'newPassword é obrigatório' }),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'confirmPassword deve ser igual a newPassword',
    'any.required': 'confirmPassword é obrigatório',
  }),
}).unknown(false);

/** ForgotPasswordRequest. */
export const ForgotPasswordRequestSchema = Joi.object({
  email: Joi.string().pattern(AUTH_RULES.EMAIL_REGEX).required().messages({
    'any.required': 'email é obrigatório',
    'string.pattern.base': 'email deve ter formato user@domain.tld',
  }),
}).unknown(false);

/** ResetPasswordRequest (token + nova senha). */
export const ResetPasswordRequestSchema = Joi.object({
  token: Joi.string().min(8).required().messages({
    'any.required': 'token é obrigatório',
  }),
  newPassword: Joi.string()
    .min(AUTH_RULES.PASSWORD_MIN_LENGTH)
    .max(AUTH_RULES.PASSWORD_MAX_LENGTH)
    .required(),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'confirmPassword deve ser igual a newPassword',
  }),
}).unknown(false);

/** DispatchRequest (validado no dispatcher — shape básico). */
export const DispatchRequestSchema = Joi.object({
  totemId: Joi.number().integer().min(AUTH_RULES.TOTEM_ID_MIN).required().messages({
    'any.required': 'totemId é obrigatório',
    'number.base': 'totemId deve ser um número inteiro positivo',
    'number.min': 'totemId deve ser ≥ 1',
  }),
  timestamp: Joi.alternatives()
    .try(Joi.date().iso(), Joi.string().isoDate())
    .optional(),
  timezone: Joi.string().min(2).max(64).optional(),
}).unknown(false);

// -----------------------------------------------------------------------------
// 3) GUARDS (type narrowing + validação runtime em serviços)
// -----------------------------------------------------------------------------

export interface ValidationResult<T = unknown> {
  ok: boolean;
  value?: T;
  errors: string[];
}

function runSchema<T>(schema: Joi.ObjectSchema<T>, payload: unknown): ValidationResult<T> {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: false,
  });
  if (error) {
    return {
      ok: false,
      errors: error.details.map((d) => d.message),
    };
  }
  return { ok: true, value, errors: [] };
}

export function validateLoginRequest(payload: unknown): ValidationResult {
  return runSchema(LoginRequestSchema, payload);
}

export function validateSubscriberLoginRequest(payload: unknown): ValidationResult {
  return runSchema(SubscriberLoginRequestSchema, payload);
}

export function validateRegisterRequest(payload: unknown): ValidationResult {
  return runSchema(RegisterRequestSchema, payload);
}

export function validateChangePasswordRequest(payload: unknown): ValidationResult {
  return runSchema(ChangePasswordRequestSchema, payload);
}

export function validateForgotPasswordRequest(payload: unknown): ValidationResult {
  return runSchema(ForgotPasswordRequestSchema, payload);
}

export function validateResetPasswordRequest(payload: unknown): ValidationResult {
  return runSchema(ResetPasswordRequestSchema, payload);
}

export function validateDispatchRequest(payload: unknown): ValidationResult {
  return runSchema(DispatchRequestSchema, payload);
}

// -----------------------------------------------------------------------------
// 4) CONTRATO FRONTEND React Hook Form (shape & regras de UI — não importa Joi)
// -----------------------------------------------------------------------------

/**
 * Regras copiáveis para o frontend useForm<LoginFormFields>({ rules: ... }).
 * Exemplo:
 *   register('username', AUTH_FORM_RULES.username.required)
 */
export const AUTH_FORM_RULES = {
  username: {
    required: { value: true, message: 'Usuário é obrigatório' },
    minLength: {
      value: AUTH_RULES.USERNAME_MIN_LENGTH,
      message: `Mínimo de ${AUTH_RULES.USERNAME_MIN_LENGTH} caracteres`,
    },
    maxLength: {
      value: AUTH_RULES.USERNAME_MAX_LENGTH,
      message: `Máximo de ${AUTH_RULES.USERNAME_MAX_LENGTH} caracteres`,
    },
  },
  password: {
    required: { value: true, message: 'Senha é obrigatória' },
    minLength: {
      value: AUTH_RULES.PASSWORD_MIN_LENGTH,
      message: `Mínimo de ${AUTH_RULES.PASSWORD_MIN_LENGTH} caracteres`,
    },
    maxLength: {
      value: AUTH_RULES.PASSWORD_MAX_LENGTH,
      message: `Máximo de ${AUTH_RULES.PASSWORD_MAX_LENGTH} caracteres`,
    },
  },
  email: {
    required: { value: true, message: 'Email é obrigatório' },
    pattern: {
      value: AUTH_RULES.EMAIL_REGEX,
      message: 'Email deve ter formato user@domain.tld',
    },
  },
  totemId: {
    required: { value: true, message: 'totemId é obrigatório' },
    min: { value: 1, message: 'totemId deve ser ≥ 1' },
  },
} as const;
