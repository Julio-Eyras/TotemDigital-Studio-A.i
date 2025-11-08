import { Router, Response } from 'express';
import * as fs from 'fs';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { exportExecutionService } from '../services/exportExecutionService';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['admin', 'manager', 'auditor']), async (req: any, res: Response) => {
  try {
    const {
      scheduleId,
      queryId,
      status,
      search,
      startDate,
      endDate,
      page,
      limit
    } = req.query;

    const filters: any = {};
    if (scheduleId) filters.scheduleId = parseInt(scheduleId as string, 10);
    if (queryId) filters.queryId = parseInt(queryId as string, 10);
    if (status) filters.status = status;
    if (search) filters.search = search;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (page) filters.page = parseInt(page as string, 10);
    if (limit) filters.limit = parseInt(limit as string, 10);

    const result = await exportExecutionService.getExecutions(filters);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar execuções:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar execuções',
      error: error.message
    });
  }
});

router.get('/:id', authorizeRole(['admin', 'manager', 'auditor']), async (req: any, res: Response) => {
  try {
    const executionId = parseInt(req.params.id, 10);

    if (isNaN(executionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const execution = await exportExecutionService.getExecutionById(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execução não encontrada'
      });
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar execução:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar execução',
      error: error.message
    });
  }
});

router.get('/:id/download', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const executionId = parseInt(req.params.id, 10);

    if (isNaN(executionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const fileInfo = await exportExecutionService.getExecutionFilePath(executionId);

    if (!fileInfo) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não disponível para esta execução'
      });
    }

    if (!fs.existsSync(fileInfo.filePath)) {
      return res.status(410).json({
        success: false,
        message: 'Arquivo não encontrado no sistema de arquivos'
      });
    }

    res.download(fileInfo.filePath, fileInfo.fileName);
  } catch (error: any) {
    console.error('❌ Erro ao baixar arquivo de execução:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao baixar arquivo de execução',
      error: error.message
    });
  }
});

export default router;
/**
 * Export Executions Routes - Smart Signage v2.1
 * Rotas para histórico de execuções de exportação
 */

import { Router, Response } from 'express';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { exportExecutionService } from '../services/exportExecutionService';
import * as path from 'path';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/export-executions
 * Lista execuções com filtros e paginação
 */
router.get('/', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const executions = await exportExecutionService.getExecutions({
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      status: req.query.status as string | undefined,
      scheduleId: req.query.scheduleId ? parseInt(req.query.scheduleId as string) : undefined,
      queryId: req.query.queryId ? parseInt(req.query.queryId as string) : undefined,
      search: req.query.search as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      sortField: req.query.sortField as any,
      sortOrder: req.query.sortOrder as any
    });

    res.json({
      success: true,
      data: executions.data,
      pagination: executions.pagination
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar execuções:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar execuções',
      error: error.message
    });
  }
});

/**
 * GET /api/export-executions/:id
 * Detalhes de uma execução
 */
router.get('/:id', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const executionId = parseInt(req.params.id);
    if (isNaN(executionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const execution = await exportExecutionService.getExecutionById(executionId);
    if (!execution) {
      return res.status(404).json({
        success: false,
        message: 'Execução não encontrada'
      });
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar execução:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar execução',
      error: error.message
    });
  }
});

/**
 * GET /api/export-executions/:id/download
 * Download do arquivo exportado
 */
router.get('/:id/download', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const executionId = parseInt(req.params.id);
    if (isNaN(executionId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const filePath = await exportExecutionService.getExecutionFilePath(executionId);
    if (!filePath) {
      return res.status(404).json({
        success: false,
        message: 'Arquivo não encontrado'
      });
    }

    return res.download(filePath, path.basename(filePath));
  } catch (error: any) {
    console.error('❌ Erro ao baixar arquivo:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao baixar arquivo',
      error: error.message
    });
  }
});

export default router;

