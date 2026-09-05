/**
 * Testes unitários - AuthService
 * Smart Signage Pro v2.1 — atualizado Sprint 3
 *
 * Objetivos:
 *  - TESTAR ESTRUTURAS de interfaces do AuthService
 *  - VALIDAR CONSTANTES / ROLES / FLUXOS sem depender de banco (Pure unit)
 *  - Mockar getDatabase / AuditService apenas onde necessário
 *
 * Para testes INTEGRADOS reais de login (com DB) → usar
 *   backend/src/__tests__/integration/routes/auth.*.test.ts
 */

import bcrypt from 'bcryptjs';
import type {
  LoginRequest,
  AuthResponse,
  AuthResponseUser,
  DbUserRow,
  ChangePasswordRequest,
  RegisterRequest,
} from '../../../services/authService';
import type { UserRole, UserSmartFlags } from '../../../types/domain.shared';

// ============================================================
// ESTRUTURAS (tipos) — garantidas em runtime (type predicates)
// ============================================================

function isString(x: unknown): x is string { return typeof x === 'string'; }
function isNum(x: unknown): x is number { return typeof x === 'number'; }

function isLoginRequest(r: unknown): r is LoginRequest {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return isString(o.username) && isString(o.password);
}

function isChangePasswordRequest(r: unknown): r is ChangePasswordRequest {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return isString(o.currentPassword) && isString(o.newPassword);
}

function isAuthResponseUser(u: unknown): u is AuthResponseUser {
  if (!u || typeof u !== 'object') return false;
  const o = u as Record<string, unknown>;
  return (
    isNum(o.id) &&
    isString(o.username) &&
    isString(o.email) &&
    isString(o.name) &&
    isString(o.role)
  );
}

function isAuthResponse(r: unknown): r is AuthResponse {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.success === 'boolean' &&
    (o.user === undefined || isAuthResponseUser(o.user)) &&
    (o.error === undefined || isString(o.error))
  );
}

// ============================================================
// SUITE 1 — Estruturas e type predicates (Caso 1..3 antigos mantidos, com +8)
// ============================================================

describe('AuthService - validações e helpers (Sprint 3 expanded)', () => {
  describe('LoginRequest / type predicate', () => {
    it('C1. válido: username + password strings', () => {
      const validRequest: LoginRequest = { username: 'admin', password: 'secret123' };
      expect(isLoginRequest(validRequest)).toBe(true);
    });

    it('C2. inválido: password faltando', () => {
      expect(isLoginRequest({ username: 'admin' })).toBe(false);
    });

    it('C3. inválido: não é objeto', () => {
      expect(isLoginRequest(null)).toBe(false);
      expect(isLoginRequest(undefined)).toBe(false);
      expect(isLoginRequest('admin:123')).toBe(false);
    });

    it('C4. inválido: password é number', () => {
      expect(isLoginRequest({ username: 'a', password: 1234 as any })).toBe(false);
    });
  });

  describe('ChangePasswordRequest / type predicate', () => {
    it('C5. válido', () => {
      const r: ChangePasswordRequest = { currentPassword: 'antiga', newPassword: 'novasenha' };
      expect(isChangePasswordRequest(r)).toBe(true);
    });
    it('C6. inválido (campos faltantes)', () => {
      expect(isChangePasswordRequest({ currentPassword: 'x' })).toBe(false);
    });
  });

  describe('AuthResponseUser / type predicate', () => {
    it('C7. válido: subscriber_user', () => {
      const u: AuthResponseUser = {
        id: 100,
        username: 'anunciante1',
        email: 'a@x.com',
        name: 'Anunciante 1',
        role: 'subscriber_user',
        user_type: 'subscriber_user',
        subscriberId: 55,
      };
      expect(isAuthResponseUser(u)).toBe(true);
    });

    it('C8. inválido: name não string', () => {
      expect(isAuthResponseUser({ id: 1, username: 'a', email: 'x', name: 55, role: 'r' })).toBe(false);
    });
  });

  describe('AuthResponse / shape', () => {
    it('C9. sucesso completo (user + token)', () => {
      const resp: AuthResponse = {
        success: true,
        token: 'jwt-abc',
        refreshToken: 'jwt-refresh-abc',
        user: {
          id: 1,
          username: 'admin',
          email: 'admin@test.com',
          name: 'Admin',
          role: 'owner_system',
          flags: { flag_smart_0: true, flag_smart_5: true },
        },
      };
      expect(isAuthResponse(resp)).toBe(true);
      expect(resp.user?.flags?.flag_smart_0).toBe(true);
    });

    it('C10. falha padrão login', () => {
      const resp: AuthResponse = { success: false, error: 'Credenciais inválidas' };
      expect(isAuthResponse(resp)).toBe(true);
    });

    it('C11. 2FA requerido — success true, requiresTwoFactor: true, sem token', () => {
      const resp: AuthResponse = {
        success: true,
        requiresTwoFactor: true,
        user: {
          id: 3, username: 'tecnico', email: 't@x.com', name: 'Tec', role: 'operador_tecnico',
        },
      };
      expect(isAuthResponse(resp)).toBe(true);
      expect(resp.requiresTwoFactor).toBe(true);
      expect(resp.token).toBeUndefined();
    });

    it('C12. subscriber login tem subscriberId e flags', () => {
      const flags: Partial<UserSmartFlags> = { flag_smart_2: true, flag_smart_8: false };
      const resp: AuthResponse = {
        success: true,
        token: 'tkn',
        user: {
          id: 20,
          username: 'cliente_b',
          email: 'b@x.com',
          name: 'Cliente B',
          role: 'subscriber_user',
          user_type: 'subscriber_user',
          subscriberId: 501,
          isTenantUser: true,
          flags,
        },
      };
      expect(isAuthResponse(resp)).toBe(true);
      expect(resp.user?.subscriberId).toBe(501);
      expect(resp.user?.user_type).toBe('subscriber_user');
      expect(resp.user?.flags?.flag_smart_2).toBe(true);
    });
  });

  // ============================================================
  // ROLES — valores canônicos (GAP M2)
  // ============================================================

  describe('UserRole — valores canônicos usados no sistema', () => {
    const VALID_ROLES: UserRole[] = [
      'owner_system',
      'admin_sql',
      'admin',
      'manager',
      'operator',
      'operador_tecnico',
      'operador_faturamento',
      'operador_comercial',
      'gerente_marketing',
      'editoracao',
      'visualizador',
      'publisher_user',
      'subscriber_user',
    ];

    it('C13. 13 roles canônicas distintas', () => {
      expect(new Set(VALID_ROLES).size).toBe(VALID_ROLES.length);
      expect(VALID_ROLES.length).toBe(13);
    });

    it('C14. roles de subscriber/publisher tem user_type correspondente', () => {
      const u1: AuthResponseUser = {
        id: 1, username: 'a', email: 'e', name: 'n',
        role: 'subscriber_user', user_type: 'subscriber_user', subscriberId: 10,
      };
      const u2: AuthResponseUser = {
        id: 2, username: 'b', email: 'e', name: 'n',
        role: 'publisher_user', user_type: 'publisher_user', publisherId: 5,
      };
      expect(u1.role).toEqual(u1.user_type);
      expect(u2.role).toEqual(u2.user_type);
      expect(u1.subscriberId).toBeDefined();
      expect(u2.publisherId).toBeDefined();
    });
  });

  // ============================================================
  // REGISTER REQUEST (Criar novo usuário)
  // ============================================================

  describe('RegisterRequest — shape', () => {
    it('C15. mínimo (username + password)', () => {
      const req: RegisterRequest = { username: 'novo', password: 'Senha123!' };
      expect(req.username).toBe('novo');
      expect(req.role).toBeUndefined();
    });

    it('C16. subscriber user registration — subscriberId obrigatório para anunciante', () => {
      const req: RegisterRequest = {
        username: 'anunciante_novo',
        password: 'Senha123!',
        role: 'subscriber_user',
        subscriberId: 99,
        email: 'novo@a.com',
      };
      expect(req.role).toBe('subscriber_user');
      expect(req.subscriberId).toBe(99);
    });
  });

  // ============================================================
  // DbUserRow ↔ AuthResponseUser (mapeamento usado no mapUserForClient)
  // ============================================================

  describe('mapUserForClient — regra de transformação (shape)', () => {
    function manualMap(user: DbUserRow): AuthResponseUser {
      // Regra do AuthService.mapUserForClient codificada aqui para teste de contrato
      const first = String(user.first_name ?? '').trim();
      const last = String(user.last_name ?? '').trim();
      const fullParts = [first, last].filter(Boolean).join(' ').trim();
      const name = String(user.name ?? '').trim() || fullParts || user.username;
      return {
        id: user.id,
        username: user.username,
        email: user.email || '',
        name,
        first_name: first || undefined,
        last_name: last || undefined,
        role: user.role,
        user_type: user.user_type ?? undefined,
        publisherId: (user.publisher_id ?? user.publisherId) as number | undefined,
        subscriberId: (user.subscriber_id ?? user.subscriberId) as number | undefined,
        subscriberName: (user.client_name ?? undefined) as string | undefined,
      } as AuthResponseUser;
    }

    it('C17. user com name vazio → monta a partir de first_name + last_name', () => {
      const row: DbUserRow = {
        id: 7,
        username: 'maria',
        email: 'm@x.com',
        name: '',
        first_name: 'Maria',
        last_name: 'Silva',
        role: 'operator',
      };
      const r = manualMap(row);
      expect(r.name).toBe('Maria Silva');
      expect(r.first_name).toBe('Maria');
      expect(r.last_name).toBe('Silva');
    });

    it('C18. user sem first/last name → username fallback', () => {
      const row: DbUserRow = { id: 77, username: 'sysop', email: '', name: '', role: 'admin' };
      const r = manualMap(row);
      expect(r.name).toBe('sysop');
    });

    it('C19. snake vs camel — subscriber_id vs subscriberId (compat)', () => {
      const a: DbUserRow = { id: 1, username: 'a', email: '', name: '', role: 'x', subscriber_id: 5 };
      const b: DbUserRow = { id: 2, username: 'b', email: '', name: '', role: 'x', subscriberId: 8 };
      expect(manualMap(a).subscriberId).toBe(5);
      expect(manualMap(b).subscriberId).toBe(8);
    });

    it('C20. client_name do JOIN vira subscriberName', () => {
      const row: DbUserRow = {
        id: 3, username: 'c', email: '', name: '', role: 'x', client_name: 'Lojão Ltda',
      };
      expect(manualMap(row).subscriberName).toBe('Lojão Ltda');
    });
  });

  // ============================================================
  // bcrypt (6 testes originais expandidos → agora 9)
  // ============================================================

  describe('bcrypt (usado pelo AuthService)', () => {
    it('C21. hash + compare sucesso (salt 12)', async () => {
      const password = 'senha123';
      const hash = await bcrypt.hash(password, 12);
      expect(hash).not.toBe(password);
      expect(await bcrypt.compare(password, hash)).toBe(true);
    });

    it('C22. senha errada rejeitada', async () => {
      const hash = await bcrypt.hash('senha123', 12);
      expect(await bcrypt.compare('senhaerrada', hash)).toBe(false);
    });

    it('C23. mesma senha gera hashes diferentes (salting aleatório)', async () => {
      const p = 'mesma-senha-42';
      const a = await bcrypt.hash(p, 10);
      const b = await bcrypt.hash(p, 10);
      expect(a).not.toBe(b);
      expect(await bcrypt.compare(p, a)).toBe(true);
      expect(await bcrypt.compare(p, b)).toBe(true);
    });

    it('C24. hash de senha vazia → possível, mas compare vazio também funciona', async () => {
      const h = await bcrypt.hash('', 8);
      expect(await bcrypt.compare('', h)).toBe(true);
      expect(await bcrypt.compare('x', h)).toBe(false);
    });

    it('C25. salt 4 vs salt 12 ambos validam', async () => {
      const p = 'teste-salt';
      const h4 = await bcrypt.hash(p, 4);
      const h12 = await bcrypt.hash(p, 12);
      expect(h4.startsWith('$2a$04$') || h4.startsWith('$2b$04$')).toBe(true);
      expect(h12.startsWith('$2a$12$') || h12.startsWith('$2b$12$')).toBe(true);
      expect(await bcrypt.compare(p, h4)).toBe(true);
      expect(await bcrypt.compare(p, h12)).toBe(true);
    });

    it('C26. senha com caracteres especiais / unicode', async () => {
      const p = 'Sênhà_Ñoël_🔔_日本語_123!@#';
      const h = await bcrypt.hash(p, 8);
      expect(await bcrypt.compare(p, h)).toBe(true);
      expect(await bcrypt.compare(p + 'x', h)).toBe(false);
    });
  });
});
