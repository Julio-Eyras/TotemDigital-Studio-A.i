/**
 * Database Configuration - Smart Signage v2.0
 * Simplified PostgreSQL-only implementation via Prisma
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Global Prisma instance
let prisma: PrismaClient;

// Database configuration
export const dbConfig = {
  driver: process.env.DB_DRIVER || 'postgresql',
  url: process.env.DATABASE_URL || 'postgresql://smartsignage:smartsignage123@localhost:5432/smartsignage',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smartsignage',
  username: process.env.DB_USER || 'smartsignage',
  password: process.env.DB_PASSWORD || 'smartsignage123',
};

// Initialize database connection
export async function initializeDatabase(): Promise<PrismaClient> {
  try {
    if (!prisma) {
      prisma = new PrismaClient({
        datasources: {
          db: {
            url: dbConfig.url,
          },
        },
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      });

      // Test connection
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      
      // Run migrations if needed
      await runMigrations();
    }
    
    return prisma;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  try {
    if (prisma) {
      await prisma.$disconnect();
      console.log('✅ Database disconnected');
    }
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

// Database wrapper to provide compatibility with existing services
class DatabaseWrapper {
  private prismaClient: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prismaClient = prismaClient;
  }

  // Raw query methods
  async findMany(query: string, params: any[] = []): Promise<any[]> {
    // Convert parameterized query to Prisma format
    const processedQuery = this.processQuery(query, params);
    return await this.prismaClient.$queryRawUnsafe(processedQuery);
  }

  async findFirst(query: string, params: any[] = []): Promise<any | null> {
    const processedQuery = this.processQuery(query, params);
    const results = await this.prismaClient.$queryRawUnsafe(processedQuery);
    return Array.isArray(results) && results.length > 0 ? results[0] : null;
  }

  async executeRaw(query: string, params: any[] = []): Promise<any> {
    const processedQuery = this.processQuery(query, params);
    return await this.prismaClient.$executeRawUnsafe(processedQuery);
  }

  // Helper method to process parameterized queries
  private processQuery(query: string, params: any[]): string {
    let processedQuery = query;
    params.forEach((param, index) => {
      // Replace ? with $1, $2, etc. for PostgreSQL
      processedQuery = processedQuery.replace('?', `$${index + 1}`);
    });
    return processedQuery;
  }

  // Direct access to Prisma client for ORM operations
  get prisma(): PrismaClient {
    return this.prismaClient;
  }

  // Check if a table exists
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.prismaClient.$queryRawUnsafe(`
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '${tableName}'
        LIMIT 1
      `);
      return Array.isArray(result) && result.length > 0;
    } catch (error) {
      console.error(`[DB] Erro ao verificar existência da tabela ${tableName}:`, error);
      return false;
    }
  }
}

// Get database instance
export function getDatabase(): DatabaseWrapper {
  if (!prisma) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return new DatabaseWrapper(prisma);
}

// Run basic migrations
async function runMigrations(): Promise<void> {
  try {
    // Check if tables exist, if not create them
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    if (!Array.isArray(tables) || tables.length === 0) {
      console.log('🔄 Running initial migrations...');
      
      // Create basic tables
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS users (
          user_id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          client_id INTEGER REFERENCES clients(client_id),
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS clients (
          client_id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS totems (
          totem_id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          location VARCHAR(255),
          client_id INTEGER REFERENCES clients(client_id),
          is_active BOOLEAN DEFAULT true,
          last_heartbeat TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS medias (
          media_id SERIAL PRIMARY KEY,
          client_id INTEGER REFERENCES clients(client_id),
          name VARCHAR(255) NOT NULL,
          title VARCHAR(255),
          description TEXT,
          tags JSONB,
          version INTEGER DEFAULT 1,
          checksum VARCHAR(255),
          preview_url VARCHAR(500),
          status VARCHAR(50) DEFAULT 'draft',
          created_by INTEGER REFERENCES users(user_id),
          file_path VARCHAR(500) NOT NULL,
          media_type VARCHAR(50) NOT NULL,
          duration_seconds INTEGER,
          size_bytes INTEGER NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          width INTEGER,
          height INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS playlists (
          playlist_id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          client_id INTEGER REFERENCES clients(client_id),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS playlist_items (
          item_id SERIAL PRIMARY KEY,
          playlist_id INTEGER REFERENCES playlists(playlist_id) ON DELETE CASCADE,
          media_id INTEGER REFERENCES medias(media_id) ON DELETE CASCADE,
          order_index INTEGER NOT NULL,
          duration INTEGER DEFAULT 10000,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create default admin user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin', 12);
      
      await prisma.$executeRaw`
        INSERT INTO users (username, email, password_hash, name, role) 
        VALUES ('admin', 'admin@smart-signage.com', $1, 'Administrator', 'admin')
        ON CONFLICT (username) DO NOTHING
      `, [hashedPassword];

      console.log('✅ Initial migrations completed');
    } else {
      console.log('✅ Database tables already exist');
    }
    } catch (error) {
    console.error('❌ Migration error:', error);
    // Don't throw error for migration failures in development
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}

// Health check
export async function healthCheck(): Promise<boolean> {
  try {
    if (!prisma) return false;
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

// Export types
export type { PrismaClient } from '@prisma/client';