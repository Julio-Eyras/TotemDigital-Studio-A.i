/**
 * Auth Service Tests - Smart Signage v2.1
 * Testes unitários para AuthService
 */

import { AuthService } from '../../services/authService';
import { getDatabase } from '../../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock do banco de dados
jest.mock('../../config/database', () => ({
  getDatabase: jest.fn(),
}));

// Mock do bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Mock do jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock do banco de dados
    mockDb = {
      findFirst: jest.fn(),
      executeRaw: jest.fn(),
      findMany: jest.fn(),
    };

    (getDatabase as jest.Mock).mockReturnValue(mockDb);

    // Mock do AuditService
    (global as any).auditServiceInstance = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    authService = new AuthService();
  });

  describe('forgotPassword', () => {
    it('deve retornar sucesso mesmo se email não existir (segurança)', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await authService.forgotPassword('nonexistent@example.com');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Se o email estiver cadastrado');
      expect(mockDb.findFirst).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, username, email, is_active'),
        ['nonexistent@example.com']
      );
    });

    it('deve gerar token e salvar no banco quando email existe', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        is_active: true,
      };

      mockDb.findFirst
        .mockResolvedValueOnce(mockUser) // Busca do usuário
        .mockResolvedValueOnce(null); // Busca do token (não existe)
      
      mockDb.executeRaw
        .mockResolvedValueOnce({ rows: [] }) // Invalidar tokens anteriores
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Inserir novo token

      const result = await authService.forgotPassword('test@example.com');

      expect(result.success).toBe(true);
      expect(mockDb.executeRaw).toHaveBeenCalledTimes(2);
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens'),
        expect.arrayContaining([1])
      );
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_reset_tokens'),
        expect.arrayContaining([1, expect.any(String), expect.any(Date)])
      );
    });

    it('deve invalidar tokens anteriores antes de criar novo', async () => {
      const mockUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        is_active: true,
      };

      mockDb.findFirst.mockResolvedValue(mockUser);
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      await authService.forgotPassword('test@example.com');

      const updateCalls = mockDb.executeRaw.mock.calls.filter(call =>
        call[0].includes('UPDATE password_reset_tokens')
      );
      
      expect(updateCalls.length).toBeGreaterThan(0);
      expect(updateCalls[0][1][0]).toBe(1); // user_id
    });
  });

  describe('resetPassword', () => {
    it('deve retornar erro se token for inválido', async () => {
      mockDb.findFirst.mockResolvedValue(null);

      const result = await authService.resetPassword('invalid-token', 'newpassword123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Token inválido ou expirado');
    });

    it('deve retornar erro se senha for muito curta', async () => {
      const mockToken = {
        id: 1,
        user_id: 1,
        token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        used: false,
        username: 'testuser',
        email: 'test@example.com',
      };

      mockDb.findFirst.mockResolvedValue(mockToken);

      const result = await authService.resetPassword('valid-token', '123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('pelo menos 6 caracteres');
    });

    it('deve redefinir senha com sucesso quando token é válido', async () => {
      const mockToken = {
        id: 1,
        user_id: 1,
        token: 'valid-token',
        expires_at: new Date(Date.now() + 3600000),
        used: false,
        username: 'testuser',
        email: 'test@example.com',
      };

      mockDb.findFirst.mockResolvedValue(mockToken);
      mockDb.executeRaw.mockResolvedValue({ rows: [] });

      const result = await authService.resetPassword('valid-token', 'newpassword123');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Senha redefinida com sucesso');
      
      // Verificar que a senha foi atualizada
      const updateCalls = mockDb.executeRaw.mock.calls.filter(call =>
        call[0].includes('UPDATE users') && call[0].includes('password_hash')
      );
      
      expect(updateCalls.length).toBeGreaterThan(0);
      expect(updateCalls[0][1][1]).toBe(1); // user_id

      // Verificar que o token foi marcado como usado
      const tokenUpdateCalls = mockDb.executeRaw.mock.calls.filter(call =>
        call[0].includes('UPDATE password_reset_tokens') && call[0].includes('used = true')
      );
      
      expect(tokenUpdateCalls.length).toBeGreaterThan(0);
    });
  });

  describe('register', () => {
    it('deve registrar novo usuário com dados válidos', async () => {
      const mockNewUser = {
        user_id: 1,
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
        role: 'operator',
        client_id: null,
      };

      mockDb.tableExists = jest.fn().mockResolvedValue(false);
      mockDb.findFirst
        .mockResolvedValueOnce(null) // Usuário não existe
        .mockResolvedValueOnce(mockNewUser); // Buscar usuário criado
      
      mockDb.executeRaw.mockResolvedValue({
        lastInsertRowid: 1,
        rows: [],
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$12$hashedpassword');
      (jwt.sign as jest.Mock).mockReturnValue('test-token');

      const result = await authService.register({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'operator',
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user?.username).toBe('newuser');
    });

    it('deve retornar erro quando usuário já existe', async () => {
      const mockExistingUser = {
        id: 1,
        username: 'existinguser',
      };

      mockDb.tableExists = jest.fn().mockResolvedValue(false);
      mockDb.findFirst.mockResolvedValue(mockExistingUser);

      const result = await authService.register({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('já existe');
    });
  });

  describe('generatePasswordResetToken', () => {
    it('deve gerar token seguro de 64 caracteres', () => {
      // Acessar método privado via instância
      const token = (authService as any).generatePasswordResetToken();
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes em hex = 64 caracteres
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('deve limpar tokens expirados', async () => {
      mockDb.executeRaw.mockResolvedValue({
        rowCount: 5,
      });

      const result = await authService.cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockDb.executeRaw).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM password_reset_tokens')
      );
    });

    it('deve retornar 0 se não houver tokens expirados', async () => {
      mockDb.executeRaw.mockResolvedValue({
        rowCount: 0,
      });

      const result = await authService.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });
});

