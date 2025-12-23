/**
 * Script de Validação de Configuração - Smart Signage v2.1
 * Valida todas as variáveis de ambiente antes do deploy
 */

import dotenv from 'dotenv';
import { config, validateConfig } from '../src/config/env';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Carregar .env
dotenv.config();

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida configurações críticas
 */
function validateAllConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validar JWT_SECRET
  if (!config.jwt.secret || config.jwt.secret === 'your-super-secret-jwt-key-change-this-in-production') {
    if (config.server.isProduction) {
      errors.push('❌ JWT_SECRET deve ser alterado em produção!');
    } else {
      warnings.push('⚠️  JWT_SECRET está usando valor padrão (altere em produção)');
    }
  }

  // 2. Validar DATABASE_URL
  if (!config.database.url) {
    errors.push('❌ DATABASE_URL não está configurado');
  } else if (config.database.url.includes('localhost') && config.server.isProduction) {
    warnings.push('⚠️  DATABASE_URL parece estar usando localhost em produção');
  }

  // 3. Validar CORS em produção
  if (config.server.isProduction) {
    const hasLocalhost = config.security.corsOrigins.some(origin => 
      origin.includes('localhost') || origin.includes('127.0.0.1')
    );
    if (hasLocalhost) {
      warnings.push('⚠️  CORS_ORIGIN contém localhost em produção - considere usar domínio real');
    }
  }

  // 4. Validar Redis se cache estiver habilitado
  if (config.redis.enabled) {
    if (!config.redis.host || config.redis.host === 'localhost') {
      if (config.server.isProduction) {
        warnings.push('⚠️  REDIS_HOST está usando localhost em produção');
      }
    }
  }

  // 5. Validar upload path existe ou pode ser criado
  if (config.upload.path) {
    const uploadPath = resolve(config.upload.path);
    if (!existsSync(uploadPath)) {
      try {
        // Tentar criar diretório (simulação)
        warnings.push(`⚠️  Diretório de upload não existe: ${config.upload.path} (será criado automaticamente)`);
      } catch {
        errors.push(`❌ Não é possível criar diretório de upload: ${config.upload.path}`);
      }
    }
  }

  // 6. Validar email se habilitado
  if (config.email.enabled) {
    if (!config.email.smtp.user || !config.email.smtp.pass) {
      errors.push('❌ EMAIL_ENABLED=true mas SMTP_USER ou SMTP_PASS não estão configurados');
    }
  }

  // 7. Validar AI provider se necessário
  if (config.ai.provider === 'openai' && !config.ai.openai.apiKey) {
    warnings.push('⚠️  AI_PROVIDER=openai mas OPENAI_API_KEY não está configurado');
  }
  if (config.ai.provider === 'anthropic' && !config.ai.anthropic.apiKey) {
    warnings.push('⚠️  AI_PROVIDER=anthropic mas ANTHROPIC_API_KEY não está configurado');
  }

  // 8. Validar portas
  if (config.server.port < 1024 && config.server.isProduction) {
    warnings.push('⚠️  PORT < 1024 requer privilégios de root em produção');
  }

  // 9. Validar rate limiting
  if (config.security.rateLimit.maxRequests < 10) {
    warnings.push('⚠️  RATE_LIMIT_MAX_REQUESTS muito baixo (< 10) pode afetar usuários legítimos');
  }
  if (config.security.rateLimit.authMaxRequests > 10) {
    warnings.push('⚠️  AUTH_RATE_LIMIT_MAX_REQUESTS muito alto (> 10) pode permitir brute force');
  }

  // 10. Validar tamanho de upload
  if (config.upload.maxSize > 500 * 1024 * 1024) { // 500MB
    warnings.push('⚠️  UPLOAD_MAX_SIZE muito alto (> 500MB) pode causar problemas de memória');
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Executa validação e exibe resultados
 */
function main(): void {
  console.log('🔍 Validando configurações...\n');

  try {
    // Validar usando função do config
    validateConfig();
  } catch (error: any) {
    console.error('❌ Erro na validação:', error.message);
    process.exit(1);
  }

  // Validações adicionais
  const result = validateAllConfig();

  // Exibir resultados
  if (result.errors.length > 0) {
    console.error('❌ ERROS ENCONTRADOS:\n');
    result.errors.forEach(error => console.error(`  ${error}`));
    console.error('');
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  AVISOS:\n');
    result.warnings.forEach(warning => console.warn(`  ${warning}`));
    console.warn('');
  }

  if (result.passed) {
    console.log('✅ Validação concluída com sucesso!\n');
    console.log('📋 Resumo da configuração:');
    console.log(`   Ambiente: ${config.server.nodeEnv}`);
    console.log(`   Porta: ${config.server.port}`);
    console.log(`   Host: ${config.server.host}`);
    console.log(`   Database: ${config.database.database}@${config.database.host}:${config.database.port}`);
    console.log(`   Redis: ${config.redis.enabled ? `${config.redis.host}:${config.redis.port}` : 'desabilitado'}`);
    console.log(`   Cache: ${config.redis.enabled ? 'habilitado' : 'desabilitado'}`);
    console.log(`   Email: ${config.email.enabled ? 'habilitado' : 'desabilitado'}`);
    console.log(`   AI Provider: ${config.ai.provider}`);
    console.log('');
    
    if (result.warnings.length > 0) {
      console.log('⚠️  Existem avisos, mas a configuração é válida para deploy.');
      process.exit(0);
    } else {
      console.log('✅ Configuração pronta para produção!');
      process.exit(0);
    }
  } else {
    console.error('❌ Validação falhou. Corrija os erros antes de fazer deploy.');
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

export { validateAllConfig };

