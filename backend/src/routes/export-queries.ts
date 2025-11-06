/**
 * Export Queries Routes - Smart Signage v2.1
 * Rotas CRUD para queries de exportação
 */

import { Router, Request, Response } from 'express';
import { exportQueryService } from '../services/exportQueryService';
import { sqlValidatorService } from '../services/sqlValidatorService';
import { authMiddleware } from '../middleware/auth.middleware';
import { authorizeRole } from '../middleware/auth.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

/**
 * @route GET /api/export-queries
 * @desc Lista todas as queries
 * @access Private (Admin, Manager)
 */
router.get('/', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const { provider, enabled, search } = req.query;

    const filters: any = {};
    if (provider) filters.provider = provider;
    if (enabled !== undefined) filters.enabled = enabled === 'true';
    if (search) filters.search = search;

    const queries = await exportQueryService.getAllQueries(filters);

    res.json({
      success: true,
      data: queries,
      count: queries.length
    });
  } catch (error: any) {
    console.error('❌ Erro ao listar queries:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar queries',
      error: error.message
    });
  }
});

/**
 * @route GET /api/export-queries/:id
 * @desc Busca query por ID
 * @access Private (Admin, Manager)
 */
router.get('/:id', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
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

    res.json({
      success: true,
      data: query
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar query:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar query',
      error: error.message
    });
  }
});

/**
 * @route POST /api/export-queries
 * @desc Cria nova query
 * @access Private (Admin, Manager)
 */
router.post('/', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const data = req.body;
    const userId = req.user.id;

    // Validar dados obrigatórios
    if (!data.name || !data.provider || !data.sqlQuery || !data.databaseConfig || !data.exportConfig) {
      return res.status(400).json({
        success: false,
        message: 'Dados obrigatórios faltando: name, provider, sqlQuery, databaseConfig, exportConfig'
      });
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

    res.status(201).json({
      success: true,
      data: query,
      message: 'Query criada com sucesso',
      warnings: sqlValidation.warnings
    });
  } catch (error: any) {
    console.error('❌ Erro ao criar query:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar query',
      error: error.message
    });
  }
});

/**
 * @route PUT /api/export-queries/:id
 * @desc Atualiza query
 * @access Private (Admin, Manager)
 */
router.put('/:id', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
  try {
    const queryId = parseInt(req.params.id);
    const data = req.body;
    const userId = req.user.id;

    if (isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    // Validar SQL se estiver sendo atualizado
    if (data.sqlQuery && data.provider) {
      const sqlValidation = sqlValidatorService.validateSQL(data.sqlQuery, data.provider);
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

    res.json({
      success: true,
      data: query,
      message: 'Query atualizada com sucesso'
    });
  } catch (error: any) {
    console.error('❌ Erro ao atualizar query:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar query',
      error: error.message
    });
  }
});

/**
 * @route DELETE /api/export-queries/:id
 * @desc Exclui query
 * @access Private (Admin)
 */
router.delete('/:id', authorizeRole(['admin']), async (req: any, res: Response) => {
  try {
    const queryId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }

    // Excluir query
    await exportQueryService.deleteQuery(queryId, userId);

    res.json({
      success: true,
      message: 'Query excluída com sucesso'
    });
  } catch (error: any) {
    console.error('❌ Erro ao excluir query:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir query',
      error: error.message
    });
  }
});

/**
 * @route POST /api/export-queries/:id/test-connection
 * @desc Testa conexão com banco de dados
 * @access Private (Admin, Manager)
 */
router.post('/:id/test-connection', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
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

    res.json({
      success: connected,
      message: connected ? 'Conexão estabelecida com sucesso' : 'Falha ao conectar ao banco de dados'
    });
  } catch (error: any) {
    console.error('❌ Erro ao testar conexão:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao testar conexão',
      error: error.message
    });
  }
});

/**
 * @route POST /api/export-queries/validate-sql
 * @desc Valida sintaxe SQL
 * @access Private (Admin, Manager)
 */
router.post('/validate-sql', authorizeRole(['admin', 'manager']), async (req: any, res: Response) => {
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

    res.json({
      success: validation.valid,
      data: {
        valid: validation.valid,
        error: validation.error,
        warnings: validation.warnings,
        tables: validation.tables,
        columns: validation.columns
      }
    });
  } catch (error: any) {
    console.error('❌ Erro ao validar SQL:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao validar SQL',
      error: error.message
    });
  }
});

export default router;

