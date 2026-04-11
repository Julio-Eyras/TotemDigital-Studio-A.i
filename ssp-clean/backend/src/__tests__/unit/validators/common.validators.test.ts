/**
 * Testes unitários - validators comuns
 */

import { validationResult } from 'express-validator';
import {
  paginationValidators,
  idParamValidator,
  nameValidators,
  emailValidators,
  listValidators,
} from '../../../validators/common.validators';
import { runValidators } from '../../helpers/validatorRunner';

describe('common.validators', () => {
  describe('paginationValidators', () => {
    it('deve aceitar page e limit válidos', async () => {
      const req = { query: { page: '1', limit: '10' } };
      await runValidators(req, paginationValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar page inválida (0)', async () => {
      const req = { query: { page: '0', limit: '10' } };
      await runValidators(req, paginationValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
      expect(result.array().length).toBeGreaterThan(0);
    });

    it('deve rejeitar limit fora do máximo', async () => {
      const req = { query: { page: '1', limit: '99999' } };
      await runValidators(req, paginationValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('idParamValidator', () => {
    it('deve aceitar id numérico válido', async () => {
      const req = { params: { id: '42' } };
      await runValidators(req, idParamValidator('id'));
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar id não numérico', async () => {
      const req = { params: { id: 'abc' } };
      await runValidators(req, idParamValidator('id'));
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('nameValidators', () => {
    it('deve aceitar nome válido (2-100 caracteres)', async () => {
      const req = { body: { name: 'João Silva' } };
      await runValidators(req, nameValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar nome vazio', async () => {
      const req = { body: { name: '' } };
      await runValidators(req, nameValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });

    it('deve rejeitar nome com 1 caractere', async () => {
      const req = { body: { name: 'J' } };
      await runValidators(req, nameValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('emailValidators', () => {
    it('deve aceitar email válido', async () => {
      const req = { body: { email: 'user@example.com' } };
      await runValidators(req, emailValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(true);
    });

    it('deve rejeitar email inválido', async () => {
      const req = { body: { email: 'invalid-email' } };
      await runValidators(req, emailValidators);
      const result = validationResult(req as any);
      expect(result.isEmpty()).toBe(false);
    });
  });

  describe('listValidators', () => {
    it('deve exportar array de validadores', () => {
      expect(Array.isArray(listValidators)).toBe(true);
      expect(listValidators.length).toBeGreaterThan(0);
    });
  });
});
