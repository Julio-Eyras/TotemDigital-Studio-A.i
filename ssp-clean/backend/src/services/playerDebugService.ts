import { getDatabase } from '../config/database';
import { logError } from '../utils/loggerHelper';

export interface PlayerTransaction {
  transactionId: string;
  timestamp: Date;
  uin: string | null;
  action: string;
  status: 'success' | 'error' | 'pending';
  requestUrl?: string;
  requestMethod?: string;
  requestHeaders?: any;
  requestBody?: any;
  responseStatus?: number;
  responseBody?: any;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  duration?: number;
  metadata?: any;
}

export class PlayerDebugService {
  private get db() {
    return getDatabase();
  }

  /**
   * Registra uma transação do player
   */
  async logTransaction(transaction: Omit<PlayerTransaction, 'timestamp'>): Promise<void> {
    try {
      const timestamp = new Date();
      
      // Criar tabela de debug se não existir
      await this.ensureTableExists();

      // Inserir transação
      await this.db.executeRaw(`
        INSERT INTO player_debug_transactions (
          transaction_id,
          timestamp,
          uin,
          action,
          status,
          request_url,
          request_method,
          request_headers,
          request_body,
          response_status,
          response_body,
          error_message,
          ip_address,
          user_agent,
          duration,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        transaction.transactionId,
        timestamp,
        transaction.uin || null,
        transaction.action,
        transaction.status,
        transaction.requestUrl || null,
        transaction.requestMethod || null,
        transaction.requestHeaders ? JSON.stringify(transaction.requestHeaders) : null,
        transaction.requestBody ? JSON.stringify(transaction.requestBody) : null,
        transaction.responseStatus || null,
        transaction.responseBody ? JSON.stringify(transaction.responseBody) : null,
        transaction.errorMessage || null,
        transaction.ipAddress || null,
        transaction.userAgent || null,
        transaction.duration || null,
        transaction.metadata ? JSON.stringify(transaction.metadata) : null
      ]);

    } catch (error: any) {
      // Não falhar silenciosamente, mas logar erro
      await logError('[PlayerDebug] Erro ao registrar transação', error, { transaction });
    }
  }

  /**
   * Busca transações do player
   */
  async getTransactions(filters?: {
    uin?: string;
    action?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<PlayerTransaction[]> {
    try {
      await this.ensureTableExists();

      let query = `
        SELECT 
          transaction_id,
          timestamp,
          uin,
          action,
          status,
          request_url,
          request_method,
          request_headers,
          request_body,
          response_status,
          response_body,
          error_message,
          ip_address,
          user_agent,
          duration,
          metadata
        FROM player_debug_transactions
        WHERE 1=1
      `;
      const params: any[] = [];

      if (filters?.uin) {
        query += ` AND uin = ?`;
        params.push(filters.uin);
      }

      if (filters?.action) {
        query += ` AND action = ?`;
        params.push(filters.action);
      }

      if (filters?.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters?.startDate) {
        query += ` AND timestamp >= ?`;
        params.push(filters.startDate);
      }

      if (filters?.endDate) {
        query += ` AND timestamp <= ?`;
        params.push(filters.endDate);
      }

      query += ` ORDER BY timestamp DESC`;

      if (filters?.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      } else {
        query += ` LIMIT 100`;
      }

      const rows = await this.db.findMany(query, params);

      return rows.map((row: any) => ({
        transactionId: row.transaction_id,
        timestamp: new Date(row.timestamp),
        uin: row.uin,
        action: row.action,
        status: row.status,
        requestUrl: row.request_url,
        requestMethod: row.request_method,
        requestHeaders: row.request_headers ? JSON.parse(row.request_headers) : undefined,
        requestBody: row.request_body ? JSON.parse(row.request_body) : undefined,
        responseStatus: row.response_status,
        responseBody: row.response_body ? JSON.parse(row.response_body) : undefined,
        errorMessage: row.error_message,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        duration: row.duration,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));

    } catch (error: any) {
      await logError('[PlayerDebug] Erro ao buscar transações', error, { filters });
      return [];
    }
  }

  /**
   * Cria tabela de debug se não existir
   */
  private async ensureTableExists(): Promise<void> {
    try {
      await this.db.executeRaw(`
        CREATE TABLE IF NOT EXISTS player_debug_transactions (
          id SERIAL PRIMARY KEY,
          transaction_id VARCHAR(100) NOT NULL UNIQUE,
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          uin VARCHAR(100),
          action VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          request_url TEXT,
          request_method VARCHAR(10),
          request_headers JSONB,
          request_body JSONB,
          response_status INTEGER,
          response_body JSONB,
          error_message TEXT,
          ip_address VARCHAR(45),
          user_agent TEXT,
          duration INTEGER,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Criar índices para performance
      await this.db.executeRaw(`
        CREATE INDEX IF NOT EXISTS idx_player_debug_uin ON player_debug_transactions(uin)
      `).catch(() => {});

      await this.db.executeRaw(`
        CREATE INDEX IF NOT EXISTS idx_player_debug_timestamp ON player_debug_transactions(timestamp DESC)
      `).catch(() => {});

      await this.db.executeRaw(`
        CREATE INDEX IF NOT EXISTS idx_player_debug_action ON player_debug_transactions(action)
      `).catch(() => {});

      await this.db.executeRaw(`
        CREATE INDEX IF NOT EXISTS idx_player_debug_status ON player_debug_transactions(status)
      `).catch(() => {});

    } catch (error: any) {
      // Se a tabela já existe, ignora o erro
      if (!error.message?.includes('already exists')) {
        await logError('[PlayerDebug] Erro ao criar tabela', error, {});
      }
    }
  }

  /**
   * Limpa transações antigas (mais de 30 dias)
   */
  async cleanupOldTransactions(daysToKeep: number = 30): Promise<number> {
    try {
      await this.ensureTableExists();

      const result = await this.db.executeRaw(`
        DELETE FROM player_debug_transactions
        WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '${daysToKeep} days'
      `);

      return (result as any).rowCount || 0;
    } catch (error: any) {
      await logError('[PlayerDebug] Erro ao limpar transações antigas', error, { daysToKeep });
      return 0;
    }
  }

  /**
   * Gera ID único para transação
   */
  static generateTransactionId(prefix: string = 'TXN'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const playerDebugService = new PlayerDebugService();


