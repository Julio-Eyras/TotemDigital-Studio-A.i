/**
 * SQL Validator Service Tests - Smart Signage v2.1
 */

import { SQLValidatorService } from '../../services/sqlValidatorService';

describe('SQLValidatorService', () => {
  let validator: SQLValidatorService;

  beforeEach(() => {
    validator = new SQLValidatorService();
  });

  describe('validateSQL', () => {
    it('deve retornar erro quando query está vazia', () => {
      const result = validator.validateSQL('', 'PostgreSQL');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Query SQL não pode estar vazia');
    });

    it('deve bloquear palavras-chave perigosas', () => {
      const result = validator.validateSQL('SELECT * FROM users; DROP TABLE users;', 'PostgreSQL');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Palavra-chave');
    });

    it('deve aceitar SELECT para PostgreSQL', () => {
      const result = validator.validateSQL('SELECT id, name FROM users WHERE active = true', 'PostgreSQL');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('deve rejeitar comandos não SELECT para PostgreSQL', () => {
      const result = validator.validateSQL('UPDATE users SET name = \'John\'', 'PostgreSQL');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Apenas queries SELECT são permitidas para PostgreSQL');
    });

    it('deve validar queries Redis não vazias', () => {
      const result = validator.validateSQL('GET user:1', 'Redis');
      expect(result.valid).toBe(true);
    });

    it('deve rejeitar queries Redis vazias', () => {
      const result = validator.validateSQL('   ', 'Redis');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Query Redis não pode estar vazia');
    });

    it('deve validar queries Grafana não vazias', () => {
      const result = validator.validateSQL('rate(node_cpu_seconds_total[5m])', 'Grafana');
      expect(result.valid).toBe(true);
    });

    it('deve validar queries Prometheus não vazias', () => {
      const result = validator.validateSQL('sum(rate(http_requests_total[5m]))', 'Prometheus');
      expect(result.valid).toBe(true);
    });
  });

  describe('extractTables', () => {
    it('deve extrair tabelas de query com JOINs', () => {
      const sql = 'SELECT u.id, o.total FROM users u JOIN orders o ON o.user_id = u.id';

      const tables = validator.extractTables(sql);

      expect(tables).toEqual(['users', 'orders']);
    });
  });

  describe('extractColumns', () => {
    it('deve extrair colunas únicas da cláusula SELECT', () => {
      const sql = 'SELECT u.id, u.name AS userName, o.total FROM users u JOIN orders o ON o.user_id = u.id';

      const columns = validator.extractColumns(sql);

      expect(columns).toEqual(['id', 'userName', 'total']);
    });

    it('deve ignorar * na cláusula SELECT', () => {
      const sql = 'SELECT *, created_at FROM users';
      const columns = validator.extractColumns(sql);

      expect(columns).toEqual(['created_at']);
    });
  });
});
