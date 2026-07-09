/**
 * Testes unitários - dbErrors (isDatabaseError, isMissingTableError)
 * Smart Signage Pro - erros de banco para status 500 vs 400
 */

import { isDatabaseError, isMissingTableError, isUniqueViolationError } from '../../../utils/dbErrors';

describe('dbErrors', () => {
  describe('isMissingTableError', () => {
    it('retorna true para código 42P01', () => {
      expect(isMissingTableError({ code: '42P01' })).toBe(true);
      expect(isMissingTableError({ code: '42P01', message: 'any' })).toBe(true);
    });

    it('retorna true quando message contém "does not exist"', () => {
      expect(isMissingTableError({ message: 'relation "foo" does not exist' })).toBe(true);
    });

    it('retorna true quando message contém "relation "', () => {
      expect(isMissingTableError({ message: 'relation xyz not found' })).toBe(true);
    });

    it('retorna false para erro null/undefined', () => {
      expect(isMissingTableError(null)).toBe(false);
      expect(isMissingTableError(undefined)).toBe(false);
    });

    it('retorna false para erro sem code nem message relevante', () => {
      expect(isMissingTableError({ message: 'Validation failed' })).toBe(false);
    });
  });

  describe('isUniqueViolationError', () => {
    it('retorna true para código 23505', () => {
      expect(isUniqueViolationError({ code: '23505' })).toBe(true);
    });

    it('retorna true quando message contém duplicate key', () => {
      expect(isUniqueViolationError({ message: 'duplicate key value violates unique constraint' })).toBe(true);
    });

    it('retorna false para erro null/undefined', () => {
      expect(isUniqueViolationError(null)).toBe(false);
      expect(isUniqueViolationError(undefined)).toBe(false);
    });
  });

  describe('isDatabaseError', () => {
    it('retorna false para violação de unicidade (23505)', () => {
      expect(isDatabaseError({ code: '23505' })).toBe(false);
    });

    it('retorna true para erro com code PostgreSQL (5 caracteres)', () => {
      expect(isDatabaseError({ code: '42P01' })).toBe(true);
      expect(isDatabaseError({ code: '23000' })).toBe(true);
    });

    it('retorna true para erro com code de 2 caracteres', () => {
      expect(isDatabaseError({ code: '42' })).toBe(true);
    });

    it('retorna true quando message contém "violates"', () => {
      expect(isDatabaseError({ message: 'violates check constraint' })).toBe(true);
    });

    it('retorna true quando message contém "constraint"', () => {
      expect(isDatabaseError({ message: 'constraint "xyz" failed' })).toBe(true);
    });

    it('retorna false quando message contém "duplicate key"', () => {
      expect(isDatabaseError({ message: 'duplicate key value' })).toBe(false);
    });

    it('retorna false quando message contém "unique constraint"', () => {
      expect(isDatabaseError({ message: 'unique constraint violated' })).toBe(false);
    });

    it('retorna false para erro null/undefined', () => {
      expect(isDatabaseError(null)).toBe(false);
      expect(isDatabaseError(undefined)).toBe(false);
    });

    it('retorna false para erro de validação (sem code PG)', () => {
      expect(isDatabaseError({ message: 'Nome é obrigatório' })).toBe(false);
      expect(isDatabaseError({ message: 'Invalid email' })).toBe(false);
    });

    it('retorna false para code não string ou formato inválido', () => {
      expect(isDatabaseError({ code: 23505 })).toBe(false);
      expect(isDatabaseError({ code: 'X' })).toBe(false);
      expect(isDatabaseError({ code: '123456' })).toBe(false);
    });
  });
});
