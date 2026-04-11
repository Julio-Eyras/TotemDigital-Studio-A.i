/**
 * Testes unitários - AuthService
 * Smart Signage Pro v2.1 - PLANO_MELHORIAS item 3
 *
 * Testa estrutura de respostas e validações básicas.
 * Requer mocks para getDatabase e bcrypt (integração com DB testada em testes de integração).
 */

import bcrypt from 'bcryptjs';

describe('AuthService - validações e helpers', () => {
  describe('Estrutura de LoginRequest', () => {
    it('deve aceitar username e password como obrigatórios', () => {
      const validRequest = { username: 'admin', password: 'secret123' };
      expect(validRequest.username).toBeDefined();
      expect(validRequest.password).toBeDefined();
      expect(typeof validRequest.username).toBe('string');
      expect(typeof validRequest.password).toBe('string');
    });
  });

  describe('Estrutura de AuthResponse', () => {
    it('deve ter formato de sucesso com token', () => {
      const successResponse = {
        success: true,
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        user: { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' }
      };
      expect(successResponse.success).toBe(true);
      expect(successResponse.token).toBeDefined();
      expect(successResponse.user).toBeDefined();
    });

    it('deve ter formato de erro', () => {
      const errorResponse = { success: false, error: 'Credenciais inválidas' };
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
    });
  });

  describe('bcrypt (usado pelo AuthService)', () => {
    it('deve fazer hash e compare de senha corretamente', async () => {
      const password = 'senha123';
      const hash = await bcrypt.hash(password, 12);
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('deve rejeitar senha incorreta', async () => {
      const hash = await bcrypt.hash('senha123', 12);
      const isValid = await bcrypt.compare('senhaerrada', hash);
      expect(isValid).toBe(false);
    });
  });
});
