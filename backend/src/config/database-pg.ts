/**
 * Database Configuration - Smart Signage v2.1
 * PostgreSQL-only implementation via pg (node-postgres)
 * 
 * Removido: Prisma ORM
 * Adicionado: Connection pooling nativo do PostgreSQL
 */

import pg from 'pg';
import { logInfoSync, logErrorSync } from '../utils/loggerHelper';
import { databaseConfig as config } from './env';
import { ensureRemoteCommandTypesConstraint } from './schemaCompat';

const { Pool } = pg;

// Pool de conexões PostgreSQL
let pool: pg.Pool | null = null;

// Database configuration usando sistema centralizado
export const dbConfig = {
  host: config.host,
  port: config.port,
  database: config.database,
  user: config.user,
  password: config.password,
  max: config.poolSize,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: config.connectionTimeout,
};

// DATABASE_URL para compatibilidade
export const DATABASE_URL = config.url;

/**
 * Inicializa a conexão com o PostgreSQL
 */
export async function initializeDatabase(): Promise<pg.Pool> {
  try {
    // Validar que o driver configurado é PostgreSQL
    if (config.driver !== 'postgresql' && config.driver !== 'postgres') {
      throw new Error(
        `❌ ERRO: Driver de banco de dados '${config.driver}' não é suportado. ` +
        `Apenas PostgreSQL é suportado (DB_DRIVER=postgresql). ` +
        `Verifique SQL (único suportado).`
      );
    }

    if (!pool) {
      // Usar DATABASE_URL se disponível (tem precedência sobre parâmetros individuais)
      // Isso garante que a senha seja corretamente parseada da URL
      const poolConfig: pg.PoolConfig = config.url 
        ? { 
            connectionString: config.url,
            max: dbConfig.max,
            idleTimeoutMillis: dbConfig.idleTimeoutMillis,
            connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
          }
        : {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password || undefined, // Garantir que seja string ou undefined, nunca vazio
            max: dbConfig.max,
            idleTimeoutMillis: dbConfig.idleTimeoutMillis,
            connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
          };

      pool = new Pool(poolConfig);

      // Testar conexão
      await pool.query('SELECT NOW()');
      await ensureRemoteCommandTypesConstraint(pool);
      logInfoSync('PostgreSQL conectado com sucesso', {
        database: dbConfig.database,
        host: dbConfig.host,
        port: dbConfig.port
      });
      
      return pool;
    }
    
    return pool;
  } catch (error: any) {
    logErrorSync('Erro ao conectar ao PostgreSQL', error, {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database
    });
    throw error;
  }
}

/**
 * Obtém o pool de conexões
 */
export function getDatabase(): pg.Pool {
  if (!pool) {
    throw new Error('Database não inicializado. Chame initializeDatabase() primeiro.');
  }
  return pool;
}

/**
 * Fecha todas as conexões do pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logInfoSync('PostgreSQL desconectado', {});
  }
}

/**
 * Executa uma query SQL com parâmetros
 * @param text SQL query com placeholders $1, $2, etc.
 * @param params Array de parâmetros
 */
export async function query<T extends pg.QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const db = getDatabase();
  return db.query<T>(text, params);
}

/**
 * Executa uma transação
 * @param callback Função que recebe um client e retorna o resultado
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const db = getDatabase();
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Wrapper para compatibilidade com código existente
 * Converte queries com placeholders ? para $1, $2, etc.
 */
class DatabaseWrapper {
  private pool: pg.Pool;
  private queryLogger?: (query: string, params?: any[], duration?: number, rowCount?: number, error?: string) => void;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  /**
   * Define função de callback para logar queries (usado pelo debug service)
   */
  setQueryLogger(logger: (query: string, params?: any[], duration?: number, rowCount?: number, error?: string) => void): void {
    this.queryLogger = logger;
  }

  /**
   * Converte query com ? placeholders para $1, $2, etc.
   */
  private convertQuery(query: string, params: any[]): { text: string; values: any[] } {
    // Se a query já utiliza placeholders $1, $2, etc., apenas repassar
    if (/\$\d+/.test(query)) {
      return {
        text: query,
        values: params ?? [],
      };
    }

    let convertedQuery = query;
    const values: any[] = [];
    let paramIndex = 1;

    // Substituir ? por $1, $2, etc.
    convertedQuery = convertedQuery.replace(/\?/g, () => {
      const index = values.length;
      if (index < params.length) {
        values.push(params[index]);
        paramIndex++;
        return `$${paramIndex - 1}`;
      }
      throw new Error(`Not enough parameters for query. Expected ${index + 1} but got ${params.length}`);
    });

    return { text: convertedQuery, values };
  }

  /**
   * Busca múltiplos registros
   */
  async findMany(query: string, params: any[] = []): Promise<any[]> {
    const { text, values } = this.convertQuery(query, params);
    const startTime = Date.now();
    try {
      const result = await this.pool.query(text, values);
      const duration = Date.now() - startTime;
      if (this.queryLogger) {
        this.queryLogger(text, values, duration, result.rowCount ?? undefined);
      }
      return result.rows;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (this.queryLogger) {
        this.queryLogger(text, values, duration, undefined, error.message);
      }
      throw error;
    }
  }

  /**
   * Busca o primeiro registro
   */
  async findFirst(query: string, params: any[] = []): Promise<any | null> {
    const { text, values } = this.convertQuery(query, params);
    const startTime = Date.now();
    try {
      const result = await this.pool.query(text, values);
      const duration = Date.now() - startTime;
      if (this.queryLogger) {
        this.queryLogger(text, values, duration, result.rowCount ?? undefined);
      }
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (this.queryLogger) {
        this.queryLogger(text, values, duration, undefined, error.message);
      }
      throw error;
    }
  }

  /**
   * Executa query (INSERT, UPDATE, DELETE)
   */
  async executeRaw(query: string, params: any[] = []): Promise<any> {
    const { text, values } = this.convertQuery(query, params);
    const startTime = Date.now();
    try {
      const result = await this.pool.query(text, values);
      const duration = Date.now() - startTime;
      if (this.queryLogger) {
        this.queryLogger(text, values, duration, result.rowCount ?? undefined);
      }
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      if (this.queryLogger) {
        this.queryLogger(text, values, duration, undefined, error.message);
      }
      throw error;
    }
  }

  /**
   * Verifica se uma tabela existe
   */
  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  }
}

/**
 * Cria uma instância do DatabaseWrapper
 */
export function createDatabaseWrapper(): DatabaseWrapper {
  return new DatabaseWrapper(getDatabase());
}

// Exportar DatabaseWrapper para compatibilidade
export { DatabaseWrapper };

