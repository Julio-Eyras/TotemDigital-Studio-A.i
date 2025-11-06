/**
 * Logs Routes - Smart Signage v2.1
 * Rotas para gerenciamento de logs e rotação
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';
import { LogRotationService } from '../services/logRotationService';
import { getLogger, reloadLogger } from '../config/logger';

const router = Router();
const logRotationService = new LogRotationService();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @route GET /api/logs/config
 * @desc Obter configurações de logs
 * @access Private (Admin)
 */
router.get('/config', authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const config = await logRotationService.getConfig();
    
    res.json({
      success: true,
      data: {
        ...config,
        maxSizeFormatted: formatSize(config.maxSize),
        minFreeSpaceFormatted: formatSize(config.minFreeSpace)
      }
    });
  } catch (error: any) {
    console.error('❌ Erro ao obter configurações de logs:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/logs/files
 * @desc Listar arquivos de log
 * @access Private (Admin)
 */
router.get('/files', authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const config = await logRotationService.getConfig();
    const files = await logRotationService.listLogFiles(config.logDirectory);
    
    res.json({
      success: true,
      data: files.map(file => ({
        ...file,
        sizeFormatted: formatSize(file.size),
        age: Math.floor((Date.now() - file.modified.getTime()) / (24 * 60 * 60 * 1000))
      }))
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar arquivos de log:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/logs/disk-space
 * @desc Obter informações de espaço em disco
 * @access Private (Admin)
 */
router.get('/disk-space', authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const config = await logRotationService.getConfig();
    const diskSpace = await logRotationService.getDiskSpace(config.logDirectory);
    
    res.json({
      success: true,
      data: {
        ...diskSpace,
        totalFormatted: formatSize(diskSpace.total),
        freeFormatted: formatSize(diskSpace.free),
        usedFormatted: formatSize(diskSpace.used),
        percentFree: (100 - diskSpace.percentUsed).toFixed(2)
      }
    });
  } catch (error: any) {
    console.error('❌ Erro ao obter espaço em disco:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route GET /api/logs/rotation-status
 * @desc Verificar status de rotação de logs
 * @access Private (Admin)
 */
router.get('/rotation-status', authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const rotationCheck = await logRotationService.checkRotation();
    
    res.json({
      success: true,
      data: rotationCheck
    });
  } catch (error: any) {
    console.error('❌ Erro ao verificar rotação de logs:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/logs/rotate
 * @desc Rotacionar logs manualmente
 * @access Private (Admin)
 */
router.post('/rotate', authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const result = await logRotationService.rotateLogs();
    
    res.json({
      success: result.success,
      message: result.success 
        ? `Logs rotacionados: ${result.filesRotated} arquivos rotacionados, ${result.filesDeleted} arquivos excluídos`
        : 'Erro ao rotacionar logs',
      data: result
    });
  } catch (error: any) {
    console.error('❌ Erro ao rotacionar logs:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * @route POST /api/logs/reload
 * @desc Recarregar configurações do logger
 * @access Private (Admin)
 */
router.post('/reload', authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    await reloadLogger();
    
    res.json({
      success: true,
      message: 'Configurações do logger recarregadas com sucesso'
    });
  } catch (error: any) {
    console.error('❌ Erro ao recarregar logger:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
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

