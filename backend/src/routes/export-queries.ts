/**
 * Export Queries Routes - Smart Signage v2.1
 * Rotas CRUD para queries de exportação
 */

import { Router } from 'express';
import express from 'express';

import { exportQueryService } from '../services/exportQueryService';
import { sqlValidatorService } from '../services/sqlValidatorService';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRole } from '../middleware/auth.middleware';
import { logError } from '../utils/loggerHelper';
import { isMissingTableError } from '../utils/dbErrors';
import { normalizeError } from '../utils/errors';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route GET /api/export-queries
 * @desc Lista todas as queries
 * @access Private (Admin, Manager)
 */
router.get('/', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
  let filters: Record<string, unknown> = {};
  try {
    const { provider, enabled, search, page, limit } = req.query;

    filters = {};
    if (provider) filters.provider = provider;
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    if (search) filters.search = search;
    if (page) filters.page = parseInt(page as string, 10);
    if (limit) filters.limit = parseInt(limit as string, 10);

    const result = await exportQueryService.getAllQueries(filters);

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
    await logError('Erro ao listar queries de exportação', e.error, { filters: req.query });
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar queries',
      error: e.message
    });
  }
});

/**
 * @route GET /api/export-queries/:id
 * @desc Busca query por ID
 * @access Private (Admin, Manager)
 */
router.get('/:id', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
  try {
    const queryId = parseInt(req.params.id);

    if (isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const query = await exportQueryService.getQueryById(queryId);

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query não encontrada'
      });
    }

    return res.json({
      success: true,
      data: query
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao buscar query de exportação', e.error, { queryId: req.params.id });
    return res.status(500).json({
      success: false,
      message: 'Erro ao buscar query',
      error: e.message
  });
  }
});

/**
 * @route POST /api/export-queries
 * @desc Cria nova query
 * @access Private (Admin, Manager)
 */
router.post('/', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
  try {
    const data = req.body;
    const userId = req.user!.id;

    // Validar dados obrigatórios
    if (!data.name || !data.provider || !data.sqlQuery || !data.exportConfig) {
      return res.status(400).json({
        success: false,
        message: 'Dados obrigatórios faltando: name, provider, sqlQuery, exportConfig'
      });
    }

    if (!data.databaseConfig) {
      data.databaseConfig = {};
    }

    // Validar SQL
    const sqlValidation = sqlValidatorService.validateSQL(data.sqlQuery, data.provider);
    if (!sqlValidation.valid) {
      return res.status(400).json({
        success: false,
        message: sqlValidation.error || 'SQL inválido',
        warnings: sqlValidation.warnings
      });
    }

    // Criar query
    const query = await exportQueryService.createQuery(data, userId);

    return res.status(201).json({
      success: true,
      data: query,
      message: 'Query criada com sucesso',
      warnings: sqlValidation.warnings
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao criar query de exportação', e.error, { userId: req.user?.id });
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar query',
      error: e.message
  });
  }
});

/**
 * @route PUT /api/export-queries/:id
 * @desc Atualiza query
 * @access Private (Admin, Manager)
 */
router.put('/:id', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
  try {
    const queryId = parseInt(req.params.id);
    const data = req.body;
    const userId = req.user!.id;

    if (isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const existingQuery = await exportQueryService.getQueryById(queryId);
    if (!existingQuery) {
      return res.status(404).json({
        success: false,
        message: 'Query não encontrada'
      });
    }

    // Validar SQL se estiver sendo atualizado
    if (data.sqlQuery) {
      const provider = data.provider || existingQuery.provider;
      const sqlValidation = sqlValidatorService.validateSQL(data.sqlQuery, provider);
      if (!sqlValidation.valid) {
        return res.status(400).json({
          success: false,
          message: sqlValidation.error || 'SQL inválido',
          warnings: sqlValidation.warnings
        });
      }
    }

    // Atualizar query
    const query = await exportQueryService.updateQuery(queryId, data, userId);

    return res.json({
      success: true,
      data: query,
      message: 'Query atualizada com sucesso'
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao atualizar query de exportação', e.error, { queryId: req.params.id, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      message: 'Erro ao atualizar query',
      error: e.message
  });
  }
});

/**
 * @route DELETE /api/export-queries/:id
 * @desc Exclui query
 * @access Private (Admin)
 */
router.delete('/:id', authorizeRole(['admin']), async (req: express.Request, res: express.Response) => {
  try {
    const queryId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    // Excluir query
    await exportQueryService.deleteQuery(queryId, userId);

    return res.json({
      success: true,
      message: 'Query excluída com sucesso'
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao excluir query de exportação', e.error, { queryId: req.params.id, userId: req.user?.id });
    return res.status(500).json({
      success: false,
      message: 'Erro ao excluir query',
      error: e.message
  });
  }
});

/**
 * @route POST /api/export-queries/:id/test-connection
 * @desc Testa conexão com banco de dados
 * @access Private (Admin, Manager)
 */
router.post('/:id/test-connection', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
  try {
    const queryId = parseInt(req.params.id);

    if (isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    const query = await exportQueryService.getQueryById(queryId);

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query não encontrada'
      });
    }

    const databaseConfig = typeof query.database_config === 'string'
      ? JSON.parse(query.database_config)
      : query.database_config;

    // Testar conexão
    const provider = req.body.provider || 'PostgreSQL';
    const connected = await exportQueryService.testConnection(provider, databaseConfig);

    return res.json({
      success: connected,
      message: connected ? 'Conexão estabelecida com sucesso' : 'Falha ao conectar ao banco de dados'
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao testar conexão de export query', e.error, { queryId: req.params.id });
    return res.status(500).json({
      success: false,
      message: 'Erro ao testar conexão',
      error: e.message
  });
  }
});

/**
 * @route POST /api/export-queries/validate-sql
 * @desc Valida sintaxe SQL
 * @access Private (Admin, Manager)
 */
router.post('/validate-sql', authorizeRole(['admin', 'admin_sql']), async (req: express.Request, res: express.Response) => {
  try {
    const { sql, provider } = req.body;

    if (!sql || !provider) {
      return res.status(400).json({
        success: false,
        message: 'SQL e provider são obrigatórios'
      });
    }

    // Validar SQL
    const validation = sqlValidatorService.validateSQL(sql, provider);

    return res.json({
      success: validation.valid,
      data: {
        valid: validation.valid,
        error: validation.error,
        warnings: validation.warnings,
        tables: validation.tables,
        columns: validation.columns
      }
    });} catch (error: unknown) {
    const e = normalizeError(error);
    await logError('Erro ao validar SQL de export query', e.error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao validar SQL',
      error: e.message
  });
  }
});

export default router;

