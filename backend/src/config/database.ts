/**
 * Database Configuration - Smart Signage v2.1
 * PostgreSQL-only implementation via pg (node-postgres)
 * 
 * Esta é a interface principal que mantém compatibilidade com o código existente
 */

export * from './database-pg';

// Re-exportar para manter compatibilidade
import { 
  initializeDatabase as initDB,
  getDatabase as getDB,
  closeDatabase as closeDB,
  createDatabaseWrapper
} from './database-pg';

export const initializeDatabase = initDB;
export const closeDatabase = closeDB;
export const getDatabase = () => createDatabaseWrapper();
