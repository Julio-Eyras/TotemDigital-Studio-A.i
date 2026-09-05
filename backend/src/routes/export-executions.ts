import { Router} from 'express';

import express from 'express';
import * as fs from 'fs';
import { authMiddleware, authorizeRole } from '../middleware/auth.middleware';
import { exportExecutionService } from '../services/exportExecutionService';
import { logError } from '../utils/loggerHelper';
import { isMissingTableError } from '../utils/dbErrors';
import { normalizeError } from '../utils/errors';

const router = Router();

router.use(authMiddleware);

router.get('/', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
  let filters: Record<string, unknown> = {};
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

    filters = {};
    if (scheduleId) filters.scheduleId = parseInt(scheduleId as string, 10);
    if (queryId) filters.queryId = parseInt(queryId as string, 10);
    if (status) filters.status = status;
    if (search) filters.search = search;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (page) filters.page = parseInt(page as string, 10);
    if (limit) filters.limit = parseInt(limit as string, 10);

    const result = await exportExecutionService.getExecutions(filters);

    return res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit
      }
    });} catch (error: unknown) {
    const e = normalizeError(error);
    if (isMissingTableError(error)) {
      return res.json({
        success: true,
        data: [],
        pagination: { total: 0, page: 1, limit: filters?.limit || 10 }
  });
    }
    await logError('Erro ao listar execuções de exportação', e.error, { filters: req.query });
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar execuções',
      error: e.message
    });
  }
});

router.get('/:id', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
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

    return res.json({
      success: true,
      data: execution
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao buscar execução de exportação', e.error, { executionId: req.params.id });
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar execução',
      error: e.message
  });
  }
});

router.get('/:id/download', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
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

      return res.download(fileInfo.filePath, fileInfo.fileName);} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao baixar arquivo de execução', e.error, { executionId: req.params.id });
    return res.status(500).json({
      success: false,
      message: 'Erro ao baixar arquivo de execução',
      error: e.message
  });
  }
});

export default router;
