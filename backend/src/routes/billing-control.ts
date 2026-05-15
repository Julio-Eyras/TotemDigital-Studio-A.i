/**
 * Painel de controlo de faturamento (APIs modernas).
 */

import express, { Response } from 'express';
import { query, validationResult } from 'express-validator';
import { authMiddleware, authorizeRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { getBillingControlService } from '../services/billingControlService';
import { logError } from '../utils/loggerHelper';

const router = express.Router();

router.use(authMiddleware);

const validateRequest = (req: express.Request, res: Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Dados inválidos', details: errors.array() });
  }
  return next();
};

/**
 * @route GET /api/billing-control/dashboard
 * @desc KPIs de faturas (anunciantes + exibidor) e resumo de contratos
 */
router.get(
  '/dashboard',
  authorizeRole([
    'owner_system',
    'admin',
    'admin_sql',
    'operador_faturamento',
    'gerente_financeiro',
    'publisher_user',
    'subscriber_user',
  ]),
  query('subscriberId').optional().isInt({ min: 1 }),
  query('publisherId').optional().isInt({ min: 1 }),
  query('dueSoonDays').optional().isInt({ min: 1, max: 365 }),
  validateRequest,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const role = String(req.user?.role || '').toLowerCase();
      let subscriberId = req.query.subscriberId ? parseInt(req.query.subscriberId as string, 10) : undefined;
      let publisherId = req.query.publisherId ? parseInt(req.query.publisherId as string, 10) : undefined;

      if (role === 'subscriber_user' && req.user?.subscriberId != null) {
        subscriberId = Number(req.user.subscriberId);
      }
      if (role === 'publisher_user' && req.user?.publisherId != null) {
        publisherId = Number(req.user.publisherId);
      }

      const dueSoonDays = req.query.dueSoonDays
        ? parseInt(req.query.dueSoonDays as string, 10)
        : undefined;

      const data = await getBillingControlService().getDashboard({
        subscriberId,
        publisherId,
        dueSoonDays,
      });

      return res.json({ success: true, data });
    } catch (error: any) {
      await logError('Erro no painel de faturamento', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao carregar painel de faturamento',
        message: error.message || 'Erro interno do servidor',
      });
    }
  }
);

export default router;
