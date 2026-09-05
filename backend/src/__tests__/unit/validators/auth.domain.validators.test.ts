/**
 * Testes unitários auth.domain.validators.ts (Joi schemas + guards) — SPRINT 5.
 *
 * Todos PUROS (sem DB, sem rede). Cobrem:
 *  L1-L4    LoginRequest (válido, username vazio, password curto, totemId negativo)
 *  L5-L7    SubscriberLoginRequest (subscriberId + email, email inválido)
 *  R1-R3    RegisterRequest (válido mínimo, subscriber_user com subscriberId, email inválido)
 *  P1-P3    ChangePasswordRequest (confirmPassword match, mismatch, newPassword curto)
 *  F1-F2    ForgotPasswordRequest (email válido, email inválido)
 *  T1-T2    ResetPasswordRequest (token curto, confirmPassword mismatch)
 *  D1-D3    DispatchRequest (totemId obrigatório, totemId<1, timestamp ISO válido)
 */

import {
  AUTH_RULES,
  validateLoginRequest,
  validateSubscriberLoginRequest,
  validateRegisterRequest,
  validateChangePasswordRequest,
  validateForgotPasswordRequest,
  validateResetPasswordRequest,
  validateDispatchRequest,
  AUTH_FORM_RULES,
} from '../../../validators/auth.domain.validators';

describe('AUTH_RULES constantes (regra única de verdade)', () => {
  test('constantes definidas para regras compartilhadas FE ↔ BE', () => {
    expect(AUTH_RULES.PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(6);
    expect(AUTH_RULES.USERNAME_MIN_LENGTH).toBeGreaterThanOrEqual(2);
    expect(AUTH_RULES.TOTEM_ID_MIN).toBe(1);
    expect(typeof AUTH_RULES.EMAIL_REGEX.test).toBe('function');
    expect(AUTH_RULES.EMAIL_REGEX.test('user@domain.tld')).toBe(true);
    expect(AUTH_RULES.EMAIL_REGEX.test('no-at-sign')).toBe(false);
  });

  test('AUTH_FORM_RULES exporta regras copiáveis para o React Hook Form', () => {
    expect(AUTH_FORM_RULES.username.required).toBeDefined();
    expect(AUTH_FORM_RULES.password.minLength.value).toBe(AUTH_RULES.PASSWORD_MIN_LENGTH);
    expect(AUTH_FORM_RULES.email.pattern.value).toBe(AUTH_RULES.EMAIL_REGEX);
    expect(AUTH_FORM_RULES.totemId.min.value).toBe(AUTH_RULES.TOTEM_ID_MIN);
  });
});

// -----------------------------------------------------------------------------
// L: LoginRequest
// -----------------------------------------------------------------------------

describe('validateLoginRequest', () => {
  const base = { username: 'admin_totem', password: 'Totem@2024!' };

  test('L1. Shape válido mínimo → ok:true', () => {
    const r = validateLoginRequest(base);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('L2. username vazio / ausente → erros', () => {
    const r1 = validateLoginRequest({ ...base, username: '' });
    const r2 = validateLoginRequest({ password: base.password });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r2.errors.some((m) => /username/.test(m))).toBe(true);
  });

  test('L3. password < PASSWORD_MIN_LENGTH → erros', () => {
    const r = validateLoginRequest({ username: 'x', password: 'a'.repeat(AUTH_RULES.PASSWORD_MIN_LENGTH - 1) });
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /password/.test(m))).toBe(true);
  });

  test('L4. totemId=0 / negativo → erro de mínimo', () => {
    const r0 = validateLoginRequest({ ...base, totemId: 0 });
    const rNeg = validateLoginRequest({ ...base, totemId: -10 });
    expect(r0.ok).toBe(false);
    expect(rNeg.ok).toBe(false);
  });

  test('L5. campo desconhecido → bloqueado por unknown(false)', () => {
    const r = validateLoginRequest({ ...base, role: 'should_not_be_here' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /unknown|desconhecido/.test(m))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// S: SubscriberLoginRequest
// -----------------------------------------------------------------------------

describe('validateSubscriberLoginRequest', () => {
  const base = { username: 'sub_cliente@acme.com', password: 'Segura!123', subscriberId: 99 };

  test('S1. subscriberId positivo + username → ok', () => {
    expect(validateSubscriberLoginRequest(base).ok).toBe(true);
  });

  test('S2. email inválido (fornecido explicitamente) → erro', () => {
    const r = validateSubscriberLoginRequest({ ...base, email: 'not-an-email' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /email/.test(m))).toBe(true);
  });

  test('S3. subscriberId negativo → erro', () => {
    const r = validateSubscriberLoginRequest({ ...base, subscriberId: -1 });
    expect(r.ok).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// R: RegisterRequest
// -----------------------------------------------------------------------------

describe('validateRegisterRequest', () => {
  const base = {
    username: 'novo_usuario',
    email: 'novo@example.com',
    password: 'Senha123!',
    first_name: 'João',
    last_name: 'Silva',
  };

  test('R1. Shape mínimo válido → ok', () => {
    expect(validateRegisterRequest(base).ok).toBe(true);
  });

  test('R2. subscriber_user com subscriberId positivo → ok', () => {
    const r = validateRegisterRequest({
      ...base,
      subscriberId: 42,
      role: 'subscriber_user',
      user_type: 'subscriber',
    });
    expect(r.ok).toBe(true);
  });

  test('R3. email sem @ → erro de pattern', () => {
    const r = validateRegisterRequest({ ...base, email: 'no-at-sign' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /email/.test(m))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// P: ChangePasswordRequest
// -----------------------------------------------------------------------------

describe('validateChangePasswordRequest', () => {
  test('P1. old + new + confirm (match) → ok', () => {
    const r = validateChangePasswordRequest({
      oldPassword: 'Antiga123!',
      newPassword: 'NovaSenha!123',
      confirmPassword: 'NovaSenha!123',
    });
    expect(r.ok).toBe(true);
  });

  test('P2. confirmPassword ≠ newPassword → mismatch', () => {
    const r = validateChangePasswordRequest({
      oldPassword: 'x',
      newPassword: 'NovaSenha!123',
      confirmPassword: 'OutraCoisa!',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /confirmPassword|igual/.test(m))).toBe(true);
  });

  test('P3. newPassword < PASSWORD_MIN_LENGTH → erro', () => {
    const short = 'a'.repeat(AUTH_RULES.PASSWORD_MIN_LENGTH - 1);
    const r = validateChangePasswordRequest({
      oldPassword: 'x',
      newPassword: short,
      confirmPassword: short,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /newPassword/.test(m))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// F: ForgotPasswordRequest
// -----------------------------------------------------------------------------

describe('validateForgotPasswordRequest', () => {
  test('F1. email válido → ok', () => {
    const r = validateForgotPasswordRequest({ email: 'admin@totem.ai' });
    expect(r.ok).toBe(true);
  });

  test('F2. email sem arroba → erro', () => {
    const r = validateForgotPasswordRequest({ email: 'invalido' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /email/.test(m))).toBe(true);
  });

  test('F3. email ausente → erro obrigatório', () => {
    const r = validateForgotPasswordRequest({});
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /obrigatório|required/.test(m))).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// T: ResetPasswordRequest
// -----------------------------------------------------------------------------

describe('validateResetPasswordRequest', () => {
  const longToken = 'a'.repeat(32);

  test('T1. token + new + confirm (match) → ok', () => {
    const r = validateResetPasswordRequest({
      token: longToken,
      newPassword: 'Nova!1234',
      confirmPassword: 'Nova!1234',
    });
    expect(r.ok).toBe(true);
  });

  test('T2. confirmPassword mismatch → erro', () => {
    const r = validateResetPasswordRequest({
      token: longToken,
      newPassword: 'Nova!1234',
      confirmPassword: 'Diferente!1234',
    });
    expect(r.ok).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// D: DispatchRequest
// -----------------------------------------------------------------------------

describe('validateDispatchRequest', () => {
  test('D1. totemId ausente → obrigatório', () => {
    const r = validateDispatchRequest({});
    expect(r.ok).toBe(false);
    expect(r.errors.some((m) => /totemId|obrigatório/.test(m))).toBe(true);
  });

  test('D2. totemId < 1 → erro mínimo', () => {
    expect(validateDispatchRequest({ totemId: 0 }).ok).toBe(false);
    expect(validateDispatchRequest({ totemId: -5 }).ok).toBe(false);
  });

  test('D3. totemId positivo + timestamp ISO → ok', () => {
    const r = validateDispatchRequest({
      totemId: 42,
      timestamp: new Date().toISOString(),
      timezone: 'America/Sao_Paulo',
    });
    expect(r.ok).toBe(true);
  });
});
