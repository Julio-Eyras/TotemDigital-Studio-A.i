/**
 * Jest Setup - Smart Signage v2.1
 * Configuração inicial para testes
 */

import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente de teste
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Configurar variáveis de ambiente padrão para testes
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/smartsignage_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.EMAIL_ENABLED = 'false'; // Desabilitar email em testes por padrão

// Timeout padrão para unitários (integração usa setup.integration.ts)
jest.setTimeout(10000);

// Mock de console para reduzir output em testes
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

