/**
 * Testes unitários - apiResponse
 * Smart Signage Pro v2.1 - PLANO_MELHORIAS item 4
 */

import { successResponse, errorResponse, paginatedResponse } from '../../../utils/apiResponse';

describe('apiResponse', () => {
  describe('successResponse', () => {
    it('deve retornar objeto com success: true e data', () => {
      const data = { id: 1, name: 'test' };
      const result = successResponse(data);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('deve incluir meta quando fornecida', () => {
      const data = [1, 2, 3];
      const meta = { page: 1, total: 100 };
      const result = successResponse(data, meta);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.meta).toEqual(meta);
    });

    it('deve aceitar dados primitivos', () => {
      expect(successResponse(null).data).toBe(null);
      expect(successResponse('ok').data).toBe('ok');
      expect(successResponse(42).data).toBe(42);
    });
  });

  describe('errorResponse', () => {
    it('deve retornar objeto com success: false e error', () => {
      const result = errorResponse('Erro de validação');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Erro de validação');
      expect(result.message).toBe('Erro de validação');
    });

    it('deve incluir message quando diferente de error', () => {
      const result = errorResponse('Erro', 'Mensagem técnica');
      expect(result.error).toBe('Erro');
      expect(result.message).toBe('Mensagem técnica');
    });

    it('deve incluir details quando fornecida', () => {
      const details = { field: 'email', reason: 'invalid' };
      const result = errorResponse('Erro', undefined, details);
      expect(result.details).toEqual(details);
    });
  });

  describe('paginatedResponse', () => {
    it('deve retornar estrutura paginada correta', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, limit: 10, total: 25 };
      const result = paginatedResponse(items, pagination);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(items);
      const meta = result.meta as { pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean } };
      expect(meta.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false
      });
    });

    it('deve calcular hasNext e hasPrev corretamente', () => {
      const items: unknown[] = [];
      const result = paginatedResponse(items, { page: 2, limit: 10, total: 25 });
      const meta = result.meta as { pagination: { hasNext: boolean; hasPrev: boolean } };
      expect(meta.pagination.hasNext).toBe(true);
      expect(meta.pagination.hasPrev).toBe(true);
    });

    it('deve indicar última página', () => {
      const items = [{ id: 1 }];
      const result = paginatedResponse(items, { page: 3, limit: 10, total: 25 });
      const meta = result.meta as { pagination: { hasNext: boolean; totalPages: number } };
      expect(meta.pagination.hasNext).toBe(false);
      expect(meta.pagination.totalPages).toBe(3);
    });
  });
});
