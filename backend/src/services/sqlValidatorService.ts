/**
 * SQL Validator Service - Smart Signage v2.1
 * Validação de sintaxe SQL por provider
 */

import { normalizeError } from '../utils/errors';
export interface SQLValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  tables?: string[];
  columns?: string[];
}

export class SQLValidatorService {
  /**
   * Valida sintaxe SQL básica
   */
  validateSQL(sql: string, provider: 'PostgreSQL' | 'Redis' | 'Grafana' | 'Prometheus'): SQLValidationResult {
    try {
      // Limpar SQL
      const cleanedSQL = sql.trim().toUpperCase();

      // Validações básicas
      if (!cleanedSQL) {
        return {
          valid: false,
          error: 'Query SQL não pode estar vazia'
        };
      }

      // Verificar se é SELECT (apenas SELECT para PostgreSQL)
      // Redis, Grafana e Prometheus podem ter outras sintaxes
      if (provider === 'PostgreSQL' && !cleanedSQL.startsWith('SELECT')) {
        return {
          valid: false,
          error: 'Apenas queries SELECT são permitidas para PostgreSQL'
        };
      }

      // Verificar palavras-chave perigosas
      const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE'];
      for (const keyword of dangerousKeywords) {
        if (cleanedSQL.includes(keyword)) {
          return {
            valid: false,
            error: `Palavra-chave '${keyword}' não é permitida para exportação`
          };
        }
      }

      // Validações específicas por provider
      switch (provider) {
        case 'PostgreSQL':
          return this.validatePostgreSQL(sql);
        case 'Redis':
          return this.validateRedis(sql);
        case 'Grafana':
          return this.validateGrafana(sql);
        case 'Prometheus':
          return this.validatePrometheus(sql);
        default:
          return {
            valid: false,
            error: `Provider não suportado: ${provider}`
          };
 
}} catch (error: unknown) {
      const e = normalizeError(error);
      return {
        valid: false,
        error: `Erro ao validar SQL: ${e.message}`
      };
    }
  }

  /**
   * Valida sintaxe PostgreSQL
   */
  private validatePostgreSQL(sql: string): SQLValidationResult {
    const warnings: string[] = [];
    
    // Verificar sintaxe específica do PostgreSQL
    if (sql.includes('LIMIT') && sql.includes('TOP')) {
      warnings.push('PostgreSQL não usa TOP, use LIMIT');
    }

    // Verificar se usa aspas simples para strings
    if (sql.includes('"') && !sql.includes("'")) {
      warnings.push('PostgreSQL usa aspas simples para strings, não aspas duplas');
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Valida sintaxe Redis (queries de keys/values)
   */
  private validateRedis(sql: string): SQLValidationResult {
    const warnings: string[] = [];
    
    // Redis não usa SQL tradicional, mas pode usar queries de chaves
    // Por enquanto, apenas validação básica
    if (!sql.trim()) {
      return {
        valid: false,
        error: 'Query Redis não pode estar vazia'
      };
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Valida sintaxe Grafana (queries PromQL ou SQL)
   */
  private validateGrafana(sql: string): SQLValidationResult {
    const warnings: string[] = [];
    
    // Grafana pode usar SQL ou PromQL
    // Por enquanto, validação básica
    if (!sql.trim()) {
      return {
        valid: false,
        error: 'Query Grafana não pode estar vazia'
      };
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Valida sintaxe Prometheus (PromQL)
   */
  private validatePrometheus(sql: string): SQLValidationResult {
    const warnings: string[] = [];
    
    // Prometheus usa PromQL, não SQL
    // Por enquanto, validação básica
    if (!sql.trim()) {
      return {
        valid: false,
        error: 'Query Prometheus não pode estar vazia'
      };
    }

    // PromQL não é SQL, então não precisa validar SELECT
    // Apenas garantir que não está vazio
    
    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Extrai tabelas mencionadas na query
   */
  extractTables(sql: string): string[] {
    try {
      const tables: string[] = [];
      const fromMatch = sql.match(/FROM\s+([\w\.]+)/gi);
      
      if (fromMatch) {
        fromMatch.forEach(match => {
          const table = match.replace(/FROM\s+/i, '').trim();
          if (table && !tables.includes(table)) {
            tables.push(table);
          }
        });
      }

      const joinMatch = sql.match(/JOIN\s+([\w\.]+)/gi);
      if (joinMatch) {
        joinMatch.forEach(match => {
          const table = match.replace(/JOIN\s+/i, '').trim();
          if (table && !tables.includes(table)) {
            tables.push(table);
          }
        });
      }

      return tables;
} catch (error: unknown) {
      return [];
    }
  }

  /**
   * Extrai colunas mencionadas na query
   */
  extractColumns(sql: string): string[] {
    try {
      const columns: string[] = [];
      const selectMatch = sql.match(/SELECT\s+(.*?)\s+FROM/i);
      
      if (selectMatch) {
        const selectPart = selectMatch[1];
        // Separar por vírgula
        const columnList = selectPart.split(',');
        
        columnList.forEach(col => {
          const column = col.trim().replace(/\s+AS\s+[\w]+/i, '').replace(/[\w\.]+\./g, '').trim();
          if (column && column !== '*' && !columns.includes(column)) {
            columns.push(column);
          }
        });
      }

      return columns;
} catch (error: unknown) {
      return [];
    }
  }
}

// Exportar instância singleton
export const sqlValidatorService = new SQLValidatorService();

