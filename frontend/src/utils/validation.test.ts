/**
 * Testes unitários - utilitários de validação
 */

import {
  validateEmail,
  validateURL,
  validateRequired,
  validateNumber,
  validateStringLength,
  validateFileSize,
  validateFileType,
  validatePayloadSize,
  VALIDATION_CONSTANTS,
} from './validation';

describe('validation', () => {
  describe('validateEmail', () => {
    it('deve aceitar email válido', () => {
      expect(validateEmail('user@example.com').valid).toBe(true);
      expect(validateEmail('a@b.co').valid).toBe(true);
    });
    it('deve rejeitar email inválido', () => {
      expect(validateEmail('invalid').valid).toBe(false);
      expect(validateEmail('@domain.com').valid).toBe(false);
      expect(validateEmail('user@').valid).toBe(false);
      expect(validateEmail('').valid).toBe(false);
    });
  });

  describe('validateURL', () => {
    it('deve aceitar URL válida', () => {
      expect(validateURL('https://example.com').valid).toBe(true);
      expect(validateURL('http://localhost:3000').valid).toBe(true);
    });
    it('deve rejeitar URL inválida', () => {
      expect(validateURL('not-a-url').valid).toBe(false);
      expect(validateURL('').valid).toBe(false);
    });
  });

  describe('validateRequired', () => {
    it('deve aceitar valor preenchido', () => {
      expect(validateRequired('texto', 'Campo').valid).toBe(true);
      expect(validateRequired(1, 'Número').valid).toBe(true);
    });
    it('deve rejeitar zero como vazio (comportamento atual)', () => {
      expect(validateRequired(0, 'Número').valid).toBe(false);
    });
    it('deve rejeitar valor vazio', () => {
      expect(validateRequired('', 'Nome').valid).toBe(false);
      expect(validateRequired('   ', 'Nome').valid).toBe(false);
      expect(validateRequired(null, 'Nome').valid).toBe(false);
      expect(validateRequired(undefined, 'Nome').valid).toBe(false);
    });
    it('deve incluir nome do campo na mensagem de erro', () => {
      const r = validateRequired('', 'Título');
      expect(r.valid).toBe(false);
      expect(r.error).toContain('Título');
    });
  });

  describe('validateNumber', () => {
    it('deve aceitar número no intervalo', () => {
      expect(validateNumber(5, 0, 10).valid).toBe(true);
      expect(validateNumber('5', 0, 10).valid).toBe(true);
    });
    it('deve rejeitar valor não numérico', () => {
      expect(validateNumber('abc').valid).toBe(false);
    });
    it('deve rejeitar número abaixo do mínimo', () => {
      expect(validateNumber(2, 5, 10).valid).toBe(false);
    });
    it('deve rejeitar número acima do máximo', () => {
      expect(validateNumber(15, 0, 10).valid).toBe(false);
    });
  });

  describe('validateStringLength', () => {
    it('deve aceitar string dentro do tamanho', () => {
      expect(validateStringLength('abc', 2, 10).valid).toBe(true);
    });
    it('deve rejeitar string menor que mínimo', () => {
      expect(validateStringLength('a', 2, 10).valid).toBe(false);
    });
    it('deve rejeitar string maior que máximo', () => {
      expect(validateStringLength('abcdefghijk', 2, 10).valid).toBe(false);
    });
  });

  describe('validateFileSize', () => {
    it('deve aceitar arquivo dentro do limite', () => {
      const file = new File(['x'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: 100 });
      expect(validateFileSize(file, 1024).valid).toBe(true);
    });
    it('deve rejeitar arquivo acima do limite', () => {
      const file = new File(['x'], 'test.txt', { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: 2048 });
      const r = validateFileSize(file, 1024);
      expect(r.valid).toBe(false);
      expect(r.error).toBeDefined();
    });
  });

  describe('validateFileType', () => {
    it('deve aceitar tipo permitido', () => {
      const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
      expect(validateFileType(file, ['image/jpeg', 'image/png']).valid).toBe(true);
    });
    it('deve rejeitar tipo não permitido', () => {
      const file = new File(['x'], 'test.pdf', { type: 'application/pdf' });
      const r = validateFileType(file, ['image/jpeg']);
      expect(r.valid).toBe(false);
      expect(r.error).toBeDefined();
    });
  });

  describe('validatePayloadSize', () => {
    it('deve aceitar payload dentro do limite', () => {
      expect(validatePayloadSize({ a: 1 }, 1024).valid).toBe(true);
    });
    it('deve rejeitar payload acima do limite', () => {
      const big = 'x'.repeat(2048);
      const r = validatePayloadSize({ data: big }, 1024);
      expect(r.valid).toBe(false);
      expect(r.error).toBeDefined();
    });
    it('com limite 0 não restringe tamanho', () => {
      const big = 'x'.repeat(50000);
      expect(validatePayloadSize({ data: big }, 0).valid).toBe(true);
    });
  });

  describe('validateFileSize', () => {
    it('com limite 0 aceita qualquer tamanho', () => {
      const f = new File([new Uint8Array(1_000_000)], 'x.bin');
      expect(validateFileSize(f, 0).valid).toBe(true);
    });
  });

  describe('VALIDATION_CONSTANTS', () => {
    it('deve exportar constantes esperadas', () => {
      expect(VALIDATION_CONSTANTS.MAX_UPLOAD_SIZE).toBeGreaterThan(0);
      expect(VALIDATION_CONSTANTS.ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(Array.isArray(VALIDATION_CONSTANTS.ALLOWED_FILE_TYPES)).toBe(true);
    });
  });
});
