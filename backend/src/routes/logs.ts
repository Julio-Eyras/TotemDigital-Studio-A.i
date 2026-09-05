/**
 * Logs Routes - Smart Signage v2.1
 * Rotas para gerenciamento de logs e rotação
 */

import { Router } from 'express';
import express from 'express';

import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { LogRotationService } from '../services/logRotationService';
import { reloadLogger } from '../config/logger';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = Router();
const logRotationService = new LogRotationService();

/**
 * @route POST /api/logs/frontend-error
 * @desc Receber erros do frontend para logging
 * @access Public (para permitir logging mesmo sem autenticação)
 * 
 * Esta rota deve estar ANTES do middleware de autenticação
 */
router.post('/frontend-error', async (req: express.Request, res: express.Response) => {
  try {
    const { error, errorInfo, context } = req.body;

    if (!error || !error.message) {
      return res.status(400).json({
        success: false,
        message: 'Dados de erro inválidos'
      });
    }

    // Logar erro usando o sistema de logging
    const errorMessage = `[Frontend Error] ${error.name}: ${error.message}`;
    const errorObj = new Error(errorMessage);
    errorObj.stack = error.stack;

    await logError(errorMessage, errorObj, {
      source: 'frontend',
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      componentStack: errorInfo?.componentStack,
      context: {
        ...context,
        url: context?.url,
        userAgent: context?.userAgent,
        timestamp: context?.timestamp,
      }
    });

    return res.json({
      success: true,
      message: 'Erro registrado com sucesso'
    });
} catch (logErr: unknown) {    // Não falhar se o logging falhar - tentar logar usando logger helper
    await logError('Erro ao registrar erro do frontend', logErr, { route: '/api/logs/frontend-error' }).catch(() => {
      // Se até o logger falhar, ignorar silenciosamente
    });
    return res.status(500).json({
      success: false,
      message: 'Erro ao registrar log'
    });
  }
});

// Middleware de autenticação para todas as rotas (exceto /frontend-error que está acima)
router.use(authenticateToken);

/**
 * @route GET /api/logs/config
 * @desc Obter configurações de logs
 * @access Private (Admin)
 */
router.get('/config', authorizeRole(['admin']), async (_req: express.Request, res: express.Response) => {
  try {
    const config = await logRotationService.getConfig();
    
    return res.json({
      success: true,
      data: {
        ...config,
        maxSizeFormatted: formatSize(config.maxSize),
        minFreeSpaceFormatted: formatSize(config.minFreeSpace)
      }
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao obter configurações de logs', e.error, { route: '/api/logs/config' });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * @route GET /api/logs/files
 * @desc Listar arquivos de log
 * @access Private (Admin)
 */
router.get('/files', authorizeRole(['admin']), async (_req: express.Request, res: express.Response) => {
  try {
    const config = await logRotationService.getConfig();
    const files = await logRotationService.listLogFiles(config.logDirectory);
    
    return res.json({
      success: true,
      data: files.map(file => ({
        ...file,
        sizeFormatted: formatSize(file.size),
        age: Math.floor((Date.now() - file.modified.getTime()) / (24 * 60 * 60 * 1000))
      }))
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao listar arquivos de log', e.error, { route: '/api/logs/files' });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * @route GET /api/logs/disk-space
 * @desc Obter informações de espaço em disco
 * @access Private (Admin)
 */
router.get('/disk-space', authorizeRole(['admin']), async (_req: express.Request, res: express.Response) => {
  try {
    const config = await logRotationService.getConfig();
    const diskSpace = await logRotationService.getDiskSpace(config.logDirectory);
    
    return res.json({
      success: true,
      data: {
        ...diskSpace,
        totalFormatted: formatSize(diskSpace.total),
        freeFormatted: formatSize(diskSpace.free),
        usedFormatted: formatSize(diskSpace.used),
        percentFree: (100 - diskSpace.percentUsed).toFixed(2)
      }
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao obter espaço em disco', e.error, { route: '/api/logs/disk-space' });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * @route GET /api/logs/rotation-status
 * @desc Verificar status de rotação de logs
 * @access Private (Admin)
 */
router.get('/rotation-status', authorizeRole(['admin']), async (_req: express.Request, res: express.Response) => {
  try {
    const rotationCheck = await logRotationService.checkRotation();
    
    return res.json({
      success: true,
      data: rotationCheck
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao verificar rotação de logs', e.error, { route: '/api/logs/rotation-status' });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * @route POST /api/logs/rotate
 * @desc Rotacionar logs manualmente
 * @access Private (Admin)
 */
router.post('/rotate', authorizeRole(['admin']), async (_req: express.Request, res: express.Response) => {
  try {
    const result = await logRotationService.rotateLogs();
    
    return res.json({
      success: result.success,
      message: result.success 
        ? `Logs rotacionados: ${result.filesRotated} arquivos rotacionados, ${result.filesDeleted} arquivos excluídos`
        : 'Erro ao rotacionar logs',
      data: result
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao rotacionar logs', e.error, { route: '/api/logs/rotate' });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * @route POST /api/logs/reload
 * @desc Recarregar configurações do logger
 * @access Private (Admin)
 */
router.post('/reload', authorizeRole(['admin']), async (_req: express.Request, res: express.Response) => {
  try {
    await reloadLogger();
    
    return res.json({
      success: true,
      message: 'Configurações do logger recarregadas com sucesso'
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao recarregar logger', e.error, { route: '/api/logs/reload' });
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: e.message
  });
  }
});

/**
 * Formatar tamanho em bytes para string legível
 */
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export default router;

