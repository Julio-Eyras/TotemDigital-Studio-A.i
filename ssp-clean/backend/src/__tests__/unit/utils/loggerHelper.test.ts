/**
 * Testes unitários - loggerHelper
 * Smart Signage Pro v2.1
 */

import { sanitizeForLogging } from '../../../utils/loggerHelper';

describe('loggerHelper - sanitizeForLogging', () => {
  describe('sanitizeForLogging', () => {
    it('deve retornar dados primitivos inalterados', () => {
      expect(sanitizeForLogging(null)).toBe(null);
      expect(sanitizeForLogging(undefined)).toBe(undefined);
      expect(sanitizeForLogging('text')).toBe('text');
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(true)).toBe(true);
    });

    it('deve redactar campos sensíveis', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com'
      };
      const result = sanitizeForLogging(input);
      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.email).toBe('john@example.com');
    });

    it('deve redactar token e authorization', () => {
      const input = {
        token: 'jwt-token-xyz',
        authorization: 'Bearer abc123',
        access_token: 'access-xyz'
      };
      const result = sanitizeForLogging(input);
      expect(result.token).toBe('[REDACTED]');
      expect(result.authorization).toBe('[REDACTED]');
      expect(result.access_token).toBe('[REDACTED]');
    });

    it('deve sanitizar objetos aninhados', () => {
      const input = {
        user: {
          name: 'John',
          password: 'secret'
        }
      };
      const result = sanitizeForLogging(input);
      expect(result.user.name).toBe('John');
      expect(result.user.password).toBe('[REDACTED]');
    });

    it('deve sanitizar arrays', () => {
      const input = [
        { id: 1, secret: 'value' }
      ];
      const result = sanitizeForLogging(input);
      expect(result[0].id).toBe(1);
      expect(result[0].secret).toBe('[REDACTED]');
    });

    it('deve preservar campos não sensíveis', () => {
      const input = {
        userId: 1,
        campaignId: 42,
        metadata: { foo: 'bar' }
      };
      const result = sanitizeForLogging(input);
      expect(result.userId).toBe(1);
      expect(result.campaignId).toBe(42);
      expect(result.metadata.foo).toBe('bar');
    });
  });
});
