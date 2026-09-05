

import express from 'express';
import { query, param } from 'express-validator';
import { playerDebugService } from '../services/playerDebugService';
import { logError } from '../utils/loggerHelper';
import { normalizeError } from '../utils/errors';

const router = express.Router();

/**
 * @route GET /api/player/debug/transactions
 * @desc Buscar transações de debug do player
 * @access Private (Admin)
 */
router.get('/transactions',
  query('uin').optional().isString(),
  query('action').optional().isString(),
  query('status').optional().isString().isIn(['success', 'error', 'pending']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  async (req: express.Request, res: express.Response) => {
    try {
      const filters: Record<string, unknown> = {};

      if (req.query.uin) {
        filters.uin = req.query.uin as string;
      }

      if (req.query.action) {
        filters.action = req.query.action as string;
      }

      if (req.query.status) {
        filters.status = req.query.status as string;
      }

      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }

      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }

      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string);
      }

      const transactions = await playerDebugService.getTransactions(filters);

      return res.json({
        success: true,
        count: transactions.length,
        filters: filters,
        transactions: transactions
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar transações de debug', e.error, { route: '/api/player/debug/transactions', filters: req.query });
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: e.message
    });
    }
  }
);

/**
 * @route GET /api/player/debug/transactions/:transactionId
 * @desc Buscar transação específica por ID
 * @access Private (Admin)
 */
router.get('/transactions/:transactionId',
  param('transactionId').isString(),
  async (req: express.Request, res: express.Response) => {
    const { transactionId } = req.params;
    try {
      const transactions = await playerDebugService.getTransactions({
        limit: 1000
      });

      const transaction = transactions.find(t => t.transactionId === transactionId);

      if (!transaction) {
        return res.status(404).json({ 
          error: 'Transação não encontrada',
          transactionId: transactionId
        });
      }

      return res.json({
        success: true,
        transaction: transaction
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao buscar transação', e.error, { route: '/api/player/debug/transactions/:transactionId', transactionId });
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: e.message
    });
    }
  }
);

/**
 * @route POST /api/player/debug/cleanup
 * @desc Limpar transações antigas
 * @access Private (Admin)
 */
router.post('/cleanup',
  query('daysToKeep').optional().isInt({ min: 1, max: 365 }),
  async (req: express.Request, res: express.Response) => {
    const daysToKeep = parseInt(req.query.daysToKeep as string) || 30;
    try {

      const deletedCount = await playerDebugService.cleanupOldTransactions(daysToKeep);

      return res.json({
        success: true,
        message: `Transações antigas removidas (mantidas últimas ${daysToKeep} dias)`,
        deletedCount: deletedCount
      });} catch (error: unknown) {
      const e = normalizeError(error);
      await logError('Erro ao limpar transações', e.error, { route: '/api/player/debug/cleanup', daysToKeep });
      return res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: e.message
    });
    }
  }
);

export default router;

