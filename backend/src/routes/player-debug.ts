import express, { Request, Response } from 'express';
import { query, param } from 'express-validator';
import { playerDebugService } from '../services/playerDebugService';

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
  async (req: Request, res: Response) => {
    try {
      const filters: any = {};

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

      res.json({
        success: true,
        count: transactions.length,
        filters: filters,
        transactions: transactions
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar transações de debug:', error.message);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message
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
  async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;

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

      res.json({
        success: true,
        transaction: transaction
      });

    } catch (error: any) {
      console.error('❌ Erro ao buscar transação:', error.message);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message
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
  async (req: Request, res: Response) => {
    try {
      const daysToKeep = parseInt(req.query.daysToKeep as string) || 30;

      const deletedCount = await playerDebugService.cleanupOldTransactions(daysToKeep);

      res.json({
        success: true,
        message: `Transações antigas removidas (mantidas últimas ${daysToKeep} dias)`,
        deletedCount: deletedCount
      });

    } catch (error: any) {
      console.error('❌ Erro ao limpar transações:', error.message);
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        message: error.message
      });
    }
  }
);

export default router;

