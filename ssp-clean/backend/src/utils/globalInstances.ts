/**
 * Global Instances Manager - Smart Signage Pro v3.1
 * Gerencia instâncias singleton de serviços de forma tipada
 */

import { AuditService } from '../services/auditService';
import { AuthService } from '../services/authService';
import { AIService } from '../services/aiService';

interface GlobalInstances {
  auditServiceInstance?: AuditService;
  authServiceInstance?: AuthService;
  aiServiceInstance?: AIService;
}

/**
 * Obtém objeto global tipado
 */
function getGlobalInstances(): GlobalInstances {
  return global as typeof globalThis & GlobalInstances;
}

/**
 * Obtém ou cria instância do AuditService
 */
export function getAuditServiceInstance(): AuditService {
  const globalObj = getGlobalInstances();
  if (!globalObj.auditServiceInstance) {
    globalObj.auditServiceInstance = new AuditService();
  }
  return globalObj.auditServiceInstance;
}

/**
 * Obtém ou cria instância do AuthService
 */
export function getAuthServiceInstance(): AuthService {
  const globalObj = getGlobalInstances();
  if (!globalObj.authServiceInstance) {
    globalObj.authServiceInstance = new AuthService();
  }
  return globalObj.authServiceInstance;
}

/**
 * Obtém ou cria instância do AIService
 */
export function getAIServiceInstance(): AIService {
  const globalObj = getGlobalInstances();
  if (!globalObj.aiServiceInstance) {
    globalObj.aiServiceInstance = new AIService();
  }
  return globalObj.aiServiceInstance;
}

